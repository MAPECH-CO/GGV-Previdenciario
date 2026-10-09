import { createHash } from 'node:crypto'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { armazenamentoLocal } from '../armazenamento.ts'
import { caso, documento, documentoMedico, exigencia, exigenciaItem, leituraDocumento, tarefaRecepcao, usuario } from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { CONFERENCIAS } from '../../../web/src/regras/contrato.ts'
import { MSG_CONTEUDO_DIFERENTE } from './recepcao-documentos.ts'

const SENHA = 'senha-do-portal-1'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
// Quinta, 08/10/2026, meio-dia em Brasília.
const relogio = new Date('2026-10-08T15:00:00Z')

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const chamar = async (apelido: string, method: 'GET' | 'POST', url: string, payload?: object) =>
  app.inject({ method, url, cookies: await cookieDe(apelido), ...(payload ? { payload } : {}) })
const json = async (apelido: string, method: 'GET' | 'POST', url: string, payload?: object) => (await chamar(apelido, method, url, payload)).json()

async function lead(cpf?: string) {
  return (await json('ana', 'POST', '/api/fichas', { nome: 'Joana Ribeiro', idade: 66, pretende: 'Quer o BPC.', telefone: '11987654321', cpf, beneficioInteresse: 'loas-idoso', outraPessoa: false })).id as string
}
const doc = (nome: string, tipo: string, hash = 'a'.repeat(64)) => ({ nome, formato: 'pdf', tamanho: 1000, tipo, hash })
const enviar = (fichaId: string, ...arquivos: object[]) => json('ana', 'POST', `/api/fichas/${fichaId}/arquivos`, { origem: 'card', arquivos })
const leiturasDe = async (fichaId: string) => (await banco.select().from(leituraDocumento).where(eq(leituraDocumento.pessoaId, fichaId))).map((l) => l.dados as { id: string; situacao: string; tipo: string })

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  app = criarServidor({ banco, agora: () => relogio })
  for (const [apelido, perfil] of [['ana', 'atendimento'], ['dora', 'documentacao'], ['julia', 'financeiro']] as const)
    await banco.insert(usuario).values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
})
afterEach(async () => {
  await app.close()
  await fechar()
})

