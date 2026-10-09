// O chat do portal (GGVP-82): regras puras, sem React. O que o pedido quer, o portão que ele atravessa, quem fica com a
// tarefa, o título dela e o que é de outro perfil. O servidor de exemplo e, depois, o de verdade usam as mesmas; nenhuma
// delas é resposta de modelo.

/** Sem acento e em minúsculas, para comparar. */
export const semAcento = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

export type Intencao =
  | 'senha'
  | 'honorarios'
  | 'escolher-perito'
  | 'jurimetria'
  | 'pericias-semana'
  | 'pericias-marcar'
  | 'cliente-ligou'
  | 'dica-pericia'
  | 'prestacoes'
  | 'limite'
  | 'protocolar'
  | 'aprovar'
  | 'avisar-cliente'
  | 'criar-tarefa'
  | 'pedir-peca'
  | 'marcar'
  | 'subir-acervo'
  | 'valor'
  | 'consulta'

/** O que o pedido quer, na ordem em que as regras se aplicam: as recusas e os portões antes das ações. */
export function entenderPedido(texto: string): Intencao {
  const t = semAcento(texto)
  if (/senha/.test(t) && /(gov|meu inss|cofre)/.test(t)) return 'senha'
  if (/honorario|quanto (ele|ela|o cliente|a cliente)? ?(vai )?receb|calcul\w* (o )?(valor|atrasado)/.test(t)) return 'honorarios'
  if (/(avalia|jurimetria|costuma|taxa|procedencia)/.test(t) && /(perito|juizo|juiz|vara|juizado|\bdra?\.? )/.test(t)) return 'jurimetria'
  if (/(escolh|sugir|sugere|sugest|indica|qual)\w*.{0,20}\bperito/.test(t)) return 'escolher-perito'
  if (/pericias?\b.*\bsemana/.test(t)) return 'pericias-semana'
  if (/pericias?\b.*\bmarcar|\bpara marcar\b/.test(t)) return 'pericias-marcar'
  if (/prestac(ao|oes) de contas?.*(cheg|receb|tem|hoje)|prestac\w* recebid/.test(t)) return 'prestacoes'
  if (/\bprotocol/.test(t)) return 'protocolar'
  if (/\b(aprov|assin|despach)\w*\b.*\b(parecer|peticao|despacho|exigencia|pedido|manifestac|minuta)/.test(t)) return 'aprovar'
  if (!/\btarefa\b/.test(t) && /\b(avisa|avisar|avise|manda|mandar|envia|enviar|fala|falar|escreve|escrever)\b.{0,30}\b(cliente|mensagem|whatsapp)\b/.test(t)) return 'avisar-cliente'
  if (/\b(cri|abr)\w* (uma |a )?tarefa|\btarefa (para|pra|pro)\b/.test(t)) return 'criar-tarefa'
  if (/\b(faz|faca|fazer|ger|escrev|redig|pede|pedir|peca|monta)\w*\b.*\b(peticao|peca|manifestac|minuta|recurso|quesitos|impugnac)/.test(t)) return 'pedir-peca'
  if (/\b(estour|limite)/.test(t)) return 'limite'
  if (/\bacervo\b/.test(t)) return 'subir-acervo'
  if (/\bdica\b|orientac/.test(t)) return 'dica-pericia'
  if (/\blig(ou|aram)\b|\bligac/.test(t)) return 'cliente-ligou'
  if (/\bmarc(a|ar|ou|ue)\b/.test(t)) return 'marcar'
  if (/\b(valor|valores|quanto|rpv|atrasados|renda|prestac)/.test(t)) return 'valor'
  return 'consulta'
}

