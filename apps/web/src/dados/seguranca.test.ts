import { beforeEach, describe, expect, it } from 'vitest'
import { formatarTelefone } from '../campos.ts'
import { NUNCA_PEDIMOS_A_SENHA } from '../regras/mensagens.ts'
import { mensagensDoCliente } from './mensagens.ts'
import { camposProtegidosQueMudam, confirmarMudancaBancaria, obterDadosBancarios, pedirMudancaBancaria, salvarFichaVerificada } from './seguranca.ts'
import { configurarExemplo, obterFicha, tarefasDoSetor, zerarExemplo } from './servidor.ts'
import type { EdicaoFicha, Ficha } from './tipos.ts'

const BRUNA = { quem: 'Ana (exemplo)', perfil: 'atendimento' as const }
const CARLA = { quem: 'Carla (exemplo)', perfil: 'atendimento-lider' as const }
const JESSICA = { quem: 'Jéssica (exemplo)', perfil: 'documentacao' as const }
const CONTA_NOVA = { banco: 'Banco Exemplo Dois', agencia: '0002', conta: '65432-1' }

const edicaoDe = (f: Ficha): EdicaoFicha => ({
  nome: f.nome,
  cpf: f.cpf,
  nascimento: f.nascimento,
  telefone: f.telefone,
  email: f.email,
  estadoCivil: f.estadoCivil,
  endereco: f.endereco,
  cidadeUf: f.cidadeUf,
  cep: f.cep,
  profissao: f.profissao,
  comoChegou: f.comoChegou,
  contatoPreferido: f.contatoPreferido,
  contatoApoio: f.contatoApoio,
  observacoes: f.observacoes,
})

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 7, 14, 32), latencia: 0 })
  zerarExemplo()
})

