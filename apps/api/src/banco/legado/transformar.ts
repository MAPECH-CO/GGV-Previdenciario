// O legado do portal antigo, parte 2: a transformação pura (16/10, pedido do Mateus). Só o cliente aceito entra, e o
// `juridico` (a lista mais nova, de 22/08) manda sobre o backup do Airtable quando os dois têm o mesmo cliente. Cada
// campo passa pela biblioteca `campos`: o que não vale fica nulo e é contado, nunca gravado torto. Os ids são estáveis
// (derivados da chave antiga): rodar de novo gera a mesma carga. O relatório só tem números: nenhum nome, CPF ou
// telefone sai daqui para o terminal, para o Jira ou para o repositório.
import { createHash } from 'node:crypto'
import { dataParaIso, normalizarCep, normalizarCnj, normalizarCpf, normalizarNome, normalizarTelefone, somenteDigitos, validarCep, validarCnj, validarCpf, validarEmail, validarNome, validarTelefone } from '@ggv/campos'
import { CATALOGO_BENEFICIOS, type Beneficio } from '@ggv/contratos'
import { beneficioDaPlanilha, chave } from '../../fluxo/importacao.ts'
import type { BeneficioDoProcesso, ClienteDoBackup, ClienteDoJuridico, EventoDaAgenda, Legado, MovimentacaoDoBackup, ProcessoDoBackup, RequerimentoDoBackup } from './extrair.ts'

export type Fase = 'atendimento' | 'administrativa' | 'judicial' | 'encerrado'
export type Desfecho = 'deferido' | 'procedente_total' | 'procedente_parcial' | 'improcedente' | 'extinto_sem_merito' | 'desistencia'
export type TipoDePericia = 'medica' | 'social'

export type PessoaDaCarga = {
  id: string
  nome: string
  cpf: string | null
  dataNascimento: string | null
  telefone: string | null
  telefone2: string | null
  email: string | null
  cep: string | null
  logradouro: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  situacao: 'cliente'
  origem: string | null
  rendaPorPessoa: string | null
  drivePastaId: string | null
  criadoEm: string
}
export type CasoDaCarga = {
  id: string
  pessoaId: string
  beneficio: Beneficio | null
  fase: Fase
  desfecho: Desfecho | null
  encerradoEm: string | null
  vara: string | null
  valorCausa: string | null
  criadoEm: string
  atualizadoEm: string
}
export type IdentificadorDaCarga = { id: string; casoId: string; tipo: 'cnj' | 'protocolo_inss'; valor: string; criadoEm: string }
export type ResultadoDaCarga = { id: string; casoId: string; resultado: 'deferido' | 'indeferido'; dataDecisao: string; criadoEm: string }
export type PericiaDaCarga = {
  id: string
  casoId: string
  tipo: TipoDePericia
  agendadaPara: string
  local: string | null
  compareceu: boolean | null
  resultado: 'favoravel' | 'desfavoravel' | null
  /** A perícia no formato das telas (GGVP-137): sem ele, a página montaria uma perícia nova e apagaria o resultado antigo. */
  documento: Record<string, unknown>
  criadoEm: string
}
export type EventoDaCarga = { id: string; quem: 'sistema'; acao: string; alvo: string; quando: string; detalhe: Record<string, unknown> }

export type Relatorio = {
  clientes: {
    lidos: { backup: number; juridico: number }
    ligados: { porCpf: number; porNome: number }
    aceitos: { juridico: number; soBackup: number; divergentesDoBackup: number }
    gravados: number
    unidosPorCpf: number
    semProcesso: number
    foraPorStatus: Record<string, number>
    campos: {
      semNome: number
      nomeForaDoPadrao: number
      cpfInvalido: number
      nascimentoInvalido: number
      telefoneInvalido: number
      emailInvalido: number
      cepInvalido: number
      ufInvalida: number
      semOrigem: number
    }
  }
  processos: {
    lidos: number
    deAceitos: number
    gravados: number
    foraDeNaoAceitos: number
    civeis: number
    porBeneficio: Record<string, number>
    beneficioDesconhecido: Record<string, number>
    semBeneficio: number
    porFase: Record<Fase, number>
    porStatusAntigo: Record<string, number>
    faseDeduzida: number
    numeros: { cnj: number; cnjInvalido: number; cnjRepetido: number; protocolo: number; protocoloRepetido: number }
  }
  resultadosInss: { deferido: number; indeferido: number; semData: number }
  pericias: { medica: number; social: number; comResultado: number; semHora: number; semProcesso: number; canceladas: number }
  eventos: { gravados: number; porAcao: Record<string, number> }
}

export type Carga = {
  pessoas: PessoaDaCarga[]
  casos: CasoDaCarga[]
  identificadores: IdentificadorDaCarga[]
  resultados: ResultadoDaCarga[]
  pericias: PericiaDaCarga[]
  eventos: EventoDaCarga[]
  relatorio: Relatorio
}

