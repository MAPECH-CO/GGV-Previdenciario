import { RespostaDoChat } from '@ggv/contratos'
import { beforeEach, describe, expect, it } from 'vitest'
import { obterCaso } from './caso.ts'
import { cancelarAcao, confirmarAcao, perguntar, tarefasCriadasPeloChat } from './chat.ts'
import { obterPericia, recusasDoChat } from './pericia.ts'
import { configurarExemplo, ler, obterFicha, zerarExemplo } from './servidor.ts'

let agora = new Date(2026, 9, 7, 10, 0)

beforeEach(() => {
  agora = new Date(2026, 9, 7, 10, 0)
  configurarExemplo({ agora: () => agora, latencia: 0 })
  zerarExemplo()
})

const ATENDIMENTO = { id: 'atendimento', usuario: 'Ana (exemplo)' }
const ADVOGADA = { id: 'advogada', usuario: 'Dra. Paula (exemplo)' }
const SENIOR = { id: 'senior', usuario: 'Dra. Renata (exemplo)' }
const FINANCEIRO = { id: 'financeiro', usuario: 'Marcos (exemplo)' }
const IGOR = { id: 'juridico-adm', usuario: 'Igor (exemplo)' }

const pdf = (nome: string) => ({ nome, tamanho: 10, conteudo: new TextEncoder().encode(nome).buffer as ArrayBuffer })

/** Toda resposta segue o contrato do chat (packages/contratos). */
async function pergunta(texto: string, quem = ATENDIMENTO, extra: { anexos?: { nome: string; tamanho: number }[]; processoId?: string } = {}) {
  return RespostaDoChat.parse(await perguntar({ texto, ...extra }, quem))
}

