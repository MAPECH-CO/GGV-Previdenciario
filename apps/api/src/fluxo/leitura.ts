// A leitura da Recepção (GGVP-158 parte 4): a IA lê o conteúdo do documento, pela imagem, e o código confere antes de
// guardar (G19): o CPF e a data pela @ggv/campos, o tipo pelo catálogo. A pessoa confere antes de arquivar. A leitura de
// exemplo, pelo nome do arquivo, só existe com `LEITURA_SIMULADA=sim`, nos testes de tela (P4.10).
import { dataParaIso, normalizarCpf, normalizarTelefone, validarCpf, validarData, validarNome, validarTelefone } from '@ggv/campos'
import { ContratoLidoPelaIa, FichaLidaPelaIa, LidoPelaIa, SegundaFichaLidaPelaIa } from '@ggv/contratos'
import { lerJson, type Ia } from '../ia/ia.ts'
import { TIPOS_DE_DOCUMENTO } from '../../../web/src/dados/catalogos.ts'
import { leituraDaSegundaFicha, leituraDeExemplo } from '../../../web/src/dados/exemplo.ts'
import type { Arquivo, EnvioDaFicha, Ficha, RespostasDaSegundaFicha } from '../../../web/src/dados/tipos.ts'
import type { LeituraDoContrato } from '../../../web/src/regras/contrato.ts'
import { leituraDeExemploDoContrato, type Contrato } from '../../../web/src/regras/contratoDoCaso.ts'
import { ehMedico, lerComIADeExemplo, motivoDaQuarentena, type DadosLidos, type DocumentoLido } from '../../../web/src/regras/leitura.ts'
import { respostasVazias } from '../../../web/src/regras/segundaFicha.ts'

