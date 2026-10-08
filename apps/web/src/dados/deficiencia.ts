// EXEMPLO. Servidor de exemplo da linha do tempo da deficiência (GGVP-42), sobre o mesmo banco de servidor.ts. O CNIS vem
// de cnisDeExemplo (a Cleide tem o indicador PCD e a insalubridade); as provas da época vêm da pasta do cliente (a leitura da
// GGVP-95) e, na semente da Cleide, de uma lista de exemplo. Ligar no servidor: trocar o corpo de cada função por fetch no
// endpoint da design (seção GGVP-42) e ler o CNIS de verdade.
import { isoParaData } from '../campos.ts'
import { hojeIso } from '../regras/datas.ts'
import {
  TIPOS_DE_PROVA,
  cenarios,
  enquadramento,
  motivoParaNaoSalvar,
  periodos,
  tempo,
  type Cenario,
  type DadosDaDeficiencia,
  type Enquadramento,
  type Periodo,
  type Prova,
} from '../regras/deficiencia.ts'
import { tempoFalado } from '../regras/calculo.ts'
import { cnisDoCaso } from './beneficio.ts'
import { nomeBeneficio, nomeTipo } from './catalogos.ts'
import { leiturasDo } from './leitura.ts'
import { agora, esperar, evento, gravar, ler, type Banco } from './servidor.ts'
import type { Cnis, Ficha, Processo } from './tipos.ts'

/** Os dados da deficiência do caso, com quem registrou e quando. */
export type DeficienciaDoCaso = DadosDaDeficiencia & { processoId: string; quem: string; /** Data e hora ISO. */ quando: string }

export type LinhaDoTempo = {
  ficha: Pick<Ficha, 'id' | 'nome'>
  processo: Processo
  beneficio: string
  cnis?: Cnis
  dados?: DeficienciaDoCaso
  periodos: Periodo[]
  enquadramento?: Enquadramento
  /** Os três cenários (leve, moderada e grave), para a entrevista: o grau efetivo sai na perícia. */
  cenarios: Cenario[]
  /** Todas as provas do caso, para a lista embaixo da linha. */
  provas: Prova[]
}

/** As provas da época na semente da Cleide: o período moderado de 2019 fica sem prova, para a tela mostrar o aviso (CA3). */
const PROVAS_DA_SEMENTE: Record<string, Prova[]> = {
  'cleide-exemplo-1': [
    { tipo: 'aso', data: '2013-08-05', descricao: 'ASO admissional · Exemplo Metalúrgica Ltda' },
    { tipo: 'laudo', data: '2015-04-20', descricao: 'Laudo da neurologia (exemplo)' },
    { tipo: 'contratacao-cota', data: '2020-02-03', descricao: 'Contratação por cota · Exemplo Serviços Ltda' },
    { tipo: 'laudo', data: '2022-09-15', descricao: 'Laudo da neurologia (exemplo)' },
  ],
}

/** A deficiência da Cleide: desde 06/2014, leve, moderada desde 03/2019. */
function semente(): DeficienciaDoCaso[] {
  return [
    {
      processoId: 'cleide-exemplo-1',
      inicio: '2014-06-10',
      grau: 'leve',
      agravamentos: [{ data: '2019-03-01', grau: 'moderada' }],
      sexo: 'feminino',
      quem: 'Dra. Paula',
      quando: new Date('2026-09-25T10:00:00').toISOString(),
    },
  ]
}

const deficienciasDo = (banco: Banco) => (banco.deficiencias ??= semente())

function acharCaso(banco: Banco, processoId: string) {
  const ficha = banco.fichas.find((f) => f.processos.some((p) => p.id === processoId))
  const processo = ficha?.processos.find((p) => p.id === processoId)
  return ficha && processo ? { ficha, processo } : null
}

