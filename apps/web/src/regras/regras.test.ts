import { describe, expect, it } from 'vitest'
import { CPF_DE_TESTE } from '../dados/exemplo.ts'
import type { Ficha, PastaDrive } from '../dados/tipos.ts'
import { bateNaBusca, buscar, etapaDaFicha, fichasCitadas, semAcento } from './busca.ts'
import { dataCurta, idadeEm } from './datas.ts'
import { fichaComCpf, fichasParecidas } from './duplicidade.ts'
import {
  MENSAGEM,
  erroCpf,
  erroData,
  erroIdade,
  erroIndicadoPor,
  erroTelefone,
  soNumeroEMascara,
  validarEdicao,
  validarNovoCliente,
} from './formularios.ts'
import {
  TAMANHO_MAXIMO,
  formatoDoArquivo,
  hashDoConteudo,
  localDoTipo,
  nomeSemSobrescrever,
  problemaDoArquivo,
  tipoSugerido,
} from './arquivos.ts'
import { pastasDoCliente } from './pasta.ts'

const HOJE = '2026-10-05'
const CPF_COM_PONTOS = '000.000.001-91'
const CPF_ERRADO = '000.000.001-92'

function ficha(parcial: Partial<Ficha> & Pick<Ficha, 'id' | 'nome' | 'telefone'>): Ficha {
  return {
    situacao: 'cliente',
    desde: '01/2026',
    senhaGovNoCofre: false,
    fichaAtendimentoPreenchida: false,
    processos: [],
    agendamentos: [],
    contatos: [],
    documentos: [],
    arquivos: [],
    transcricoes: 0,
    historico: [],
    ...parcial,
  }
}

const natalia = ficha({ id: 'natalia', nome: 'Natália Exemplo', telefone: '11900000003', situacao: 'lead' })
const antonio = ficha({
  id: 'antonio',
  nome: 'Antônio Exemplo',
  cpf: CPF_DE_TESTE,
  telefone: '11900000001',
  processos: [{ id: 'p1', beneficio: 'incapacidade-permanente', etapa: 'Judicial · exigência' }],
})
const josefa = ficha({
  id: 'josefa',
  nome: 'Josefa Teste',
  telefone: '11900000002',
  situacao: 'lead',
  beneficioInteresse: 'loas-idoso',
  agendamentos: [{ id: 'a1', data: HOJE, hora: '15:30', oQue: 'Entrevista', com: 'Dra. Paula' }],
})
const fichas = [natalia, antonio, josefa]

describe('busca do balcão', () => {
  it('CA10 · parte do nome, com ou sem acento e sem diferença de maiúscula', () => {
    expect(semAcento('  Natália  EXEMPLO ')).toBe('natalia exemplo')
    expect(bateNaBusca(natalia, 'Nat')).toBe(true)
    expect(bateNaBusca(natalia, 'natali')).toBe(true)
    expect(bateNaBusca(natalia, 'NATÁLIA exemplo')).toBe(true)
    expect(bateNaBusca(natalia, 'natalia teste')).toBe(false)
    expect(bateNaBusca(antonio, 'antonio')).toBe(true)
  })

  it('CA10 · mostra o nome completo e a etapa de cada pessoa que bate', () => {
    expect(buscar(fichas, 'exemplo', HOJE).map((r) => [r.nome, r.etapa])).toEqual([
      ['Antônio Exemplo', 'Judicial · exigência'],
      ['Natália Exemplo', 'Lead · primeiro contato'],
    ])
  })

  it('CA1 · pelo CPF, com ou sem pontuação, acha o cliente com o caso e a etapa', () => {
    const [r] = buscar(fichas, CPF_COM_PONTOS, HOJE)
    expect(r.nome).toBe('Antônio Exemplo')
    expect(r.casos).toEqual([{ beneficio: 'Aposentadoria por incapacidade permanente', etapa: 'Judicial · exigência' }])
    expect(buscar(fichas, CPF_DE_TESTE, HOJE)).toHaveLength(1)
  })

  it('CA5 · pelo telefone, com máscara, sem máscara, com +55 ou só o final', () => {
    for (const termo of ['(11) 90000-0002', '11900000002', '+55 11 90000-0002', '0002']) {
      expect(buscar(fichas, termo, HOJE).map((r) => r.id)).toEqual(['josefa'])
    }
  })

  it('CA2 · lead com data marcada mostra o agendamento de hoje e a ficha de atendimento', () => {
    const [r] = buscar(fichas, 'josefa', HOJE)
    expect(r.situacao).toBe('lead')
    expect(r.agendamentoHoje).toMatchObject({ hora: '15:30', oQue: 'Entrevista', com: 'Dra. Paula' })
    expect(r.fichaAtendimentoPreenchida).toBe(false)
    expect(r.etapa).toBe('Lead · entrevista hoje 15:30')
    expect(r.beneficioInteresse).toBe('LOAS Idoso')
  })

  it('lead com contato prévio e sem data', () => {
    const comContato = { ...natalia, contatos: [{ data: '2026-10-02', canal: 'WhatsApp', texto: 'Perguntou do LOAS.' }] }
    expect(etapaDaFicha(comContato, HOJE)).toBe('Lead · contato prévio')
  })

  it('termo curto demais não busca', () => {
    expect(buscar(fichas, 'n', HOJE)).toEqual([])
    expect(buscar(fichas, '11', HOJE)).toEqual([])
  })
})