describe('GGVP-125 · bloco 5b: a chegada dos documentos no servidor', () => {
  it('card: o documento entra na pasta da ficha e a IA lê; o repetido não sobrescreve; o laudo vai ao Jurídico sem resumo', async () => {
    const fichaId = await lead()
    expect((await chamar('julia', 'POST', `/api/fichas/${fichaId}/arquivos`, { origem: 'card', arquivos: [doc('RG.pdf', 'rg')] })).statusCode).toBe(403)
    expect(await enviar(fichaId, { ...doc('RG.pdf', 'rg'), formato: 'jpg' })).toEqual({ erro: 'Arquivos inválidos.' })
    expect(await enviar(fichaId, doc('RG.pdf', 'tipo-que-nao-existe'))).toEqual({ erro: 'Arquivos inválidos.' })

    const rg = await enviar(fichaId, doc('RG.pdf', 'rg'))
    expect(rg).toMatchObject({ resultado: 'enviado', laudoNovo: false, arquivos: [{ nome: 'RG.pdf', local: 'pessoais', origem: 'card', aguardaLeitura: true, repetido: false }] })
    expect(rg.ficha.arquivos).toEqual(rg.arquivos)
    expect(rg.ficha.historico.at(-1).oQue).toMatch(/^Anexou 1 documento pelo card \(/)
    expect(rg.leituras).toMatchObject([{ id: `${fichaId}/RG.pdf`, situacao: 'a-conferir', tipo: 'rg', lidos: { nome: 'Joana Ribeiro' } }])

    const deNovo = await enviar(fichaId, doc('RG.pdf', 'rg'))
    expect(deNovo.arquivos).toMatchObject([{ nome: 'RG (2).pdf', repetido: true }])
    expect(deNovo.leituras).toMatchObject([{ id: `${fichaId}/RG (2).pdf`, duplicadoDe: `${fichaId}/RG.pdf` }])
    expect(deNovo.ficha.historico.at(-1).oQue).toMatch(/; 1 já estava na pasta$/)

    const laudo = await enviar(fichaId, doc('Laudo.pdf', 'laudo', 'b'.repeat(64)))
    expect(laudo).toMatchObject({ laudoNovo: true, ficha: { laudoNovoEm: '2026-10-08' } })
    expect(laudo.tarefas).toContainEqual(expect.objectContaining({ acao: 'Analisar laudo novo', setor: 'Jurídico' }))
    expect(laudo.leituras[0]).toMatchObject({ tipo: 'laudo', emitente: expect.any(String) })
    expect(JSON.stringify(laudo)).not.toContain('Resumo simulado')
    expect((await leiturasDe(fichaId)).map((l) => l.id)).toEqual([`${fichaId}/RG.pdf`, `${fichaId}/RG (2).pdf`, `${fichaId}/Laudo.pdf`])
  })

  it('lote do scanner: com CPF, os arquivos entram para a leitura e o registro conclui a tarefa no servidor; sem CPF, fica para revisar', async () => {
    const fichaId = await lead('52998224725')
    const { tarefa } = await json('ana', 'POST', `/api/fichas/${fichaId}/encaminhamentos`, { motivo: 'documento', setor: 'Documentação · ADM' })
    expect(await json('dora', 'POST', `/api/tarefas/${tarefa.id}/registro`, { forma: 'papel', conferiTipos: true, conferiPapel: false })).toEqual({
      erro: 'O lote do scanner ainda não chegou.',
    })
    const r = await json('dora', 'POST', `/api/tarefas/${tarefa.id}/lote`)
    expect(r.lote).toMatchObject({ status: 'arquivado', fichaId })
    expect(r.ficha.arquivos).toMatchObject([
      { tipo: 'comprovante-residencia', origem: 'scanner', aguardaLeitura: true },
      { tipo: 'cnis', origem: 'scanner', aguardaLeitura: true },
    ])
    expect(r.leituras).toHaveLength(2)
    expect(r.ficha.historico.at(-1)).toMatchObject({ quem: 'Automação do scanner', oQue: 'Guardou 2 documentos na pasta do Drive, em PDF pesquisável' })

    const registro = await json('dora', 'POST', `/api/tarefas/${tarefa.id}/registro`, { forma: 'papel', conferiTipos: true, conferiPapel: false })
    expect(registro.evento.oQue).toBe('Registrou o recebimento de 2 documentos em papel, pelo scanner; conferiu o tipo de cada documento')
    expect((await banco.select().from(tarefaRecepcao).where(eq(tarefaRecepcao.id, tarefa.id)))[0].concluidaEm).not.toBeNull()
    expect(await json('dora', 'POST', `/api/tarefas/${tarefa.id}/registro`, { forma: 'papel', conferiTipos: true, conferiPapel: false })).toEqual({
      erro: 'Esta tarefa já foi registrada.',
    })

    const semCpf = (await json('ana', 'POST', '/api/fichas', { nome: 'Marta Lima', idade: 70, pretende: 'Quer o BPC.', telefone: '11955554444', beneficioInteresse: 'loas-idoso', outraPessoa: false })).id
    const outra = (await json('ana', 'POST', `/api/fichas/${semCpf}/encaminhamentos`, { motivo: 'documento', setor: 'Documentação · ADM' })).tarefa
    const revisao = await json('dora', 'POST', `/api/tarefas/${outra.id}/lote`)
    expect(revisao).toMatchObject({ lote: { status: 'revisao' }, ficha: { arquivos: [] }, leituras: [] })
    expect(await json('dora', 'POST', `/api/tarefas/${outra.id}/registro`, { forma: 'digital', conferiTipos: true, conferiPapel: false })).toEqual({
      erro: 'Nenhum arquivo anexado ao card.',
    })
  })

  it('o contrato assinado pelo ZapSign chega à pasta do processo já com a leitura, para a conferência da Documentação', async () => {
    const fichaId = await lead()
    const { processo } = await json('ana', 'POST', `/api/fichas/${fichaId}/processos`, { beneficio: 'loas-idoso' })
    const base = `/api/processos/${processo.id}/contrato`
    const conferencias = Object.fromEntries(CONFERENCIAS.map((c) => [c.id, true]))
    const { campos } = await json('ana', 'POST', `${base}/gerar`, { aprovados: true, conferencias, correcoes: {} })
    const validos: Record<string, string> = { cpf: '52998224725', rg: '12.345.678-9', estadoCivil: 'Viúvo(a)', profissao: 'Do lar', endereco: 'Rua das Flores, 10, Centro, Osasco/SP' }
    const correcoes = Object.fromEntries((campos as string[]).map((c) => [c, validos[c]]))
    await json('ana', 'POST', `${base}/gerar`, { aprovados: false, oQueCorrigir: 'faltavam dados do cadastro', conferencias, correcoes })
    await json('ana', 'POST', `${base}/zapsign`)
    const { arquivo } = await json('ana', 'POST', `${base}/zapsign/retorno-simulado`)
    expect(await leiturasDe(fichaId)).toMatchObject([{ id: `${fichaId}/${arquivo.nome}`, tipo: 'contrato', situacao: 'a-conferir' }])
  })
})

describe('GGVP-125 · bloco 5b: a conferência dos documentos no servidor', () => {
  const MARTA = '11144477735'
  async function marta() {
    const id = (await json('ana', 'POST', '/api/fichas', { nome: 'Marta Lima', idade: 70, pretende: 'Quer o BPC.', telefone: '11955554444', cpf: MARTA, beneficioInteresse: 'loas-idoso', outraPessoa: false })).id as string
    const { processo } = await json('ana', 'POST', `/api/fichas/${id}/processos`, { beneficio: 'loas-idoso' })
    return { id, processoId: processo.id as string }
  }
  /** A IA leu no papel o nome e o CPF de outra pessoa: a leitura vai para a quarentena (o simulado só lê o próprio cliente). */
  async function deOutraPessoa(leituraId: string) {
    const [linha] = await banco.select().from(leituraDocumento).where(eq(leituraDocumento.id, leituraId))
    const dados = { ...(linha.dados as object), lidos: { nome: 'Marta Lima', cpf: MARTA }, quarentena: 'o CPF lido é de outra pessoa', situacao: 'quarentena' }
    await banco.update(leituraDocumento).set({ dados }).where(eq(leituraDocumento.id, leituraId))
  }
  const conferir = (fichaId: string) => json('dora', 'GET', `/api/fichas/${fichaId}/documentos-lidos`)

  it('a lista, a trava do arquivar, o duplicado descartado, a quarentena liberada e o documento movido para o caso de outra cliente', async () => {
    const outra = await marta()
    const fichaId = await lead('52998224725')
    await enviar(fichaId, doc('RG.pdf', 'rg'))
    await enviar(fichaId, doc('RG.pdf', 'rg'))
    await enviar(fichaId, doc('CNIS.pdf', 'cnis', 'c'.repeat(64)))
    await deOutraPessoa(`${fichaId}/CNIS.pdf`)

    const lista = await conferir(fichaId)
    expect(lista.documentos.map((d: { id: string; situacao: string }) => [d.id, d.situacao])).toEqual([
      [`${fichaId}/RG.pdf`, 'a-conferir'],
      [`${fichaId}/RG (2).pdf`, 'a-conferir'],
      [`${fichaId}/CNIS.pdf`, 'quarentena'],
    ])
    expect(lista.destinos).toContainEqual({ processoId: outra.processoId, rotulo: 'Marta Lima · LOAS Idoso' })

    const url = `/api/fichas/${fichaId}/documentos-lidos/arquivar`
    const ambos = [`${fichaId}/RG.pdf`, `${fichaId}/RG (2).pdf`].map((id) => ({ id, tipo: 'rg', data: '2026-10-08' }))
    expect((await chamar('dora', 'POST', url, { conferi: false, documentos: ambos })).statusCode).toBe(400)
    expect(await json('dora', 'POST', url, { conferi: true, documentos: ambos.slice(0, 1) })).toEqual({ erro: 'A conferência mudou: abra a tela de novo.' })
    expect(await json('dora', 'POST', url, { conferi: true, documentos: ambos })).toEqual({ erro: 'Decida o que fazer com o documento duplicado.' })
    const arquivou = await json('dora', 'POST', url, { conferi: true, documentos: ambos, duplicados: 'descartar' })
    expect(arquivou).toMatchObject({ arquivados: 1, descartados: 1, contrato: false })
    expect(arquivou.evento.oQue).toMatch(/^Arquivou 1 documento lidos pela IA \(.+\); descartou 1 cópia menos legível \(o original fica guardado\); conferiu a leitura$/)
    expect(arquivou.ficha.arquivos.filter((a: { tipo: string }) => a.tipo === 'rg').map((a: { aguardaLeitura: boolean }) => a.aguardaLeitura)).toEqual([false, false])
    expect(arquivou.leituras.map((l: { situacao: string }) => l.situacao).sort()).toEqual(['arquivado', 'descartado', 'quarentena'])

    const cnis = encodeURIComponent(`${fichaId}/CNIS.pdf`)
    expect(await json('dora', 'POST', `/api/documentos-lidos/${cnis}/cadastro`, { campo: 'cpf' })).toEqual({ erro: 'Documento em quarentena: confira de quem é antes.' })
    expect((await json('dora', 'POST', `/api/documentos-lidos/${cnis}/liberar`)).documento.situacao).toBe('a-conferir')
    expect(await json('dora', 'POST', `/api/documentos-lidos/${cnis}/mover`, { processoId: outra.processoId, motivo: 'x' })).toEqual({ erro: 'Informe o motivo para mover o documento.' })
    const movido = await json('dora', 'POST', `/api/documentos-lidos/${cnis}/mover`, { processoId: outra.processoId, motivo: 'o CNIS é da Marta' })
    expect(movido.evento.oQue).toMatch(/^Moveu .+ para o caso LOAS Idoso de Marta Lima\. Motivo: o CNIS é da Marta$/)
    expect(movido.ficha.arquivos.map((a: { nome: string }) => a.nome)).not.toContain('CNIS.pdf')
    expect(movido.destino.arquivos).toContainEqual(expect.objectContaining({ nome: 'CNIS.pdf', aguardaLeitura: true }))
    expect(movido.destino.historico.at(-1).oQue).toMatch(/^Recebeu .+ vindo da pasta de Joana Ribeiro\. Motivo: o CNIS é da Marta$/)
    expect((await leiturasDe(outra.id)).map((l) => l.id)).toEqual([`${outra.id}/CNIS.pdf`])
    expect((await leiturasDe(fichaId)).find((l) => l.id === `${fichaId}/CNIS.pdf`)?.situacao).toBe('movido')
  })

  it('usar no cadastro: campo a campo, o valor não vai ao histórico; CPF de outra ficha não grava', async () => {
    await marta()
    const fichaId = await lead('52998224725')
    await enviar(fichaId, doc('RG.pdf', 'rg'))
    const id = `${fichaId}/RG.pdf`
    const [linha] = await banco.select().from(leituraDocumento).where(eq(leituraDocumento.id, id))
    await banco.update(leituraDocumento).set({ dados: { ...(linha.dados as object), lidos: { nome: 'Joana Ribeiro', rg: '12.345.678-9', cpf: MARTA } } }).where(eq(leituraDocumento.id, id))
    const url = `/api/documentos-lidos/${encodeURIComponent(id)}/cadastro`
    expect(await json('dora', 'POST', url, { campo: 'cpf' })).toEqual({ erro: 'Este CPF já está na ficha de Marta Lima.' })
    expect(await json('dora', 'POST', url, { campo: 'endereco' })).toEqual({ erro: 'A IA não leu este dado.' })
    const r = await json('dora', 'POST', url, { campo: 'rg' })
    expect(r.ficha.rg).toBe('123456789')
    expect(r.ficha.historico.at(-1).oQue).toMatch(/^Atualizou o rg do cadastro com o que a IA leu \(.+\)$/)
    expect(JSON.stringify(r.ficha.historico)).not.toContain('12.345.678-9')
  })

  it('o contrato assinado arquivado pela Documentação segue para a cópia; as leituras vão na cópia das telas', async () => {
    const fichaId = await lead()
    const { processo } = await json('ana', 'POST', `/api/fichas/${fichaId}/processos`, { beneficio: 'loas-idoso' })
    const base = `/api/processos/${processo.id}/contrato`
    const conferencias = Object.fromEntries(CONFERENCIAS.map((c) => [c.id, true]))
    const { campos } = await json('ana', 'POST', `${base}/gerar`, { aprovados: true, conferencias, correcoes: {} })
    const validos: Record<string, string> = { cpf: '52998224725', rg: '12.345.678-9', estadoCivil: 'Viúvo(a)', profissao: 'Do lar', endereco: 'Rua das Flores, 10, Centro, Osasco/SP' }
    const correcoes = Object.fromEntries((campos as string[]).map((c) => [c, validos[c]]))
    await json('ana', 'POST', `${base}/gerar`, { aprovados: false, oQueCorrigir: 'faltavam dados do cadastro', conferencias, correcoes })
    await json('ana', 'POST', `${base}/zapsign`)
    const { arquivo } = await json('ana', 'POST', `${base}/zapsign/retorno-simulado`)
    const documentos = [{ id: `${fichaId}/${arquivo.nome}`, tipo: 'contrato', data: '2026-10-08' }]
    const r = await json('dora', 'POST', `/api/fichas/${fichaId}/documentos-lidos/arquivar`, { conferi: true, documentos })
    expect(r).toMatchObject({ arquivados: 1, contrato: true })
    expect(r.contratos).toMatchObject([{ processoId: processo.id, etapa: 'copia' }])
    expect(r.ficha.arquivos.find((a: { nome: string }) => a.nome === arquivo.nome)).toMatchObject({ local: processo.id, aguardaLeitura: false })
    expect((await json('ana', 'GET', '/api/recepcao')).leituras).toMatchObject([{ id: `${fichaId}/${arquivo.nome}`, situacao: 'arquivado' }])
  })
})

describe('GGVP-125 · bloco 5b+: o arquivo do card guardado e o laudo novo no parecer (pedido do Pedro, 09/10)', () => {
  const PDF_LAUDO = Buffer.from('%PDF-1.4 laudo de exemplo')
  const PDF_RG = Buffer.from('%PDF-1.4 rg de exemplo')
  const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex')
  const conteudo = async (fichaId: string, b: Buffer, hash = sha(b), nome = 'arquivo.pdf') => {
    const f = '----ggv'
    const corpo = Buffer.concat([
      Buffer.from(`--${f}\r\nContent-Disposition: form-data; name="hash"\r\n\r\n${hash}\r\n`),
      Buffer.from(`--${f}\r\nContent-Disposition: form-data; name="arquivo"; filename="${nome}"\r\nContent-Type: application/pdf\r\n\r\n`),
      b,
      Buffer.from(`\r\n--${f}--\r\n`),
    ])
    return app.inject({ method: 'POST', url: `/api/fichas/${fichaId}/arquivos/conteudo`, cookies: await cookieDe('ana'), payload: corpo, headers: { 'content-type': `multipart/form-data; boundary=${f}` } })
  }

  beforeEach(async () => {
    await app.close()
    app = criarServidor({ banco, agora: () => relogio, armazenamento: armazenamentoLocal(mkdtempSync(join(tmpdir(), 'arq-'))) })
  })

  it('laudo com caso: guardado como documento sensível do caso e documento médico não conferido; o mesmo conteúdo não duplica', async () => {
    const fichaId = await lead()
    const [c] = await banco.insert(caso).values({ pessoaId: fichaId, beneficio: 'bpc_loas_deficiente', fase: 'administrativa' }).returning()
    await enviar(fichaId, doc('Laudo.pdf', 'laudo', sha(PDF_LAUDO)))
    const r = await conteudo(fichaId, PDF_LAUDO)
    expect(r.statusCode).toBe(201)
    const [d] = await banco.select().from(documento).where(eq(documento.id, r.json().documentoId))
    expect([d.casoId, d.pessoaId, d.tipo, d.sensivel, d.origem, d.hashSha256]).toEqual([c.id, fichaId, 'laudo', true, 'card', sha(PDF_LAUDO)])
    const [m] = await banco.select().from(documentoMedico).where(eq(documentoMedico.documentoId, d.id))
    expect([m.tipo, m.confirmadoEm]).toEqual(['laudo', null])
    expect((await conteudo(fichaId, PDF_LAUDO)).json()).toEqual({ documentoId: d.id, repetido: true })
    expect(await banco.select().from(documento)).toHaveLength(1)
  })

  it('sem caso, o RG fica com a pessoa e não é sensível; conteúdo que não foi anunciado é recusado e nada é guardado', async () => {
    const fichaId = await lead()
    await enviar(fichaId, doc('RG.pdf', 'rg', sha(PDF_RG)))
    const outro = await conteudo(fichaId, Buffer.from('%PDF outro conteúdo'))
    expect([outro.statusCode, outro.json().erro]).toEqual([400, MSG_CONTEUDO_DIFERENTE])
    const r = await conteudo(fichaId, PDF_RG)
    expect(r.statusCode).toBe(201)
    const [d] = await banco.select().from(documento).where(eq(documento.id, r.json().documentoId))
    expect([d.casoId, d.pessoaId, d.sensivel]).toEqual([null, fichaId, false])
    expect(await banco.select().from(documentoMedico)).toHaveLength(0)
  })

  it('bloco 5d · o tipo conferido vai ao registro; o que chegou pelo scanner e foi conferido como laudo abre "Analisar laudo novo" e entra no parecer', async () => {
    const fichaId = await lead('52998224725')
    const [c] = await banco.insert(caso).values({ pessoaId: fichaId, beneficio: 'bpc_loas_deficiente', fase: 'administrativa' }).returning()
    await enviar(fichaId, doc('RG.pdf', 'rg', sha(PDF_RG)))
    await conteudo(fichaId, PDF_RG)
    const { tarefa } = await json('ana', 'POST', `/api/fichas/${fichaId}/encaminhamentos`, { motivo: 'documento', setor: 'Documentação · ADM' })
    await json('dora', 'POST', `/api/tarefas/${tarefa.id}/lote`)
    expect(await banco.select().from(tarefaRecepcao).where(eq(tarefaRecepcao.id, `laudo-${fichaId}`))).toEqual([])

    // A Documentação confere o RG do card como certidão e o CNIS do scanner como laudo.
    const lidos = (await json('dora', 'GET', `/api/fichas/${fichaId}/documentos-lidos`)).documentos.filter((d: { situacao: string }) => d.situacao === 'a-conferir')
    const tipo: Record<string, string> = { rg: 'certidao', cnis: 'laudo' }
    const documentos = lidos.map((d: { id: string; tipo: string }) => ({ id: d.id, tipo: tipo[d.tipo] ?? d.tipo, data: '2026-10-08' }))
    expect(await json('dora', 'POST', `/api/fichas/${fichaId}/documentos-lidos/arquivar`, { conferi: true, documentos })).toMatchObject({ arquivados: 3 })

    const registros = await banco.select().from(documento).where(eq(documento.pessoaId, fichaId))
    const [dora] = await banco.select().from(usuario).where(eq(usuario.email, 'dora@exemplo.ggv'))
    const doCard = registros.find((d) => d.origem === 'card')!
    expect([doCard.tipo, doCard.situacao, doCard.conferidoPor, doCard.sensivel, doCard.hashSha256]).toEqual(['certidao', 'conferido', dora.id, false, sha(PDF_RG)])
    const laudo = registros.find((d) => d.tipo === 'laudo')!
    expect([laudo.origem, laudo.sensivel, laudo.drivePendente, laudo.casoId]).toEqual(['scanner', true, false, c.id])
    const [m] = await banco.select().from(documentoMedico).where(eq(documentoMedico.documentoId, laudo.id))
    expect([m.tipo, m.confirmadoEm]).toEqual(['laudo', null])
    const [t] = await banco.select().from(tarefaRecepcao).where(eq(tarefaRecepcao.id, `laudo-${fichaId}`))
    expect([(t.dados as { acao: string }).acao, (t.dados as { setor: string }).setor, t.concluidaEm]).toEqual(['Analisar laudo novo', 'Jurídico', null])
    expect(registros).toHaveLength(3)
  })
})

describe('GGVP-125 · bloco 5d: a baixa pelo tipo do documento nas pendências', () => {
  it('o documento conferido do tipo que o item da exigência aberta espera dá baixa sozinho, com o documento como prova e quem conferiu', async () => {
    const fichaId = await lead('52998224725')
    const [c] = await banco.insert(caso).values({ pessoaId: fichaId, beneficio: 'bpc_loas_idoso', fase: 'administrativa' }).returning()
    const [aberta] = await banco.insert(exigencia).values({ casoId: c.id, origem: 'inss', descricao: 'Apresentar comprovantes.', recebidaEm: '2026-10-02' }).returning()
    const [antiga] = await banco.insert(exigencia).values({ casoId: c.id, origem: 'inss', descricao: 'Antiga.', recebidaEm: '2026-09-01', situacao: 'cumprida' }).returning()
    await banco.insert(exigenciaItem).values([
      { exigenciaId: aberta.id, descricao: 'Comprovante de residência atualizado', perfilResponsavel: 'documentacao', tipoDocumento: 'comprovante-residencia' },
      { exigenciaId: aberta.id, descricao: 'Declaração do sindicato', perfilResponsavel: 'documentacao' },
      { exigenciaId: antiga.id, descricao: 'Comprovante da exigência antiga', perfilResponsavel: 'documentacao', tipoDocumento: 'comprovante-residencia' },
    ])
    const { tarefa } = await json('ana', 'POST', `/api/fichas/${fichaId}/encaminhamentos`, { motivo: 'documento', setor: 'Documentação · ADM' })
    await json('dora', 'POST', `/api/tarefas/${tarefa.id}/lote`)
    const lidos = (await json('dora', 'GET', `/api/fichas/${fichaId}/documentos-lidos`)).documentos.filter((d: { situacao: string }) => d.situacao === 'a-conferir')
    const documentos = lidos.map((d: { id: string; tipo: string }) => ({ id: d.id, tipo: d.tipo, data: '2026-10-08' }))
    expect(await json('dora', 'POST', `/api/fichas/${fichaId}/documentos-lidos/arquivar`, { conferi: true, documentos })).toMatchObject({ arquivados: 2 })

    const [comprovante] = await banco.select().from(documento).where(eq(documento.tipo, 'comprovante-residencia'))
    const [dora] = await banco.select().from(usuario).where(eq(usuario.email, 'dora@exemplo.ggv'))
    const itens = await banco.select().from(exigenciaItem)
    const item = (descricao: string) => itens.find((i) => i.descricao === descricao)!
    const cumprido = item('Comprovante de residência atualizado')
    expect([cumprido.situacao, cumprido.provaDocumentoId, cumprido.cumpridoPor]).toEqual(['cumprido', comprovante.id, dora.id])
    expect([item('Declaração do sindicato').situacao, item('Comprovante da exigência antiga').situacao]).toEqual(['pendente', 'pendente'])
  })
})
