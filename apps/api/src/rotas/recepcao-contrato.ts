// O contrato do caso no servidor (GGVP-125, bloco 4a), sobre o fichário da Recepção. O "fechou" cria o caso em `caso` (o
// elo com o resto do portal) e o contrato com o kit; as condições do kit e a geração pelo modelo seguem as regras do
// servidor de exemplo do Pedro (contrato.ts), com as regras puras importadas das telas. ZapSign e IA seguem simulados.
import { eq } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { CondicoesDoKit, EnvioDoContrato, FechamentoDoCaso, type Erro } from '@ggv/contratos'
import type { Banco } from '../banco/conexao.ts'
import { caso, contratoRecepcao, pessoa } from '../banco/esquema.ts'
import { exigir } from '../sessao/rotas.ts'
import { BENEFICIOS, nomeBeneficio } from '../../../web/src/dados/catalogos.ts'
import type { Ficha, Processo } from '../../../web/src/dados/tipos.ts'
import {
  CONFERENCIAS,
  SEM_CONDICOES,
  erroDoCampo,
  faltando,
  identificadorDoModelo,
  linhaDoBeneficio,
  modeloPorId,
  montarKit,
  normalizarCampo,
  restosDoModelo,
  ROTULOS_DOS_CAMPOS,
  type CampoDoModelo,
  type DadosDoContrato,
} from '../../../web/src/regras/contrato.ts'
import {
  CLIENTE_DO_EXEMPLO_DOS_MODELOS,
  ROTULOS_DAS_CONDICOES,
  camposDoCaso,
  daFicha,
  juntar,
  textosDoKit,
  type Contrato,
} from '../../../web/src/regras/contratoDoCaso.ts'
import { fichaComCpf } from '../../../web/src/regras/duplicidade.ts'
import { MSG_FICHA_NAO_ENCONTRADA, NO_SERVIDOR, UUID, criarFichario, type ContratoGuardado } from './recepcao.ts'

export const MSG_CONTRATO_NAO_ENCONTRADO = 'Contrato não encontrado.'
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)

type Opcoes = { banco: Banco; agora?: () => Date }

