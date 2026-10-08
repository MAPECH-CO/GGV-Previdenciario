import { beforeEach, describe, expect, it } from 'vitest'
import { cadastroDaFicha } from '../regras/cadastro.ts'
import { buscarEndereco, obterCadastro, podeGerarKit, salvarCadastro } from './cadastro.ts'
import { encerrarGravacao, iniciarGravacao, transcrever } from './entrevista.ts'
import { CPF_DE_TESTE } from './exemplo.ts'
import { configurarExemplo, ler, obterFicha, zerarExemplo } from './servidor.ts'
import type { Cadastro } from './tipos.ts'

const AGORA = new Date(2026, 9, 5, 14, 32)

beforeEach(() => {
  configurarExemplo({ agora: () => AGORA, latencia: 0 })
  zerarExemplo()
})

/** A semente só tem um CPF, o de teste, que é do Antônio: o cadastro que salva é o dele. */
async function doAntonio(): Promise<{ base: Cadastro; completo: Cadastro }> {
  const base = cadastroDaFicha((await obterFicha('antonio-exemplo'))!)
  return { base, completo: { ...base, rg: '12.345.678-9', profissao: 'Porteiro(a)', cep: '01001-000', rua: 'Praça da Sé, 10', bairro: 'Sé' } }
}

describe('Cadastrar o lead · servidor de exemplo', () => {
  it('CA1 e CA8 · o cadastro abre com a ficha e o que a IA tirou da entrevista', async () => {
    const g = await iniciarGravacao('josefa-entrevista', { avisei: true })
    await encerrarGravacao(g.id, { aos: 140, online: true })
    await transcrever(g.id)
    const { ficha, extraidas } = (await obterCadastro('josefa-exemplo'))!
    expect(ficha.nome).toBe('Josefa Exemplo')
    expect(extraidas.filter((e) => e.campo).map((e) => [e.campo, e.valor])).toEqual([
      ['profissao', 'Auxiliar de limpeza'],
      ['estadoCivil', 'União estável'],
      ['contatoApoio', 'filha Renata · (11) 90000-0022'],
      ['telefone', '11900000021'],
    ])
  })

  it('CA2 · CPF de outra ficha não grava e mostra a ficha dona', async () => {
    const base = cadastroDaFicha((await obterFicha('josefa-exemplo'))!)
    const valores: Cadastro = { ...base, cpf: CPF_DE_TESTE, rg: '123456', estadoCivil: 'Viúvo(a)', profissao: 'Do lar', cep: '01001-000', rua: 'Praça da Sé, 1', bairro: 'Sé', cidade: 'São Paulo', uf: 'SP' }
    expect(await salvarCadastro('josefa-exemplo', { base, valores })).toEqual({ resultado: 'cpf-de-outra-ficha', id: 'antonio-exemplo', nome: 'Antônio Exemplo' })
    expect((await obterFicha('josefa-exemplo'))!.cpf).toBeUndefined()
  })

  it('CA3 · cadastro incompleto não grava', async () => {
    const { base } = await doAntonio()
    await expect(salvarCadastro('antonio-exemplo', { base, valores: base })).rejects.toThrow('Cadastro incompleto ou inválido')
  })

  it('CA4, CA7 e CA9 · completa a mesma ficha, com o valor anterior no histórico, e libera o kit', async () => {
    expect(await podeGerarKit('antonio-exemplo')).toEqual({ pode: false, falta: ['RG', 'endereço'] })
    const fichas = ler().fichas.length
    const { base, completo } = await doAntonio()
    const r = await salvarCadastro('antonio-exemplo', { base, valores: { ...completo, estadoCivil: 'União estável' } })
    expect(r.resultado).toBe('salvo')
    expect(ler().fichas).toHaveLength(fichas)
    const ficha = (await obterFicha('antonio-exemplo'))!
    expect(ficha).toMatchObject({ id: 'antonio-exemplo', rg: '123456789', estadoCivil: 'União estável', cep: '01001000', bairro: 'Sé' })
    expect(ficha.historico.slice(-7).map((e) => [e.quem, e.oQue])).toEqual([
      ['Você (Advogada)', 'Cadastrou o lead (D1.10): completou a mesma ficha do primeiro contato'],
      ['Você (Advogada)', 'Alterou RG: «—» → «123456789»'],
      ['Você (Advogada)', 'Alterou estado civil: «Casado» → «União estável»'],
      ['Você (Advogada)', 'Alterou profissão: «Trabalhador rural (2018–2020) · porteiro (2021–2025)» → «Porteiro(a)»'],
      ['Você (Advogada)', 'Alterou CEP: «—» → «01001-000»'],
      ['Você (Advogada)', 'Alterou rua e número: «—» → «Praça da Sé, 10»'],
      ['Você (Advogada)', 'Alterou bairro: «—» → «Sé»'],
    ])
    expect(await podeGerarKit('antonio-exemplo')).toEqual({ pode: true, falta: [] })
  })

  it('CA6 · o representante legal vai para a ficha e para o histórico', async () => {
    const { base, completo } = await doAntonio()
    const representante = { nome: 'Renata Exemplo', cpf: CPF_DE_TESTE, rg: '7654321', parentesco: 'Curador(a)', estadoCivil: 'Solteiro(a)', profissao: 'Diarista' }
    await salvarCadastro('antonio-exemplo', { base, valores: completo, representante })
    const ficha = (await obterFicha('antonio-exemplo'))!
    expect(ficha.representante).toEqual({ ...representante, cpf: CPF_DE_TESTE })
    expect(ficha.historico.at(-1)?.oQue).toBe('Alterou o representante legal: «—» → «Renata Exemplo (Curador(a))»')
  })

  it('CA11 · salvar não apaga o que outra pessoa salvou; o mesmo campo mexido pelos dois volta como conflito', async () => {
    const { base, completo } = await doAntonio()
    // Outra pessoa salva primeiro, trocando só o telefone.
    await salvarCadastro('antonio-exemplo', { base, valores: { ...completo, telefone: '(11) 90000-0031' } })
    // Eu, com a tela aberta antes, mudo só o estado civil.
    const meu = await salvarCadastro('antonio-exemplo', { base, valores: { ...completo, estadoCivil: 'Viúvo(a)' } })
    expect(meu.resultado).toBe('salvo')
    expect((await obterFicha('antonio-exemplo'))!).toMatchObject({ telefone: '11900000031', estadoCivil: 'Viúvo(a)' })
    const conflito = await salvarCadastro('antonio-exemplo', { base, valores: { ...completo, telefone: '(11) 90000-0032' } })
    expect(conflito).toEqual({ resultado: 'conflito', campos: [{ campo: 'telefone', deles: '(11) 90000-0031', meu: '(11) 90000-0032' }] })
  })

  it('CA10 · o CEP preenche rua, bairro, cidade e UF (ViaCEP simulado)', async () => {
    expect(await buscarEndereco('01001-000')).toMatchObject({ logradouro: 'Praça da Sé', bairro: 'Sé', cidade: 'São Paulo', uf: 'SP' })
    expect(await buscarEndereco('99999-999')).toBeNull()
  })
})
