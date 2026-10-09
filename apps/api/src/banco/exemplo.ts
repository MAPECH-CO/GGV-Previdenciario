// DADOS DE EXEMPLO, só para o banco local da máquina do dev. Nenhuma pessoa é real, e os arquivos não existem.
// Senha de todos: SENHA_DE_EXEMPLO. Nunca em produção; na homologação, só pelo `homologacao:preparar` (GGVP-126), que troca as senhas.
import bcrypt from 'bcryptjs'
import { count, eq } from 'drizzle-orm'
import type { Banco } from './conexao.ts'
import { chaveDoCofre, criarCofre } from '../cofre.ts'
import { caso, configuracao, contrato, credencialGovbr, decisao, documento, documentoMedico, etapa, exigencia, exigenciaItem, identificadorCaso, kitDocumento, modelo, parecerMedico, pessoa, peticao, peticaoVersao, prestacaoContas, processoAcervo, protocoloJudicial, publicacao, resultadoInss, rodadaVigilia, tarefa, tentativa, usuario } from './esquema.ts'
import { encaminhar } from '../vigilia/encaminhar.ts'
import { CNJ_EXEMPLO } from '../vigilia/fontes.ts'
import { abrirDecisaoDoRecurso } from '../rotas/recurso.ts'
import { abrirExplicacaoDoResultado } from '../rotas/resultado.ts'
import { momentoDoHorario } from '../vigilia/rodadas.ts'

export const SENHA_DE_EXEMPLO = 'exemplo-ggv-2026'

export const usuariosDeExemplo = [
  { email: 'atendimento@exemplo.ggv', nome: 'Ana (exemplo)', perfis: ['atendimento'], trocarSenha: false },
  { email: 'provisoria@exemplo.ggv', nome: 'Bia (exemplo, senha provisória)', perfis: ['atendimento'], trocarSenha: true },
  { email: 'semperfil@exemplo.ggv', nome: 'Caio (exemplo, sem perfil)', perfis: [], trocarSenha: false },
  { email: 'trava@exemplo.ggv', nome: 'Davi (exemplo, para testar a trava)', perfis: ['atendimento'], trocarSenha: false },
  { email: 'lider@exemplo.ggv', nome: 'Eva (exemplo, líder e atendimento)', perfis: ['atendimento_lider', 'atendimento'], trocarSenha: false },
  { email: 'documentacao@exemplo.ggv', nome: 'Fábio (exemplo)', perfis: ['documentacao'], trocarSenha: false },
  { email: 'advogada@exemplo.ggv', nome: 'Gabi (exemplo)', perfis: ['advogada'], trocarSenha: false },
  { email: 'senior@exemplo.ggv', nome: 'Helena (exemplo)', perfis: ['senior'], trocarSenha: false },
  // A dispensa do parecer pede duas Sêniores diferentes (G17, Q14); o nome bate com o exemplo da tela do Pedro.
  { email: 'senior2@exemplo.ggv', nome: 'Otávio (exemplo, segunda Sênior)', perfis: ['senior'], trocarSenha: false },
  { email: 'juridico@exemplo.ggv', nome: 'Igor (exemplo)', perfis: ['juridico_adm'], trocarSenha: false },
  { email: 'financeiro@exemplo.ggv', nome: 'Júlia (exemplo)', perfis: ['financeiro'], trocarSenha: false },
  { email: 'socio@exemplo.ggv', nome: 'Lauro (exemplo)', perfis: ['socio'], trocarSenha: false },
]

/** Casos de exemplo da Via administrativa (GGVP-8): já aprovados pela Sênior, prontos para protocolar e decidir perícia. */
const casosDeExemplo = [
  { nome: 'Maria Souza (exemplo)', beneficio: 'bpc_loas_deficiente', senhaGov: 'gov-maria-exemplo' },
  { nome: 'José Ramos (exemplo)', beneficio: 'aposentadoria_pcd', senhaGov: 'gov-jose-exemplo' },
  { nome: 'Lúcia Prado (exemplo)', beneficio: 'auxilio_incapacidade_temporaria', senhaGov: null },
] as const

const DOCUMENTOS_DE_EXEMPLO = ['RG e CPF', 'Comprovante de residência', 'Procuração assinada', 'Contrato assinado', 'Laudo médico']

