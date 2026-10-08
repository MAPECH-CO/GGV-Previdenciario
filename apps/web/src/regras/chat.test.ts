import { describe, expect, it } from 'vitest'
import { acaoDaLista, entenderPedido, foraDoPerfil, grupoDoPerfil, portaoDoPedido, responsavelDaTarefa, tipoDoAnexo, tituloDaTarefa } from './chat.ts'

const PESSOAS = [
  { nome: 'Ana (exemplo)', setor: 'Atendimento' },
  { nome: 'Dra. Paula (exemplo)', setor: 'Jurídico' },
  { nome: 'Dra. Renata (exemplo)', setor: 'Jurídico' },
  { nome: 'Jéssica (exemplo)', setor: 'Documentação · ADM' },
  { nome: 'Igor (exemplo)', setor: 'Jurídico' },
  { nome: 'Marcos (exemplo)', setor: 'Financeiro' },
]
const PAULA = PESSOAS[1]

describe('GGVP-82 · o que o pedido quer', () => {
  it.each([
    ['O que falta no caso da Maria?', 'consulta'],
    ['Qual é a próxima tarefa da Josefa?', 'consulta'],
    ['Qual o valor da prestação de contas da Lúcia?', 'valor'],
    ['Como o Dr. A. Prado avalia problemas de coluna?', 'jurimetria'],
    ['Como o perito avalia?', 'jurimetria'],
    ['Quais perícias temos esta semana?', 'pericias-semana'],
    ['Perícias para marcar', 'pericias-marcar'],
    ['O Antônio me ligou. Qual é a próxima tarefa dele?', 'cliente-ligou'],
    ['Dica para a perícia do Antônio', 'dica-pericia'],
    ['Cria uma tarefa para a Documentação cobrar o laudo que falta da Josefa até amanhã.', 'criar-tarefa'],
    ['Faz a petição do BPC da Josefa.', 'pedir-peca'],
    ['Gera a manifestação do Antônio sobre a exigência do juiz', 'pedir-peca'],
    ['Marca a perícia do Pedro para terça', 'marcar'],
    ['Protocola o pedido da Nair no INSS', 'protocolar'],
    ['Aprova o parecer do Davi', 'aprovar'],
    ['Avisa a cliente Lúcia que saiu a sentença', 'avisar-cliente'],
    ['Quanto o cliente vai receber de honorários?', 'honorarios'],
    ['Qual a senha do gov.br do Antônio?', 'senha'],
    ['Qual perito você sugere para o Pedro?', 'escolher-perito'],
    ['Quais prestações de contas chegaram?', 'prestacoes'],
    ['O que estourou o limite hoje?', 'limite'],
    ['Sobe esses processos antigos no acervo', 'subir-acervo'],
  ])('"%s" → %s', (texto, intencao) => {
    expect(entenderPedido(texto)).toBe(intencao)
  })
})

describe('GGVP-82 · CA4 · o pedido que atravessa um portão', () => {
  it('protocolar no INSS sem o OK do sênior: G2; na Justiça: G7; com o OK, segue', () => {
    expect(portaoDoPedido('protocolar', 'protocola a Nair', { fase: 'administrativa', aprovadoPelaSenior: false })).toEqual({
      portao: 'G2',
      texto: 'Não dá para protocolar: falta o OK do sênior (G2). Nada vai ao INSS sem ele.',
    })
    expect(portaoDoPedido('protocolar', 'protocola na justiça', {})!.portao).toBe('G7')
    expect(portaoDoPedido('protocolar', 'protocola o Antônio', { fase: 'judicial', aprovadoPelaSenior: true })!.portao).toBe('G7')
    expect(portaoDoPedido('protocolar', 'protocola a Maria', { fase: 'administrativa', aprovadoPelaSenior: true })).toBeNull()
  })

  it('a IA nunca aprova parecer, despacho, petição nem exigência', () => {
    expect(portaoDoPedido('aprovar', 'aprova o parecer do Davi')!.portao).toBe('G17')
    expect(portaoDoPedido('aprovar', 'despacha o caso')!.portao).toBe('G4')
    expect(portaoDoPedido('aprovar', 'aprova a petição')!.portao).toBe('G6')
    expect(portaoDoPedido('aprovar', 'aprova a exigência')!.portao).toBe('G5')
  })

  it('senha (G9), honorários (G19), aviso ao cliente (G8) e o perito (a IA não escolhe)', () => {
    expect(portaoDoPedido('senha', 'senha')!.portao).toBe('G9')
    expect(portaoDoPedido('honorarios', 'quanto')!.portao).toBe('G19')
    expect(portaoDoPedido('avisar-cliente', 'avisa')!.portao).toBe('G8')
    expect(portaoDoPedido('escolher-perito', 'qual perito')!.texto).toContain('A IA não escolhe nem sugere o perito')
    expect(portaoDoPedido('consulta', 'o que falta')).toBeNull()
  })
})

