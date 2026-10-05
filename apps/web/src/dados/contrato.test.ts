import { beforeEach, describe, expect, it } from 'vitest'
import {
  CLIENTE_DO_EXEMPLO_DOS_MODELOS,
  SEGREDO_DO_RETORNO_EXEMPLO,
  concluirAssinaturaEmPapel,
  configurarZapSign,
  digitalizarContratoAssinado,
  enviarParaAssinatura,
  fecharContrato,
  gerarContrato,
  imprimirKit,
  obterContrato,
  receberRetornoDoZapSign,
  registrarTentativaDeAssinatura,
  salvarCondicoes,
  simularRetornoDoZapSign,
  tarefasDoContrato,
  type EnvioDoContrato,
} from './contrato.ts'
import { CPF_DE_TESTE } from './exemplo.ts'
import { configurarExemplo, gravar, ler, obterFicha, zerarExemplo } from './servidor.ts'

let hoje = new Date(2026, 9, 5, 14, 32)

beforeEach(() => {
  hoje = new Date(2026, 9, 5, 14, 32)
  configurarExemplo({ agora: () => hoje, latencia: 0 })
  configurarZapSign({ falhar: false })
  zerarExemplo()
})

describe('GGVP-65 · kit de documentos por benefício · servidor de exemplo', () => {
  it('CA1 · a semente: a Cleide fechou a Aposentadoria PCD e o Atendimento tem "Preparar contrato" com o kit', async () => {
    const tarefa = tarefasDoContrato().find((t) => t.processoId === 'cleide-exemplo-1')
    expect(tarefa).toMatchObject({
      codigo: 'D1.16',
      cliente: { id: 'cleide-exemplo', nome: 'Cleide Exemplo' },
      acao: 'Preparar contrato',
      detalhe: 'PCD Aposentadoria por Contribuição · kit Aposentadorias · Contrato Completo 2026',
      href: '/contrato/cleide-exemplo-1/preparar',
    })
    const caso = await obterContrato('cleide-exemplo-1')
    expect(caso?.contrato.kit?.documentos.map((d) => d.nome)).toEqual([
      'Contrato de honorários',
      'Procuração',
      'Declaração de hipossuficiência',
      'Declaração de residência',
      'Termo INSS',
      'Código Penal',
    ])
    expect(await obterContrato('antonio-exemplo-1')).toBeNull()
  })

  it('CA1 e CA8 · o lead que fecha o LOAS vira cliente, ganha o processo e o kit com a ficha de grupo familiar', async () => {
    const { ficha, processo, contrato } = await fecharContrato('josefa-exemplo', 'loas-idoso')
    expect(ficha).toMatchObject({ situacao: 'cliente', desde: '10/2026' })
    expect(processo).toMatchObject({ id: 'josefa-exemplo-1', beneficio: 'loas-idoso', etapa: 'Contrato · preparar' })
    expect(contrato.kit?.documentos.map((d) => d.id)).toContain('grupo-familiar')
    expect((await obterFicha('josefa-exemplo'))?.historico.at(-1)?.oQue).toBe(
      'Fechou LOAS Idoso: processo novo com o kit LOAS idoso ou deficiente (7 documentos, Contrato Completo 2026)',
    )
    expect(tarefasDoContrato().map((t) => t.cliente?.nome)).toContain('Josefa Exemplo')
  })

  it('CA9 · quem já é cliente e fecha outro benefício ganha processo e kit novos, com contrato e procuração', async () => {
    const { processo, contrato } = await fecharContrato('antonio-exemplo', 'isencao-ir')
    expect(processo.id).toBe('antonio-exemplo-2')
    expect(contrato.kit?.documentos.map((d) => d.id)).toEqual(['contrato', 'procuracao', 'termo-inss', 'codigo-penal', 'residencia'])
    expect((await obterFicha('antonio-exemplo'))?.processos).toHaveLength(2)
    expect(tarefasDoContrato().filter((t) => t.cliente?.id === 'antonio-exemplo')).toHaveLength(1)
  })

  it('benefício fora do catálogo ou "Não sei ainda" não fecha; fora da tabela fecha sem kit', async () => {
    await expect(fecharContrato('antonio-exemplo', 'nao-sei')).rejects.toThrow('catálogo')
    await expect(fecharContrato('antonio-exemplo', 'inventado')).rejects.toThrow('catálogo')
    const { contrato } = await fecharContrato('antonio-exemplo', 'pensao-morte')
    expect(contrato.kit).toBeNull()
    expect(tarefasDoContrato().find((t) => t.processoId === contrato.processoId)?.detalhe).toBe('Pensão por Morte · benefício sem kit cadastrado')
  })

  it('CA2 e CA8 · as condições do LOAS montam o kit de novo e ficam no histórico', async () => {
    const { processo } = await fecharContrato('josefa-exemplo', 'loas-idoso')
    const contrato = await salvarCondicoes(processo.id, { representado: true, moradia: true, uniaoEstavel: false, separacaoDeFato: false })
    expect(contrato.kit?.nome).toBe('LOAS representado (genitor)')
    expect(contrato.kit?.documentos.at(-1)?.id).toBe('declaracao-moradia')
    expect((await obterFicha('josefa-exemplo'))?.historico.at(-1)?.oQue).toBe(
      'Condições do kit de LOAS Idoso: representado por genitor(a), comprovante de residência em nome de outra pessoa',
    )
  })
})

