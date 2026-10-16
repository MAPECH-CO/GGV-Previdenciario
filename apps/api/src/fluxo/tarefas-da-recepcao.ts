// GGVP-158 P7.2: as tarefas da Recepção que a Central do Atendimento calculava na tela viram linhas da tabela de tarefas:
// "Cobrar documento" e "Decidir cobrança" (D1.23), "Conferir checklist" (D1.21), as boas-vindas (D1.22) e as do fechamento
// (D1.14). As regras são as puras das telas. A sincronização acerta as linhas: abre a que falta, fecha a que não vale mais
// e atualiza o prazo e o detalhe; uma aberta por chave (o título e o caso, ou a pessoa sem caso; o banco segura). Roda
// quando a ficha é guardada (toda rota da Recepção passa por lá) e, pelo que muda só com a data (o lembrete, o limite da
// cobrança, o recontato), na rodada de 5 minutos.
import { and, eq, inArray, isNull, or } from 'drizzle-orm'
import type { Banco } from '../banco/conexao.ts'
import { boasVindas, cobrancaDocumento, tarefa } from '../banco/esquema.ts'
import { criarChecklist } from '../rotas/recepcao-checklist.ts'
import { ilegivelEmAberto } from '../rotas/recepcao-documentos.ts'
import { criarFichario } from '../rotas/recepcao.ts'
import { hojeEmBrasilia } from '../vigilia/fila.ts'
import { limitesDeCobranca } from './exigencia.ts'
import { nomeBeneficio, nomeMotivo, nomeTipo } from '../../../web/src/dados/catalogos.ts'
import type { Ficha } from '../../../web/src/dados/tipos.ts'
import { boasVindasDoCaso, type RegistroDasBoasVindas } from '../../../web/src/regras/boasVindas.ts'
import { juntar } from '../../../web/src/regras/checklist.ts'
import { OPCOES_DA_SENIOR, cobrancaDoCaso, type Cobranca } from '../../../web/src/regras/cobranca.ts'
import { emAberto } from '../../../web/src/regras/busca.ts'
import { dataCurta } from '../../../web/src/regras/datas.ts'
import { beneficioDoFechamento, entrevistaRealizada, precisaRegistrarFechamento, recontatoDevido } from '../../../web/src/regras/fechamento.ts'

type DaRecepcao = { passo: string; perfil: string; id: (alvo: string) => string; tela: (alvo: string) => string }
/** Cada tarefa da Recepção: o passo, quem faz, o id que a tela já usa e a tela, pelo caso (ou pela pessoa, no fechamento). */
const DA_RECEPCAO: Record<string, DaRecepcao> = {
  'Cobrar documento': { passo: 'D1.23', perfil: 'atendimento', id: (c) => `cobrar-${c}`, tela: (c) => `/casos/${c}/cobranca` },
  'Decidir cobrança': { passo: 'D1.23', perfil: 'senior', id: (c) => `decidir-cobranca-${c}`, tela: (c) => `/casos/${c}/cobranca/decidir` },
  'Conferir checklist': { passo: 'D1.21', perfil: 'documentacao', id: (c) => `checklist-${c}`, tela: (c) => `/casos/${c}/checklist` },
  'Enviar boas-vindas': { passo: 'D1.22', perfil: 'atendimento', id: (c) => `boas-vindas-${c}`, tela: (c) => `/casos/${c}/checklist` },
  'Reenviar boas-vindas': { passo: 'D1.22', perfil: 'atendimento', id: (c) => `boas-vindas-${c}`, tela: (c) => `/casos/${c}/checklist` },
  'Registrar fechamento': { passo: 'D1.14', perfil: 'atendimento', id: (p) => `fechamento-${p}`, tela: (p) => `/clientes/${p}/fechamento` },
  'Recontatar lead': { passo: 'D1.14', perfil: 'atendimento', id: (p) => `recontato-${p}`, tela: (p) => `/clientes/${p}/recontato` },
  'Confirmar se a entrevista aconteceu': { passo: 'D1.03', perfil: 'atendimento', id: (p) => `confirmar-${p}`, tela: () => '/agenda?ver=lista' },
  'Pedir documento legível': { passo: 'D1.18', perfil: 'atendimento', id: (p) => `legivel-${p}`, tela: (p) => `/clientes/${p}` },
}
const PASSOS = [...new Set(Object.values(DA_RECEPCAO).map((t) => t.passo))]

