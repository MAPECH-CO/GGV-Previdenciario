// O importador do portal antigo (16/10, pedido do Mateus), no terminal, em quatro passos que podem rodar separados:
//   pnpm --filter @ggv/api legado:importar extrair <legado.json>          lê o banco antigo (LEGADO_DATABASE_URL)
//   pnpm --filter @ggv/api legado:importar transformar <legado.json> <carga.json>   aplica as regras e mostra o relatório
//   pnpm --filter @ggv/api legado:importar sql <carga.json> <carga.sql>   gera o arquivo para aplicar no banco à mão
//   pnpm --filter @ggv/api legado:importar carregar <carga.json>          limpa e grava no DATABASE_URL (pede CONFIRMO_ZERAR_O_PORTAL=sim)
//   pnpm --filter @ggv/api legado:importar ligar-acervo                   depois do Raio-X: liga o acervo aos casos pelo CNJ
// Os arquivos .json e .sql têm dado pessoal: ficam fora do repositório e somem depois da carga. O relatório só tem números.
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { abrirBanco } from '../conexao.ts'
import { arquivoSql, carregar, ligarAcervo, tabelasParaLimpar } from './carregar.ts'
import { extrair } from './extrair.ts'
import { transformar, type Carga, type Relatorio } from './transformar.ts'

const USO = 'Uso: legado:importar extrair <legado.json> | transformar <legado.json> <carga.json> | sql <carga.json> <carga.sql> | carregar <carga.json> | ligar-acervo'

/** O relatório em linhas, para o terminal e para a documentação: só números, nenhum dado de pessoa. */
export function relatorioEmTexto(r: Relatorio): string {
  const mapa = (m: Record<string, number>) =>
    Object.entries(m)
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `    ${k}: ${n}`)
      .join('\n')
  return [
    'Clientes',
    `  lidos: backup ${r.clientes.lidos.backup}, juridico ${r.clientes.lidos.juridico}; ligados pelo CPF ${r.clientes.ligados.porCpf}, pelo nome ${r.clientes.ligados.porNome}`,
    `  aceitos: juridico ${r.clientes.aceitos.juridico} (${r.clientes.aceitos.divergentesDoBackup} com o backup dizendo outra coisa), só no backup ${r.clientes.aceitos.soBackup}; unidos pelo CPF ${r.clientes.unidosPorCpf}`,
    `  gravados: ${r.clientes.gravados} (${r.clientes.semProcesso} sem processo)`,
    `  campos: ${Object.entries(r.clientes.campos)
      .map(([k, n]) => `${k} ${n}`)
      .join(', ')}`,
    '  fora, por status:',
    mapa(r.clientes.foraPorStatus),
    'Processos',
    `  lidos ${r.processos.lidos}; de aceitos ${r.processos.deAceitos}; gravados ${r.processos.gravados}; fora (de não aceitos) ${r.processos.foraDeNaoAceitos}; cíveis ${r.processos.civeis}`,
    `  fase: ${Object.entries(r.processos.porFase)
      .map(([k, n]) => `${k} ${n}`)
      .join(', ')}; deduzida (sem status geral) ${r.processos.faseDeduzida}`,
    `  números: ${Object.entries(r.processos.numeros)
      .map(([k, n]) => `${k} ${n}`)
      .join(', ')}`,
    `  por benefício (sem benefício: ${r.processos.semBeneficio}):`,
    mapa(r.processos.porBeneficio),
    '  benefício que o catálogo não tem (entrou como "outro"):',
    mapa(r.processos.beneficioDesconhecido),
    '  por status antigo:',
    mapa(r.processos.porStatusAntigo),
    `Decisões do INSS: deferido ${r.resultadosInss.deferido}, indeferido ${r.resultadosInss.indeferido}, sem data (ficaram fora) ${r.resultadosInss.semData}`,
    `Perícias: médica ${r.pericias.medica}, social ${r.pericias.social}, com resultado ${r.pericias.comResultado}, sem hora ${r.pericias.semHora}, sem processo (ficaram fora) ${r.pericias.semProcesso}, canceladas (só no histórico) ${r.pericias.canceladas}`,
    `Histórico: ${r.eventos.gravados} eventos`,
    mapa(r.eventos.porAcao),
  ].join('\n')
}

async function lerJson<T>(caminho: string): Promise<T> {
  return JSON.parse(await readFile(caminho, 'utf8')) as T
}

export async function principal(argumentos: string[], ambiente: Record<string, string | undefined> = process.env): Promise<string> {
  const [comando, a, b] = argumentos
  if (comando === 'extrair' && a) {
    if (!ambiente.LEGADO_DATABASE_URL) throw new Error('Sem LEGADO_DATABASE_URL: a URL do banco do portal antigo, só leitura.')
    const legado = await extrair(ambiente.LEGADO_DATABASE_URL)
    await writeFile(a, JSON.stringify(legado))
    return `Legado lido: ${Object.entries(legado)
      .map(([k, v]) => `${k} ${(v as unknown[]).length}`)
      .join(', ')}. Gravado em ${a} (dado pessoal: fora do repositório).`
  }
  if (comando === 'transformar' && a && b) {
    const carga = transformar(await lerJson(a))
    await writeFile(b, JSON.stringify(carga))
    return `${relatorioEmTexto(carga.relatorio)}\nCarga gravada em ${b}.`
  }
  if (comando === 'sql' && a && b) {
    const carga = await lerJson<Carga>(a)
    const { banco, fechar } = await abrirBanco(ambiente.DATABASE_URL)
    try {
      await writeFile(b, arquivoSql(carga, await tabelasParaLimpar(banco)))
    } finally {
      await fechar()
    }
    return `SQL gravado em ${b}: limpeza, carga e ligação do acervo numa transação.`
  }
  if (comando === 'carregar' && a) {
    if (!ambiente.DATABASE_URL) throw new Error('Sem DATABASE_URL: a carga roda no app de homologação, com o banco dele.')
    const carga = await lerJson<Carga>(a)
    const { banco, fechar } = await abrirBanco(ambiente.DATABASE_URL)
    try {
      const resumo = await carregar(banco, carga, ambiente)
      return [
        `Limpas: ${resumo.limpas.join(', ')}`,
        `Enviadas: ${Object.entries(resumo.enviadas)
          .map(([k, n]) => `${k} ${n}`)
          .join(', ')}`,
        `Acervo ligado pelo CNJ: ${resumo.acervoLigado} (o acervo entra depois, pelo Raio-X; rode ligar-acervo em seguida)`,
      ].join('\n')
    } finally {
      await fechar()
    }
  }
  if (comando === 'ligar-acervo') {
    if (!ambiente.DATABASE_URL) throw new Error('Sem DATABASE_URL: a ligação roda no app de homologação, com o banco dele.')
    const { banco, fechar } = await abrirBanco(ambiente.DATABASE_URL)
    try {
      return `Acervo ligado pelo CNJ: ${await ligarAcervo(banco)} processos com caso.`
    } finally {
      await fechar()
    }
  }
  throw new Error(USO)
}

const executadoDireto = !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (executadoDireto) {
  try {
    console.log(await principal(process.argv.slice(2)))
  } catch (erro) {
    console.error((erro as Error).message)
    process.exitCode = 1
  }
}
