// O legado do portal antigo (16/10, pedido do Mateus): a leitura do projeto "Portal Operacional" do Supabase, que guarda o
// portal antigo em dois schemas: `zz_backup_operational` (a exportação do Airtable de 20/08, com clientes, processos,
// benefícios, requerimentos, agenda e movimentações) e `juridico` (a versão limpa de 22/08, só clientes, com o status
// mais novo e o código CLI). Só leitura: nenhuma consulta aqui escreve. Dado pessoal passa por aqui e vai ao portal novo;
// nunca ao registro do servidor nem ao repositório.
import { Client } from 'pg'

export type ClienteDoBackup = {
  id: string
  nome: string | null
  cpf: string | null
  dataNascimento: string | null
  status: string | null
  motivoNaoAceite: string | null
  email: string | null
  telefone1: string | null
  telefone2: string | null
  cep: string | null
  endereco: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  dataContrato: string | null
  pessoasNaCasa: number | null
  rendaFamiliar: number | null
  drivePastaId: string | null
  criadoEm: string | null
}
export type ClienteDoJuridico = {
  id: number
  codigo: string
  nome: string | null
  cpf: string | null
  status: string | null
  statusLegado: string | null
  dataNascimento: string | null
  email: string | null
  telefone1: string | null
  telefone2: string | null
  cep: string | null
  logradouro: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  dataContrato: string | null
  pessoasNaCasa: number | null
  rendaFamiliarCentavos: number | null
  drivePastaId: string | null
  criadoEm: string | null
}
export type ProcessoDoBackup = {
  id: string
  clienteId: string
  area: string | null
  etapaAtual: string | null
  statusGeral: string | null
  numeroCnj: string | null
  dataProtocoloJudicial: string | null
  dataEntradaJudicial: string | null
  vara: string | null
  valorCausa: number | null
  vias: string[] | null
  criadoEm: string | null
  atualizadoEm: string | null
}
export type BeneficioDoProcesso = {
  processoId: string
  nome: string | null
  ordem: number | null
  ativo: boolean | null
  resultadoAdministrativo: string | null
  dataIndeferimentoAdministrativo: string | null
  resultadoJudicial: string | null
  dataConcessao: string | null
  dataIndeferimentoJudicial: string | null
}
export type RequerimentoDoBackup = {
  id: string
  processoId: string
  tipo: string | null
  numeroProtocolo: string | null
  der: string | null
  etapa: string | null
  dataDecisao: string | null
  criadoEm: string | null
  atualizadoEm: string | null
}
export type EventoDaAgenda = { id: string; clienteId: string | null; processoId: string | null; tipo: string | null; data: string | null; dataHora: string | null; status: string | null; local: string | null }
export type MovimentacaoDoBackup = { id: string; processoId: string; tipo: string | null; data: string | null; statusAnterior: string | null; statusNovo: string | null; criadoEm: string | null }
export type CaptacaoDoBackup = { clienteId: string; canal: string | null; fonteTipo: string | null; fonteNome: string | null; data: string | null }

export type Legado = {
  clientesDoBackup: ClienteDoBackup[]
  clientesDoJuridico: ClienteDoJuridico[]
  processos: ProcessoDoBackup[]
  beneficios: BeneficioDoProcesso[]
  requerimentos: RequerimentoDoBackup[]
  agenda: EventoDaAgenda[]
  movimentacoes: MovimentacaoDoBackup[]
  captacoes: CaptacaoDoBackup[]
}