/** A tarefa da Recepção desta linha (o passo e o título dizem), ou nada. */
export function daRecepcao(l: { passo: string | null; titulo: string }): DaRecepcao | undefined {
  const t = DA_RECEPCAO[l.titulo]
  return t?.passo === l.passo ? t : undefined
}

type Devida = { titulo: string; casoId: string | null; pessoaId: string | null; prazo: string | null; detalhe: string }
const chave = (l: { titulo: string; casoId: string | null; pessoaId: string | null }) => `${l.titulo}|${l.casoId ?? l.pessoaId}`
/** O dia de Brasília de uma data e hora ISO. */
const dia = (iso: string) => hojeEmBrasilia(new Date(iso))
/** "RG pendente", "RG e CPF pendentes", "RG, CPF e mais 2 pendentes": como a tela. */
const pendentes = (faltam: string[]) =>
  `${faltam.length <= 2 ? juntar(faltam) : `${faltam.slice(0, 2).join(', ')} e mais ${faltam.length - 2}`} ${faltam.length === 1 ? 'pendente' : 'pendentes'}`

/** O que deve estar aberto para estas fichas, pelas regras das telas, com o detalhe que a tela mostrava. */
async function devidas(banco: Banco, agora: () => Date, fichas: Ficha[], hoje: string): Promise<Devida[]> {
  const checklists = await criarChecklist(banco, agora).dasFichas(fichas)
  const casos = checklists.map((c) => c.processoId)
  const pessoas = fichas.map((f) => f.id)
  const [cobrancas, registros, leituras, limites] = await Promise.all([
    casos.length ? banco.select({ dados: cobrancaDocumento.dados }).from(cobrancaDocumento).where(inArray(cobrancaDocumento.casoId, casos)) : [],
    pessoas.length ? banco.select({ dados: boasVindas.dados }).from(boasVindas).where(inArray(boasVindas.pessoaId, pessoas)) : [],
    criarFichario(banco, agora).leiturasDe(pessoas.length === 1 ? pessoas[0] : undefined),
    limitesDeCobranca(banco),
  ])
  const lim = { tentativas: limites.limite, diasEntre: limites.intervaloDias }
  const linhas: Devida[] = []
  const doCaso = (titulo: string, casoId: string, prazo: string | null, detalhe: string) => linhas.push({ titulo, casoId, pessoaId: null, prazo, detalhe })

  // D1.23: a cobrança aberta, com o que falta no checklist de agora; sem nada faltando, ela fecha (GGVP-101 CA9).
  for (const { dados } of cobrancas) {
    const c = dados as Cobranca
    const ficha = fichas.find((f) => f.id === c.fichaId)
    const processo = ficha?.processos.find((p) => p.id === c.processoId)
    const ck = checklists.find((x) => x.processoId === c.processoId)
    if (c.encerrada || !ficha || !processo || !ck?.checklist.faltam.length) continue
    const atual = cobrancaDoCaso(c, { ficha, processo, beneficio: ck.beneficio, faltam: ck.checklist.faltam }, hoje, lim)
    const naSenior = atual.situacao === 'na-senior'
    const decisao = c.decisoes.at(-1)
    const detalhe = [
      atual.beneficio,
      pendentes(atual.faltam),
      naSenior ? 'na sênior: decidir (G15)' : `${atual.tentativa}ª tentativa`,
      decisao && !naSenior ? `decisão da sênior: ${OPCOES_DA_SENIOR[decisao.opcao].toLowerCase()}` : '',
      c.prazo ? `prazo do ${c.prazo.de} ${dataCurta(c.prazo.data, hoje)}` : '',
    ]
    // Na Sênior, a cobrança fica à vista do Atendimento sem prazo; a decisão vale desde a última tentativa (G15).
    doCaso('Cobrar documento', c.processoId, naSenior ? null : atual.proxima, detalhe.filter(Boolean).join(' · '))
    if (naSenior) {
      const n = c.tentativas.filter((t) => t.resultado === 'sem-resposta').length
      doCaso('Decidir cobrança', c.processoId, c.tentativas.at(-1)!.dia, `${atual.beneficio} · ${n === 1 ? '1 tentativa' : `${n} tentativas`} sem resposta · limite (G15)`)
    }
  }

  for (const ficha of fichas) {
    const daFicha = checklists.filter((x) => ficha.processos.some((p) => p.id === x.processoId))
    // D1.21: a leitura terminou depois da última conferência do checklist (GGVP-81 CA4); o primeiro caso, como a tela.
    const lidas = leituras.filter((l) => l.fichaId === ficha.id)
    const ultima = lidas.map((l) => l.arquivadoEm ?? '').sort().at(-1)
    const primeiro = daFicha.find((x) => x.processoId === ficha.processos[0]?.id)
    if (primeiro && ultima && !lidas.some((l) => l.situacao === 'a-conferir') && !(primeiro.conferencia && primeiro.conferencia.quando >= ultima)) {
      const recebidos = primeiro.checklist.itens.filter((i) => i.situacao === 'recebido').length
      doCaso('Conferir checklist', primeiro.processoId, dia(ultima), `${primeiro.beneficio} · ${recebidos} de ${primeiro.checklist.itens.length} itens recebidos · leitura arquivada`)
    }

    // D1.18 (GGVP-95 CA3; GGVP-158 P12.4): a leitura ilegível, sem um legível do mesmo tipo depois, pede o reenvio ao cliente.
    // Uma linha por pessoa, com os tipos no detalhe e o prazo na leitura mais antiga; fecha quando o legível chega. O laudo
    // ilegível também abre "Analisar laudo novo" para o Jurídico, até o Lucas decidir.
    const ilegiveis = lidas.filter((l) => ilegivelEmAberto(l, lidas))
    if (ilegiveis.length) {
      const tipos = [...new Set(ilegiveis.map((l) => nomeTipo(l.tipo) || l.tipo))]
      const desde = ilegiveis.map((l) => l.lidoEm).sort()[0]
      linhas.push({ titulo: 'Pedir documento legível', casoId: null, pessoaId: ficha.id, prazo: dia(desde), detalhe: `${juntar(tipos)} · a leitura falhou: pedir o reenvio legível ao cliente` })
    }

    // D1.22: as boas-vindas do cliente novo, depois do checklist conferido (GGVP-97); a que não saiu volta.
    const dela = registros.map((r) => r.dados as RegistroDasBoasVindas).filter((r) => r.fichaId === ficha.id)
    for (const ck of daFicha) {
      const b = boasVindasDoCaso({ ficha, processoId: ck.processoId, beneficio: ck.beneficio, copias: [], faltam: ck.checklist.faltam, conferido: Boolean(ck.conferencia), registros: dela })
      const n = ck.checklist.faltam.length
      if (b.situacao === 'falhou' && b.registro) doCaso('Reenviar boas-vindas', ck.processoId, dia(b.registro.quando), `não saíram pelo Chatwoot: ${b.registro.motivo ?? 'sem motivo'}`)
      if (b.situacao === 'a-enviar' && ck.conferencia)
        doCaso('Enviar boas-vindas', ck.processoId, dia(ck.conferencia.quando), `${ck.beneficio} · checklist conferido · ${n === 0 ? 'sem pendências' : n === 1 ? '1 pendência' : `${n} pendências`}`)
    }

    // D1.14: o fechamento depois da entrevista e o recontato na data (GGVP-60 CA5, CA8, CA9), da pessoa, sem caso.
    const entrevista = entrevistaRealizada(ficha)
    if (precisaRegistrarFechamento(ficha) && entrevista) {
      const detalhe = [
        nomeBeneficio(beneficioDoFechamento(ficha)) || 'benefício a definir',
        `entrevista em ${dataCurta(entrevista.data, hoje)}`,
        ...(ficha.fechamento?.situacao === 'recalcular' ? ['voltou do recontato ao cálculo'] : []),
        ...(ficha.situacao === 'cliente' ? ['nova demanda de quem já é cliente'] : []),
      ]
      linhas.push({ titulo: 'Registrar fechamento', casoId: null, pessoaId: ficha.id, prazo: entrevista.data, detalhe: detalhe.join(' · ') })
    } else if (recontatoDevido(ficha, hoje).devido && ficha.fechamento?.recontatarEm)
      linhas.push({ titulo: 'Recontatar lead', casoId: null, pessoaId: ficha.id, prazo: ficha.fechamento.recontatarEm, detalhe: `motivo: ${nomeMotivo(ficha.fechamento.motivo).toLowerCase()}` })

    // D1.03 (teste do Pedro, 14/10): o compromisso em aberto cujo dia passou; uma linha por pessoa, no mais antigo. Só a tela
    // calculava, e o chat não a via. Marcar realizado, falta ou desistência guarda a ficha, e a linha fecha.
    const [passou] = (ficha.agendamentos ?? []).filter((a) => emAberto(a) && a.data < hoje).sort((a, b) => `${a.data} ${a.hora}`.localeCompare(`${b.data} ${b.hora}`))
    if (passou) {
      const oQue = passou.oQue === 'Entrevista' ? 'fazer entrevista' : passou.oQue.toLowerCase()
      const detalhe = `${oQue} de ${dataCurta(passou.data, hoje)} às ${passou.hora} · marcar realizado ou faltou`
      linhas.push({ titulo: 'Confirmar se a entrevista aconteceu', casoId: null, pessoaId: ficha.id, prazo: passou.data, detalhe })
    }
  }
  return linhas
}

