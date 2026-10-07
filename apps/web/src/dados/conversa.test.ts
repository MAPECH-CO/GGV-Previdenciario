import { beforeEach, describe, expect, it } from 'vitest'
import { situacaoDaGravacao } from '../regras/transcricao.ts'
import { abrirConversa, anexarAudio, conversaDaGravacao, finalizarConversa, gravarConversa, obterConversa, tarefasDeRegistrarConversa, transcreverConversa, type NovaConversa, type QuemAge } from './conversa.ts'
import { registrarAcao } from './entrevista.ts'
import { configurarExemplo, ler, obterFicha, zerarExemplo } from './servidor.ts'
import { obterGravacoes } from './transcricao.ts'

const AGORA = new Date(2026, 9, 7, 14, 32)
const BRUNA: QuemAge = { quem: 'Bruna (exemplo)', perfil: 'atendimento' }
const PRESENCIAL: NovaConversa = { canal: 'presencial', comQuem: 'cliente', modo: 'tempo-real' }
/** A senha que a cliente fala em voz alta na conversa de exemplo: não pode sobrar em lugar nenhum (G9). */
const SENHA_DITA = 'Exemplo@2026'

beforeEach(() => {
  configurarExemplo({ agora: () => AGORA, latencia: 0 })
  zerarExemplo()
})