describe('Terceiro não se passa pelo cliente · servidor de exemplo (GGVP-111)', () => {
  it('CA1 · telefone e e-mail só mudam com o cliente verificado e em contrato novo; o antigo e o novo ficam no histórico', async () => {
    const maria = (await obterFicha('maria-exemplo'))!
    const novo = { ...edicaoDe(maria), telefone: '11900000044' }
    await expect(salvarFichaVerificada('maria-exemplo', novo, null, BRUNA)).rejects.toThrow('só mudam com o cliente verificado')
    await expect(salvarFichaVerificada('maria-exemplo', novo, { como: 'video' }, BRUNA)).rejects.toThrow('contrato novo')
    expect((await obterFicha('maria-exemplo'))!.telefone).toBe(maria.telefone)

    const resposta = await salvarFichaVerificada('maria-exemplo', novo, { como: 'video', contratoNovo: true }, BRUNA)
    if (!('ficha' in resposta)) throw new Error(resposta.erro)
    expect(resposta.ficha.telefone).toBe('11900000044')
    expect(resposta.ficha.historico.at(-1)).toMatchObject({
      quem: 'Ana (exemplo)',
      oQue: `Mudou o telefone (chamada de vídeo com o cliente; em contrato novo): «${formatarTelefone(maria.telefone!)}» → «(11) 90000-0044»`,
    })
    // O endereço não é dado protegido: muda sem a verificação.
    const endereco = await salvarFichaVerificada('maria-exemplo', { ...edicaoDe(resposta.ficha), endereco: 'Rua Exemplo das Acácias, 45' }, null, BRUNA)
    expect('ficha' in endereco && endereco.ficha.endereco).toBe('Rua Exemplo das Acácias, 45')
  })

  it('CA1 · completar o telefone ou o e-mail em branco não é mudança; trocar, apagar ou só formatar diferente, conforme o caso', () => {
    expect(camposProtegidosQueMudam({ telefone: '', email: '' }, { telefone: '11900000044', email: 'maria@exemplo.com' })).toEqual([])
    expect(camposProtegidosQueMudam({ telefone: '11900000004', email: 'maria@exemplo.com' }, { telefone: '(11) 90000-0004', email: ' Maria@Exemplo.com ' })).toEqual([])
    expect(camposProtegidosQueMudam({ telefone: '11900000004', email: 'maria@exemplo.com' }, { telefone: '', email: 'outra@exemplo.com' })).toEqual(['telefone', 'email'])
  })

  it('CA5 · a mudança bancária pede a verificação e a segunda confirmação de outra pessoa; o histórico guarda o antigo e o novo', async () => {
    expect((await obterDadosBancarios('lucia-exemplo')).atual).toMatchObject({ banco: 'Banco Exemplo', agencia: '0001', conta: '12345-6' })
    await expect(pedirMudancaBancaria('lucia-exemplo', { dados: CONTA_NOVA, verificacao: null }, BRUNA)).rejects.toThrow('só mudam com o cliente verificado')
    await expect(pedirMudancaBancaria('lucia-exemplo', { dados: CONTA_NOVA, verificacao: { como: 'presencial', contratoNovo: true } }, JESSICA)).rejects.toThrow(
      'A mudança dos dados bancários é do Atendimento e do Jurídico.',
    )
    const pedido = await pedirMudancaBancaria('lucia-exemplo', { dados: CONTA_NOVA, verificacao: { como: 'presencial', contratoNovo: true } }, BRUNA)
    expect(pedido).toMatchObject({ pediu: 'Ana (exemplo)', dados: CONTA_NOVA })
    // Até a segunda confirmação, nada muda.
    expect((await obterDadosBancarios('lucia-exemplo')).atual?.banco).toBe('Banco Exemplo')
    await expect(confirmarMudancaBancaria('lucia-exemplo', BRUNA)).rejects.toThrow('de outra pessoa, não de quem pediu')

    await confirmarMudancaBancaria('lucia-exemplo', CARLA)
    expect(await obterDadosBancarios('lucia-exemplo')).toMatchObject({ atual: { ...CONTA_NOVA, quem: 'Ana (exemplo)' }, pedido: null })
    const lucia = (await obterFicha('lucia-exemplo'))!
    expect(lucia.historico.map((e) => e.oQue)).toContain(
      'Mudou os dados bancários (cliente no escritório; em contrato novo; pedido de Ana (exemplo), segunda confirmação de Carla (exemplo)): ' +
        '«Banco Exemplo · agência 0001 · conta 12345-6 · Pix: o telefone cadastrado» → «Banco Exemplo Dois · agência 0002 · conta 65432-1»',
    )
  })

  it('CA5 · o contato anterior recebe o aviso pelo Chatwoot, com a frase da senha no fim', async () => {
    await pedirMudancaBancaria('lucia-exemplo', { dados: CONTA_NOVA, verificacao: { como: 'video', contratoNovo: true } }, BRUNA)
    await confirmarMudancaBancaria('lucia-exemplo', CARLA)
    const [aviso] = await mensagensDoCliente('lucia-exemplo')
    expect(aviso).toMatchObject({ modelo: 'aviso-de-mudanca', canal: 'Chatwoot', quem: 'Carla (exemplo)' })
    expect(aviso.texto).toBe(
      `Olá, Lúcia. Os dados para você receber os valores do seu caso mudaram hoje, a seu pedido. Se não foi você, ligue para o escritório agora. ${NUNCA_PEDIMOS_A_SENHA}`,
    )
  })

  it('CA2 · perto da prestação de contas, a advogada e o Financeiro recebem o alerta; longe dela, não', async () => {
    await pedirMudancaBancaria('lucia-exemplo', { dados: CONTA_NOVA, verificacao: { como: 'video', contratoNovo: true } }, BRUNA)
    await confirmarMudancaBancaria('lucia-exemplo', CARLA)
    for (const setor of ['Jurídico', 'Financeiro'] as const) {
      expect(tarefasDoSetor(setor)).toEqual([
        expect.objectContaining({ acao: 'Dados bancários mudaram', cliente: { id: 'lucia-exemplo', nome: 'Lúcia Exemplo' }, urgente: true, processoId: 'lucia-exemplo-1' }),
      ])
    }

    // A Maria está na perícia: muda a conta, mas não há prestação de contas perto.
    await pedirMudancaBancaria('maria-exemplo', { dados: CONTA_NOVA, verificacao: { como: 'video', contratoNovo: true } }, BRUNA)
    await confirmarMudancaBancaria('maria-exemplo', CARLA)
    expect(tarefasDoSetor('Jurídico').map((t) => t.cliente?.id)).toEqual(['lucia-exemplo'])
  })
})