describe('uma ficha só por pessoa', () => {
  it('CA6 · CPF que já existe, com ou sem pontuação, devolve a ficha existente', () => {
    expect(fichaComCpf(fichas, CPF_COM_PONTOS)?.id).toBe('antonio')
    expect(fichaComCpf(fichas, CPF_ERRADO)).toBeUndefined()
    expect(fichaComCpf(fichas, '')).toBeUndefined()
  })

  it('CA9 · telefone igual ou nome igual sem acento acham a ficha parecida', () => {
    expect(fichasParecidas(fichas, { nome: 'Rita Teste', telefone: '(11) 90000-0003' }).map((f) => f.id)).toEqual(['natalia'])
    expect(fichasParecidas(fichas, { nome: 'josefa  teste', telefone: '(11) 90000-0099' }).map((f) => f.id)).toEqual(['josefa'])
    expect(fichasParecidas(fichas, { nome: 'Ivone Teste', telefone: '(11) 90000-0098' })).toEqual([])
  })
})

describe('pasta do cliente no Drive', () => {
  const pastas: PastaDrive[] = [
    { id: 'd1', nome: 'Rosa Exemplo', caminho: 'Clientes/2024' },
    { id: 'd2', nome: 'ROSA EXEMPLO', caminho: 'Scanner/antigos' },
    { id: 'd3', nome: 'I. Teste', caminho: 'Scanner/2025', cpf: CPF_DE_TESTE },
  ]

  it('CA14 · acha pelo CPF que o scanner leu, mesmo com outro nome', () => {
    expect(pastasDoCliente(pastas, { nome: 'Ivone Teste', cpf: CPF_COM_PONTOS }).map((p) => p.id)).toEqual(['d3'])
  })

  it('CA14 · sem CPF, acha pelo nome sem acento: mais de uma, a tela pergunta', () => {
    expect(pastasDoCliente(pastas, { nome: 'Rosa  Exemplo' }).map((p) => p.id)).toEqual(['d1', 'd2'])
    expect(pastasDoCliente(pastas, { nome: 'Benedita Teste' })).toEqual([])
  })

  it('GGVP-17 CA11 · por último, o nome com uma letra de diferença, só se uma pasta fica tão perto', () => {
    const marta: PastaDrive = { id: 'd4', nome: 'Marta Exemplo', caminho: 'Clientes' }
    expect(pastasDoCliente([marta], { nome: 'Marta Exempl' }).map((p) => p.id)).toEqual(['d4'])
    expect(pastasDoCliente([marta], { nome: 'Martha Exemplo' }).map((p) => p.id)).toEqual(['d4'])
    expect(pastasDoCliente([marta], { nome: 'Marta Exempla' }).map((p) => p.id)).toEqual(['d4'])
    expect(pastasDoCliente([marta], { nome: 'Mirta Exemplu' })).toEqual([])
    const maria: PastaDrive = { id: 'd5', nome: 'Maria Exemplo', caminho: 'Clientes' }
    expect(pastasDoCliente([marta, maria], { nome: 'Marja Exemplo' })).toEqual([])
  })
})

