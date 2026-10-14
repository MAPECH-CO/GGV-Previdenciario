// GGVP-158 P7.7 (GGVP-148): o Raio-X, a parte pura. Ler a planilha da base histórica e decidir o que cada linha vira, e
// calcular os indicadores da base importada, cada um com o número de casos. Os campos passam pela biblioteca `campos`;
// nada aqui grava nem registra, e as mensagens de erro nunca repetem o dado da célula.
import { createHash } from 'node:crypto'
import { dataParaIso, normalizarCnj, normalizarData, validarCnj, validarData } from '@ggv/campos'
import {
  COLUNAS_DO_RAIO_X,
  DESFECHOS_DO_ACERVO,
  LINHAS_MAXIMAS_DA_PLANILHA,
  RESULTADOS_DO_RECURSO,
  ROTULO_DESFECHO_DO_ACERVO,
  ROTULO_RESULTADO_DO_RECURSO,
  RaioXDaBase,
  RelatorioDoRaioX,
  type Beneficio,
  type DesfechoDoAcervo,
  type ResultadoDoRecurso,
  type TaxaDoRaioX,
} from '@ggv/contratos'
import { beneficioDaPlanilha, chave, lerCsv } from './importacao.ts'
import { juizoDoCnj } from './juizo.ts'

type Coluna = (typeof COLUNAS_DO_RAIO_X)[number]
/** Um processo da base, como entra no acervo. */
export type ProcessoDoRaioX = {
  numeroCnj: string
  beneficio: Beneficio | null
  desfecho: DesfechoDoAcervo | null
  dataDecisao: string | null
  perito: string | null
  vara: string | null
  juiz: string | null
  falhaNossa: boolean | null
  laudoFavoravel: boolean | null
  extintoPorDeterminacao: boolean | null
  faltouPericia: boolean | null
  resultadoRecurso: ResultadoDoRecurso | null
  cartorioCobrou: string[] | null
}
export type AnaliseDoRaioX = { novos: ProcessoDoRaioX[]; jaNoAcervo: number; erros: { linha: number; motivo: string }[]; colunasIgnoradas: string[] }

/** O id ou o rótulo da lista, sem acento nem caixa: "Procedente em parte" e "procedente_parcial" são o mesmo. */
const pelaLista = <T extends string>(ids: readonly T[], rotulos: Record<T, string>) => new Map(ids.flatMap((i) => [[chave(i), i] as const, [chave(rotulos[i]), i] as const]))
const DESFECHO = pelaLista(DESFECHOS_DO_ACERVO, ROTULO_DESFECHO_DO_ACERVO)
const RECURSO = pelaLista(RESULTADOS_DO_RECURSO, ROTULO_RESULTADO_DO_RECURSO)
const SIM = new Set(['sim', 's', 'x', '1', 'true', 'verdadeiro'])
const NAO = new Set(['nao', 'n', '0', 'false', 'falso'])
/** O texto da célula, com os espaços arrumados; vazia, nula. */
const texto = (v: string) => v.replace(/\s+/g, ' ').trim() || null

