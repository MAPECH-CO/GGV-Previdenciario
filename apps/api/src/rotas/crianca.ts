// O LOAS Deficiente de menor de 16 anos no servidor (GGVP-50, ligado pela GGVP-132). As rotas têm a forma da design.md da
// change ggvp-13 e as regras são as das telas (menor de 16 pela data de nascimento, G19; os relatórios por condição). A
// condição da criança é dado de saúde: só o Jurídico marca e vê, e cada leitura fica registrada.
import { eq } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { DadosDaCrianca, pode, type Erro } from '@ggv/contratos'
import type { Banco } from '../banco/conexao.ts'
import { acessoDadoSensivel, usuario } from '../banco/esquema.ts'
import { MSG_CASO_NAO_ENCONTRADO, criarCasoMedico, type CasoMedico } from '../fluxo/documentacao-medica.ts'
import { exigir, registrarHistorico } from '../sessao/rotas.ts'
import { hojeEmBrasilia } from '../vigilia/fila.ts'
import { nomeTipo } from '../../../web/src/dados/catalogos.ts'
import { idadeEm } from '../../../web/src/regras/datas.ts'
import { menorDe16, relatoriosDaCrianca, type CriancaDoCaso, type CriancaNaTela } from '../../../web/src/regras/infantil.ts'

export const MSG_SO_INFANTIL = 'A condição da criança é do LOAS Deficiente de menor de 16 anos.'

type Opcoes = { banco: Banco; agora?: () => Date }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)

export function registrarRotasCrianca(app: FastifyInstance, { banco, agora = () => new Date() }: Opcoes) {
  const historico = registrarHistorico(banco, agora)
  const { acharCaso, lerParte, gravarParte } = criarCasoMedico(banco, agora)
  /** CA1: o LOAS Deficiente de beneficiário menor de 16 anos hoje. */
  const infantil = (c: CasoMedico) => c.processo.beneficio === 'loas-deficiente' && menorDe16(c.ficha.nascimento, hojeEmBrasilia(agora()))
  const idade = (c: CasoMedico) => idadeEm(c.ficha.nascimento!, hojeEmBrasilia(agora()))
  const SEM_CONDICAO = { condicoes: [], terapias: [], escola: false }

  async function nomeDe(pedido: FastifyRequest) {
    const [u] = await banco.select({ nome: usuario.nome }).from(usuario).where(eq(usuario.id, pedido.usuario!.id))
    return u?.nome ?? 'Alguém do Jurídico'
  }

  // Quem não é do Jurídico vê se é infantil e os relatórios que o caso pede, nunca a condição.
  app.get<{ Params: { id: string } }>('/api/processos/:id/crianca', { preHandler: exigir(banco, 'caso.ver', agora) }, async (pedido, resposta): Promise<CriancaNaTela | Erro> => {
    const c = await acharCaso(pedido.params.id)
    if (!c) return negar(resposta, 404, MSG_CASO_NAO_ENCONTRADO)
    if (!infantil(c)) return { infantil: false, relatorios: [] }
    const dados = await lerParte<CriancaDoCaso>(c.id, 'crianca')
    const relatorios = relatoriosDaCrianca(dados ?? SEM_CONDICAO).map(nomeTipo)
    const veSaude = pode(pedido.perfilAtivo, 'dado_saude.ver_detalhe')
    if (dados && veSaude) await banco.insert(acessoDadoSensivel).values({ usuarioId: pedido.usuario!.id, perfil: pedido.perfilAtivo!, casoId: c.id, recurso: `crianca:${c.id}`, quando: agora() })
    return { infantil: true, idade: idade(c), ...(dados && veSaude && { dados }), relatorios }
  })

  app.put<{ Params: { id: string } }>('/api/processos/:id/crianca', { preHandler: exigir(banco, 'dado_saude.registrar', agora) }, async (pedido, resposta) => {
    const entrada = DadosDaCrianca.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, 'Condição ou terapia fora da lista.')
    const c = await acharCaso(pedido.params.id)
    if (!c) return negar(resposta, 404, MSG_CASO_NAO_ENCONTRADO)
    if (!infantil(c)) return negar(resposta, 409, MSG_SO_INFANTIL)
    const d = entrada.data
    const registro: CriancaDoCaso = { condicoes: [...new Set(d.condicoes)], terapias: [...new Set(d.terapias)], escola: d.escola, processoId: c.id, quem: await nomeDe(pedido), quando: agora().toISOString() }
    await gravarParte(c.id, 'crianca', registro)
    // Dado de saúde fica fora do histórico: só o que aconteceu.
    await historico(pedido.usuario!.id, 'crianca_registrada', pedido, `caso:${c.id}`)
    return { infantil: true, idade: idade(c), dados: registro, relatorios: relatoriosDaCrianca(registro).map(nomeTipo) } satisfies CriancaNaTela
  })
}
