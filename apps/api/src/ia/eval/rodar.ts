// GGVP-158 (integrações e IA): a rodada do eval da leitura com a IA de verdade. Só roda com `--de-verdade`, que o
// Mateus libera, e só com os documentos inventados de `documentos.ts`. O banco é o embutido, na memória: nada vai para o
// banco da homologação. A chave é a do ambiente de quem roda, que o portal já usa; o comando não pede nem mostra chave.
// Uso: pnpm --filter @ggv/api eval:leitura -- --de-verdade
import { abrirBancoEmbutido } from '../../banco/conexao.ts'
import { ehMedico } from '../../../../web/src/regras/leitura.ts'
import { criarIa } from '../ia.ts'
import { CASOS } from './documentos.ts'
import { avaliarLeitura, notaEmTexto } from './leitura.ts'

if (!process.argv.includes('--de-verdade')) {
  console.error('A rodada chama a IA de verdade, com os documentos inventados do eval. Só roda com --de-verdade, liberada pelo Mateus.')
  console.error('Uso: pnpm --filter @ggv/api eval:leitura -- --de-verdade')
  process.exit(2)
}

const { banco, fechar } = await abrirBancoEmbutido()
const ia = criarIa({ banco })
if (!ia.ligada) {
  console.error('A IA está desligada neste ambiente (sem a chave): nada a medir.')
  process.exit(2)
}
// As falhas do fornecedor só a IA de mentira simula; o documento médico só vai com a autorização do escritório.
const casos = CASOS.filter((c) => !c.soNoFalso && (ia.saudeAutorizada || !ehMedico(c.anunciado)))
const pulados = CASOS.length - casos.length
const nota = await avaliarLeitura(casos, () => ia)
console.log(notaEmTexto(nota))
if (pulados) console.log(`(${pulados} documento(s) fora desta rodada: falhas do fornecedor${ia.saudeAutorizada ? '' : ' e o documento médico, sem a autorização de dado de saúde'}.)`)
await fechar()