/** Lê a planilha e decide, linha a linha, o que entra. A linha 1 é a dos títulos; o número que já está no acervo fica. */
export function analisarRaioX(arquivo: string, noAcervo: Set<string>): AnaliseDoRaioX {
  const [cabecalho = [], ...registros] = lerCsv(arquivo)
  const posicao = new Map<Coluna, number>()
  const colunasIgnoradas: string[] = []
  cabecalho.forEach((c, i) => {
    const n = chave(c).replace(/ /g, '_')
    if ((COLUNAS_DO_RAIO_X as readonly string[]).includes(n) && !posicao.has(n as Coluna)) posicao.set(n as Coluna, i)
    else if (n) colunasIgnoradas.push(c.trim())
  })
  if (!posicao.has('cnj')) return { novos: [], jaNoAcervo: 0, erros: [{ linha: 1, motivo: 'Falta a coluna: cnj.' }], colunasIgnoradas }
  if (registros.length > LINHAS_MAXIMAS_DA_PLANILHA)
    return { novos: [], jaNoAcervo: 0, erros: [{ linha: 1, motivo: `Mais de ${LINHAS_MAXIMAS_DA_PLANILHA} linhas: divida a planilha.` }], colunasIgnoradas }

  const novos: ProcessoDoRaioX[] = []
  const erros: AnaliseDoRaioX['erros'] = []
  const vistos = new Map<string, number>()
  let jaNoAcervo = 0
  registros.forEach((registro, i) => {
    const linha = i + 2
    if (registro.every((v) => v.trim() === '')) return
    const valor = (c: Coluna) => (posicao.has(c) ? (registro[posicao.get(c)!] ?? '').trim() : '')
    const motivos: string[] = []
    const daLista = <T>(c: Coluna, lista: Map<string, T>, rotulo: string) => {
      if (!valor(c)) return null
      const achado = lista.get(chave(valor(c)))
      if (achado === undefined) motivos.push(`${rotulo} desconhecido`)
      return achado ?? null
    }
    const simOuNao = (c: Coluna, rotulo: string) => {
      const v = chave(valor(c))
      if (!v) return null
      if (SIM.has(v) || NAO.has(v)) return SIM.has(v)
      motivos.push(`${rotulo}: use sim ou não`)
      return null
    }

    const cnj = valor('cnj')
    if (!cnj) motivos.push('sem o número do processo')
    else if (!validarCnj(cnj)) motivos.push('número CNJ inválido')
    const beneficio = valor('beneficio') ? beneficioDaPlanilha(valor('beneficio')) : null
    if (valor('beneficio') && !beneficio) motivos.push('benefício desconhecido')
    const desfecho = daLista('desfecho', DESFECHO, 'desfecho')
    const resultadoRecurso = daLista('recurso', RECURSO, 'resultado do recurso')
    const data = valor('data_decisao')
    if (data && !validarData(normalizarData(data))) motivos.push('data da decisão inválida (use dd/mm/aaaa)')
    const falhaNossa = simOuNao('falha_nossa', 'falha nossa')
    const laudoFavoravel = simOuNao('laudo', 'laudo favorável')
    const extintoPorDeterminacao = simOuNao('extinto_por_determinacao', 'extinto por determinação')
    const faltouPericia = simOuNao('faltou_pericia', 'faltou à perícia')
    const numero = cnj && validarCnj(cnj) ? normalizarCnj(cnj) : null
    if (numero && vistos.has(numero)) motivos.push(`CNJ repetido na linha ${vistos.get(numero)}`)
    if (motivos.length > 0 || !numero) {
      erros.push({ linha, motivo: `${motivos.join('; ')}.` })
      return
    }
    vistos.set(numero, linha)
    if (noAcervo.has(numero)) {
      jaNoAcervo++
      return
    }
    const itens = valor('cartorio_cobrou')
      .split(';')
      .flatMap((x) => texto(x) ?? [])
    novos.push({
      numeroCnj: numero,
      beneficio,
      desfecho,
      dataDecisao: data ? (dataParaIso(normalizarData(data)) ?? null) : null,
      perito: texto(valor('perito')),
      vara: texto(valor('vara')),
      juiz: texto(valor('juiz')),
      falhaNossa,
      laudoFavoravel,
      extintoPorDeterminacao,
      faltouPericia,
      resultadoRecurso,
      cartorioCobrou: itens.length ? itens : null,
    })
  })
  return { novos, jaNoAcervo, erros, colunasIgnoradas }
}

const distintos = (valores: (string | null)[]) => [...new Set(valores.flatMap((v) => v ?? []))].sort((a, b) => a.localeCompare(b, 'pt-BR'))

/** O relatório que a Sênior confere, com a marca: o plano inteiro, com o que seria gravado. */
export function relatorioDoRaioX({ novos, jaNoAcervo, erros, colunasIgnoradas }: AnaliseDoRaioX): RelatorioDoRaioX {
  const conferido = createHash('sha256').update(JSON.stringify({ novos, jaNoAcervo, erros })).digest('hex')
  return RelatorioDoRaioX.parse({
    conferido,
    processos: { novos: novos.length, jaNoAcervo },
    peritos: distintos(novos.map((p) => p.perito)),
    juizes: distintos(novos.map((p) => p.juiz)),
    varas: distintos(novos.map((p) => p.vara)),
    dataDeCorte: novos.flatMap((p) => p.dataDecisao ?? []).sort().at(-1) ?? null,
    erros,
    colunasIgnoradas,
  })
}