describe('Registrar a conversa · servidor de exemplo (GGVP-76)', () => {
  it('CA3 e CA4 · abre no card do cliente, com canal, com quem e o modo; o servidor confere de novo', async () => {
    await expect(abrirConversa('maria-exemplo', PRESENCIAL, { quem: 'Jéssica (exemplo)', perfil: 'documentacao' })).rejects.toThrow('do Atendimento e do Jurídico')
    await expect(abrirConversa('maria-exemplo', { ...PRESENCIAL, canal: 'whatsapp' as never }, BRUNA)).rejects.toThrow('Escolha o canal')
    const c = await abrirConversa('maria-exemplo', PRESENCIAL, BRUNA)
    expect(c).toMatchObject({ fichaId: 'maria-exemplo', processoId: 'maria-exemplo-1', canal: 'presencial', comQuem: 'cliente', modo: 'tempo-real', quem: 'Bruna (exemplo)', papel: 'atendimento', abertaEm: AGORA.toISOString() })
    expect((await obterFicha('maria-exemplo'))!.historico.at(-1)).toMatchObject({ quem: 'Bruna (exemplo)', oQue: 'Abriu a conversa (presencial, com cliente): grava depois do aviso (G10)' })
  })

  it('o lead sem processo tem a conversa na ficha dele, que é a mesma tela do cliente (Lucas, 06/10)', async () => {
    const c = await abrirConversa('josefa-exemplo', { ...PRESENCIAL, comQuem: 'familiar' }, { quem: 'Dra. Paula (exemplo)', perfil: 'advogada' })
    expect(c.processoId).toBeUndefined()
    expect(c.papel).toBe('juridico')
  })

  it('CA1 e CA5 · só grava com o aviso registrado; a hora do aviso fica guardada (G10)', async () => {
    const c = await abrirConversa('maria-exemplo', PRESENCIAL, BRUNA)
    await expect(gravarConversa(c.id, {} as { avisei: true })).rejects.toThrow('antes de gravar (G10)')
    const g = await gravarConversa(c.id, { avisei: true })
    expect(g).toMatchObject({ estado: 'gravando', avisoEm: AGORA.toISOString(), origem: 'portal', canal: 'presencial', participantes: ['Bruna (exemplo)', 'Maria Exemplo'], soJuridico: false })
    expect(g.acoes.map((a) => a.acao)).toEqual(['avisou', 'gravou'])
    expect((await obterFicha('maria-exemplo'))!.historico.at(-1)?.oQue).toBe('Avisou às 14:32 que a conversa seria gravada (G10) e começou a gravar')
    // Clique duplo ou página recarregada: a mesma gravação.
    expect((await gravarConversa(c.id, { avisei: true })).id).toBe(g.id)
  })

  it('CA6 e CA9 · o mesmo motor da entrevista: pausar e o cofre; finalizar guarda o áudio no card e a transcrição começa', async () => {
    const c = await abrirConversa('maria-exemplo', PRESENCIAL, BRUNA)
    const g = await gravarConversa(c.id, { avisei: true })
    expect((await registrarAcao(g.id, 'abriu-cofre', 80)).estado).toBe('pausada')
    expect((await registrarAcao(g.id, 'guardou-senha', 80)).estado).toBe('gravando')
    await expect(finalizarConversa('conversa-que-nao-existe', { aos: 1 })).rejects.toThrow('Conversa não encontrada')
    const antes = (await obterFicha('maria-exemplo'))!.transcricoes
    const { gravacao, conversa, ficha } = await finalizarConversa(c.id, { aos: 120 })
    expect(gravacao).toMatchObject({ estado: 'encerrada', duracao: 120, transcricao: 'transcrevendo', audio: { nome: 'conversa-maria-exemplo-2026-10-07.webm', formato: 'webm', partes: 1 } })
    expect(conversa.finalizadaEm).toBe(AGORA.toISOString())
    expect(ficha.transcricoes).toBe(antes + 1)
    expect(ficha.historico.at(-1)?.oQue).toBe('Finalizou a conversa gravada (2 min); o áudio ficou no card e foi para a transcrição')
    expect(gravacao!.acoes.map((a) => a.acao)).toEqual(['avisou', 'gravou', 'abriu-cofre', 'guardou-senha', 'encerrou'])
  })

  it('CA2 · a ligação já feita sobe gravada e fica no card; precisa do aviso nela e de um áudio', async () => {
    const c = await abrirConversa('maria-exemplo', { canal: 'ligacao', comQuem: 'cliente', modo: 'arquivo' }, BRUNA)
    const audio = { nome: 'ligacao-maria.ogg', tipo: 'audio/ogg', tamanho: 900_000, avisoNaGravacao: true as const }
    await expect(anexarAudio(c.id, { ...audio, avisoNaGravacao: false as never })).rejects.toThrow('aviso de gravação (G10)')
    await expect(anexarAudio(c.id, { ...audio, nome: 'foto.jpg', tipo: 'image/jpeg' })).rejects.toThrow('não é de áudio')
    const { gravacao } = await anexarAudio(c.id, audio)
    expect(gravacao).toMatchObject({ origem: 'arquivo', estado: 'encerrada', transcricao: 'transcrevendo', canal: 'ligação', audio: { nome: 'ligacao-maria.ogg', formato: 'ogg' } })
    expect((await obterGravacoes('maria-exemplo'))[0].id).toBe(gravacao!.id)
  })

  it('a transcrição usa o mesmo motor: quem fala, a duração do áudio de fora, e a senha dita fica fora (G9); a falha tenta de novo', async () => {
    const c = await abrirConversa('maria-exemplo', { canal: 'ligacao', comQuem: 'cliente', modo: 'arquivo' }, BRUNA)
    await anexarAudio(c.id, { nome: 'ligacao.mp3', tipo: 'audio/mpeg', tamanho: 500_000, avisoNaGravacao: true })
    expect((await transcreverConversa(c.id, { falhar: true })).gravacao).toMatchObject({ transcricao: 'falhou', motivoDaFalha: 'o serviço de transcrição não respondeu' })
    const { gravacao: g, ficha } = await transcreverConversa(c.id)
    expect(g!.transcricao).toBe('pronta')
    expect(g!.duracao).toBe(116)
    expect(g!.trechos[0]).toMatchObject({ aos: 0, quem: 'Bruna', papel: 'atendimento' })
    expect(g!.trechos[0].texto).toContain('esta ligação está sendo gravada')
    expect(g!.trechos.some((t) => t.quem === 'Maria' && t.papel === 'cliente')).toBe(true)
    expect(JSON.stringify(g)).not.toContain(SENHA_DITA)
    expect(ficha.historico.at(-1)).toMatchObject({ quem: 'Sistema (IA)', oQue: 'A transcrição da conversa ficou pronta: está nas Transcrições do card' })
  })

  it('CA7 · o registro escrito aparece nas Transcrições como "só registro", com quem registrou', async () => {
    await expect(abrirConversa('maria-exemplo', { ...PRESENCIAL, modo: 'escrito', registro: 'ok' }, BRUNA)).rejects.toThrow('Escreva o resumo')
    const c = await abrirConversa('maria-exemplo', { ...PRESENCIAL, modo: 'escrito', registro: 'Tirou dúvida sobre o que levar na perícia.' }, BRUNA)
    expect(c.finalizadaEm).toBe(AGORA.toISOString())
    const [g] = await obterGravacoes('maria-exemplo')
    expect(g).toMatchObject({ id: c.gravacaoId, data: '2026-10-07', canal: 'presencial', participantes: ['Bruna (exemplo)', 'Maria Exemplo'], transcricao: 'sem-audio', registro: 'Tirou dúvida sobre o que levar na perícia.' })
    expect(g.audio).toBeUndefined()
    expect(situacaoDaGravacao(g)).toBe('só registro')
    expect((await obterConversa(c.id))!.gravacao?.id).toBe(g.id)
  })

  it('CA8 · "Registrar conversa" na Central de quem abriu e não terminou: a ligação do Pedro Exemplo, da semente', async () => {
    const [tarefa] = tarefasDeRegistrarConversa('Bruna (exemplo)')
    expect(tarefa).toMatchObject({
      codigo: 'D5.01',
      cliente: { id: 'pedro-exemplo', nome: 'Pedro Exemplo' },
      acao: 'Registrar conversa',
      detalhe: 'ligou com informação nova sobre a exigência do INSS · ligou às 09:15 · subir a gravação da ligação',
      href: '/conversas/conversa-pedro-ligacao',
    })
    expect(tarefasDeRegistrarConversa('Carla (exemplo)')).toEqual([])
    const c = await abrirConversa('maria-exemplo', PRESENCIAL, BRUNA)
    expect(tarefasDeRegistrarConversa('Bruna (exemplo)').map((t) => t.detalhe.split(' · ').at(-1))).toEqual(['subir a gravação da ligação', 'gravar depois do aviso (G10)'])
    await gravarConversa(c.id, { avisei: true })
    expect(tarefasDeRegistrarConversa('Bruna (exemplo)').at(-1)?.detalhe).toContain('finalizar a conversa')
    await finalizarConversa(c.id, { aos: 30 })
    await anexarAudio('conversa-pedro-ligacao', { nome: 'ligacao-pedro.ogg', tipo: 'audio/ogg', tamanho: 1000, avisoNaGravacao: true })
    expect(tarefasDeRegistrarConversa('Bruna (exemplo)')).toEqual([])
  })
})

