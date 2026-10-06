import { describe, expect, it } from 'vitest'
import { CPF_DE_TESTE } from '../dados/exemplo.ts'
import type { Cadastro, EventoDaAgenda, Ficha, Gravacao, InformacaoExtraida, PastaDrive, Trecho } from '../dados/tipos.ts'
import { bateNaBusca, buscar, etapaDaFicha, fichasCitadas, semAcento } from './busca.ts'
import {
  MENSAGEM_RG,
  cadastroDaFicha,
  errosDoCadastro,
  estadoCivilDaLista,
  faltaParaOKit,
  fichaDoCadastro,
  mesclar,
  oQueFaltaNoCadastro,
  preencherCadastro,
} from './cadastro.ts'
import { dataCurta, idadeEm } from './datas.ts'
import { buscarTrechos, contagemDoTopo, marcarBusca, situacaoDaGravacao } from './transcricao.ts'
import {
  PARTE_MAXIMA,
  SENHA_RETIRADA,
  documentosDaEntrevista,
  ehAudio,
  juntarPartes,
  minutos,
  partesDoAudio,
  pendenciasDaEntrevista,
  relogio,
  roteiroDaEntrevista,
  situacaoDaInformacao,
  tirarSenhas,
} from './entrevista.ts'
import { fichaComCpf, fichasParecidas } from './duplicidade.ts'
import {
  MENSAGEM,
  erroCpf,
  erroData,
  erroDataDoCompromisso,
  erroIdade,
  erroIndicadoPor,
  erroTelefone,
  soNumeroEMascara,
  validarEdicao,
  validarNovoCliente,
} from './formularios.ts'
import {
  LIMITE_DE_REMARCACOES,
  dataLonga,
  detalheDoEvento,
  diaCheio,
  diaCurto,
  equipeDaEntrevista,
  estadoDoEvento,
  gradeDoMes,
  horarioOcupado,
  mensagemDoConvite,
  podeRemarcar,
  proximosDiasUteis,
  semanaDe,
} from './agenda.ts'
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
import {
  DIAS_ENTRE_TENTATIVAS,
  TENTATIVAS_DE_CONFIRMACAO,
  depoisDaTentativa,
  instrucaoDaConfirmacao,
  mensagemDaConfirmacao,
  precisaConfirmar,
  tentativaAtual,
} from './confirmacao.ts'
import { atencaoCurta, motivoParaIniciar, pontosDeAtencao } from './preparacao.ts'
import {
  CAMPOS_MEDICOS,
  MENSAGEM_HISTORICO,
  MENSAGEM_NB,
  SECOES,
  emBrancoDaSegunda,
  errosDaSegundaFicha,
  respostasVazias,
  semDadosMedicos,
} from './segundaFicha.ts'
import { MENSAGEM_PESSOAS, camposEmBranco, envioValido, errosDaFicha, oQueFalta, paraEnvio, type ValoresDaFicha } from './fichaAtendimento.ts'

const HOJE = '2026-10-05'
const CPF_COM_PONTOS = '000.000.001-91'
const CPF_ERRADO = '000.000.001-92'

