import { describe, expect, it } from 'vitest'
import {
  CANAIS_DO_REGISTRO,
  COM_QUEM,
  MODOS_DO_REGISTRO,
  ONDE,
  erroDoValor,
  modoDoCanal,
  motivoParaNaoConferir,
  motivoParaNaoAbrir,
  oQueMudou,
  oQuePrecisaAtualizar,
  papelDoPerfil,
  podeConfirmar,
  podeVoltarVersao,
  valorGuardado,
  valorLido,
  type Dito,
  type Mudanca,
  type PedidoDeConversa,
} from './conversa.ts'

const pedido: PedidoDeConversa = { canal: 'presencial', comQuem: 'cliente', modo: 'tempo-real', processoId: 'maria-exemplo-1' }

describe('Registrar a conversa (GGVP-76)', () => {
  it('CA3 · só ligação e presencial; com quem: cliente, familiar ou contato de apoio, médico ou clínica', () => {
    expect(Object.values(CANAIS_DO_REGISTRO).map((c) => c.rotulo)).toEqual(['Ligação', 'Presencial'])
    expect(JSON.stringify(CANAIS_DO_REGISTRO)).not.toMatch(/whatsapp|v[ií]deo/i)
    expect(Object.values(COM_QUEM)).toEqual(['Cliente', 'Familiar ou contato de apoio', 'Médico ou clínica'])
  })

  it('CA4 · gravar agora, anexar a ligação ou só escrever; o canal sugere o modo', () => {
    expect(Object.values(MODOS_DO_REGISTRO).map((m) => m.rotulo)).toEqual(['Transcrição em tempo real', 'Anexar arquivo', 'Sem áudio'])
    expect(modoDoCanal('ligacao')).toBe('arquivo')
    expect(modoDoCanal('presencial')).toBe('tempo-real')
  })

  it('Atendimento e Jurídico conduzem a conversa; Documentação e Financeiro, não (Lucas, 06/10)', () => {
    expect(papelDoPerfil('atendimento')).toBe('atendimento')
    expect(papelDoPerfil('atendimento-lider')).toBe('atendimento')
    expect(['advogada', 'senior', 'senior-2'].map((p) => papelDoPerfil(p as 'advogada'))).toEqual(['juridico', 'juridico', 'juridico'])
    expect(papelDoPerfil('documentacao')).toBeNull()
    expect(papelDoPerfil('financeiro')).toBeNull()
    expect(motivoParaNaoAbrir(pedido, null, ['maria-exemplo-1'])).toBe('A conversa com o cliente é do Atendimento e do Jurídico.')
  })

  it('CA3 e CA4 · o que falta para abrir', () => {
    const processos = ['maria-exemplo-1']
    expect(motivoParaNaoAbrir(pedido, 'atendimento', processos)).toBeNull()
    expect(motivoParaNaoAbrir({ ...pedido, canal: undefined }, 'atendimento', processos)).toBe('Escolha o canal: ligação ou presencial.')
    expect(motivoParaNaoAbrir({ ...pedido, canal: 'whatsapp' as never }, 'atendimento', processos)).toBe('Escolha o canal: ligação ou presencial.')
    expect(motivoParaNaoAbrir({ ...pedido, comQuem: undefined }, 'atendimento', processos)).toBe('Marque com quem você falou.')
    expect(motivoParaNaoAbrir({ ...pedido, modo: undefined }, 'atendimento', processos)).toBe('Escolha a gravação.')
    expect(motivoParaNaoAbrir({ ...pedido, processoId: 'outro' }, 'atendimento', processos)).toBe('Processo não encontrado.')
    // Com dois processos, a pessoa escolhe; o lead sem processo não tem o campo (Lucas, 06/10).
    expect(motivoParaNaoAbrir({ ...pedido, processoId: undefined }, 'atendimento', ['a', 'b'])).toBe('Escolha o processo da conversa.')
    expect(motivoParaNaoAbrir({ ...pedido, processoId: undefined }, 'atendimento', [])).toBeNull()
    expect(motivoParaNaoAbrir({ ...pedido, modo: 'escrito', registro: ' ab ' }, 'atendimento', processos)).toBe('Escreva o resumo da conversa.')
    expect(motivoParaNaoAbrir({ ...pedido, modo: 'escrito', registro: 'Tirou dúvida sobre a perícia.' }, 'atendimento', processos)).toBeNull()
    expect(motivoParaNaoAbrir({ ...pedido, modo: 'escrito', registro: 'a'.repeat(4001) }, 'atendimento', processos)).toBe('O resumo vai até 4000 letras.')
  })
})