/** Quem assina o que veio do portal antigo, nas telas da perícia. */
export const PORTAL_ANTIGO = 'Portal antigo'
/** O prefixo das ações do histórico que vieram do portal antigo (o `DESCRICAO` da rota do histórico traduz cada uma). */
export const ACAO_LEGADO = 'legado_'

/** Um id estável a partir da chave do legado: rodar de novo gera os mesmos ids, e o `on conflict do nothing` segura. */
export function idDoLegado(tipo: string, chaveAntiga: string): string {
  const h = createHash('sha256').update(`legado:${tipo}:${chaveAntiga}`).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`
}

/** "2024-02-29", "2024-02-29 10:00:00+00" ou "29/02/2024" → "2024-02-29". Fora de 1900 a 2100, ou dia que não existe: nulo. */
export function diaDoLegado(valor: string | null | undefined): string | null {
  if (!valor) return null
  const s = valor.trim()
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  const iso = m ? `${m[1]}-${m[2]}-${m[3]}` : dataParaIso(s.slice(0, 10))
  if (!iso) return null
  const ano = Number(iso.slice(0, 4))
  if (ano < 1900 || ano > 2100) return null
  const d = new Date(`${iso}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : null
}

/** Um momento ISO: com hora, a hora que veio; só o dia, a hora padrão em Brasília. Inválido: nulo. */
export function momentoDoLegado(valor: string | null | undefined, horaPadrao = '12:00'): string | null {
  if (!valor) return null
  const s = valor.trim().replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00')
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) {
    const d = new Date(s)
    if (!Number.isNaN(d.getTime())) return d.toISOString()
  }
  const dia = diaDoLegado(valor)
  return dia ? new Date(`${dia}T${horaPadrao}:00-03:00`).toISOString() : null
}

/** A hora de um momento em Brasília (sem horário de verão), "HH:MM". */
const horaEmBrasilia = (iso: string) => new Date(new Date(iso).getTime() - 3 * 60 * 60 * 1000).toISOString().slice(11, 16)
const diaEmBrasilia = (iso: string) => new Date(new Date(iso).getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)

/**
 * Os nomes do portal antigo que o catálogo (34 benefícios, GGVP-158 P4.6) não acha pelo rótulo nem pelo id: a grafia
 * antiga ("Auxilio por Incapacidade", "Auxílio Acidententário") e o gênero ("Acidentário"). Fora daqui e do catálogo:
 * 'outro', com o nome antigo contado no relatório.
 */
const BENEFICIO_DO_LEGADO: Record<string, Beneficio> = {
  'auxilio por incapacidade': 'auxilio_incapacidade_temporaria',
  'auxilio acidententario': 'auxilio_acidente',
  'aposentadoria por incapacidade permanente acidentario': 'incapacidade_permanente_acidentaria',
  'reestabelecimento de beneficio': 'restabelecimento',
  'revisao para vida toda': 'revisao_vida_toda',
  'auxilio maternidade': 'salario_maternidade',
}
/** As 27 unidades da federação. */
const UFS = new Set(['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'])

/** O nome de cada benefício das telas (o catálogo), que o portal antigo usava: "LOAS Idoso", "Aposentadoria por Contribuição". */
const PELO_NOME_DO_CATALOGO = new Map<string, Beneficio>(CATALOGO_BENEFICIOS.map((b) => [chave(b.nome), b.servidor]))

/** O benefício do catálogo para o nome antigo; o que o catálogo não tem vira 'outro', com o nome antigo para o relatório. */
export function beneficioDoLegado(nome: string | null | undefined): { beneficio: Beneficio | null; desconhecido: string | null } {
  const n = nome?.trim()
  if (!n) return { beneficio: null, desconhecido: null }
  const b = BENEFICIO_DO_LEGADO[chave(n)] ?? PELO_NOME_DO_CATALOGO.get(chave(n)) ?? beneficioDaPlanilha(n)
  return b ? { beneficio: b, desconhecido: null } : { beneficio: 'outro', desconhecido: n }
}

