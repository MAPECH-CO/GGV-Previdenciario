// EXEMPLO. Servidor de exemplo dos documentos (GGVP-17), sobre o mesmo banco de servidor.ts. Ligar no servidor:
// trocar o corpo de cada função por fetch no endpoint indicado, sobre o contrato da design.md (change ggvp-6).
import { dataCurta, hojeIso } from '../regras/datas.ts'
import { formatoDoArquivo, localDoTipo, nomeSemSobrescrever, problemaDoArquivo } from '../regras/arquivos.ts'
import { fichasCitadas } from '../regras/busca.ts'
import { pastasDoCliente } from '../regras/pasta.ts'
import { TIPOS_DE_DOCUMENTO, nomeBeneficio, nomeTipo } from './catalogos.ts'
import { loteDeExemplo } from './exemplo.ts'
import { agora, esperar, evento, gravar, ler, type Banco, type ResumoDeLaudo } from './servidor.ts'
import type {
  Arquivo,
  EnvioDeArquivos,
  EventoHistorico,
  Ficha,
  LoteDigitalizado,
  RegistroRecebimento,
  RespostaEnvio,
  Tarefa,
  TarefaEncaminhada,
} from './tipos.ts'

/** Quem aparece no histórico quando o scanner guarda o papel. */
export const SCANNER = 'Automação do scanner'

function tarefaEFicha(banco: Banco, tarefaId: string) {
  const tarefa = banco.tarefas.find((t) => t.id === tarefaId)
  const ficha = tarefa && banco.fichas.find((f) => f.id === tarefa.cliente?.id)
  if (!tarefa || !ficha) throw new Error('Tarefa não encontrada')
  return { tarefa, ficha }
}

const documentos = (n: number) => (n === 1 ? '1 documento' : `${n} documentos`)

/** GET /api/tarefas/:id */
export async function obterTarefa(id: string): Promise<{ tarefa: TarefaEncaminhada; ficha: Ficha } | null> {
  try {
    return tarefaEFicha(ler(), id)
  } catch {
    return null
  }
}

/**
 * POST /api/digitalizacao/lotes. Quem chama é o n8n quando o lote termina; quem decide a pasta é o código da
 * automação, não o portal. Aqui a tela faz o papel do n8n com o lote da semente (CA2, CA4, CA10).
 */
export async function receberLote(tarefaId: string): Promise<LoteDigitalizado> {
  await esperar()
  const banco = ler()
  const { tarefa, ficha } = tarefaEFicha(banco, tarefaId)
  const hoje = hojeIso(agora())
  banco.seq += 1
  const lote = loteDeExemplo(ficha, hoje, `lote-${banco.seq}`)
  tarefa.lote = lote
  // Lote em revisão não mexe no portal: fica em "A REVISAR" até a Documentação arrastar no Drive (CA4).
  if (lote.fichaId === ficha.id) {
    for (const a of lote.arquivos) {
      const local = localDoTipo(a.tipo, tarefa.processoId)
      const nomes = ficha.arquivos.filter((x) => x.local === local).map((x) => x.nome)
      ficha.arquivos.push({ nome: nomeSemSobrescrever(a.nome, nomes), tipo: a.tipo, local, data: hoje, origem: 'scanner', repetido: false, aguardaLeitura: true })
    }
    const aviso = lote.conferirPapel ? ', com o aviso CONFERIR O PAPEL' : ''
    ficha.historico.push(evento(`Guardou ${documentos(lote.arquivos.length)} na pasta do Drive, em PDF pesquisável${aviso}`, SCANNER))
  }
  gravar(banco)
  return lote
}

