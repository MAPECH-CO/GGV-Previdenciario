// EXEMPLO. Servidor de exemplo dos roteiros de conteúdo mínimo (GGVP-93), sobre o mesmo banco de servidor.ts. A semente é
// a matriz de docs/requisitos/roteiro-laudos.md (PDF do escritório, 26/09) e a resposta do Lucas de 01/10 (Q18). Ligar no
// servidor: trocar o corpo de cada função por fetch no endpoint da design (seção GGVP-93); quem salva vem da sessão.
import { motivoParaNaoSalvar, novaVersao, roteiroDoBeneficio, type ItemDoRoteiro, type Roteiro, type TipoDoItem } from '../regras/roteiro.ts'
import { agora, esperar, gravar, ler, type Banco } from './servidor.ts'

const ESCRITORIO = 'Escritório (roteiro de laudos, 26/09)'
const LUCAS = 'Lucas (resposta de 01/10)'

const item = (id: string, tipo: TipoDoItem, texto: string, pergunta?: string): ItemDoRoteiro => ({ id, tipo, texto, ...(pergunta && { pergunta }) })
const o = (id: string, texto: string, pergunta: string) => item(id, 'obrigatorio', texto, pergunta)
const x = (id: string, texto: string) => item(id, 'contradicao', texto)
const c = (id: string, texto: string) => item(id, 'complementar', texto)

function roteiro(id: string, nome: string, beneficios: string[], laudo: boolean, autor: string, dia: string, itens: ItemDoRoteiro[]): Roteiro {
  return { id, nome, beneficios, laudo, versoes: [{ versao: 1, autor, quando: new Date(`${dia}T12:00:00`).toISOString(), itens }] }
}

