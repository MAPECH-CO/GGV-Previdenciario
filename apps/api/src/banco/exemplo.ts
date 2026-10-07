// DADOS DE EXEMPLO, só para o banco local da máquina do dev. Nenhuma pessoa é real, e os arquivos não existem.
// Senha de todos: SENHA_DE_EXEMPLO. Nunca rodar contra homologação nem produção.
import bcrypt from 'bcryptjs'
import { count, eq } from 'drizzle-orm'
import type { Banco } from './conexao.ts'
import { chaveDoCofre, criarCofre } from '../cofre.ts'
import { caso, configuracao, contrato, credencialGovbr, decisao, documento, etapa, exigencia, modelo, parecerMedico, pessoa, resultadoInss, tarefa, usuario } from './esquema.ts'

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
  // GGVP-126 CA4: "vazio" é sem os usuários de exemplo; a homologação já tem o usuário de quem cuida dela.
  const [{ total }] = await banco.select({ total: count() }).from(usuario).where(eq(usuario.email, usuariosDeExemplo[0].email))
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

  // Casos em vigília, esperando o INSS (GGVP-35 e GGVP-48): um para cada resposta (deferido, indeferido e exigência).
  for (const [i, nome] of ['Rita Gomes (exemplo)', 'Sebastião Cruz (exemplo)', 'Teresa Dias (exemplo)'].entries()) {
    const [p] = await banco.insert(pessoa).values({ nome, situacao: 'cliente', origem: 'exemplo' }).returning()
    const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_idoso', fase: 'administrativa' }).returning()
    await banco
      .insert(etapa)
      .values({ casoId: c.id, diagrama: 'D2', passo: 'D2.04', situacao: 'aguardando_externo', aguardando: 'INSS decidir', iniciadaEm: new Date(Date.UTC(2026, 8, 25 + i, 12)) })
    await banco.insert(tarefa).values({ casoId: c.id, passo: 'D2.04', titulo: 'Trazer a resposta do INSS', perfilDono: 'advogada' })
  }

  // Exigência do INSS (GGVP-39): limites de cobrança do escritório (Q1, exemplo) e um caso esperando a advogada decidir.
  await banco.insert(configuracao).values([
    { chave: 'cobranca.limite', valor: 2 },
    { chave: 'cobranca.intervalo_dias', valor: 3 },
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
}
