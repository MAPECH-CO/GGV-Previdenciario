import { describe, expect, it } from 'vitest'
import { analisarPlanilha, lerCsv, type NoPortal } from './importacao.ts'

// Planilha inventada: nomes, CPFs e números de processo de teste, nenhum real.
const vazio = (): NoPortal => ({ pessoas: new Map(), numeros: new Set(), casosAbertos: new Set() })

describe('GGVP-146 parte 2 · ler a planilha', () => {
  it('ponto e vírgula do Excel, aspas, aspas dobradas e quebra de linha dentro das aspas; BOM e CRLF', () => {
    expect(lerCsv('﻿nome;obs\r\n"Silva; Ana";"diz ""oi""\nde novo"\r\nBia;')).toEqual([
      ['nome', 'obs'],
      ['Silva; Ana', 'diz "oi"\nde novo'],
      ['Bia', ''],
    ])
    expect(lerCsv('nome,cpf\nAna,1')).toEqual([
      ['nome', 'cpf'],
      ['Ana', '1'],
    ])
  })
})

describe('GGVP-146 parte 2 · o que cada linha vira', () => {
  it('valida cada campo pela biblioteca campos, sem repetir o dado na mensagem', () => {
    const planilha = [
      'Nome;CPF;Nascimento;Telefone;E-mail;CEP;Benefício;Fase;NB;CNJ;Observação',
      'Ana Teste;111.444.777-35;05/03/1958;(11) 98765-4321;ana@exemplo.ggv;01001-000;BPC/LOAS Idoso;administrativa;123.456.789-0;;nada',
      'B4;123;31/02/1960;123;sem-arroba;1;Benefício X;encerrado;12;123',
      ';;;;;;;;;',
      'Caio Teste;52998224725;;;;;;;;0001234-81.2026.4.03.0001',
    ].join('\n')
    const r = analisarPlanilha(planilha, vazio())
    expect(r.colunasIgnoradas).toEqual(['Observação'])
    expect(r.erros).toEqual([
      {
        linha: 3,
        motivo:
          'nome inválido; CPF inválido; data de nascimento inválida (use dd/mm/aaaa); telefone inválido; e-mail inválido; CEP inválido; benefício desconhecido; processo encerrado: só entram os em andamento; NB inválido; número CNJ inválido.',
      },
    ])
    expect(r.linhas.map((l) => [l.linha, l.nome, l.cliente, l.processo, l.beneficio, l.fase])).toEqual([
      [2, 'Ana Teste', 'novo', 'novo', 'bpc_loas_idoso', 'administrativa'],
      [5, 'Caio Teste', 'novo', 'novo', null, 'judicial'],
    ])
    expect(r.linhas[0].pessoa).toEqual({ nome: 'Ana Teste', cpf: '11144477735', dataNascimento: '1958-03-05', telefone: '11987654321', email: 'ana@exemplo.ggv', cep: '01001000' })
    expect(r.linhas[0].caso).toEqual({ beneficio: 'bpc_loas_idoso', fase: 'administrativa', nb: '1234567890', cnj: null })
    expect(r.linhas[1].caso?.cnj).toBe('00012348120264030001')
  })

  it('não duplica: CPF repetido é o mesmo cliente (com outro nome, erro); NB, CNJ e processo sem número repetidos, erro', () => {
    const planilha = [
      'nome,cpf,beneficio,nb,cnj',
      'Ana Teste,11144477735,bpc_loas_idoso,1234567890,',
      'Ana Teste,111.444.777-35,auxilio_acidente,,',
      'Outra Pessoa,11144477735,,,',
      'Bia Teste,52998224725,pensao_morte,1234567890,',
      'Ana Teste,11144477735,auxilio_acidente,,',
      'Caio Teste,39053344705,,,',
    ].join('\n')
    const r = analisarPlanilha(planilha, vazio())
    expect(r.erros).toEqual([
      { linha: 4, motivo: 'CPF repetido na linha 2, com outro nome.' },
      { linha: 5, motivo: 'NB repetido na linha 2.' },
      { linha: 6, motivo: 'processo repetido na linha 3.' },
    ])
    expect(r.linhas.map((l) => [l.linha, l.cliente, l.processo])).toEqual([
      [2, 'novo', 'novo'],
      [3, 'novo', 'novo'],
      [7, 'novo', 'sem-processo'],
    ])
  })

  it('o que já está no portal: o cliente pelo CPF, o processo pelo número ou pelo benefício em andamento', () => {
    const portal: NoPortal = {
      pessoas: new Map([['11144477735', { id: 'p1', nome: 'Ana Souza Teste' }]]),
      numeros: new Set(['nb:1234567890']),
      casosAbertos: new Set(['p1:auxilio_acidente']),
    }
    const planilha = ['nome;cpf;beneficio;nb', 'Ana Teste;11144477735;bpc_loas_idoso;1234567890', 'Ana Teste;11144477735;auxilio_acidente;', 'Ana Teste;11144477735;pensao_morte;'].join('\n')
    expect(analisarPlanilha(planilha, portal).linhas.map((l) => [l.cliente, l.nomeNoPortal, l.processo])).toEqual([
      ['ja-cadastrado', 'Ana Souza Teste', 'ja-cadastrado'],
      ['ja-cadastrado', 'Ana Souza Teste', 'ja-cadastrado'],
      ['ja-cadastrado', 'Ana Souza Teste', 'novo'],
    ])
  })

  it('a planilha sem as colunas de nome e CPF, ou vazia, não segue', () => {
    expect(analisarPlanilha('nome;telefone\nAna;11987654321', vazio()).erros).toEqual([{ linha: 1, motivo: 'Faltam as colunas: cpf.' }])
    expect(analisarPlanilha('', vazio()).erros).toEqual([{ linha: 1, motivo: 'Faltam as colunas: nome, cpf.' }])
  })
})
