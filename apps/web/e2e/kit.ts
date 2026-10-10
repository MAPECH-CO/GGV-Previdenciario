// Ajudantes dos e2e do kit de verdade (GGVP-136): o modelo de teste que a Sênior sobe e o cadastro que a advogada completa.
// Nenhum modelo do escritório entra no repositório: o texto abaixo é inventado.
import { expect, request } from '@playwright/test'
import type { Ficha } from '../src/dados/tipos.ts'
import { cadastroDaFicha } from '../src/regras/cadastro.ts'
import { docxDeTeste, TIPO_DO_DOCX } from './docx-de-teste.ts'
import { ADVOGADA, entrarComo } from './entrar.ts'

export const SENIOR = 'senior@exemplo.ggv'

/** O modelo de teste, com as variáveis que os modelos do escritório usam. A 1ª data é a do contrato; as outras saem em branco. */
export const modeloDeTeste = (rotulo = 'teste') => [
  `CONTRATO DE TESTE (${rotulo}). {{NOME COMPLETO}}, {{ESTADO CIVIL}}, {{NACIONALIDADE}}, CPF {{NÚMERO DO CPF}}, {{ENDEREÇO COMPLETO}} nº {{Nº}}, {{BAIRRO}}, {{CIDADE}}/{{UF}}, CEP {{CEP}}.`,
  'São Paulo, {{DATA DE HOJE}}.',
  'PROCURAÇÃO de {{NOME COMPLETO}}.',
  '{{CIDADE}}, {{DATA DE HOJE}}.',
]

/** A Sênior sobe o modelo da linha pela API, se ainda não há versão dele na Configuração: o mesmo envio que a tela faz. */
export async function garantirModelo(baseURL: string, id: string) {
  const senior = await request.newContext({ baseURL })
  try {
    await entrarComo(senior, SENIOR)
    const { modelos } = (await (await senior.get('/api/configuracao/modelos')).json()) as { modelos: { id: string; versao: number | null }[] }
    if (modelos.find((m) => m.id === id)?.versao) return
    const r = await senior.put(`/api/configuracao/modelos/${id}`, { multipart: { arquivo: { name: 'modelo.docx', mimeType: TIPO_DO_DOCX, buffer: docxDeTeste(modeloDeTeste()) } } })
    expect(r.status()).toBe(201)
  } finally {
    await senior.dispose()
  }
}

/** O kit pede o endereço completo, que o balcão não colhe: a advogada completa o cadastro do cliente (o mesmo envio da tela). */
export async function completarCadastro(baseURL: string, fichaId: string, cpf: string) {
  const juridico = await request.newContext({ baseURL })
  try {
    await entrarComo(juridico, ADVOGADA)
    const base = cadastroDaFicha((await (await juridico.get(`/api/fichas/${fichaId}`)).json()) as Ficha)
    const valores = { ...base, cpf, rg: '12.345.678-9', nascimento: '10/05/1958', estadoCivil: 'Viúvo(a)', profissao: 'Do lar', cep: '06010000', rua: 'Rua das Flores, 10', bairro: 'Centro', cidade: 'Osasco', uf: 'SP' }
    const salvo = (await (await juridico.put(`/api/fichas/${fichaId}/cadastro`, { data: { base, valores } })).json()) as { resultado: string }
    expect(salvo.resultado).toBe('salvo')
  } finally {
    await juridico.dispose()
  }
}
