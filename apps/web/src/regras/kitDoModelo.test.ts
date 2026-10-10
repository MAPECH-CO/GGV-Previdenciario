import { describe, expect, it } from 'vitest'
import {
  VARIAVEIS_DO_KIT,
  dataEmBranco,
  dataPorExtenso,
  faltamNoKit,
  nomeDaVariavel,
  separarCidadeUf,
  separarEndereco,
  valoresDoKit,
  variaveisDesconhecidas,
  type FichaDoKit,
} from './kitDoModelo.ts'

describe('GGVP-136 · as {{VARIÁVEIS}} do kit', () => {
  it('cada variável existe uma vez só, e as do beneficiário e do genitor(a) seguem o padrão dos modelos do ZapSign', () => {
    const nomes = VARIAVEIS_DO_KIT.map((v) => v.nome)
    expect(new Set(nomes).size).toBe(nomes.length)
    for (const n of [
      'NOME COMPLETO',
      'Nº',
      'TELEFONE P/ CONTATO',
      'DATA DE HOJE',
      'NÚMERO DO CPF DO BENEFICIÁRIO',
      'DATA DE NASCIMENTO DO BENEFICIÁRIO',
      'NOME COMPLETO GENITOR(A)',
      'ESTADO CIVIL GENITOR(A)',
    ])
      expect(nomes, n).toContain(n)
  })

  it('só os telefones para contato são opcionais: saem em branco quando a ficha não tem', () => {
    expect(VARIAVEIS_DO_KIT.filter((v) => v.opcional).map((v) => v.nome)).toEqual(['TELEFONE P/ CONTATO', 'TEL 2'])
  })

  it('o nome vale depois de normalizado: o Word guarda o acento solto e põe espaço na ponta', () => {
    expect(nomeDaVariavel(' NÚMERO DO RG ')).toBe('NÚMERO DO RG')
    expect(variaveisDesconhecidas(['NÚMERO DO RG', 'NOME COMPLETO', 'NOME COMPLETO'])).toEqual([])
  })

  it('variável escrita errada no Word é desconhecida: sairia em branco no papel', () => {
    expect(variaveisDesconhecidas(['NOME COMPLETO', 'NOME COMPLETA', 'CPF', 'NOME COMPLETA'])).toEqual(['NOME COMPLETA', 'CPF'])
  })
})

const FICHA: FichaDoKit = {
  nome: 'Maria de Exemplo Souza',
  cpf: '52998224725',
  telefone: '11987654321',
  estadoCivil: 'Casado(a)',
  profissao: 'Do lar',
  endereco: 'Rua das Flores, 123',
  bairro: 'Vila Exemplo',
  cidadeUf: 'São Paulo / SP',
  cep: '01001000',
  contatoApoio: 'filha Renata · (11) 90000-0023',
}
const DADOS = { rg: '12.345.678-9', nacionalidade: 'brasileira' }
const entrada = (resto: Partial<Parameters<typeof valoresDoKit>[0]> = {}) => ({ ficha: FICHA, dados: DADOS, linha: 'aposentadorias', representado: false, ...resto })

describe('GGVP-136 CA3 · o endereço da ficha vira rua e número, cidade e UF', () => {
  it('a vírgula separa a rua do número; sem vírgula, o último número é o da casa', () => {
    expect(separarEndereco('Rua das Flores, 123')).toEqual({ logradouro: 'Rua das Flores', numero: '123' })
    expect(separarEndereco('Av. 9 de Julho, 1000')).toEqual({ logradouro: 'Av. 9 de Julho', numero: '1000' })
    expect(separarEndereco('Rua das Flores, nº 12 apto 4')).toEqual({ logradouro: 'Rua das Flores', numero: '12 apto 4' })
    expect(separarEndereco('Rua das Flores,   s/n')).toEqual({ logradouro: 'Rua das Flores', numero: 's/n' })
    expect(separarEndereco('Rua das Flores 123')).toEqual({ logradouro: 'Rua das Flores', numero: '123' })
    expect(separarEndereco('Av. 9 de Julho 1000')).toEqual({ logradouro: 'Av. 9 de Julho', numero: '1000' })
  })

  it('o endereço dito de uma vez no balcão fica com o primeiro número; sem número, só a rua; vazio, nada', () => {
    expect(separarEndereco('Rua das Flores, 10, Centro, Osasco/SP')).toEqual({ logradouro: 'Rua das Flores', numero: '10' })
    expect(separarEndereco('Rua das Flores')).toEqual({ logradouro: 'Rua das Flores' })
    expect(separarEndereco('  ')).toEqual({})
    expect(separarEndereco(undefined)).toEqual({})
  })

  it('"Cidade / UF" do cadastro vira cidade e UF em maiúscula', () => {
    expect(separarCidadeUf('São Paulo / SP')).toEqual({ cidade: 'São Paulo', uf: 'SP' })
    expect(separarCidadeUf('Osasco/sp')).toEqual({ cidade: 'Osasco', uf: 'SP' })
    expect(separarCidadeUf('Osasco')).toEqual({ cidade: 'Osasco' })
    expect(separarCidadeUf(undefined)).toEqual({})
  })
})