describe('arquivos da pasta do cliente (GGVP-17)', () => {
  it('CA12 · só PDF, JPG ou PNG, de até 20 MB; foto entra como foto', () => {
    expect(formatoDoArquivo('laudo.PDF')).toBe('pdf')
    expect(formatoDoArquivo('foto.jpeg')).toBe('jpg')
    expect(formatoDoArquivo('rg.png')).toBe('png')
    expect(formatoDoArquivo('planilha.xlsx')).toBeNull()
    expect(problemaDoArquivo({ nome: 'laudo.pdf', tamanho: TAMANHO_MAXIMO })).toBeUndefined()
    expect(problemaDoArquivo({ nome: 'laudo.pdf', tamanho: TAMANHO_MAXIMO + 1 })).toBe('Passa de 20 MB.')
    expect(problemaDoArquivo({ nome: 'video.mp4', tamanho: 10 })).toBe('Só PDF, JPG ou PNG.')
    expect(TAMANHO_MAXIMO).toBe(20 * 1024 * 1024)
  })

  it('CA12 · o tipo sugerido sai do nome do arquivo; sem pista, "outro"', () => {
    expect(tipoSugerido('laudo_ortopedia_set2026.pdf')).toBe('laudo')
    expect(tipoSugerido('rg_frente_verso.jpg')).toBe('rg')
    expect(tipoSugerido('Comprovante-Residência.pdf')).toBe('comprovante-residencia')
    expect(tipoSugerido('cargo.pdf')).toBe('outro')
  })

  it('CA13 · nome que já existe entra como "(2)", "(3)": nada é sobrescrito', () => {
    expect(nomeSemSobrescrever('rg.pdf', [])).toBe('rg.pdf')
    expect(nomeSemSobrescrever('rg.pdf', ['rg.pdf'])).toBe('rg (2).pdf')
    expect(nomeSemSobrescrever('rg.pdf', ['rg.pdf', 'rg (2).pdf'])).toBe('rg (3).pdf')
  })

  it('CA13 · o mesmo conteúdo dá o mesmo SHA-256', async () => {
    const um = await hashDoConteudo(new TextEncoder().encode('mesmo papel').buffer)
    expect(um).toMatch(/^[0-9a-f]{64}$/)
    expect(await hashDoConteudo(new TextEncoder().encode('mesmo papel').buffer)).toBe(um)
    expect(await hashDoConteudo(new TextEncoder().encode('outro papel').buffer)).not.toBe(um)
  })

  it('CA14 · documento pessoal vai para Documentos pessoais; o resto, para a subpasta do caso', () => {
    expect(localDoTipo('rg', 'p1')).toBe('pessoais')
    expect(localDoTipo('laudo', 'p1')).toBe('p1')
    expect(localDoTipo('laudo', undefined)).toBe('pessoais')
  })
})

