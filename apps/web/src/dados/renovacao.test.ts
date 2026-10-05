import { beforeEach, describe, expect, it } from 'vitest'
import { obterPreparacao } from './preparacao.ts'
import { registrarRenovacao } from './renovacao.ts'
import { registrarAnalise } from './segundaFicha.ts'
import { CHAVE, configurarExemplo, gravar, ler, obterFicha, tarefasDoSetor, zerarExemplo } from './servidor.ts'

/** Senha de teste: não pode aparecer em lugar nenhum depois de guardada (G9). */
const SENHA_DE_TESTE = 'Teste#Renovada-4821'
const AGORA = new Date(2026, 9, 5, 14, 32)

beforeEach(() => {
  configurarExemplo({ agora: () => AGORA, latencia: 0 })
  zerarExemplo()
})

describe('Renovar a senha do gov.br · servidor de exemplo', () => {
  it('CA1 e CA4 · a análise de quem está sem senha abre "Renovar senha do gov.br" com prazo na hora da entrevista', async () => {
    await registrarAnalise('josefa-entrevista', { acidentario: false })
    expect(tarefasDoSetor('Atendimento')).toMatchObject([
      { codigo: 'D1.08', acao: 'Renovar senha do gov.br', prazo: 'até 15:30', urgente: true, href: '/entrevista/josefa-entrevista/renovar-senha' },
    ])
  })

  it('quem já tem a senha no cofre não recebe a tarefa', async () => {
    const banco = ler()
    banco.fichas.find((f) => f.id === 'josefa-exemplo')!.senhaGov = { situacao: 'no-cofre' }
    gravar(banco)
    await registrarAnalise('josefa-entrevista', { acidentario: false })
    expect(tarefasDoSetor('Atendimento')).toEqual([])
  })

  it('CA2, CA8, CA9 e CA11 · renovou: a senha vai ao cofre com a data em que funcionou, e o valor não fica em lugar nenhum', async () => {
    await registrarAnalise('josefa-entrevista', { acidentario: false })
    const r = await registrarRenovacao('josefa-entrevista', { resultado: 'renovou', senha: SENHA_DE_TESTE, conferiMeuInss: true })
    expect(r.senhaGov).toEqual({ situacao: 'no-cofre', atualizadaEm: AGORA.toISOString(), por: 'Você (Atendimento)', funcionouEm: '2026-10-05' })
    expect(ler().cofre).toEqual([{ fichaId: 'josefa-exemplo', quando: AGORA.toISOString(), quem: 'Você (Atendimento)', acao: 'renovou' }])
    expect(JSON.stringify(ler())).not.toContain(SENHA_DE_TESTE)
    expect(sessionStorage.getItem(CHAVE)).not.toContain(SENHA_DE_TESTE)
    expect(tarefasDoSetor('Atendimento')).toEqual([])
    // CA7: a advogada vê na preparação.
    const p = await obterPreparacao('josefa-entrevista')
    expect(p?.pontos.find((x) => x.tipo === 'senha')?.texto).toBe('Senha do gov.br no cofre · funcionou pela última vez em 05/10')
  })

  it('CA9 · sem conferir o Meu INSS, não guarda', async () => {
    await expect(
      registrarRenovacao('josefa-entrevista', { resultado: 'renovou', senha: SENHA_DE_TESTE, conferiMeuInss: false as true }),
    ).rejects.toThrow('inválida')
  })

  it('CA3, CA6 e CA7 · não conseguiu: motivo e aviso obrigatórios, o aviso em "Últimos contatos" e a advogada vê', async () => {
    await expect(registrarRenovacao('josefa-entrevista', { resultado: 'nao-conseguiu', motivo: '', aviseiOCliente: true })).rejects.toThrow('inválida')
    await expect(
      registrarRenovacao('josefa-entrevista', { resultado: 'nao-conseguiu', motivo: 'o celular não é mais dela', aviseiOCliente: false as true }),
    ).rejects.toThrow('inválida')
    await registrarRenovacao('josefa-entrevista', { resultado: 'nao-conseguiu', motivo: 'o celular não é mais dela', aviseiOCliente: true })
    const josefa = await obterFicha('josefa-exemplo')
    expect(josefa?.contatos.at(-1)).toMatchObject({ canal: 'Aviso', texto: expect.stringContaining('se preciso numa agência do INSS') })
    expect(josefa?.historico.at(-1)?.oQue).toBe('Não conseguiu renovar a senha do gov.br: o celular não é mais dela. Avisou o cliente; a entrevista segue')
    expect(josefa?.senhaGov.situacao).toBe('sem-senha')
    const p = await obterPreparacao('josefa-entrevista')
    expect(p?.pontos.find((x) => x.tipo === 'senha')?.texto).toBe('Sem senha do gov.br · o Atendimento tentou renovar e não conseguiu: o celular não é mais dela')
  })
})