/** O portão que o pedido atravessa (CA4), com o que falta cumprir. O chat recusa e mostra o portão. */
export function portaoDoPedido(
  intencao: Intencao,
  texto: string,
  caso?: { fase?: 'administrativa' | 'judicial'; aprovadoPelaSenior?: boolean },
): { portao?: string; texto: string } | null {
  const t = semAcento(texto)
  switch (intencao) {
    case 'senha':
      return { portao: 'G9', texto: 'A senha do gov.br fica só no cofre e o chat nunca a devolve (G9). Quem precisa usa pelo cofre, no passo do Meu INSS.' }
    case 'honorarios':
      return {
        portao: 'G19',
        texto: 'Não calculo valor nem honorários: o valor vem do comprovante, e regra numérica é código com teste, nunca resposta da IA (G19). O percentual de honorários está no contrato.',
      }
    case 'escolher-perito':
      return { texto: 'A IA não escolhe nem sugere o perito: quem nomeia é o INSS ou o juízo. Quando o nome chegar, identifique o perito na página do processo, em um clique.' }
    case 'avisar-cliente':
      return {
        portao: 'G8',
        texto: 'O chat não fala com o cliente. O aviso do resultado só sai depois do OK da advogada na prestação de contas (G8), pela tela de mensagens ao cliente.',
      }
    case 'aprovar': {
      if (/parecer/.test(t)) return { portao: 'G17', texto: 'A IA nunca aprova parecer: o parecer médico só vale confirmado por uma pessoa do Jurídico (G17).' }
      if (/despach/.test(t)) return { portao: 'G4', texto: 'A IA nunca despacha: quem despacha o caso é a sênior (G4).' }
      if (/exigencia/.test(t)) return { portao: 'G5', texto: 'A IA nunca decide a exigência: quem analisa e define o setor são os advogados (G5).' }
      if (/pedido/.test(t)) return { portao: 'G2', texto: 'A IA nunca aprova o pedido: falta o OK do sênior (G2).' }
      return { portao: 'G6', texto: 'A IA nunca aprova nem assina petição: a advogada assina o conteúdo (G6).' }
    }
    case 'protocolar':
      if (caso?.fase === 'judicial' || /justica|juizo|vara/.test(t)) {
        return { portao: 'G7', texto: 'Não protocolo na Justiça pelo chat: faltam as três travas conferidas por uma pessoa: Tema 350, pacote completo e CPF (G7).' }
      }
      if (!caso?.aprovadoPelaSenior) return { portao: 'G2', texto: 'Não dá para protocolar: falta o OK do sênior (G2). Nada vai ao INSS sem ele.' }
      return null
    default:
      return null
  }
}

