// EXEMPLO. Servidor de exemplo da ficha de atendimento (GGVP-24), sobre o mesmo banco de servidor.ts. A leitura da ficha
// em papel (scanner e IA) e a ferramenta que confere o telefone são serviços de fora, simulados. Ligar no servidor: trocar
// o corpo de cada função por fetch no endpoint indicado, sobre o contrato da design.md (change ggvp-6).
import { dataParaIso, isoParaData, normalizarData, validarTelefone } from '../campos.ts'
import { nomeSemSobrescrever } from '../regras/arquivos.ts'
import { confirmada } from '../regras/confirmacao.ts'
import { emAberto } from '../regras/busca.ts'
import { hojeIso } from '../regras/datas.ts'
import { fichaComCpf } from '../regras/duplicidade.ts'
import { ROTULOS_DA_FICHA, camposEmBranco, envioValido, type CampoDaFicha } from '../regras/fichaAtendimento.ts'
import { BENEFICIOS } from './catalogos.ts'
import { registrarNoCofre } from './cofre.ts'
import { abrirPreparacao } from './confirmacao.ts'
import { leituraDeExemplo } from './exemplo.ts'
import { agora, esperar, evento, gravar, ler } from './servidor.ts'
import type { Arquivo, EnvioDaFicha, Ficha, LeituraDaFicha } from './tipos.ts'

/** Quem preenche no tablet é o próprio cliente. */
export const CLIENTE_NO_TABLET = 'Cliente (tablet)'

/**
 * POST /api/fichas/:id/ficha-de-atendimento/leitura (o aviso do n8n). A imagem vai para Documentos pessoais e a IA
 * preenche os campos para o Atendimento conferir (CA14); a senha escrita no papel vai para o cofre, para conferir (CA15).
 */
export async function lerFichaEmPapel(fichaId: string): Promise<LeituraDaFicha> {
  await esperar()
  const banco = ler()
  const ficha = banco.fichas.find((f) => f.id === fichaId)
  if (!ficha) throw new Error('Ficha não encontrada')
  const hoje = hojeIso(agora())
  const modelo = 'GGV'
  const arquivo: Arquivo = {
    nome: nomeSemSobrescrever(
      `Ficha de atendimento ${modelo} - ${ficha.nome} - ${hoje}.pdf`,
      ficha.arquivos.filter((a) => a.local === 'pessoais').map((a) => a.nome),
    ),
    tipo: 'ficha-atendimento',
    local: 'pessoais',
    data: hoje,
    origem: 'scanner',
    repetido: false,
    aguardaLeitura: false,
  }
  ficha.arquivos.push(arquivo)
  const { campos, naoLidos, senhaLida } = leituraDeExemplo(ficha)
  if (senhaLida) {
    ficha.senhaGov = { situacao: 'no-cofre', conferir: true, atualizadaEm: agora().toISOString(), por: 'Leitura da ficha em papel (IA)' }
    registrarNoCofre(banco, ficha.id, 'leu-do-papel', 'Leitura da ficha em papel (IA)')
  }
  ficha.historico.push(
    evento(
      `A ficha de atendimento em papel (${modelo}) passou no scanner e a IA leu os campos; a imagem ficou em Documentos pessoais${senhaLida ? ' e a senha escrita foi para o cofre, para conferir' : ''}`,
    ),
  )
  gravar(banco)
  return { modelo, arquivo, campos, naoLidos, senhaLida }
}

/** Os valores da ficha que o histórico compara (CA10), pelo campo da tela. */
function valoresAtuais(f: Ficha): Record<CampoDaFicha, string> {
  return {
    nome: f.nome,
    cpf: f.cpf ?? '',
    nascimento: f.nascimento ?? '',
    telefone: f.telefone,
    endereco: f.endereco ?? '',
    pessoasNaCasa: f.fichaAtendimento?.pessoasNaCasa?.toString() ?? '',
    beneficioInteresse: f.beneficioInteresse ?? '',
    ultimaAtividade: f.fichaAtendimento?.ultimaAtividade ?? '',
    semTrabalharDesde: f.fichaAtendimento?.semTrabalharDesde ?? '',
    pedidosAoInss: f.fichaAtendimento?.pedidosAoInss ?? '',
  }
}

function juntar(itens: string[]): string {
  return itens.length <= 1 ? itens.join('') : `${itens.slice(0, -1).join(', ')} e ${itens.at(-1)}`
}

