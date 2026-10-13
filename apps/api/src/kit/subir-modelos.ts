// Sobe os modelos do Word do escritório, de uma pasta da máquina, pela rota da Configuração (GGVP-136, CA1). É para a homologação:
// o texto dos modelos é do escritório e o repositório é público, então nenhum modelo mora aqui. O script entra como a Sênior pelo
// login do portal: o e-mail e a senha vêm de variáveis de ambiente que a pessoa digita na hora, nunca de arquivo, e não saem na
// tela. Cada arquivo vira a versão seguinte do modelo que o nome dele indica; o portal confere o arquivo e recusa o que não serve.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { TIPO_DO_DOCX } from '@ggv/contratos'

type Buscar = typeof fetch
type Entrada = { pasta: string; url: string; email: string; senha: string; buscar?: Buscar; escrever?: (linha: string) => void }

/** O modelo que o arquivo é: o nome sem a extensão, ou `modelo-N` para "modelo-N-qualquer-coisa.docx". */
export function idDoArquivo(arquivo: string, ids: string[]): string | undefined {
  const nome = arquivo.replace(/\.docx$/i, '').toLowerCase()
  return ids.find((id) => nome === id) ?? ids.find((id) => /^modelo-\d+$/.test(id) && nome.startsWith(`${id}-`))
}

/** Sobe cada .docx da pasta para o modelo dele. Devolve quantos subiram e quantos o portal recusou. */
export async function subirModelos({ pasta, url, email, senha, buscar = fetch, escrever = console.log }: Entrada) {
  const base = url.replace(/\/+$/, '')
  const entrada = await buscar(`${base}/api/sessao`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, senha }) })
  if (!entrada.ok) throw new Error(`Não entrou: o portal respondeu ${entrada.status}. Confira o endereço, o e-mail e a senha.`)
  const cookie = entrada.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ')

  const lista = await buscar(`${base}/api/configuracao/modelos`, { headers: { cookie } })
  if (!lista.ok) throw new Error(`Não leu a lista de modelos: o portal respondeu ${lista.status}.`)
  const { modelos, podeSubir } = (await lista.json()) as { modelos: { id: string; nome: string; versao: number | null }[]; podeSubir: boolean }
  if (!podeSubir) throw new Error('Este usuário não é da Sênior: só ela sobe modelos.')
  const ids = modelos.map((m) => m.id)

  let subiram = 0
  let recusados = 0
  const subidos = new Set<string>()
  for (const arquivo of readdirSync(pasta).filter((a) => /\.docx$/i.test(a)).sort()) {
    const id = idDoArquivo(arquivo, ids)
    if (!id) {
      escrever(`sem modelo para um arquivo da pasta (nome não bate com nenhum dos ${ids.length} modelos): pulado`)
      continue
    }
    const corpo = new FormData()
    corpo.append('arquivo', new Blob([new Uint8Array(readFileSync(join(pasta, arquivo)))], { type: TIPO_DO_DOCX }), 'modelo.docx')
    const resposta = await buscar(`${base}/api/configuracao/modelos/${id}`, { method: 'PUT', headers: { cookie }, body: corpo })
    const dados = (await resposta.json().catch(() => ({}))) as { versao?: number; erro?: string }
    if (resposta.ok) {
      subiram++
      subidos.add(id)
      escrever(`${id}: versão ${dados.versao} no ar`)
    } else {
      recusados++
      escrever(`${id}: o portal recusou (${resposta.status}): ${dados.erro ?? 'sem mensagem'}`)
    }
  }
  const faltam = ids.filter((id) => !subidos.has(id))
  escrever(`${subiram} subiram, ${recusados} recusados.${faltam.length ? ` Sem arquivo nesta rodada: ${faltam.join(', ')}.` : ''}`)
  return { subiram, recusados }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [pasta] = process.argv.slice(2)
  const { PORTAL_URL, SENIOR_EMAIL, SENIOR_SENHA } = process.env
  if (!pasta || !PORTAL_URL || !SENIOR_EMAIL || !SENIOR_SENHA) {
    console.error('Uso: defina PORTAL_URL, SENIOR_EMAIL e SENIOR_SENHA no terminal e passe a pasta dos .docx: modelos:subir <pasta>. Veja docs/guias/kit-de-verdade.md.')
    process.exit(2)
  }
  subirModelos({ pasta, url: PORTAL_URL, email: SENIOR_EMAIL, senha: SENIOR_SENHA })
    .then(({ recusados }) => process.exit(recusados ? 1 : 0))
    .catch((e: Error) => {
      console.error(e.message)
      process.exit(1)
    })
}