const TODAS = { campos: true, datas: true, fichaLoas: true, codigoPenal: true }
const aprovado: EnvioDoContrato = { aprovados: true, conferencias: TODAS, correcoes: {} }
const corrigir = (correcoes: EnvioDoContrato['correcoes'], oQueCorrigir = 'faltavam o RG e o endereço'): EnvioDoContrato => ({
  aprovados: false,
  oQueCorrigir,
  conferencias: TODAS,
  correcoes,
})

describe('GGVP-69 · preencher o contrato pelo modelo e conferir · servidor de exemplo', () => {
  it('CA7 · com campo obrigatório vazio, o contrato não segue para a assinatura', async () => {
    expect(await gerarContrato('cleide-exemplo-1', aprovado)).toEqual({ resultado: 'faltam', campos: ['estadoCivil', 'profissao', 'cpf', 'rg', 'endereco'] })
    expect((await obterContrato('cleide-exemplo-1'))?.contrato.etapa).toBe('preparar')
  })

  it('CA3 e CA7 · corrigir grava, registra no histórico, gera de novo e o contrato vai colher a assinatura', async () => {
    const { processo } = await fecharContrato('antonio-exemplo', 'aposentadoria-idade')
    const r = await gerarContrato(processo.id, corrigir({ rg: '12.345.678-X', endereco: 'Rua Exemplo, 1 · São Paulo/SP' }))
    expect(r.resultado).toBe('gerado')
    const caso = await obterContrato(processo.id)
    expect(caso?.contrato).toMatchObject({ etapa: 'assinatura', dados: { rg: '12.345.678-X' }, corrigidos: ['rg', 'endereco'] })
    expect(caso?.contrato.documento?.versao).toBe(1)
    expect(caso?.contrato.versoes).toEqual([{ versao: 1, geradoEm: expect.any(String), motivo: 'corrigido: faltavam o RG e o endereço' }])
    expect(caso?.ficha.endereco).toBe('Rua Exemplo, 1 · São Paulo/SP')
    expect(caso?.processo).toMatchObject({ etapa: 'Contrato · assinatura', proximaAcao: 'colher a assinatura' })
    expect(caso?.ficha.historico.slice(-2).map((e) => e.oQue)).toEqual([
      'Corrigiu no contrato: RG e Endereço (faltavam o RG e o endereço)',
      'Gerou o contrato de Aposentadoria por Idade pelo modelo contrato-completo-2026-v1 (versão 1): conferiu os campos, as datas à mão, a ficha LOAS e a página do Código Penal',
    ])
    expect(tarefasDoContrato().find((t) => t.processoId === processo.id)).toMatchObject({
      codigo: 'D1.17',
      acao: 'Colher assinatura',
      href: `/contrato/${processo.id}/assinatura`,
    })
  })

  it('CA8 · o texto gerado tem o cliente e não sobra nada do modelo', async () => {
    const { processo } = await fecharContrato('antonio-exemplo', 'aposentadoria-idade')
    await gerarContrato(processo.id, corrigir({ rg: '12.345.678-X', endereco: 'Rua Exemplo, 1' }))
    const textos = (await obterContrato(processo.id))!.contrato.documento!.textos
    expect(textos).toHaveLength(6)
    expect(textos[0].texto).toContain('Antônio Exemplo, Casado, Trabalhador rural (2018–2020) · porteiro (2021–2025), CPF 000.000.001-91, RG 12.345.678-X')
    expect(textos[0].texto).toContain('Honorários: 20% do êxito (ad exitum). Parte contrária: Instituto Nacional do Seguro Social (INSS).')
    for (const t of textos) {
      expect(t.texto, t.documento).not.toMatch(/\{\{|\}\}/)
      for (const d of CLIENTE_DO_EXEMPLO_DOS_MODELOS) expect(t.texto).not.toContain(d)
    }
  })

  it('CPF de outra ficha não grava', async () => {
    const r = await gerarContrato('cleide-exemplo-1', corrigir({ cpf: CPF_DE_TESTE }, 'faltava o CPF'))
    expect(r).toEqual({ resultado: 'cpf-de-outra-ficha', nome: 'Antônio Exemplo' })
    expect((await obterFicha('cleide-exemplo'))?.cpf).toBeUndefined()
  })

  it('CA1 e CA9 · no LOAS representado, os dados do representante são obrigatórios', async () => {
    const { processo } = await fecharContrato('antonio-exemplo', 'loas-deficiente')
    await salvarCondicoes(processo.id, { representado: true, moradia: false, uniaoEstavel: false, separacaoDeFato: false })
    const r = await gerarContrato(processo.id, corrigir({ rg: '12.345.678-X', endereco: 'Rua Exemplo, 1', representanteNome: 'Maria Exemplo' }))
    expect(r).toEqual({ resultado: 'faltam', campos: ['representanteCpf', 'representanteRg', 'representanteParentesco'] })
  })

  it('CA6 · o servidor valida de novo a decisão, o que corrigir, as conferências e cada campo', async () => {
    await expect(gerarContrato('cleide-exemplo-1', { ...aprovado, conferencias: { ...TODAS, datas: false } })).rejects.toThrow('conferências')
    await expect(gerarContrato('cleide-exemplo-1', corrigir({}, ''))).rejects.toThrow('o que corrigir')
    await expect(gerarContrato('cleide-exemplo-1', corrigir({ cpf: '000.000.001-92' }))).rejects.toThrow('inválida')
    await expect(gerarContrato('cleide-exemplo-1', corrigir({ beneficio: 'curatela' }))).rejects.toThrow('inválida')
  })
})