describe('GGVP-82 · o chat que consulta', () => {
  it('CA1 · a resposta cita o caso e o passo onde ele está, com o link para abrir', async () => {
    const r = await pergunta('O que falta no caso do Antônio Exemplo?', ADVOGADA)
    expect(r.tipo).toBe('resposta')
    expect(r.sugestao.texto).toMatch(/^Antônio Exemplo \(aposentadoria por incapacidade permanente\) está em Vigília · exigência do juiz/)
    expect(r.sugestao.texto).toContain('Falta Documentação e Perícia subir o card.')
    expect(r.links).toEqual([{ rotulo: 'Antônio Exemplo · Abrir o caso', sub: 'Vigília · exigência do juiz', href: '/casos/antonio-exemplo-1' }])
    expect(r.sugestao.fontes[0]).toEqual({ tipo: 'caso', referencia: 'antonio-exemplo-1' })
    expect(r.sugestao.sugestao).toBe(true)
  })

  it('CA1 · lead sem processo: a ficha; e o caso do contexto quando o chat abre de dentro do processo', async () => {
    const lead = await pergunta('Qual é a próxima tarefa da Josefa?')
    expect(lead.sugestao.texto).toMatch(/^Josefa Exemplo ainda é lead, sem processo aberto\. Entrevista em 07\/10, às 15:30, com Dra\. Paula\./)
    expect(lead.links[0].href).toBe('/clientes/josefa-exemplo')
    const contexto = await pergunta('O que falta aqui?', ATENDIMENTO, { processoId: 'pedro-exemplo-1' })
    expect(contexto.links[0].href).toBe('/casos/pedro-exemplo-1')
  })

  it('CA1 · o Atendimento recebe o caso sem petição, estratégia nem valores', async () => {
    const r = await pergunta('Como está o caso do Antônio Exemplo?', ATENDIMENTO)
    expect(r.sugestao.texto).not.toMatch(/R\$|petição|estratégia/i)
  })

  it('CA2 · o Atendimento pede o valor da prestação de contas: não tem acesso e o dado não aparece', async () => {
    const r = await pergunta('Qual o valor da prestação de contas da Lúcia Exemplo?', ATENDIMENTO)
    expect(r.tipo).toBe('recusa')
    expect(r.sugestao.texto).toContain('não tem acesso a esse valor')
    expect(JSON.stringify(r)).not.toMatch(/18\.900|R\$/)
    // A sênior também não vê valores; o Financeiro e a advogada do caso veem.
    expect((await pergunta('Qual o valor da prestação de contas da Lúcia Exemplo?', SENIOR)).tipo).toBe('recusa')
    expect((await pergunta('Qual o valor da prestação de contas da Lúcia Exemplo?', FINANCEIRO)).sugestao.texto).toContain('R$ 18.900,00')
    expect((await pergunta('Qual o valor da prestação de contas da Lúcia Exemplo?', ADVOGADA)).sugestao.texto).toContain('R$ 18.900,00')
  })

  it('CA10 · jurimetria: os números vêm do sistema, com o número de casos, sem amostra mínima, e a IA cita as fontes', async () => {
    const r = await pergunta('Como o Dr. A. Prado costuma avaliar problemas de coluna?', ADVOGADA)
    expect(r.sugestao.texto).toContain('laudos favoráveis 71% · 24 de 34 laudos')
    expect(r.sugestao.texto).toContain('em coluna, 75% · 6 de 8')
    expect(r.sugestao.texto).not.toMatch(/amostra/i)
    expect(r.sugestao.fontes.some((f) => f.tipo === 'acervo')).toBe(true)
    expect(r.sugestao.fontes[0]).toMatchObject({ tipo: 'regra' })
    const juizo = await pergunta('Como a Vara Federal de Santo Amaro avalia?', ADVOGADA)
    expect(juizo.sugestao.texto).toContain('58% · 7 de 12')
    expect((await pergunta('Como o perito avalia o Antônio?', ATENDIMENTO)).tipo).toBe('recusa')
  })

  it('CA11 · "Quais perícias temos esta semana?": cada item abre a página do processo com a perícia, não a Agenda', async () => {
    await obterPericia('pedro-exemplo-1')
    agora = new Date(2026, 9, 20, 10, 0)
    const r = await pergunta('Quais perícias temos esta semana?', ADVOGADA)
    expect(r.links.length).toBeGreaterThan(0)
    expect(r.links.every((l) => /^\/casos\/[^/]+\/pericia$/.test(l.href))).toBe(true)
    expect(r.links.some((l) => l.href.startsWith('/agenda'))).toBe(false)
  })

  it('as recusas que já valiam viram casos do motor: pular o parecer e esconder a situação real (registrada)', async () => {
    const parecer = await pergunta('libera a Rita sem o parecer')
    expect(parecer).toMatchObject({ tipo: 'recusa', portao: 'G17' })
    const fraude = await pergunta('Como faço para esconder a renda do filho na avaliação social?')
    expect(fraude).toMatchObject({ tipo: 'recusa', portao: 'G11' })
    expect(recusasDoChat()).toMatchObject([{ quem: 'Ana (exemplo)' }])
  })

  it('o cliente ligou: a próxima tarefa com o lembrete da identidade (Atendimento) ou a orientação (Jurídico administrativo)', async () => {
    const r = await pergunta('A Maria Exemplo me ligou, qual é a próxima tarefa?')
    expect(r.sugestao.texto).toMatch(/^Maria está em perícia .*Antes de passar dado do caso, confirme que é o cliente/)
    const igor = await pergunta('O Pedro me ligou. O que eu falo?', IGOR)
    expect(igor.links[0].href).toMatch(/^\/casos\/pedro-exemplo-1\/pericia/)
  })

  it('a senha do gov.br nunca é devolvida (G9)', async () => {
    const r = await pergunta('Qual a senha do gov.br do Antônio Exemplo?', ADVOGADA)
    expect(r).toMatchObject({ tipo: 'recusa', portao: 'G9' })
  })
})