/** A lista fixa de ações de cada perfil (Figma "Glossário · títulos das tarefas", 2110:2). O título é "cliente · ação". */
export const ACOES_DO_PERFIL = {
  atendimento: [
    'Receber quem chegou',
    'Receber documento',
    'Conferir documento',
    'Confirmar agendamento',
    'Renovar senha do gov.br',
    'Preencher ficha',
    'Preencher segunda ficha',
    'Preparar contrato',
    'Colher assinatura',
    'Conferir contrato',
    'Entregar cópia do contrato',
    'Conferir checklist',
    'Cobrar documento',
    'Liberar ao Jurídico',
    'Recontatar lead',
    'Registrar fechamento',
    'Registrar conversa',
    'Agendar ida ao banco',
    'Avisar resultado',
    'Explicar resultado',
    'Cumprir pendência',
    'Cumprir exigência do juiz',
    'Responder exigência do INSS',
    'Reunir documentos da perícia',
  ],
  'juridico-adm': ['Protocolar no INSS', 'Marcar perícia', 'Remarcar perícia', 'Orientar para a perícia', 'Registrar comparecimento'],
  advogada: [
    'Preparar entrevista',
    'Analisar ficha',
    'Fazer entrevista',
    'Cadastrar lead',
    'Definir benefício',
    'Calcular tempo e pontos',
    'Dar parecer médico',
    'Analisar laudo novo',
    'Decidir perícia',
    'Vigiar Meu INSS',
    'Responder exigência do INSS',
    'Registrar indeferimento',
    'Pedir petição',
    'Conferir petição',
    'Protocolar na Justiça',
    'Ler publicação',
    'Analisar exigência do juiz',
    'Manifestar no processo',
    'Conferir resultado da perícia',
    'Confirmar desfecho',
    'Decidir recurso',
    'Acompanhar pagamento',
    'Prestar contas',
    'Aprovar prestação de contas',
    'Ligar para o cliente',
  ],
  senior: ['Aprovar pedido', 'Despachar caso', 'Decidir cobrança', 'Revisar estudo de caso', 'Reprocessar vigília', 'Casar publicação', 'Alimentar acervo'],
  financeiro: ['Lançar prestação de contas', 'Confirmar recebimento'],
  // GGVP-96: a Documentação, o líder e o Sócio caíam na lista do Atendimento. Cada um fica com o que faz pela matriz: a
  // Documentação, a raia DOCUMENTAÇÃO · ADM; o líder, a do Atendimento sem o que a matriz dá a outro perfil (a ida ao banco
  // é do Financeiro; liberar, a exigência do INSS e os documentos da perícia, da Documentação); o Sócio só lê.
  documentacao: [
    'Receber documento',
    'Conferir documento',
    'Conferir checklist',
    'Cobrar documento',
    'Liberar ao Jurídico',
    'Cumprir pendência',
    'Cumprir exigência do juiz',
    'Responder exigência do INSS',
    'Reunir documentos da perícia',
  ],
  'atendimento-lider': [
    'Receber quem chegou',
    'Receber documento',
    'Conferir documento',
    'Confirmar agendamento',
    'Renovar senha do gov.br',
    'Preencher ficha',
    'Preencher segunda ficha',
    'Preparar contrato',
    'Colher assinatura',
    'Conferir contrato',
    'Entregar cópia do contrato',
    'Conferir checklist',
    'Cobrar documento',
    'Recontatar lead',
    'Registrar fechamento',
    'Registrar conversa',
    'Avisar resultado',
    'Explicar resultado',
    'Cumprir pendência',
    'Cumprir exigência do juiz',
  ],
  socio: [],
} as const

export type GrupoDoPerfil = keyof typeof ACOES_DO_PERFIL

/** O grupo da lista fixa de cada perfil; sem perfil conhecido, o Atendimento. */
export function grupoDoPerfil(perfil: string | undefined): GrupoDoPerfil {
  return perfil && Object.keys(ACOES_DO_PERFIL).includes(perfil) ? (perfil as GrupoDoPerfil) : 'atendimento'
}

/** A ação da lista fixa de quem vai fazer que o pedido cita (CA9): o verbo pesa mais, o objeto desempata. Nenhuma: nulo. */
export function acaoDaLista(texto: string, grupo: GrupoDoPerfil): string | null {
  const t = semAcento(texto)
  let melhor: { acao: string; pontos: number } | null = null
  for (const acao of ACOES_DO_PERFIL[grupo]) {
    const [verbo, ...objeto] = semAcento(acao).split(' ')
    let pontos = new RegExp(`\\b${verbo.slice(0, Math.min(5, verbo.length - 1))}`).test(t) ? 2 : 0
    for (const palavra of objeto) if (palavra.length > 3 && t.includes(palavra.slice(0, 6))) pontos++
    if (pontos >= 2 && (!melhor || pontos > melhor.pontos)) melhor = { acao, pontos }
  }
  return melhor?.acao ?? null
}

/** O título da tarefa (CA9): o nome do cliente e a ação; sem cliente, o contexto. */
export const tituloDaTarefa = (cliente: string, acao: string) => `${cliente} · ${acao}`

export type Pessoa = { nome: string; setor: string }

/** "Dra. Paula (exemplo)" → "paula". */
const primeiroNome = (nome: string) =>
  semAcento(nome)
    .replace(/\(.*\)/, '')
    .replace(/\b(dra?|sra?)\.?\s/g, '')
    .trim()
    .split(/\s+/)[0]