/** Só semeia banco vazio: não mexe em quem já existe. */
export async function semearExemplos(banco: Banco) {
  // GGVP-126 CA4: "vazio" é sem os usuários de exemplo; a homologação já tem o usuário de quem cuida dela.
  const [{ total }] = await banco.select({ total: count() }).from(usuario).where(eq(usuario.email, usuariosDeExemplo[0].email))
  if (total > 0) return
  const senhaHash = await bcrypt.hash(SENHA_DE_EXEMPLO, 10)
  const usuarios = await banco
    .insert(usuario)
    .values(usuariosDeExemplo.map((u) => ({ ...u, senhaHash })))
    .returning()
  const senior = usuarios.find((u) => u.perfis.includes('senior'))!
  const advogada = usuarios.find((u) => u.perfis.includes('advogada'))!
  const cofre = criarCofre(chaveDoCofre())

  for (const [i, ex] of casosDeExemplo.entries()) {
    const [p] = await banco.insert(pessoa).values({ nome: ex.nome, situacao: 'cliente', origem: 'exemplo' }).returning()
    const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: ex.beneficio, fase: 'administrativa' }).returning()
    for (const [j, nome] of DOCUMENTOS_DE_EXEMPLO.entries())
      await banco.insert(documento).values({
        casoId: c.id,
        pessoaId: p.id,
        tipo: nome.toLowerCase().replaceAll(' ', '_'),
        sensivel: nome === 'Laudo médico',
        chaveArmazenamento: `exemplo/${c.id}/${j}`,
        nomeOriginal: `${nome} (exemplo).pdf`,
        mime: 'application/pdf',
        tamanho: 0,
        hashSha256: 'exemplo',
        origem: 'exemplo',
        criadoEm: new Date(Date.UTC(2026, 8, 20 + i, 12, j)),
      })
    if (ex.senhaGov) await banco.insert(credencialGovbr).values({ pessoaId: p.id, ...cofre.cifrar(ex.senhaGov) })
    await banco.insert(decisao).values({ casoId: c.id, passo: 'D2.01', tipo: 'aprovacao_inss', resultado: 'aprovado', decididoPor: senior.id, perfil: 'senior' })
    await banco.insert(tarefa).values([
      { casoId: c.id, passo: 'D2.02', titulo: 'Protocolar no Meu INSS', perfilDono: 'juridico_adm' },
      { casoId: c.id, passo: 'D2.03', titulo: 'Decidir perícia', perfilDono: 'advogada' },
    ])
  }

  // Casos esperando a conferência da Sênior (GGVP-23): um pronto para aprovar (pensão por morte, em destaque)
  // e um sem parecer médico, sem kit e sem contrato assinado, que o servidor barra (G1 e G17).
  // GGVP-23 CA11: o G1 pede kit cadastrado. Kit de exemplo da pensão, só para a Antônia seguir aprovável; a lista de
  // verdade de cada benefício é do escritório (pedida ao Lucas em 08/10) e entra pela Configuração.
  await banco.insert(kitDocumento).values(
    ['rg_e_cpf', 'comprovante_de_residência', 'procuração_assinada'].map((tipoDocumento) => ({
      beneficio: 'pensao_morte',
      tipoDocumento,
      vigenteDesde: new Date('2000-01-01T12:00:00Z'),
    })),
  )
  for (const ex of [
    { nome: 'Antônia Lima (exemplo)', beneficio: 'pensao_morte', parecer: 'suficiente' as const, assinado: true },
    { nome: 'Benedito Alves (exemplo)', beneficio: 'auxilio_acidente', parecer: null, assinado: false },
  ]) {
    const [p] = await banco.insert(pessoa).values({ nome: ex.nome, situacao: 'cliente', origem: 'exemplo' }).returning()
    const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: ex.beneficio, fase: 'atendimento' }).returning()
    for (const [j, nome] of DOCUMENTOS_DE_EXEMPLO.entries())
      await banco.insert(documento).values({
        casoId: c.id,
        pessoaId: p.id,
        tipo: nome.toLowerCase().replaceAll(' ', '_'),
        sensivel: nome === 'Laudo médico',
        chaveArmazenamento: `exemplo/${c.id}/${j}`,
        nomeOriginal: `${nome} (exemplo).pdf`,
        mime: 'application/pdf',
        tamanho: 0,
        hashSha256: 'exemplo',
        origem: 'exemplo',
      })
    if (ex.parecer)
      await banco.insert(parecerMedico).values({
        casoId: c.id,
        roteiroVersao: 1,
        resultado: ex.parecer,
        // G17: confirmado por pessoa do Jurídico; sem isso, o portão vê só a sugestão da IA.
        confirmadoPor: advogada.id,
        confirmadoEm: new Date(),
        itens: [
          { item: 'Natureza do impedimento', atendido: true },
          { item: 'Data de início', atendido: true },
          { item: 'Limitações funcionais', atendido: true },
        ],
      })
    // GGVP-23 CA12: o contrato assinado é parte do G1.
    if (ex.assinado) await banco.insert(contrato).values({ casoId: c.id, situacao: 'assinado' })
    await banco.insert(tarefa).values({ casoId: c.id, passo: 'D2.01', titulo: 'Conferir antes do INSS', perfilDono: 'senior' })
  }

  // Casos em vigília, esperando o INSS (GGVP-35 e GGVP-48): um para cada resposta (deferido, indeferido e exigência) e
  // um para o caminho do indeferido até o protocolo da petição inicial (GGVP-9, grupo 3).
  // CPFs de exemplo, válidos só nos dígitos verificadores, para a trava do CPF da petição (GGVP-71).
  const cpfs = ['27183946509', '38492715600', '52916384782', '61374825964']
  for (const [i, nome] of ['Rita Gomes (exemplo)', 'Sebastião Cruz (exemplo)', 'Teresa Dias (exemplo)', 'Vicente Prado (exemplo)'].entries()) {
    const [p] = await banco.insert(pessoa).values({ nome, cpf: cpfs[i], situacao: 'cliente', origem: 'exemplo' }).returning()
    const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_idoso', fase: 'administrativa' }).returning()
    await banco
      .insert(etapa)
      .values({ casoId: c.id, diagrama: 'D2', passo: 'D2.04', situacao: 'aguardando_externo', aguardando: 'INSS decidir', iniciadaEm: new Date(Date.UTC(2026, 8, 25 + i, 12)) })
    await banco.insert(tarefa).values({ casoId: c.id, passo: 'D2.04', titulo: 'Trazer a resposta do INSS', perfilDono: 'advogada' })
  }

  // Exigência do INSS (GGVP-39): limites de cobrança do escritório (Q1, exemplo) e um caso esperando a advogada decidir.
  await banco.insert(configuracao).values([
    { chave: 'cobranca.limite', valor: 2 }, // Lucas, 05/10 (GGVP-122, pergunta 6)
    { chave: 'cobranca.intervalo_dias', valor: 3 }, // dias úteis entre as tentativas (Lucas, 02/10; GGVP-94)
    // GGVP-103 CA7 (Q1): o uso do cofre fora do padrão avisa a Sênior. Valores de exemplo, a confirmar com o escritório.
    { chave: 'cofre.alerta.leituras_por_dia', valor: 10 },
    { chave: 'cofre.alerta.hora_inicio', valor: 7 },
    { chave: 'cofre.alerta.hora_fim', valor: 20 },
    // GGVP-104 CA4 (Lucas, 02/10): cliente sumido, 3 tentativas em 10 dias; remarcação de perícia, 1, e sobe para a advogada.
    { chave: 'contato.limite', valor: 3 },
    { chave: 'contato.janela_dias', valor: 10 },
    { chave: 'pericia.remarcacao.limite', valor: 1 },
  ])
  // GGVP-104 (Lucas, 02/10): no LOAS, a ficha de grupo familiar é obrigatória e as três declarações são condicionais.
  // A versão 1 vale desde sempre, para os casos de exemplo já abertos; ao meio-dia, para a data não virar 31/12/1999 no
  // fuso de São Paulo (GGVP-135, P16).
  const kitLoas = [
    ...['documento_de_identidade', 'cpf', 'comprovante_de_residencia', 'cadunico', 'ficha_de_grupo_familiar'].map((tipoDocumento) => ({ tipoDocumento, obrigatorio: true })),
    ...['declaracao_de_moradia', 'declaracao_de_uniao_estavel', 'declaracao_de_separacao_de_fato'].map((tipoDocumento) => ({ tipoDocumento, obrigatorio: false })),
  ]
  await banco
    .insert(kitDocumento)
    .values((['bpc_loas_deficiente', 'bpc_loas_idoso'] as const).flatMap((beneficio) => kitLoas.map((k) => ({ ...k, beneficio, vigenteDesde: new Date('2000-01-01T12:00:00Z') }))))
  const [pu] = await banco.insert(pessoa).values({ nome: 'Ulisses Rocha (exemplo)', situacao: 'cliente', origem: 'exemplo' }).returning()
  const [cu] = await banco.insert(caso).values({ pessoaId: pu.id, beneficio: 'bpc_loas_deficiente', fase: 'administrativa' }).returning()
  await banco.insert(etapa).values({ casoId: cu.id, diagrama: 'D2', passo: 'D2.04', situacao: 'aguardando_externo', aguardando: 'INSS decidir', iniciadaEm: new Date() })
  await banco.insert(exigencia).values({
    casoId: cu.id,
    origem: 'inss',
    descricao: 'Apresentar a inscrição no CadÚnico atualizada e o comprovante de renda de todos que moram na casa. (exemplo)',
    recebidaEm: new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10),
  })
  await banco.insert(tarefa).values([
    { casoId: cu.id, passo: 'D2.04', titulo: 'Trazer a resposta do INSS', perfilDono: 'advogada' },
    { casoId: cu.id, passo: 'D2.05', titulo: 'Tratar exigência do INSS', perfilDono: 'advogada' },
  ])

  // Benefício deferido (GGVP-44): modelo da confirmação, contrato com 30% e um caso com "Prestar contas" e a carta.
  await banco.insert(modelo).values({
    tipo: 'mensagem',
    nome: 'Confirmação da ida ao banco',
    conteudo: 'Olá, {cliente}! Seu benefício foi concedido. A ida ao banco está marcada para {data}, às {hora}, em {local}. {acompanhamento} Qualquer dúvida, fale com o escritório. (modelo de exemplo)',
  })
  const [pv] = await banco.insert(pessoa).values({ nome: 'Vera Lúcia (exemplo)', situacao: 'cliente', origem: 'exemplo' }).returning()
  const [cv] = await banco.insert(caso).values({ pessoaId: pv.id, beneficio: 'bpc_loas_idoso', fase: 'administrativa' }).returning()
  await banco.insert(contrato).values({ casoId: cv.id, situacao: 'assinado', percentualHonorarios: '30.00' })
  const [carta] = await banco
    .insert(documento)
    .values({
      casoId: cv.id,
      pessoaId: pv.id,
      tipo: 'comunicacao_inss',
      chaveArmazenamento: `exemplo/${cv.id}/carta`,
      nomeOriginal: 'Carta de concessão (exemplo).pdf',
      mime: 'application/pdf',
      tamanho: 0,
      hashSha256: 'exemplo',
      origem: 'exemplo',
    })
    .returning()
  await banco.insert(resultadoInss).values({ casoId: cv.id, resultado: 'deferido', dataDecisao: new Date().toISOString().slice(0, 10), documentoId: carta.id, registradoPor: advogada.id })
  await banco.insert(tarefa).values({ casoId: cv.id, passo: 'D2.06', titulo: 'Prestar contas', perfilDono: 'advogada', evidenciaDocumentoId: carta.id })

  // Caso perdido (GGVP-22): improcedente, sem recurso; a advogada escreve e aprova o resumo para o cliente. A semente já
  // abre o resumo, sem passar pelo "Não recorrer" (GGVP-100).
  const [pPerdido] = await banco.insert(pessoa).values({ nome: 'Paulo Mendes (exemplo)', situacao: 'cliente', origem: 'exemplo' }).returning()
  const [cPerdido] = await banco
    .insert(caso)
    .values({ pessoaId: pPerdido.id, beneficio: 'auxilio_incapacidade_temporaria', fase: 'judicial', desfecho: 'improcedente' })
    .returning()
  await abrirExplicacaoDoResultado(banco, cPerdido.id)

  // Sentença improcedente esperando "Vale recorrer?" (GGVP-100): a decisão é da Sênior. Até a "Confirmar desfecho"
  // (D4.02) chamar abrirDecisaoDoRecurso, a semente abre a tarefa. A sentença saiu há 2 dias, para o prazo ficar à frente.
  const [pRecurso] = await banco.insert(pessoa).values({ nome: 'Sérgio Nunes (exemplo)', situacao: 'cliente', origem: 'exemplo' }).returning()
  const [cRecurso] = await banco
    .insert(caso)
    .values({ pessoaId: pRecurso.id, beneficio: 'auxilio_acidente', fase: 'judicial', desfecho: 'improcedente', advogadaResponsavelId: advogada.id })
    .returning()
  const cnjRecurso = '00088883720264036301'
  await banco.insert(identificadorCaso).values({ casoId: cRecurso.id, tipo: 'cnj', valor: cnjRecurso })
  await banco.insert(publicacao).values({
    fonte: 'exemplo',
    numeroCnj: cnjRecurso,
    casoId: cRecurso.id,
    disponibilizadaEm: new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10),
    texto: 'Sentença: julgo improcedente o pedido. O laudo pericial não constatou redução da capacidade para o trabalho habitual. (exemplo)',
    hash: `exemplo-${cRecurso.id}`,
    classe: 'merito',
    revisadaPor: advogada.id,
    revisadaEm: new Date(),
  })
  await abrirDecisaoDoRecurso(banco, cRecurso.id)

  // Vigília do diário (GGVP-26, 30, 34, 37, 74): dois processos judiciais com número CNJ, que a fonte de exemplo
  // reconhece, e a rodada das 08:00 de hoje com falha: reprocessar traz as publicações de exemplo do dia.
  for (const [nome, cnj] of [
    ['Otávio Lima (exemplo)', CNJ_EXEMPLO.exigencia],
    ['Rosa Amaral (exemplo)', CNJ_EXEMPLO.merito],
  ] as const) {
    const [pj] = await banco.insert(pessoa).values({ nome, situacao: 'cliente', origem: 'exemplo' }).returning()
    const [cj] = await banco.insert(caso).values({ pessoaId: pj.id, beneficio: 'bpc_loas_deficiente', fase: 'judicial' }).returning()
    await banco.insert(identificadorCaso).values({ casoId: cj.id, tipo: 'cnj', valor: cnj })
  }
  const hojeBr = new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10)
  const falhaDeExemplo = {
    inicio: momentoDoHorario(hojeBr, '08:00'),
    fim: momentoDoHorario(hojeBr, '08:01'),
    situacao: 'falhou',
    erro: 'tempo esgotado: a fonte não respondeu em 60 s (exemplo)',
  } as const
  // Na homologação o servidor já está no ar e o relógio já criou a rodada das 08:00: ela só passa a ter a falha.
  await banco
    .insert(rodadaVigilia)
    .values({ fonte: 'exemplo', previstaPara: momentoDoHorario(hojeBr, '08:00'), ...falhaDeExemplo })
    .onConflictDoUpdate({ target: [rodadaVigilia.fonte, rodadaVigilia.previstaPara], set: falhaDeExemplo })

  // Exigência do juiz (GGVP-79, 83, 87): uma intimação já lida e classificada, esperando a advogada distribuir.
  const [pp] = await banco.insert(pessoa).values({ nome: 'Paulo Reis (exemplo)', situacao: 'cliente', origem: 'exemplo' }).returning()
  const [cp] = await banco.insert(caso).values({ pessoaId: pp.id, beneficio: 'aposentadoria_pcd', fase: 'judicial' }).returning()
  const cnjPaulo = '00077771820264036301'
  await banco.insert(identificadorCaso).values({ casoId: cp.id, tipo: 'cnj', valor: cnjPaulo })
  const [intimacao] = await banco
    .insert(publicacao)
    .values({
      fonte: 'exemplo',
      numeroCnj: cnjPaulo,
      casoId: cp.id,
      disponibilizadaEm: hojeBr,
      texto: 'Intime-se a parte autora para, em 15 dias, juntar laudo médico atualizado e cópia integral da carteira de trabalho. (exemplo)',
      hash: `exemplo-${cp.id}`,
      classe: 'exigencia',
      revisadaPor: advogada.id,
      revisadaEm: new Date(),
    })
    .returning()
  await banco.transaction((tx) => encaminhar(tx, intimacao, 'exigencia', 15, new Date()))

  // Petição inicial (GGVP-63, 67, 71): o tribunal do protocolo, com o site e o tamanho por arquivo (Q8: o escritório
  // confirma na configuração), e a assinatura padrão da petição. Valores de exemplo.
  await banco.insert(configuracao).values([
    { chave: 'tribunais', valor: [{ nome: 'Justiça Federal da 3ª Região (exemplo)', site: 'https://www.trf3.jus.br/', tamanhoMaximoMb: 10 }] },
    { chave: 'peticao.assinatura', valor: 'Glauco (exemplo)\nAdvogado responsável · OAB/UF 000.000 (exemplo)' },
  ])

  // Laço que passou do limite (GGVP-94): a Documentação cobrou 3 vezes sem retorno, e a cobrança subiu para a Sênior.
  const documentacao = usuarios.find((u) => u.perfis.includes('documentacao'))!
  const daqui = (dias: number) => new Date(Date.now() + dias * 86_400_000).toISOString().slice(0, 10)
  const [pw] = await banco.insert(pessoa).values({ nome: 'Wagner Costa (exemplo)', situacao: 'cliente', origem: 'exemplo' }).returning()
  const [cw] = await banco.insert(caso).values({ pessoaId: pw.id, beneficio: 'bpc_loas_idoso', fase: 'administrativa' }).returning()
  const [xw] = await banco
    .insert(exigencia)
    .values({ casoId: cw.id, origem: 'inss', descricao: 'Apresentar o CadÚnico atualizado. (exemplo)', recebidaEm: daqui(-10), pede: 'documentos', diasInss: 30, prazo: daqui(20), analisadaPor: advogada.id })
    .returning()
  const [cartao] = await banco
    .insert(tarefa)
    .values({ casoId: cw.id, passo: 'D2.05d', titulo: 'Cumprir exigência do INSS', perfilDono: 'documentacao', prazo: daqui(1), tentativas: 3, limiteTentativas: 3, escaladaEm: new Date(), escaladaPara: 'senior' })
    .returning()
  await banco.insert(exigenciaItem).values({ exigenciaId: xw.id, descricao: 'CadÚnico atualizado', perfilResponsavel: 'documentacao', prazo: daqui(15) })
  await banco
    .insert(tentativa)
    .values([-6, -3, -1].map((d) => ({ tarefaId: cartao.id, quando: new Date(Date.now() + d * 86_400_000), canal: 'whatsapp', resultado: 'sem_resposta', registradaPor: documentacao.id })))
  await banco.insert(tarefa).values({ casoId: cw.id, passo: 'D2.05', titulo: 'Cobrança sem retorno: exigência do INSS', perfilDono: 'senior' })
  await banco.insert(etapa).values({ casoId: cw.id, diagrama: 'D2', passo: 'D2.E3', situacao: 'aguardando_externo', aguardando: 'cliente entregar o documento', iniciadaEm: new Date() })

  // Painel de resultado para os sócios (GGVP-75): dez decisões do INSS dos últimos dias, oito do LOAS (dá a taxa) e duas da
  // aposentadoria da pessoa com deficiência (poucos casos no recorte por benefício, com a taxa ao lado, G22); uma extinção sem mérito com
  // a causa, uma procedência e um recebimento de honorários, para os totais do Sócio e do Financeiro. Sem tarefa: não
  // entram em fila nenhuma.
  const financeiro = usuarios.find((u) => u.perfis.includes('financeiro'))!
  const diasAtras = (dias: number) => new Date(Date.now() - dias * 86_400_000)
  for (let i = 0; i < 10; i++) {
    const [pd] = await banco.insert(pessoa).values({ nome: `Cliente decidido ${i + 1} (exemplo)`, situacao: 'cliente', origem: 'exemplo' }).returning()
    const [cd] = await banco
      .insert(caso)
      .values({ pessoaId: pd.id, beneficio: i < 8 ? 'bpc_loas_deficiente' : 'aposentadoria_pcd', fase: 'administrativa', advogadaResponsavelId: advogada.id, criadoEm: diasAtras(120 + i) })
      .returning()
    await banco.insert(resultadoInss).values({ casoId: cd.id, resultado: [2, 5, 9].includes(i) ? 'indeferido' : 'deferido', dataDecisao: daqui(-(2 + i)), registradoPor: advogada.id })
    if (i === 0)
      await banco.insert(prestacaoContas).values({
        casoId: cd.id,
        valorRecebido: '15000.00',
        honorarios: '4500.00',
        valorCliente: '10500.00',
        okAdvogadaPor: advogada.id,
        okAdvogadaEm: diasAtras(2),
        recebidaPor: financeiro.id,
        recebidaEm: diasAtras(1),
        clienteAvisadoEm: diasAtras(1),
      })
  }
  for (const [nome, desfecho, causaDesfecho] of [
    ['Sônia Teles (exemplo)', 'extinto_sem_merito', 'Não cumpriu determinação do juízo (exemplo)'],
    ['Renato Dias (exemplo)', 'procedente_parcial', null],
  ] as const) {
    const [pj] = await banco.insert(pessoa).values({ nome, situacao: 'cliente', origem: 'exemplo' }).returning()
    await banco.insert(caso).values({ pessoaId: pj.id, beneficio: 'bpc_loas_deficiente', fase: 'encerrado', advogadaResponsavelId: advogada.id, desfecho, causaDesfecho, encerradoEm: diasAtras(1) })
  }

  // Acervo (GGVP-55): três processos da base histórica já conferidos pela Sênior, quatro do lote de 02/10 com o desfecho
  // lido esperando a conferência e um que ainda não tem desfecho, para a "Base do acervo" e "Conferir desfechos do lote".
  const base = new Date(Date.UTC(2026, 8, 21, 15))
  const lote = new Date(Date.UTC(2026, 9, 2, 15))
  await banco.insert(processoAcervo).values([
    { numeroCnj: '50001014520234036301', beneficio: 'bpc_loas_deficiente', desfecho: 'procedente_total', desfechoConferidoPor: senior.id, fonte: 'importacao', criadoEm: base },
    { numeroCnj: '50001024520234036301', beneficio: 'bpc_loas_idoso', desfecho: 'improcedente', desfechoConferidoPor: senior.id, fonte: 'importacao', criadoEm: base },
    { numeroCnj: '50001034520234036301', beneficio: 'aposentadoria_pcd', desfecho: 'acordo', desfechoConferidoPor: senior.id, fonte: 'importacao', criadoEm: base },
    { numeroCnj: '00045123320194036301', beneficio: 'bpc_loas_deficiente', desfecho: 'improcedente', fonte: 'lote', criadoEm: lote },
    { numeroCnj: '00077819020204036301', beneficio: 'auxilio_incapacidade_temporaria', desfecho: 'procedente_parcial', fonte: 'lote', criadoEm: lote },
    { numeroCnj: '00011234520184036301', beneficio: 'bpc_loas_idoso', desfecho: 'extinto_sem_merito', fonte: 'lote', criadoEm: lote },
    { numeroCnj: '00099341220214036301', beneficio: 'aposentadoria_pcd', desfecho: 'procedente_total', fonte: 'lote', criadoEm: lote },
    { numeroCnj: '00055551220224036301', beneficio: 'bpc_loas_deficiente', fonte: 'lote', criadoEm: lote },
  ])

  // Juízo identificado (GGVP-64): mais três processos conferidos no JEF de São Paulo (TRF3 · 6301), a unidade dos processos
  // judiciais de exemplo. O do portal tem o protocolo da inicial e a data da decisão, para o tempo até a sentença aparecer.
  // Entram com a data da importação, para não mudar a base do acervo (GGVP-55).
  const [pm] = await banco.insert(pessoa).values({ nome: 'Marta Lopes (exemplo)', situacao: 'cliente', origem: 'exemplo' }).returning()
  const [cm] = await banco
    .insert(caso)
    .values({ pessoaId: pm.id, beneficio: 'bpc_loas_deficiente', fase: 'encerrado', advogadaResponsavelId: advogada.id, desfecho: 'procedente_total', encerradoEm: new Date(Date.UTC(2026, 3, 14, 15)) })
    .returning()
  await banco.insert(identificadorCaso).values({ casoId: cm.id, tipo: 'cnj', valor: '00034567120254036301' })
  const [pi] = await banco.insert(peticao).values({ casoId: cm.id, tipo: 'inicial' }).returning()
  const [vi] = await banco.insert(peticaoVersao).values({ peticaoId: pi.id, numero: 1, conteudo: 'Petição inicial (exemplo)', hash: 'exemplo', geradaPor: advogada.nome, aprovadaPor: advogada.id }).returning()
  await banco.insert(protocoloJudicial).values({ peticaoVersaoId: vi.id, tribunal: 'TRF3', numero: '0003456-71.2025.4.03.6301', protocoladoEm: new Date(Date.UTC(2025, 3, 7, 15)), protocoladoPor: advogada.id })
  await banco.insert(processoAcervo).values([
    { casoId: cm.id, beneficio: 'bpc_loas_deficiente', desfecho: 'procedente_total', desfechoConferidoPor: senior.id, dataDecisao: '2026-04-14', fonte: 'portal', criadoEm: base },
    { numeroCnj: '50001048820234036301', beneficio: 'bpc_loas_deficiente', desfecho: 'improcedente', desfechoConferidoPor: senior.id, fonte: 'importacao', criadoEm: base },
    { numeroCnj: '50001057320234036301', beneficio: 'aposentadoria_pcd', desfecho: 'procedente_parcial', desfechoConferidoPor: senior.id, fonte: 'importacao', criadoEm: base },
  ])
  // Juízo identificado, parte 2: a vara e o juiz conferidos no processo da Marta e duas decisões de mérito no mesmo JEF,
  // para a IA tirar os entendimentos recorrentes (a rodada lê sozinha quando há a chave da IA).
  await banco.update(caso).set({ vara: '1ª Vara-Gabinete do JEF de São Paulo (exemplo)', juiz: 'Dra. Helena Prates (exemplo)' }).where(eq(caso.id, cm.id))
  const [pr] = await banco.insert(pessoa).values({ nome: 'Rui Campos (exemplo)', situacao: 'cliente', origem: 'exemplo' }).returning()
  const [cr] = await banco.insert(caso).values({ pessoaId: pr.id, beneficio: 'bpc_loas_deficiente', fase: 'judicial', advogadaResponsavelId: advogada.id }).returning()
  await banco.insert(identificadorCaso).values({ casoId: cr.id, tipo: 'cnj', valor: '00045678220254036301' })
  const sentenca = (resultado: string) =>
    `JEF de São Paulo, 1ª Vara-Gabinete. Juíza Federal Dra. Helena Prates. Sentença: ${resultado} o pedido de BPC. (exemplo)`
  await banco.insert(publicacao).values([
    {
      fonte: 'exemplo',
      casoId: cm.id,
      numeroCnj: '00034567120254036301',
      disponibilizadaEm: '2026-04-14',
      classe: 'merito',
      hash: 'exemplo-merito-marta',
      texto: sentenca('o estudo social atualizado comprovou que a renda da casa não cobre os gastos com o tratamento. JULGO PROCEDENTE'),
    },
    {
      fonte: 'exemplo',
      casoId: cr.id,
      numeroCnj: '00045678220254036301',
      disponibilizadaEm: '2026-06-02',
      classe: 'merito',
      hash: 'exemplo-merito-rui',
      texto: sentenca('sem estudo social atualizado, não há prova da renda da casa. JULGO IMPROCEDENTE'),
    },
  ])

  // Documentação médica no servidor (GGVP-132): o laudo de LOAS da Lúcia já foi lido e classificado e espera o parecer
  // do Jurídico. A IA simulada lê pelo nome do arquivo: "incompleto" não cobre nenhum item do roteiro.
  const [pl] = await banco.insert(pessoa).values({ nome: 'Lúcia Prado (exemplo)', situacao: 'cliente', origem: 'exemplo', telefone: '11955550101' }).returning()
  const [cl] = await banco.insert(caso).values({ pessoaId: pl.id, beneficio: 'bpc_loas_deficiente', fase: 'atendimento' }).returning()
  const [laudo] = await banco
    .insert(documento)
    .values({ casoId: cl.id, pessoaId: pl.id, tipo: 'laudo', sensivel: true, chaveArmazenamento: `exemplo/${cl.id}/laudo`, nomeOriginal: 'Laudo médico incompleto (exemplo).pdf', mime: 'application/pdf', tamanho: 0, hashSha256: 'exemplo', origem: 'exemplo' })
    .returning()
  await banco.insert(documentoMedico).values({ documentoId: laudo.id, tipo: 'laudo', dataEmissao: '2026-09-15', profissional: 'Dra. Clínica (exemplo)' })
}