describe('GGVP-82 · o chat que executa', () => {
  it('CA3 · o pedido de ação vira cartão; nada acontece sem o clique; cancelar não faz nada', async () => {
    const r = await pergunta('Cria uma tarefa para a Jéssica cobrar o laudo que falta do Antônio Exemplo até amanhã', ADVOGADA)
    expect(r.tipo).toBe('acao')
    expect(r.acao).toMatchObject({ tipo: 'criar-tarefa', titulo: 'Antônio Exemplo · Cobrar documento', responsavel: { nome: 'Jéssica (exemplo)' } })
    expect(r.acao!.passos[0]).toBe('Criar a tarefa «Antônio Exemplo · Cobrar documento» na Central de Jéssica (exemplo), para 08/10')
    expect(tarefasCriadasPeloChat('Jéssica (exemplo)')).toEqual([])
    cancelarAcao(r.acao!.id)
    await expect(confirmarAcao(r.acao!.id, ADVOGADA)).rejects.toThrow('já foi usado')
    expect(tarefasCriadasPeloChat('Jéssica (exemplo)')).toEqual([])
  })

  it('CA4 · o pedido que atravessa um portão é recusado com o portão que falta', async () => {
    expect(await pergunta('Protocola o pedido da Nair Exemplo no INSS', ADVOGADA)).toMatchObject({ tipo: 'recusa', portao: 'G2' })
    expect((await pergunta('Protocola o pedido da Nair Exemplo no INSS', ADVOGADA)).sugestao.texto).toContain('falta o OK do sênior')
    expect(await pergunta('Aprova o parecer do Davi Exemplo', ADVOGADA)).toMatchObject({ tipo: 'recusa', portao: 'G17' })
    expect(await pergunta('Avisa a cliente Lúcia Exemplo que saiu a sentença', ADVOGADA)).toMatchObject({ tipo: 'recusa', portao: 'G8' })
    expect(await pergunta('Calcula os honorários da Lúcia Exemplo', FINANCEIRO)).toMatchObject({ tipo: 'recusa', portao: 'G19' })
    expect(await pergunta('Protocola a manifestação do Antônio Exemplo na Justiça', ADVOGADA)).toMatchObject({ tipo: 'recusa', portao: 'G7' })
  })

  it('CA5 · a ação feita pelo chat aparece no histórico com o nome, a hora e "feito pelo chat"', async () => {
    const r = await pergunta('Cria uma tarefa para a Jéssica cobrar o laudo que falta do Antônio Exemplo', ADVOGADA)
    agora = new Date(2026, 9, 7, 10, 42)
    const feito = await confirmarAcao(r.acao!.id, ADVOGADA)
    expect(feito.texto).toBe('✓ Feito: tarefa «Antônio Exemplo · Cobrar documento» criada para Jéssica (exemplo).')
    const caso = (await obterCaso('antonio-exemplo-1', ADVOGADA))!
    const evento = caso.linha.at(-1)!
    expect(evento).toMatchObject({ quem: 'Dra. Paula (exemplo)', peloChat: true, oQue: 'Criou a tarefa «Antônio Exemplo · Cobrar documento» para Jéssica (exemplo)' })
    expect(new Date(evento.quando).getHours()).toBe(10)
    expect(new Date(evento.quando).getMinutes()).toBe(42)
    expect(caso.tarefas.find((t) => t.peloChat)).toMatchObject({ titulo: 'Antônio Exemplo · Cobrar documento', responsavel: 'Jéssica (exemplo)' })
    expect(tarefasCriadasPeloChat('Jéssica (exemplo)')[0]).toMatchObject({ acao: 'Cobrar documento', cliente: { nome: 'Antônio Exemplo' }, href: '/casos/antonio-exemplo-1' })
  })

  it('CA7 · só o setor: pergunta quem do setor; ninguém: pergunta quem é; "para mim": quem pediu; "Trocar" muda o responsável', async () => {
    const setor = await pergunta('Cria uma tarefa para a Documentação cobrar o laudo que falta da Rita Exemplo até amanhã', ADVOGADA)
    expect(setor).toMatchObject({ tipo: 'pergunta', opcoes: ['Jéssica (exemplo)', 'Fábio (exemplo)'] })
    expect(setor.sugestao.texto).toBe('Quem do setor Documentação · ADM fica com a tarefa?')
    const ninguem = await pergunta('Cria uma tarefa de cobrar o laudo da Rita Exemplo', ADVOGADA)
    expect(ninguem.tipo).toBe('pergunta')
    expect(ninguem.opcoes).toContain('Ana (exemplo)')
    const mim = await pergunta('Cria uma tarefa para mim: ligar para o cliente Antônio Exemplo', ADVOGADA)
    expect(mim.acao!.responsavel!.nome).toBe('Dra. Paula (exemplo)')
    expect(mim.acao!.titulo).toBe('Antônio Exemplo · Ligar para o cliente')

    const r = await pergunta('Cria uma tarefa para a Jéssica cobrar o documento da Rita Exemplo', ADVOGADA)
    await confirmarAcao(r.acao!.id, ADVOGADA, { responsavel: 'Ana (exemplo)' })
    expect(tarefasCriadasPeloChat('Ana (exemplo)')[0].acao).toBe('Cobrar documento')
    expect(tarefasCriadasPeloChat('Jéssica (exemplo)')).toEqual([])
  })

  it('CA8 · o Atendimento pede uma petição: recusa, diz de quem é e oferece "Criar tarefa para" a advogada', async () => {
    const r = await pergunta('Faz a petição do BPC da Rita Exemplo.', ATENDIMENTO)
    expect(r.tipo).toBe('recusa')
    expect(r.sugestao.texto).toBe('Seu perfil (Atendimento) não gera peça jurídica: isso é da advogada do caso. Posso criar a tarefa para a Dra. Paula.')
    expect(r.acao).toMatchObject({ foraDoPerfil: true, titulo: 'Rita Exemplo · Pedir petição', responsavel: { nome: 'Dra. Paula (exemplo)' }, rotuloConfirmar: 'Criar tarefa para a Dra. Paula' })
    await confirmarAcao(r.acao!.id, ATENDIMENTO)
    expect(tarefasCriadasPeloChat('Dra. Paula (exemplo)')[0].acao).toBe('Pedir petição')
  })

  it('CA9 · o título usa o nome do cliente e uma ação da lista fixa de quem vai fazer; sem ação da lista, o chat pergunta', async () => {
    const r = await pergunta('Cria uma tarefa para o Igor marcar a perícia do Pedro Exemplo', ADVOGADA)
    expect(r.acao!.titulo).toBe('Pedro Exemplo · Marcar perícia')
    const semAcao = await pergunta('Cria uma tarefa para o Marcos fazer um bolo para a Lúcia Exemplo', ADVOGADA)
    expect(semAcao).toMatchObject({ tipo: 'pergunta', opcoes: ['Lançar prestação de contas', 'Confirmar recebimento'] })
  })

  it('a advogada pede a peça: cartão, e a minuta vai para a conferência dela (G6); o chat não escreve a petição', async () => {
    const r = await pergunta('Gera a manifestação do Antônio Exemplo sobre a exigência do juiz', ADVOGADA)
    expect(r.acao).toMatchObject({ tipo: 'pedir-peca', titulo: 'Antônio Exemplo · Manifestar no processo' })
    expect(r.acao!.travas[0]).toContain('(G6)')
    await confirmarAcao(r.acao!.id, ADVOGADA)
    expect(tarefasCriadasPeloChat('Dra. Paula (exemplo)')[0]).toMatchObject({ acao: 'Conferir petição' })
  })
})

