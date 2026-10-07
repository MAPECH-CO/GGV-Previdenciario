// DADOS DE EXEMPLO, só para o banco local da máquina do dev. Nenhuma pessoa é real, e os arquivos não existem.
// Senha de todos: SENHA_DE_EXEMPLO. Nunca rodar contra homologação nem produção.
import bcrypt from 'bcryptjs'
import { count } from 'drizzle-orm'
import type { Banco } from './conexao.ts'
import { chaveDoCofre, criarCofre } from '../cofre.ts'
import { caso, configuracao, contrato, credencialGovbr, decisao, documento, etapa, exigencia, exigenciaItem, identificadorCaso, modelo, parecerMedico, pessoa, publicacao, resultadoInss, rodadaVigilia, tarefa, tentativa, usuario } from './esquema.ts'
import { encaminhar } from '../vigilia/encaminhar.ts'
import { CNJ_EXEMPLO } from '../vigilia/fontes.ts'
import { momentoDoHorario } from '../vigilia/rodadas.ts'

export const SENHA_DE_EXEMPLO = 'exemplo-ggv-2026'

export const usuariosDeExemplo = [
  { email: 'atendimento@exemplo.ggv', nome: 'Ana (exemplo)', perfis: ['atendimento'], trocarSenha: false },
  { email: 'provisoria@exemplo.ggv', nome: 'Bia (exemplo, senha provisória)', perfis: ['atendimento'], trocarSenha: true },
  { email: 'semperfil@exemplo.ggv', nome: 'Caio (exemplo, sem perfil)', perfis: [], trocarSenha: false },
  { email: 'trava@exemplo.ggv', nome: 'Davi (exemplo, para testar a trava)', perfis: ['atendimento'], trocarSenha: false },
  { email: 'lider@exemplo.ggv', nome: 'Eva (exemplo, líder e atendimento)', perfis: ['atendimento_lider', 'atendimento'], trocarSenha: false },
  { email: 'documentacao@exemplo.ggv', nome: 'Fábio (exemplo)', perfis: ['documentacao'], trocarSenha: false },
  { email: 'advogada@exemplo.ggv', nome: 'Gabi (exemplo)', perfis: ['advogada'], trocarSenha: false },
  { email: 'senior@exemplo.ggv', nome: 'Helena (exemplo)', perfis: ['senior'], trocarSenha: false },
  { email: 'juridico@exemplo.ggv', nome: 'Igor (exemplo)', perfis: ['juridico_adm'], trocarSenha: false },
  { email: 'financeiro@exemplo.ggv', nome: 'Júlia (exemplo)', perfis: ['financeiro'], trocarSenha: false },
  { email: 'socio@exemplo.ggv', nome: 'Lauro (exemplo)', perfis: ['socio'], trocarSenha: false },
]

/** Casos de exemplo da Via administrativa (GGVP-8): já aprovados pela Sênior, prontos para protocolar e decidir perícia. */
const casosDeExemplo = [
  { nome: 'Maria Souza (exemplo)', beneficio: 'bpc_loas_deficiente', senhaGov: 'gov-maria-exemplo' },
  { nome: 'José Ramos (exemplo)', beneficio: 'aposentadoria_pcd', senhaGov: 'gov-jose-exemplo' },
  { nome: 'Lúcia Prado (exemplo)', beneficio: 'auxilio_incapacidade_temporaria', senhaGov: null },
] as const

const DOCUMENTOS_DE_EXEMPLO = ['RG e CPF', 'Comprovante de residência', 'Procuração assinada', 'Contrato assinado', 'Laudo médico']

