import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { armazenamentoLocal } from '../armazenamento.ts'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, chamadaIa, credencialGovbr, documento, eventoAuditoria, fichaRecepcao, pessoa, usuario } from '../banco/esquema.ts'
import { chaveDoCofre, criarCofre } from '../cofre.ts'
import type { Drive } from '../drive.ts'
import { criarIa } from '../ia/ia.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { MSG_DRIVE_FORA, MSG_DRIVE_SO_LEITURA, MSG_FICHA_DIGITALIZADA, MSG_PASTA_SEM_CPF, MSG_SEM_DRIVE, criarFichario } from './recepcao.ts'

const SENHA = 'senha-do-portal-1'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
let relogio = new Date('2026-10-08T15:00:00Z')

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const chamar = async (apelido: string, method: 'GET' | 'POST' | 'PATCH' | 'PUT', url: string, payload?: object) =>
  app.inject({ method, url, cookies: await cookieDe(apelido), ...(payload ? { payload } : {}) })

const LEAD = {
  nome: 'Joana Ribeiro',
  idade: 66,
  pretende: 'Quer saber do BPC do idoso.',
  telefone: '11987654321',
  cpf: '52998224725',
  cidadeUf: 'Osasco / SP',
  beneficioInteresse: 'loas-idoso',
  comoChegou: 'instagram',
  outraPessoa: false,
}
const cadastrar = async (dados: object = LEAD, apelido = 'ana') => (await chamar(apelido, 'POST', '/api/fichas', dados)).json()
const pessoas = () => banco.select().from(pessoa)

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  relogio = new Date('2026-10-08T15:00:00Z')
  // A ficha em papel daqui é a de exemplo, sem arquivo (GGVP-158 P4.10); a leitura de verdade tem o bloco dela no fim.
  app = criarServidor({ banco, agora: () => relogio, leituraSimulada: true })
  for (const [apelido, perfil] of [['ana', 'atendimento'], ['dora', 'documentacao'], ['gabi', 'advogada'], ['julia', 'financeiro']] as const)
    await banco.insert(usuario).values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
})
afterEach(async () => {
  await app.close()
  await fechar()
})