describe('campos do cadastro', () => {
  it('CA15 · CPF só passa com o dígito verificador certo', () => {
    expect(erroCpf(CPF_COM_PONTOS, true)).toBeUndefined()
    expect(erroCpf(CPF_ERRADO, false)).toBe(MENSAGEM.cpf)
    expect(erroCpf('111.111.111-11', false)).toBe(MENSAGEM.cpf)
    expect(erroCpf('', false)).toBeUndefined()
    expect(erroCpf('', true)).toBe(MENSAGEM.cpf)
  })

  it('CA15 · telefone precisa de DDD, sem adivinhar', () => {
    expect(erroTelefone('(11) 90000-0001')).toBeUndefined()
    expect(erroTelefone('(11) 3000-0001')).toBeUndefined()
    expect(erroTelefone('90000-0001')).toBe(MENSAGEM.telefone)
    expect(erroTelefone('(01) 90000-0001')).toBe(MENSAGEM.telefone)
  })

  it('CA15 · data não aceita letra nem data futura', () => {
    expect(erroData('12/03/1964', HOJE)).toBeUndefined()
    expect(erroData('12031964', HOJE)).toBeUndefined()
    expect(erroData('05/10/2026', HOJE)).toBeUndefined()
    expect(erroData('06/10/2026', HOJE)).toBe(MENSAGEM.data)
    expect(erroData('aa/bb/cccc', HOJE)).toBe(MENSAGEM.data)
    expect(erroData('31/02/1990', HOJE)).toBe(MENSAGEM.data)
  })

  it('letra não entra em CPF, telefone e idade', () => {
    expect(soNumeroEMascara('000.00a0.001-91')).toBe(CPF_COM_PONTOS)
    expect(soNumeroEMascara('(11) 9x0000-0001')).toBe('(11) 90000-0001')
  })

  it('idade em anos, de 0 a 130', () => {
    expect(erroIdade('41')).toBeUndefined()
    expect(erroIdade('0')).toBeUndefined()
    expect(erroIdade('131')).toBe(MENSAGEM.idade)
    expect(erroIdade('4a')).toBe(MENSAGEM.idade)
    expect(erroIdade('')).toBe(MENSAGEM.idade)
  })

  it('CA12 · indicação pede o nome de quem indicou', () => {
    expect(erroIndicadoPor('', 'instagram')).toBeUndefined()
    expect(erroIndicadoPor('', 'indicacao')).toBe(MENSAGEM.indicadoPor)
    expect(erroIndicadoPor('Maria Exemplo', 'indicacao')).toBeUndefined()
  })

  const novo = {
    nome: '  Ivone   Teste ',
    cpf: '',
    idade: '41',
    telefone: '(11) 90000-0050',
    email: '',
    pretende: 'Afastada do trabalho, sem receber.',
    comoChegou: 'instagram',
    indicadoPor: 'Fulano',
    cidadeUf: '',
    beneficioInteresse: 'nao-sei',
    observacao: '',
  }

  it('CA3 · o mínimo basta e o CPF é opcional; os dados saem normalizados', () => {
    const { erros, dados } = validarNovoCliente(novo)
    expect(erros).toEqual({})
    expect(dados).toMatchObject({ nome: 'Ivone Teste', idade: 41, telefone: '11900000050' })
    expect(dados?.cpf).toBeUndefined()
    expect(dados?.indicadoPor).toBeUndefined()
  })

  it('CA3 · sem o mínimo, diz o que falta', () => {
    const { erros, dados } = validarNovoCliente({ ...novo, nome: '', idade: '', telefone: '', pretende: '' })
    expect(dados).toBeUndefined()
    expect(Object.keys(erros).sort()).toEqual(['idade', 'nome', 'pretende', 'telefone'])
  })

  it('CA15 · CPF guardado só com números', () => {
    expect(validarNovoCliente({ ...novo, cpf: CPF_COM_PONTOS }).dados?.cpf).toBe(CPF_DE_TESTE)
  })

  it('edição da ficha: CPF obrigatório para cliente, data e CEP validados, data guardada em aaaa-mm-dd', () => {
    const valores = {
      nome: 'Antônio Exemplo',
      cpf: '',
      nascimento: '12/03/1964',
      telefone: '(11) 90000-0001',
      email: '',
      estadoCivil: 'Casado',
      endereco: '',
      cidadeUf: '',
      cep: '01001-000',
      profissao: '',
      comoChegou: 'indicacao',
      contatoPreferido: '',
      contatoApoio: '',
      observacoes: '',
    }
    expect(validarEdicao(valores, { cpfObrigatorio: true, hoje: HOJE }).erros).toEqual({ cpf: MENSAGEM.cpf })
    const { dados } = validarEdicao({ ...valores, cpf: CPF_COM_PONTOS }, { cpfObrigatorio: true, hoje: HOJE })
    expect(dados).toMatchObject({ cpf: CPF_DE_TESTE, nascimento: '1964-03-12', cep: '01001000' })
    expect(validarEdicao({ ...valores, cep: '0100' }, { cpfObrigatorio: false, hoje: HOJE }).erros).toEqual({ cep: MENSAGEM.cep })
  })
})

describe('datas', () => {
  it('idade em anos completos', () => {
    expect(idadeEm('1964-03-12', HOJE)).toBe(62)
    expect(idadeEm('1964-10-05', HOJE)).toBe(62)
    expect(idadeEm('1964-10-06', HOJE)).toBe(61)
  })

  it('data curta no mesmo ano, com o ano nos outros', () => {
    expect(dataCurta('2026-09-27', HOJE)).toBe('27/09')
    expect(dataCurta('2025-09-20', HOJE)).toBe('20/09/2025')
  })
})

describe('quem é citado no chat (GGVP-17, CA8)', () => {
  const fichas = [{ nome: 'Antônio Exemplo' }, { nome: 'Maria Exemplo' }, { nome: 'Marta Exemplo' }]
  it('acha pelo primeiro nome, com ou sem acento, na mensagem ou no nome do arquivo', () => {
    expect(fichasCitadas(fichas, 'Esse aqui é o laudo do Antônio. Atualizar.')).toEqual([{ nome: 'Antônio Exemplo' }])
    expect(fichasCitadas(fichas, 'atualizar laudo_antonio_ortopedia.pdf')).toEqual([{ nome: 'Antônio Exemplo' }])
    expect(fichasCitadas(fichas, 'laudo da Mari')).toEqual([])
  })
  it('o nome inteiro vale mais que o primeiro nome; nome que não bate, ninguém', () => {
    expect(fichasCitadas([...fichas, { nome: 'Maria Teste' }], 'laudo da Maria Exemplo')).toEqual([{ nome: 'Maria Exemplo' }])
    expect(fichasCitadas([...fichas, { nome: 'Maria Teste' }], 'laudo da Maria')).toHaveLength(2)
    expect(fichasCitadas(fichas, 'laudo novo')).toEqual([])
  })
})