type FaseEDesfecho = { fase: Fase; desfecho: Desfecho | null }
const judicial: FaseEDesfecho = { fase: 'judicial', desfecho: null }
const administrativa: FaseEDesfecho = { fase: 'administrativa', desfecho: null }
/** O status geral do portal antigo → a fase e o desfecho do caso. */
const FASE_DO_STATUS: Record<string, FaseEDesfecho> = {
  'concedido e encerrado no administrativo': { fase: 'encerrado', desfecho: 'deferido' },
  'concedido administrativo': { fase: 'encerrado', desfecho: 'deferido' },
  'concedido e encerrado no judicial': { fase: 'encerrado', desfecho: 'procedente_total' },
  'concedido judicial': { fase: 'encerrado', desfecho: 'procedente_total' },
  'coisa julgada improcedente': { fase: 'encerrado', desfecho: 'improcedente' },
  'julgado improcedente': { fase: 'encerrado', desfecho: 'improcedente' },
  'extinto em juizo': { fase: 'encerrado', desfecho: 'extinto_sem_merito' },
  'desistencia do processo judicial': { fase: 'encerrado', desfecho: 'desistencia' },
  'desistencia do processo administrativo': { fase: 'encerrado', desfecho: 'desistencia' },
  encerrado: { fase: 'encerrado', desfecho: null },
  'fase de execucao': { fase: 'judicial', desfecho: 'procedente_total' },
  'julgado procedente': { fase: 'judicial', desfecho: 'procedente_total' },
  'processo em curso judicial': judicial,
  'fase recursal': judicial,
  'mandado de seguranca': judicial,
  'em curso': judicial,
  sobrestado: judicial,
  'dar entrada processo judicial': judicial,
  'dar entrada no processo civel': judicial,
  'em analise no inss': administrativa,
  'indeferido administrativo': administrativa,
  'exigencias administrativas': administrativa,
  'dar entrada novamente pela via administrativa': administrativa,
  'dar entrada processo administrativo': administrativa,
  'dar entrada apos correcao no processo administrativo': administrativa,
  'recurso ordinario': administrativa,
  ativo: administrativa,
}
/** Sem status geral: a última movimentação diz em que fase o processo parou. */
const FASE_DA_MOVIMENTACAO: Record<string, Fase> = {
  'assinatura de contrato': 'atendimento',
  'envio de documentacao': 'atendimento',
  'protocolo administrativo': 'administrativa',
  'indeferimento administrativo': 'administrativa',
  'entrada no judicial': 'judicial',
  'protocolo judicial': 'judicial',
  'indeferimento judicial': 'encerrado',
  'concessao do beneficio': 'encerrado',
}
const FASE_DA_ETAPA: Record<string, Fase> = { judicial: 'judicial', administrativo: 'administrativa', civel: 'judicial' }
/** A etapa do requerimento (ou o resultado administrativo do benefício) que é uma decisão do INSS. */
const RESULTADO_DO_INSS: Record<string, 'deferido' | 'indeferido'> = {
  'indeferido administrativo': 'indeferido',
  'concedido e encerrado no administrativo': 'deferido',
  'concedido administrativo': 'deferido',
}
const TIPOS_DE_PERICIA: Record<string, TipoDePericia[]> = {
  'pericia medica': ['medica'],
  'avaliacao social': ['social'],
  'pericia social': ['social'],
  'pericia medica e social': ['medica', 'social'],
}
/** O status da agenda que é um resultado favorável, e de qual perícia. */
const FAVORAVEL_DO_STATUS: Record<string, TipoDePericia> = { 'deficiencia comprovada': 'medica', 'hipossuficiencia comprovada': 'social' }
const COMPARECEU = new Set(['cumprida', 'deficiencia comprovada', 'hipossuficiencia comprovada'])

/** "Perícia Médica e Social" → "pericia_medica_e_social". */
export const slug = (s: string) => chave(s).replaceAll(' ', '_')
const texto = (s: string | null | undefined) => {
  const t = normalizarNome(s)
  return t ? t : null
}
const conta = (mapa: Record<string, number>, k: string) => (mapa[k] = (mapa[k] ?? 0) + 1)
const agrupar = <T>(lista: T[], de: (x: T) => string | null | undefined) => {
  const m = new Map<string, T[]>()
  for (const x of lista) {
    const k = de(x)
    if (k) (m.get(k) ?? m.set(k, []).get(k)!).push(x)
  }
  return m
}
const cpfValido = (v: string | null | undefined) => {
  const d = normalizarCpf(v)
  return d && validarCpf(d) ? d : null
}

/** O cliente como unidade: a linha do `juridico` (se há) e as linhas do backup ligadas a ela. */
type Cliente = { juridico: ClienteDoJuridico | null; backups: ClienteDoBackup[] }

function relatorioVazio(): Relatorio {
  return {
    clientes: {
      lidos: { backup: 0, juridico: 0 },
      ligados: { porCpf: 0, porNome: 0 },
      aceitos: { juridico: 0, soBackup: 0, divergentesDoBackup: 0 },
      gravados: 0,
      unidosPorCpf: 0,
      semProcesso: 0,
      foraPorStatus: {},
      campos: { semNome: 0, nomeForaDoPadrao: 0, cpfInvalido: 0, nascimentoInvalido: 0, telefoneInvalido: 0, emailInvalido: 0, cepInvalido: 0, ufInvalida: 0, semOrigem: 0 },
    },
    processos: {
      lidos: 0,
      deAceitos: 0,
      gravados: 0,
      foraDeNaoAceitos: 0,
      civeis: 0,
      porBeneficio: {},
      beneficioDesconhecido: {},
      semBeneficio: 0,
      porFase: { atendimento: 0, administrativa: 0, judicial: 0, encerrado: 0 },
      porStatusAntigo: {},
      faseDeduzida: 0,
      numeros: { cnj: 0, cnjInvalido: 0, cnjRepetido: 0, protocolo: 0, protocoloRepetido: 0 },
    },
    resultadosInss: { deferido: 0, indeferido: 0, semData: 0 },
    pericias: { medica: 0, social: 0, comResultado: 0, semHora: 0, semProcesso: 0, canceladas: 0 },
    eventos: { gravados: 0, porAcao: {} },
  }
}