/** Só semeia banco vazio: não mexe em quem já existe. */
export async function semearExemplos(banco: Banco) {
  const [{ total }] = await banco.select({ total: count() }).from(usuario)
  if (total > 0) return
  const senhaHash = await bcrypt.hash(SENHA_DE_EXEMPLO, 10)
  const usuarios = await banco
    .insert(usuario)
    .values(usuariosDeExemplo.map((u) => ({ ...u, senhaHash })))
    .returning()
  const senior = usuarios.find((u) => u.perfis.includes('senior'))!
  const cofre = criarCofre(chaveDoCofre())

  for (const [i, ex] of casosDeExemplo.entries()) {
    const [p] = await banco.insert(pessoa).values({ nome: ex.nome, situacao: 'cliente', origem: 'exemplo' }).returning()
    const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: ex.beneficio, fase: 'administrativa' }).returning()
    for (const [j, nome] of DOCUMENTOS_DE_EXEMPLO.entries())
      await banco.insert(documento).values({
        casoId: c.id,
        pessoaId: p.id,
        tipo: nome.toLowerCase().replaceAll(' ', '_'),
        sensivel: nome === 'Laudo médico',
        chaveArmazenamento: `exemplo/${c.id}/${j}`,
        nomeOriginal: `${nome} (exemplo).pdf`,
        mime: 'application/pdf',
        tamanho: 0,
        hashSha256: 'exemplo',
        origem: 'exemplo',
        criadoEm: new Date(Date.UTC(2026, 8, 20 + i, 12, j)),
      })
    if (ex.senhaGov) await banco.insert(credencialGovbr).values({ pessoaId: p.id, ...cofre.cifrar(ex.senhaGov) })
    await banco.insert(decisao).values({ casoId: c.id, passo: 'D2.01', tipo: 'aprovacao_inss', resultado: 'aprovado', decididoPor: senior.id, perfil: 'senior' })
    await banco.insert(tarefa).values([
      { casoId: c.id, passo: 'D2.02', titulo: 'Protocolar no Meu INSS', perfilDono: 'juridico_adm' },
      { casoId: c.id, passo: 'D2.03', titulo: 'Decidir perícia', perfilDono: 'advogada' },
    ])
  }

  // Casos esperando a conferência da Sênior (GGVP-23): um pronto para aprovar (pensão por morte, em destaque)
  // e um sem parecer médico, que o servidor barra até a dispensa justificada (G17).
  for (const ex of [
    { nome: 'Antônia Lima (exemplo)', beneficio: 'pensao_morte', parecer: 'suficiente' as const },
    { nome: 'Benedito Alves (exemplo)', beneficio: 'auxilio_acidente', parecer: null },
  ]) {
    const [p] = await banco.insert(pessoa).values({ nome: ex.nome, situacao: 'cliente', origem: 'exemplo' }).returning()
    const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: ex.beneficio, fase: 'atendimento' }).returning()
    for (const [j, nome] of DOCUMENTOS_DE_EXEMPLO.entries())
      await banco.insert(documento).values({
        casoId: c.id,
        pessoaId: p.id,
        tipo: nome.toLowerCase().replaceAll(' ', '_'),
        sensivel: nome === 'Laudo médico',
        chaveArmazenamento: `exemplo/${c.id}/${j}`,
        nomeOriginal: `${nome} (exemplo).pdf`,
        mime: 'application/pdf',
        tamanho: 0,
        hashSha256: 'exemplo',
        origem: 'exemplo',
      })
    if (ex.parecer)
      await banco.insert(parecerMedico).values({
        casoId: c.id,
        roteiroVersao: 1,
        resultado: ex.parecer,
        itens: [
          { item: 'Natureza do impedimento', atendido: true },
          { item: 'Data de início', atendido: true },
          { item: 'Limitações funcionais', atendido: true },
        ],
      })
    await banco.insert(tarefa).values({ casoId: c.id, passo: 'D2.01', titulo: 'Conferir antes do INSS', perfilDono: 'senior' })
  }

  // Casos em vigília, esperando o INSS (GGVP-35 e GGVP-48): um para cada resposta (deferido, indeferido e exigência) e
  // um para o caminho do indeferido até o protocolo da petição inicial (GGVP-9, grupo 3).
  // CPFs de exemplo, válidos só nos dígitos verificadores, para a trava do CPF da petição (GGVP-71).
  const cpfs = ['27183946509', '38492715600', '52916384782', '61374825964']
  for (const [i, nome] of ['Rita Gomes (exemplo)', 'Sebastião Cruz (exemplo)', 'Teresa Dias (exemplo)', 'Vicente Prado (exemplo)'].entries()) {
    const [p] = await banco.insert(pessoa).values({ nome, cpf: cpfs[i], situacao: 'cliente', origem: 'exemplo' }).returning()
    const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_idoso', fase: 'administrativa' }).returning()
    await banco
      .insert(etapa)
      .values({ casoId: c.id, diagrama: 'D2', passo: 'D2.04', situacao: 'aguardando_externo', aguardando: 'INSS decidir', iniciadaEm: new Date(Date.UTC(2026, 8, 25 + i, 12)) })
    await banco.insert(tarefa).values({ casoId: c.id, passo: 'D2.04', titulo: 'Trazer a resposta do INSS', perfilDono: 'advogada' })
  }

  // Exigência do INSS (GGVP-39): limites de cobrança do escritório (Q1, exemplo) e um caso esperando a advogada decidir.
  await banco.insert(configuracao).values([
    { chave: 'cobranca.limite', valor: 3 },
    { chave: 'cobranca.intervalo_dias', valor: 3 }, // dias úteis entre as tentativas (Lucas, 02/10; GGVP-94)
  ])
  const [pu] = await banco.insert(pessoa).values({ nome: 'Ulisses Rocha (exemplo)', situacao: 'cliente', origem: 'exemplo' }).returning()
  const [cu] = await banco.insert(caso).values({ pessoaId: pu.id, beneficio: 'bpc_loas_deficiente', fase: 'administrativa' }).returning()
  await banco.insert(etapa).values({ casoId: cu.id, diagrama: 'D2', passo: 'D2.04', situacao: 'aguardando_externo', aguardando: 'INSS decidir', iniciadaEm: new Date() })
  await banco.insert(exigencia).values({
    casoId: cu.id,
    origem: 'inss',
    descricao: 'Apresentar a inscrição no CadÚnico atualizada e o comprovante de renda de todos que moram na casa. (exemplo)',
    recebidaEm: new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10),
  })
  await banco.insert(tarefa).values([
    { casoId: cu.id, passo: 'D2.04', titulo: 'Trazer a resposta do INSS', perfilDono: 'advogada' },
    { casoId: cu.id, passo: 'D2.05', titulo: 'Tratar exigência do INSS', perfilDono: 'advogada' },
  ])

  // Benefício deferido (GGVP-44): modelo da confirmação, contrato com 30% e um caso com "Prestar contas" e a carta.
  await banco.insert(modelo).values({
    tipo: 'mensagem',
    nome: 'Confirmação da ida ao banco',
    conteudo: 'Olá, {cliente}! Seu benefício foi concedido. A ida ao banco está marcada para {data}, às {hora}, em {local}. {acompanhamento} Qualquer dúvida, fale com o escritório. (modelo de exemplo)',
  })
  const advogada = usuarios.find((u) => u.perfis.includes('advogada'))!
  const [pv] = await banco.insert(pessoa).values({ nome: 'Vera Lúcia (exemplo)', situacao: 'cliente', origem: 'exemplo' }).returning()
  const [cv] = await banco.insert(caso).values({ pessoaId: pv.id, beneficio: 'bpc_loas_idoso', fase: 'administrativa' }).returning()
  await banco.insert(contrato).values({ casoId: cv.id, situacao: 'assinado', percentualHonorarios: '30.00' })
  const [carta] = await banco
    .insert(documento)
    .values({
      casoId: cv.id,
      pessoaId: pv.id,
      tipo: 'comunicacao_inss',
      chaveArmazenamento: `exemplo/${cv.id}/carta`,
      nomeOriginal: 'Carta de concessão (exemplo).pdf',
      mime: 'application/pdf',
      tamanho: 0,
      hashSha256: 'exemplo',
      origem: 'exemplo',
    })
    .returning()
  await banco.insert(resultadoInss).values({ casoId: cv.id, resultado: 'deferido', dataDecisao: new Date().toISOString().slice(0, 10), documentoId: carta.id, registradoPor: advogada.id })
  await banco.insert(tarefa).values({ casoId: cv.id, passo: 'D2.06', titulo: 'Prestar contas', perfilDono: 'advogada', evidenciaDocumentoId: carta.id })

  // Vigília do diário (GGVP-26, 30, 34, 37, 74): dois processos judiciais com número CNJ, que a fonte de exemplo
  // reconhece, e a rodada das 08:00 de hoje com falha: reprocessar traz as publicações de exemplo do dia.
  for (const [nome, cnj] of [
    ['Otávio Lima (exemplo)', CNJ_EXEMPLO.exigencia],
    ['Rosa Amaral (exemplo)', CNJ_EXEMPLO.merito],
  ] as const) {
    const [pj] = await banco.insert(pessoa).values({ nome, situacao: 'cliente', origem: 'exemplo' }).returning()
    const [cj] = await banco.insert(caso).values({ pessoaId: pj.id, beneficio: 'bpc_loas_deficiente', fase: 'judicial' }).returning()
    await banco.insert(identificadorCaso).values({ casoId: cj.id, tipo: 'cnj', valor: cnj })
  }
  const hojeBr = new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10)
  await banco.insert(rodadaVigilia).values({
    fonte: 'exemplo',
    previstaPara: momentoDoHorario(hojeBr, '08:00'),
    inicio: momentoDoHorario(hojeBr, '08:00'),
    fim: momentoDoHorario(hojeBr, '08:01'),
    situacao: 'falhou',
    erro: 'tempo esgotado: a fonte não respondeu em 60 s (exemplo)',
  })

  // Exigência do juiz (GGVP-79, 83, 87): uma intimação já lida e classificada, esperando a advogada distribuir.
  const [pp] = await banco.insert(pessoa).values({ nome: 'Paulo Reis (exemplo)', situacao: 'cliente', origem: 'exemplo' }).returning()
  const [cp] = await banco.insert(caso).values({ pessoaId: pp.id, beneficio: 'aposentadoria_pcd', fase: 'judicial' }).returning()
  const cnjPaulo = '00077771820264036301'
  await banco.insert(identificadorCaso).values({ casoId: cp.id, tipo: 'cnj', valor: cnjPaulo })
  const [intimacao] = await banco
    .insert(publicacao)
    .values({
      fonte: 'exemplo',
      numeroCnj: cnjPaulo,
      casoId: cp.id,
      disponibilizadaEm: hojeBr,
      texto: 'Intime-se a parte autora para, em 15 dias, juntar laudo médico atualizado e cópia integral da carteira de trabalho. (exemplo)',
      hash: `exemplo-${cp.id}`,
      classe: 'exigencia',
      revisadaPor: advogada.id,
      revisadaEm: new Date(),
    })
    .returning()
  await banco.transaction((tx) => encaminhar(tx, intimacao, 'exigencia', 15, new Date()))

  // Petição inicial (GGVP-63, 67, 71): o tribunal do protocolo, com o site e o tamanho por arquivo (Q8: o escritório
  // confirma na configuração), e a assinatura padrão da petição. Valores de exemplo.
  await banco.insert(configuracao).values([
    { chave: 'tribunais', valor: [{ nome: 'Justiça Federal da 3ª Região (exemplo)', site: 'https://www.trf3.jus.br/', tamanhoMaximoMb: 10 }] },
    { chave: 'peticao.assinatura', valor: 'Glauco (exemplo)\nAdvogado responsável · OAB/UF 000.000 (exemplo)' },
  ])

  // Laço que passou do limite (GGVP-94): a Documentação cobrou 3 vezes sem retorno, e a cobrança subiu para a Sênior.
  const documentacao = usuarios.find((u) => u.perfis.includes('documentacao'))!
  const daqui = (dias: number) => new Date(Date.now() + dias * 86_400_000).toISOString().slice(0, 10)
  const [pw] = await banco.insert(pessoa).values({ nome: 'Wagner Costa (exemplo)', situacao: 'cliente', origem: 'exemplo' }).returning()
  const [cw] = await banco.insert(caso).values({ pessoaId: pw.id, beneficio: 'bpc_loas_idoso', fase: 'administrativa' }).returning()
  const [xw] = await banco
    .insert(exigencia)
    .values({ casoId: cw.id, origem: 'inss', descricao: 'Apresentar o CadÚnico atualizado. (exemplo)', recebidaEm: daqui(-10), pede: 'documentos', diasInss: 30, prazo: daqui(20), analisadaPor: advogada.id })
    .returning()
  const [cartao] = await banco
    .insert(tarefa)
    .values({ casoId: cw.id, passo: 'D2.05d', titulo: 'Cumprir exigência do INSS', perfilDono: 'documentacao', prazo: daqui(1), tentativas: 3, limiteTentativas: 3, escaladaEm: new Date(), escaladaPara: 'senior' })
    .returning()
  await banco.insert(exigenciaItem).values({ exigenciaId: xw.id, descricao: 'CadÚnico atualizado', perfilResponsavel: 'documentacao', prazo: daqui(15) })
  await banco
    .insert(tentativa)
    .values([-6, -3, -1].map((d) => ({ tarefaId: cartao.id, quando: new Date(Date.now() + d * 86_400_000), canal: 'whatsapp', resultado: 'sem_resposta', registradaPor: documentacao.id })))
  await banco.insert(tarefa).values({ casoId: cw.id, passo: 'D2.05', titulo: 'Cobrança sem retorno: exigência do INSS', perfilDono: 'senior' })
  await banco.insert(etapa).values({ casoId: cw.id, diagrama: 'D2', passo: 'D2.E3', situacao: 'aguardando_externo', aguardando: 'cliente entregar o documento', iniciadaEm: new Date() })
}
