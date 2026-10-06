// DADOS DE EXEMPLO, só para o banco local da máquina do dev. Nenhuma pessoa é real, e os arquivos não existem.
// Senha de todos: SENHA_DE_EXEMPLO. Nunca rodar contra homologação nem produção.
import bcrypt from 'bcryptjs'
import { count } from 'drizzle-orm'
import type { Banco } from './conexao.ts'
import { chaveDoCofre, criarCofre } from '../cofre.ts'
import { caso, credencialGovbr, decisao, documento, pessoa, tarefa, usuario } from './esquema.ts'

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
}