/** A semente. As perguntas ao médico não sugerem diagnóstico, CID, grau nem conclusão (G20). */
export function roteirosDeExemplo(): Roteiro[] {
  return [
    roteiro('loas-deficiente', 'BPC/LOAS Deficiente', ['loas-deficiente'], true, ESCRITORIO, '2026-09-26', [
      o('natureza', 'Natureza do impedimento (físico, mental, intelectual ou sensorial)', 'Qual é a natureza do impedimento do paciente?'),
      o('inicio', 'Data de início e se o quadro persiste', 'Desde quando o paciente apresenta o quadro? Ele continua até hoje?'),
      o('prognostico', 'Prognóstico: duração prevista ou permanente', 'Qual a previsão de duração do quadro?'),
      o('limitacoes', 'Limitações funcionais concretas', 'Que atividades do dia a dia o paciente não consegue fazer, ou faz com dificuldade?'),
      o(
        'barreiras',
        'Barreiras: dependência de terceiros, acompanhamento contínuo, transporte, tratamento',
        'O paciente depende de outra pessoa, de acompanhamento contínuo, de transporte ou de tratamento? Com que frequência?',
      ),
      x('menos-de-24-meses', 'Soma do início até a cessação prevista menor que 24 meses (calculada por código, G19)'),
      c('menor-de-16', 'Menor de 16 anos: relatórios escolares, de terapias (fono, TO, psicologia) e do CAPS; impacto na participação social e nos cuidados que limitam o trabalho dos responsáveis'),
      c('gastos', 'Provas de gastos que levam à miserabilidade: aluguel, remédios, gastos hospitalares, alimentação'),
    ]),
    roteiro('pcd', 'Aposentadoria da Pessoa com Deficiência', ['aposentadoria-pcd', 'aposentadoria-pcd-idade'], true, ESCRITORIO, '2026-09-26', [
      o('inicio', 'Data de início da deficiência (ou congênita, expressa)', 'Desde quando o paciente tem a deficiência? Ela existe desde o nascimento?'),
      o('permanencia', 'Permanente ou transitória', 'A deficiência é permanente ou transitória?'),
      o('grau', 'Grau (leve, moderado, grave), com justificativa', 'Como a intensidade da deficiência é avaliada, e por quê?'),
      o('evolucao', 'Evolução com datas', 'Como o quadro evoluiu ao longo do tempo? Em que datas houve mudança?'),
      o(
        'dominios',
        'Limitações nos domínios: sensorial, comunicação, mobilidade, cuidados pessoais, vida doméstica, educação, trabalho e vida econômica, socialização',
        'Que limitações o paciente tem para se comunicar, se locomover, cuidar de si, das tarefas de casa, estudar, trabalhar e conviver?',
      ),
      o('trabalho', 'Adaptações e barreiras no trabalho', 'Que adaptações o paciente precisa no trabalho, e que barreiras encontra?'),
      o('tipo', 'Tipo de deficiência e CID', 'Qual é o tipo de deficiência, com a classificação usada no documento?'),
      x('incapacidade-total', 'Laudo que afirma incapacidade total para o trabalho (a pessoa precisa ter trabalhado com a deficiência)'),
      c('contemporaneos', 'Laudos e prontuários contemporâneos aos vínculos'),
      c('empresa', 'Documentos da empresa: contratação por cota, ASO, exame admissional que cita a deficiência'),
    ]),
    roteiro('incapacidade-temporaria', 'Auxílio por Incapacidade Temporária (previdenciária ou acidentária)', ['incapacidade-temporaria'], true, ESCRITORIO, '2026-09-26', [
      o('atividade', 'Profissão ou atividade habitual', 'Qual é a profissão ou a atividade habitual do paciente?'),
      o('did-dii', 'Data de início da doença (DID) e da incapacidade (DII)', 'Desde quando o paciente tem a doença, e desde quando não consegue trabalhar?'),
      o('correlacao', 'Correlação entre a doença e a atividade', 'Como a doença afeta o trabalho que o paciente faz?'),
      o('afastamento', 'Tempo estimado de afastamento ou data provável de recuperação', 'Por quanto tempo o paciente precisa ficar afastado?'),
      o(
        'tratamento',
        'Tratamento em curso e cirurgia, procedimento ou exame aguardado, com previsão',
        'Que tratamento o paciente faz hoje? Aguarda cirurgia, procedimento ou exame? Para quando?',
      ),
      x('sem-correlacao', 'Soma de atestados de doenças sem correlação clínica, ou fora da janela de 60 dias (calculada por código, G19)'),
      c('atestados', 'Atestados, exames, comprovante de agendamento de cirurgia ou procedimento'),
    ]),
    roteiro(
      'incapacidade-permanente',
      'Aposentadoria por Incapacidade Permanente',
      ['incapacidade-permanente', 'incapacidade-permanente-acidentaria'],
      true,
      ESCRITORIO,
      '2026-09-26',
      [
        o('total', 'Incapacidade total e permanente', 'O paciente consegue exercer alguma atividade que garanta o sustento?'),
        o('reabilitacao', 'Impossibilidade de reabilitação', 'Existe possibilidade de reabilitação para outra atividade? Por quê?'),
        o('prognostico', 'Prognóstico (irreversível, crônico, progressivo, degenerativo, sem melhora)', 'Qual a expectativa de evolução do quadro?'),
        o('tratamentos', 'Histórico de tratamentos', 'Que tratamentos o paciente já fez, e com que resultado?'),
        o('condicoes', 'Condições pessoais (idade, escolaridade, histórico profissional)', 'Como a idade, a escolaridade e o histórico profissional pesam no quadro do paciente?'),
        x('temporaria', 'Laudo que indica incapacidade temporária ou reabilitação possível'),
        c('historico', 'Histórico de tratamentos, internações, cirurgias'),
      ],
    ),
    roteiro('auxilio-acidente', 'Auxílio-Acidente', ['auxilio-acidente'], true, ESCRITORIO, '2026-09-26', [
      o('acidente', 'Descrição do acidente (data, circunstância, lesão)', 'Quando e como aconteceu o acidente, e que lesão ele causou?'),
      o('tratamentos', 'Tratamentos e afastamento', 'Que tratamentos o paciente fez, e por quanto tempo ficou afastado?'),
      o('consolidacao', 'Consolidação das lesões', 'As lesões já estão consolidadas? Desde quando?'),
      o('sequela', 'Sequela definitiva descrita de forma objetiva', 'Que sequela ficou depois do tratamento?'),
      o('nexo', 'Nexo causal', 'Qual a relação entre o acidente e a sequela?'),
      o('repercussao', 'Repercussão da sequela na atividade habitual', 'Como a sequela afeta o trabalho que o paciente fazia?'),
      o('lesao', 'Tipo de lesão, CID e data do acidente', 'Qual é o tipo de lesão e a data do acidente?'),
      x('nao-consolidada', 'Lesão ainda não consolidada'),
      x('sem-reducao', 'Laudo sem redução da capacidade para o trabalho habitual (a redução mínima basta, Tema 416 do STJ)'),
      c('provas', 'CAT, boletim de ocorrência, ficha do pronto-socorro, prontuário da internação ou cirurgia, exames de imagem da época e posteriores à alta'),
    ]),
    roteiro('loas-idoso', 'BPC/LOAS Idoso (socioeconômico)', ['loas-idoso'], false, LUCAS, '2026-10-01', [
      o('idade', 'Idade de 65 anos ou mais', 'Documento com a data de nascimento.'),
      o('renda', 'Renda por pessoa do grupo familiar abaixo de metade de um salário mínimo', 'Comprovantes de renda de todos da casa.'),
      o('sem-renda', 'Provas de que não há renda', 'Declarações e documentos que mostram a falta de renda.'),
      o('gastos', 'Provas de gastos que levam à miserabilidade: aluguel, remédios, gastos hospitalares, alimentação', 'Recibos e notas desses gastos.'),
      c('pericia', 'A perícia socioeconômica é marcada junto ao administrativo; a preparação considera o perito designado, quando já se sabe quem é'),
    ]),
    roteiro('aposentadorias-comuns', 'Aposentadorias por idade e por contribuição', ['aposentadoria-idade', 'aposentadoria-contribuicao'], false, LUCAS, '2026-10-01', [
      o('cnis', 'CNIS completo', 'Extrato do CNIS atualizado.'),
      o('ctps', 'Carteiras de trabalho', 'Todas as carteiras de trabalho.'),
      o('recolhimentos', 'Carnês e guias de recolhimento', 'Carnês e guias pagos.'),
      o('vinculos', 'Provas dos vínculos que faltam no CNIS', 'Documentos de cada vínculo que não aparece no CNIS.'),
    ]),
    roteiro('aposentadoria-especial', 'Aposentadoria Especial', ['aposentadoria-especial'], false, LUCAS, '2026-10-01', [
      o('cnis', 'CNIS completo', 'Extrato do CNIS atualizado.'),
      o('ctps', 'Carteiras de trabalho', 'Todas as carteiras de trabalho.'),
      o('ppp', 'PPP da atividade especial', 'PPP de cada empresa da atividade especial.'),
      o('vinculos', 'Provas dos vínculos que faltam no CNIS', 'Documentos de cada vínculo que não aparece no CNIS.'),
    ]),
    roteiro('curatela', 'Curatela', ['curatela'], true, LUCAS, '2026-10-01', [
      o('natureza', 'Natureza da enfermidade', 'Qual é a enfermidade do paciente, e desde quando?'),
      o('vontade', 'Em que medida a pessoa não consegue exprimir a vontade e gerir os próprios atos', 'O paciente consegue expressar a própria vontade e cuidar dos próprios atos? Em que medida?'),
      o('prognostico', 'Prognóstico', 'Qual a expectativa de evolução do quadro?'),
      c('documentos', 'Documentos do curatelando e do requerente, e o vínculo entre eles (por exemplo, mãe e filho)'),
    ]),
    roteiro('isencao-ir', 'Isenção de Imposto de Renda', ['isencao-ir'], true, LUCAS, '2026-10-01', [
      o('rol', 'Doença do rol legal (Lei 7.713/88, art. 6º, XIV)', 'Qual é a doença do paciente?'),
      o('inicio', 'Data de início da doença: fixa desde quando vale a isenção', 'Desde quando o paciente tem a doença?'),
      o('oficial', 'De preferência, de serviço médico oficial', 'O documento é de serviço médico oficial?'),
      c('beneficio', 'Prova de que recebe aposentadoria ou pensão'),
    ]),
  ]
}