/** As provas do caso: as da pasta (laudo, atestado, ASO...) e as da semente. */
function provasDo(banco: Banco, ficha: Ficha, processoId: string): Prova[] {
  const daPasta = leiturasDo(banco)
    .filter((l) => l.fichaId === ficha.id && TIPOS_DE_PROVA.includes(l.tipo) && (l.situacao === 'a-conferir' || l.situacao === 'arquivado'))
    .map((l) => ({ tipo: l.tipo, data: l.data, descricao: [nomeTipo(l.tipo), l.emitente].filter(Boolean).join(' · ') }))
  return [...(PROVAS_DA_SEMENTE[processoId] ?? []), ...daPasta].sort((a, b) => a.data.localeCompare(b.data))
}

function montar(banco: Banco, ficha: Ficha, processo: Processo): LinhaDoTempo {
  const dados = deficienciasDo(banco).find((d) => d.processoId === processo.id)
  const cnis = cnisDoCaso(ficha.id)
  const provas = provasDo(banco, ficha, processo.id)
  const ps = dados && cnis ? periodos(cnis.vinculos, dados, provas, cnis.extraidoEm) : []
  const e = dados ? enquadramento(ps, dados.sexo) : undefined
  return {
    ficha: { id: ficha.id, nome: ficha.nome },
    processo,
    beneficio: nomeBeneficio(processo.beneficio),
    ...(cnis && { cnis }),
    ...(dados && { dados }),
    periodos: ps,
    ...(e && { enquadramento: e }),
    cenarios: dados ? cenarios(ps, dados.sexo) : [],
    provas,
  }
}

/** GET /api/processos/:id/deficiencia */
export async function obterLinhaDoTempo(processoId: string): Promise<LinhaDoTempo | null> {
  const banco = ler()
  const caso = acharCaso(banco, processoId)
  if (!caso) return null
  const linha = montar(banco, caso.ficha, caso.processo)
  gravar(banco)
  return linha
}

/** PUT /api/processos/:id/deficiencia. Só o Jurídico; valida de novo com a mesma regra da tela (CA2). */
export async function salvarDeficiencia(processoId: string, dados: DadosDaDeficiencia, quem: { perfil?: string; nome: string }): Promise<LinhaDoTempo> {
  await esperar()
  if (quem.perfil !== 'advogada' && !quem.perfil?.startsWith('senior')) throw new Error('Só o Jurídico registra os dados da deficiência.')
  const motivo = motivoParaNaoSalvar(
    {
      inicio: isoParaData(dados.inicio) ?? '',
      grau: dados.grau,
      sexo: dados.sexo,
      agravamentos: dados.agravamentos.map((g) => ({ data: isoParaData(g.data) ?? '', grau: g.grau })),
    },
    hojeIso(agora()),
  )
  if (motivo) throw new Error(motivo)
  const banco = ler()
  const caso = acharCaso(banco, processoId)
  if (!caso) throw new Error('Caso não encontrado')
  const lista = deficienciasDo(banco)
  const registro: DeficienciaDoCaso = { ...dados, processoId, quem: quem.nome, quando: agora().toISOString() }
  const i = lista.findIndex((d) => d.processoId === processoId)
  if (i >= 0) lista[i] = registro
  else lista.push(registro)
  // Dado de saúde fica fora do histórico: só o que aconteceu.
  caso.ficha.historico.push(evento(`Atualizou os dados da deficiência na linha do tempo (${nomeBeneficio(caso.processo.beneficio)})`, quem.nome))
  gravar(banco)
  return montar(banco, caso.ficha, caso.processo)
}

/** O enquadramento numa linha, para qualquer tela (CA4): o parecer da Aposentadoria PCD, a exigência do INSS. */
export function enquadramentoDoCaso(processoId: string): string | undefined {
  const banco = ler()
  const caso = acharCaso(banco, processoId)
  if (!caso) return undefined
  const e = montar(banco, caso.ficha, caso.processo).enquadramento
  gravar(banco)
  return e && textoDoEnquadramento(e)
}

/** "grau moderada · 16 anos, 3 meses e 5 dias convertidos · mínimo de 24 anos · calculado por código (G19)" */
export const textoDoEnquadramento = (e: Enquadramento) =>
  `grau ${e.preponderante} · ${tempoFalado(tempo(e.convertido))} convertidos · mínimo de ${e.minimo} anos · calculado por código (G19)`
