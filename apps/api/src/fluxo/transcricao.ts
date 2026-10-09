// Transcrição de verdade (GGVP-133): o áudio guardado vai ao motor de IA (a terceira porta, `transcrever`), parte por
// parte; as falas voltam com quem fala, a senha sai no servidor (G9, CA6) e o motor arruma o texto com o glossário do
// escritório, com o original guardado ao lado (CA5). O texto também vai para a pasta do cliente (CA10). A IA não decide
// nada: o que vai para a ficha continua passando pela conferência da pessoa (G14).
import { EntrevistaLidaPelaIa, TranscricaoArrumadaPelaIa as Arrumada, type ItemDaEntrevista } from '@ggv/contratos'
import { eq } from 'drizzle-orm'
import type { Armazenamento } from '../armazenamento.ts'
import type { Banco } from '../banco/conexao.ts'
import { documento } from '../banco/esquema.ts'
import { lerJson, type FalaTranscrita, type Ia } from '../ia/ia.ts'
import { guardarArquivo, type Arquivo } from '../rotas/formulario.ts'
import { termosDoGlossario } from './glossario.ts'
import { nomeBeneficio } from '../../../web/src/dados/catalogos.ts'
import type { Ficha, Gravacao, InformacaoExtraida, Papel, Trecho } from '../../../web/src/dados/tipos.ts'
import { documentosDaEntrevista, erroDaInformacao, relogio, temSenha, tirarSenhas, valorDaInformacao } from '../../../web/src/regras/entrevista.ts'

export type Dependencias = { banco: Banco; ia: Ia; armazenamento: Armazenamento }

export const MSG_TRANSCRICAO_DESLIGADA = 'a transcrição está desligada (falta a chave do serviço)'
export const MSG_SERVICO_FORA = 'o serviço de transcrição não respondeu'
export const MSG_AUDIO_SUMIU = 'o áudio não foi encontrado na pasta do cliente'
export const MSG_TEXTO_NAO_GUARDADO = 'o texto não foi guardado na pasta do cliente'
/** GGVP-133: o motor recusa áudio e texto com dado de saúde sem `IA_PERMITE_DADO_DE_SAUDE=sim`; a tela diz isso, não "falhou". */
export const MSG_IA_SEM_SAUDE = 'a IA não está autorizada a ler dado de saúde neste ambiente'
export const MSG_IA_DESLIGADA = 'a IA está desligada neste ambiente (falta a chave do serviço)'
export const MSG_IA_SEM_RESPOSTA = 'a IA não respondeu agora'
/** Gravação de verdade sem áudio guardado (sem microfone): não há o que transcrever, e nada é inventado (CA8). */
export const MSG_SEM_AUDIO = 'nenhum áudio desta gravação chegou ao portal: suba o áudio gravado fora ou registre a entrevista sem áudio'

type Quem = Arrumada['falantes'][string]

/** A extensão do áudio, só letras e números, para a chave do armazenamento (o nome da pessoa nunca vira caminho). */
const extensao = (nome: string) => nome.toLowerCase().split('.').at(-1)?.replace(/[^a-z0-9]/g, '').slice(0, 5) || 'audio'

/** CA2, CA10: o áudio de uma gravação vira documento na pasta do cliente. Devolve o id do documento. */
export async function guardarAudio({ banco, armazenamento }: Pick<Dependencias, 'banco' | 'armazenamento'>, g: Gravacao, arquivo: Arquivo, quem: string) {
  const dados = await guardarArquivo(armazenamento, g.fichaId, arquivo, `audio.${extensao(arquivo.nome)}`, 'pessoas')
  const origem = g.origem === 'arquivo' ? 'arquivo' : 'gravacao'
  const [d] = await banco
    .insert(documento)
    .values({ pessoaId: g.fichaId, tipo: 'audio_gravacao', sensivel: g.soJuridico, origem, recebidoPor: quem, ...dados })
    .returning({ id: documento.id })
  return d.id
}

/** CA3 sem a IA: o primeiro a falar é a pessoa do escritório, o segundo é o cliente e os outros são terceiros. */
function pelaOrdem(rotulos: string[]): Record<string, Quem> {
  const papeis: Quem[] = ['escritorio', 'cliente']
  return Object.fromEntries([...new Set(rotulos)].map((r, i) => [r, papeis[i] ?? 'terceiro']))
}

/** O texto que fica na pasta do cliente: o final, com quem fala, e o original ao lado (CA5, CA10). */
function textoDaPasta(g: Gravacao, ficha: Ficha) {
  const linha = (t: Trecho, texto: string) => `[${relogio(t.aos)}] ${t.quem}: ${texto}`
  return [
    `${g.titulo} · ${ficha.nome} · ${g.data}`,
    '',
    ...g.trechos.map((t) => linha(t, t.texto)),
    '',
    'Texto original da transcrição, antes de arrumar com o glossário do escritório:',
    '',
    ...g.trechos.map((t) => linha(t, t.original ?? t.texto)),
  ].join('\n')
}