describe('GGVP-125 · bloco 1: o lead e a ficha no servidor', () => {
  it('o lead nasce no balcão e a advogada, em outra sessão, acha pelo nome, CPF ou telefone e abre a ficha', async () => {
    const criada = await cadastrar()
    expect(criada).toMatchObject({ resultado: 'criada', pastas: [] })
    for (const termo of ['joana ribeiro', '529.982.247-25', '98765-4321'])
      expect((await chamar('gabi', 'POST', '/api/balcao/busca', { termo })).json().map((r: { id: string }) => r.id)).toEqual([criada.id])

    const ficha = (await chamar('gabi', 'GET', `/api/fichas/${criada.id}`)).json()
    expect(ficha).toMatchObject({
      nome: 'Joana Ribeiro',
      situacao: 'lead',
      cpf: '52998224725',
      contatos: [{ data: '2026-10-08', canal: 'Presencial (balcão)', texto: LEAD.pretende }],
      historico: [{ quem: 'ana', oQue: 'Criou a ficha no balcão (lead)' }],
      senhaGov: { situacao: 'sem-senha' },
      processos: [],
    })
    const [p] = await pessoas()
    expect(p).toMatchObject({ situacao: 'lead', telefone: '11987654321', cpf: '52998224725', cidade: 'Osasco', uf: 'SP', origem: 'instagram' })
    // Dado pessoal fica fora do registro de auditoria.
    const [e] = await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'ficha_criada'))
    expect(JSON.stringify(e.detalhe)).not.toMatch(/Joana|52998|98765/)
  })

  it('GGVP-16 CA6 · CPF repetido nunca grava e leva à ficha que já existe', async () => {
    const primeira = await cadastrar()
    expect(await cadastrar({ ...LEAD, nome: 'Joana Ribeiro Silva', telefone: '11911112222' }, 'dora')).toEqual({ resultado: 'ja-existe', id: primeira.id })
    expect(await pessoas()).toHaveLength(1)
  })

  it('GGVP-16 CA9 · nome ou telefone igual só grava com "É outra pessoa", e isso fica no histórico', async () => {
    await cadastrar()
    const irma = { ...LEAD, nome: 'Marta Ribeiro', cpf: undefined }
    const duplicidade = (await chamar('ana', 'POST', '/api/fichas/duplicidade', { nome: 'joana ribeiro', telefone: '11900000000', cpf: '529.982.247-25' })).json()
    expect(duplicidade).toMatchObject({ comCpf: { nome: 'Joana Ribeiro' }, parecidas: [{ nome: 'Joana Ribeiro' }] })

    expect(await cadastrar(irma)).toMatchObject({ resultado: 'parecidas', fichas: [{ nome: 'Joana Ribeiro', etapa: 'Lead · contato prévio' }] })
    expect(await pessoas()).toHaveLength(1)
    const criada = await cadastrar({ ...irma, outraPessoa: true })
    expect(criada.resultado).toBe('criada')
    const ficha = (await chamar('ana', 'GET', `/api/fichas/${criada.id}`)).json()
    expect(ficha.historico[0].oQue).toBe('Criou a ficha no balcão (lead), confirmando que é outra pessoa que Joana Ribeiro')
  })

  it('quem nasceu por outro caminho aparece na busca com os casos; editar não apaga o que a ficha não mostra', async () => {
    const [p] = await banco
      .insert(pessoa)
      .values({ nome: 'Maria Souza', situacao: 'cliente', telefone: '11955554444', origem: 'indicacao', logradouro: 'Rua das Flores, 10' })
      .returning()
    await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_idoso', fase: 'administrativa' })
    const [achada] = (await chamar('ana', 'POST', '/api/balcao/busca', { termo: 'souza' })).json()
    expect(achada).toMatchObject({ id: p.id, situacao: 'cliente', etapa: 'Administrativa · INSS', casos: [{ etapa: 'Administrativa · INSS' }] })

    const ficha = (await chamar('ana', 'GET', `/api/fichas/${p.id}`)).json()
    expect(ficha).toMatchObject({ endereco: 'Rua das Flores, 10', comoChegou: 'indicacao', processos: [{ beneficio: 'loas-idoso' }] })
    const salvo = await chamar('ana', 'PATCH', `/api/fichas/${p.id}`, { nome: 'Maria Souza', telefone: '11955554444', endereco: ficha.endereco, comoChegou: 'indicacao', email: 'maria@exemplo.com' })
    expect(salvo.json().ficha.historico.at(-1)).toMatchObject({ quem: 'ana', oQue: 'Alterou e-mail' })
    const [depois] = await banco.select().from(pessoa).where(eq(pessoa.id, p.id))
    expect(depois).toMatchObject({ situacao: 'cliente', origem: 'indicacao', logradouro: 'Rua das Flores, 10', email: 'maria@exemplo.com' })
  })

  it('editar: CPF de outra ficha não grava; data inválida é recusada no servidor', async () => {
    await cadastrar()
    const outra = await cadastrar({ ...LEAD, nome: 'Maria Souza', telefone: '11955554444', cpf: '11144477735' })
    // A tela manda o formulário inteiro: o que não vem é o que ficou em branco.
    const editar = (dados: object) =>
      chamar('ana', 'PATCH', `/api/fichas/${outra.id}`, { nome: 'Maria Souza', telefone: '11955554444', cidadeUf: 'Osasco / SP', comoChegou: 'instagram', ...dados })
    expect((await editar({ cpf: '52998224725' })).json()).toEqual({ erro: 'cpf-de-outra-ficha', nome: 'Joana Ribeiro' })
    expect((await editar({ nascimento: '31/02/1950' })).statusCode).toBe(400)
    expect((await editar({ email: 'sem-arroba' })).statusCode).toBe(400)
    const ok = (await editar({ cpf: '11144477735', nascimento: '1950-02-28', cep: '06010-000' })).json()
    expect(ok.ficha).toMatchObject({ nascimento: '1950-02-28', cep: '06010000' })
    expect(ok.ficha.historico.at(-1).oQue).toBe('Alterou data de nascimento e CEP')
    expect((await chamar('ana', 'GET', '/api/fichas/nao-existe')).statusCode).toBe(404)
  })

  it('GGVP-24 · a ficha de atendimento grava a triagem e os dados pessoais, nunca a senha; depois, só o que mudou', async () => {
    const { id } = await cadastrar()
    const ENVIO = { nome: 'Joana Ribeiro', cpf: '52998224725', nascimento: '10/05/1958', telefone: '11987654321', endereco: 'Rua B, 20', beneficioInteresse: 'loas-idoso', origem: 'papel', modelo: 'GGV' }
    const r = await chamar('ana', 'PUT', `/api/fichas/${id}/ficha-de-atendimento`, { ...ENVIO, senha: 'gov-segredo-123' })
    expect(r.statusCode).toBe(200)
    const ficha = r.json().ficha
    expect(ficha).toMatchObject({ fichaAtendimentoPreenchida: true, nascimento: '1958-05-10', endereco: 'Rua B, 20', fichaAtendimento: { data: '2026-10-08', origem: 'papel', modelo: 'GGV' } })
    expect(ficha.historico.at(-1)).toMatchObject({
      quem: 'ana',
      oQue: 'Salvou a ficha de atendimento (papel GGV, conferida); em branco: Quantas pessoas moram na casa, Última atividade, Desde quando está sem trabalhar e O que já pediu ao INSS',
    })
    // G9: a senha do gov.br só no cofre.
    expect(JSON.stringify(await banco.select().from(fichaRecepcao))).not.toContain('gov-segredo-123')
    expect(JSON.stringify(await banco.select().from(eventoAuditoria))).not.toContain('gov-segredo-123')
    expect((await pessoas())[0].dataNascimento).toBe('1958-05-10')

    // CA10, CA12: no dia seguinte, pelo tablet, só o que mudou entra no histórico, e a data da ficha não muda.
    relogio = new Date('2026-10-09T15:00:00Z')
    const depois = (await chamar('ana', 'PUT', `/api/fichas/${id}/ficha-de-atendimento`, { ...ENVIO, pessoasNaCasa: 3, origem: 'tablet', modelo: undefined })).json().ficha
    expect(depois.fichaAtendimento.data).toBe('2026-10-08')
    expect(depois.historico.at(-1)).toMatchObject({ quem: 'Cliente (tablet)', oQue: 'Alterou na ficha de atendimento: Quantas pessoas moram na casa' })
    expect((await chamar('ana', 'PUT', `/api/fichas/${id}/ficha-de-atendimento`, { ...ENVIO, nascimento: '10/05/2099' })).statusCode).toBe(400)
  })

  it('bloco 5a · a ficha de atendimento em papel: a imagem fica em Documentos pessoais, sem sobrescrever; nada vai ao cofre (G9)', async () => {
    const { id } = await cadastrar()
    expect((await chamar('julia', 'POST', `/api/fichas/${id}/ficha-de-atendimento/leitura`)).statusCode).toBe(403)
    const leitura = (await chamar('ana', 'POST', `/api/fichas/${id}/ficha-de-atendimento/leitura`)).json()
    expect(leitura).toMatchObject({
      modelo: 'GGV',
      senhaLida: false,
      arquivo: { nome: 'Ficha de atendimento GGV - Joana Ribeiro - 2026-10-08.pdf', tipo: 'ficha-atendimento', local: 'pessoais', origem: 'scanner' },
      campos: { nome: 'Joana Ribeiro', cpf: '52998224725' },
    })
    expect(leitura.ficha.arquivos).toEqual([leitura.arquivo])
    expect(leitura.ficha.historico.at(-1).oQue).toBe('A ficha de atendimento em papel (GGV) passou no scanner e a IA leu os campos; a imagem ficou em Documentos pessoais')
    const deNovo = (await chamar('ana', 'POST', `/api/fichas/${id}/ficha-de-atendimento/leitura`)).json()
    expect(deNovo.arquivo.nome).toBe('Ficha de atendimento GGV - Joana Ribeiro - 2026-10-08 (2).pdf')
    expect(await banco.select().from(credencialGovbr)).toEqual([])
    expect(deNovo.ficha.senhaGov.situacao).not.toBe('no-cofre')
  })

  it('perfil da sessão: o Financeiro não cadastra, e a tentativa fica registrada', async () => {
    const r = await chamar('julia', 'POST', '/api/fichas', LEAD)
    expect(r.statusCode).toBe(403)
    expect(await pessoas()).toHaveLength(0)
    expect(await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'acesso_negado'))).toHaveLength(1)
  })
})