describe('Transcrever e identificar o que mudou · servidor de exemplo (GGVP-80)', () => {
  async function conversaDaMaria(pedido: NovaConversa = PRESENCIAL) {
    const c = await abrirConversa('maria-exemplo', pedido, BRUNA)
    if (pedido.modo === 'arquivo') await anexarAudio(c.id, { nome: 'ligacao.ogg', tipo: 'audio/ogg', tamanho: 4096, avisoNaGravacao: true })
    else {
      await gravarConversa(c.id, { avisei: true })
      await finalizarConversa(c.id, { aos: 116 })
    }
    return transcreverConversa(c.id)
  }

  it('CA2 e CA5 · a lista do que mudou, marcada ficha ou processo, com o trecho e a hora; o que precisa atualizar; o combinado', async () => {
    const { conversa } = await conversaDaMaria()
    const a = conversa.analise!
    expect(a.mudancas.map((m) => [m.onde, m.rotulo, m.antes, m.depois, m.aos])).toEqual([
      ['ficha', 'endereço', '', 'Rua Exemplo das Acácias, 45', 20],
      ['ficha', 'telefone de contato', '11900000004', '11900000044', 38],
      ['processo', 'data da perícia do INSS', '2026-10-02', '2026-10-16', 56],
      ['processo', 'fato novo', '', 'Três dias no hospital no fim de setembro', 66],
      ['processo', 'documento citado', '', 'Relatório da alta hospitalar', 66],
    ])
    expect(a.mudancas[1].trecho).toBe('Não, troquei de número: agora é (11) 90000-0044.')
    expect(a.atualizar).toEqual(['ficha', 'processo'])
    expect(a.pendencia).toBe('Documentação: receber e digitalizar o relatório da alta hospitalar.')
    expect(a.observacao).toBe(
      'A senha do gov.br foi dita em voz alta: saiu da transcrição e foi para o cofre (G9). Tem fato novo de saúde: só o Jurídico vê e confirma, e a transcrição fica só para o Jurídico.',
    )
  })

  it('CA1 e CA6 · o texto fica no card, com as informações extraídas e o resumo; nada vai para a ficha antes de conferir (G14)', async () => {
    const { gravacao: g, ficha } = await conversaDaMaria()
    expect(g!.extraidas.map((e) => [e.rotulo, e.valor, e.destino, e.conferidaEm])).toEqual([
      ['Endereço', 'Rua Exemplo das Acácias, 45', 'ficha', undefined],
      ['Telefone de contato', '(11) 90000-0044', 'ficha', undefined],
      ['Data da perícia do INSS', '16/10/2026', 'processo', undefined],
      ['Fato novo', 'Três dias no hospital no fim de setembro', 'processo', undefined],
      ['Documento citado', 'Relatório da alta hospitalar', 'processo', undefined],
      ['Senha do gov.br', 'dita na conversa: foi para o cofre; não consta na transcrição (G9)', 'cofre', undefined],
    ])
    expect(g!.resumo).toBe(
      'Presencial, com cliente: endereço, telefone de contato, data da perícia do INSS, fato novo de saúde, documento citado. Combinado: Documentação: receber e digitalizar o relatório da alta hospitalar.',
    )
    expect([ficha.telefone, ficha.endereco]).toEqual(['11900000004', undefined])
    expect(ficha.contatos.at(-1)).toEqual({ data: '2026-10-07', canal: 'Presencial (gravada, G10)', texto: g!.resumo })
    expect(ficha.historico.map((e) => e.oQue).join(' ')).not.toMatch(/hospital/)
  })

  it('CA3 e CA8 · a senha dita vai para o cofre (só a trilha) e não fica em lugar nenhum; com dado de saúde, a transcrição é só do Jurídico', async () => {
    const { gravacao: g, ficha } = await conversaDaMaria()
    expect(g!.trechos.find((t) => t.aos === 86)?.texto).toBe('A minha senha do gov.br é [senha retirada: vai ao cofre], pode anotar.')
    expect(ficha.senhaGov).toMatchObject({ situacao: 'no-cofre', por: 'IA, dita na conversa' })
    expect(ler().cofre.at(-1)).toMatchObject({ fichaId: 'maria-exemplo', quem: 'Sistema (IA)', acao: 'guardou' })
    expect(JSON.stringify(ler())).not.toContain(SENHA_DITA)
    expect(g!.soJuridico).toBe(true)
  })

  it('CA4 · vale para a ligação anexada; no lead sem processo, só a ficha muda e o combinado é do Atendimento', async () => {
    const ligacao = await conversaDaMaria({ canal: 'ligacao', comQuem: 'cliente', modo: 'arquivo' })
    expect(ligacao.conversa.analise!.mudancas).toHaveLength(5)
    const c = await abrirConversa('josefa-exemplo', PRESENCIAL, BRUNA)
    await gravarConversa(c.id, { avisei: true })
    await finalizarConversa(c.id, { aos: 116 })
    const { conversa, gravacao } = await transcreverConversa(c.id)
    expect(conversa.analise!.atualizar).toEqual(['ficha'])
    expect(conversa.analise!.pendencia).toBe('Atendimento: pedir o comprovante do endereço novo.')
    expect(gravacao!.soJuridico).toBe(false)
  })

  it('quem falou não foi o cliente: a observação avisa', async () => {
    const { conversa } = await conversaDaMaria({ ...PRESENCIAL, comQuem: 'familiar' })
    expect(conversa.analise!.observacao).toContain('Quem falou não foi o cliente: confira antes de mudar dado de contato.')
  })

  it('CA9 · só escrita: sem transcrição nem análise; a gravação leva à conversa', async () => {
    const c = await abrirConversa('maria-exemplo', { ...PRESENCIAL, modo: 'escrito', registro: 'Perguntou da perícia.' }, BRUNA)
    expect((await transcreverConversa(c.id)).conversa.analise).toBeUndefined()
    expect(conversaDaGravacao(c.gravacaoId!)).toBe(c.id)
    expect(conversaDaGravacao('antonio-entrevista')).toBeUndefined()
  })
})