/**
 * PUT /api/fichas/:id/ficha-de-atendimento. Valida de novo (CA5, CA12); CPF de outra ficha não grava; os dados pessoais
 * vão para a ficha única e a triagem para `fichaAtendimento`, com o que ficou em branco (CA6). Toda alteração entra no
 * histórico com quem e o quê (CA10). Conclui a pendência "Preencher ficha" e, com a entrevista confirmada, abre o
 * "Preparar entrevista" do Jurídico (GGVP-21, CA3).
 */
export async function salvarFichaDeAtendimento(
  fichaId: string,
  envio: EnvioDaFicha,
): Promise<{ ficha: Ficha } | { erro: 'cpf-de-outra-ficha'; nome: string }> {
  await esperar()
  const hoje = hojeIso(agora())
  if (!envioValido(envio, hoje) || !BENEFICIOS.some((b) => b.id === envio.beneficioInteresse)) throw new Error('Ficha de atendimento inválida')
  const banco = ler()
  const ficha = banco.fichas.find((f) => f.id === fichaId)
  if (!ficha) throw new Error('Ficha não encontrada')
  const dono = fichaComCpf(banco.fichas, envio.cpf)
  if (dono && dono.id !== fichaId) return { erro: 'cpf-de-outra-ficha', nome: dono.nome }

  const antes = valoresAtuais(ficha)
  const primeira = ficha.fichaAtendimento === undefined
  Object.assign(ficha, {
    nome: envio.nome,
    cpf: envio.cpf,
    nascimento: dataParaIso(normalizarData(envio.nascimento)) ?? undefined,
    telefone: envio.telefone,
    endereco: envio.endereco,
    beneficioInteresse: envio.beneficioInteresse,
    fichaAtendimentoPreenchida: true,
  })
  const triagem = {
    endereco: envio.endereco ?? '',
    pessoasNaCasa: envio.pessoasNaCasa?.toString() ?? '',
    ultimaAtividade: envio.ultimaAtividade ?? '',
    semTrabalharDesde: envio.semTrabalharDesde ?? '',
    pedidosAoInss: envio.pedidosAoInss ?? '',
  }
  ficha.fichaAtendimento = {
    // A data da ficha é a do dia em que foi preenchida e não muda depois (CA12).
    data: ficha.fichaAtendimento?.data ?? hoje,
    origem: envio.origem,
    modelo: envio.modelo,
    pessoasNaCasa: envio.pessoasNaCasa,
    ultimaAtividade: envio.ultimaAtividade,
    semTrabalharDesde: envio.semTrabalharDesde,
    pedidosAoInss: envio.pedidosAoInss,
    emBranco: camposEmBranco(triagem),
  }

  const quem = envio.origem === 'tablet' ? CLIENTE_NO_TABLET : undefined
  if (primeira) {
    const de = envio.origem === 'tablet' ? 'tablet' : `papel ${envio.modelo ?? 'GGV'}, conferida`
    const branco = ficha.fichaAtendimento.emBranco
    ficha.historico.push(evento(`Salvou a ficha de atendimento (${de})${branco.length ? `; em branco: ${juntar(branco)}` : ''}`, quem))
  } else {
    const depois = valoresAtuais(ficha)
    const mudou = (Object.keys(antes) as CampoDaFicha[]).filter((c) => antes[c] !== depois[c])
    if (mudou.length > 0) ficha.historico.push(evento(`Alterou na ficha de atendimento: ${juntar(mudou.map((c) => ROTULOS_DA_FICHA[c]))}`, quem))
  }

  for (const t of banco.tarefas) if (t.cliente?.id === ficha.id && t.acao === 'Preencher ficha') t.concluida = true
  const entrevista = ficha.agendamentos.find((a) => a.oQue === 'Entrevista' && emAberto(a) && a.data >= hoje && confirmada(a.confirmacao))
  if (entrevista) abrirPreparacao(banco, ficha, entrevista)
  gravar(banco)
  return { ficha }
}

/** GET /api/telefones/:numero/conferencia. A ferramenta gratuita de validação, simulada sobre a regra da biblioteca (CA12). */
export async function conferirTelefone(numero: string): Promise<{ valido: boolean; tipo?: 'celular' | 'fixo' }> {
  if (!validarTelefone(numero)) return { valido: false }
  const digitos = numero.replace(/\D/g, '')
  return { valido: true, tipo: digitos.length === 11 && digitos[2] === '9' ? 'celular' : 'fixo' }
}

/** Para a tela: a data da ficha em dd/mm/aaaa, a de hoje enquanto ela não foi salva (CA12). */
export const dataDaFicha = (ficha: Ficha) => isoParaData(ficha.fichaAtendimento?.data ?? hojeIso(agora())) ?? ''
