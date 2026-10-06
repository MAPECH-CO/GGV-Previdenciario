import { beforeEach, describe, expect, it } from 'vitest'
import { emVigor } from '../regras/roteiro.ts'
import { complementoAberto, tarefasDeComplemento } from './complemento.ts'
import { enviarArquivos } from './documentos.ts'
import { arquivarDocumentos, documentosLidos } from './leitura.ts'
import { obterLiberacao } from './liberacao.ts'
import {
  obterParecer,
  parecerParaOPortao,
  pedirDispensa,
  registrarParecer,
  responderDispensa,
  resumoParaAFicha,
  tarefasDoParecer,
  type PedidoDeParecer,
} from './parecer.ts'
import { travaDoParecer } from '../regras/liberacao.ts'
import { obterRoteiro, salvarRoteiro } from './roteiro.ts'
import { configurarExemplo, ler, obterFicha, zerarExemplo } from './servidor.ts'

let agora = new Date(2026, 9, 6, 15, 10)

beforeEach(() => {
  agora = new Date(2026, 9, 6, 15, 10)
  configurarExemplo({ agora: () => agora, latencia: 0 })
  zerarExemplo()
})

const PAULA = { perfil: 'advogada', nome: 'Dra. Paula (exemplo)' }
const pdf = (nome: string, tipo: string, n: number) => ({ nome, formato: 'pdf' as const, tamanho: 1000, tipo, hash: String(n).padStart(64, '0') })

async function juridico(processoId: string) {
  const p = await obterParecer(processoId, 'juridico')
  if (!p?.juridico) throw new Error('sem parecer')
  return p
}

/** Confere cada item como a IA achou, salvo o que vier em `corrigir`. */
async function pedido(processoId: string, decisao: PedidoDeParecer['decisao'], extra: Partial<PedidoDeParecer> = {}, corrigir: Record<string, string> = {}): Promise<PedidoDeParecer> {
  const analise = (await juridico(processoId)).juridico!.analise!
  const conferidos = Object.fromEntries(analise.itens.map((i) => [i.id, corrigir[i.id] ?? i.situacao]))
  return { analise: analise.quando, conferidos: conferidos as PedidoDeParecer['conferidos'], decisao, ...extra }
}