describe('GGVP-158 P3.8 · "Completar a ficha" grava o bairro', () => {
  it('o bairro que o kit pede entra pela edição da ficha e vai ao histórico', async () => {
    const lead = await cadastrar()
    const r = await chamar('ana', 'PATCH', `/api/fichas/${lead.id}`, { nome: LEAD.nome, telefone: LEAD.telefone, cpf: LEAD.cpf, cidadeUf: LEAD.cidadeUf, comoChegou: LEAD.comoChegou, bairro: 'Vila Exemplo' })
    expect(r.json().ficha).toMatchObject({ bairro: 'Vila Exemplo' })
    expect(r.json().ficha.historico.at(-1)).toMatchObject({ quem: 'ana', oQue: 'Alterou bairro' })
    expect((await chamar('ana', 'GET', `/api/fichas/${lead.id}`)).json().bairro).toBe('Vila Exemplo')
  })
})

describe('GGVP-158 P4.2 · a ficha em papel lida pela IA, e a senha escrita só no cofre', () => {
  const SENHA_DO_PAPEL = 'Segredo#Do#Papel-2026'
  const LIDA = {
    nome: 'Joana Ribeiro',
    cpf: '529.982.247-25',
    nascimento: '10/03/1958',
    telefone: '(11) 98765-4321',
    endereco: 'Rua das Flores, 10, Osasco/SP',
    pessoasNaCasa: 3,
    ultimaAtividade: 'doméstica, sem carteira',
    semTrabalharDesde: '06/2026',
    pedidosAoInss: 'nenhum',
    senha: SENHA_DO_PAPEL,
  }
  const FICHA_PDF = Buffer.from('%PDF-1.4 a ficha de atendimento preenchida à mão')
  const cofre = criarCofre(chaveDoCofre())
  const comIa = (ambiente: Record<string, string>) => {
    const fetch = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(LIDA) } }] })))
    return { fetch, ia: criarIa({ banco, ambiente, fetch, agora: () => relogio }) }
  }
  const lerFicha = async (apelido: string, id: string, arquivo?: Buffer) => {
    const f = '----ggv'
    const corpo = arquivo && Buffer.concat([
      Buffer.from(`--${f}\r\nContent-Disposition: form-data; name="arquivo"; filename="ficha.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
      arquivo,
      Buffer.from(`\r\n--${f}--\r\n`),
    ])
    return app.inject({
      method: 'POST',
      url: `/api/fichas/${id}/ficha-de-atendimento/leitura`,
      cookies: await cookieDe(apelido),
      ...(corpo && { payload: corpo, headers: { 'content-type': `multipart/form-data; boundary=${f}` } }),
    })
  }
  const reabrir = async (ia: ReturnType<typeof criarIa>) => {
    await app.close()
    app = criarServidor({ banco, agora: () => relogio, ia, cofre, armazenamento: armazenamentoLocal(mkdtempSync(join(tmpdir(), 'arq-'))) })
  }

  it('a IA lê os campos, a senha vai ao cofre e não aparece na resposta, na ficha, no histórico nem no registro da IA', async () => {
    const { ia, fetch } = comIa({ OPENAI_API_KEY: 'chave-de-teste-openai' })
    await reabrir(ia)
    const { id } = await cadastrar()
    const r = await lerFicha('ana', id, FICHA_PDF)
    expect(r.statusCode).toBe(200)
    const lida = r.json()
    expect(lida).toMatchObject({ campos: { nome: 'Joana Ribeiro', cpf: '52998224725', nascimento: '10/03/1958', pessoasNaCasa: 3 }, naoLidos: [], senhaLida: true })
    expect(lida.arquivo.nome).toBe('Ficha de atendimento GGV - Joana Ribeiro - 2026-10-08.pdf')
    expect(String(fetch.mock.calls[0][1]?.body)).toContain(FICHA_PDF.toString('base64'))
    const [credencial] = await banco.select().from(credencialGovbr).where(eq(credencialGovbr.pessoaId, id))
    expect(cofre.decifrar(credencial)).toBe(SENHA_DO_PAPEL)
    const [ficha] = await banco.select().from(fichaRecepcao).where(eq(fichaRecepcao.pessoaId, id))
    expect((ficha.documento as { historico: { oQue: string }[] }).historico.at(-1)?.oQue).toBe('A IA leu a senha do gov.br escrita no papel, e ela foi para o cofre: confira com o papel')
    for (const onde of [lida, ficha, await banco.select().from(chamadaIa), await banco.select().from(eventoAuditoria)]) expect(JSON.stringify(onde)).not.toContain(SENHA_DO_PAPEL)
    // A imagem fica guardada em Documentos pessoais, com o hash.
    const [d] = await banco.select().from(documento).where(eq(documento.pessoaId, id))
    expect([d.tipo, d.sensivel, d.origem]).toEqual(['ficha-atendimento', false, 'scanner'])
  })

  it('quem não cadastra no cofre (a Documentação) lê a ficha, mas a senha não vai ao cofre nem a lugar nenhum', async () => {
    await reabrir(comIa({ OPENAI_API_KEY: 'chave-de-teste-openai' }).ia)
    const { id } = await cadastrar()
    const lida = (await lerFicha('dora', id, FICHA_PDF)).json()
    expect(lida.senhaLida).toBe(false)
    expect(await banco.select().from(credencialGovbr)).toEqual([])
    expect(lida.ficha.historico.at(-1).oQue).toBe('A ficha em papel tem a senha do gov.br escrita: quem cadastra no cofre é o Atendimento')
    expect(JSON.stringify(await banco.select().from(chamadaIa))).not.toContain(SENHA_DO_PAPEL)
  })

  it('sem o arquivo, recusa; sem IA, a imagem fica guardada e todos os campos voltam como não lidos', async () => {
    const { ia, fetch } = comIa({})
    await reabrir(ia)
    const { id } = await cadastrar()
    expect((await lerFicha('ana', id)).json()).toEqual({ erro: MSG_FICHA_DIGITALIZADA })
    const lida = (await lerFicha('ana', id, FICHA_PDF)).json()
    expect([lida.campos, lida.senhaLida, fetch.mock.calls.length]).toEqual([{ beneficioInteresse: 'loas-idoso' }, false, 0])
    expect(lida.naoLidos).toEqual(['nome', 'cpf', 'nascimento', 'telefone', 'endereco', 'pessoasNaCasa', 'ultimaAtividade', 'semTrabalharDesde', 'pedidosAoInss'])
    expect(await banco.select().from(documento)).toHaveLength(1)
  })
})

describe('GGVP-158 P4.7 · a pasta do cliente no Drive', () => {
  /** O Drive de mentira: as pastas, com quem é a pasta-mãe de cada uma, e o que o portal criou. */
  function driveFalso(soLeitura = false) {
    const pastas = [
      { id: 'pasta-joana', nome: '529.982.247-25 X Joana Ribeiro', pai: 'clientes' },
      { id: 'pasta-outra', nome: 'Outra Pessoa X LOAS', pai: 'clientes' },
      { id: 'fora', nome: 'Joana Ribeiro', pai: 'arquivo-morto' },
    ]
    const criadas: { nome: string; pai: string; marca: string }[] = []
    const drive = {
      pastas: async (pai: string) => pastas.filter((p) => p.pai === pai).map(({ id, nome }) => ({ id, nome })),
      onde: async (id: string) => {
        const p = pastas.find((x) => x.id === id)
        if (!p) throw new Error('Drive: 404 File not found')
        return { nome: p.nome, pais: [p.pai] }
      },
      achar: async () => null,
      criarPasta: async (nome: string, pai: string, marca: string) => {
        criadas.push({ nome, pai, marca })
        pastas.push({ id: `nova-${criadas.length}`, nome, pai })
        return `nova-${criadas.length}`
      },
    } as unknown as Drive
    return { criadas, drive: { drive, pastas: { clientes: 'clientes', revisar: 'revisar' }, soLeitura } }
  }
  const reabrir = async (drive: ReturnType<typeof driveFalso>['drive']) => {
    await app.close()
    app = criarServidor({ banco, agora: () => relogio, leituraSimulada: true, drive })
  }
  const pasta = async (fichaId: string, valor: string) => (await chamar('ana', 'POST', `/api/fichas/${fichaId}/pasta`, { pasta: valor })).json()

  it('a ficha nova traz a pasta parecida (pelo CPF do título); ligar grava na ficha e no histórico; pasta de fora recusa', async () => {
    await reabrir(driveFalso().drive)
    const criada = await cadastrar()
    expect(criada.pastas).toEqual([{ id: 'pasta-joana', nome: 'Joana Ribeiro', caminho: '529.982.247-25 X Joana Ribeiro', cpf: '52998224725' }])
    expect(await pasta(criada.id, 'pasta-joana')).toMatchObject({ id: 'pasta-joana', nova: false })
    expect((await banco.select().from(pessoa).where(eq(pessoa.id, criada.id)))[0].drivePastaId).toBe('pasta-joana')
    const ficha = (await chamar('ana', 'GET', `/api/fichas/${criada.id}`)).json()
    expect([ficha.pastaId, ficha.historico.at(-1).oQue]).toEqual(['pasta-joana', 'Ligou à pasta que já existia no Drive: 529.982.247-25 X Joana Ribeiro'])
    expect(await pasta(criada.id, 'fora')).toEqual({ erro: 'Pasta não encontrada em "#5. CLIENTES".' })
  })

  it('a pasta nova só nasce com o CPF, como "<Nome> X A CLASSIFICAR", com a marca do portal; com o Drive só leitura, não cria', async () => {
    const { drive, criadas } = driveFalso()
    await reabrir(drive)
    const semCpf = await cadastrar({ ...LEAD, nome: 'Rosa Exemplo', cpf: undefined, telefone: '11955554444', outraPessoa: true })
    expect(await pasta(semCpf.id, 'nova')).toEqual({ erro: MSG_PASTA_SEM_CPF })
    const comCpf = await cadastrar({ ...LEAD, nome: 'Marta Exemplo', cpf: '11144477735', telefone: '11955553333', outraPessoa: true })
    expect(await pasta(comCpf.id, 'nova')).toMatchObject({ id: 'nova-1', nova: true, caminho: 'Marta Exemplo X A CLASSIFICAR' })
    expect(criadas).toEqual([{ nome: 'Marta Exemplo X A CLASSIFICAR', pai: 'clientes', marca: `pessoa:${comCpf.id}` }])

    const soLeitura = driveFalso(true)
    await reabrir(soLeitura.drive)
    const outra = await cadastrar({ ...LEAD, nome: 'Lia Exemplo', cpf: '61374825964', telefone: '11955552222', outraPessoa: true })
    expect(await pasta(outra.id, 'nova')).toEqual({ erro: MSG_DRIVE_SO_LEITURA })
    expect(soLeitura.criadas).toEqual([])
  })

  it('GGVP-158 I8 · com o Drive fora, a lista não vira "nenhuma pasta": a pasta nova não nasce, e o motivo diz que o Drive não respondeu', async () => {
    const { drive, criadas } = driveFalso()
    drive.drive.pastas = async () => {
      throw new Error('Drive: 503 Backend Error')
    }
    await reabrir(drive)
    const criada = await cadastrar({ ...LEAD, nome: 'Marta Exemplo', cpf: '11144477735', telefone: '11955553333', outraPessoa: true })
    const r = await chamar('ana', 'POST', `/api/fichas/${criada.id}/pasta`, { pasta: 'nova' })
    expect([r.statusCode, r.json().erro]).toEqual([503, MSG_DRIVE_FORA])
    expect(criadas).toEqual([])
  })

  it('sem o Drive, a ficha nova não traz pasta, e ligar recusa', async () => {
    const criada = await cadastrar()
    expect(criada.pastas).toEqual([])
    expect(await pasta(criada.id, 'nova')).toEqual({ erro: MSG_SEM_DRIVE })
  })
})

describe('GGVP-158 P8.4 · o histórico da ficha também no histórico de auditoria', () => {
  const daFicha = async () =>
    (await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'historico_da_ficha'))).map((e) => ({
      quem: e.quem,
      alvo: e.alvo,
      quando: e.quando.toISOString(),
      ...(e.detalhe as { texto: string; por?: string }),
    }))

  it('cada linha entra uma vez, com quem fez e a hora dela; guardar de novo não repete', async () => {
    const { id } = await cadastrar()
    const [ana] = await banco.select({ id: usuario.id }).from(usuario).where(eq(usuario.email, 'ana@exemplo.ggv'))
    expect(await daFicha()).toEqual([{ quem: ana.id, alvo: `ficha:${id}`, quando: '2026-10-08T15:00:00.000Z', texto: 'Criou a ficha no balcão (lead)' }])
    relogio = new Date('2026-10-08T16:00:00Z')
    const editar = { nome: 'Joana Ribeiro', telefone: '11987654321', cpf: '52998224725', cidadeUf: 'Osasco / SP', comoChegou: 'instagram', email: 'joana@exemplo.com' }
    await chamar('ana', 'PATCH', `/api/fichas/${id}`, editar)
    await chamar('ana', 'PATCH', `/api/fichas/${id}`, editar)
    const final = (await chamar('ana', 'GET', `/api/fichas/${id}`)).json()
    const linhas = await daFicha()
    expect(final.historico.length).toBeGreaterThan(1)
    expect(linhas.map((l) => l.texto)).toEqual(final.historico.map((h: { oQue: string }) => h.oQue))
    expect(linhas.every((l) => l.quem === ana.id && l.alvo === `ficha:${id}`)).toBe(true)
    expect(linhas.at(-1)!.quando).toBe('2026-10-08T16:00:00.000Z')
  })

  it('a linha do sistema entra como do sistema, com o nome no detalhe; a senha sai mascarada (G9)', async () => {
    const { id } = await cadastrar()
    const fichario = criarFichario(banco, () => relogio)
    const [ficha] = await fichario.fichas([id])
    ficha.historico.push(fichario.evento('Chegou pelo scanner: 1 documento na pasta do Drive', 'Automação do scanner'))
    ficha.historico.push(fichario.evento('Não conseguiu renovar a senha do gov.br: a nova seria Girassol2024', 'ana'))
    await fichario.guardar(ficha)
    const [, scanner, senha] = await daFicha()
    expect([scanner.quem, scanner.por, scanner.texto]).toEqual(['sistema', 'Automação do scanner', 'Chegou pelo scanner: 1 documento na pasta do Drive'])
    expect(senha.texto).toMatch(/^Não conseguiu renovar a senha do gov\.br: /)
    expect(JSON.stringify(await banco.select().from(eventoAuditoria))).not.toContain('Girassol2024')
  })
})