/** POST /api/tarefas/:id/registro. Só depois de conferir o tipo de cada documento, e o papel quando o lote avisou (CA5, CA10). */
export async function registrarRecebimento(tarefaId: string, registro: RegistroRecebimento): Promise<{ evento: EventoHistorico }> {
  await esperar()
  const banco = ler()
  const { tarefa, ficha } = tarefaEFicha(banco, tarefaId)
  if (tarefa.concluida) throw new Error('Esta tarefa já foi registrada')
  if (registro.conferiTipos !== true) throw new Error('Confira o tipo de cada documento')
  const hoje = hojeIso(agora())
  let texto: string
  if (registro.forma === 'papel') {
    if (!tarefa.lote) throw new Error('O lote do scanner ainda não chegou')
    if (tarefa.lote.conferirPapel && !registro.conferiPapel) throw new Error('Confira o papel antes de devolver o original')
    const revisao = tarefa.lote.status === 'revisao' ? ' (o lote foi para A REVISAR)' : ''
    texto = `Registrou o recebimento de ${documentos(tarefa.lote.arquivos.length)} em papel, pelo scanner${revisao}`
  } else {
    const anexados = ficha.arquivos.filter((a) => a.origem === 'card' && a.data === hoje).length
    if (anexados === 0) throw new Error('Nenhum arquivo anexado ao card')
    texto = `Registrou o recebimento de ${documentos(anexados)} digitais, anexados ao card`
  }
  tarefa.concluida = true
  const registrado = evento(`${texto}; conferiu o tipo de cada documento`)
  ficha.historico.push(registrado)
  gravar(banco)
  return { evento: registrado }
}

/** Fichas que o scanner criou sem telefone: a Central do Atendimento mostra "Completar telefone" (CA15). */
export function tarefasDeCompletarTelefone(): Tarefa[] {
  return ler()
    .fichas.filter((f) => f.origem === 'scanner' && f.telefone === '')
    .map((f) => ({
      id: `telefone-${f.id}`,
      codigo: 'D1.01',
      cliente: { id: f.id, nome: f.nome },
      acao: 'Completar telefone',
      detalhe: 'ficha criada pelo scanner, que não lê telefone',
      href: `/clientes/${f.id}`,
    }))
}

/** A pasta da ficha; sem pasta, a regra do scanner. Pasta nova só nasce com o CPF (CA11). */
function pastaDaFicha(banco: Banco, ficha: Ficha): string | undefined {
  if (ficha.pastaId) return ficha.pastaId
  const achadas = pastasDoCliente(banco.pastas, ficha)
  if (achadas.length > 1 || (achadas.length === 0 && !ficha.cpf)) return undefined
  const pasta = achadas[0] ?? { id: `drive-${ficha.id}`, nome: ficha.nome, caminho: `Clientes/${hojeIso(agora()).slice(0, 4)}`, cpf: ficha.cpf }
  if (!achadas[0]) banco.pastas.push(pasta)
  ficha.pastaId = pasta.id
  ficha.historico.push(evento(`${achadas[0] ? 'Ligou à pasta que já existia' : 'Criou a pasta'} no Drive: ${pasta.caminho}/${pasta.nome}`))
  return pasta.id
}

const valido = (a: EnvioDeArquivos['arquivos'][number]) =>
  !problemaDoArquivo(a) && formatoDoArquivo(a.nome) === a.formato && TIPOS_DE_DOCUMENTO.some((t) => t.id === a.tipo) && /^[0-9a-f]{64}$/.test(a.hash)

/**
 * POST /api/fichas/:id/arquivos ("Conferir e enviar"). Nada é apagado nem sobrescrito; laudo marca "Laudo novo" na
 * ficha e no processo, guarda o resumo da IA para o Jurídico e avisa a advogada (CA6, CA7, CA11, CA13, CA14).
 */