function ficha(parcial: Partial<Ficha> & Pick<Ficha, 'id' | 'nome' | 'telefone'>): Ficha {
  return {
    situacao: 'cliente',
    desde: '01/2026',
    senhaGov: { situacao: 'sem-senha' },
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
    expect(r.casos).toEqual([{ beneficio: 'Aposentadoria por Incapacidade Permanente', etapa: 'Judicial · exigência' }])
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

describe('agenda e marcação da entrevista (GGVP-123)', () => {
  const evento = (hora: string, duracao = 45, estado: EventoDaAgenda['estado'] = 'agendado'): EventoDaAgenda => ({
    id: hora,
    data: '2026-10-06',
    hora,
    duracao,
    titulo: 'Josefa Exemplo',
    oQue: 'Fazer entrevista',
    categoria: 'visitas',
    estado,
    remarcacoes: 0,
  })

  it('CA1 · os 5 próximos dias úteis depois de hoje, como no Figma', () => {
    expect(proximosDiasUteis('2026-10-02').map(diaCurto)).toEqual(['seg 05', 'ter 06', 'qua 07', 'qui 08', 'sex 09'])
    expect(proximosDiasUteis('2026-10-05')[0]).toBe('2026-10-06')
  })

  it('CA3 · horário ocupado é quem se cruza pela duração; falta não ocupa; dia cheio quando todos os horários têm alguém', () => {
    const agenda = [evento('10:30'), evento('14:00', 30, 'faltou')]
    expect(horarioOcupado(agenda, { data: '2026-10-06', hora: '10:00', duracao: 45 }).map((e) => e.id)).toEqual(['10:30'])
    expect(horarioOcupado(agenda, { data: '2026-10-06', hora: '09:00', duracao: 45 })).toEqual([])
    expect(horarioOcupado(agenda, { data: '2026-10-06', hora: '14:00', duracao: 45 })).toEqual([])
    expect(horarioOcupado(agenda, { data: '2026-10-07', hora: '10:30', duracao: 45 })).toEqual([])
    expect(diaCheio(agenda, '2026-10-06')).toBe(false)
    expect(diaCheio(['09:00', '10:30', '14:00', '16:00'].map((h) => evento(h)), '2026-10-06')).toBe(true)
  })

  it('CA8 · passou do dia sem registro vira "confirmar"; realizado e faltou ficam como estão', () => {
    expect(estadoDoEvento('marcado', '2026-10-04', '2026-10-05')).toBe('confirmar')
    expect(estadoDoEvento(undefined, '2026-10-05', '2026-10-05')).toBe('agendado')
    expect(estadoDoEvento('realizado', '2026-10-04', '2026-10-05')).toBe('realizado')
    expect(estadoDoEvento('faltou', '2026-10-04', '2026-10-05')).toBe('faltou')
  })

  it('a semana vai de segunda a domingo e o mês cobre as semanas inteiras', () => {
    expect(semanaDe('2026-10-08')).toEqual(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'])
    const setembro = gradeDoMes('2026-09-15')
    expect(setembro[0][0]).toBe('2026-08-31')
    expect(setembro.at(-1)?.at(-1)).toBe('2026-10-04')
    expect(setembro).toHaveLength(5)
  })

  it('CA2 · "Com quem" só tem advogada do escritório, nunca captador', () => {
    const equipe = [
      { id: 'captador', nome: 'Captador', papel: 'captador' as const },
      { id: 'paula', nome: 'Dra. Paula', papel: 'advogada' as const },
      { id: 'atendimento', nome: 'Você (Atendimento)', papel: 'atendimento' as const },
    ]
    expect(equipeDaEntrevista(equipe).map((m) => m.id)).toEqual(['paula'])
  })

  it('CA7 · a entrevista aceita 2 remarcações (G15)', () => {
    expect(LIMITE_DE_REMARCACOES).toBe(2)
    expect(podeRemarcar(1)).toBe(true)
    expect(podeRemarcar(2)).toBe(false)
  })

  it('CA4 · o convite traz dia, hora, o link do vídeo, a ficha em papel e o que trazer', () => {
    const comum = { nome: 'Josefa Exemplo', data: '2026-09-30', hora: '10:30', pedirFicha: true, levar: true, gravar: true }
    expect(mensagemDoConvite({ ...comum, tipo: 'video', link: 'meet.google.com/ggv-josefa' })).toBe(
      'Olá, Josefa! Sua conversa com o escritório GGV está marcada para quarta, 30/09, às 10h30, por vídeo. ' +
        'Link: meet.google.com/ggv-josefa. Antes da conversa, preencha a ficha de atendimento em papel, no balcão do escritório ' +
        'ou com quem te atendeu. Traga RG, CPF e os laudos. Avisamos que a conversa é gravada.',
    )
    expect(mensagemDoConvite({ ...comum, tipo: 'presencial', hora: '09:00', pedirFicha: false, levar: false, gravar: false })).toBe(
      'Olá, Josefa! Sua conversa com o escritório GGV está marcada para quarta, 30/09, às 9h, aqui no escritório.',
    )
  })

  it('a linha de detalhe e a data longa da agenda', () => {
    expect(detalheDoEvento({ gravar: true, tipo: 'video', responsavel: 'Dra. Paula', fichaId: 'f' })).toBe('gravada · vídeo (Meet) · Dra. Paula')
    expect(detalheDoEvento({ responsavel: 'Você (Atendimento)' })).toBe('Você (Atendimento) · interno')
    expect(dataLonga('2026-10-06')).toBe('ter 06/10/2026')
  })

  it('CA5 · o compromisso interno é de hoje em diante', () => {
    expect(erroDataDoCompromisso('06/10/2026', '2026-10-05')).toBeUndefined()
    expect(erroDataDoCompromisso('05/10/2026', '2026-10-05')).toBeUndefined()
    expect(erroDataDoCompromisso('04/10/2026', '2026-10-05')).toBe(MENSAGEM.dataDoCompromisso)
    expect(erroDataDoCompromisso('3a/10/2026', '2026-10-05')).toBe(MENSAGEM.dataDoCompromisso)
  })
})

describe('confirmação da entrevista do lead (GGVP-21)', () => {
  const entrevista = { id: 'a', data: HOJE, hora: '15:30', oQue: 'Entrevista', tipo: 'presencial' as const }
  const lead = ficha({ id: 'l', nome: 'Josefa Exemplo', telefone: '11900000002', situacao: 'lead', agendamentos: [entrevista] })
  const tentativa = (resultado: 'confirmou' | 'sem-resposta') => ({ quando: `${HOJE}T10:00:00.000Z`, quem: 'Você', canal: 'ligacao' as const, resultado })

  it('CA1 · confirma a entrevista do lead de hoje em diante, ainda sem confirmação e fora da sênior', () => {
    expect(precisaConfirmar(lead, entrevista, HOJE)).toBe(true)
    expect(precisaConfirmar(lead, { ...entrevista, data: '2026-10-04' }, HOJE)).toBe(false)
    expect(precisaConfirmar({ ...lead, situacao: 'cliente' }, entrevista, HOJE)).toBe(false)
    expect(precisaConfirmar(lead, { ...entrevista, oQue: 'Retirada da cópia do contrato' }, HOJE)).toBe(false)
    expect(precisaConfirmar(lead, { ...entrevista, estado: 'remarcado' }, HOJE)).toBe(false)
    expect(precisaConfirmar(lead, { ...entrevista, confirmacao: { tentativas: [tentativa('confirmou')] } }, HOJE)).toBe(false)
    expect(precisaConfirmar(lead, { ...entrevista, confirmacao: { tentativas: [tentativa('sem-resposta')] } }, HOJE)).toBe(true)
    expect(precisaConfirmar(lead, { ...entrevista, confirmacao: { tentativas: [], naSenior: true } }, HOJE)).toBe(false)
  })

  it('CA6 · 2 tentativas com 3 dias entre elas; sem resposta na segunda, a sênior', () => {
    expect(TENTATIVAS_DE_CONFIRMACAO).toBe(2)
    expect(DIAS_ENTRE_TENTATIVAS).toBe(3)
    expect(tentativaAtual(undefined)).toBe(1)
    expect(tentativaAtual({ tentativas: [tentativa('sem-resposta')] })).toBe(2)
    expect(depoisDaTentativa(1, HOJE)).toEqual({ naSenior: false, proximaEm: '2026-10-08' })
    expect(depoisDaTentativa(2, HOJE)).toEqual({ naSenior: true })
  })

  it('CA8 · no LOAS, a mensagem traz o que levar e os quatro documentos que mais travam', () => {
    expect(
      mensagemDaConfirmacao({ nome: 'Josefa Exemplo', tipo: 'presencial', data: HOJE, hora: '15:30', beneficio: 'loas-idoso', fichaPreenchida: false }),
    ).toBe(
      'Olá, Josefa! Passando para confirmar sua conversa com o escritório GGV: segunda, 05/10, às 15h30, aqui no escritório. ' +
        'Pode confirmar respondendo esta mensagem? Antes da conversa, preencha a ficha de atendimento em papel, no balcão do ' +
        'escritório ou com quem te atendeu. Traga RG e CPF de todos da casa, comprovante de renda e CadÚnico; sem CadÚnico, ' +
        'vá ao CRAS antes. Os documentos que mais travam os casos são biometria, CadÚnico, senha do Meu INSS e comprovantes ' +
        'de gastos: se faltar algum, avise a gente.',
    )
  })

  it('CA8 · nos outros benefícios, o que o convite já pede; com ficha, não pede a ficha; no vídeo, o link', () => {
    const texto = mensagemDaConfirmacao({
      nome: 'Natália Exemplo',
      tipo: 'video',
      data: '2026-10-06',
      hora: '09:00',
      link: 'meet.google.com/ggv-n',
      beneficio: 'incapacidade-temporaria',
      fichaPreenchida: true,
    })
    expect(texto).toContain('terça, 06/10, às 9h, por vídeo')
    expect(texto).toContain('Link: meet.google.com/ggv-n.')
    expect(texto).toContain('Traga RG, CPF e os laudos.')
    expect(texto).toContain('biometria, CadÚnico, senha do Meu INSS e comprovantes de gastos')
    expect(texto).not.toContain('ficha de atendimento')
  })

  it('"O que você deve fazer" sai da regra do benefício', () => {
    expect(instrucaoDaConfirmacao('Josefa Exemplo', 'loas-idoso')).toBe(
      'Ligue ou mande mensagem pelo Chatwoot para Josefa confirmando a entrevista. O BPC/LOAS depende da renda de quem mora ' +
        'na casa e da idade ou da deficiência: peça que traga RG e CPF de todos da casa, comprovante de renda e CadÚnico; sem ' +
        'CadÚnico, vá ao CRAS antes. Duas tentativas sem confirmação, com 3 dias entre elas, sobem para a advogada sênior.',
    )
    expect(instrucaoDaConfirmacao('Natália Exemplo', 'incapacidade-temporaria')).toContain('confirmando a entrevista. Peça que traga RG, CPF e os laudos.')
  })
})

describe('ficha de atendimento (GGVP-24)', () => {
  const vazia: ValoresDaFicha = {
    nome: '',
    cpf: '',
    nascimento: '',
    telefone: '',
    endereco: '',
    pessoasNaCasa: '',
    beneficioInteresse: 'nao-sei',
    ultimaAtividade: '',
    semTrabalharDesde: '',
    pedidosAoInss: '',
  }
  const minima = { ...vazia, nome: 'Antônio Exemplo', cpf: CPF_COM_PONTOS, nascimento: '10/03/1964', telefone: '(11) 90000-0001' }

  it('CA5 · só salva com nome, CPF, data de nascimento e telefone', () => {
    expect(oQueFalta(vazia, HOJE)).toEqual(['Nome completo', 'CPF', 'Data de nascimento', 'Telefone / WhatsApp'])
    expect(oQueFalta({ ...minima, cpf: '' }, HOJE)).toEqual(['CPF'])
    expect(oQueFalta(minima, HOJE)).toEqual([])
  })

  it('CA12 · CPF com dígito errado, letra ou data futura no nascimento e pessoas fora do limite não passam', () => {
    expect(errosDaFicha({ ...minima, cpf: CPF_ERRADO }, HOJE).cpf).toBe(MENSAGEM.cpf)
    expect(errosDaFicha({ ...minima, nascimento: '1a/03/1964' }, HOJE).nascimento).toBe(MENSAGEM.data)
    expect(errosDaFicha({ ...minima, nascimento: '06/10/2026' }, HOJE).nascimento).toBe(MENSAGEM.data)
    expect(errosDaFicha({ ...minima, telefone: '90000-0001' }, HOJE).telefone).toBe(MENSAGEM.telefone)
    expect(errosDaFicha({ ...minima, pessoasNaCasa: '0' }, HOJE).pessoasNaCasa).toBe(MENSAGEM_PESSOAS)
    expect(errosDaFicha({ ...minima, pessoasNaCasa: '31' }, HOJE).pessoasNaCasa).toBe(MENSAGEM_PESSOAS)
    expect(errosDaFicha({ ...minima, pessoasNaCasa: '4' }, HOJE)).toEqual({})
  })

  it('CA6 e CA11 · endereço, pessoas na casa e a situação de trabalho podem ficar em branco e o Jurídico vê quais', () => {
    expect(camposEmBranco(minima)).toEqual([
      'Endereço',
      'Quantas pessoas moram na casa',
      'Última atividade',
      'Desde quando está sem trabalhar',
      'O que já pediu ao INSS',
    ])
    expect(camposEmBranco({ ...minima, endereco: 'Rua Exemplo, 1', ultimaAtividade: 'porteiro' })).toEqual([
      'Quantas pessoas moram na casa',
      'Desde quando está sem trabalhar',
      'O que já pediu ao INSS',
    ])
  })

  it('o envio sai normalizado e o servidor confere de novo; não há campo de senha (CA8)', () => {
    const envio = paraEnvio({ ...minima, pessoasNaCasa: '3', endereco: '  ' }, 'papel', 'GGV')
    expect(envio).toEqual({
      nome: 'Antônio Exemplo',
      cpf: CPF_DE_TESTE,
      nascimento: '10/03/1964',
      telefone: '11900000001',
      endereco: undefined,
      pessoasNaCasa: 3,
      beneficioInteresse: 'nao-sei',
      ultimaAtividade: undefined,
      semTrabalharDesde: undefined,
      pedidosAoInss: undefined,
      origem: 'papel',
      modelo: 'GGV',
    })
    expect(Object.keys(envio).some((c) => /senha/i.test(c))).toBe(false)
    expect(envioValido(envio, HOJE)).toBe(true)
    expect(envioValido({ ...envio, cpf: '00000000192' }, HOJE)).toBe(false)
    expect(envioValido({ ...envio, nascimento: '06/10/2026' }, HOJE)).toBe(false)
  })
})

describe('preparação da conversa (GGVP-32)', () => {
  const lead = ficha({ id: 'j', nome: 'Josefa Exemplo', telefone: '11900000002', situacao: 'lead', beneficioInteresse: 'loas-idoso', fichaAtendimentoPreenchida: true })
  const textos = (f: Ficha) => pontosDeAtencao(f, HOJE).map((p) => p.texto)

  it('CA1 e CA2 · sem senha: o alerta e se o Atendimento já tentou renovar; o benefício procurado', () => {
    expect(textos(lead)).toEqual([
      'Acidentário: decidir na análise da ficha',
      'Sem senha do gov.br · o Atendimento ainda não tentou renovar',
      'Benefício que o cliente procura: LOAS Idoso',
    ])
    const tentou = { ...lead, renovacao: { resultado: 'nao-conseguiu' as const, motivo: 'o celular cadastrado não é mais dela', quem: 'Você', quando: '' } }
    expect(textos(tentou)[1]).toBe('Sem senha do gov.br · o Atendimento tentou renovar e não conseguiu: o celular cadastrado não é mais dela')
    expect(textos({ ...lead, senhaGov: { situacao: 'sem-senha', naoSabe: true } })[1]).toBe('Sem senha do gov.br (o cliente não sabe) · o Atendimento ainda não tentou renovar')
    expect(atencaoCurta(pontosDeAtencao(lead, HOJE))).toBe('atenção: sem senha do gov.br')
  })

  it('CA4 · as três situações da senha, sem a senha, com a última vez que funcionou', () => {
    expect(textos({ ...lead, senhaGov: { situacao: 'no-cofre', funcionouEm: '2026-09-15' } })[1]).toBe('Senha do gov.br no cofre · funcionou pela última vez em 15/09')
    expect(textos({ ...lead, senhaGov: { situacao: 'no-cofre' } })[1]).toBe('Senha do gov.br no cofre · ainda sem registro de que funcionou')
    expect(textos({ ...lead, senhaGov: { situacao: 'escritorio-tem' } })[1]).toBe('Senha do gov.br: o escritório tem, mas ainda não está no cofre')
  })

  it('o acidentário vem da análise ou do benefício procurado; o que ficou em branco e a ficha que falta são alerta', () => {
    expect(textos({ ...lead, beneficioInteresse: 'auxilio-acidente' })[0]).toBe('O benefício procurado é acidentário: confirme na análise da ficha')
    const analisada = { ...lead, analise: { acidentario: true, quem: 'Dra. Paula', quando: '' } }
    expect(textos(analisada)[0]).toBe('Pode ser auxílio acidentário (decidido na análise da ficha) · segunda ficha ainda não preenchida')
    const branco = { ...lead, fichaAtendimento: { data: HOJE, origem: 'papel' as const, emBranco: ['Endereço', 'O que já pediu ao INSS'] } }
    expect(textos(branco).at(-1)).toBe('Ficou em branco na ficha: Endereço e O que já pediu ao INSS')
    expect(textos({ ...lead, fichaAtendimentoPreenchida: false }).at(-1)).toBe('A ficha de atendimento ainda não foi preenchida')
    expect(atencaoCurta(pontosDeAtencao({ ...analisada, senhaGov: { situacao: 'no-cofre' } }, HOJE))).toBe('atenção: pode ser acidentário')
    expect(atencaoCurta(pontosDeAtencao({ ...lead, senhaGov: { situacao: 'no-cofre' } }, HOJE))).toBe('sem pontos de atenção')
  })
})

describe('segunda ficha, de auxílio acidentário (GGVP-28)', () => {
  const lead = ficha({ id: 'j', nome: 'Josefa Exemplo', telefone: '11900000002', situacao: 'lead', fichaAtendimentoPreenchida: true })
  const respostas = { ...respostasVazias(), historico: 'Caí da escada no trabalho.' }

  it('CA5 · as 6 seções do modelo: a 1 é a ficha única; da 2 à 6, os campos do cartão', () => {
    expect(SECOES.map((s) => `${s.numero}. ${s.titulo}`)).toEqual([
      '2. Dados profissionais',
      '3. Benefício e INSS',
      '4. Acidente',
      '5. Dados médicos',
      '6. Histórico do caso contado pelo cliente',
    ])
    expect(SECOES[2].campos.map((c) => c.rotulo)).toEqual([
      'Houve CAT?',
      'Data da CAT',
      'Houve boletim de ocorrência?',
      'Data do boletim',
      'Foi acidente de trabalho?',
      'Parte do corpo afetada',
      'Lado',
    ])
    expect(Object.keys(respostasVazias()).some((c) => /senha/i.test(c))).toBe(false)
  })

  it('datas sem letra e não futuras, NB com 10 números e o histórico obrigatório', () => {
    expect(errosDaSegundaFicha(respostas, HOJE)).toEqual({})
    expect(errosDaSegundaFicha({ ...respostas, acidenteEm: '06/10/2026', der: '3a/01/2026', nb: '123' }, HOJE)).toEqual({
      acidenteEm: MENSAGEM.data,
      der: MENSAGEM.data,
      nb: MENSAGEM_NB,
    })
    expect(errosDaSegundaFicha({ ...respostas, historico: '' }, HOJE)).toEqual({ historico: MENSAGEM_HISTORICO })
    expect(emBrancoDaSegunda({ ...respostas, empresa: 'Exemplo Ltda' })).not.toContain('Empresa')
  })

  it('CA8 · a seção médica sai da visão do Atendimento', () => {
    expect(CAMPOS_MEDICOS).toEqual(['doencas', 'cid', 'tratamento', 'cirurgia', 'medico', 'laudos'])
    const vista = semDadosMedicos({ ...respostas, doencas: 'dor no punho', tratamento: 'fisioterapia', empresa: 'Exemplo Ltda' })
    expect(vista).toMatchObject({ doencas: '', tratamento: '', empresa: 'Exemplo Ltda' })
  })

  it('CA3 · a entrevista espera a análise e, no acidentário, a segunda ficha', () => {
    expect(motivoParaIniciar(lead)).toBe('Analise a ficha antes: pode ser auxílio acidentário?')
    const sim = { ...lead, analise: { acidentario: true, quem: 'Você (Advogada)', quando: '' } }
    expect(motivoParaIniciar(sim)).toBe('A cliente ainda não preencheu a segunda ficha (auxílio acidentário).')
    expect(motivoParaIniciar({ ...sim, segundaFicha: { data: HOJE, origem: 'papel', respostas, emBranco: [] } })).toBeNull()
    expect(motivoParaIniciar({ ...lead, analise: { acidentario: false, quem: '', quando: '' } })).toBeNull()
  })
})

describe('GGVP-40 · Entrevistar com gravação', () => {
  const lead = ficha({ id: 'lead', nome: 'Josefa Teste', telefone: '11900000002', situacao: 'lead', beneficioInteresse: 'loas-idoso' })
  const fala = (texto: string, papel: Trecho['papel'] = 'cliente', aos = 0): Trecho => ({ aos, quem: papel === 'cliente' ? 'Josefa' : 'Dra. Paula', papel, texto })

  /** Senhas de teste faladas: nenhuma pode sobrar no texto (CA7). */
  const SENHAS_DE_TESTE = ['Teste#2026', 'girassol123', 'TesteSenha99', 'Maria@1950', 'girassol', 'abc$teste', '19501950']

  it('CA3 e CA7 · a senha dita sai do texto, em várias formas de falar, e o resto da conversa fica', () => {
    const conversa = [
      fala('Me conta desde quando você está afastada.', 'advogada'),
      fala('Parei em 06/2026. Recebi auxílio por dois meses em 2024; meu telefone é (11) 90000-0021.'),
      fala('Minha senha do gov.br é Teste#2026, doutora.'),
      fala('A senha é girassol123'),
      fala('senha: TesteSenha99'),
      fala('E a senha do Meu INSS, qual é?', 'advogada'),
      fala('É Maria@1950, a mesma.'),
      fala('a senha é girassol'),
      fala('Anotei a senha abc$teste e também 19501950 no papel.'),
    ]
    const limpo = tirarSenhas(conversa)
    const texto = limpo.map((t) => t.texto).join(' | ')
    for (const senha of SENHAS_DE_TESTE) expect(texto).not.toContain(senha)
    expect(texto).toContain(SENHA_RETIRADA)
    expect(limpo[1].texto).toBe(conversa[1].texto)
    expect(limpo[0].texto).toBe(conversa[0].texto)
    expect(limpo[2].texto).toBe(`Minha senha do gov.br é ${SENHA_RETIRADA}, doutora.`)
  })

  it('CA9 · aceita qualquer formato de áudio, pelo tipo ou pela extensão', () => {
    expect(ehAudio({ nome: 'ligacao-chatwoot.ogg', tipo: '' })).toBe(true)
    expect(ehAudio({ nome: 'gravacao', tipo: 'audio/x-something' })).toBe(true)
    expect(ehAudio({ nome: 'WhatsApp Ptt.OPUS', tipo: 'application/octet-stream' })).toBe(true)
    expect(ehAudio({ nome: 'audio.amr', tipo: '' })).toBe(true)
    expect(ehAudio({ nome: 'laudo.pdf', tipo: 'application/pdf' })).toBe(false)
  })

  it('CA10 · sem limite: divide em partes de até 24 MB e junta o texto na ordem, com o tempo corrido', () => {
    expect(partesDoAudio(10 * 1024 * 1024)).toBe(1)
    expect(partesDoAudio(PARTE_MAXIMA)).toBe(1)
    expect(partesDoAudio(PARTE_MAXIMA + 1)).toBe(2)
    expect(partesDoAudio(300 * 1024 * 1024)).toBe(13)
    const juntas = juntarPartes([
      { inicio: 0, trechos: [fala('um', 'advogada', 0), fala('dois', 'cliente', 600)] },
      { inicio: 1200, trechos: [fala('três', 'advogada', 5)] },
    ])
    expect(juntas.map((t) => [t.aos, t.texto])).toEqual([
      [0, 'um'],
      [600, 'dois'],
      [1205, 'três'],
    ])
  })

  it('CA11 · relógio, duração e o roteiro com o acidentário, a senha e, no LOAS, a casa', () => {
    expect(relogio(462)).toBe('00:07:42')
    expect(relogio(3725)).toBe('01:02:05')
    expect(minutos(2292)).toBe('38 min')
    expect(minutos(20)).toBe('1 min')
    const roteiro = roteiroDaEntrevista({ ...lead, analise: { acidentario: false, quem: '', quando: '' } })
    expect(roteiro[1]).toBe('Acidentário já decidido antes da entrevista (D1.07): não · sem senha no cofre (G9)')
    expect(roteiro.at(-1)).toBe('Quem mora na casa e a renda de cada um')
    expect(roteiroDaEntrevista({ ...lead, beneficioInteresse: 'incapacidade-temporaria' })).toHaveLength(5)
  })

  it('a IA marca cada informação e aponta as pendências e os documentos', () => {
    const extraidas: InformacaoExtraida[] = [
      { id: 'telefone', rotulo: 'Telefone', valor: '11900000002', destino: 'ficha', campo: 'telefone' },
      { id: 'estado-civil', rotulo: 'Estado civil', valor: 'União estável', destino: 'ficha', campo: 'estadoCivil' },
      { id: 'laudos', rotulo: 'Laudos citados', valor: '2 laudos do ortopedista', destino: 'documentacao' },
      { id: 'senha', rotulo: 'Senha do gov.br', valor: 'digitada no cofre', destino: 'cofre' },
    ]
    expect(extraidas.map((e) => situacaoDaInformacao(e, lead))).toEqual(['confirmado', 'detectado', 'pedir', 'cofre'])
    expect(pendenciasDaEntrevista(lead, extraidas)).toEqual([
      'Pedir 2 laudos do ortopedista (kit, G1).',
      'Perguntar se houve acidente de trabalho (muda o benefício).',
      'Confirmar o CEP e o contato de apoio.',
    ])
    expect(documentosDaEntrevista({ ...lead, documentos: [{ nome: 'RG', detalhe: 'ok' }] }, extraidas)).toEqual([
      'CPF',
      'Comprovante de residência',
      'CNIS',
      '2 laudos do ortopedista',
    ])
  })
})

describe('GGVP-43 · Cadastrar o lead depois da entrevista', () => {
  const completo: Cadastro = {
    nome: 'Josefa Exemplo',
    cpf: CPF_COM_PONTOS,
    rg: '12.345.678-x',
    nascimento: '10/03/1958',
    estadoCivil: 'União estável',
    profissao: 'Auxiliar de limpeza',
    telefone: '(11) 90000-0002',
    cep: '01001-000',
    rua: 'Praça da Sé, 10',
    bairro: 'Sé',
    cidade: 'São Paulo',
    uf: 'sp',
  }

  it('CA3 e CA5 · os campos do modelo do contrato; CPF com dígito errado não passa; o que falta, na ordem da tela', () => {
    expect(errosDoCadastro(completo, HOJE)).toEqual({})
    expect(errosDoCadastro({ ...completo, cpf: CPF_ERRADO, rg: '12', estadoCivil: 'Casado', uf: 'XX' }, HOJE)).toEqual({
      cpf: 'CPF inválido: confira os 11 números.',
      rg: MENSAGEM_RG,
      estadoCivil: 'Escolha na lista.',
      uf: 'UF com 2 letras, como SP.',
    })
    const vazio = { ...completo, rg: '', estadoCivil: '', cep: '', nascimento: '' }
    expect(oQueFaltaNoCadastro(vazio, undefined, HOJE)).toEqual(['RG', 'Estado civil', 'CEP'])
  })

  it('CA6 · com representante, os campos dele também', () => {
    const representante = { nome: 'Renata Exemplo', cpf: '', rg: '', parentesco: 'Mãe', estadoCivil: '', profissao: 'Diarista' }
    expect(oQueFaltaNoCadastro(completo, representante, HOJE)).toEqual(['CPF do representante', 'RG do representante', 'Estado civil do representante'])
  })

  it('CA4 · sem os campos do modelo, o kit não é gerado e diz o que falta', () => {
    expect(faltaParaOKit(antonio)).toEqual(['estado civil', 'profissão', 'RG', 'endereço'])
    const cadastrada = { ...antonio, ...fichaDoCadastro(completo) }
    expect(faltaParaOKit(cadastrada)).toEqual([])
    expect(faltaParaOKit({ ...cadastrada, representante: { nome: 'Renata Exemplo', cpf: '', rg: '', parentesco: 'Mãe', estadoCivil: '', profissao: '' } })).toEqual([
      'dados do representante',
    ])
  })

  it('o estado civil da ficha antiga vira o da lista; a ficha guarda o cadastro normalizado', () => {
    expect(['Casado', 'casada', 'VIÚVA', 'união estável', 'separado'].map(estadoCivilDaLista)).toEqual(['Casado(a)', 'Casado(a)', 'Viúvo(a)', 'União estável', ''])
    expect(fichaDoCadastro(completo)).toMatchObject({ cpf: CPF_DE_TESTE, rg: '12345678X', nascimento: '1958-03-10', telefone: '11900000002', cep: '01001000', cidadeUf: 'São Paulo / SP' })
    expect(cadastroDaFicha({ ...josefa, ...fichaDoCadastro(completo) })).toEqual({ ...completo, rg: '12345678X', uf: 'SP' })
  })

  it('CA1 e CA8 · preenche pela ficha e pela entrevista; a diferença aparece para escolher', () => {
    const extraidas: InformacaoExtraida[] = [
      { id: 'telefone', rotulo: 'Telefone', valor: '11900000021', destino: 'ficha', campo: 'telefone' },
      { id: 'estado-civil', rotulo: 'Estado civil', valor: 'União estável', destino: 'ficha', campo: 'estadoCivil' },
      { id: 'profissao', rotulo: 'Profissão', valor: 'Auxiliar de limpeza', destino: 'ficha', campo: 'profissao' },
    ]
    const { valores, origem, divergencias } = preencherCadastro(josefa, extraidas)
    expect(valores).toMatchObject({ nome: 'Josefa Teste', telefone: '(11) 90000-0002', estadoCivil: 'União estável', profissao: 'Auxiliar de limpeza' })
    expect(origem).toMatchObject({ nome: 'ficha', telefone: 'ficha', estadoCivil: 'entrevista', profissao: 'entrevista' })
    expect(divergencias).toEqual([{ campo: 'telefone', ficha: '(11) 90000-0002', entrevista: '(11) 90000-0021' }])
  })

  it('CA11 · a mescla guarda o que o outro salvou e acusa o campo que os dois mexeram', () => {
    const base = { telefone: 'a', rg: '', estadoCivil: '' }
    const atual = { telefone: 'b', rg: '', estadoCivil: 'Casado(a)' }
    expect(mesclar(base, { telefone: 'a', rg: '123456', estadoCivil: '' }, atual)).toEqual({ valores: { telefone: 'b', rg: '123456', estadoCivil: 'Casado(a)' }, conflitos: [] })
    expect(mesclar(base, { telefone: 'c', rg: '', estadoCivil: 'Casado(a)' }, atual).conflitos).toEqual(['telefone'])
  })
})

describe('GGVP-46 · Transcrever a entrevista', () => {
  const trechos: Trecho[] = [
    { aos: 0, quem: 'Dra. Paula', papel: 'advogada', texto: 'Antes de porteiro, o senhor trabalhou na roça?' },
    { aos: 4, quem: 'Antônio', papel: 'cliente', texto: 'Trabalhei de 2018 a 2020 na lavoura, como RURAL, sem carteira.' },
    { aos: 9, quem: 'Antônio', papel: 'cliente', texto: 'Tenho as notas do produtor rural e o sindicato tem registro.' },
  ]

  it('CA2 · a busca acha a palavra sem acento e sem maiúscula e marca o trecho', () => {
    expect(buscarTrechos(trechos, 'rural').map((t) => t.aos)).toEqual([4, 9])
    expect(buscarTrechos(trechos, 'roca').map((t) => t.aos)).toEqual([0])
    expect(buscarTrechos(trechos, '  ')).toHaveLength(3)
    expect(marcarBusca('Trabalhei na roça e na ROÇA.', 'roca')).toEqual([
      { texto: 'Trabalhei na ', marca: false },
      { texto: 'roça', marca: true },
      { texto: ' e na ', marca: false },
      { texto: 'ROÇA', marca: true },
      { texto: '.', marca: false },
    ])
  })

  it('CA3 e CA4 · o selo de cada gravação e a contagem do topo', () => {
    const g = (parcial: Partial<Gravacao>): Gravacao => ({
      id: 'g', fichaId: 'f', data: HOJE, titulo: 't', canal: 'vídeo', participantes: [], duracao: 60, origem: 'portal', estado: 'encerrada',
      acoes: [], transcricao: 'pronta', trechos: [], extraidas: [], documentos: [], soJuridico: true, marcas: [], ...parcial,
    })
    const audio = { nome: 'a.webm', formato: 'webm', tamanho: 1, partes: 1 }
    expect(situacaoDaGravacao(g({ marcas: ['ficha atualizada'] }))).toBe('transcrita · ficha atualizada')
    expect(situacaoDaGravacao(g({ transcricao: 'falhou' }))).toBe('transcrição falhou')
    expect(situacaoDaGravacao(g({ transcricao: 'sem-audio', origem: 'registro' }))).toBe('só registro')
    expect(situacaoDaGravacao(g({ estado: 'gravando' }))).toBe('gravando')
    expect(contagemDoTopo([g({ audio }), g({ audio }), g({ origem: 'registro' })])).toBe('2 gravações · 1 registro sem áudio')
    expect(contagemDoTopo([g({ audio })])).toBe('1 gravação')
    expect(contagemDoTopo([])).toBe('nenhuma conversa ainda')
  })
})