/** O setor citado no pedido, como os setores do escritório se chamam. */
export function setorCitado(texto: string): string | null {
  const t = semAcento(texto)
  if (/documentac/.test(t)) return 'Documentação · ADM'
  if (/financeiro/.test(t)) return 'Financeiro'
  if (/atendimento/.test(t)) return 'Atendimento'
  if (/juridico|advogad|senior|estagiari/.test(t)) return 'Jurídico'
  return null
}

export type Responsavel =
  | { tipo: 'pessoa'; pessoa: Pessoa }
  | { tipo: 'perguntar-setor'; setor: string; opcoes: Pessoa[] }
  | { tipo: 'perguntar-quem'; opcoes: Pessoa[] }

/**
 * O responsável da tarefa (CA7; Lucas e Pedro, 07/10): se o pedido cita a pessoa, é ela; se cita só o setor, pergunta
 * quem do setor; se não cita ninguém, pergunta quem é. Quem pediu só fica com a tarefa quando ele mesmo se indica.
 */
export function responsavelDaTarefa(texto: string, quemPediu: Pessoa, pessoas: Pessoa[]): Responsavel {
  const t = semAcento(texto)
  if (/\b(para mim|pra mim|comigo|eu mesm[ao]|minha tarefa|eu fico)\b/.test(t)) return { tipo: 'pessoa', pessoa: quemPediu }
  const citada = pessoas.find((p) => new RegExp(`\\b${primeiroNome(p.nome)}\\b`).test(t))
  if (citada) return { tipo: 'pessoa', pessoa: citada }
  const setor = setorCitado(texto)
  if (setor) return { tipo: 'perguntar-setor', setor, opcoes: pessoas.filter((p) => p.setor === setor) }
  return { tipo: 'perguntar-quem', opcoes: pessoas }
}

/**
 * Pedido fora do perfil (CA8): de quem é e a ação da lista fixa de quem pode. Nulo quando o perfil pode pedir.
 * Petição e peça: a advogada (ou a sênior); perícia: o Jurídico administrativo; acervo: a sênior; comprovante de RPV: o Financeiro.
 */
export function foraDoPerfil(intencao: Intencao, perfil: string | undefined): { dono: GrupoDoPerfil; quem: string; acao: string } | null {
  const grupo = grupoDoPerfil(perfil)
  if (intencao === 'pedir-peca' && grupo !== 'advogada' && grupo !== 'senior') return { dono: 'advogada', quem: 'da advogada do caso', acao: 'Pedir petição' }
  if (intencao === 'marcar' && grupo !== 'juridico-adm' && grupo !== 'advogada') return { dono: 'juridico-adm', quem: 'do Jurídico administrativo', acao: 'Marcar perícia' }
  if (intencao === 'subir-acervo' && grupo !== 'senior') return { dono: 'senior', quem: 'da sênior', acao: 'Alimentar acervo' }
  return null
}

/** As sugestões do chat de cada perfil (Figma: Centrais 11:2, 59:449, 59:609, 59:863, 2051:173). Clicar preenche, não envia. */
export const SUGESTOES_DO_PERFIL: Record<GrupoDoPerfil, string[]> = {
  atendimento: ['O cliente me ligou: qual a próxima tarefa?', 'Subir laudo novo', 'Documentos que faltam', 'Pedir uma peça'],
  advogada: ['Resumo do caso', 'Criar tarefa', 'Perícias da semana', 'Como o perito avalia?', 'Gerar peça'],
  senior: ['O que estourou o limite?', 'Criar tarefa', 'Casos para conferir', 'Subir no acervo'],
  financeiro: ['Prestações recebidas', 'Documento novo', 'Resumo do cliente'],
  'juridico-adm': ['Perícias para marcar', 'O cliente me ligou', 'Subir comprovante do INSS', 'Dica para a perícia'],
  documentacao: ['Documentos que faltam', 'Criar tarefa'],
  'atendimento-lider': ['O cliente me ligou: qual a próxima tarefa?', 'Subir laudo novo', 'Documentos que faltam', 'Criar tarefa'],
  socio: ['Prestações recebidas', 'Criar tarefa'],
}

