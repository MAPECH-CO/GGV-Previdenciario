// O importador da planilha do escritório (GGVP-146, parte 2), a parte pura: ler o CSV e decidir o que cada linha vira.
// Os campos passam pela biblioteca `campos`; o cliente não duplica pelo CPF, nem o processo pelo NB ou pelo CNJ.
// Nada aqui grava nem registra: a rota grava só com a confirmação, e as mensagens de erro nunca repetem o dado.
import {
  dataParaIso,
  normalizarCep,
  normalizarCnj,
  normalizarCpf,
  normalizarData,
  normalizarNb,
  normalizarNome,
  normalizarTelefone,
  validarCep,
  validarCnj,
  validarCpf,
  validarData,
  validarEmail,
  validarNb,
  validarNome,
  validarTelefone,
} from '@ggv/campos'
import { BENEFICIOS, COLUNAS_DA_PLANILHA, LINHAS_MAXIMAS_DA_PLANILHA, ROTULO_BENEFICIO, type Beneficio, type LinhaDaImportacao } from '@ggv/contratos'

type Coluna = (typeof COLUNAS_DA_PLANILHA)[number]
export type FaseImportada = 'atendimento' | 'administrativa' | 'judicial'

export type PessoaImportada = { nome: string; cpf: string; dataNascimento: string | null; telefone: string | null; email: string | null; cep: string | null }
export type CasoImportado = { beneficio: Beneficio | null; fase: FaseImportada; nb: string | null; cnj: string | null }
/** A linha válida, com o que a rota grava. */
export type LinhaAnalisada = LinhaDaImportacao & { pessoa: PessoaImportada; caso: CasoImportado | null }

/** O que já está no portal, para não duplicar. */
export type NoPortal = {
  /** CPF (só dígitos) → a pessoa. */
  pessoas: Map<string, { id: string; nome: string }>
  /** "nb:<dígitos>" e "cnj:<dígitos>". */
  numeros: Set<string>
  /** "<pessoaId>:<benefício>": os casos em andamento, para o processo sem número. */
  casosAbertos: Set<string>
}

export type Analise = { linhas: LinhaAnalisada[]; erros: { linha: number; motivo: string }[]; colunasIgnoradas: string[] }

/** Sem acento, minúsculo, só letras e números separados por espaço: "BPC/LOAS Idoso" → "bpc loas idoso". */
const chave = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** O benefício pelo código ("bpc_loas_idoso") ou pelo nome ("BPC/LOAS Idoso"). */
const PELO_NOME = new Map<string, Beneficio>(BENEFICIOS.flatMap((b) => [[chave(b), b] as const, [chave(ROTULO_BENEFICIO[b]), b] as const]))
const FASES: FaseImportada[] = ['atendimento', 'administrativa', 'judicial']

/** CSV com vírgula ou ponto e vírgula (o do Excel em português), aspas e quebra de linha dentro das aspas. */
export function lerCsv(texto: string): string[][] {
  const t = texto.replace(/^﻿/, '')
  const separador = (t.split(/\r?\n/, 1)[0] ?? '').includes(';') ? ';' : ','
  const linhas: string[][] = []
  let linha: string[] = []
  let campo = ''
  let aspas = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (aspas) {
      if (c !== '"') campo += c
      else if (t[i + 1] === '"') campo += t[++i]
      else aspas = false
    } else if (c === '"') aspas = true
    else if (c === separador) {
      linha.push(campo)
      campo = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++
      linha.push(campo)
      linhas.push(linha)
      linha = []
      campo = ''
    } else campo += c
  }
  if (campo !== '' || linha.length > 0) linhas.push([...linha, campo])
  return linhas
}