describe('GGVP-82 · CA7 · quem fica com a tarefa', () => {
  it('cita a pessoa: é ela', () => {
    expect(responsavelDaTarefa('cria tarefa para a Jéssica cobrar o laudo', PAULA, PESSOAS)).toEqual({ tipo: 'pessoa', pessoa: PESSOAS[3] })
    expect(responsavelDaTarefa('tarefa para a Dra. Renata despachar', PAULA, PESSOAS)).toEqual({ tipo: 'pessoa', pessoa: PESSOAS[2] })
  })

  it('cita só o setor: pergunta quem do setor', () => {
    expect(responsavelDaTarefa('cria uma tarefa para a Documentação cobrar o laudo', PAULA, PESSOAS)).toEqual({
      tipo: 'perguntar-setor',
      setor: 'Documentação · ADM',
      opcoes: [PESSOAS[3]],
    })
  })

  it('não cita ninguém: pergunta quem é; quem pediu só fica quando se indica', () => {
    expect(responsavelDaTarefa('cria uma tarefa de cobrar o laudo da Josefa', PAULA, PESSOAS)).toEqual({ tipo: 'perguntar-quem', opcoes: PESSOAS })
    expect(responsavelDaTarefa('cria uma tarefa para mim: ligar para o Antônio', PAULA, PESSOAS)).toEqual({ tipo: 'pessoa', pessoa: PAULA })
  })
})

describe('GGVP-82 · CA9 · o título usa o cliente e uma ação da lista fixa de quem vai fazer', () => {
  it('a ação sai da lista do perfil de quem vai fazer', () => {
    expect(acaoDaLista('cobrar o laudo que falta da Josefa', 'atendimento')).toBe('Cobrar documento')
    expect(acaoDaLista('marcar a perícia do Pedro', 'juridico-adm')).toBe('Marcar perícia')
    expect(acaoDaLista('pedir a petição do BPC', 'advogada')).toBe('Pedir petição')
    expect(acaoDaLista('lançar a prestação de contas da Lúcia', 'financeiro')).toBe('Lançar prestação de contas')
    expect(acaoDaLista('fazer um bolo', 'atendimento')).toBeNull()
    expect(tituloDaTarefa('Josefa Exemplo', 'Cobrar documento')).toBe('Josefa Exemplo · Cobrar documento')
  })

  it('o grupo da lista de cada perfil', () => {
    expect(grupoDoPerfil('documentacao')).toBe('atendimento')
    expect(grupoDoPerfil('juridico-adm')).toBe('juridico-adm')
  })
})

describe('GGVP-82 · CA8 · pedido fora do perfil', () => {
  it('o Atendimento pede petição: é da advogada; a advogada pode', () => {
    expect(foraDoPerfil('pedir-peca', 'atendimento')).toEqual({ dono: 'advogada', quem: 'da advogada do caso', acao: 'Pedir petição' })
    expect(foraDoPerfil('pedir-peca', 'advogada')).toBeNull()
    expect(foraDoPerfil('subir-acervo', 'advogada')!.acao).toBe('Alimentar acervo')
    expect(foraDoPerfil('marcar', 'financeiro')!.acao).toBe('Marcar perícia')
  })
})

describe('GGVP-82 · CA12 · o que é o arquivo anexado', () => {
  it.each([
    ['laudo do Antônio', ['laudo_antonio.pdf'], 'laudo'],
    ['comprovante da perícia da Maria', ['comprovante.pdf'], 'comprovante-inss'],
    ['comprovante do RPV da Lúcia', ['rpv_lucia.pdf'], 'comprovante-rpv'],
    ['sobe no acervo', ['a.pdf', 'b.pdf', 'c.pdf'], 'acervo'],
    ['documento da Rita', ['rg.pdf'], 'documento'],
  ])('"%s" %j → %s', (texto, arquivos, tipo) => {
    expect(tipoDoAnexo(texto, arquivos)).toBe(tipo)
  })
})