/** Os roteiros do banco: nascem da semente. */
export function roteirosDo(banco: Banco): Roteiro[] {
  banco.roteiros ??= roteirosDeExemplo()
  return banco.roteiros
}

/** O roteiro do benefício do caso; undefined: "benefício sem roteiro" (CA3). Para o parecer (GGVP-20). */
export function roteiroDoCaso(banco: Banco, beneficio: string): Roteiro | undefined {
  return roteiroDoBeneficio(roteirosDo(banco), beneficio)
}

/** GET /api/roteiros */
export async function obterRoteiros(): Promise<Roteiro[]> {
  const banco = ler()
  const roteiros = roteirosDo(banco)
  gravar(banco)
  return roteiros
}

/** GET /api/roteiros/:id */
export async function obterRoteiro(id: string): Promise<Roteiro | null> {
  return (await obterRoteiros()).find((r) => r.id === id) ?? null
}

/** Só a sênior edita a régua (cartão GGVP-93, "Dados e permissões"). */
export const editaRoteiro = (perfil: string | undefined) => perfil?.startsWith('senior') === true

/** POST /api/roteiros/:id/versoes. Só a sênior; valida de novo; nasce a versão seguinte, com autor e data (CA2). */
export async function salvarRoteiro(id: string, itens: ItemDoRoteiro[], quem: { perfil?: string; nome: string }): Promise<Roteiro> {
  await esperar()
  if (!editaRoteiro(quem.perfil)) throw new Error('Só a sênior edita o roteiro.')
  const motivo = motivoParaNaoSalvar(itens)
  if (motivo) throw new Error(motivo)
  const banco = ler()
  const roteiros = roteirosDo(banco)
  const i = roteiros.findIndex((r) => r.id === id)
  if (i < 0) throw new Error('Roteiro não encontrado')
  roteiros[i] = novaVersao(roteiros[i], itens, quem.nome, agora().toISOString())
  gravar(banco)
  return roteiros[i]
}