describe('Parecer de suficiência · servidor de exemplo', () => {
  it('CA1 · a Rita: o laudo da pilha cobre três dos cinco itens do LOAS, com o documento, a página e o trecho', async () => {
    const p = await juridico('rita-exemplo-1')
    expect(p.situacao).toBe('pendente')
    expect(p.roteiro).toEqual({ id: 'loas-deficiente', nome: 'BPC/LOAS Deficiente', versao: 1 })
    const { analise } = p.juridico!
    expect(analise?.itens.map((i) => [i.id, i.situacao, i.evidencia?.documento, i.evidencia?.pagina])).toEqual([
      ['natureza', 'presente', 'Laudo médico · 20/08/2026', 1],
      ['inicio', 'presente', 'Laudo médico · 20/08/2026', 1],
      ['prognostico', 'ausente', undefined, undefined],
      ['limitacoes', 'presente', 'Laudo médico · 20/08/2026', 2],
      ['barreiras', 'ausente', undefined, undefined],
      ['menos-de-24-meses', 'ausente', undefined, undefined],
    ])
    expect(analise?.itens[0].evidencia?.trecho).toBe('(exemplo) Impedimento físico de longo prazo, com sequela motora.')
    expect(analise?.sugestao).toBe('insuficiente')
    expect(p.juridico?.abordarSugerido).toBe(
      'O relatório médico precisa responder:\n• Qual a previsão de duração do quadro?\n• O paciente depende de outra pessoa, de acompanhamento contínuo, de transporte ou de tratamento? Com que frequência?',
    )
  })

  it('dado de saúde · o Atendimento recebe o resultado e os documentos, sem trecho, resumo nem comparação', async () => {
    const p = await obterParecer('sebastiao-exemplo-1', 'atendimento')
    expect(p?.juridico).toBeUndefined()
    expect(p?.situacao).toBe('suficiente')
    expect(p?.confirmado).toEqual({ quem: 'Dra. Paula', quando: new Date('2026-07-15T11:00:00').toISOString() })
    expect(p?.documentos.map((d) => [d.tipo, d.data])).toEqual([
      ['cat', '2024-03-15'],
      ['exame', '2025-02-10'],
      ['laudo', '2025-05-06'],
      ['laudo', '2025-07-08'],
      ['laudo', '2025-09-10'],
    ])
    expect(JSON.stringify(p)).not.toContain('(exemplo)')
    expect(JSON.stringify(p)).not.toContain('sequela')
  })

  it('CA3 e CA8 · Insuficiente só com o campo do G20; registra quem e quando, e abre a pendência de complemento (CA5)', async () => {
    await expect(registrarParecer('rita-exemplo-1', await pedido('rita-exemplo-1', 'insuficiente', { abordar: 'Confirmar o CID G80 no relatório' }), PAULA)).rejects.toThrow(
      /CID/,
    )
    await expect(registrarParecer('rita-exemplo-1', await pedido('rita-exemplo-1', 'suficiente'), PAULA)).rejects.toThrow('todo item obrigatório tem de estar presente')
    const abordar = (await juridico('rita-exemplo-1')).juridico!.abordarSugerido
    const p = await registrarParecer('rita-exemplo-1', await pedido('rita-exemplo-1', 'insuficiente', { abordar }), PAULA)
    expect(p.situacao).toBe('insuficiente')
    expect(p.confirmado).toEqual({ quem: 'Dra. Paula (exemplo)', quando: agora.toISOString() })
    expect(p.faltaPedir).toEqual([
      'Qual a previsão de duração do quadro?',
      'O paciente depende de outra pessoa, de acompanhamento contínuo, de transporte ou de tratamento? Com que frequência?',
    ])
    expect((await obterFicha('rita-exemplo'))?.historico.at(-1)).toMatchObject({
      quem: 'Dra. Paula (exemplo)',
      oQue: 'Registrou o parecer médico do LOAS Deficiente: Insuficiente (G17)',
    })
    expect(complementoAberto(ler(), 'rita-exemplo-1')).toMatchObject({ parecer: 'insuficiente', abordar, quem: 'Dra. Paula (exemplo)' })
    expect(tarefasDeComplemento()).toEqual([
      expect.objectContaining({
        acao: 'Pedir complemento ao médico',
        cliente: { id: 'rita-exemplo', nome: 'Rita Exemplo' },
        detalhe: 'LOAS Deficiente · parecer Insuficiente · 2 pontos para o médico abordar · 1ª tentativa',
        href: '/casos/rita-exemplo-1/complemento',
      }),
    ])
    expect(parecerParaOPortao(ler(), 'rita-exemplo-1')).toEqual({ situacao: 'insuficiente', quem: 'Dra. Paula (exemplo)', data: '2026-10-06' })
  })

  it('CA3 · a IA sozinha nunca registra: só o Jurídico, e a análise mudada pede para abrir de novo', async () => {
    const p = await pedido('rita-exemplo-1', 'insuficiente', { abordar: 'Qual a previsão de duração do quadro?' })
    await expect(registrarParecer('rita-exemplo-1', p, { perfil: 'atendimento', nome: 'Ana' })).rejects.toThrow('Só o Jurídico registra o parecer médico.')
    await expect(registrarParecer('rita-exemplo-1', { ...p, conferidos: {} }, PAULA)).rejects.toThrow('Confira cada item')
    await expect(registrarParecer('rita-exemplo-1', { ...p, analise: 'outra' }, PAULA)).rejects.toThrow('a análise mudou')
    expect(parecerParaOPortao(ler(), 'rita-exemplo-1')).toEqual({ situacao: 'pendente' })
  })

  it('CA4 · o relatório que chega depois do parecer refaz a análise e diz o que mudou; o Suficiente encerra o complemento', async () => {
    const abordar = (await juridico('rita-exemplo-1')).juridico!.abordarSugerido
    await registrarParecer('rita-exemplo-1', await pedido('rita-exemplo-1', 'insuficiente', { abordar }), PAULA)
    agora = new Date(2026, 9, 7, 9, 0)
    await enviarArquivos('rita-exemplo', { origem: 'card', arquivos: [pdf('relatorio medico.pdf', 'laudo', 31)] })
    const p = await juridico('rita-exemplo-1')
    expect(p.juridico?.pendente).toBe(true)
    expect(p.juridico?.analise?.sugestao).toBe('suficiente')
    expect(p.juridico?.analise?.mudou).toEqual([
      'Documento novo: Laudo médico · 07/10/2026',
      'Passa a cobrir: Prognóstico: duração prevista ou permanente',
      'Passa a cobrir: Barreiras: dependência de terceiros, acompanhamento contínuo, transporte, tratamento',
    ])
    // O parecer de antes continua valendo até a advogada conferir (G17).
    expect(p.situacao).toBe('insuficiente')
    await registrarParecer('rita-exemplo-1', await pedido('rita-exemplo-1', 'suficiente'), PAULA)
    expect(complementoAberto(ler(), 'rita-exemplo-1')).toBeUndefined()
    expect(tarefasDeComplemento()).toEqual([])
    expect((await obterLiberacao('rita-exemplo-1'))?.parecer).toMatchObject({ situacao: 'suficiente', quem: 'Dra. Paula (exemplo)' })
  })

  it('CA2 · o laudo da Cleide com "incapacidade total" deixa o parecer Contraditório, e o caso não avança (G18)', async () => {
    await enviarArquivos('cleide-exemplo', { origem: 'card', arquivos: [pdf('laudo incapacidade total.pdf', 'laudo', 41)] })
    const p = await juridico('cleide-exemplo-1')
    expect(p.roteiro?.id).toBe('pcd')
    expect(p.juridico?.analise?.sugestao).toBe('contraditorio')
    const contradicao = p.juridico!.analise!.itens.find((i) => i.id === 'incapacidade-total')!
    expect(contradicao).toMatchObject({ situacao: 'contraditorio', evidencia: { documento: 'Laudo médico · 06/10/2026', pagina: 1 } })
    const abordar = p.juridico!.abordarSugerido
    expect(abordar).toContain('Documentos que ajudam: Laudos e prontuários contemporâneos aos vínculos')
    await expect(registrarParecer('cleide-exemplo-1', await pedido('cleide-exemplo-1', 'suficiente'), PAULA)).rejects.toThrow('o parecer fica Contraditório')
    const registrado = await registrarParecer('cleide-exemplo-1', await pedido('cleide-exemplo-1', 'insuficiente', { abordar: abordar || 'Descrever o quadro atual.' }), PAULA)
    expect(registrado.situacao).toBe('contraditorio')
    expect(parecerParaOPortao(ler(), 'cleide-exemplo-1')?.situacao).toBe('contraditorio')
    expect(complementoAberto(ler(), 'cleide-exemplo-1')?.parecer).toBe('contraditorio')
  })

  it('CA6 e CA7 · o laudo novo do Antônio: a comparação do Figma, só o que está nos documentos; registrar limpa o "Laudo novo"', async () => {
    const p = await juridico('antonio-exemplo-1')
    expect(p.laudoNovoEm).toBe('2026-09-29')
    expect(p.situacao).toBe('suficiente')
    const c = p.juridico!.comparacao!
    expect([c.anterior?.data, c.novo.data]).toEqual(['2026-09-18', '2026-09-29'])
    expect(c.linhas.filter((l) => l.mudou).map((l) => l.rotulo)).toEqual(['Exames citados', 'Limitações descritas'])
    expect(c.resumo[1]).toBe('Mantém os mesmos CIDs (M54.5 e G56.0); a IA não sugere CID novo.')
    expect(c.aindaFalta).toEqual([])
    expect(tarefasDoParecer()).toContainEqual(
      expect.objectContaining({ acao: 'Analisar laudo novo', href: '/casos/antonio-exemplo-1/laudo-novo', detalhe: expect.stringContaining('enviado pelo Atendimento em 29/09') }),
    )
    await registrarParecer('antonio-exemplo-1', await pedido('antonio-exemplo-1', 'suficiente'), PAULA)
    const ficha = await obterFicha('antonio-exemplo')
    expect(ficha?.laudoNovoEm).toBeUndefined()
    expect(ficha?.historico.at(-1)?.oQue).toBe('Conferiu o laudo novo de 29/09 e manteve o parecer')
    expect(tarefasDoParecer().filter((t) => t.cliente?.id === 'antonio-exemplo')).toEqual([])
    expect((await juridico('antonio-exemplo-1')).juridico?.registro?.laudoNovo).toBe('2026-09-29')
  })

  it('CA6 · o laudo novo que sobe pelo card abre a tela do laudo novo, e o parecer conferido conclui a tarefa', async () => {
    await enviarArquivos('rita-exemplo', { origem: 'card', arquivos: [pdf('relatorio medico.pdf', 'laudo', 51)] })
    const tarefa = ler().tarefas.find((t) => t.acao === 'Analisar laudo novo')
    expect(tarefa).toMatchObject({ href: '/casos/rita-exemplo-1/laudo-novo', processoId: 'rita-exemplo-1', setor: 'Jurídico' })
    // A da semente não repete a que o card criou.
    expect(tarefasDoParecer().filter((t) => t.cliente?.id === 'rita-exemplo')).toEqual([])
    const c = (await juridico('rita-exemplo-1')).juridico!.comparacao!
    expect(c.passaACobrir).toEqual(['Prognóstico: duração prevista ou permanente', 'Barreiras: dependência de terceiros, acompanhamento contínuo, transporte, tratamento'])
    expect(c.resumo).toContain('Com ele, todos os itens obrigatórios do roteiro estão cobertos.')
    await registrarParecer('rita-exemplo-1', await pedido('rita-exemplo-1', 'suficiente'), PAULA)
    expect(ler().tarefas.find((t) => t.acao === 'Analisar laudo novo')?.concluida).toBe(true)
    expect((await obterFicha('rita-exemplo'))?.historico.at(-1)?.oQue).toBe('Conferiu o laudo novo de 06/10 e refez o parecer')
  })

  it('a Central da Advogada: "Dar parecer médico" da Rita e "Analisar laudo novo" do Antônio; o Sebastião já conferido não aparece', () => {
    expect(tarefasDoParecer().map((t) => [t.cliente?.nome, t.acao, t.detalhe])).toEqual([
      ['Antônio Exemplo', 'Analisar laudo novo', 'Aposentadoria por Incapacidade Permanente · enviado pelo Atendimento em 29/09 · resumo e comparação da IA prontos'],
      ['Rita Exemplo', 'Dar parecer médico', 'LOAS Deficiente · a IA sugere Insuficiente · confira item a item (G17)'],
    ])
  })

  it('GGVP-93 CA2 e CA4 · o caso guarda a versão do roteiro; a análise nova usa a versão em vigor', async () => {
    const abordar = (await juridico('rita-exemplo-1')).juridico!.abordarSugerido
    await registrarParecer('rita-exemplo-1', await pedido('rita-exemplo-1', 'insuficiente', { abordar }), PAULA)
    const loas = (await obterRoteiro('loas-deficiente'))!
    await salvarRoteiro('loas-deficiente', emVigor(loas).itens, { perfil: 'senior', nome: 'Dra. Renata (exemplo)' })
    // A análise de antes e o registro continuam na versão 1.
    expect((await juridico('rita-exemplo-1')).historico.map((h) => h.roteiro?.versao)).toEqual([1])
    expect((await juridico('rita-exemplo-1')).juridico?.analise?.roteiro?.versao).toBe(1)
    await enviarArquivos('rita-exemplo', { origem: 'card', arquivos: [pdf('relatorio medico.pdf', 'laudo', 61)] })
    expect((await juridico('rita-exemplo-1')).juridico?.analise?.roteiro?.versao).toBe(2)
    await registrarParecer('rita-exemplo-1', await pedido('rita-exemplo-1', 'suficiente'), PAULA)
    expect((await juridico('rita-exemplo-1')).historico.map((h) => [h.situacao, h.roteiro?.versao])).toEqual([
      ['insuficiente', 1],
      ['suficiente', 2],
    ])
  })

  it('GGVP-93 CA3 · benefício sem roteiro: a análise avisa e o registro exige a conferência manual', async () => {
    await enviarArquivos('lucia-exemplo', { origem: 'card', arquivos: [pdf('laudo.pdf', 'laudo', 71)] })
    const p = await juridico('lucia-exemplo-1')
    expect([p.semRoteiro, p.juridico?.analise?.sugestao, p.juridico?.analise?.itens]).toEqual([true, 'sem-roteiro', []])
    await expect(registrarParecer('lucia-exemplo-1', await pedido('lucia-exemplo-1', 'suficiente'), PAULA)).rejects.toThrow('conferência manual')
    const r = await registrarParecer('lucia-exemplo-1', await pedido('lucia-exemplo-1', 'suficiente', { conferenciaManual: 'Li o laudo e conferi as datas com o pedido.' }), PAULA)
    expect([r.situacao, r.juridico?.registro?.conferenciaManual]).toEqual(['suficiente', 'Li o laudo e conferi as datas com o pedido.'])
  })

  it('a ficha do Atendimento mostra o resultado e quem confirmou, sem o conteúdo', async () => {
    expect(resumoParaAFicha('sebastiao-exemplo')).toBe(
      '5 documentos médicos · parecer "Suficiente" confirmado por Dra. Paula em 15/07 (G17). O conteúdo dos laudos não é exibido aqui.',
    )
    expect(resumoParaAFicha('rita-exemplo')).toBe('1 documento médico · parecer aguardando a conferência do Jurídico (G17). O conteúdo dos laudos não é exibido aqui.')
    expect(resumoParaAFicha('josefa-exemplo')).toBeUndefined()
  })

  it('o documento em quarentena e o ilegível não entram na análise', async () => {
    await enviarArquivos('maria-exemplo', { origem: 'card', arquivos: [pdf('laudo ilegivel.pdf', 'laudo', 81)] })
    expect((await juridico('maria-exemplo-1')).situacao).toBe('sem-documentos')
    const c = await documentosLidos('rita-exemplo')
    await arquivarDocumentos('rita-exemplo', { conferi: true, documentos: c!.documentos.filter((d) => d.situacao === 'a-conferir').map(({ id, tipo, data }) => ({ id, tipo, data })), duplicados: 'manter' })
    expect((await juridico('rita-exemplo-1')).documentos).toHaveLength(1)
  })

  describe('GGVP-33 · portão e dispensa', () => {
    const RENATA = { perfil: 'senior', nome: 'Dra. Renata (exemplo)' }
    const OTAVIO = { perfil: 'senior-2', nome: 'Dr. Otávio (exemplo)' }
    const JUSTIFICATIVA = 'Prazo do juiz vence em dois dias e o médico só atende em novembro.'

    it('CA1 · sem parecer em ordem, as três ações travam e dizem o que falta', async () => {
      const pendente = parecerParaOPortao(ler(), 'rita-exemplo-1')
      for (const acao of ['liberar', 'aprovar-inss', 'pedir-peticao'] as const) {
        expect(travaDoParecer(acao, 'loas-deficiente', pendente)).toMatch(/ainda não foi confirmado por pessoa do Jurídico \(G17\)/)
      }
      const abordar = (await juridico('rita-exemplo-1')).juridico!.abordarSugerido
      await registrarParecer('rita-exemplo-1', await pedido('rita-exemplo-1', 'insuficiente', { abordar }), PAULA)
      expect(travaDoParecer('aprovar-inss', 'loas-deficiente', parecerParaOPortao(ler(), 'rita-exemplo-1'))).toBe(
        'Não dá para aprovar para o INSS: o parecer médico está Insuficiente. Falta o complemento do médico e o parecer refeito (G17).',
      )
    })

    it('CA2 · a dispensa pede justificativa e duas sêniores: quem pediu não aprova; aprovada, aparece no card e no histórico', async () => {
      await expect(pedirDispensa('rita-exemplo-1', JUSTIFICATIVA, PAULA)).rejects.toThrow('Só a sênior dispensa o parecer médico.')
      await expect(pedirDispensa('rita-exemplo-1', 'curta', RENATA)).rejects.toThrow('justificativa é obrigatória')
      await pedirDispensa('rita-exemplo-1', JUSTIFICATIVA, RENATA)
      await expect(pedirDispensa('rita-exemplo-1', JUSTIFICATIVA, OTAVIO)).rejects.toThrow('Já há um pedido de dispensa esperando a segunda sênior.')
      expect(tarefasDoParecer().filter((t) => t.cliente?.id === 'rita-exemplo')).toEqual([
        expect.objectContaining({ acao: 'Aprovar dispensa do parecer', href: '/casos/rita-exemplo-1/parecer/dispensa', detalhe: expect.stringContaining('pedida por Dra. Renata (exemplo)') }),
      ])
      await expect(responderDispensa('rita-exemplo-1', true, RENATA)).rejects.toThrow('Uma pessoa sozinha não dispensa o parecer')
      expect(parecerParaOPortao(ler(), 'rita-exemplo-1')?.situacao).toBe('pendente')
      const p = await responderDispensa('rita-exemplo-1', true, OTAVIO)
      expect(p.situacao).toBe('dispensado')
      expect(p.dispensa).toMatchObject({ pedidaPor: 'Dra. Renata (exemplo)', aprovadaPor: 'Dr. Otávio (exemplo)', justificativa: JUSTIFICATIVA })
      expect(parecerParaOPortao(ler(), 'rita-exemplo-1')).toEqual({
        situacao: 'dispensado',
        quem: 'Dra. Renata (exemplo) e Dr. Otávio (exemplo)',
        data: '2026-10-06',
        justificativa: JUSTIFICATIVA,
      })
      for (const acao of ['liberar', 'aprovar-inss', 'pedir-peticao'] as const) expect(travaDoParecer(acao, 'loas-deficiente', parecerParaOPortao(ler(), 'rita-exemplo-1'))).toBeNull()
      const historico = (await obterFicha('rita-exemplo'))!.historico.map((e) => [e.quem, e.oQue])
      expect(historico.slice(-2)).toEqual([
        ['Dra. Renata (exemplo)', `Pediu a dispensa do parecer médico (1ª aprovação da sênior, G17). Justificativa: ${JUSTIFICATIVA}`],
        ['Dr. Otávio (exemplo)', 'Aprovou a dispensa do parecer médico (2ª aprovação da sênior): dispensado por Dra. Renata (exemplo) e Dr. Otávio (exemplo) (G17)'],
      ])
      // O Atendimento vê a dispensa e a justificativa no card.
      expect((await obterParecer('rita-exemplo-1', 'atendimento'))?.dispensa?.justificativa).toBe(JUSTIFICATIVA)
      expect(tarefasDoParecer().filter((t) => t.cliente?.id === 'rita-exemplo')).toEqual([])
    })

    it('CA2 · a segunda sênior pode recusar, e o caso continua esperando o parecer', async () => {
      await pedirDispensa('rita-exemplo-1', JUSTIFICATIVA, RENATA)
      const p = await responderDispensa('rita-exemplo-1', false, OTAVIO)
      expect([p.situacao, p.dispensa?.recusadaPor]).toEqual(['pendente', 'Dr. Otávio (exemplo)'])
    })

    it('CA5 · o parecer refeito depois da dispensa passa a valer nos passos seguintes', async () => {
      await pedirDispensa('rita-exemplo-1', JUSTIFICATIVA, RENATA)
      await responderDispensa('rita-exemplo-1', true, OTAVIO)
      agora = new Date(2026, 9, 7, 9, 0)
      await enviarArquivos('rita-exemplo', { origem: 'card', arquivos: [pdf('relatorio medico.pdf', 'laudo', 91)] })
      await registrarParecer('rita-exemplo-1', await pedido('rita-exemplo-1', 'suficiente'), PAULA)
      expect(parecerParaOPortao(ler(), 'rita-exemplo-1')).toMatchObject({ situacao: 'suficiente', quem: 'Dra. Paula (exemplo)', data: '2026-10-07' })
      // E o refeito Insuficiente também manda: a trava volta.
      agora = new Date(2026, 9, 8, 9, 0)
      await enviarArquivos('rita-exemplo', { origem: 'card', arquivos: [pdf('laudo incompleto.pdf', 'laudo', 92)] })
      const abordar = 'Qual a previsão de duração do quadro?'
      await registrarParecer('rita-exemplo-1', await pedido('rita-exemplo-1', 'insuficiente', { abordar }, { prognostico: 'ausente' }), PAULA)
      expect(travaDoParecer('pedir-peticao', 'loas-deficiente', parecerParaOPortao(ler(), 'rita-exemplo-1'))).toMatch(/Insuficiente/)
    })
  })
})
