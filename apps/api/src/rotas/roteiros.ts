// O roteiro de conteúdo mínimo por benefício no servidor (GGVP-93, ligado pela GGVP-132). As rotas têm a forma da
// design.md da change ggvp-13. A versão 1 é a régua do escritório, a mesma das telas (regra pura importada); as versões
// que a sênior salva ficam em `roteiro_laudo`, com o autor da sessão. Nada é sobrescrito (CA2).
import { asc, eq } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { EdicaoDoRoteiro, type Erro } from '@ggv/contratos'
import type { Banco } from '../banco/conexao.ts'
import { roteiroLaudo, usuario } from '../banco/esquema.ts'
import { exigir, registrarHistorico } from '../sessao/rotas.ts'
import { hojeEmBrasilia } from '../vigilia/fila.ts'
import { ROTEIRO_INFANTIL } from '../../../web/src/regras/infantil.ts'
import { emVigor, motivoParaNaoSalvar, novaVersao, roteiroDoBeneficio, type ItemDoRoteiro, type Roteiro } from '../../../web/src/regras/roteiro.ts'
import { roteirosDoEscritorio } from '../../../web/src/regras/roteirosDoEscritorio.ts'

export const MSG_ROTEIRO_NAO_ENCONTRADO = 'Roteiro não encontrado.'

type Opcoes = { banco: Banco; agora?: () => Date }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)

/** Os roteiros com todas as versões: a 1 do escritório e as do banco, em ordem. O parecer (GGVP-20) usa a mesma. */
export async function roteirosDoBanco(banco: Banco): Promise<Roteiro[]> {
  const linhas = await banco
    .select({ roteiro: roteiroLaudo.beneficio, versao: roteiroLaudo.versao, itens: roteiroLaudo.itens, autor: usuario.nome, quando: roteiroLaudo.criadoEm })
    .from(roteiroLaudo)
    .leftJoin(usuario, eq(roteiroLaudo.autorId, usuario.id))
    .orderBy(asc(roteiroLaudo.versao))
  return roteirosDoEscritorio().map((r) => ({
    ...r,
    versoes: [
      ...r.versoes,
      ...linhas
        .filter((l) => l.roteiro === r.id)
        .map((l) => ({ versao: l.versao, autor: l.autor ?? 'Sênior', quando: l.quando.toISOString(), itens: l.itens as ItemDoRoteiro[] })),
    ],
  }))
}

/** O roteiro do benefício do caso; undefined: "sem roteiro" (CA3). Menor de 16 anos no LOAS Deficiente: o infantil (GGVP-50). */
export function roteiroDoCaso(roteiros: Roteiro[], beneficio: string, menorDe16 = false): Roteiro | undefined {
  const infantil = menorDe16 && beneficio === 'loas-deficiente' ? roteiros.find((r) => r.id === ROTEIRO_INFANTIL) : undefined
  return infantil ?? roteiroDoBeneficio(roteiros, beneficio)
}

export function registrarRotasRoteiros(app: FastifyInstance, { banco, agora = () => new Date() }: Opcoes) {
  const historico = registrarHistorico(banco, agora)
  const ver = { preHandler: exigir(banco, 'caso.ver', agora) }

  app.get('/api/roteiros', ver, async () => roteirosDoBanco(banco))

  app.get<{ Params: { id: string } }>('/api/roteiros/:id', ver, async (pedido, resposta) => {
    const r = (await roteirosDoBanco(banco)).find((x) => x.id === pedido.params.id)
    return r ?? negar(resposta, 404, MSG_ROTEIRO_NAO_ENCONTRADO)
  })

  // CA2: só a sênior edita a régua; a versão nova nasce com o autor da sessão e a data, e as anteriores ficam.
  app.post<{ Params: { id: string } }>('/api/roteiros/:id/versoes', { preHandler: exigir(banco, 'roteiro.editar', agora) }, async (pedido, resposta) => {
    const entrada = EdicaoDoRoteiro.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, 'Itens do roteiro inválidos.')
    const itens: ItemDoRoteiro[] = entrada.data.itens
    const motivo = motivoParaNaoSalvar(itens)
    if (motivo) return negar(resposta, 400, motivo)
    const roteiro = (await roteirosDoBanco(banco)).find((x) => x.id === pedido.params.id)
    if (!roteiro) return negar(resposta, 404, MSG_ROTEIRO_NAO_ENCONTRADO)
    const nova = emVigor(novaVersao(roteiro, itens, '', agora().toISOString()))
    // O banco recusa a mesma versão duas vezes (roteiro_versao_unica): quem salvou junto tenta de novo.
    await banco
      .insert(roteiroLaudo)
      .values({ beneficio: roteiro.id, versao: nova.versao, itens: nova.itens, vigenteDesde: hojeEmBrasilia(agora()), autorId: pedido.usuario!.id, criadoEm: agora() })
    await historico(pedido.usuario!.id, 'roteiro_versao_salva', pedido, `roteiro:${roteiro.id}`, { versao: nova.versao })
    return resposta.code(201).send((await roteirosDoBanco(banco)).find((x) => x.id === roteiro.id))
  })
}
