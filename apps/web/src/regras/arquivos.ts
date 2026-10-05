// Arquivos que entram na pasta do cliente pelo card ou pelo chat (GGVP-17, CA12, CA13 e CA14).
// A tela usa para avisar; o servidor de exemplo valida de novo com as mesmas funções.
import { semAcento } from './busca.ts'

/** 20 MB por arquivo (CA12). */
export const TAMANHO_MAXIMO = 20 * 1024 * 1024

export type Formato = 'pdf' | 'jpg' | 'png'

/** PDF, JPG ou PNG pela extensão; outro formato, null. Foto entra como foto, sem virar PDF. */
export function formatoDoArquivo(nome: string): Formato | null {
  const extensao = nome.toLowerCase().split('.').pop()
  if (extensao === 'pdf') return 'pdf'
  if (extensao === 'jpg' || extensao === 'jpeg') return 'jpg'
  if (extensao === 'png') return 'png'
  return null
}

/** Por que o arquivo não segue; sem problema, undefined. */
export function problemaDoArquivo(arquivo: { nome: string; tamanho: number }): string | undefined {
  if (!formatoDoArquivo(arquivo.nome)) return 'Só PDF, JPG ou PNG.'
  if (arquivo.tamanho <= 0) return 'O arquivo está vazio.'
  if (arquivo.tamanho > TAMANHO_MAXIMO) return 'Passa de 20 MB.'
  return undefined
}

// A IA que diz o tipo é simulada pelo nome do arquivo; a pessoa confere e troca na janela.
const PISTAS: [RegExp, string][] = [
  [/\blaudo|atestado/, 'laudo'],
  [/receita/, 'receita'],
  [/prontuario/, 'prontuario'],
  [/\brg\b|identidade/, 'rg'],
  [/\bcpf\b/, 'cpf'],
  [/comprovante|residencia|endereco/, 'comprovante-residencia'],
  [/certidao/, 'certidao'],
  [/ctps|carteira de trabalho/, 'ctps'],
  [/cnis/, 'cnis'],
  [/procuracao/, 'procuracao'],
  [/contrato/, 'contrato'],
]

/** "laudo_ortopedia.pdf" → 'laudo'; sem pista, 'outro'. */
export function tipoSugerido(nome: string): string {
  const texto = semAcento(nome.replace(/[_.-]+/g, ' '))
  return PISTAS.find(([pista]) => pista.test(texto))?.[1] ?? 'outro'
}

// ponytail: a divisão entre pessoal e processo é proposta (o cartão não diz); ajusta com a GGVP-81.
const PESSOAIS = new Set(['rg', 'cpf', 'comprovante-residencia', 'certidao', 'ctps', 'cnis'])

/** Documentos pessoais, ou a subpasta do caso em andamento; sem processo, Documentos pessoais (CA14). */
export function localDoTipo(tipo: string, processoId: string | undefined): string {
  return PESSOAIS.has(tipo) || !processoId ? 'pessoais' : processoId
}

/** Nome que já existe no mesmo lugar entra como "(2)", "(3)"…: nada é sobrescrito (CA13). */
export function nomeSemSobrescrever(nome: string, existentes: string[]): string {
  if (!existentes.includes(nome)) return nome
  const ponto = nome.lastIndexOf('.')
  const base = ponto > 0 ? nome.slice(0, ponto) : nome
  const extensao = ponto > 0 ? nome.slice(ponto) : ''
  for (let n = 2; ; n++) {
    const candidato = `${base} (${n})${extensao}`
    if (!existentes.includes(candidato)) return candidato
  }
}

/** SHA-256 do conteúdo, em hexadecimal: o mesmo arquivo enviado duas vezes fica "repetido" (CA13). */
export async function hashDoConteudo(conteudo: ArrayBuffer): Promise<string> {
  const resumo = await crypto.subtle.digest('SHA-256', conteudo)
  return [...new Uint8Array(resumo)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
