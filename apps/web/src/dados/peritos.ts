// EXEMPLO. Os peritos e o perfil de cada um, formado dos laudos do acervo. Ponta para ligar com a GGVP-59 (jurimetria do
// perito, Mateus, ainda sem refino) e com o acervo de processos, de onde vem o perito nomeado. Nomes "(exemplo)": nenhum é
// real. O perfil não guarda dado pessoal do cliente (GGVP-73, CA4): cada laudo tem só a referência do caso.
import { jurimetria, type Jurimetria, type TipoDePericia } from '../regras/pericia.ts'

/** Um laudo do acervo no perfil do perito: o que ele observou, perguntou e pediu. Sem nome nem CPF do cliente. */
export type LaudoDoPerfil = {
  id: string
  /** A referência do caso no acervo, nunca o nome do cliente (GGVP-73, CA4). */
  caso: string
  /** aaaa-mm-dd */
  data: string
  tipo: TipoDePericia
  /** O assunto do laudo, para os números por assunto (G22). */
  assunto: string
  resultado: 'favoravel' | 'desfavoravel'
  /** Dias da perícia até o laudo. */
  dias: number
  observou: string[]
  perguntou: string[]
  pediu: string[]
}

export type Perito = {
  id: string
  nome: string
  /** "Perito judicial · ortopedia". */
  especialidade: string
  tipo: TipoDePericia
  /** Onde costuma atuar. */
  onde: string
  /** O perfil: um laudo por linha, sem sobrescrever (GGVP-73, CA3). A versão é quantos laudos formam o perfil. */
  laudos: LaudoDoPerfil[]
}

/** O perfil resumido: o que mais aparece nos laudos (a IA só resume; os números são do sistema). */
export type PerfilDoPerito = {
  perito: Perito
  versao: number
  jurimetria: Jurimetria
  porAssunto: { assunto: string; jurimetria: Jurimetria }[]
  observou: string[]
  perguntou: string[]
  pediu: string[]
}

/** Laudos de exemplo: o resultado e o assunto se alternam pela posição, para os números sairem do código. */
function laudos(
  perito: string,
  tipo: TipoDePericia,
  quantos: number,
  favoraveis: number,
  assuntos: string[],
  conteudo: Pick<LaudoDoPerfil, 'observou' | 'perguntou' | 'pediu'>[],
): LaudoDoPerfil[] {
  return Array.from({ length: quantos }, (_, i) => {
    const mes = String(1 + (i % 9)).padStart(2, '0')
    return {
      id: `laudo-${perito}-${i + 1}`,
      caso: `acervo-${perito}-${String(i + 1).padStart(3, '0')}`,
      data: `2026-${mes}-${String(5 + (i % 20)).padStart(2, '0')}`,
      tipo,
      assunto: assuntos[i % assuntos.length],
      // Os primeiros `favoraveis` saem favoráveis, os outros não: a taxa vem da contagem.
      resultado: i < favoraveis ? 'favoravel' : 'desfavoravel',
      dias: 14 + (i % 9),
      ...conteudo[i % conteudo.length],
    }
  })
}

