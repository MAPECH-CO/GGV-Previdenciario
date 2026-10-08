import { beforeEach, describe, expect, it } from 'vitest'
import { enviarBoasVindas, obterBoasVindas, tarefasDeReenviarBoasVindas } from './boasVindas.ts'
import { conferirChecklist } from './checklist.ts'
import { configurarExemplo, obterFicha, salvarFicha, zerarExemplo } from './servidor.ts'
import { telefoneDeExemplo } from './exemplo.ts'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 5, 14, 32), latencia: 0 })
  zerarExemplo()
})

describe('Boas-vindas · servidor de exemplo', () => {
  it('CA1 e CA5 · só depois da conferência do checklist, pelo modelo, com as cópias e o que falta', async () => {
    expect((await obterBoasVindas('rita-exemplo-1'))?.situacao).toBe('aguardando-checklist')
    await expect(enviarBoasVindas('rita-exemplo-1', { conferi: true, mensagem: 'oi' })).rejects.toThrow('Confira o checklist antes das boas-vindas')
    await conferirChecklist('rita-exemplo-1')
    const bv = await obterBoasVindas('rita-exemplo-1')
    expect(bv).toMatchObject({ situacao: 'a-enviar', copias: ['contrato', 'procuração'] })
    expect(bv?.faltam).toHaveLength(8)
    expect(bv?.mensagem).toContain('Junto com esta mensagem vão as cópias do contrato e da procuração que você assinou.')
    expect(bv?.mensagem).toContain('ainda precisamos destes documentos: Documento pessoal (RG), Documento pessoal (CPF)')
    expect(await obterBoasVindas('nenhum')).toBeNull()
  })

  it('CA2 e CA4 · vai uma vez, conferida, pelo Chatwoot, e fica no histórico e nos últimos contatos', async () => {
    await conferirChecklist('rita-exemplo-1')
    const { mensagem } = (await obterBoasVindas('rita-exemplo-1'))!
    // @ts-expect-error a conferência da mensagem é obrigatória
    await expect(enviarBoasVindas('rita-exemplo-1', { conferi: false, mensagem })).rejects.toThrow('Confira a mensagem antes de enviar')
    const registro = await enviarBoasVindas('rita-exemplo-1', { conferi: true, mensagem })
    expect(registro).toMatchObject({ situacao: 'enviada', processoId: 'rita-exemplo-1' })
    const ficha = await obterFicha('rita-exemplo')
    expect(ficha?.historico.at(-1)?.oQue).toBe('Enviou as boas-vindas pelo Chatwoot, com as cópias do kit e 8 pendências do checklist')
    expect(ficha?.contatos.at(-1)).toEqual({ data: '2026-10-05', canal: 'Chatwoot', texto: 'Boas-vindas, com as cópias do kit e o que falta.' })
    expect((await obterBoasVindas('rita-exemplo-1'))?.situacao).toBe('enviada')
    await expect(enviarBoasVindas('rita-exemplo-1', { conferi: true, mensagem })).rejects.toThrow('As boas-vindas já foram enviadas')
  })

  it('CA3 · quem já era cliente, com outro processo, não recebe', async () => {
    await conferirChecklist('cleide-exemplo-1')
    expect((await obterBoasVindas('cleide-exemplo-1'))?.situacao).toBe('ja-era-cliente')
    await expect(enviarBoasVindas('cleide-exemplo-1', { conferi: true, mensagem: 'oi' })).rejects.toThrow('Já era cliente')
  })

  it('CA6 · sem telefone, o envio falha, fica no histórico e vira "Reenviar boas-vindas"; enviada depois, a tarefa sai', async () => {
    await conferirChecklist('marta-exemplo-1')
    const { mensagem } = (await obterBoasVindas('marta-exemplo-1'))!
    expect(await enviarBoasVindas('marta-exemplo-1', { conferi: true, mensagem })).toMatchObject({ situacao: 'falhou' })
    expect((await obterFicha('marta-exemplo'))?.historico.at(-1)?.oQue).toBe(
      'As boas-vindas não saíram pelo Chatwoot: a ficha não tem telefone, e o Chatwoot não acha a conversa do cliente. Ficou a tarefa "Reenviar boas-vindas"',
    )
    expect(tarefasDeReenviarBoasVindas()).toEqual([
      expect.objectContaining({ codigo: 'D1.22', acao: 'Reenviar boas-vindas', cliente: { id: 'marta-exemplo', nome: 'Marta Exemplo' }, href: '/casos/marta-exemplo-1/checklist' }),
    ])
    const marta = (await obterFicha('marta-exemplo'))!
    await salvarFicha('marta-exemplo', { ...marta, telefone: telefoneDeExemplo(6) })
    expect(await enviarBoasVindas('marta-exemplo-1', { conferi: true, mensagem })).toMatchObject({ situacao: 'enviada' })
    expect(tarefasDeReenviarBoasVindas()).toEqual([])
  })
})