/** Acerta as linhas da Recepção de uma pessoa (a ficha que a rota acabou de guardar) ou de todas (a rodada). */
export async function sincronizarRecepcao(banco: Banco, agora: () => Date, { pessoaId }: { pessoaId?: string } = {}) {
  const fichario = criarFichario(banco, agora)
  const fichas = await fichario.fichas(pessoaId ? [pessoaId] : undefined)
  const faltam = new Map((await devidas(banco, agora, fichas, fichario.hoje())).map((l) => [chave(l), l]))
  const casos = fichas.flatMap((f) => f.processos.map((p) => p.id))
  const abertas = await banco
    .select({ id: tarefa.id, casoId: tarefa.casoId, pessoaId: tarefa.pessoaId, passo: tarefa.passo, titulo: tarefa.titulo, prazo: tarefa.prazo, detalhe: tarefa.detalhe })
    .from(tarefa)
    .where(
      and(
        isNull(tarefa.concluidaEm),
        inArray(tarefa.passo, PASSOS),
        pessoaId ? or(eq(tarefa.pessoaId, pessoaId), casos.length ? inArray(tarefa.casoId, casos) : undefined) : undefined,
      ),
    )
  const fechar: string[] = []
  for (const a of abertas) {
    if (!daRecepcao(a)) continue
    const d = faltam.get(chave(a))
    if (!d) fechar.push(a.id)
    else {
      faltam.delete(chave(a))
      if (a.prazo !== d.prazo || a.detalhe !== d.detalhe) await banco.update(tarefa).set({ prazo: d.prazo, detalhe: d.detalhe }).where(eq(tarefa.id, a.id))
    }
  }
  if (fechar.length) await banco.update(tarefa).set({ situacao: 'concluida', concluidaEm: agora() }).where(inArray(tarefa.id, fechar))
  for (const d of faltam.values()) {
    const t = DA_RECEPCAO[d.titulo]
    await banco
      .insert(tarefa)
      .values({ casoId: d.casoId, pessoaId: d.pessoaId, passo: t.passo, titulo: d.titulo, perfilDono: t.perfil, prazo: d.prazo, detalhe: d.detalhe })
      .onConflictDoNothing()
  }
}
