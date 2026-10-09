import { describe, expect, it } from 'vitest'
import { desfechoDaLista, haQuanto, mascararCpf, mesAno, situacaoDoCliente } from './bases.ts'

describe('as regras de Clientes e Processos (GGVP-78)', () => {
  it('o desfecho do caso como o Raio-X lê; sem ele, o do acervo conferido', () => {
    expect(desfechoDaLista(null, null)).toBe('em_andamento')
    expect(['deferido', 'procedente_total', 'procedente_parcial'].map((d) => desfechoDaLista(d, null))).toEqual(['exito', 'exito', 'exito'])
    expect(desfechoDaLista('improcedente', null)).toBe('perdido')
    expect(desfechoDaLista('extinto_sem_merito', null)).toBe('extinto')
    expect(desfechoDaLista('desistencia', null)).toBe('extinto')
    expect(desfechoDaLista(null, 'acordo')).toBe('acordo')
    expect(desfechoDaLista('improcedente', 'acordo')).toBe('perdido')
  })

  it('a situação do cliente: lead; caso aberto no INSS ou em andamento; todos decididos, êxito se ganhou algum', () => {
    expect(situacaoDoCliente(true, [])).toBe('lead')
    expect(situacaoDoCliente(false, [{ fase: 'administrativa', desfecho: 'em_andamento' }])).toBe('administrativo')
    expect(situacaoDoCliente(false, [{ fase: 'administrativa', desfecho: 'em_andamento' }, { fase: 'judicial', desfecho: 'em_andamento' }])).toBe('em_andamento')
    expect(situacaoDoCliente(false, [{ fase: 'encerrado', desfecho: 'perdido' }, { fase: 'encerrado', desfecho: 'acordo' }])).toBe('exito')
    expect(situacaoDoCliente(false, [{ fase: 'encerrado', desfecho: 'extinto' }])).toBe('perdido')
    expect(situacaoDoCliente(false, [])).toBe('em_andamento')
  })

  it('o CPF mascarado mostra só o meio', () => {
    expect(mascararCpf('52998224725')).toBe('***.982.247-**')
    expect(mascararCpf(undefined)).toBeNull()
    expect(mascararCpf('123')).toBeNull()
  })

  it('quanto faz o último contato, e o mês do ajuizamento', () => {
    const hoje = '2026-10-09'
    expect(['2026-10-09', '2026-10-08', '2026-10-06', '2026-10-02', '2026-09-25', '2026-09-09', '2026-08-01', '2025-10-01', '2023-10-09'].map((d) => haQuanto(d, hoje))).toEqual([
      'hoje',
      'ontem',
      '3 dias',
      '1 semana',
      '2 semanas',
      '1 mês',
      '2 meses',
      '1 ano',
      '3 anos',
    ])
    expect(mesAno('2026-02-10')).toBe('fev/26')
    expect(mesAno('2023-10-31')).toBe('out/23')
  })
})