describe('Identificar o que mudou (GGVP-80)', () => {
  const dito = (d: Dito, aos = 20) => ({ ...d, aos, trecho: 'trecho' })
  const ficha = { telefone: '11900000004', endereco: '', estadoCivil: 'Casada' }

  it('CA2 e CA5 · só o que é diferente do guardado, marcado ficha ou processo, com o trecho e a hora', () => {
    const mudancas = oQueMudou(
      [
        dito({ onde: 'ficha', campo: 'endereco', valor: 'Rua Exemplo das Acácias, 45' }),
        dito({ onde: 'ficha', campo: 'telefone', valor: '(11) 90000-0044' }, 38),
        dito({ onde: 'ficha', campo: 'estadoCivil', valor: ' casada ' }),
        dito({ onde: 'processo', campo: 'pericia', valor: '2026-10-16' }, 56),
        dito({ onde: 'processo', campo: 'fato', valor: 'Três dias no hospital', saude: true }, 66),
      ],
      ficha,
      { pericia: '2026-10-02' },
    )
    expect(mudancas.map((m) => [m.onde, m.campo, m.antes, m.depois, m.aos])).toEqual([
      ['ficha', 'endereco', '', 'Rua Exemplo das Acácias, 45', 20],
      ['ficha', 'telefone', '11900000004', '(11) 90000-0044', 38],
      ['processo', 'pericia', '2026-10-02', '2026-10-16', 56],
      ['processo', 'fato', '', 'Três dias no hospital', 66],
    ])
    expect(mudancas[0]).toMatchObject({ rotulo: 'endereço', trecho: 'trecho' })
    expect(mudancas[3].saude).toBe(true)
    expect(oQuePrecisaAtualizar(mudancas)).toEqual(['ficha', 'processo'])
  })

  it('o telefone dito igual ao guardado, com outra máscara, não é mudança; sem processo, o do processo fica de fora', () => {
    const mudancas = oQueMudou([dito({ onde: 'ficha', campo: 'telefone', valor: '(11) 90000-0004' }), dito({ onde: 'processo', campo: 'pericia', valor: '2026-10-16' })], ficha, null)
    expect(mudancas).toEqual([])
    expect(oQuePrecisaAtualizar(mudancas)).toEqual([])
  })

  it('o valor como a pessoa lê: telefone com máscara, data dd/mm/aaaa, vazio é traço', () => {
    expect(valorLido('telefone', '11900000044')).toBe('(11) 90000-0044')
    expect(valorLido('pericia', '2026-10-16')).toBe('16/10/2026')
    expect(valorLido('endereco', '')).toBe('—')
    expect(ONDE).toEqual({ ficha: 'Ficha do cliente', processo: 'Campos do processo' })
  })
})

describe('Conferir o que a IA quer mudar (GGVP-84)', () => {
  const m = (id: string, campo: Mudanca['campo'], onde: Mudanca['onde'] = 'ficha'): Mudanca => ({ id, onde, campo, rotulo: campo, antes: '', depois: 'x', aos: 0, trecho: '' })
  const mudancas = [m('a', 'endereco'), m('b', 'telefone'), m('c', 'fato', 'processo')]

  it('CA8 · o fato novo, que pode ser dado de saúde, só o Jurídico confirma; o resto, quem conversou', () => {
    expect(podeConfirmar('endereco', 'atendimento')).toBe(true)
    expect(podeConfirmar('pericia', 'atendimento')).toBe(true)
    expect(podeConfirmar('fato', 'atendimento')).toBe(false)
    expect(podeConfirmar('fato', 'juridico')).toBe(true)
    expect(podeConfirmar('endereco', null)).toBe(false)
  })

  it('CA4, CA5 e CA8 · cada mudança que o perfil pode tem decisão; a de outro perfil fica sem; a corrigida passa pela biblioteca de campos', () => {
    expect(motivoParaNaoConferir(mudancas, [{ id: 'a', decisao: 'confirmada' }], 'atendimento')).toBe('Confirme, corrija ou desfaça: telefone.')
    expect(motivoParaNaoConferir(mudancas, [{ id: 'a', decisao: 'confirmada' }, { id: 'b', decisao: 'desfeita' }], 'atendimento')).toBeNull()
    expect(motivoParaNaoConferir(mudancas, [{ id: 'a', decisao: 'confirmada' }, { id: 'b', decisao: 'desfeita' }, { id: 'c', decisao: 'confirmada' }], 'atendimento')).toBe(
      'A mudança de fato é de a advogada responsável ou a Sênior.',
    )
    expect(motivoParaNaoConferir(mudancas, [{ id: 'a', decisao: 'confirmada' }, { id: 'b', decisao: 'corrigida', valor: '9999' }], 'atendimento')).toBe('Corrija telefone: Telefone com DDD.')
    expect(motivoParaNaoConferir(mudancas, [{ id: 'z', decisao: 'confirmada' }], 'atendimento')).toBe('Essa mudança não está na conversa.')
    // Depois da conferência de quem conversou, o Jurídico confere só o que ficou.
    expect(motivoParaNaoConferir(mudancas, [{ id: 'c', decisao: 'confirmada' }], 'juridico', ['a', 'b'])).toBeNull()
    expect(motivoParaNaoConferir(mudancas, [{ id: 'a', decisao: 'desfeita' }], 'juridico', ['a', 'b'])).toBe('Essa mudança não está na conversa.')
  })

  it('o valor corrigido: erro pela biblioteca de campos e o valor como fica guardado', () => {
    expect(erroDoValor('telefone', '(11) 90000-0055')).toBeUndefined()
    expect(erroDoValor('email', 'maria@')).toBe('E-mail inválido.')
    expect(erroDoValor('pericia', '31/02/2026')).toBe('Data no formato dd/mm/aaaa.')
    expect(erroDoValor('endereco', ' x ')).toBe('De 2 a 200 letras.')
    expect(valorGuardado('telefone', '(11) 90000-0055')).toBe('11900000055')
    expect(valorGuardado('pericia', '17/10/2026')).toBe('2026-10-17')
    expect(valorGuardado('endereco', ' Rua Exemplo, 1 ')).toBe('Rua Exemplo, 1')
  })

  it('CA2 · só a Sênior volta uma versão', () => {
    expect(['senior', 'senior-2'].map((p) => podeVoltarVersao(p as 'senior'))).toEqual([true, true])
    expect(['advogada', 'atendimento', undefined].map((p) => podeVoltarVersao(p as 'advogada'))).toEqual([false, false, false])
  })
})