/**
 * Liga cada linha do `juridico` às do backup (pelo CPF; sem CPF que bata, pelo nome) e decide quem entra: no `juridico`,
 * o status de lá (ACEITO); só no backup, o status do Airtable (Aceito). O mesmo CPF em duas unidades vira uma só.
 */
export function clientesAceitos(legado: Legado, r: Relatorio): Cliente[] {
  r.clientes.lidos = { backup: legado.clientesDoBackup.length, juridico: legado.clientesDoJuridico.length }
  const porCpf = agrupar(legado.clientesDoBackup, (c) => cpfValido(c.cpf))
  const porNome = agrupar(legado.clientesDoBackup, (c) => chave(normalizarNome(c.nome)) || null)
  const ligados = new Set<string>()
  const unidades: Cliente[] = []
  const aceito = (status: string | null | undefined) => chave(status ?? '') === 'aceito'
  for (const j of legado.clientesDoJuridico) {
    let backups = (porCpf.get(cpfValido(j.cpf) ?? '') ?? []).filter((b) => !ligados.has(b.id))
    if (backups.length) r.clientes.ligados.porCpf += backups.length
    else {
      backups = (porNome.get(chave(normalizarNome(j.nome)) || '\u0000') ?? []).filter((b) => !ligados.has(b.id))
      r.clientes.ligados.porNome += backups.length
    }
    for (const b of backups) ligados.add(b.id)
    if (!aceito(j.status)) {
      conta(r.clientes.foraPorStatus, `juridico: ${j.status ?? 'sem status'}`)
      continue
    }
    r.clientes.aceitos.juridico++
    if (backups.some((b) => !aceito(b.status))) r.clientes.aceitos.divergentesDoBackup++
    unidades.push({ juridico: j, backups })
  }
  for (const b of legado.clientesDoBackup) {
    if (ligados.has(b.id)) continue
    if (!aceito(b.status)) {
      conta(r.clientes.foraPorStatus, `backup: ${b.status ?? 'sem status'}`)
      continue
    }
    r.clientes.aceitos.soBackup++
    unidades.push({ juridico: null, backups: [b] })
  }
  // O mesmo CPF em duas unidades (o cadastro duplicado do Airtable): uma pessoa só, com os processos das duas.
  const porCpfDaUnidade = new Map<string, Cliente>()
  const unicas: Cliente[] = []
  for (const u of unidades) {
    const cpf = cpfValido(u.juridico?.cpf) ?? u.backups.map((b) => cpfValido(b.cpf)).find(Boolean) ?? null
    const igual = cpf ? porCpfDaUnidade.get(cpf) : undefined
    if (igual) {
      igual.backups.push(...u.backups)
      r.clientes.unidosPorCpf++
      continue
    }
    if (cpf) porCpfDaUnidade.set(cpf, u)
    unicas.push(u)
  }
  return unicas
}

type Indices = {
  processosPorCliente: Map<string, ProcessoDoBackup[]>
  beneficiosPorProcesso: Map<string, BeneficioDoProcesso[]>
  requerimentosPorProcesso: Map<string, RequerimentoDoBackup[]>
  movimentacoesPorProcesso: Map<string, MovimentacaoDoBackup[]>
  agendaPorProcesso: Map<string, EventoDaAgenda[]>
  agendaPorCliente: Map<string, EventoDaAgenda[]>
  captacaoPorCliente: Map<string, { fonteTipo: string | null; canal: string | null; data: string | null }[]>
}

function indices(legado: Legado): Indices {
  const porData = <T extends { data: string | null }>(m: Map<string, T[]>) => {
    for (const lista of m.values()) lista.sort((a, b) => (a.data ?? '').localeCompare(b.data ?? ''))
    return m
  }
  return {
    processosPorCliente: agrupar(legado.processos, (p) => p.clienteId),
    beneficiosPorProcesso: agrupar(
      [...legado.beneficios].sort((a, b) => Number(b.ativo ?? false) - Number(a.ativo ?? false) || (a.ordem ?? 0) - (b.ordem ?? 0)),
      (b) => b.processoId,
    ),
    requerimentosPorProcesso: agrupar(legado.requerimentos, (q) => q.processoId),
    movimentacoesPorProcesso: porData(agrupar(legado.movimentacoes, (m) => m.processoId)),
    agendaPorProcesso: agrupar(legado.agenda, (a) => a.processoId),
    agendaPorCliente: agrupar(
      legado.agenda.filter((a) => !a.processoId),
      (a) => a.clienteId,
    ),
    captacaoPorCliente: porData(agrupar(legado.captacoes, (c) => c.clienteId)),
  }
}