/** O Antônio fecha a Aposentadoria por Idade e o contrato é gerado: fica para colher a assinatura. */
async function contratoGerado() {
  const { processo } = await fecharContrato('antonio-exemplo', 'aposentadoria-idade')
  await gerarContrato(processo.id, corrigir({ rg: '12.345.678-X', endereco: 'Rua Exemplo, 1' }))
  return processo.id
}

describe('GGVP-72 · assinatura digital pelo ZapSign · servidor de exemplo', () => {
  it('CA2 e CA4 · a semente: a Nair recebeu o link há 9 dias; a tarefa mostra o status e lembra de tentar de novo', () => {
    expect(tarefasDoContrato().find((t) => t.processoId === 'nair-exemplo-1')).toMatchObject({
      codigo: 'D1.17',
      acao: 'Colher assinatura',
      detalhe: 'Aposentadoria por Idade · ZapSign enviado 26/09 · tentativa 1 de 2',
      prazo: 'tentar contato hoje',
      urgente: true,
      href: '/contrato/nair-exemplo-1/assinatura',
    })
  })

  it('CA1, CA4 e CA12 · o ZapSign gera um documento por kit, com o link e a mensagem do WhatsApp pronta', async () => {
    const id = await contratoGerado()
    const r = await enviarParaAssinatura(id)
    expect(r.resultado).toBe('gerado')
    if (r.resultado !== 'gerado') return
    expect(r.contrato.assinatura?.zapsign).toMatchObject({ documentoId: `zapsign-exemplo-${id}`, status: 'enviado' })
    expect(r.mensagem).toContain(`https://zapsign.exemplo/assinar/zapsign-exemplo-${id}`)
    expect(tarefasDoContrato().find((t) => t.processoId === id)).toMatchObject({ detalhe: 'Aposentadoria por Idade · ZapSign gerado · link ainda não enviado', prazo: 'enviar o link' })
    const deNovo = await enviarParaAssinatura(id)
    expect(deNovo.resultado === 'gerado' && deNovo.contrato.assinatura?.zapsign?.documentoId).toBe(`zapsign-exemplo-${id}`)
  })

  it('CA2 e CA5 · cada tentativa fica com a data e o canal; a próxima só 3 dias depois, com o mesmo link', async () => {
    const id = await contratoGerado()
    await enviarParaAssinatura(id)
    await registrarTentativaDeAssinatura(id, 'whatsapp', 'Olá, Antônio! Aqui está o link.')
    const ficha = await obterFicha('antonio-exemplo')
    expect(ficha?.contatos.at(-1)).toEqual({ data: '2026-10-05', canal: 'WhatsApp', texto: 'Link do ZapSign enviado para assinar o contrato.' })
    expect(tarefasDoContrato().find((t) => t.processoId === id)).toMatchObject({ detalhe: 'Aposentadoria por Idade · ZapSign enviado 05/10 · tentativa 1 de 2', prazo: 'nova tentativa 08/10' })
    await expect(registrarTentativaDeAssinatura(id, 'ligacao')).rejects.toThrow('Ainda não é dia')
    hoje = new Date(2026, 9, 8, 10, 0)
    const contrato = await registrarTentativaDeAssinatura(id, 'ligacao')
    expect(contrato.assinatura?.tentativas.map((t) => [t.data, t.canal])).toEqual([
      ['2026-10-05', 'whatsapp'],
      ['2026-10-08', 'ligacao'],
    ])
    expect(contrato.assinatura?.zapsign?.documentoId).toBe(`zapsign-exemplo-${id}`)
  })

  it('CA11 · com a segunda tentativa sem assinatura, o caso sobe para a advogada sênior e sai da Central do Atendimento', async () => {
    const contrato = await registrarTentativaDeAssinatura('nair-exemplo-1', 'ligacao')
    expect(contrato.assinatura?.naSenior).toBe(true)
    expect(tarefasDoContrato().some((t) => t.processoId === 'nair-exemplo-1')).toBe(false)
    expect(ler().tarefas.find((t) => t.processoId === 'nair-exemplo-1')).toMatchObject({
      setor: 'Jurídico',
      acao: 'Colher assinatura · limite de tentativas',
      detalhe: 'Aposentadoria por Idade · 2 tentativas sem assinatura (G15) · o Atendimento tentou em 26/09 e 05/10',
    })
    await expect(registrarTentativaDeAssinatura('nair-exemplo-1', 'ligacao')).rejects.toThrow('Ainda não é dia')
  })

  it('CA3, CA6 e CA10 · assinado, o arquivo final do ZapSign entra no card, segue para a leitura e a tarefa se encerra sozinha', async () => {
    await registrarTentativaDeAssinatura('nair-exemplo-1', 'ligacao')
    const r = await simularRetornoDoZapSign('nair-exemplo-1')
    expect(r).toEqual({
      resultado: 'anexado',
      arquivo: {
        nome: 'Contrato assinado - Nair Exemplo - 2026-10-05 (ZapSign, com evidências).pdf',
        tipo: 'contrato',
        local: 'nair-exemplo-1',
        data: '2026-10-05',
        origem: 'card',
        repetido: false,
        aguardaLeitura: true,
      },
    })
    const caso = await obterContrato('nair-exemplo-1')
    expect(caso?.contrato.etapa).toBe('leitura')
    expect(caso?.processo.etapa).toBe('Contrato assinado em 05/10')
    expect(tarefasDoContrato().some((t) => t.processoId === 'nair-exemplo-1')).toBe(false)
    expect(ler().tarefas.find((t) => t.processoId === 'nair-exemplo-1')?.concluida).toBe(true)
  })

  it('CA7 · o retorno sem o segredo é recusado, e o mesmo evento repetido não anexa duas vezes', async () => {
    const retorno = { documentoId: 'zapsign-exemplo-nair-exemplo-1', eventoId: 'evento-1', status: 'assinado' as const }
    await expect(receberRetornoDoZapSign({ ...retorno, segredo: 'errado' })).rejects.toThrow('não autenticado')
    expect((await receberRetornoDoZapSign({ ...retorno, segredo: SEGREDO_DO_RETORNO_EXEMPLO })).resultado).toBe('anexado')
    expect(await receberRetornoDoZapSign({ ...retorno, segredo: SEGREDO_DO_RETORNO_EXEMPLO })).toEqual({ resultado: 'repetido' })
    expect((await obterFicha('nair-exemplo'))?.arquivos.filter((a) => a.tipo === 'contrato')).toHaveLength(1)
  })

  it('CA9 · erro ao gerar no ZapSign: a tarefa mostra a mensagem e dá para tentar de novo', async () => {
    const id = await contratoGerado()
    configurarZapSign({ falhar: true })
    expect(await enviarParaAssinatura(id)).toEqual({ resultado: 'erro', mensagem: 'O ZapSign não respondeu ao gerar o documento. Nada foi enviado ao cliente.' })
    expect(tarefasDoContrato().find((t) => t.processoId === id)).toMatchObject({ detalhe: 'Aposentadoria por Idade · erro ao gerar no ZapSign: tente de novo', urgente: true })
    configurarZapSign({ falhar: false })
    expect((await enviarParaAssinatura(id)).resultado).toBe('gerado')
  })
})