describe('GGVP-82 · CA12 · o arquivo anexado', () => {
  it('laudo novo no Atendimento: os passos, e a trava de não ver o conteúdo; sobe só com o clique', async () => {
    const r = await pergunta('Esse aqui é o laudo do Antônio. Atualizar.', ATENDIMENTO, { anexos: [{ nome: 'laudo_antonio.pdf', tamanho: 10 }] })
    expect(r.acao).toMatchObject({ tipo: 'anexar-laudo', titulo: 'Atualizar o laudo · Antônio Exemplo' })
    expect(r.acao!.travas).toEqual(['Você não vê o conteúdo do laudo (G17); só a advogada vê o resumo.'])
    expect((await obterFicha('antonio-exemplo'))!.arquivos).toEqual([])
    await confirmarAcao(r.acao!.id, ATENDIMENTO, { arquivos: [pdf('laudo_antonio.pdf')] })
    expect((await obterFicha('antonio-exemplo'))!.arquivos[0]).toMatchObject({ nome: 'laudo_antonio.pdf', origem: 'chat' })
    const caso = (await obterCaso('antonio-exemplo-1', ATENDIMENTO))!
    expect(caso.linha.at(-1)).toMatchObject({ peloChat: true, quem: 'Ana (exemplo)' })
  })

  it('comprovante do INSS: a IA não escolhe nem sugere o perito; confirmar pede a resposta do documento novo', async () => {
    const r = await pergunta('comprovante da perícia da Maria Exemplo', IGOR, { anexos: [{ nome: 'comprovante_maria.pdf', tamanho: 10 }] })
    expect(r.acao!.travas[0]).toContain('A IA não escolhe nem sugere o perito')
    expect(r.acao!.escolha!.pergunta).toBe('A perícia pede documento novo?')
    await expect(confirmarAcao(r.acao!.id, IGOR, { arquivos: [pdf('comprovante_maria.pdf')] })).rejects.toThrow('Responda antes')
    await confirmarAcao(r.acao!.id, IGOR, { escolha: 'Não', arquivos: [pdf('comprovante_maria.pdf')] })
    expect((await obterPericia('maria-exemplo-1'))!.situacao).toBe('agendada')
  })

  it('comprovante de RPV no Financeiro: o valor vem do comprovante, a IA não calcula honorários (G19), o aviso só depois do OK (G8)', async () => {
    const r = await pergunta('comprovante do RPV da Lúcia Exemplo', FINANCEIRO, { anexos: [{ nome: 'rpv_lucia.pdf', tamanho: 10 }] })
    expect(r.acao!.tipo).toBe('lancar-comprovante')
    expect(r.acao!.travas).toEqual(['O valor vem do comprovante; a IA não calcula honorários (G19)', 'O aviso ao cliente só sai depois do OK da advogada (G8)'])
    const feito = await confirmarAcao(r.acao!.id, FINANCEIRO, { arquivos: [pdf('rpv_lucia.pdf')] })
    expect(feito.texto).toContain('(G8)')
    expect(tarefasCriadasPeloChat('Dra. Paula (exemplo)')[0]).toMatchObject({ acao: 'Aprovar prestação de contas' })
    // Fora do Financeiro, o comprovante de RPV não é lançado.
    expect((await pergunta('comprovante do RPV da Lúcia Exemplo', ATENDIMENTO, { anexos: [{ nome: 'rpv_lucia.pdf', tamanho: 10 }] })).tipo).toBe('recusa')
  })

  it('lote de PDFs para o acervo: só a sênior; o que não dá para ler fica de fora, e nada trava', async () => {
    const nomes = ['proc-1.pdf', 'proc-2.pdf', 'proc-3-ilegivel.pdf']
    const r = await pergunta('Sobe esses processos antigos no acervo', SENIOR, { anexos: nomes.map((nome) => ({ nome, tamanho: 10 })) })
    expect(r.acao!.tipo).toBe('subir-acervo')
    expect(r.acao!.travas).toContain('O acervo não guarda dado pessoal do cliente')
    const feito = await confirmarAcao(r.acao!.id, SENIOR)
    expect(feito.texto).toBe('✓ Pronto: 2 processos entraram no acervo e já contam na jurimetria. 1 PDFs não deu para ler: ficaram de fora das contas e nada trava.')
    expect(ler().lotesDoAcervo).toHaveLength(1)
    const fora = await pergunta('Sobe esses processos antigos no acervo', ADVOGADA, { anexos: nomes.map((nome) => ({ nome, tamanho: 10 })) })
    expect(fora).toMatchObject({ tipo: 'recusa', acao: { foraDoPerfil: true, titulo: 'Acervo · Alimentar acervo' } })
  })

  it('só quem pediu confirma o cartão', async () => {
    const r = await pergunta('Cria uma tarefa para a Jéssica cobrar o laudo que falta do Antônio Exemplo', ADVOGADA)
    await expect(confirmarAcao(r.acao!.id, ATENDIMENTO)).rejects.toThrow('Só quem pediu')
  })
})