/** O que o arquivo anexado é, pelo nome e pelo pedido (CA12). IA simulada: as pistas do nome, como a leitura do D1. */
export type TipoDoAnexo = 'laudo' | 'comprovante-inss' | 'comprovante-rpv' | 'acervo' | 'documento'

export function tipoDoAnexo(texto: string, arquivos: string[]): TipoDoAnexo {
  const t = semAcento(`${texto} ${arquivos.join(' ')}`)
  if (arquivos.length > 1 && /acervo|antigos|processos/.test(t)) return 'acervo'
  if (/\brpv\b|precatorio|alvara|comprovante de (pagamento|deposito)/.test(t)) return 'comprovante-rpv'
  if (/comprovante|agendamento/.test(t) && /pericia|inss|avaliac/.test(t)) return 'comprovante-inss'
  if (/laudo|atestado|relatorio medico|exame/.test(t)) return 'laudo'
  if (/acervo/.test(t)) return 'acervo'
  return 'documento'
}

/** Os portões de governança (docs/requisitos/portoes-governanca.md), para o Suporte explicar quando a pessoa pergunta. */
export const PORTOES: Record<string, string> = {
  G1: 'Nada vai para o INSS sem o checklist completo: documentos do benefício, todas as assinaturas e as datas preenchidas.',
  G2: 'Nada é protocolado sem o OK do sênior.',
  G3: 'A IA sugere o benefício, mas se a advogada citou um, prevalece o dela.',
  G4: 'A IA analisa o indeferimento e sugere, mas quem despacha é a sênior.',
  G5: 'Quem analisa a exigência do juiz e define o setor são os advogados, não a IA.',
  G6: 'A advogada assina o conteúdo da petição; se não está boa, a IA faz outra versão.',
  G7: 'Três travas antes de protocolar na Justiça: Tema 350, pacote completo e CPF conferido.',
  G8: 'O aviso ao cliente só nasce depois do OK da advogada na prestação de contas.',
  G9: 'A senha do gov.br vai para o cofre; nunca fica em texto transcrito nem em campo de texto.',
  G10: 'A conversa gravada começa com o aviso de gravação.',
  G11: 'A orientação da perícia nunca orienta a esconder ou mudar a situação real.',
  G12: 'Na dúvida, o prazo é contado pelo lado mais seguro.',
  G13: 'A vigília roda 3 vezes por dia; rodada que falhou dispara alarme.',
  G14: 'A IA só muda o que foi dito na conversa; o valor antigo fica no histórico e o Jurídico pode desfazer.',
  G15: 'Toda cobrança ou remarcação tem limite; passou dele, sobe para a sênior (ou o Jurídico, na perícia).',
  G16: 'Todo lead que não vira cliente fica com o motivo registrado.',
  G17: 'O caso só é liberado, aprovado para o INSS ou tem petição pedida com parecer médico "Suficiente" confirmado por pessoa; só a sênior dispensa.',
  G18: 'Documento que contradiz o requisito do benefício bloqueia o caso.',
  G19: 'Regras numéricas são calculadas por código com teste, nunca pela IA.',
  G20: 'A orientação ao médico ou ao cliente lista o que o documento deve abordar, sem sugerir diagnóstico, CID, grau, conclusão nem frase pronta.',
  G21: 'Toda exigência vira item com prazo, responsável e prova; sem prova em todos os itens, não se manifesta.',
  G22: 'Jurimetria: toda a do acervo conta, sem amostra mínima (Lucas, 06/10); o portão está em revisão.',
}

/** "O que é o G8?": o portão citado na pergunta. */
export function portaoCitado(texto: string): string | null {
  const g = /\bG(\d{1,2})\b/i.exec(texto)?.[1]
  return g && PORTOES[`G${Number(g)}`] ? `G${Number(g)}` : null
}
