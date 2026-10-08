import { beforeEach, describe, expect, it } from 'vitest'
import { conferirSenhaLida, guardarSenhaNoCofre, naoSabeASenha } from './cofre.ts'
import { registrarConfirmacao } from './confirmacao.ts'
import { CPF_DE_TESTE } from './exemplo.ts'
import { conferirTelefone, lerFichaEmPapel, salvarFichaDeAtendimento } from './fichaAtendimento.ts'
import { CHAVE, configurarExemplo, gravar, ler, obterFicha, tarefasDoSetor, zerarExemplo } from './servidor.ts'
import type { EnvioDaFicha } from './tipos.ts'

/** Senha de teste: não pode aparecer em lugar nenhum depois de guardada (CA9). */
const SENHA_DE_TESTE = 'Teste#Senha-9137'

let agora = new Date(2026, 9, 5, 14, 32)

beforeEach(() => {
  agora = new Date(2026, 9, 5, 14, 32)
  configurarExemplo({ agora: () => agora, latencia: 0 })
  zerarExemplo()
})

const envio = (resto: Partial<EnvioDaFicha> = {}): EnvioDaFicha => ({
  nome: 'Antônio Exemplo',
  cpf: CPF_DE_TESTE,
  nascimento: '10/03/1964',
  telefone: '11900000001',
  beneficioInteresse: 'nao-sei',
  origem: 'papel',
  modelo: 'GGV',
  ...resto,
})

/** A semente só tem um CPF, o de teste, que é do Antônio: para salvar a Josefa, o teste o passa para ela. */
function cpfDeTesteParaJosefa() {
  const banco = ler()
  banco.fichas.find((f) => f.id === 'antonio-exemplo')!.cpf = undefined
  gravar(banco)
}