/** O arquivo que chegou ao servidor: o conteúdo e o tipo dele (PDF ou imagem). */
export type Conteudo = { bytes: Uint8Array; mime: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const dataValida = (iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso) && dataParaIso(iso.split('-').reverse().join('/')) === iso
const validarLido = (texto: string) => LidoPelaIa.safeParse(lerJson(texto)).success

/**
 * A leitura do documento do balcão pelo que a IA leu (nulo: a IA não leu). O que não confere fica de fora; sem leitura,
 * o documento fica a conferir com confiança zero, e a pessoa classifica (P4.1). O duplicado é pelo hash, como antes.
 */
export function leituraDoBalcao(ficha: Ficha, arquivo: Arquivo, leituras: DocumentoLido[], lido: LidoPelaIa | null, lidoEm: string): DocumentoLido {
  const tipo = lido && TIPOS_DE_DOCUMENTO.some((t) => t.id === lido.tipo) ? lido.tipo : arquivo.tipo
  const lidos: DadosLidos = {}
  if (lido?.nome && validarNome(lido.nome)) lidos.nome = lido.nome
  if (lido?.cpf && validarCpf(lido.cpf)) lidos.cpf = normalizarCpf(lido.cpf)
  if (lido?.rg) lidos.rg = lido.rg
  if (lido?.endereco) lidos.endereco = lido.endereco
  const original = arquivo.repetido ? ficha.arquivos.find((a) => a !== arquivo && a.hash !== undefined && a.hash === arquivo.hash) : undefined
  const ilegivel = lido !== null && !lido.legivel
  const quarentena = motivoDaQuarentena(lidos, ficha)
  return {
    id: `${ficha.id}/${arquivo.nome}`,
    fichaId: ficha.id,
    arquivo: arquivo.nome,
    origem: arquivo.origem,
    tipo,
    data: lido && dataValida(lido.data) ? lido.data : arquivo.data,
    confianca: lido?.legivel ? Math.round(lido.confianca) : 0,
    lidos,
    duplicadoDe: original && leituras.some((l) => l.id === `${ficha.id}/${original.nome}`) ? `${ficha.id}/${original.nome}` : undefined,
    quarentena,
    situacao: ilegivel ? 'ilegivel' : quarentena ? 'quarentena' : 'a-conferir',
    lidoEm,
    ...(lido?.assinado === false && { semAssinatura: true }),
    ...(lido?.dataEmBranco && { dataEmBranco: true }),
    ...(ehMedico(tipo) && lido?.emitente && { emitente: lido.emitente, ...(lido.registro && { registro: lido.registro }) }),
  }
}

/** Os campos da ficha de atendimento que a IA lê do papel; o que ela não leu volta em `naoLidos`. */
const CAMPOS_DA_FICHA = ['nome', 'cpf', 'nascimento', 'telefone', 'endereco', 'pessoasNaCasa', 'ultimaAtividade', 'semTrabalharDesde', 'pedidosAoInss'] as const

/** A ficha em papel pelo que a IA leu, com as regras do código: o que não confere não entra, e a pessoa preenche (P4.2). */
export function camposDaFicha(lido: FichaLidaPelaIa | null): { campos: Partial<EnvioDaFicha>; naoLidos: (keyof EnvioDaFicha)[] } {
  const campos: Partial<EnvioDaFicha> = {}
  if (lido) {
    if (validarNome(lido.nome)) campos.nome = lido.nome
    if (validarCpf(lido.cpf)) campos.cpf = normalizarCpf(lido.cpf)
    if (validarData(lido.nascimento)) campos.nascimento = lido.nascimento
    if (validarTelefone(lido.telefone)) campos.telefone = normalizarTelefone(lido.telefone)
    if (lido.endereco) campos.endereco = lido.endereco
    const pessoas = Number.parseInt(String(lido.pessoasNaCasa), 10)
    if (pessoas >= 1 && pessoas <= 30) campos.pessoasNaCasa = pessoas
    for (const c of ['ultimaAtividade', 'semTrabalharDesde', 'pedidosAoInss'] as const) if (lido[c]) campos[c] = lido[c]
  }
  return { campos, naoLidos: CAMPOS_DA_FICHA.filter((c) => campos[c] === undefined) }
}

/**
 * O `limpar` das fichas em papel (G9): tira a senha do texto da IA antes de qualquer registro e a entrega só a quem chamou,
 * que a leva ao cofre. O que não é um objeto JSON vira texto vazio: nada do texto cru fica guardado, e a validação falha
 * (GGVP-158 A7), em vez de uma leitura vazia "ok", guardada como pronta, que não deixaria ler a ficha de novo.
 */
const semSenha = (entregar: (senha: string) => void) => (texto: string) => {
  const j = lerJson(texto)
  if (!j || typeof j !== 'object' || Array.isArray(j)) return ''
  const { senha, ...resto } = j as Record<string, unknown>
  if (typeof senha === 'string' && senha.trim()) entregar(senha.trim())
  return JSON.stringify(resto)
}

export const MSG_CONTRATO_SEM_IA = 'A IA não leu o contrato agora: confira à mão.'
/** Sem a leitura da IA, o contrato vai à conferência do Atendimento, com o motivo (P4.4). */
const CONTRATO_SEM_LEITURA: LeituraDoContrato = { reconhecido: false, assinatura: { reconhecida: false, texto: 'não conferida' }, faltam: [], pendencias: [MSG_CONTRATO_SEM_IA] }

type Opcoes = { ia: Ia; simulada?: boolean; agora?: () => Date }

/** Quem lê na Recepção: a IA de verdade, ou a leitura de exemplo dos testes de tela (`simulada`). */
export function criarLeitor({ ia, simulada = false, agora = () => new Date() }: Opcoes) {
  /**
   * O documento do balcão (P4.1). Sem o conteúdo (só o anúncio), a de verdade espera e devolve nulo; a de exemplo lê pelo
   * nome. O documento médico vai como sensível: sem a autorização do escritório, a IA não lê, e a pessoa classifica.
   */
  async function documento(p: { ficha: Ficha; arquivo: Arquivo; leituras: DocumentoLido[]; conteudo?: Conteudo; quem: string | null }): Promise<DocumentoLido | null> {
    const lidoEm = agora().toISOString()
    if (simulada) return lerComIADeExemplo(p.ficha, p.arquivo, p.leituras, lidoEm)
    if (!p.conteudo) return null
    const referencia = `leitura:${p.ficha.id}/${p.arquivo.nome}`
    const s = await ia.sugerir(
      'ler_documento_balcao',
      {
        casoId: UUID.test(p.arquivo.local) ? p.arquivo.local : null,
        quem: p.quem,
        conteudo: `Tipo anunciado: ${p.arquivo.tipo}`,
        fontes: [{ tipo: 'documento', referencia }],
        anexo: { arquivo: p.conteudo.bytes, mime: p.conteudo.mime },
        sensivel: ehMedico(p.arquivo.tipo),
      },
      { validar: validarLido },
    )
    return leituraDoBalcao(p.ficha, p.arquivo, p.leituras, s ? LidoPelaIa.parse(lerJson(s.texto)) : null, lidoEm)
  }

  /** O arquivo como anexo da IA e a fonte do registro, sem dado do cliente. */
  const doPapel = (conteudo: Conteudo, referencia: string) => ({ anexo: { arquivo: conteudo.bytes, mime: conteudo.mime }, fontes: [{ tipo: 'documento' as const, referencia }] })

  /**
   * A ficha de atendimento em papel (P4.2): os campos que a IA leu e conferem, os que ficaram sem leitura e a senha do gov.br
   * escrita, que só vai ao cofre. A de exemplo é a das telas, sem senha.
   */
  async function fichaDeAtendimento(p: { ficha: Ficha; conteudo?: Conteudo; quem: string | null }) {
    if (simulada) {
      const { campos, naoLidos } = leituraDeExemplo(p.ficha)
      return { campos, naoLidos, senha: null }
    }
    let senha: string | null = null
    const s =
      p.conteudo &&
      (await ia.sugerir(
        'ler_ficha_atendimento',
        { casoId: null, quem: p.quem, conteudo: 'A ficha de atendimento em papel, digitalizada.', ...doPapel(p.conteudo, `ficha:${p.ficha.id}`) },
        { validar: (t) => FichaLidaPelaIa.safeParse(lerJson(t)).success, limpar: semSenha((v) => (senha = v)) },
      ))
    return { ...camposDaFicha(s ? FichaLidaPelaIa.parse(lerJson(s.texto)) : null), senha: senha as string | null }
  }

  /** A segunda ficha em papel (P4.2): as respostas que a IA leu, só dos campos da ficha, e a senha do Meu INSS, para o cofre. */
  async function segundaFicha(p: { ficha: Ficha; conteudo?: Conteudo; quem: string | null }): Promise<{ respostas: Partial<RespostasDaSegundaFicha>; senha: string | null }> {
    if (simulada) return { respostas: leituraDaSegundaFicha().respostas, senha: null }
    let senha: string | null = null
    const s =
      p.conteudo &&
      (await ia.sugerir(
        'ler_segunda_ficha',
        { casoId: null, quem: p.quem, conteudo: 'A segunda ficha (auxílio acidente) em papel, digitalizada.', ...doPapel(p.conteudo, `segunda-ficha:${p.ficha.id}`) },
        { validar: (t) => SegundaFichaLidaPelaIa.safeParse(lerJson(t)).success, limpar: semSenha((v) => (senha = v)) },
      ))
    const lidas = s ? SegundaFichaLidaPelaIa.parse(lerJson(s.texto)).respostas : {}
    const campos = Object.keys(respostasVazias())
    return { respostas: Object.fromEntries(Object.entries(lidas).filter(([c, v]) => campos.includes(c) && v !== '')), senha: senha as string | null }
  }

  /**
   * O contrato assinado (P4.4): a IA confere o arquivo contra os documentos do kit e quem assina; a regra que já existe
   * (`precisaConferir`) decide entre a conferência e a cópia. Sem o arquivo ou sem a IA, vai à conferência, com o motivo.
   */
  async function contrato(p: { contrato: Contrato; conteudo?: Conteudo; quem: string | null }): Promise<LeituraDoContrato> {
    if (simulada) return leituraDeExemploDoContrato(p.contrato)
    const kit = p.contrato.kit
    const s =
      p.conteudo &&
      kit &&
      (await ia.sugerir(
        'ler_contrato_assinado',
        {
          casoId: UUID.test(p.contrato.processoId) ? p.contrato.processoId : null,
          quem: p.quem,
          conteudo: [`Kit: ${kit.nome}.`, `Documentos: ${kit.documentos.map((d) => d.nome).join('; ')}.`, `Assinam: ${kit.assinam.join(' e ')}.`].join('\n'),
          ...doPapel(p.conteudo, `contrato:${p.contrato.processoId}`),
        },
        { validar: (t) => ContratoLidoPelaIa.safeParse(lerJson(t)).success },
      ))
    if (!s) return CONTRATO_SEM_LEITURA
    const l = ContratoLidoPelaIa.parse(lerJson(s.texto))
    const texto = l.assinado ? 'a IA achou a assinatura de quem assina' : 'a IA não achou a assinatura de quem assina'
    return { reconhecido: l.reconhecido, assinatura: { reconhecida: l.assinado, texto }, faltam: l.faltam.filter(Boolean), pendencias: l.pendencias.filter(Boolean) }
  }

  return { simulada, documento, fichaDeAtendimento, segundaFicha, contrato }
}
export type Leitor = ReturnType<typeof criarLeitor>
