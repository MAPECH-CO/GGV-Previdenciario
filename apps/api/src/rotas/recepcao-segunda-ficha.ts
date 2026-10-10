// A segunda ficha no servidor (GGVP-125, bloco 3c), sobre o fichário da Recepção. As regras são as do servidor de exemplo
// do Pedro (segundaFicha.ts). A seção médica é dado de saúde: fica em `segunda_ficha_medica`, fora da ficha, só vai a quem
// tem `dado_saude.ver_detalhe`, e cada leitura fica em `acesso_dado_sensivel` (LGPD, GGVP-96 CA13). A leitura do papel
// segue simulada, como nas telas.
import { eq } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { EnvioDaSegundaFicha, type Erro } from '@ggv/contratos'
import type { Banco } from '../banco/conexao.ts'
import { acessoDadoSensivel, segundaFichaMedica } from '../banco/esquema.ts'
import { exigir } from '../sessao/rotas.ts'
import { leituraDaSegundaFicha } from '../../../web/src/dados/exemplo.ts'
import type { Arquivo, RespostasDaSegundaFicha } from '../../../web/src/dados/tipos.ts'
import { nomeSemSobrescrever } from '../../../web/src/regras/arquivos.ts'
import { CAMPOS_MEDICOS, emBrancoDaSegunda, normalizarDatas, respostasVazias, segundaFichaValida, semDadosMedicos } from '../../../web/src/regras/segundaFicha.ts'
import { MSG_FICHA_NAO_ENCONTRADA, UUID, criarFichario } from './recepcao.ts'

export const MSG_SEM_SEGUNDA_FICHA = 'Sem segunda ficha salva.'
/** Quem preenche no tablet é o próprio cliente (GGVP-24). */
const CLIENTE_NO_TABLET = 'Cliente (tablet)'

const soMedicos = (r: Partial<RespostasDaSegundaFicha>) => Object.fromEntries(CAMPOS_MEDICOS.map((c) => [c, r[c] ?? '']))
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)

type Opcoes = { banco: Banco; agora?: () => Date }

