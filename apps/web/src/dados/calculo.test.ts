import { beforeEach, describe, expect, it } from 'vitest'
import { calculoPendente } from '../regras/calculo.ts'
import { definirBeneficio } from './beneficio.ts'
import { obterCalculo, registrarCalculo } from './calculo.ts'
import { encerrarGravacao, iniciarGravacao, transcrever } from './entrevista.ts'
import { configurarExemplo, obterFicha, tarefasDoSetor, zerarExemplo } from './servidor.ts'
import type { RegistroDoCalculo } from './tipos.ts'

const AGORA = new Date(2026, 9, 5, 14, 32)
const JOSEFA = 'josefa-entrevista'

beforeEach(() => {
  configurarExemplo({ agora: () => AGORA, latencia: 0 })
  zerarExemplo()
})

async function comBeneficio(beneficio: string) {
  const g = await iniciarGravacao(JOSEFA, { avisei: true })
  await encerrarGravacao(g.id, { aos: 140, online: true })
  await transcrever(g.id)
  return definirBeneficio(JOSEFA, { beneficio, conferi: true })
}

const jaPode: RegistroDoCalculo = {
  podeAposentar: true,
  tempo: { anos: 18, meses: 4, dias: 0 },
  pontos: 79.5,
  regra: 'Transição por pontos (EC 103, art. 15)',
  conferi: true,
}

describe('Calcular tempo e pontos · servidor de exemplo', () => {
  it('CA1 e CA4 · benefício com cálculo abre a tarefa do advogado do atendimento, com o CNIS do caso', async () => {
    const { tarefa } = await comBeneficio('aposentadoria-idade')
    expect(tarefa).toMatchObject({ codigo: 'D1.13', acao: 'Calcular tempo e pontos', href: `/entrevista/${JOSEFA}/calculo`, setor: 'Atendimento' })
    expect(tarefasDoSetor('Atendimento').map((t) => t.detalhe)).toContain('Aposentadoria por Idade · CNIS do Meu INSS de 02/10 · obrigatório antes do fechamento')
    expect(calculoPendente((await obterFicha('josefa-exemplo'))!)).toBe(true)
    const dados = (await obterCalculo(JOSEFA))!
    expect(dados.exige).toBe(true)
    expect(dados.cnis).toMatchObject({ origem: 'meu-inss', extraidoEm: '2026-10-02' })
  })

  it('CA3 · benefício sem cálculo não abre o passo; trocar para um sem cálculo tira a tarefa da fila', async () => {
    await comBeneficio('aposentadoria-idade')
    const { tarefa } = await definirBeneficio(JOSEFA, { beneficio: 'loas-idoso', conferi: true })
    expect(tarefa).toBeUndefined()
    expect(tarefasDoSetor('Atendimento').map((t) => t.acao)).not.toContain('Calcular tempo e pontos')
    expect((await obterCalculo(JOSEFA))!.exige).toBe(false)
    await expect(registrarCalculo(JOSEFA, jaPode)).rejects.toThrow('O benefício deste caso não exige cálculo')
  })

  it('CA5 e CA7 · registra o tempo, os pontos, a regra e quem conferiu, com o CNIS usado; número fora do limite não passa', async () => {
    await comBeneficio('aposentadoria-idade')
    await expect(registrarCalculo(JOSEFA, { ...jaPode, pontos: 950 })).rejects.toThrow('Cálculo incompleto ou inválido')
    const { ficha } = await registrarCalculo(JOSEFA, jaPode)
    expect(ficha.calculos).toEqual([
      {
        tempo: { anos: 18, meses: 4, dias: 0 },
        pontos: 79.5,
        regra: 'Transição por pontos (EC 103, art. 15)',
        podeAposentar: true,
        quem: 'Você (Advogado do atendimento)',
        quando: AGORA.toISOString(),
        cnisOrigem: 'meu-inss',
        cnisExtraidoEm: '2026-10-02',
      },
    ])
    expect(ficha.historico.at(-1)?.oQue).toBe(
      'Calculou tempo e pontos sobre o CNIS (D1.13): 18 anos e 4 meses, 79,5 pontos, Transição por pontos (EC 103, art. 15); já pode se aposentar',
    )
    expect(calculoPendente(ficha)).toBe(false)
    expect(tarefasDoSetor('Atendimento').map((t) => t.acao)).not.toContain('Calcular tempo e pontos')
  })

  it('CA2 e CA6 · refazer com "ainda não" guarda a data prevista e não apaga o cálculo anterior', async () => {
    await comBeneficio('aposentadoria-idade')
    await registrarCalculo(JOSEFA, jaPode)
    const { ficha } = await registrarCalculo(JOSEFA, { ...jaPode, podeAposentar: false, tempo: { anos: 14, meses: 2, dias: 10 }, pontos: 74, dataPrevista: '15/03/2028' })
    expect(ficha.calculos).toHaveLength(2)
    expect(ficha.calculos![0].tempo).toEqual({ anos: 18, meses: 4, dias: 0 })
    expect(ficha.calculos![1]).toMatchObject({ podeAposentar: false, dataPrevista: '2028-03-15' })
    expect(ficha.historico.at(-1)?.oQue).toBe(
      'Refez o cálculo de tempo e pontos (D1.13). Antes: 18 anos e 4 meses, 79,5 pontos, Transição por pontos (EC 103, art. 15); já pode se aposentar. Agora: 14 anos, 2 meses e 10 dias, 74,0 pontos, Transição por pontos (EC 103, art. 15); ainda não pode se aposentar: previsto para 15/03/2028',
    )
  })
})
