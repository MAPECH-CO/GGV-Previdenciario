import { ROTULO_BENEFICIO } from '@ggv/contratos'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, identificadorCaso, peticao, peticaoVersao, pessoa, processoAcervo, protocoloJudicial, usuario } from '../banco/esquema.ts'
import { juizoDoCnj, jurimetriaDoJuizo } from './juizo.ts'

describe('juízo identificado (GGVP-64)', () => {
  it('CA1 · o juízo sai do número CNJ: tribunal e unidade de origem, com ou sem a máscara', () => {
    expect(juizoDoCnj('00012349620264036301')).toBe('TRF3 · 6301')
    expect(juizoDoCnj('0001234-96.2026.4.03.6301')).toBe('TRF3 · 6301')
    expect(juizoDoCnj('10012345620268260100')).toBe('TJSP · 0100')
    // Tribunal fora da tabela aparece pelo próprio código.
    expect(juizoDoCnj('00012345620265150001')).toBe('5.15 · 0001')
  })

  it('CA1 · número que não é CNJ não identifica juízo', () => {
    expect(juizoDoCnj('1234')).toBeNull()
  })
})

describe('jurimetria do juízo (GGVP-64)', () => {
  let banco: Banco
  let fechar: () => Promise<void>
  let senior: string
  const AGORA = new Date('2026-10-08T15:00:00Z')
  const JUIZO = 'TRF3 · 6301'
  beforeEach(async () => {
    ;({ banco, fechar } = await abrirBancoEmbutido())
    senior = (await banco.insert(usuario).values({ email: 'helena@exemplo.ggv', nome: 'Helena (exemplo)', senhaHash: 'x' }).returning())[0].id
  })
  afterEach(() => fechar())

  it('CA2, CA4, CA5 · procedência por benefício só com desfecho conferido e de mérito, cada taxa com os processos e a data da base', async () => {
    const conferido = (numeroCnj: string, desfecho: string) => ({ numeroCnj, beneficio: 'bpc_loas_deficiente', desfecho, desfechoConferidoPor: senior, fonte: 'importacao' })
    await banco.insert(processoAcervo).values([
      conferido('00000011220204036301', 'procedente_total'),
      conferido('00000021220204036301', 'procedente_parcial'),
      conferido('00000031220204036301', 'improcedente'),
      // Ficam fora: sem conferência, sem mérito (acordo) e de outra unidade.
      { numeroCnj: '00000041220204036301', beneficio: 'bpc_loas_deficiente', desfecho: 'improcedente', fonte: 'lote' },
      conferido('00000051220204036301', 'acordo'),
      conferido('00000061220204036183', 'improcedente'),
    ])
    const j = await jurimetriaDoJuizo(banco, JUIZO, AGORA)
    expect(j.porBeneficio).toEqual([
      { beneficio: 'bpc_loas_deficiente', nome: ROTULO_BENEFICIO.bpc_loas_deficiente, procedentes: 2, decididos: 3, texto: '67% em 3 processos · base de 08/10' },
    ])
    expect(j.processos.map((p) => p.numeroCnj)).toEqual(['00000011220204036301', '00000021220204036301', '00000031220204036301'])
    expect([j.juizo, j.base, j.tempoAteASentenca]).toEqual([JUIZO, '2026-10-08', null])
  })

  it('CA2 · tempo até a sentença: do protocolo da inicial à decisão, só com as duas datas; o CNJ pode vir do caso ligado', async () => {
    const [p] = await banco.insert(pessoa).values({ nome: 'Pessoa (exemplo)' }).returning()
    const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'aposentadoria_pcd' }).returning()
    await banco.insert(identificadorCaso).values({ casoId: c.id, tipo: 'cnj', valor: '0001234-96.2025.4.03.6301' })
    const [inicial] = await banco.insert(peticao).values({ casoId: c.id, tipo: 'inicial' }).returning()
    const [v] = await banco.insert(peticaoVersao).values({ peticaoId: inicial.id, numero: 1, conteudo: 'Petição (exemplo)', hash: 'h', geradaPor: 'pessoa' }).returning()
    await banco.insert(protocoloJudicial).values({ peticaoVersaoId: v.id, tribunal: 'TRF3', protocoladoEm: new Date('2025-01-10T15:00:00Z'), protocoladoPor: senior })
    await banco.insert(processoAcervo).values([
      { casoId: c.id, beneficio: 'aposentadoria_pcd', desfecho: 'procedente_total', desfechoConferidoPor: senior, dataDecisao: '2026-01-10', fonte: 'portal' },
      // Com a decisão e sem o protocolo: entra na taxa e fica fora do tempo.
      { numeroCnj: '00000071220204036301', beneficio: 'aposentadoria_pcd', desfecho: 'improcedente', desfechoConferidoPor: senior, dataDecisao: '2026-02-01', fonte: 'importacao' },
    ])
    const j = await jurimetriaDoJuizo(banco, JUIZO, AGORA)
    expect(j.tempoAteASentenca).toEqual({ meses: 12, processos: 1 })
    expect(j.porBeneficio).toMatchObject([{ beneficio: 'aposentadoria_pcd', procedentes: 1, decididos: 2, texto: '50% em 2 processos · base de 08/10' }])
    expect(j.processos.map((x) => x.numeroCnj)).toEqual(['00000071220204036301', '00012349620254036301'])
  })

  it('CA4 · juízo sem processo conferido: nenhuma taxa, e nada trava', async () => {
    const j = await jurimetriaDoJuizo(banco, 'TRF3 · 6183', AGORA)
    expect([j.porBeneficio, j.tempoAteASentenca, j.processos]).toEqual([[], null, []])
  })
})
