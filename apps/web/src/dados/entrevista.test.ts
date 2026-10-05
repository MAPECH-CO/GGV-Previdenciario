import { beforeEach, describe, expect, it } from 'vitest'
import { guardarSenhaNoCofre } from './cofre.ts'
import * as entrevista from './entrevista.ts'
import { encerrarGravacao, enviarAudioGuardado, iniciarGravacao, obterEntrevista, registrarAcao, registrarSemAudio, subirAudio, transcrever } from './entrevista.ts'
import { tarefasDaAdvogada } from './preparacao.ts'
import { CHAVE, configurarExemplo, gravar, ler, zerarExemplo } from './servidor.ts'

const AGORA = new Date(2026, 9, 5, 14, 32)
const JOSEFA = 'josefa-entrevista'
/** Senha de teste: não pode aparecer em lugar nenhum depois de guardada (G9). */
const SENHA_DE_TESTE = 'Teste#Entrevista-7314'

beforeEach(() => {
  configurarExemplo({ agora: () => AGORA, latencia: 0 })
  zerarExemplo()
})

async function gravarAte(aos: number, online = true) {
  const g = await iniciarGravacao(JOSEFA, { avisei: true })
  return encerrarGravacao(g.id, { aos, online })
}

describe('Entrevistar com gravação · servidor de exemplo', () => {
  it('CA4 · só grava com o aviso registrado, com a hora (G10)', async () => {
    await expect(iniciarGravacao(JOSEFA, {} as { avisei: true })).rejects.toThrow('antes de gravar (G10)')
    const g = await iniciarGravacao(JOSEFA, { avisei: true })
    expect(g).toMatchObject({ estado: 'gravando', avisoEm: AGORA.toISOString(), participantes: ['Dra. Paula', 'Josefa Exemplo'], canal: 'presencial' })
    expect(g.acoes.map((a) => a.acao)).toEqual(['avisou', 'gravou'])
    const { ficha } = (await obterEntrevista(JOSEFA))!
    expect(ficha.historico.at(-1)?.oQue).toBe('Avisou o cliente às 14:32 que a conversa seria gravada (G10) e começou a gravar a entrevista')
    // Clique duplo ou página recarregada: a mesma gravação.
    expect((await iniciarGravacao(JOSEFA, { avisei: true })).id).toBe(g.id)
  })

  it('CA2 e CA5 · cada ação registrada; ao encerrar, o áudio fica no caso, vai à transcrição e a advogada recebe "Cadastrar lead"', async () => {
    const banco = ler()
    banco.tarefas.push({ id: `preparar-${JOSEFA}`, codigo: 'D1.06', cliente: { id: 'josefa-exemplo', nome: 'Josefa Exemplo' }, acao: 'Preparar entrevista', detalhe: '', setor: 'Jurídico' })
    gravar(banco)
    const g = await iniciarGravacao(JOSEFA, { avisei: true })
    await registrarAcao(g.id, 'pausou', 30)
    await registrarAcao(g.id, 'retomou', 30)
    const { gravacao, tarefa } = await encerrarGravacao(g.id, { aos: 140, online: true })
    expect(gravacao.acoes.map((a) => [a.acao, a.aos])).toEqual([
      ['avisou', 0],
      ['gravou', 0],
      ['pausou', 30],
      ['retomou', 30],
      ['encerrou', 140],
    ])
    expect(gravacao).toMatchObject({ estado: 'encerrada', duracao: 140, transcricao: 'transcrevendo', audio: { nome: 'entrevista-josefa-exemplo-2026-10-05.webm', partes: 1 } })
    expect(tarefa).toMatchObject({ codigo: 'D1.10', acao: 'Cadastrar lead', href: '/clientes/josefa-exemplo/cadastro', setor: 'Jurídico' })
    const fila = tarefasDaAdvogada().map((t) => t.acao)
    expect(fila).toContain('Cadastrar lead')
    expect(fila).not.toContain('Preparar entrevista')
    const { ficha, agendamento } = (await obterEntrevista(JOSEFA))!
    expect(agendamento.estado).toBe('realizado')
    expect(ficha.transcricoes).toBe(1)
  })

  it('CA3, CA6 e GGVP-46 CA8 · o cofre pausa a gravação; a senha não fica no áudio, no texto nem no armazenamento', async () => {
    const g = await iniciarGravacao(JOSEFA, { avisei: true })
    expect((await registrarAcao(g.id, 'abriu-cofre', 115)).estado).toBe('pausada')
    await guardarSenhaNoCofre('josefa-exemplo', SENHA_DE_TESTE)
    expect((await registrarAcao(g.id, 'guardou-senha', 115)).estado).toBe('gravando')
    await encerrarGravacao(g.id, { aos: 140, online: true })
    const pronta = await transcrever(g.id)
    expect(pronta.transcricao).toBe('pronta')
    expect(new Set(pronta.trechos.map((t) => t.papel))).toEqual(new Set(['advogada', 'cliente']))
    expect(pronta.extraidas.find((e) => e.destino === 'cofre')?.valor).toBe('digitada no cofre: não consta na transcrição (G9)')
    expect(JSON.stringify(ler())).not.toContain(SENHA_DE_TESTE)
    expect(sessionStorage.getItem(CHAVE)).not.toContain(SENHA_DE_TESTE)
  })

  it('a transcrição tem só o que foi gravado, o resumo e os documentos', async () => {
    const { gravacao } = await gravarAte(30)
    const pronta = await transcrever(gravacao.id)
    expect(pronta.trechos.map((t) => t.aos)).toEqual([0, 6, 14, 24])
    expect(pronta.extraidas.map((e) => e.id)).toEqual(['desde', 'vinculo', 'profissao'])
    expect(pronta.resumo).toBe(
      'Josefa Exemplo: sem trabalhar desde 06/2026; último vínculo: auxiliar de limpeza · CLT · até 05/2026. Procura LOAS Idoso. O benefício é a advogada que define (D1.12, G3).',
    )
    expect(pronta.documentos).toEqual(['RG', 'CPF', 'Comprovante de residência', 'CNIS'])
  })

  it('CA12 · sem internet, espera; quando volta, o áudio sobe uma vez só', async () => {
    const { gravacao } = await gravarAte(60, false)
    expect(gravacao.transcricao).toBe('aguardando-internet')
    expect((await transcrever(gravacao.id)).transcricao).toBe('aguardando-internet')
    expect((await enviarAudioGuardado(gravacao.id)).transcricao).toBe('transcrevendo')
    const deNovo = await enviarAudioGuardado(gravacao.id)
    expect(deNovo.acoes.filter((a) => a.acao === 'enviou-audio')).toHaveLength(1)
    expect((await transcrever(gravacao.id)).transcricao).toBe('pronta')
  })

  it('CA8 · a gravação falha e a advogada registra sem áudio; o que gravou fica guardado', async () => {
    const g = await iniciarGravacao(JOSEFA, { avisei: true })
    expect((await registrarAcao(g.id, 'falhou', 50)).estado).toBe('falhou')
    await expect(registrarSemAudio(g.id, ' ')).rejects.toThrow('Escreva o que foi conversado.')
    const { gravacao, tarefa } = await registrarSemAudio(g.id, 'Conversamos sobre o LOAS; a cliente traz a carta do INSS.')
    expect(gravacao).toMatchObject({ estado: 'encerrada', transcricao: 'sem-audio', registro: 'Conversamos sobre o LOAS; a cliente traz a carta do INSS.', duracao: 50 })
    expect(gravacao.audio?.nome).toBe('entrevista-josefa-exemplo-2026-10-05.webm')
    expect(tarefa?.acao).toBe('Cadastrar lead')
  })

  it('CA9 e CA10 · áudio de fora, de qualquer tamanho: divide em partes e junta o texto na ordem', async () => {
    await expect(subirAudio(JOSEFA, { nome: 'laudo.pdf', tipo: 'application/pdf', tamanho: 1000 })).rejects.toThrow('não é de áudio')
    const { gravacao, tarefa } = await subirAudio(JOSEFA, { nome: 'ligacao-chatwoot.ogg', tipo: 'audio/ogg', tamanho: 300 * 1024 * 1024 })
    expect(gravacao).toMatchObject({ origem: 'arquivo', transcricao: 'transcrevendo', audio: { nome: 'ligacao-chatwoot.ogg', formato: 'ogg', partes: 13 } })
    expect(tarefa?.acao).toBe('Cadastrar lead')
    const pronta = await transcrever(gravacao.id)
    const tempos = pronta.trechos.map((t) => t.aos)
    expect(tempos).toEqual([...tempos].sort((a, b) => a - b))
    expect(pronta.trechos).toHaveLength(15)
    expect(pronta.duracao).toBe(142)
  })

  it('GGVP-46 CA3 · a transcrição que falhou pode tentar de novo', async () => {
    const { gravacao } = await gravarAte(30)
    expect(await transcrever(gravacao.id, { falhar: true })).toMatchObject({ transcricao: 'falhou', motivoDaFalha: 'o serviço de transcrição não respondeu' })
    expect((await transcrever(gravacao.id)).transcricao).toBe('pronta')
  })

  it('CA13 · nada apaga áudio nem gravação', () => {
    expect(Object.keys(entrevista).filter((n) => /apagar|excluir|remover/i.test(n))).toEqual([])
  })
})