/** As consultas, uma por tabela, com as colunas já no nome que o transformador usa. Datas como texto AAAA-MM-DD. */
export const CONSULTAS: Record<keyof Legado, string> = {
  clientesDoBackup: `
    select c.cliente_id::text as "id", c.nome, c.cpf, c.data_nascimento::text as "dataNascimento", c.status_cliente as "status",
           c.motivo_nao_aceite as "motivoNaoAceite", c.email, c.telefone_1 as "telefone1", c.telefone_2 as "telefone2", c.cep, c.endereco,
           c.bairro, c.cidade, c.uf, c.data_assinatura_contrato::text as "dataContrato", c.pessoas_na_casa as "pessoasNaCasa",
           c.renda_familiar::float as "rendaFamiliar", c.drive_folder_id as "drivePastaId", c.created_at::text as "criadoEm"
      from zz_backup_operational.clientes c
     where c.arquivado_em is null
     order by c.cliente_id`,
  clientesDoJuridico: `
    select j.id, j.codigo, j.nome, j.cpf, j.status, j.status_legado as "statusLegado", j.data_nascimento as "dataNascimento", j.email,
           j.telefone_1 as "telefone1", j.telefone_2 as "telefone2", j.cep, j.logradouro, j.bairro, j.cidade, j.uf,
           j.data_assinatura_contrato as "dataContrato", j.pessoas_na_casa as "pessoasNaCasa", j.renda_familiar_centavos as "rendaFamiliarCentavos",
           j.drive_folder_id as "drivePastaId", j.criado_em as "criadoEm"
      from juridico.clientes j
     order by j.id`,
  processos: `
    select p.processo_id::text as "id", p.cliente_id::text as "clienteId", p.area, p.etapa_atual as "etapaAtual", p.status_geral as "statusGeral",
           p.numero_processo_judicial as "numeroCnj", p.data_protocolo_judicial::text as "dataProtocoloJudicial", p.data_entrada_judicial::text as "dataEntradaJudicial",
           p.vara_gabinete_agencia as "vara", p.valor_causa::float as "valorCausa", p.vias_presentes as "vias", p.created_at::text as "criadoEm", p.updated_at::text as "atualizadoEm"
      from zz_backup_operational.processos p
     order by p.processo_id`,
  beneficios: `
    select pb.processo_id::text as "processoId", t.nome, pb.ordem, pb.ativo, pb.resultado_administrativo as "resultadoAdministrativo",
           pb.data_indeferimento_administrativo::text as "dataIndeferimentoAdministrativo", pb.resultado_judicial as "resultadoJudicial",
           pb.data_concessao::text as "dataConcessao", pb.data_indeferimento_judicial::text as "dataIndeferimentoJudicial"
      from zz_backup_operational.processo_beneficios pb
      left join zz_backup_operational.tipos_beneficio t on t.tipo_beneficio_id = pb.tipo_beneficio_id
     order by pb.processo_id, pb.ordem`,
  requerimentos: `
    select r.requerimento_id::text as "id", r.processo_id::text as "processoId", r.tipo_requerimento as "tipo", r.numero_protocolo as "numeroProtocolo",
           r.der::text as "der", r.etapa_atual as "etapa", r.data_decisao::text as "dataDecisao", r.created_at::text as "criadoEm", r.updated_at::text as "atualizadoEm"
      from zz_backup_operational.requerimentos_administrativos r
     order by r.requerimento_id`,
  agenda: `
    select a.evento_id::text as "id", a.cliente_id::text as "clienteId", a.processo_id::text as "processoId", a.tipo_evento as "tipo",
           a.data_evento::text as "data", a.data_hora::text as "dataHora", a.status_evento as "status", a.local
      from zz_backup_operational.agenda_eventos a
     where a.arquivado_em is null
     order by a.evento_id`,
  movimentacoes: `
    select m.movimentacao_id::text as "id", m.processo_id::text as "processoId", m.tipo_movimentacao as "tipo", m.data_movimentacao::text as "data",
           m.status_anterior as "statusAnterior", m.status_novo as "statusNovo", m.created_at::text as "criadoEm"
      from zz_backup_operational.movimentacoes m
     order by m.data_movimentacao, m.created_at`,
  captacoes: `
    select c.cliente_id::text as "clienteId", c.canal_origem as "canal", c.fonte_tipo as "fonteTipo", c.fonte_nome as "fonteNome", c.data_captacao::text as "data"
      from zz_backup_operational.captacoes c
     order by c.data_captacao`,
}

/** Lê tudo do banco antigo, pela URL dele (LEGADO_DATABASE_URL); nada é gravado lá. */
export async function extrair(url: string): Promise<Legado> {
  const cliente = new Client({ connectionString: url })
  await cliente.connect()
  try {
    const legado: Partial<Legado> = {}
    for (const [nome, consulta] of Object.entries(CONSULTAS) as [keyof Legado, string][]) legado[nome] = (await cliente.query(consulta)).rows
    return legado as Legado
  } finally {
    await cliente.end()
  }
}
