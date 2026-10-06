// EXEMPLO. Servidor de exemplo do cadastro do lead (GGVP-43), sobre o mesmo banco de servidor.ts. O cadastro completa a
// ficha do primeiro contato, nunca cria outra (CA9). Ligar no servidor: trocar o corpo de cada função por fetch no
// endpoint da design.md (change ggvp-6) e o ViaCEP simulado pelo de verdade.
import { buscarCep, normalizarCpf, type Endereco } from '../campos.ts'
import { cadastroDaFicha, errosDoCadastro, errosDoRepresentante, faltaParaOKit, fichaDoCadastro, mesclar, normalizarRg, ROTULOS_DO_CADASTRO } from '../regras/cadastro.ts'
import { hojeIso } from '../regras/datas.ts'
import { fichaComCpf } from '../regras/duplicidade.ts'
import { QUEM_ADVOGADA, agora, esperar, evento, gravar, ler } from './servidor.ts'
import type { Cadastro, Ficha, InformacaoExtraida, PedidoDeCadastro, RespostaDoCadastro } from './tipos.ts'

/** GET /api/fichas/:id/cadastro. A ficha e o que a IA tirou das entrevistas transcritas (CA1, CA8). */
export async function obterCadastro(fichaId: string): Promise<{ ficha: Ficha; extraidas: InformacaoExtraida[] } | null> {
  const banco = ler()
  const ficha = banco.fichas.find((f) => f.id === fichaId)
  if (!ficha) return null
  const extraidas = banco.gravacoes.filter((g) => g.fichaId === fichaId && g.transcricao === 'pronta').flatMap((g) => g.extraidas)
  return { ficha, extraidas }
}

/** "Estado civil" → "estado civil"; sigla fica: "RG", "CEP". */
const minusculo = (rotulo: string) => (rotulo === rotulo.toUpperCase() ? rotulo : rotulo.charAt(0).toLowerCase() + rotulo.slice(1))

/**
 * PUT /api/fichas/:id/cadastro. Valida de novo; CPF de outra ficha não grava (CA2); mescla com o que outra pessoa salvou
 * (CA11); cada campo alterado vai ao histórico com o valor anterior (CA7).
 */
export async function salvarCadastro(fichaId: string, pedido: PedidoDeCadastro): Promise<RespostaDoCadastro> {
  await esperar()
  const hoje = hojeIso(agora())
  const invalido =
    Object.keys(errosDoCadastro(pedido.valores, hoje)).length > 0 ||
    (pedido.representante !== undefined && Object.keys(errosDoRepresentante(pedido.representante)).length > 0)
  if (invalido) throw new Error('Cadastro incompleto ou inválido')
  const banco = ler()
  const ficha = banco.fichas.find((f) => f.id === fichaId)
  if (!ficha) throw new Error('Ficha não encontrada')
  const dono = fichaComCpf(banco.fichas, pedido.valores.cpf)
  if (dono && dono.id !== fichaId) return { resultado: 'cpf-de-outra-ficha', id: dono.id, nome: dono.nome }

  // Compara na mesma forma: "12.345.678-9" digitado e "123456789" salvo são o mesmo RG.
  const forma = (c: Cadastro) => cadastroDaFicha({ ...ficha, ...fichaDoCadastro(c) })
  const atual = cadastroDaFicha(ficha)
  const meu = forma(pedido.valores)
  const { valores, conflitos } = mesclar(forma(pedido.base), meu, atual)
  if (conflitos.length > 0) return { resultado: 'conflito', campos: conflitos.map((campo) => ({ campo, deles: atual[campo], meu: meu[campo] })) }

  const primeiraVez = !ficha.historico.some((e) => e.oQue.startsWith('Cadastrou o lead'))
  // A profissão e o estado civil antigos, fora da lista, vão ao histórico como estavam.
  const antes = { ...atual, profissao: ficha.profissao ?? '', estadoCivil: ficha.estadoCivil ?? '' }
  Object.assign(ficha, fichaDoCadastro(valores))
  const depois = cadastroDaFicha(ficha)
  const registros = (Object.keys(ROTULOS_DO_CADASTRO) as (keyof Cadastro)[])
    .filter((c) => atual[c] !== depois[c])
    .map((c) => evento(`Alterou ${minusculo(ROTULOS_DO_CADASTRO[c])}: «${antes[c] || '—'}» → «${depois[c]}»`, QUEM_ADVOGADA))
  const representante = pedido.representante && { ...pedido.representante, cpf: normalizarCpf(pedido.representante.cpf), rg: normalizarRg(pedido.representante.rg) }
  if (JSON.stringify(representante) !== JSON.stringify(ficha.representante)) {
    const antes = ficha.representante ? `${ficha.representante.nome} (${ficha.representante.parentesco})` : '—'
    const agoraE = representante ? `${representante.nome} (${representante.parentesco})` : '—'
    registros.push(evento(`Alterou o representante legal: «${antes}» → «${agoraE}»`, QUEM_ADVOGADA))
    ficha.representante = representante
  }
  if (primeiraVez) registros.unshift(evento('Cadastrou o lead (D1.10): completou a mesma ficha do primeiro contato', QUEM_ADVOGADA))
  ficha.historico.push(...registros)
  const tarefa = banco.tarefas.find((t) => t.id === `cadastrar-${ficha.id}`)
  if (tarefa) tarefa.concluida = true
  gravar(banco)
  return { resultado: 'salvo', ficha }
}

/** GET /api/fichas/:id/kit. O kit do benefício (D1.15, D1.16) só com os campos do modelo do contrato (CA4). */
export async function podeGerarKit(fichaId: string): Promise<{ pode: boolean; falta: string[] }> {
  const ficha = ler().fichas.find((f) => f.id === fichaId)
  if (!ficha) throw new Error('Ficha não encontrada')
  const falta = faltaParaOKit(ficha)
  return { pode: falta.length === 0, falta }
}

/** EXEMPLO. O ViaCEP simulado: só o CEP do exemplo do próprio ViaCEP responde; os outros são digitados. */
const VIACEP_DE_EXEMPLO: Record<string, object> = {
  '01001000': { logradouro: 'Praça da Sé', complemento: 'lado ímpar', bairro: 'Sé', localidade: 'São Paulo', uf: 'SP', ibge: '3550308' },
}

const viacepSimulado = (async (url: string) => {
  const cep = /ws\/(\d{8})\//.exec(url)?.[1] ?? ''
  return new Response(JSON.stringify(VIACEP_DE_EXEMPLO[cep] ?? { erro: true }), { headers: { 'Content-Type': 'application/json' } })
}) as typeof fetch

/** O CEP preenche rua, bairro, cidade e UF (CA10), pela função de campos. */
export function buscarEndereco(cep: string): Promise<Endereco | null> {
  return buscarCep(cep, viacepSimulado)
}
