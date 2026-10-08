import { beforeEach, describe, expect, it } from 'vitest'
import { situacaoDaGravacao } from '../regras/transcricao.ts'
import {
  abrirConversa,
  anexarAudio,
  conferirConversa,
  conversaDaGravacao,
  cumprirPendencia,
  finalizarConversa,
  novoPrazoDaPendencia,
  pessoasDoEscritorio,
  tarefasDePendencia,
  gravarConversa,
  obterConversa,
  obterVersoes,
  tarefasDeRegistrarConversa,
  transcreverConversa,
  voltarParaVersao,
  type NovaConversa,
  type NovaPendencia,
  type QuemAge,
} from './conversa.ts'
import { registrarAcao } from './entrevista.ts'
import { configurarExemplo, ler, obterFicha, zerarExemplo } from './servidor.ts'
import { obterGravacoes } from './transcricao.ts'

const AGORA = new Date(2026, 9, 7, 14, 32)
const BRUNA: QuemAge = { quem: 'Ana (exemplo)', perfil: 'atendimento' }
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
    expect(c).toMatchObject({ fichaId: 'maria-exemplo', processoId: 'maria-exemplo-1', canal: 'presencial', comQuem: 'cliente', modo: 'tempo-real', quem: 'Ana (exemplo)', papel: 'atendimento', abertaEm: AGORA.toISOString() })
    expect((await obterFicha('maria-exemplo'))!.historico.at(-1)).toMatchObject({ quem: 'Ana (exemplo)', oQue: 'Abriu a conversa (presencial, com cliente): grava depois do aviso (G10)' })
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
    expect(g).toMatchObject({ estado: 'gravando', avisoEm: AGORA.toISOString(), origem: 'portal', canal: 'presencial', participantes: ['Ana (exemplo)', 'Maria Exemplo'], soJuridico: false })
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
    expect(g!.trechos[0]).toMatchObject({ aos: 0, quem: 'Ana', papel: 'atendimento' })
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
    expect(g).toMatchObject({ id: c.gravacaoId, data: '2026-10-07', canal: 'presencial', participantes: ['Ana (exemplo)', 'Maria Exemplo'], transcricao: 'sem-audio', registro: 'Tirou dúvida sobre o que levar na perícia.' })
    expect(g.audio).toBeUndefined()
    expect(situacaoDaGravacao(g)).toBe('só registro')
    expect((await obterConversa(c.id))!.gravacao?.id).toBe(g.id)
  })

  it('CA8 · "Registrar conversa" na Central de quem abriu e não terminou: a ligação do Pedro Exemplo, da semente', async () => {
    const [tarefa] = tarefasDeRegistrarConversa('Ana (exemplo)')
    expect(tarefa).toMatchObject({
      codigo: 'D5.01',
      cliente: { id: 'pedro-exemplo', nome: 'Pedro Exemplo' },
      acao: 'Registrar conversa',
      detalhe: 'ligou com informação nova sobre a exigência do INSS · ligou às 09:15 · subir a gravação da ligação',
      href: '/conversas/conversa-pedro-ligacao',
    })
    expect(tarefasDeRegistrarConversa('Carla (exemplo)')).toEqual([])
    const c = await abrirConversa('maria-exemplo', PRESENCIAL, BRUNA)
    expect(tarefasDeRegistrarConversa('Ana (exemplo)').map((t) => t.detalhe.split(' · ').at(-1))).toEqual(['subir a gravação da ligação', 'gravar depois do aviso (G10)'])
    await gravarConversa(c.id, { avisei: true })
    expect(tarefasDeRegistrarConversa('Ana (exemplo)').at(-1)?.detalhe).toContain('finalizar a conversa')
    await finalizarConversa(c.id, { aos: 30 })
    await anexarAudio('conversa-pedro-ligacao', { nome: 'ligacao-pedro.ogg', tipo: 'audio/ogg', tamanho: 1000, avisoNaGravacao: true })
    // Gravada, falta só a conferência de quem conversou (GGVP-84); conferida, sai da Central.
    expect(tarefasDeRegistrarConversa('Ana (exemplo)').map((t) => t.detalhe.split(' · ').at(-1))).toEqual(['conferir a conversa (D5.04)', 'conferir a conversa (D5.04)'])
    for (const id of ['conversa-pedro-ligacao', c.id]) {
      const { conversa } = await transcreverConversa(id)
      const doAtendimento = conversa.analise!.mudancas.filter((m) => m.campo !== 'fato')
      await conferirConversa(id, { decisoes: doAtendimento.map((m) => ({ id: m.id, decisao: 'desfeita' as const })), pendencia: { surgiu: false } }, BRUNA)
    }
    expect(tarefasDeRegistrarConversa('Ana (exemplo)')).toEqual([])
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

describe('Atualizar ficha e processo com desfazer · servidor de exemplo (GGVP-84)', () => {
  async function transcritaDaMaria() {
    const c = await abrirConversa('maria-exemplo', PRESENCIAL, BRUNA)
    await gravarConversa(c.id, { avisei: true })
    await finalizarConversa(c.id, { aos: 116 })
    const { conversa } = await transcreverConversa(c.id)
    const id = (campo: string) => conversa.analise!.mudancas.find((m) => m.campo === campo)!.id
    return { c, id }
  }
  const SENIOR: QuemAge = { quem: 'Dra. Renata (exemplo)', perfil: 'senior' }
  const PAULA: QuemAge = { quem: 'Dra. Paula (exemplo)', perfil: 'advogada' }

  it('CA1, CA4, CA5 e CA6 · só quem conversou confere; nada entra antes; entra o confirmado e o corrigido, o desfeito não', async () => {
    const { c, id } = await transcritaDaMaria()
    const decisoes = [
      { id: id('endereco'), decisao: 'confirmada' as const },
      { id: id('telefone'), decisao: 'corrigida' as const, valor: '(11) 90000-0055' },
      { id: id('pericia'), decisao: 'confirmada' as const },
      { id: id('documento'), decisao: 'desfeita' as const },
    ]
    await expect(conferirConversa(c.id, { decisoes, pendencia: { surgiu: false } }, { quem: 'Carla (exemplo)', perfil: 'atendimento-lider' })).rejects.toThrow(
      'Quem confere é quem fez a conversa: Ana (exemplo).',
    )
    await expect(conferirConversa(c.id, { decisoes }, BRUNA)).rejects.toThrow('Responda "Surgiu pendência?".')
    await expect(conferirConversa(c.id, { decisoes: decisoes.slice(1), pendencia: { surgiu: false } }, BRUNA)).rejects.toThrow('Confirme, corrija ou desfaça: endereço.')
    await expect(conferirConversa(c.id, { decisoes: [...decisoes, { id: id('fato'), decisao: 'confirmada' }], pendencia: { surgiu: false } }, BRUNA)).rejects.toThrow(
      'A mudança de fato novo é de a advogada responsável ou a Sênior.',
    )
    expect((await obterFicha('maria-exemplo'))!.telefone).toBe('11900000004')

    const { ficha, gravacao, conversa } = await conferirConversa(c.id, { decisoes, pendencia: { surgiu: false } }, BRUNA)
    expect([ficha.endereco, ficha.telefone]).toEqual(['Rua Exemplo das Acácias, 45', '11900000055'])
    expect(conversa.conferidaEm).toBe(AGORA.toISOString())
    expect(gravacao!.extraidas.map((e) => [e.rotulo, Boolean(e.conferidaEm)])).toEqual([
      ['Endereço', true],
      ['Telefone de contato', true],
      ['Data da perícia do INSS', true],
      ['Fato novo', false],
      ['Documento citado', true],
      ['Senha do gov.br', true],
    ])
    expect(gravacao!.marcas).toContain('ficha atualizada')
    const historico = ficha.historico.map((e) => e.oQue)
    expect(historico).toContain('Atualizou na ficha, pela conversa, o telefone de contato: «(11) 90000-0004» → «(11) 90000-0055»')
    expect(historico).toContain('Atualizou no processo, pela conversa, o data da perícia do INSS: «02/10/2026» → «16/10/2026»')
    expect(historico.at(-1)).toBe(
      'Conferiu a conversa de hoje: 2 confirmada(s), 1 corrigida(s), 1 desfeita(s); sem pendência; o caso segue de onde parou (Administrativo · perícia)',
    )
    expect(historico.join(' ')).not.toMatch(/Relatório da alta/)
  })

  it('CA3 e CA7 · o caso volta para onde estava: a etapa e a próxima ação do processo não mudam', async () => {
    const antes = (await obterFicha('maria-exemplo'))!.processos[0]
    const { c, id } = await transcritaDaMaria()
    const decisoes = ['endereco', 'telefone', 'pericia', 'documento'].map((campo) => ({ id: id(campo), decisao: 'confirmada' as const }))
    const { ficha } = await conferirConversa(c.id, { decisoes, pendencia: { surgiu: false } }, BRUNA)
    expect(ficha.processos[0]).toEqual(antes)
  })

  it('CA8 · o fato novo fica para o Jurídico, que confere só ele depois', async () => {
    const { c, id } = await transcritaDaMaria()
    const decisoes = ['endereco', 'telefone', 'pericia', 'documento'].map((campo) => ({ id: id(campo), decisao: 'desfeita' as const }))
    await conferirConversa(c.id, { decisoes, pendencia: { surgiu: false } }, BRUNA)
    await expect(conferirConversa(c.id, { decisoes: [{ id: id('fato'), decisao: 'confirmada' }] }, BRUNA)).rejects.toThrow('é de a advogada responsável ou a Sênior')
    const { gravacao, ficha } = await conferirConversa(c.id, { decisoes: [{ id: id('fato'), decisao: 'confirmada' }] }, PAULA)
    expect(gravacao!.extraidas.every((e) => e.conferidaEm)).toBe(true)
    expect(ficha.historico.at(-1)).toMatchObject({ quem: 'Dra. Paula (exemplo)', oQue: 'Registrou no processo um fato novo dito na conversa (dado de saúde: só o Jurídico vê)' })
    expect((await obterVersoes('maria-exemplo')).filter((v) => v.campo === 'fato').map((v) => v.valor)).toEqual(['Três dias no hospital no fim de setembro'])
  })

  it('CA2 · cada versão com quem e quando; só a Sênior volta uma versão, e a volta fica no histórico', async () => {
    const { c, id } = await transcritaDaMaria()
    const decisoes = ['endereco', 'telefone', 'pericia', 'documento'].map((campo) => ({ id: id(campo), decisao: 'confirmada' as const }))
    await conferirConversa(c.id, { decisoes, pendencia: { surgiu: false } }, BRUNA)
    const telefone = { fichaId: 'maria-exemplo', onde: 'ficha' as const, campo: 'telefone' as const }
    expect((await obterVersoes('maria-exemplo')).filter((v) => v.campo === 'telefone').map((v) => [v.valor, v.quem, v.origem])).toEqual([
      ['11900000004', 'Valor de antes da conversa', 'antes'],
      ['11900000044', 'Ana (exemplo)', 'conversa'],
    ])
    await expect(voltarParaVersao(telefone, 0, PAULA)).rejects.toThrow('Só a Sênior volta uma versão.')
    await expect(voltarParaVersao(telefone, 1, SENIOR)).rejects.toThrow('Essa já é a versão em vigor.')
    await expect(voltarParaVersao({ ...telefone, onde: 'processo', campo: 'fato' }, 0, SENIOR)).rejects.toThrow('não têm versão para voltar')
    const versoes = await voltarParaVersao(telefone, 0, SENIOR)
    expect(versoes.filter((v) => v.campo === 'telefone').at(-1)).toMatchObject({ valor: '11900000004', quem: 'Dra. Renata (exemplo)', origem: 'volta' })
    const ficha = (await obterFicha('maria-exemplo'))!
    expect(ficha.telefone).toBe('11900000004')
    expect(ficha.historico.at(-1)?.quem).toBe('Dra. Renata (exemplo)')
    expect(ficha.historico.at(-1)?.oQue).toMatch(/^Voltou o telefone de contato para a versão de .* \(Valor de antes da conversa\): «\(11\) 90000-0044» → «\(11\) 90000-0004»$/)
    // A data da perícia, campo do processo, também tem versão.
    const pericia = { fichaId: 'maria-exemplo', processoId: 'maria-exemplo-1', onde: 'processo' as const, campo: 'pericia' as const }
    await voltarParaVersao(pericia, 0, SENIOR)
    expect((await obterVersoes('maria-exemplo')).filter((v) => v.campo === 'pericia').at(-1)?.valor).toBe('2026-10-02')
  })
})

describe('Pendência da conversa vira tarefa · servidor de exemplo (GGVP-88)', () => {
  const JESSICA = { usuario: 'Jéssica (exemplo)', id: 'documentacao' as const }
  const RENATA = { usuario: 'Dra. Renata (exemplo)', id: 'senior' as const }

  async function conferidaCom(pendencia: NovaPendencia) {
    const c = await abrirConversa('maria-exemplo', { ...PRESENCIAL, modo: 'escrito', registro: 'Trouxe o relatório da alta; vai deixar com a Documentação.' }, BRUNA)
    return conferirConversa(c.id, { decisoes: [], pendencia }, BRUNA)
  }

  it('CA1 e CA4 · surgiu pendência: a tarefa nasce com o responsável, na Central dele, com o nome do cliente e o combinado embaixo', async () => {
    await expect(conferidaCom({ surgiu: true, texto: 'Receber o relatório da alta.', responsavel: '', prazo: '10/10/2026' })).rejects.toThrow('Escolha quem fica com a tarefa.')
    await expect(conferidaCom({ surgiu: true, texto: 'Receber o relatório da alta.', responsavel: 'Jéssica (exemplo)', prazo: '06/10/2026' })).rejects.toThrow('Prazo de hoje em diante')
    const { conversa, ficha } = await conferidaCom({ surgiu: true, texto: ' Documentação: receber e digitalizar o relatório da alta. ', responsavel: 'Jéssica (exemplo)', prazo: '10/10/2026' })
    expect(conversa.pendencia).toMatchObject({ texto: 'Documentação: receber e digitalizar o relatório da alta.', responsavel: 'Jéssica (exemplo)', setor: 'Documentação · ADM', prazo: '2026-10-10' })
    expect(ficha.historico.at(-1)?.oQue).toBe(
      'Conferiu a conversa de hoje: 0 confirmada(s), 0 corrigida(s), 0 desfeita(s); pendência para Jéssica (exemplo) (Documentação · ADM) até 10/10: Documentação: receber e digitalizar o relatório da alta.; o caso segue de onde parou (Administrativo · perícia)',
    )
    expect(tarefasDePendencia(JESSICA)).toEqual([
      {
        id: `pendencia-${conversa.id}`,
        codigo: 'D5.05',
        cliente: { id: 'maria-exemplo', nome: 'Maria Exemplo' },
        acao: 'Cumprir pendência',
        detalhe: 'Documentação: receber e digitalizar o relatório da alta.',
        prazo: 'vence 10/10',
        urgente: false,
        href: `/conversas/${conversa.id}/conferir`,
        processoId: 'maria-exemplo-1',
      },
    ])
    expect(tarefasDePendencia({ usuario: 'Ana (exemplo)', id: 'atendimento' })).toEqual([])
    // O caso volta ao D1 de onde parou: a etapa não muda.
    expect(ficha.processos[0].etapa).toBe('Administrativo · perícia')
  })

  it('CA2 · não surgiu pendência: nenhuma tarefa nasce', async () => {
    const { conversa } = await conferidaCom({ surgiu: false })
    expect(conversa.pendencia).toBeUndefined()
    expect(pessoasDoEscritorio().flatMap((p) => tarefasDePendencia({ usuario: p.nome, id: 'senior' }))).toEqual([])
  })

  it('CA5 · vencido o prazo, o lembrete e a tarefa urgente; três dias depois, a Sênior decide: prazo novo ou cumprida', async () => {
    const { conversa } = await conferidaCom({ surgiu: true, texto: 'Receber o relatório da alta.', responsavel: 'Jéssica (exemplo)', prazo: '08/10/2026' })
    configurarExemplo({ agora: () => new Date(2026, 9, 9, 9, 0) })
    expect(tarefasDePendencia(JESSICA)[0]).toMatchObject({ detalhe: 'Receber o relatório da alta. · lembrete: o prazo venceu em 08/10', prazo: 'venceu 08/10', urgente: true })
    expect(tarefasDePendencia(RENATA)).toEqual([])
    configurarExemplo({ agora: () => new Date(2026, 9, 11, 9, 0) })
    expect(tarefasDePendencia(RENATA)).toEqual([
      expect.objectContaining({ acao: 'Pendência atrasada', detalhe: 'Jéssica (exemplo) · Receber o relatório da alta. · venceu em 08/10 · novo prazo ou dar por cumprida', urgente: true }),
    ])
    await expect(novoPrazoDaPendencia(conversa.id, '15/10/2026', BRUNA)).rejects.toThrow('Só a Sênior')
    await expect(novoPrazoDaPendencia(conversa.id, '10/10/2026', { quem: RENATA.usuario, perfil: 'senior' })).rejects.toThrow('Prazo de hoje em diante')
    await novoPrazoDaPendencia(conversa.id, '15/10/2026', { quem: RENATA.usuario, perfil: 'senior' })
    expect(tarefasDePendencia(RENATA)).toEqual([])
    expect(tarefasDePendencia(JESSICA)[0]).toMatchObject({ prazo: 'vence 15/10', urgente: false })
  })

  it('o responsável ou a Sênior dá por cumprida; outra pessoa, não; cumprida, sai da Central', async () => {
    const { conversa } = await conferidaCom({ surgiu: true, texto: 'Receber o relatório da alta.', responsavel: 'Jéssica (exemplo)', prazo: '10/10/2026' })
    await expect(cumprirPendencia(conversa.id, BRUNA)).rejects.toThrow('A pendência é de Jéssica (exemplo)')
    const { ficha } = await cumprirPendencia(conversa.id, { quem: 'Jéssica (exemplo)', perfil: 'documentacao' })
    expect(ficha.historico.at(-1)).toMatchObject({ quem: 'Jéssica (exemplo)', oQue: 'Cumpriu a pendência da conversa: Receber o relatório da alta.' })
    expect(tarefasDePendencia(JESSICA)).toEqual([])
    await expect(cumprirPendencia(conversa.id, { quem: 'Jéssica (exemplo)', perfil: 'documentacao' })).rejects.toThrow('Não há pendência aberta')
  })
})