export function registrarRotasRecepcaoSegundaFicha(app: FastifyInstance, { banco, agora = () => new Date() }: Opcoes) {
  const { hoje, evento, nomeDe, fichas, guardar, concluirTarefas, tarefas } = criarFichario(banco, agora)
  const editar = { preHandler: exigir(banco, 'ficha.editar', agora) }
  const saude = { preHandler: exigir(banco, 'dado_saude.ver_detalhe', agora) }

  const fichaPeloId = async (id: string) => (UUID.test(id) ? (await fichas([id]))[0] : undefined)
  const medicaDe = async (pessoaId: string) => (await banco.select().from(segundaFichaMedica).where(eq(segundaFichaMedica.pessoaId, pessoaId)))[0]
  const guardarMedica = (pessoaId: string, medicos: Record<string, string>, lida: boolean) =>
    banco
      .insert(segundaFichaMedica)
      .values({ pessoaId, medicos, lida })
      .onConflictDoUpdate({ target: segundaFichaMedica.pessoaId, set: { medicos, lida, atualizadoEm: agora() } })

  // GGVP-28 CA6 a CA8: a segunda ficha em papel passa no scanner e a IA lê (simulado). A seção médica vai direto ao
  // Jurídico e não volta para a tela do Atendimento. A leitura simulada não traz senha de verdade: nada vai ao cofre (G9).
  app.post<{ Params: { id: string } }>('/api/fichas/:id/segunda-ficha/leitura', editar, async (pedido, resposta) => {
    const ficha = await fichaPeloId(pedido.params.id)
    if (!ficha) return negar(resposta, 404, MSG_FICHA_NAO_ENCONTRADA)
    const arquivo: Arquivo = {
      nome: nomeSemSobrescrever(
        `Ficha de atendimento AUXILIO ACIDENTE - ${ficha.nome} - ${hoje()}.pdf`,
        ficha.arquivos.filter((x) => x.local === 'pessoais').map((x) => x.nome),
      ),
      tipo: 'ficha-acidente',
      local: 'pessoais',
      data: hoje(),
      origem: 'scanner',
      repetido: false,
      aguardaLeitura: false,
    }
    // GGVP-125, bloco 5a: a imagem entra na lista de arquivos da ficha do servidor.
    ficha.arquivos.push(arquivo)
    const respostas = { ...respostasVazias(), ...leituraDaSegundaFicha().respostas }
    await guardarMedica(ficha.id, soMedicos(respostas), true)
    ficha.historico.push(
      evento('A segunda ficha em papel (auxílio acidente) passou no scanner e a IA leu os campos; a imagem ficou em Documentos pessoais', await nomeDe(pedido)),
    )
    await guardar(ficha)
    return { arquivo, respostas: semDadosMedicos(respostas), senhaLida: false, ficha }
  })

  // GGVP-28 CA3, CA8: a ficha guarda a segunda ficha sem os campos médicos; a seção médica fica à parte. No papel, vale a
  // que a IA leu (ou a já salva); no tablet, a que o cliente preencheu, e o campo que volta em branco não apaga o salvo.
  app.put<{ Params: { id: string } }>('/api/fichas/:id/segunda-ficha', editar, async (pedido, resposta) => {
    const entrada = EnvioDaSegundaFicha.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, 'Segunda ficha inválida.')
    const { origem } = entrada.data
    // Só os campos que a tela conhece.
    const enviadas = Object.fromEntries(Object.keys(respostasVazias()).map((c) => [c, entrada.data.respostas[c] ?? ''])) as RespostasDaSegundaFicha
    const r = normalizarDatas(enviadas)
    if (!segundaFichaValida(r, hoje())) return negar(resposta, 400, 'Segunda ficha inválida.')
    const ficha = await fichaPeloId(pedido.params.id)
    if (!ficha) return negar(resposta, 404, MSG_FICHA_NAO_ENCONTRADA)
    const salva = ((await medicaDe(ficha.id))?.medicos ?? {}) as Partial<RespostasDaSegundaFicha>
    const medicos = origem === 'papel' ? salva : { ...salva, ...Object.fromEntries(CAMPOS_MEDICOS.filter((c) => r[c] !== '').map((c) => [c, r[c]])) }
    const final = { ...r, ...medicos }
    ficha.segundaFicha = { data: ficha.segundaFicha?.data ?? hoje(), origem, respostas: semDadosMedicos(final), emBranco: emBrancoDaSegunda(final) }
    await guardarMedica(ficha.id, soMedicos(final), false)
    await concluirTarefas(ficha.id, 'Preencher segunda ficha')
    ficha.historico.push(
      evento(`Salvou a segunda ficha (auxílio acidentário, ${origem === 'tablet' ? 'tablet' : 'papel, conferida'})`, origem === 'tablet' ? CLIENTE_NO_TABLET : await nomeDe(pedido)),
    )
    await guardar(ficha)
    return { ficha, tarefas: await tarefas(ficha.id) }
  })

  // A seção médica, só para o Jurídico, buscada pela tela que a mostra; cada leitura fica registrada.
  app.get<{ Params: { id: string } }>('/api/fichas/:id/segunda-ficha', saude, async (pedido, resposta) => {
    const linha = UUID.test(pedido.params.id) ? await medicaDe(pedido.params.id) : undefined
    if (!linha) return negar(resposta, 404, MSG_SEM_SEGUNDA_FICHA)
    await banco
      .insert(acessoDadoSensivel)
      .values({ usuarioId: pedido.usuario!.id, perfil: pedido.perfilAtivo!, recurso: `segunda-ficha:${linha.pessoaId}`, quando: agora() })
    return { medicos: linha.medicos, lida: linha.lida }
  })
}