describe('GGVP-136 CA3 · o valor de cada variável, da ficha e do caso', () => {
  it('cliente: estado civil e profissão no meio da frase, CPF, CEP e telefone formatados, endereço em pedaços', () => {
    const v = valoresDoKit(entrada(), '2026-10-09')
    expect(v).toMatchObject({
      'NOME COMPLETO': 'Maria de Exemplo Souza',
      'ESTADO CIVIL': 'casado(a)',
      NACIONALIDADE: 'brasileira',
      PROFISSÃO: 'do lar',
      'NÚMERO DO CPF': '529.982.247-25',
      'NÚMERO DO RG': '12.345.678-9',
      'ENDEREÇO COMPLETO': 'Rua das Flores',
      Nº: '123',
      BAIRRO: 'Vila Exemplo',
      CIDADE: 'São Paulo',
      UF: 'SP',
      CEP: '01001-000',
      TELEFONE: '(11) 98765-4321',
      'TEL 1': '(11) 98765-4321',
      'TELEFONE P/ CONTATO': 'filha Renata · (11) 90000-0023',
      'DATA DE HOJE': '9 de outubro de 2026',
    })
  })

  it('LOAS representado: o beneficiário é o cliente e o genitor(a) vem dos dados do representante', () => {
    const dados = {
      ...DADOS,
      representanteNome: 'Joana de Exemplo Lima',
      representanteCpf: '11144477735',
      representanteRg: '98.765.432-1',
      representanteEstadoCivil: 'Solteiro(a)',
      representanteNacionalidade: 'brasileira',
      representanteProfissao: 'Costureira',
    }
    const v = valoresDoKit(entrada({ dados, representado: true }), '2026-10-09')
    expect(v['NOME COMPLETO DO BENEFICIÁRIO']).toBe('Maria de Exemplo Souza')
    expect(v['NÚMERO DO CPF DO BENEFICIÁRIO']).toBe('529.982.247-25')
    expect(v).toMatchObject({
      'NOME COMPLETO GENITOR(A)': 'Joana de Exemplo Lima',
      'ESTADO CIVIL GENITOR(A)': 'solteiro(a)',
      'NACIONALIDADE GENITOR(A)': 'brasileira',
      'PROFISSÃO GENITOR(A)': 'costureira',
      'NÚMERO DO CPF GENITOR(A)': '111.444.777-35',
      'NÚMERO DO RG GENITOR(A)': '98.765.432-1',
    })
    // Sem ser representado, o genitor(a) não entra.
    expect(valoresDoKit(entrada({ dados }), '2026-10-09')['NOME COMPLETO GENITOR(A)']).toBeUndefined()
  })

  it('curatela: o cliente é quem contrata e o beneficiário é o curatelado, com a data de nascimento', () => {
    const dados = {
      ...DADOS,
      curateladoNome: 'Pedro de Exemplo Souza',
      curateladoNascimento: '12/03/1950',
      curateladoNacionalidade: 'brasileiro',
      curateladoRg: '11.222.333-4',
      curateladoCpf: '11144477735',
    }
    const v = valoresDoKit(entrada({ dados, linha: 'curatela' }), '2026-10-09')
    expect(v['NOME COMPLETO']).toBe('Maria de Exemplo Souza')
    expect(v).toMatchObject({
      'NOME COMPLETO DO BENEFICIÁRIO': 'Pedro de Exemplo Souza',
      'DATA DE NASCIMENTO DO BENEFICIÁRIO': '12/03/1950',
      'NACIONALIDADE DO BENEFICIÁRIO': 'brasileiro',
      'NÚMERO DO RG DO BENEFICIÁRIO': '11.222.333-4',
      'NÚMERO DO CPF DO BENEFICIÁRIO': '111.444.777-35',
    })
  })

  it('a data do contrato é por extenso; a das outras peças, em branco, com o ano', () => {
    expect(dataPorExtenso('2026-01-05')).toBe('5 de janeiro de 2026')
    expect(dataPorExtenso('2026-12-31')).toBe('31 de dezembro de 2026')
    expect(dataEmBranco('2026-10-09')).toBe('dia ____________ de ________________ de 2026')
  })
})

describe('GGVP-136 CA4 · o que falta para o modelo', () => {
  const MODELO = ['NOME COMPLETO', 'NACIONALIDADE', 'ENDEREÇO COMPLETO', 'Nº', 'BAIRRO', 'CIDADE', 'UF', 'CEP', 'TELEFONE', 'TELEFONE P/ CONTATO', 'DATA DE HOJE']

  it('ficha completa: nada falta; o telefone para contato é opcional', () => {
    expect(faltamNoKit(MODELO, valoresDoKit(entrada({ ficha: { ...FICHA, contatoApoio: undefined } }), '2026-10-09'))).toEqual([])
  })

  it('o que falta vem com o nome que a equipe lê, na ordem das variáveis e sem repetir', () => {
    const ficha = { ...FICHA, endereco: 'Rua das Flores', bairro: undefined, cidadeUf: undefined, cep: undefined }
    expect(faltamNoKit([...MODELO, 'NOME COMPLETO'], valoresDoKit(entrada({ ficha, dados: { rg: '1' } }), '2026-10-09'))).toEqual([
      'Nacionalidade',
      'Número do endereço',
      'Bairro',
      'Cidade',
      'Estado (UF)',
      'CEP',
    ])
  })

  it('só conta o que o modelo usa: o genitor(a) não falta num modelo que não o pede', () => {
    expect(faltamNoKit(['NOME COMPLETO'], valoresDoKit(entrada(), '2026-10-09'))).toEqual([])
    expect(faltamNoKit(['NOME COMPLETO', 'PROFISSÃO GENITOR(A)'], valoresDoKit(entrada(), '2026-10-09'))).toEqual(['Profissão do genitor(a)'])
  })
})