/** A pessoa: o `juridico` primeiro, o backup no que faltar; cada campo validado pela `campos`. Sem nome, não entra. */
function montarPessoa(u: Cliente, ix: Indices, r: Relatorio, agora: string): PessoaDaCarga | null {
  const j = u.juridico
  const bs = u.backups
  const primeiro = <T>(de: (b: ClienteDoBackup) => T | null | undefined): T | null => {
    for (const b of bs) {
      const v = de(b)
      if (v !== null && v !== undefined && v !== '') return v
    }
    return null
  }
  const c = r.clientes.campos
  const nome = texto(j?.nome) ?? texto(primeiro((b) => b.nome))
  if (!nome) {
    c.semNome++
    return null
  }
  if (!validarNome(nome)) c.nomeForaDoPadrao++
  const cpfs = [j?.cpf, ...bs.map((b) => b.cpf)].filter((v): v is string => !!v && !!somenteDigitos(v))
  const cpf = cpfs.map(cpfValido).find(Boolean) ?? null
  if (!cpf && cpfs.length) c.cpfInvalido++
  const nascimentoBruto = j?.dataNascimento ?? primeiro((b) => b.dataNascimento)
  const dataNascimento = diaDoLegado(nascimentoBruto)
  if (nascimentoBruto && (!dataNascimento || dataNascimento > agora.slice(0, 10))) c.nascimentoInvalido++
  const telefones = [j?.telefone1, j?.telefone2, ...bs.flatMap((b) => [b.telefone1, b.telefone2])].filter((v): v is string => !!v && !!somenteDigitos(v))
  const validos = [...new Set(telefones.filter(validarTelefone).map(normalizarTelefone))]
  c.telefoneInvalido += telefones.length - telefones.filter(validarTelefone).length
  const emailBruto = (j?.email ?? primeiro((b) => b.email))?.trim().toLowerCase() ?? null
  const email = emailBruto && validarEmail(emailBruto) ? emailBruto : null
  if (emailBruto && !email) c.emailInvalido++
  const cepBruto = j?.cep ?? primeiro((b) => b.cep)
  const cep = cepBruto && validarCep(cepBruto) ? normalizarCep(cepBruto) : null
  if (cepBruto && somenteDigitos(cepBruto) && !cep) c.cepInvalido++
  const ufBruta = (j?.uf ?? primeiro((b) => b.uf))?.trim().toUpperCase() ?? null
  const uf = ufBruta && UFS.has(ufBruta) ? ufBruta : null
  if (ufBruta && !uf) c.ufInvalida++
  const captacao = bs.flatMap((b) => ix.captacaoPorCliente.get(b.id) ?? []).sort((a, b) => (a.data ?? '').localeCompare(b.data ?? ''))[0]
  const origem = texto(captacao?.fonteTipo) ?? texto(captacao?.canal)
  if (!origem) c.semOrigem++
  const renda = j?.rendaFamiliarCentavos != null ? j.rendaFamiliarCentavos / 100 : primeiro((b) => b.rendaFamiliar)
  const pessoas = j?.pessoasNaCasa ?? primeiro((b) => b.pessoasNaCasa)
  const rendaPorPessoa = renda && renda > 0 && pessoas && pessoas > 0 ? (renda / pessoas).toFixed(2) : null
  const contratos = [j?.dataContrato, ...bs.map((b) => b.dataContrato)].map(diaDoLegado).filter((d): d is string => !!d)
  const criadoEm =
    momentoDoLegado(contratos.sort()[0] ?? captacao?.data) ??
    momentoDoLegado(primeiro((b) => b.criadoEm)) ??
    momentoDoLegado(j?.criadoEm) ??
    agora
  return {
    id: idDoLegado('pessoa', j ? `juridico:${j.id}` : `backup:${bs[0].id}`),
    nome,
    cpf,
    dataNascimento: dataNascimento && dataNascimento <= agora.slice(0, 10) ? dataNascimento : null,
    telefone: validos[0] ?? null,
    telefone2: validos[1] ?? null,
    email,
    cep,
    logradouro: texto(j?.logradouro) ?? texto(primeiro((b) => b.endereco)),
    bairro: texto(j?.bairro) ?? texto(primeiro((b) => b.bairro)),
    cidade: texto(j?.cidade) ?? texto(primeiro((b) => b.cidade)),
    uf,
    situacao: 'cliente',
    origem,
    rendaPorPessoa,
    drivePastaId: texto(j?.drivePastaId) ?? texto(primeiro((b) => b.drivePastaId)),
    criadoEm,
  }
}