/**
 * CA1, CA3, CA5, CA6, CA8: transcreve as partes guardadas da gravação, junta na ordem com o tempo corrido, tira a senha
 * (no servidor, antes de gravar e antes de mandar ao motor arrumar) e arruma com o glossário. Falhou: o áudio continua
 * guardado e a gravação fica "falhou", com o motivo, para a pessoa tentar de novo.
 */
export async function transcreverGravacao(deps: Dependencias, g: Gravacao, ficha: Ficha, quem: string | null, papelDoEscritorio: Papel = 'advogada') {
  const { banco, ia, armazenamento } = deps
  const falhou = (motivo: string) => {
    g.transcricao = 'falhou'
    g.motivoDaFalha = motivo
    return g
  }
  const partes = [...(g.audio?.documentos ?? [])].sort((a, b) => a.inicio - b.inicio)
  const falas: (FalaTranscrita & { rotulo: string; aos: number })[] = []
  let fim = 0
  for (const [n, parte] of partes.entries()) {
    const [d] = await banco.select().from(documento).where(eq(documento.id, parte.id))
    const audio = d && (await armazenamento.ler(d.chaveArmazenamento).catch(() => null))
    if (!d || !audio) return falhou(MSG_AUDIO_SUMIU)
    const r = await ia.transcrever({ casoId: null, quem, audio, mime: d.mime, nome: d.nomeOriginal, sensivel: d.sensivel, referencia: `documento:${d.id}` })
    if (!r) return falhou(!ia.ligada ? MSG_TRANSCRICAO_DESLIGADA : d.sensivel && !ia.saudeAutorizada ? MSG_IA_SEM_SAUDE : MSG_SERVICO_FORA)
    // Cada parte é transcrita sozinha: "A" de uma parte não é o "A" da outra.
    for (const f of r.falas) falas.push({ ...f, rotulo: `${n + 1}${f.falante}`, aos: Math.round(parte.inicio + f.inicio) })
    fim = Math.max(fim, Math.round(parte.inicio + r.segundos))
  }
  if (falas.length === 0) return falhou(MSG_SERVICO_FORA)

  // G9 no servidor: a senha sai antes de o texto ir ao motor e antes de gravar.
  const brutos = tirarSenhas(falas.map((f) => ({ aos: f.aos, quem: f.rotulo, papel: 'cliente' as Papel, texto: f.texto })))
  const termos = await termosDoGlossario(banco)
  const conteudo = [
    `Conversa: ${g.titulo}, por ${g.canal}.`,
    `Participantes: ${g.participantes.join(', ')}. O primeiro é a pessoa do escritório.`,
    `Benefício: ${nomeBeneficio(ficha.beneficioInteresse) || 'a definir'}.`,
    'Glossário do escritório:',
    ...termos.map((t) => `- ${t.termo}${t.significado ? ` (${t.significado})` : ''}`),
    'Falas:',
    JSON.stringify(brutos.map((b, i) => ({ i, falante: b.quem, texto: b.texto }))),
  ].join('\n')
  const valida = (texto: string) => {
    const lida = Arrumada.safeParse(lerJson(texto))
    return lida.success && lida.data.falas.length === brutos.length && lida.data.falas.every((f, i) => f.i === i)
  }
  const s = await ia.sugerir('arrumar_transcricao', { casoId: null, quem, conteudo, fontes: [{ tipo: 'documento', referencia: `gravacao:${g.id}` }] }, { validar: valida })
  const arrumada = s ? Arrumada.parse(lerJson(s.texto)) : null
  const falantes = { ...pelaOrdem(brutos.map((b) => b.quem)), ...arrumada?.falantes }
  const nome: Record<Quem, string> = { escritorio: g.participantes[0] ?? 'Escritório', cliente: ficha.nome, terceiro: 'Outra pessoa' }
  const papel: Record<Quem, Papel> = { escritorio: papelDoEscritorio, cliente: 'cliente', terceiro: 'terceiro' }
  const finais = tirarSenhas(brutos.map((b, i) => ({ ...b, texto: arrumada?.falas[i].texto ?? b.texto })))
  g.trechos = finais.map((t, i) => {
    const q = falantes[brutos[i].quem] ?? 'terceiro'
    return { aos: t.aos, quem: nome[q], papel: papel[q], texto: t.texto, original: brutos[i].texto }
  })

  g.alertaDaIa = s?.alerta ?? undefined
  g.extraidas = g.acoes.some((x) => x.acao === 'guardou-senha')
    ? [{ id: 'senha', rotulo: 'Senha do gov.br', valor: 'digitada no cofre: não consta na transcrição (G9)', destino: 'cofre' }]
    : []
  // O resumo, os itens e os documentos são da leitura da IA, depois (a entrevista e a conversa leem cada uma a sua).
  g.duracao = Math.max(g.duracao, fim)
  g.transcricao = 'pronta'
  g.motivoDaFalha = undefined

  // CA10: o texto vai para a pasta do cliente, ao lado do áudio.
  const texto = { conteudo: Buffer.from(textoDaPasta(g, ficha)), mime: 'text/plain', nome: `transcricao-${g.data}.txt` }
  const dados = await guardarArquivo(armazenamento, g.fichaId, texto, 'transcricao.txt', 'pessoas').catch(() => null)
  if (!dados) return falhou(MSG_TEXTO_NAO_GUARDADO)
  const [d] = await banco
    .insert(documento)
    .values({ pessoaId: g.fichaId, tipo: 'transcricao', sensivel: g.soJuridico, origem: 'transcricao', recebidoPor: quem, ...dados })
    .returning({ id: documento.id })
  g.transcricaoDocumentoId = d.id
  return g
}