describe('GGVP-77 · assinatura em papel na entrevista · servidor de exemplo', () => {
  it('CA1 · o kit impresso sai com as datas em branco, menos o contrato de honorários', async () => {
    const id = await contratoGerado()
    const { contrato, datas } = await imprimirKit(id)
    expect(contrato.assinatura).toMatchObject({ forma: 'papel', impressoEm: expect.any(String) })
    expect(datas[0]).toEqual({ documento: 'Contrato de honorários', data: '05/10/2026' })
    expect(datas.slice(1).map((d) => d.data)).toEqual(Array(5).fill('em branco, à mão na assinatura'))
    expect(tarefasDoContrato().find((t) => t.processoId === id)?.detalhe).toBe('Aposentadoria por Idade · papel · impresso, falta digitalizar o assinado')
  })

  it('CA2 e CA3 · só conclui com a digitalização anexada; o PDF pesquisável entra na pasta do caso para a leitura', async () => {
    const id = await contratoGerado()
    await imprimirKit(id)
    await expect(concluirAssinaturaEmPapel(id)).rejects.toThrow('Anexe a digitalização')
    const arquivo = await digitalizarContratoAssinado(id)
    expect(arquivo).toEqual({
      nome: 'Contrato assinado - Antônio Exemplo - 2026-10-05 (papel, PDF pesquisável).pdf',
      tipo: 'contrato',
      local: id,
      data: '2026-10-05',
      origem: 'scanner',
      repetido: false,
      aguardaLeitura: true,
    })
    expect((await obterFicha('antonio-exemplo'))?.arquivos.at(-1)).toEqual(arquivo)
    await expect(enviarParaAssinatura(id)).rejects.toThrow('já foi digitalizado')
    const contrato = await concluirAssinaturaEmPapel(id)
    expect(contrato.etapa).toBe('leitura')
    expect(tarefasDoContrato().some((t) => t.processoId === id)).toBe(false)
  })

  it('CA4 · entrevista por vídeo ou telefone: sem papel na hora, a assinatura vai pelo ZapSign', async () => {
    const id = await contratoGerado()
    const banco = ler()
    banco.fichas.find((f) => f.id === 'antonio-exemplo')!.agendamentos.push({ id: 'antonio-entrevista', data: '2026-10-05', hora: '10:30', oQue: 'Entrevista', tipo: 'video' })
    gravar(banco)
    await expect(imprimirKit(id)).rejects.toThrow('Papel só na entrevista presencial')
    expect((await enviarParaAssinatura(id)).resultado).toBe('gerado')
  })
})