/** A fase e o desfecho: pelo status geral; sem ele, pelos resultados do benefício, pela última movimentação e pela etapa. */
export function faseDoProcesso(p: ProcessoDoBackup, beneficio: BeneficioDoProcesso | undefined, movimentacoes: MovimentacaoDoBackup[]): FaseEDesfecho & { deduzida: boolean } {
  const pelo = (s: string | null | undefined) => (s ? FASE_DO_STATUS[chave(s)] : undefined)
  const direta = pelo(p.statusGeral)
  if (direta) return { ...direta, deduzida: false }
  const doBeneficio = pelo(beneficio?.resultadoJudicial) ?? pelo(beneficio?.resultadoAdministrativo)
  if (doBeneficio) return { ...doBeneficio, deduzida: true }
  const ultima = movimentacoes.at(-1)
  const daMovimentacao = ultima?.tipo ? FASE_DA_MOVIMENTACAO[chave(ultima.tipo)] : undefined
  if (daMovimentacao) {
    const tipo = chave(ultima!.tipo!)
    const judicial = movimentacoes.some((m) => ['entrada no judicial', 'protocolo judicial'].includes(chave(m.tipo ?? '')))
    const desfecho: Desfecho | null = tipo === 'indeferimento judicial' ? 'improcedente' : tipo === 'concessao do beneficio' ? (judicial ? 'procedente_total' : 'deferido') : null
    return { fase: daMovimentacao, desfecho, deduzida: true }
  }
  const daEtapa = p.etapaAtual ? FASE_DA_ETAPA[chave(p.etapaAtual)] : undefined
  if (daEtapa) return { fase: daEtapa, desfecho: null, deduzida: true }
  return { fase: p.numeroCnj && validarCnj(p.numeroCnj) ? 'judicial' : 'atendimento', desfecho: null, deduzida: true }
}

/** A perícia no formato das telas, já marcada (a data antiga), com o comparecimento e o resultado que o portal antigo tinha. */
export function documentoDaPericia(p: Omit<PericiaDaCarga, 'documento'>, pessoaId: string, instancia: 'inss' | 'juizo', horaConhecida: boolean): Record<string, unknown> {
  const quando = p.criadoEm
  const marcacao: Record<string, unknown> = {
    data: diaEmBrasilia(p.agendadaPara),
    hora: horaEmBrasilia(p.agendadaPara),
    local: p.local ?? 'Local não registrado no portal antigo',
    modalidade: 'presencial',
    tipo: p.tipo,
    origem: instancia === 'juizo' ? 'juizo' : 'comprovante',
    registradaEm: quando,
    registradaPor: PORTAL_ANTIGO,
  }
  if (p.compareceu !== null) marcacao.comparecimento = { quando, quem: PORTAL_ANTIGO, compareceu: p.compareceu }
  const historico = [{ quando, quem: 'Sistema', oQue: `Perícia importada do portal antigo${horaConhecida ? '' : ' (a hora não estava registrada)'}`, passo: 'DP.01' }]
  return {
    id: p.id,
    processoId: p.casoId,
    fichaId: pessoaId,
    tipo: p.tipo,
    instancia,
    origem: instancia === 'juizo' ? 'd3-despacho' : 'd2-necessidade',
    pedidaPor: PORTAL_ANTIGO,
    pedidaEm: quando,
    abertaEm: quando,
    liberadaEm: quando,
    tentativas: [],
    remarcacoes: 0,
    marcacao,
    ...(p.resultado && { resultado: { registrado: { quando, quem: PORTAL_ANTIGO, favoravel: p.resultado === 'favoravel', conferidas: [] } } }),
    historico,
  }
}