/** Lê a planilha e decide, linha a linha, o que entra. A linha 1 é a dos nomes das colunas. */
export function analisarPlanilha(texto: string, portal: NoPortal): Analise {
  const [cabecalho = [], ...registros] = lerCsv(texto)
  const nomes = cabecalho.map((c) => chave(c).replace(/ /g, ''))
  const posicao = new Map<Coluna, number>()
  const colunasIgnoradas: string[] = []
  nomes.forEach((n, i) => {
    if ((COLUNAS_DA_PLANILHA as readonly string[]).includes(n) && !posicao.has(n as Coluna)) posicao.set(n as Coluna, i)
    else if (n) colunasIgnoradas.push(cabecalho[i].trim())
  })
  const faltam = (['nome', 'cpf'] as const).filter((c) => !posicao.has(c))
  if (faltam.length > 0) return { linhas: [], erros: [{ linha: 1, motivo: `Faltam as colunas: ${faltam.join(', ')}.` }], colunasIgnoradas }
  if (registros.length > LINHAS_MAXIMAS_DA_PLANILHA)
    return { linhas: [], erros: [{ linha: 1, motivo: `Mais de ${LINHAS_MAXIMAS_DA_PLANILHA} linhas: divida a planilha.` }], colunasIgnoradas }

  const linhas: LinhaAnalisada[] = []
  const erros: Analise['erros'] = []
  /** Na planilha: CPF → a primeira linha e o nome; número → a linha; "<cpf>:<benefício>" → a linha. */
  const cpfs = new Map<string, { linha: number; nome: string }>()
  const numeros = new Map<string, number>()
  const semNumero = new Map<string, number>()

  registros.forEach((registro, i) => {
    const linha = i + 2
    const valor = (c: Coluna) => (posicao.has(c) ? (registro[posicao.get(c)!] ?? '').trim() : '')
    if (registro.every((v) => v.trim() === '')) return
    const motivos: string[] = []
    const v = Object.fromEntries(COLUNAS_DA_PLANILHA.map((c) => [c, valor(c)])) as Record<Coluna, string>

    if (!validarNome(v.nome)) motivos.push('nome inválido')
    if (!v.cpf) motivos.push('CPF vazio')
    else if (!validarCpf(v.cpf)) motivos.push('CPF inválido')
    if (v.nascimento && !validarData(normalizarData(v.nascimento))) motivos.push('data de nascimento inválida (use dd/mm/aaaa)')
    if (v.telefone && !validarTelefone(v.telefone)) motivos.push('telefone inválido')
    if (v.email && !validarEmail(v.email)) motivos.push('e-mail inválido')
    if (v.cep && !validarCep(v.cep)) motivos.push('CEP inválido')
    const beneficio = v.beneficio ? (PELO_NOME.get(chave(v.beneficio)) ?? null) : null
    if (v.beneficio && !beneficio) motivos.push('benefício desconhecido')
    const fase = chave(v.fase)
    if (fase === 'encerrado') motivos.push('processo encerrado: só entram os em andamento')
    else if (fase && !FASES.includes(fase as FaseImportada)) motivos.push('fase desconhecida (atendimento, administrativa ou judicial)')
    if (v.nb && !validarNb(v.nb)) motivos.push('NB inválido')
    if (v.cnj && !validarCnj(v.cnj)) motivos.push('número CNJ inválido')

    const cpf = normalizarCpf(v.cpf)
    const nome = normalizarNome(v.nome)
    const nb = v.nb ? normalizarNb(v.nb) : null
    const cnj = v.cnj ? normalizarCnj(v.cnj) : null
    if (motivos.length === 0) {
      const antes = cpfs.get(cpf)
      if (antes && chave(antes.nome) !== chave(nome)) motivos.push(`CPF repetido na linha ${antes.linha}, com outro nome`)
      for (const [tipo, n] of [['NB', nb && `nb:${nb}`], ['CNJ', cnj && `cnj:${cnj}`]] as const)
        if (n && numeros.has(n)) motivos.push(`${tipo} repetido na linha ${numeros.get(n)}`)
      if (!nb && !cnj && beneficio && semNumero.has(`${cpf}:${beneficio}`)) motivos.push(`processo repetido na linha ${semNumero.get(`${cpf}:${beneficio}`)}`)
    }
    if (motivos.length > 0) {
      erros.push({ linha, motivo: `${motivos.join('; ')}.` })
      return
    }

    if (!cpfs.has(cpf)) cpfs.set(cpf, { linha, nome })
    if (nb) numeros.set(`nb:${nb}`, linha)
    if (cnj) numeros.set(`cnj:${cnj}`, linha)
    if (!nb && !cnj && beneficio) semNumero.set(`${cpf}:${beneficio}`, linha)

    const existente = portal.pessoas.get(cpf)
    const temProcesso = Boolean(beneficio || nb || cnj)
    const faseDoCaso: FaseImportada = (fase as FaseImportada) || (cnj ? 'judicial' : 'administrativa')
    const jaTem = nb || cnj ? [nb && `nb:${nb}`, cnj && `cnj:${cnj}`].some((n) => n && portal.numeros.has(n)) : Boolean(existente && portal.casosAbertos.has(`${existente.id}:${beneficio}`))
    linhas.push({
      linha,
      nome,
      cliente: existente ? 'ja-cadastrado' : 'novo',
      ...(existente && chave(existente.nome) !== chave(nome) && { nomeNoPortal: existente.nome }),
      processo: !temProcesso ? 'sem-processo' : jaTem ? 'ja-cadastrado' : 'novo',
      beneficio,
      fase: temProcesso ? faseDoCaso : null,
      pessoa: {
        nome,
        cpf,
        dataNascimento: v.nascimento ? dataParaIso(normalizarData(v.nascimento)) : null,
        telefone: v.telefone ? normalizarTelefone(v.telefone) : null,
        email: v.email ? v.email.toLowerCase() : null,
        cep: v.cep ? normalizarCep(v.cep) : null,
      },
      caso: temProcesso ? { beneficio, fase: faseDoCaso, nb, cnj } : null,
    })
  })
  return { linhas, erros, colunasIgnoradas }
}