describe('Ficha de atendimento · servidor de exemplo', () => {
  it('CA14 e CA15 · a ficha em papel vai para a pasta, a IA preenche o que leu e a senha escrita vai ao cofre para conferir', async () => {
    const leitura = await lerFichaEmPapel('josefa-exemplo')
    expect(leitura.arquivo).toMatchObject({ nome: 'Ficha de atendimento GGV - Josefa Exemplo - 2026-10-05.pdf', tipo: 'ficha-atendimento', local: 'pessoais' })
    expect(leitura.campos).toMatchObject({ nome: 'Josefa Exemplo', telefone: '11900000002', beneficioInteresse: 'loas-idoso', pessoasNaCasa: 3 })
    expect(leitura.naoLidos).toEqual(['cpf', 'nascimento', 'endereco'])
    expect(leitura.senhaLida).toBe(true)
    const josefa = await obterFicha('josefa-exemplo')
    expect(josefa?.senhaGov).toMatchObject({ situacao: 'no-cofre', conferir: true })
    expect(josefa?.arquivos.at(-1)?.nome).toBe(leitura.arquivo.nome)
    expect(ler().cofre).toEqual([{ fichaId: 'josefa-exemplo', quando: agora.toISOString(), quem: 'Leitura da ficha em papel (IA)', acao: 'leu-do-papel' }])

    await conferirSenhaLida('josefa-exemplo')
    expect((await obterFicha('josefa-exemplo'))?.senhaGov).toEqual({ situacao: 'no-cofre', atualizadaEm: agora.toISOString(), por: 'Você (Atendimento)' })
    await expect(conferirSenhaLida('josefa-exemplo')).rejects.toThrow('Não há senha lida')
  })

  it('CA2, CA8 e CA9 · a senha vai ao cofre e não fica na ficha, no histórico, na trilha nem no armazenamento', async () => {
    const { senhaGov } = await guardarSenhaNoCofre('josefa-exemplo', SENHA_DE_TESTE)
    expect(senhaGov).toEqual({ situacao: 'no-cofre', atualizadaEm: agora.toISOString(), por: 'Você (Atendimento)' })
    expect(JSON.stringify(ler())).not.toContain(SENHA_DE_TESTE)
    expect(sessionStorage.getItem(CHAVE)).not.toContain(SENHA_DE_TESTE)
    expect(ler().cofre.map((r) => r.acao)).toEqual(['guardou'])
    expect((await obterFicha('josefa-exemplo'))?.historico.at(-1)?.oQue).toBe('Guardou a senha do gov.br no cofre')
    await expect(guardarSenhaNoCofre('josefa-exemplo', '')).rejects.toThrow('Senha vazia')
  })

  it('CA3 · "não sei a senha" deixa o alerta e a ficha é aceita mesmo assim', async () => {
    await naoSabeASenha('antonio-exemplo')
    const r = await salvarFichaDeAtendimento('antonio-exemplo', envio())
    expect('ficha' in r && r.ficha.senhaGov).toEqual({ situacao: 'sem-senha', naoSabe: true })
  })

  it('CA5, CA6, CA10 e CA12 · salva com os obrigatórios, guarda o que ficou em branco, a data de hoje e cada alteração', async () => {
    const r = await salvarFichaDeAtendimento('antonio-exemplo', envio({ pessoasNaCasa: 2, ultimaAtividade: 'porteiro, até 2025' }))
    if (!('ficha' in r)) throw new Error('não salvou')
    expect(r.ficha).toMatchObject({ nascimento: '1964-03-10', fichaAtendimentoPreenchida: true })
    expect(r.ficha.fichaAtendimento).toEqual({
      data: '2026-10-05',
      origem: 'papel',
      modelo: 'GGV',
      pessoasNaCasa: 2,
      ultimaAtividade: 'porteiro, até 2025',
      semTrabalharDesde: undefined,
      pedidosAoInss: undefined,
      emBranco: ['Endereço', 'Desde quando está sem trabalhar', 'O que já pediu ao INSS'],
    })
    expect(r.ficha.historico.at(-1)?.oQue).toBe(
      'Salvou a ficha de atendimento (papel GGV, conferida); em branco: Endereço, Desde quando está sem trabalhar e O que já pediu ao INSS',
    )

    agora = new Date(2026, 9, 6, 9, 0)
    const depois = await salvarFichaDeAtendimento('antonio-exemplo', envio({ telefone: '11900000011', endereco: 'Rua Exemplo, 1', pessoasNaCasa: 2, ultimaAtividade: 'porteiro, até 2025' }))
    if (!('ficha' in depois)) throw new Error('não salvou')
    expect(depois.ficha.historico.at(-1)).toEqual({ quando: agora.toISOString(), quem: 'Você (Atendimento)', oQue: 'Alterou na ficha de atendimento: Telefone / WhatsApp e Endereço' })
    expect(depois.ficha.fichaAtendimento?.data).toBe('2026-10-05')
  })

  it('no tablet, quem salva é o próprio cliente', async () => {
    const r = await salvarFichaDeAtendimento('antonio-exemplo', envio({ origem: 'tablet', modelo: undefined }))
    expect('ficha' in r && r.ficha.historico.at(-1)).toMatchObject({ quem: 'Cliente (tablet)', oQue: expect.stringContaining('(tablet)') })
  })

  it('CPF de outra ficha não grava; data futura, CPF errado ou benefício fora do catálogo não passam', async () => {
    expect(await salvarFichaDeAtendimento('josefa-exemplo', envio({ nome: 'Josefa Exemplo' }))).toEqual({ erro: 'cpf-de-outra-ficha', nome: 'Antônio Exemplo' })
    await expect(salvarFichaDeAtendimento('antonio-exemplo', envio({ nascimento: '06/10/2026' }))).rejects.toThrow('inválida')
    await expect(salvarFichaDeAtendimento('antonio-exemplo', envio({ cpf: '00000000192' }))).rejects.toThrow('inválida')
    await expect(salvarFichaDeAtendimento('antonio-exemplo', envio({ beneficioInteresse: 'inventado' }))).rejects.toThrow('inválida')
  })

  it('GGVP-21 · salvar conclui "Preencher ficha" e, com a entrevista confirmada, o Jurídico prepara a conversa', async () => {
    await registrarConfirmacao('josefa-entrevista', { resultado: 'confirmou', canal: 'ligacao', jaPreencheuFicha: false })
    expect(tarefasDoSetor('Atendimento').map((t) => t.acao)).toEqual(['Preencher ficha'])
    cpfDeTesteParaJosefa()
    await salvarFichaDeAtendimento('josefa-exemplo', envio({ nome: 'Josefa Exemplo', telefone: '11900000002', beneficioInteresse: 'loas-idoso' }))
    expect(tarefasDoSetor('Atendimento')).toEqual([])
    expect(tarefasDoSetor('Jurídico').map((t) => [t.acao, t.href])).toEqual([['Preparar entrevista', '/entrevista/josefa-entrevista/preparar']])
  })

  it('CA12 · a ferramenta de validação confere o telefone com DDD (simulada)', async () => {
    expect(await conferirTelefone('11900000002')).toEqual({ valido: true, tipo: 'celular' })
    expect(await conferirTelefone('1133334444')).toEqual({ valido: true, tipo: 'fixo' })
    expect(await conferirTelefone('900000002')).toEqual({ valido: false })
  })
})