/** A semente: um perito judicial com perfil forte, um do INSS com amostra pequena e uma assistente social do INSS. */
export function peritosDeExemplo(): Perito[] {
  return [
    {
      id: 'a-prado',
      nome: 'Dr. A. Prado (exemplo)',
      especialidade: 'Perito judicial · ortopedia',
      tipo: 'medica',
      onde: 'Vara Federal de Santo Amaro (exemplo)',
      laudos: laudos('a-prado', 'medica', 34, 24, ['ombro e joelho', 'ombro e joelho', 'ombro e joelho', 'coluna'], [
        {
          observou: ['como a pessoa senta, levanta e anda', 'se os laudos e receitas cobrem os últimos 12 meses'],
          perguntou: ['quanto tempo a pessoa aguenta sentada e em pé', 'quais remédios usa e há quanto tempo'],
          pediu: ['laudos e receitas dos últimos 12 meses'],
        },
        {
          observou: ['o movimento do braço e da perna afetados'],
          perguntou: ['se tentou outra função no trabalho'],
          pediu: ['exames de imagem recentes'],
        },
      ]),
    },
    {
      id: 'r-menezes',
      nome: 'Dr. R. Menezes (exemplo)',
      especialidade: 'Perito médico do INSS',
      tipo: 'medica',
      onde: 'Agência INSS Santo Amaro (exemplo)',
      laudos: laudos('r-menezes', 'medica', 6, 3, ['coluna'], [
        { observou: ['a postura durante a conversa'], perguntou: ['como é o trabalho do dia a dia'], pediu: ['atestados de afastamento'] },
      ]),
    },
    {
      id: 'l-assis',
      nome: 'Sra. L. Assis (exemplo)',
      especialidade: 'Assistente social do INSS',
      tipo: 'social',
      onde: 'Agência INSS Penha (exemplo)',
      laudos: laudos('l-assis', 'social', 12, 8, ['renda familiar'], [
        {
          observou: ['quem mora na casa e a renda de cada um', 'as condições da moradia'],
          perguntou: ['quem ajuda nas despesas da casa', 'quais são os gastos com saúde'],
          pediu: ['CadÚnico atualizado', 'comprovantes de renda e de despesas'],
        },
      ]),
    },
  ]
}

/** Onde os peritos ficam: o banco de exemplo ou o que o servidor monta. */
export type ComPeritos = { peritos?: Perito[] }

/** Os peritos do banco; sem eles, a semente, que não vai para o armazenamento da aba até um laudo novo mudar um perfil (GGVP-73). */
export const peritosDo = (banco: ComPeritos): Perito[] => banco.peritos ?? peritosDeExemplo()

const sem = (nome: string) => nome.replace(/\s*\(exemplo\)$/, '').toLowerCase()

/** O perito pelo nome lido na publicação ou no processo; não reconhecido, nada (GGVP-61, CA6). */
export function reconhecerPerito(banco: ComPeritos, nome: string): Perito | undefined {
  return peritosDo(banco).find((p) => sem(p.nome) === sem(nome))
}

/** Os itens que mais aparecem, na ordem em que aparecem. */
function maisFrequentes(listas: string[][], quantos = 3): string[] {
  const conta = new Map<string, number>()
  for (const item of listas.flat()) conta.set(item, (conta.get(item) ?? 0) + 1)
  return [...conta.entries()].sort((a, b) => b[1] - a[1]).slice(0, quantos).map(([item]) => item)
}

/** O perfil do perito: a versão (quantos laudos), a jurimetria do sistema e o que a IA resume dos laudos. */
export function perfilDoPerito(perito: Perito): PerfilDoPerito {
  const assuntos = [...new Set(perito.laudos.map((l) => l.assunto))]
  return {
    perito,
    versao: perito.laudos.length,
    jurimetria: jurimetria(perito.laudos),
    porAssunto: assuntos.map((assunto) => ({ assunto, jurimetria: jurimetria(perito.laudos.filter((l) => l.assunto === assunto)) })),
    observou: maisFrequentes(perito.laudos.map((l) => l.observou)),
    perguntou: maisFrequentes(perito.laudos.map((l) => l.perguntou)),
    pediu: maisFrequentes(perito.laudos.map((l) => l.pediu)),
  }
}

/**
 * O laudo novo entra no perfil do perito (GGVP-73): um registro por laudo, sem sobrescrever (CA3) e sem duplicar (CA5).
 * Na primeira mudança, a semente vai para o banco. Devolve se entrou.
 */
export function acrescentarLaudo(banco: ComPeritos, peritoId: string, laudo: LaudoDoPerfil): boolean {
  const perito = (banco.peritos ??= peritosDeExemplo()).find((p) => p.id === peritoId)
  if (!perito) throw new Error('Perito não encontrado.')
  if (perito.laudos.some((l) => l.id === laudo.id)) return false
  perito.laudos.push(laudo)
  return true
}