export async function enviarArquivos(fichaId: string, envio: EnvioDeArquivos): Promise<RespostaEnvio> {
  await esperar()
  if (envio.arquivos.length === 0 || envio.arquivos.length > 20 || !envio.arquivos.every(valido)) throw new Error('Arquivos inválidos')
  const banco = ler()
  const ficha = banco.fichas.find((f) => f.id === fichaId)
  if (!ficha) throw new Error('Ficha não encontrada')
  if (!pastaDaFicha(banco, ficha)) return { resultado: 'sem-pasta' }

  const hoje = hojeIso(agora())
  const caso = ficha.processos[0]
  const novos: Arquivo[] = envio.arquivos.map((a) => {
    const local = localDoTipo(a.tipo, caso?.id)
    const nomes = ficha.arquivos.filter((x) => x.local === local).map((x) => x.nome)
    const repetido = ficha.arquivos.some((x) => x.hash === a.hash)
    const arquivo: Arquivo = { nome: nomeSemSobrescrever(a.nome, nomes), tipo: a.tipo, local, data: hoje, origem: envio.origem, repetido, aguardaLeitura: true, hash: a.hash }
    ficha.arquivos.push(arquivo)
    return arquivo
  })
  const pelo = envio.origem === 'chat' ? 'pelo chat' : 'pelo card'
  const laudos = novos.filter((a) => a.tipo === 'laudo' && !a.repetido)
  if (laudos.length > 0) {
    ficha.laudoNovoEm = hoje
    if (caso) caso.laudoNovoEm = hoje
    // ponytail: resumo da IA simulado; o de verdade compara com os laudos do processo (D1.21M).
    for (const l of laudos) banco.resumosDeLaudo.push({ fichaId, processoId: caso?.id, data: hoje, arquivo: l.nome, resumo: `Resumo simulado de ${l.nome}, comparado com o que já está no processo.` })
    banco.seq += 1
    banco.tarefas.push({
      id: `laudo-${banco.seq}`,
      codigo: 'D1.21M',
      cliente: { id: ficha.id, nome: ficha.nome },
      acao: 'Analisar laudo novo',
      detalhe: [caso ? nomeBeneficio(caso.beneficio) : 'sem caso em andamento', `laudo novo de ${dataCurta(hoje, hoje)}`].join(' · '),
      prazo: 'hoje',
      href: caso ? `/processos/${caso.id}` : `/clientes/${ficha.id}`,
      processoId: caso?.id,
      setor: 'Jurídico',
    })
    ficha.historico.push(evento(`Subiu laudo novo ${pelo}; enviado ao Jurídico para análise`))
  }
  const outros = novos.filter((a) => !laudos.includes(a))
  if (outros.length > 0) {
    const repetidos = outros.filter((a) => a.repetido).length
    const tipos = [...new Set(outros.map((a) => nomeTipo(a.tipo)))].join(', ')
    ficha.historico.push(evento(`Anexou ${documentos(outros.length)} ${pelo} (${tipos})${repetidos > 0 ? `; ${repetidos} já estava na pasta` : ''}`))
  }
  gravar(banco)
  return { resultado: 'enviado', arquivos: novos, laudoNovo: laudos.length > 0 }
}

/** GET /api/processos/:id/pasta. O card do processo mostra Documentos pessoais e a subpasta dele (CA14). */
export async function pastaDoProcesso(processoId: string): Promise<{ pessoais: Arquivo[]; processo: Arquivo[] } | null> {
  const ficha = ler().fichas.find((f) => f.processos.some((p) => p.id === processoId))
  if (!ficha) return null
  return { pessoais: ficha.arquivos.filter((a) => a.local === 'pessoais'), processo: ficha.arquivos.filter((a) => a.local === processoId) }
}

/** O chat identifica de quem é o laudo pela mensagem e pelo nome do arquivo (CA8). Ninguém ou mais de um: pergunta. */
export async function identificarCliente(texto: string): Promise<{ id: string; nome: string; beneficio: string }[]> {
  return fichasCitadas(ler().fichas, texto).map((f) => ({ id: f.id, nome: f.nome, beneficio: nomeBeneficio(f.processos[0]?.beneficio) }))
}

/** Só para o Jurídico (GGVP-20): os resumos da IA dos laudos novos da ficha. */
export function resumosParaOJuridico(fichaId: string): ResumoDeLaudo[] {
  return ler().resumosDeLaudo.filter((r) => r.fichaId === fichaId)
}