/** Por que o motor não leu um texto com dado de saúde: a tela diz o motivo certo e segue no modo manual. */
export const motivoSemIa = (ia: Ia) => (!ia.ligada ? MSG_IA_DESLIGADA : !ia.saudeAutorizada ? MSG_IA_SEM_SAUDE : MSG_IA_SEM_RESPOSTA)

const ROTULO_DO_ITEM: Record<ItemDaEntrevista, string> = {
  telefone: 'Telefone',
  estadoCivil: 'Estado civil',
  profissao: 'Profissão',
  contatoApoio: 'Contato de apoio',
  documento: 'Documento citado',
  desde: 'Sem trabalhar desde',
}

/**
 * GGVP-133, GGVP-46 CA6, CA7: a IA lê a entrevista transcrita (já sem a senha, G9, como dado no `<conteudo>`) e sugere o
 * resumo, os dados da ficha, os documentos citados (para o checklist) e o "sem trabalhar desde". O código confere cada
 * item: a hora e o trecho são os da transcrição, nunca os da IA; o valor passa pela biblioteca de campos; o que traz senha
 * não passa. Nada vai para a ficha sem a advogada conferir item a item (G14). Sem a IA, `semIa` diz o motivo e a tela
 * segue no modo manual: sem resumo nem item inventado.
 */
export async function lerEntrevista({ ia }: Pick<Dependencias, 'ia'>, g: Gravacao, ficha: Ficha, quem: string | null) {
  const papel = (t: Trecho) => (t.papel === 'cliente' ? 'cliente' : t.papel === 'terceiro' ? 'outra pessoa' : 'escritório')
  const conteudo = [
    `Entrevista: ${g.titulo}, por ${g.canal}.`,
    `Benefício de interesse: ${nomeBeneficio(ficha.beneficioInteresse) || 'a definir'}.`,
    'Falas:',
    JSON.stringify(g.trechos.map((t, i) => ({ i, quem: papel(t), texto: t.texto }))),
  ].join('\n')
  const valida = (texto: string) => EntrevistaLidaPelaIa.safeParse(lerJson(texto)).success
  const s = await ia.sugerir('ler_entrevista', { casoId: null, quem, conteudo, fontes: [{ tipo: 'documento', referencia: `gravacao:${g.id}` }] }, { validar: valida })
  const cofre = g.extraidas.filter((e) => e.destino === 'cofre')
  if (!s) {
    g.semIa = motivoSemIa(ia)
    g.resumo = undefined
    g.extraidas = cofre
    g.documentos = documentosDaEntrevista(ficha, [])
    return g
  }
  const lida = EntrevistaLidaPelaIa.parse(lerJson(s.texto))
  const itens = lida.itens.flatMap(({ tipo, valor, i }, n): InformacaoExtraida[] => {
    const t = g.trechos[i]
    const campo = tipo === 'documento' || tipo === 'desde' ? undefined : tipo
    if (!t || temSenha(valor) || erroDaInformacao({ campo }, valor)) return []
    const destino = campo ? 'ficha' : tipo === 'documento' ? 'documentacao' : 'processo'
    return [{ id: `${tipo}-${n}`, rotulo: ROTULO_DO_ITEM[tipo], valor: valorDaInformacao({ campo }, valor), destino, ...(campo && { campo }), aos: t.aos, trecho: t.texto }]
  })
  g.extraidas = [...itens, ...cofre]
  g.resumo = temSenha(lida.resumo) ? 'O resumo da IA citava uma senha e foi retirado (G9): leia a transcrição.' : lida.resumo
  g.documentos = documentosDaEntrevista(ficha, g.extraidas)
  g.alertaDaIa ??= s.alerta ?? undefined
  g.semIa = undefined
  return g
}