/** Êxito, como o Raio-X classifica: procedente, em parte, acordo (e o deferido no INSS). Desistência não é decisão. */
const EXITO = new Set(['procedente_total', 'procedente_parcial', 'acordo', 'deferido'])
const decidido = (desfecho: string | null) => desfecho !== null && desfecho !== 'desistencia'
/** A safra: o ano do número CNJ (NNNNNNN-DD.AAAA.J.TR.OOOO). */
const safra = (cnj: string) => cnj.replace(/\D/g, '').slice(9, 13)

/** Um processo da base importada, como o banco devolve. */
type Registro = Pick<ProcessoDoRaioX, 'numeroCnj' | 'dataDecisao' | 'falhaNossa' | 'laudoFavoravel' | 'extintoPorDeterminacao' | 'faltouPericia' | 'cartorioCobrou'> & {
  desfecho: string | null
  resultadoRecurso: string | null
}

/** A fração dos que valem (`conta` diz sim ou não; nulo fica fora), com o número de casos. */
function fracao<T>(itens: T[], conta: (x: T) => boolean | null) {
  const vale = itens.map(conta).filter((v): v is boolean => v !== null)
  return { casos: vale.length, valor: vale.length ? vale.filter(Boolean).length / vale.length : null }
}

function taxa(chaveDaTaxa: string, rotulo: string, base: Registro[], conta: (r: Registro) => boolean | null): TaxaDoRaioX {
  const safras = [...new Set(base.map((r) => safra(r.numeroCnj)))].sort()
  const porSafra = safras.map((s) => ({ safra: s, ...fracao(base.filter((r) => safra(r.numeroCnj) === s), conta) })).filter((s) => s.casos > 0)
  return { chave: chaveDaTaxa, rotulo, ...fracao(base, conta), porSafra }
}

/** Os indicadores do Raio-X, calculados da base importada (G19: número é código), cada um com o número de casos. */
export function indicadoresDoRaioX(base: Registro[]): RaioXDaBase {
  const comCobranca = base.filter((r) => r.cartorioCobrou?.length)
  const vezes = new Map<string, { item: string; vezes: number }>()
  for (const item of comCobranca.flatMap((r) => r.cartorioCobrou!)) {
    const x = vezes.get(chave(item)) ?? { item, vezes: 0 }
    x.vezes++
    vezes.set(chave(item), x)
  }
  const foros = new Map<string, Registro[]>()
  for (const r of base) {
    const foro = juizoDoCnj(r.numeroCnj) ?? 'sem foro'
    foros.set(foro, [...(foros.get(foro) ?? []), r])
  }
  return RaioXDaBase.parse({
    processos: base.length,
    dataDaBase: base.flatMap((r) => r.dataDecisao ?? []).sort().at(-1) ?? null,
    indicadores: [
      taxa('exito', 'Êxito nos decididos', base, (r) => (decidido(r.desfecho) ? EXITO.has(r.desfecho!) : null)),
      taxa('falha_nossa', 'Falha nossa provada', base, (r) => r.falhaNossa),
      taxa('laudo_favoravel', 'Laudo médico favorável', base, (r) => r.laudoFavoravel),
      taxa('extinto_por_determinacao', 'Extinção por não cumprir determinação', base, (r) => r.extintoPorDeterminacao),
      taxa('faltou_pericia', 'Cliente que faltou à perícia', base, (r) => r.faltouPericia),
      taxa('recurso_provido', 'Recurso provido', base, (r) => (r.resultadoRecurso ? r.resultadoRecurso !== 'nao_provido' : null)),
    ],
    cartorioCobra: {
      processos: comCobranca.length,
      // ponytail: os 10 mais cobrados; a lista inteira se a tela pedir.
      itens: [...vezes.values()].sort((a, b) => b.vezes - a.vezes || a.item.localeCompare(b.item, 'pt-BR')).slice(0, 10),
    },
    ondeJulgam: [...foros]
      .map(([foro, rs]) => {
        const exito = fracao(rs, (r) => (decidido(r.desfecho) ? EXITO.has(r.desfecho!) : null))
        return { foro, processos: rs.length, decididos: exito.casos, exito: exito.valor }
      })
      .sort((a, b) => b.processos - a.processos || a.foro.localeCompare(b.foro, 'pt-BR')),
  })
}