/** A transformação inteira: do legado lido à carga pronta para gravar, com o relatório em números. */
export function transformar(legado: Legado, agora = new Date()): Carga {
  const r = relatorioVazio()
  const agoraIso = agora.toISOString()
  const ix = indices(legado)
  const carga: Carga = { pessoas: [], casos: [], identificadores: [], resultados: [], pericias: [], eventos: [], relatorio: r }
  const cnjs = new Set<string>()
  const protocolos = new Set<string>()
  const evento = (acao: string, alvo: string, quando: string, detalhe: Record<string, unknown>, chaveAntiga: string) => {
    carga.eventos.push({ id: idDoLegado('evento', `${acao}:${chaveAntiga}`), quem: 'sistema', acao, alvo, quando, detalhe })
    r.eventos.gravados++
    conta(r.eventos.porAcao, acao)
  }
  r.processos.lidos = legado.processos.length

  for (const u of clientesAceitos(legado, r)) {
    const pessoa = montarPessoa(u, ix, r, agoraIso)
    if (!pessoa) continue
    carga.pessoas.push(pessoa)
    r.clientes.gravados++
    evento(
      `${ACAO_LEGADO}cliente_importado`,
      `pessoa:${pessoa.id}`,
      pessoa.criadoEm,
      { pessoaId: pessoa.id, codigo: u.juridico?.codigo ?? null, status: u.juridico?.status ?? u.backups[0]?.status ?? null, fonte: u.juridico ? 'juridico' : 'backup' },
      pessoa.id,
    )
    const casosDaPessoa: CasoDaCarga[] = []
    const casoDoProcesso = new Map<string, CasoDaCarga>()
    for (const b of u.backups) {
      for (const p of ix.processosPorCliente.get(b.id) ?? []) {
        r.processos.deAceitos++
        const beneficios = ix.beneficiosPorProcesso.get(p.id) ?? []
        const requerimentos = ix.requerimentosPorProcesso.get(p.id) ?? []
        const movimentacoes = ix.movimentacoesPorProcesso.get(p.id) ?? []
        const nomeAntigo = beneficios[0]?.nome ?? requerimentos.find((q) => q.tipo)?.tipo ?? null
        const { beneficio, desconhecido } = beneficioDoLegado(nomeAntigo)
        if (desconhecido) conta(r.processos.beneficioDesconhecido, desconhecido)
        if (beneficio) conta(r.processos.porBeneficio, beneficio)
        else r.processos.semBeneficio++
        if (chave(p.area ?? '') === 'civel') r.processos.civeis++
        const { fase, desfecho, deduzida } = faseDoProcesso(p, beneficios[0], movimentacoes)
        if (deduzida) r.processos.faseDeduzida++
        r.processos.porFase[fase]++
        conta(r.processos.porStatusAntigo, p.statusGeral ?? 'sem status')
        const criadoEm = momentoDoLegado(movimentacoes[0]?.data) ?? momentoDoLegado(b.dataContrato) ?? momentoDoLegado(p.criadoEm) ?? pessoa.criadoEm
        const fim = [beneficios[0]?.dataConcessao, beneficios[0]?.dataIndeferimentoJudicial, beneficios[0]?.dataIndeferimentoAdministrativo]
          .map(diaDoLegado)
          .filter((d): d is string => !!d)
          .sort()
          .at(-1)
        const encerradoEm = fase === 'encerrado' ? (momentoDoLegado(fim ?? movimentacoes.at(-1)?.data ?? p.atualizadoEm) ?? criadoEm) : null
        const caso: CasoDaCarga = {
          id: idDoLegado('caso', p.id),
          pessoaId: pessoa.id,
          beneficio,
          fase,
          desfecho,
          encerradoEm,
          vara: texto(p.vara),
          valorCausa: p.valorCausa && p.valorCausa > 0 ? p.valorCausa.toFixed(2) : null,
          criadoEm,
          atualizadoEm: momentoDoLegado(p.atualizadoEm) ?? criadoEm,
        }
        carga.casos.push(caso)
        casosDaPessoa.push(caso)
        casoDoProcesso.set(p.id, caso)
        r.processos.gravados++
        evento(
          `${ACAO_LEGADO}processo_importado`,
          `caso:${caso.id}`,
          criadoEm,
          { casoId: caso.id, status: p.statusGeral, etapa: p.etapaAtual, area: p.area, beneficio: nomeAntigo, faseDeduzida: deduzida },
          p.id,
        )

        // Os números: o CNJ do processo e os protocolos do INSS, cada um uma vez só no portal.
        if (p.numeroCnj?.trim()) {
          if (!validarCnj(p.numeroCnj)) r.processos.numeros.cnjInvalido++
          else if (cnjs.has(normalizarCnj(p.numeroCnj))) r.processos.numeros.cnjRepetido++
          else {
            const valor = normalizarCnj(p.numeroCnj)
            cnjs.add(valor)
            carga.identificadores.push({ id: idDoLegado('identificador', `cnj:${valor}`), casoId: caso.id, tipo: 'cnj', valor, criadoEm })
            r.processos.numeros.cnj++
          }
        }
        for (const q of requerimentos) {
          const valor = somenteDigitos(q.numeroProtocolo)
          if (valor.length < 5) continue
          if (protocolos.has(valor)) {
            r.processos.numeros.protocoloRepetido++
            continue
          }
          protocolos.add(valor)
          carga.identificadores.push({ id: idDoLegado('identificador', `protocolo:${valor}`), casoId: caso.id, tipo: 'protocolo_inss', valor, criadoEm: momentoDoLegado(q.der) ?? criadoEm })
          r.processos.numeros.protocolo++
        }

        // As decisões do INSS: dos requerimentos; sem requerimento, do resultado administrativo do benefício.
        const decisoes = new Set<string>()
        const decidir = (etapa: string | null | undefined, data: string | null | undefined, der: string | null | undefined, chaveAntiga: string) => {
          const resultado = etapa ? RESULTADO_DO_INSS[chave(etapa)] : undefined
          if (!resultado) return
          const movimentacao = movimentacoes.find((m) => chave(m.tipo ?? '') === (resultado === 'deferido' ? 'concessao do beneficio' : 'indeferimento administrativo'))
          const dia =
            diaDoLegado(data) ??
            diaDoLegado(resultado === 'deferido' ? beneficios[0]?.dataConcessao : beneficios[0]?.dataIndeferimentoAdministrativo) ??
            diaDoLegado(movimentacao?.data)
          if (!dia) {
            // O portal antigo não guardou a data da decisão: a decisão vai ao histórico, na data do requerimento (DER) ou
            // na do caso, com a descrição dizendo que a data não existia; `resultado_inss` exige a data e fica sem ela.
            r.resultadosInss.semData++
            evento(`${ACAO_LEGADO}inss_${resultado}_sem_data`, `caso:${caso.id}`, momentoDoLegado(der) ?? criadoEm, { casoId: caso.id, resultado, etapa }, chaveAntiga)
            return
          }
          if (decisoes.has(`${resultado}:${dia}`)) return
          decisoes.add(`${resultado}:${dia}`)
          carga.resultados.push({ id: idDoLegado('resultado', chaveAntiga), casoId: caso.id, resultado, dataDecisao: dia, criadoEm: momentoDoLegado(dia)! })
          r.resultadosInss[resultado]++
        }
        for (const q of requerimentos) decidir(q.etapa, q.dataDecisao, q.der, `requerimento:${q.id}`)
        if (!requerimentos.length) decidir(beneficios[0]?.resultadoAdministrativo, null, null, `beneficio:${p.id}`)

        for (const m of movimentacoes) {
          if (!m.tipo) continue
          const quando = momentoDoLegado(m.data) ?? momentoDoLegado(m.criadoEm) ?? criadoEm
          evento(`${ACAO_LEGADO}${slug(m.tipo)}`, `caso:${caso.id}`, quando, { casoId: caso.id, de: m.statusAnterior, para: m.statusNovo }, m.id)
        }
      }
    }
    if (!casosDaPessoa.length) r.clientes.semProcesso++

    // A agenda: as perícias viram perícias do caso; o resto (visita, CadÚnico, audiência) fica no histórico.
    const agenda = u.backups.flatMap((b) => [...(ix.agendaPorCliente.get(b.id) ?? []), ...(ix.processosPorCliente.get(b.id) ?? []).flatMap((p) => ix.agendaPorProcesso.get(p.id) ?? [])])
    for (const a of agenda) {
      if (!a.tipo) continue
      const caso = (a.processoId && casoDoProcesso.get(a.processoId)) || (casosDaPessoa.length === 1 ? casosDaPessoa[0] : null)
      const alvo = caso ? `caso:${caso.id}` : `pessoa:${pessoa.id}`
      const quando = momentoDoLegado(a.dataHora) ?? momentoDoLegado(a.data) ?? pessoa.criadoEm
      const tipos = TIPOS_DE_PERICIA[chave(a.tipo)]
      const status = chave(a.status ?? '')
      if (!tipos || status === 'cancelada') {
        if (tipos) r.pericias.canceladas++
        evento(`${ACAO_LEGADO}${tipos ? 'pericia_cancelada' : `agenda_${slug(a.tipo)}`}`, alvo, quando, { ...(caso && { casoId: caso.id }), tipo: a.tipo, status: a.status, local: a.local }, a.id)
        continue
      }
      if (!caso) {
        r.pericias.semProcesso++
        continue
      }
      const horaConhecida = !!momentoDoLegado(a.dataHora)
      const agendadaPara = momentoDoLegado(a.dataHora) ?? momentoDoLegado(a.data, '00:00')
      if (!agendadaPara) continue
      if (!horaConhecida) r.pericias.semHora++
      for (const tipo of tipos) {
        const favoravel = FAVORAVEL_DO_STATUS[status]
        const resultado = favoravel === tipo ? 'favoravel' : null
        const semDocumento: Omit<PericiaDaCarga, 'documento'> = {
          id: idDoLegado('pericia', `${a.id}:${tipo}`),
          casoId: caso.id,
          tipo,
          agendadaPara,
          local: texto(a.local),
          compareceu: COMPARECEU.has(status) ? true : null,
          resultado,
          criadoEm: agendadaPara,
        }
        const instancia = caso.fase === 'judicial' || (caso.fase === 'encerrado' && caso.desfecho && caso.desfecho !== 'deferido') ? 'juizo' : 'inss'
        carga.pericias.push({ ...semDocumento, documento: documentoDaPericia(semDocumento, pessoa.id, instancia, horaConhecida) })
        r.pericias[tipo]++
        if (resultado) r.pericias.comResultado++
        evento(`${ACAO_LEGADO}pericia_importada`, alvo, agendadaPara, { casoId: caso.id, tipo, status: a.status }, `${a.id}:${tipo}`)
      }
    }
  }
  r.processos.foraDeNaoAceitos = r.processos.lidos - r.processos.deAceitos
  return carga
}