export function registrarRotasRecepcaoContrato(app: FastifyInstance, { banco, agora = () => new Date() }: Opcoes) {
  const { hoje, evento, nomeDe, fichas, guardar } = criarFichario(banco, agora)
  const editar = { preHandler: exigir(banco, 'ficha.editar', agora) }

  const fichaPeloId = async (id: string) => (UUID.test(id) ? (await fichas([id]))[0] : undefined)

  const guardarContrato = (pessoaId: string, g: ContratoGuardado) =>
    banco
      .insert(contratoRecepcao)
      .values({ casoId: g.contrato.processoId, pessoaId, dados: g })
      .onConflictDoUpdate({ target: contratoRecepcao.casoId, set: { dados: g, atualizadoEm: agora() } })

  /** O contrato do caso, a ficha e o processo, como as telas os leem. */
  async function acharContrato(processoId: string): Promise<{ ficha: Ficha; processo: Processo; contrato: Contrato } | null> {
    if (!UUID.test(processoId)) return null
    const [linha] = await banco.select().from(contratoRecepcao).where(eq(contratoRecepcao.casoId, processoId))
    if (!linha) return null
    const g = linha.dados as ContratoGuardado
    const [ficha] = await fichas([linha.pessoaId])
    return ficha ? { ficha, processo: g.processo, contrato: g.contrato } : null
  }

  const quem = (pedido: FastifyRequest) => nomeDe(pedido)

  // GGVP-65 CA1, CA9: o cliente fechou. O caso nasce no banco do portal (fase atendimento), com o contrato e o kit do
  // benefício; o lead vira cliente na ficha e na pessoa; o Atendimento recebe "Preparar contrato". Quem já é cliente e
  // fecha outro benefício ganha caso e kit novos. Chamado pelo fechamento e pela nova demanda.
  app.post<{ Params: { id: string } }>('/api/fichas/:id/processos', editar, async (pedido, resposta) => {
    const entrada = FechamentoDoCaso.safeParse(pedido.body)
    const beneficio = entrada.success ? entrada.data.beneficio : ''
    if (beneficio === 'nao-sei' || !BENEFICIOS.some((b) => b.id === beneficio)) return negar(resposta, 400, 'Benefício fora do catálogo.')
    const ficha = await fichaPeloId(pedido.params.id)
    if (!ficha) return negar(resposta, 404, MSG_FICHA_NAO_ENCONTRADA)
    const dia = hoje()
    if (ficha.situacao === 'lead') {
      ficha.situacao = 'cliente'
      ficha.desde = `${dia.slice(5, 7)}/${dia.slice(0, 4)}`
    }
    const [novo] = await banco.insert(caso).values({ pessoaId: ficha.id, beneficio: NO_SERVIDOR[beneficio] ?? null, fase: 'atendimento' }).returning()
    await banco.update(pessoa).set({ situacao: 'cliente', motivoNaoVirou: null, atualizadoEm: agora() }).where(eq(pessoa.id, ficha.id))
    // "Tem representante legal" do cadastro do lead (GGVP-43) já marca o LOAS representado; a pessoa confere no preparo.
    const condicoes = { ...SEM_CONDICOES, representado: Boolean(ficha.representante?.nome) }
    const kit = montarKit(beneficio, condicoes)
    const contrato: Contrato = { processoId: novo.id, fichaId: ficha.id, etapa: 'preparar', condicoes, kit, abertoEm: agora().toISOString() }
    const processo: Processo = { id: novo.id, beneficio, etapa: 'Contrato · preparar', proximaAcao: 'preparar o contrato', prazo: 'hoje' }
    await guardarContrato(ficha.id, { contrato, processo })
    ficha.historico.push(
      evento(
        kit
          ? `Fechou ${nomeBeneficio(beneficio)}: processo novo com o kit ${kit.nome} (${kit.documentos.length} documentos, ${modeloPorId(kit.modelo).nome})`
          : `Fechou ${nomeBeneficio(beneficio)}: processo novo, sem kit cadastrado para o benefício`,
        await quem(pedido),
      ),
    )
    await guardar(ficha)
    const [atual] = await fichas([ficha.id])
    return { ficha: atual, processo, contrato }
  })

  // GGVP-65 CA2, CA8: as condições do LOAS montam o kit de novo, só antes de gerar o contrato.
  app.put<{ Params: { id: string } }>('/api/processos/:id/contrato/condicoes', editar, async (pedido, resposta) => {
    const entrada = CondicoesDoKit.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, 'Condições inválidas.')
    const achado = await acharContrato(pedido.params.id)
    if (!achado) return negar(resposta, 404, MSG_CONTRATO_NAO_ENCONTRADO)
    const { ficha, processo, contrato } = achado
    if (contrato.etapa !== 'preparar') return negar(resposta, 400, 'O kit só muda antes de gerar o contrato.')
    const condicoes = entrada.data
    contrato.condicoes = { ...condicoes }
    contrato.kit = montarKit(processo.beneficio, condicoes)
    const marcadas = (Object.keys(ROTULOS_DAS_CONDICOES) as (keyof typeof condicoes)[]).filter((k) => condicoes[k]).map((k) => ROTULOS_DAS_CONDICOES[k])
    ficha.historico.push(evento(`Condições do kit de ${nomeBeneficio(processo.beneficio)}: ${marcadas.length ? marcadas.join(', ') : 'nenhuma'}`, await quem(pedido)))
    await guardarContrato(ficha.id, { contrato, processo })
    await guardar(ficha)
    return { contrato, ficha }
  })

  // GGVP-69: valida de novo a decisão, o que corrigir e as conferências (CA6). Com "Não, corrigir campos", grava a correção
  // (na ficha os dados pessoais; no contrato o RG, a parte contrária e o representante), registra no histórico (CA7) e
  // gera de novo (CA3). Campo obrigatório vazio não segue (CA7); sobra do modelo também não (CA8). Gerado, vai assinar.
  app.post<{ Params: { id: string } }>('/api/processos/:id/contrato/gerar', editar, async (pedido, resposta) => {
    const entrada = EnvioDoContrato.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, 'Envio inválido.')
    const envio = entrada.data
    const oQueCorrigir = envio.oQueCorrigir ?? ''
    if (CONFERENCIAS.some((c) => envio.conferencias[c.id] !== true)) return negar(resposta, 400, 'Faltam conferências.')
    if (!envio.aprovados && (oQueCorrigir.length < 3 || oQueCorrigir.length > 500)) return negar(resposta, 400, 'Escreva o que corrigir.')
    const correcoes = (envio.aprovados ? {} : envio.correcoes) as Partial<Record<CampoDoModelo, string>>
    for (const [campo, valor] of Object.entries(correcoes) as [CampoDoModelo, string][])
      if (!(campo in ROTULOS_DOS_CAMPOS) || campo === 'beneficio' || erroDoCampo(campo, valor)) return negar(resposta, 400, 'Correção inválida.')
    const achado = await acharContrato(pedido.params.id)
    if (!achado) return negar(resposta, 404, MSG_CONTRATO_NAO_ENCONTRADO)
    const { ficha, processo, contrato } = achado
    if (contrato.etapa !== 'preparar' || !contrato.kit) return negar(resposta, 400, 'Este contrato não está para preparar.')

    const mudou: CampoDoModelo[] = []
    const dados: DadosDoContrato = { ...contrato.dados }
    for (const [campo, bruto] of Object.entries(correcoes) as [CampoDoModelo, string][]) {
      const valor = normalizarCampo(campo, bruto)
      if (daFicha(campo)) {
        if ((ficha[campo] ?? '') !== valor) {
          ficha[campo] = valor
          mudou.push(campo)
        }
      } else if (campo !== 'parteContraria' || linhaDoBeneficio(processo.beneficio)?.acaoContra) {
        const chave = campo as keyof DadosDoContrato
        if ((dados[chave] ?? '') !== valor) {
          dados[chave] = valor
          mudou.push(campo)
        }
      }
    }
    const dono = fichaComCpf((await fichas()).filter((f) => f.id !== ficha.id), ficha.cpf)
    if (dono) return { resultado: 'cpf-de-outra-ficha', nome: dono.nome }
    contrato.dados = dados
    contrato.corrigidos = [...new Set([...(contrato.corrigidos ?? []), ...mudou])]

    const campos = camposDoCaso({ ficha, processo, contrato })
    const faltam = faltando(campos)
    if (faltam.length > 0) return { resultado: 'faltam', campos: faltam }
    const textos = textosDoKit(contrato.kit, campos)
    const restos = [...new Set(textos.flatMap((t) => restosDoModelo(t.texto, CLIENTE_DO_EXEMPLO_DOS_MODELOS)))]
    if (restos.length > 0) return { resultado: 'sobrou-do-exemplo', restos }

    const geradoEm = agora().toISOString()
    const versao = (contrato.documento?.versao ?? 0) + 1
    const modelo = modeloPorId(contrato.kit.modelo)
    const motivo = envio.aprovados ? `gerado pelo ${modelo.nome}` : `corrigido: ${oQueCorrigir}`
    contrato.documento = { versao, geradoEm, campos, textos }
    contrato.versoes = [...(contrato.versoes ?? []), { versao, geradoEm, motivo }]
    contrato.etapa = 'assinatura'
    const seguinte: Processo = { ...processo, etapa: 'Contrato · assinatura', proximaAcao: 'colher a assinatura' }
    const nome = await quem(pedido)
    if (mudou.length > 0) ficha.historico.push(evento(`Corrigiu no contrato: ${juntar(mudou.map((c) => ROTULOS_DOS_CAMPOS[c]))} (${oQueCorrigir})`, nome))
    ficha.historico.push(
      evento(
        `Gerou o contrato de ${nomeBeneficio(processo.beneficio)} pelo modelo ${identificadorDoModelo(modelo)} (versão ${versao}): conferiu os campos, ` +
          'as datas à mão, a ficha LOAS e a página do Código Penal',
        nome,
      ),
    )
    await guardarContrato(ficha.id, { contrato, processo: seguinte })
    await guardar(ficha)
    return { resultado: 'gerado', contrato, ficha: (await fichas([ficha.id]))[0] }
  })
}
