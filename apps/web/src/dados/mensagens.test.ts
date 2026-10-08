import { beforeEach, describe, expect, it } from 'vitest'
import { linkDaConversa } from './chatwoot.ts'
import { NUNCA_PEDIMOS_A_SENHA } from '../regras/mensagens.ts'
import { enviarMensagem, mensagensDoCliente, prepararMensagem } from './mensagens.ts'
import { configurarExemplo, gravar, ler, obterFicha, zerarExemplo } from './servidor.ts'

const BRUNA = { quem: 'Ana (exemplo)', perfil: 'atendimento' as const }

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 7, 14, 32), latencia: 0 })
  zerarExemplo()
})

describe('Mensagens ao cliente · servidor de exemplo (GGVP-102)', () => {
  it('CA1 e CA3 · os modelos vêm preenchidos com os dados do cliente e do caso, em frases curtas', async () => {
    expect((await prepararMensagem('josefa-exemplo', 'convite')).texto).toMatch(/^Olá, Josefa! Sua conversa com o escritório GGV está marcada para quarta, 07\/10, às 15h30, aqui no escritório\./)
    expect((await prepararMensagem('josefa-exemplo', 'lembrete')).texto).toBe(
      'Olá, Josefa! Lembrete: sua conversa com o escritório GGV é quarta, 07/10, às 15h30, aqui no escritório. Traga RG, CPF e os laudos. O escritório nunca pede a sua senha do gov.br por mensagem.',
    )
    expect((await prepararMensagem('maria-exemplo', 'boas-vindas')).texto).toBe(
      'Olá, Maria! Boas-vindas ao escritório GGV. Seu caso de Auxílio por Incapacidade Temporária começou. Qualquer dúvida, fale com a gente por aqui. O escritório nunca pede a sua senha do gov.br por mensagem.',
    )
    const pericia = await prepararMensagem('maria-exemplo', 'pericia-orientacao')
    expect(pericia).toMatchObject({ editavel: true, trava: null })
    expect(pericia.texto).toBe(
      'Olá, Maria! Sua perícia no INSS é sexta, 02/10. Chegue 30 minutos antes. Leve RG, os laudos originais, exames e receitas, em ordem de data. Conte ao perito, com a verdade, o que você sente no dia a dia. O escritório nunca pede a sua senha do gov.br por mensagem.',
    )
    expect((await prepararMensagem('maria-exemplo', 'cobranca')).texto).toContain('Olá, Maria!')
    expect((await prepararMensagem('antonio-exemplo', 'convite')).trava).toBe('Sem entrevista marcada: marque na agenda.')
    expect((await prepararMensagem('antonio-exemplo', 'pericia-presenca')).trava).toBe('Sem perícia marcada no processo.')
  })

  it('CA7 · o resultado favorável só depois do OK da advogada, com o texto que ela revisou (G8)', async () => {
    const lucia = await prepararMensagem('lucia-exemplo', 'resultado-favoravel')
    expect(lucia).toMatchObject({ editavel: false, trava: null })
    expect(lucia.texto).toMatch(/^Olá, Lúcia! Boa notícia: o juiz deu a pensão por morte para você\./)
    const antonio = await prepararMensagem('antonio-exemplo', 'resultado-favoravel')
    expect(antonio.trava).toBe('Falta o OK da advogada na prestação de contas: o aviso só sai depois dele (G8).')
    await expect(enviarMensagem('antonio-exemplo', { modelo: 'resultado-favoravel', texto: 'Ganhamos!', conversa: 4102 }, BRUNA)).rejects.toThrow('(G8)')
    await expect(enviarMensagem('lucia-exemplo', { modelo: 'resultado-favoravel', texto: `${lucia.texto} Mudei.`, conversa: lucia.conversas[0].id }, BRUNA)).rejects.toThrow(
      'O texto aprovado não muda',
    )
  })

  it('CA8 · o resultado desfavorável usa só o texto aprovado pelo Jurídico', async () => {
    expect((await prepararMensagem('maria-exemplo', 'resultado-desfavoravel')).trava).toBe('Falta o texto aprovado pelo Jurídico: o aviso usa só esse texto, sem estratégia interna.')
    const banco = ler()
    banco.avisosAprovados = [{ processoId: 'maria-exemplo-1', tipo: 'desfavoravel', texto: 'Olá, Maria. O INSS negou o pedido. Vamos te ligar para explicar o que dá para fazer.', quem: 'Dra. Paula (exemplo)', quando: '2026-10-07T10:00:00.000Z' }]
    gravar(banco)
    expect(await prepararMensagem('maria-exemplo', 'resultado-desfavoravel')).toMatchObject({ editavel: false, trava: null, texto: 'Olá, Maria. O INSS negou o pedido. Vamos te ligar para explicar o que dá para fazer. ' + NUNCA_PEDIMOS_A_SENHA })
  })

  it('CA6 · o contato e as conversas do cliente no Chatwoot, a de mais mensagens primeiro; o número dividido acha o contato certo', async () => {
    const antonio = await prepararMensagem('antonio-exemplo', 'boas-vindas')
    expect(antonio.contato).toMatchObject({ nome: 'Antônio Exemplo', telefone: '11900000001' })
    expect(antonio.conversas.map((c) => [c.id, c.mensagens, c.situacao])).toEqual([
      [4102, 14, 'aberta'],
      [4101, 3, 'resolvida'],
    ])
    expect(linkDaConversa(4102)).toMatch(/^https:\/\/chatwoot\.mapech\.com\.br\/app\/accounts\/.+\/conversations\/4102$/)
    // Mãe e filha com o mesmo celular: cada uma acha o próprio contato.
    expect((await prepararMensagem('nair-exemplo', 'boas-vindas')).contato?.nome).toBe('Nair Exemplo')
    expect((await prepararMensagem('marta-exemplo', 'boas-vindas')).contato).toBeNull()
  })

  it('CA2 e CA4 · enviada pelo Chatwoot: o texto final, o canal, a data, a hora e o status no card e no histórico; a mesma mensagem não sai duas vezes', async () => {
    const pronta = await prepararMensagem('maria-exemplo', 'pericia-orientacao')
    const enviada = await enviarMensagem('maria-exemplo', { modelo: 'pericia-orientacao', texto: ` ${pronta.texto} `, conversa: pronta.conversas[0].id }, BRUNA)
    expect(enviada).toMatchObject({ fichaId: 'maria-exemplo', processoId: 'maria-exemplo-1', modelo: 'pericia-orientacao', texto: pronta.texto, canal: 'Chatwoot', quando: new Date(2026, 9, 7, 14, 32).toISOString(), quem: 'Ana (exemplo)', status: 'entregue' })
    const ficha = (await obterFicha('maria-exemplo'))!
    expect(ficha.contatos.at(-1)).toEqual({ data: '2026-10-07', canal: 'Chatwoot · 14:32 · entregue', texto: pronta.texto })
    expect(ficha.historico.at(-1)).toMatchObject({ quem: 'Ana (exemplo)', oQue: 'Enviou pelo Chatwoot a mensagem «Perícia: data, o que levar e orientação» (entregue)' })
    const deNovo = await enviarMensagem('maria-exemplo', { modelo: 'pericia-orientacao', texto: pronta.texto, conversa: pronta.conversas[0].id }, BRUNA)
    expect(deNovo.id).toBe(enviada.id)
    expect((await mensagensDoCliente('maria-exemplo')).length).toBe(1)
  })

  it('CA5 · a falha do canal fica registrada e no histórico, sem reenvio sozinho; sem contato, também', async () => {
    const pronta = await prepararMensagem('nair-exemplo', 'boas-vindas')
    const falhou = await enviarMensagem('nair-exemplo', { modelo: 'boas-vindas', texto: pronta.texto, conversa: pronta.conversas[0].id }, BRUNA)
    expect(falhou).toMatchObject({ status: 'falhou', erro: 'o WhatsApp recusou: o número não tem WhatsApp' })
    const ficha = (await obterFicha('nair-exemplo'))!
    expect(ficha.historico.at(-1)?.oQue).toBe('A mensagem «Boas-vindas» não saiu pelo Chatwoot: o WhatsApp recusou: o número não tem WhatsApp. Nada foi reenviado sozinho.')
    expect(ficha.contatos.at(-1)?.canal).toBe('Chatwoot · 14:32 · não saiu')
    expect((await mensagensDoCliente('nair-exemplo')).length).toBe(1)
    const marta = await enviarMensagem('marta-exemplo', { modelo: 'boas-vindas', texto: 'Olá, Marta! Boas-vindas ao escritório GGV.', conversa: 0 }, BRUNA)
    expect(marta).toMatchObject({ status: 'falhou', erro: 'o Chatwoot não achou o contato deste telefone', conversa: 0 })
  })

  it('CA9 e G9 · o texto revisado que esconde a situação, sugere diagnóstico ou pede a senha não sai', async () => {
    const pronta = await prepararMensagem('maria-exemplo', 'pericia-orientacao')
    const conversa = pronta.conversas[0].id
    await expect(enviarMensagem('maria-exemplo', { modelo: 'pericia-orientacao', texto: 'Não conte ao perito que voltou a trabalhar.', conversa }, BRUNA)).rejects.toThrow('(G11)')
    await expect(enviarMensagem('maria-exemplo', { modelo: 'pericia-orientacao', texto: 'Diga ao perito que tem M54.5.', conversa }, BRUNA)).rejects.toThrow('(G20)')
    await expect(enviarMensagem('maria-exemplo', { modelo: 'pericia-orientacao', texto: 'Mande a sua senha do gov.br.', conversa }, BRUNA)).rejects.toThrow('(G9)')
    await expect(enviarMensagem('maria-exemplo', { modelo: 'pericia-orientacao', texto: pronta.texto, conversa: 999 }, BRUNA)).rejects.toThrow('Escolha a conversa do cliente no Chatwoot.')
    expect(await mensagensDoCliente('maria-exemplo')).toEqual([])
  })
})
