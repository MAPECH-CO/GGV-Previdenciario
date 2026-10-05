import { beforeEach, describe, expect, it } from 'vitest'
import {
  QUEM,
  buscarNoBalcao,
  conferirDuplicidade,
  configurarExemplo,
  criarFicha,
  encaminhar,
  ligarPasta,
  obterFicha,
  obterPasta,
  salvarFicha,
  tarefasDoSetor,
  zerarExemplo,
} from './servidor.ts'
import { CPF_DE_TESTE } from './exemplo.ts'
import type { NovoCliente } from './tipos.ts'

const AGORA = new Date(2026, 9, 5, 14, 32)

const ivone: NovoCliente = {
  nome: 'Ivone Teste',
  idade: 41,
  pretende: 'Afastada do trabalho há 3 meses, sem receber. Tem laudos do ortopedista.',
  telefone: '11900000050',
  beneficioInteresse: 'nao-sei',
  cidadeUf: 'Diadema / SP',
  comoChegou: 'instagram',
  outraPessoa: false,
}

beforeEach(() => {
  configurarExemplo({ agora: () => AGORA, latencia: 0 })
  zerarExemplo()
})

describe('servidor de exemplo', () => {
  it('a busca usa os clientes da Central e acha o agendamento de hoje', async () => {
    const [josefa] = await buscarNoBalcao('josefa')
    expect(josefa).toMatchObject({ id: 'josefa-exemplo', situacao: 'lead', fichaAtendimentoPreenchida: false })
    expect(josefa.agendamentoHoje).toMatchObject({ data: '2026-10-05', hora: '15:30' })
    const [cleide] = await buscarNoBalcao('Cleide')
    expect(cleide.casos).toHaveLength(2)
  })

  it('CA6 · CPF repetido não cria outra ficha: devolve a que existe', async () => {
    const resposta = await criarFicha({ ...ivone, cpf: CPF_DE_TESTE })
    expect(resposta).toEqual({ resultado: 'ja-existe', id: 'antonio-exemplo' })
    expect(await buscarNoBalcao('Ivone')).toEqual([])
  })

  it('CA9 · telefone de outra ficha só grava com "É outra pessoa"', async () => {
    const mesmoTelefone = { ...ivone, telefone: '11900000003' }
    const aviso = await criarFicha(mesmoTelefone)
    expect(aviso.resultado).toBe('parecidas')
    if (aviso.resultado === 'parecidas') expect(aviso.fichas.map((f) => f.nome)).toEqual(['Natália Exemplo', 'Nair Exemplo'])
    const criada = await criarFicha({ ...mesmoTelefone, outraPessoa: true })
    expect(criada.resultado).toBe('criada')
    expect((await conferirDuplicidade({ nome: '', telefone: '11900000003' })).parecidas).toHaveLength(3)
  })

  it('CA3 e CA13 · nasce lead com o mínimo, e a anotação vai para "Últimos contatos"', async () => {
    const resposta = await criarFicha(ivone)
    expect(resposta.resultado).toBe('criada')
    const ficha = await obterFicha('ivone-teste')
    expect(ficha).toMatchObject({ situacao: 'lead', desde: '10/2026', idade: 41, telefone: '11900000050' })
    expect(ficha?.cpf).toBeUndefined()
    expect(ficha?.contatos).toEqual([{ data: '2026-10-05', canal: 'Presencial (balcão)', texto: ivone.pretende }])
    expect(ficha?.historico.at(-1)).toMatchObject({ quem: QUEM, oQue: 'Criou a ficha no balcão (lead)' })
  })

  it('valida de novo no servidor: telefone sem DDD não grava', async () => {
    await expect(criarFicha({ ...ivone, telefone: '912345678' })).rejects.toThrow()
  })

  it('CA14 · sem pasta no Drive, cria uma só', async () => {
    const resposta = await criarFicha(ivone)
    if (resposta.resultado !== 'criada') throw new Error(resposta.resultado)
    expect(resposta.pastas).toEqual([])
    const pasta = await ligarPasta(resposta.id, 'nova')
    expect(pasta).toMatchObject({ nome: 'Ivone Teste', caminho: 'Leads/2026', nova: true })
    expect((await obterFicha(resposta.id))?.pastaId).toBe(pasta.id)
  })

  it('CA14 · duas pastas com o mesmo nome: a tela recebe as duas para perguntar', async () => {
    const resposta = await criarFicha({ ...ivone, nome: 'Rosa Exemplo', telefone: '11900000051' })
    if (resposta.resultado !== 'criada') throw new Error(resposta.resultado)
    expect(resposta.pastas.map((p) => p.id)).toEqual(['drive-rosa-1', 'drive-rosa-2'])
    const pasta = await ligarPasta(resposta.id, 'drive-rosa-2')
    expect(pasta.nova).toBe(false)
    expect((await obterFicha(resposta.id))?.historico.at(-1)?.oQue).toBe('Ligou à pasta que já existia no Drive: Scanner/antigos/ROSA EXEMPLO')
  })

  it('CA4 e CA8 · encaminhar cria a tarefa do setor e grava quem, quando e para onde', async () => {
    const { tarefa, evento } = await encaminhar({ fichaId: 'antonio-exemplo', motivo: 'outra-etapa', setor: 'Documentação · ADM' })
    expect(tarefa).toMatchObject({
      codigo: 'D1.03',
      cliente: { id: 'antonio-exemplo', nome: 'Antônio Exemplo' },
      setor: 'Documentação · ADM',
      href: '/clientes/antonio-exemplo',
    })
    expect(tarefa.detalhe).toBe('Aposentadoria por incapacidade permanente · chegou ao balcão às 14:32 · sem agendamento hoje')
    expect(evento).toEqual({
      quando: AGORA.toISOString(),
      quem: QUEM,
      oQue: 'Encaminhou ao setor Documentação · ADM (outra etapa), com a ficha e o agendamento',
    })
    expect(tarefasDoSetor('Documentação · ADM')).toHaveLength(1)
    expect(tarefasDoSetor('Financeiro')).toHaveLength(0)
    expect((await obterFicha('antonio-exemplo'))?.historico.at(-1)).toEqual(evento)
  })

  it('entrevista agendada vai ao Jurídico com o agendamento; sem entrevista hoje, não vai', async () => {
    const { tarefa } = await encaminhar({ fichaId: 'josefa-exemplo', motivo: 'entrevista', setor: 'Jurídico' })
    expect(tarefa.detalhe).toContain('entrevista hoje 15:30')
    await expect(encaminhar({ fichaId: 'nair-exemplo', motivo: 'entrevista', setor: 'Jurídico' })).rejects.toThrow()
  })

  it('salvar a ficha grava o que mudou no histórico; CPF de outra ficha não passa', async () => {
    const antes = (await obterFicha('antonio-exemplo'))!
    const edicao = {
      nome: antes.nome,
      cpf: antes.cpf,
      nascimento: antes.nascimento,
      telefone: '11999990000',
      email: 'antonio@exemplo.com',
      estadoCivil: antes.estadoCivil,
      endereco: antes.endereco,
      cidadeUf: antes.cidadeUf,
      cep: antes.cep,
      profissao: antes.profissao,
      comoChegou: antes.comoChegou,
      contatoPreferido: antes.contatoPreferido,
      contatoApoio: antes.contatoApoio,
      observacoes: antes.observacoes,
    }
    const resposta = await salvarFicha('antonio-exemplo', edicao)
    if (!('ficha' in resposta)) throw new Error(resposta.erro)
    expect(resposta.ficha.historico.at(-1)?.oQue).toBe('Alterou telefone e e-mail')
    expect(resposta.ficha.indicadoPor).toBe('Maria Exemplo')
    expect(await salvarFicha('josefa-exemplo', { ...edicao, nome: 'Josefa Exemplo', cpf: CPF_DE_TESTE })).toEqual({
      erro: 'cpf-de-outra-ficha',
      nome: 'Antônio Exemplo',
    })
  })

  it('o que se grava sobrevive à recarga da página (sessionStorage)', async () => {
    await criarFicha(ivone)
    expect(sessionStorage.getItem('ggv.exemplo.v1')).toContain('Ivone Teste')
    expect(await obterPasta('drive-rosa-1')).toMatchObject({ caminho: 'Clientes/2024' })
  })
})
