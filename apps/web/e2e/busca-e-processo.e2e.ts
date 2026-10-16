import { expect, test } from '@playwright/test'
import { entrarPelaApi } from './entrar.ts'
const clienteId = '10000000-0000-4000-8000-000000000001'
const casoId = '20000000-0000-4000-8000-000000000002'

test('a busca única do topo consulta a API e oferece o caso ainda sem número', async ({ page }) => {
  await entrarPelaApi(page, 'juridico@exemplo.ggv')
  await page.route('**/api/clientes/busca', r => r.fulfill({ json: { clientes: [{ id: clienteId, nome: 'Cliente Inventado Busca', cpf: null, beneficio: null, cidade: null, processos: 1, situacao: 'em_andamento', ultimoContato: null }], total: 1, leads: 0, pagina: 1, paginas: 1, opcoes: { beneficios: [], cidades: [] } } }))
  await page.route('**/api/processos/busca', r => r.fulfill({ json: { processos: [{ id: casoId, clienteId, numero: null, autor: 'Cliente Inventado Busca', beneficio: null, fase: 'atendimento', foro: null, juiz: null, perito: null, desfecho: 'em_andamento', ajuizadoEm: null }], total: 1, doAcervo: 0, pagina: 1, paginas: 1, opcoes: { beneficios: [], foros: [], juizes: [], peritos: [] } } }))
  await page.goto('/')
  // Uma busca só na tela inicial (antes eram duas, com resultados diferentes).
  await expect(page.getByRole('searchbox')).toHaveCount(1)
  const campo = page.getByRole('searchbox', { name: 'Buscar processo, cliente ou tarefa' })
  await campo.fill('Cliente Inventado')
  await campo.press('Enter')
  const resultado = page.getByRole('region', { name: 'Resultado da busca' })
  await expect(resultado.getByRole('link', { name: 'Cliente Inventado Busca · sem número ainda' })).toHaveAttribute('href', '/casos/' + casoId)
})

test('a página do processo mostra juízo e laudo da API sem inventar estratégia', async ({ page }) => {
  await entrarPelaApi(page, 'advogada@exemplo.ggv')
  await page.route('**/api/casos/' + casoId + '/processo', r => r.fulfill({ json: {
    casoId, pessoa: { id: clienteId, nome: 'Pessoa Inventada Processo', cpf: null, nascimento: null }, beneficio: 'loas-idoso', fase: 'judicial', desfecho: null, etapaAtual: 'justica',
    identificadores: { nb: null, protocolo: null, cnj: '0000000-00.2030.4.03.0001' }, senhaGovNoCofre: false, transcricoes: 0, etapas: [], linha: [], documentos: [], tarefas: [], pericia: null, exigencias: [], prazos: [], publicacoes: [], proximoPasso: null, valores: null, saude: null,
  } }))
  await page.route('**/api/casos/' + casoId + '/juizo', r => r.fulfill({ json: { juizo: 'Juízo Inventado', vara: 'Vara Inventada', juiz: 'Pessoa Julgadora Inventada', entendimentos: [], base: '2030-10-01', porBeneficio: [], tempoAteASentenca: null, processos: [] } }))
  await page.route('**/api/processos/' + casoId + '/parecer', r => r.fulfill({ json: { processo: { id: casoId }, laudoNovoEm: '2030-10-02' } }))
  await page.route('**/api/processos/' + casoId + '/pericia', r => r.fulfill({ status: 404, json: { erro: 'Sem perícia no teste' } }))
  await page.goto('/casos/' + casoId)
  // O juízo aparece no cartão "Juízo e perícia" da parte 4 (um cartão só para o juízo na página).
  await expect(page.getByRole('region', { name: 'Juízo e perícia do servidor' })).toContainText('Vara Inventada')
  await expect(page.getByRole('region', { name: 'Laudo novo do processo' })).toContainText('02/10/2030')
  await expect(page.getByRole('link', { name: 'Analisar o laudo novo' })).toHaveAttribute('href', '/casos/' + casoId + '/laudo-novo')
  await expect(page.getByRole('region', { name: 'Estratégia do processo' })).toHaveCount(0)
})
