// EXEMPLO. Semente do servidor de exemplo, falsa de propósito: nomes com "Exemplo" e telefones
// (11) 90000-00xx. São as pessoas da Central (atendimento.ts), para seguir uma pessoa do balcão
// até o benefício no localhost. Sai quando o servidor de verdade existir.
import { isoParaData } from '../campos.ts'
import { somarDias } from '../regras/agenda.ts'
import type { Cnis, EnvioDaFicha, Ficha, Gravacao, InformacaoExtraida, LoteDigitalizado, PastaDrive, Processo, RespostasDaSegundaFicha, Setor, Trecho } from './tipos.ts'

/** O único CPF da semente: o CPF de teste público 000.000.001-91, para o caso "CPF repetido". */
export const CPF_DE_TESTE = '00000000191'

/** Telefone de exemplo número n: (11) 90000-000n. */
export const telefoneDeExemplo = (n: number) => `1190000${String(n).padStart(4, '0')}`

function pessoa(n: number, id: string, nome: string, resto: Partial<Ficha>): Ficha {
  return {
    id,
    nome,
    situacao: 'cliente',
    desde: '01/2026',
    telefone: telefoneDeExemplo(n),
    senhaGov: { situacao: 'sem-senha' },
    fichaAtendimentoPreenchida: true,
    processos: [],
    agendamentos: [],
    contatos: [],
    documentos: [],
    transcricoes: 0,
    historico: [],
    pastaId: `drive-${id}`,
    arquivos: [],
    ...resto,
  }
}

function cliente(n: number, id: string, nome: string, processos: Omit<Processo, 'id'>[], resto: Partial<Ficha> = {}): Ficha {
  return pessoa(n, id, nome, { processos: processos.map((p, i) => ({ ...p, id: `${id}-${i + 1}` })), ...resto })
}

/** As fichas de exemplo. `hoje` entra nos agendamentos do dia. */
export function fichasDeExemplo(hoje: string): Ficha[] {
  return [
    cliente(
      1,
      'antonio-exemplo',
      'Antônio Exemplo',
      [
        {
          numero: '0000001-00.2025.4.03.0000',
          beneficio: 'incapacidade-permanente',
          etapa: 'Judicial · exigência',
          proximaAcao: 'cobrar as notas do produtor e a certidão do sindicato (D1.23)',
          prazo: 'vence em 2 dias',
          urgente: true,
        },
      ],
      {
        cpf: CPF_DE_TESTE,
        desde: '03/2023',
        idade: 62,
        estadoCivil: 'Casado',
        cidadeUf: 'São Paulo / SP',
        profissao: 'Trabalhador rural (2018–2020) · porteiro (2021–2025)',
        comoChegou: 'indicacao',
        indicadoPor: 'Maria Exemplo',
        contatoPreferido: 'WhatsApp, à tarde',
        // Conferidos na transcrição da entrevista de 10/07 (gravacoesDeExemplo, GGVP-46).
        contatoApoio: `filha Renata · (11) 90000-0023`,
        checklist: ['Notas do produtor rural (2018–2020)', 'Certidão do sindicato rural', 'CNIS atualizado'],
        observacoes: 'Prefere atendimento por vídeo.',
        resumo: 'trabalhador rural aposentando · São Paulo/SP',
        senhaGov: { situacao: 'no-cofre', atualizadaEm: '2025-07-12T14:00:00.000Z', por: 'Atendimento', funcionouEm: '2026-09-15' },
        laudoNovoEm: '2026-09-29',
        contatos: [
          { data: '2026-09-27', canal: 'WhatsApp', texto: 'Avisado da exigência do juiz; vai buscar as notas do produtor.' },
          { data: '2025-07-12', canal: 'Presencial', texto: 'Assinatura do contrato.' },
        ],
        documentos: [
          { nome: 'RG', detalhe: 'frente e verso' },
          { nome: 'CPF', detalhe: 'ok' },
          { nome: 'Comp. residência', detalhe: '08/2026' },
          { nome: 'CNIS', detalhe: '30/07' },
          { nome: 'CTPS', detalhe: 'digitalizada' },
          { nome: 'Procuração', detalhe: '26/09' },
        ],
        documentacaoMedica:
          '3 laudos recebidos · parecer "Suficiente" confirmado pelo Jurídico (G17). O conteúdo dos laudos não é exibido aqui.',
        transcricoes: 2,
      },
    ),
    pessoa(2, 'josefa-exemplo', 'Josefa Exemplo', {
      situacao: 'lead',
      desde: '09/2026',
      beneficioInteresse: 'loas-idoso',
      fichaAtendimentoPreenchida: false,
      agendamentos: [{ id: 'josefa-entrevista', data: hoje, hora: '15:30', oQue: 'Entrevista', com: 'Dra. Paula', tipo: 'presencial', duracao: 45 }],
      contatos: [{ data: '2026-09-29', canal: 'WhatsApp', texto: 'Perguntou do LOAS; marcou a entrevista.' }],
    }),
    // Mãe e filha com o mesmo celular (CA9).
    pessoa(3, 'natalia-exemplo', 'Natália Exemplo', {
      situacao: 'lead',
      desde: '10/2026',
      beneficioInteresse: 'incapacidade-temporaria',
      contatos: [{ data: '2026-10-02', canal: 'WhatsApp', texto: 'Quer saber do auxílio por incapacidade.' }],
      // Entrevista de ontem que ninguém marcou como realizada ou falta: fica "confirmar se aconteceu" (GGVP-123, CA8).
      agendamentos: [{ id: 'natalia-entrevista', data: somarDias(hoje, -1), hora: '10:30', oQue: 'Entrevista', com: 'Dra. Paula', tipo: 'video', duracao: 45 }],
      pastaId: undefined,
    }),
    cliente(3, 'nair-exemplo', 'Nair Exemplo', [
      { beneficio: 'aposentadoria-idade', etapa: 'Contrato · assinatura', proximaAcao: 'colher a assinatura' },
    ]),
    cliente(4, 'maria-exemplo', 'Maria Exemplo', [
      // Épico GGVP-10: a perícia da Maria nasce de dados/pericia.ts, com a data e as tarefas dela; o Atendimento não age nela.
      { beneficio: 'incapacidade-temporaria', etapa: 'Administrativo · perícia' },
    ]),
    // Dois benefícios, dois processos, uma ficha.
    cliente(
      5,
      'cleide-exemplo',
      'Cleide Exemplo',
      [
        { beneficio: 'aposentadoria-pcd', etapa: 'Contrato · conferência', proximaAcao: 'conferir o contrato', prazo: 'hoje' },
        { beneficio: 'aposentadoria-especial', etapa: 'Contrato assinado em 12/07', proximaAcao: 'entregar a cópia do contrato', prazo: 'hoje', urgente: true },
      ],
      { agendamentos: [{ id: 'cleide-retirada', data: hoje, hora: '16:00', oQue: 'Retirada da cópia do contrato', tipo: 'presencial', duracao: 30 }] },
    ),
    // Ficha criada pela automação do scanner, que não lê telefone (GGVP-17, CA15).
    cliente(6, 'marta-exemplo', 'Marta Exemplo', [{ beneficio: 'loas-deficiente', etapa: 'Benefício deferido', proximaAcao: 'agendar a ida ao banco' }], {
      telefone: '',
      origem: 'scanner',
    }),
    cliente(10, 'rita-exemplo', 'Rita Exemplo', [
      { beneficio: 'loas-deficiente', etapa: 'Documentação · conferência', proximaAcao: 'conferir os documentos do balcão', prazo: 'hoje', urgente: true },
    ]),
    cliente(
      7,
      'sebastiao-exemplo',
      'Sebastião Exemplo',
      [{ beneficio: 'auxilio-acidente', etapa: 'Documentação · liberar ao Jurídico', proximaAcao: 'conferir a documentação', prazo: 'amanhã' }],
      // GGVP-47: os documentos pessoais do kit do Auxílio-Acidente (Figma 10:264).
      { documentos: [{ nome: 'RG', detalhe: 'frente e verso' }, { nome: 'CPF', detalhe: 'ok' }, { nome: 'CNIS', detalhe: '05/2026' }] },
    ),
    cliente(8, 'pedro-exemplo', 'Pedro Exemplo', [
      { beneficio: 'loas-idoso', etapa: 'Administrativo · exigência do INSS', proximaAcao: 'responder a exigência', prazo: 'vence em 2 dias', urgente: true },
    ]),
    cliente(9, 'lucia-exemplo', 'Lúcia Exemplo', [
      { beneficio: 'pensao-morte', etapa: 'Judicial · sentença procedente', proximaAcao: 'avisar a cliente depois do OK da advogada', prazo: 'hoje', urgente: true },
    ]),
    // GGVP-50: a criança do LOAS Deficiente, menor de 16 anos pela data de nascimento. Sem CPF: a semente não inventa número.
    cliente(
      11,
      'davi-exemplo',
      'Davi Exemplo',
      [{ beneficio: 'loas-deficiente', etapa: 'Jurídico · parecer médico', proximaAcao: 'conferir o laudo com o roteiro infantil' }],
      { nascimento: '2019-04-12' },
    ),
  ]
}

/** Pastas do Drive simulado: uma por ficha e duas com o mesmo nome, para o portal perguntar qual usar. */
export function pastasDeExemplo(fichas: Ficha[]): PastaDrive[] {
  return [
    ...fichas.filter((f) => f.pastaId).map((f) => ({ id: f.pastaId!, nome: f.nome, caminho: 'Clientes', cpf: f.cpf })),
    { id: 'drive-rosa-1', nome: 'Rosa Exemplo', caminho: 'Clientes/2024' },
    { id: 'drive-rosa-2', nome: 'ROSA EXEMPLO', caminho: 'Scanner/antigos' },
  ]
}

/**
 * O que o n8n mandaria ao portal depois de passar a pilha do cliente no scanner (GGVP-17). Quem tem pasta sai
 * "arquivado"; Antônio vem com página em branco ("CONFERIR O PAPEL"); quem não tem pasta nem CPF no papel vai
 * para "A REVISAR", com o motivo da planilha "Painel da digitalização".
 */
export function loteDeExemplo(ficha: Ficha, hoje: string, loteId: string): LoteDigitalizado {
  const arquivos = [
    { nome: `Comprovante de residencia - ${ficha.nome} - ${hoje}.pdf`, tipo: 'comprovante-residencia', paginas: 1 },
    { nome: `CNIS - ${ficha.nome} - ${hoje}.pdf`, tipo: 'cnis', paginas: 3 },
  ]
  if (!ficha.pastaId) {
    const motivo = 'não existe pasta parecida, mas o CPF dessa pessoa não está escrito no papel'
    return { loteId, status: 'revisao', motivo, conferirPapel: false, arquivos }
  }
  const antonio = ficha.id === 'antonio-exemplo'
  const motivo = antonio ? 'esse CPF aparece escrito dentro de documento que já está nessa pasta' : 'nome igual'
  return { loteId, status: 'arquivado', motivo, fichaId: ficha.id, conferirPapel: antonio, arquivos }
}

/**
 * O que a IA leria da ficha de atendimento em papel (GGVP-24, CA14): o que a ficha já tem e os exemplos do Figma (10:54).
 * CPF e data de nascimento que a ficha não tem ficam "não lidos": a semente não inventa CPF. A senha escrita no papel vai
 * para o cofre (CA15); o valor nunca aparece aqui.
 */
export function leituraDeExemplo(ficha: Ficha): { campos: Partial<EnvioDaFicha>; naoLidos: (keyof EnvioDaFicha)[]; senhaLida: boolean } {
  const campos: Partial<EnvioDaFicha> = {
    nome: ficha.nome,
    ...(ficha.cpf && { cpf: ficha.cpf }),
    ...(ficha.nascimento && { nascimento: isoParaData(ficha.nascimento) ?? undefined }),
    ...(ficha.telefone && { telefone: ficha.telefone }),
    pessoasNaCasa: 3,
    beneficioInteresse: ficha.beneficioInteresse ?? 'nao-sei',
    ultimaAtividade: 'auxiliar de limpeza, com carteira, até 05/2026',
    semTrabalharDesde: '06/2026',
    pedidosAoInss: 'auxílio negado em 08/2026',
  }
  const naoLidos = (['cpf', 'nascimento', 'telefone', 'endereco'] as const).filter((c) => campos[c] === undefined)
  return { campos, naoLidos, senhaLida: true }
}

/**
 * O que a IA leria da segunda ficha em papel, a de auxílio acidentário (GGVP-28, CA6). Respostas de exemplo, sem número
 * de benefício nem CID (a semente não inventa número de documento). A senha do Meu INSS vai para o cofre (CA7).
 */
export function leituraDaSegundaFicha(): { respostas: Partial<RespostasDaSegundaFicha>; senhaLida: boolean } {
  return {
    respostas: {
      empresa: 'Exemplo Indústria Ltda',
      funcao: 'auxiliar de produção',
      vinculo: 'CLT',
      acidenteLocal: 'na linha de produção',
      cat: 'sim',
      boletim: 'nao',
      deTrabalho: 'sim',
      parteDoCorpo: 'mão',
      lado: 'direito',
      doencas: 'dor e perda de força na mão',
      tratamento: 'fisioterapia',
      cirurgia: 'nao',
      laudos: '1 laudo do ortopedista',
      historico: 'Prendeu a mão na máquina e ficou afastada; desde então não consegue fazer força.',
    },
    senhaLida: true,
  }
}

/** Uma fala da conversa de exemplo, com o que a IA marca no roteiro e o que ela tira para a ficha (GGVP-40). */
export type FalaDeExemplo = Trecho & { roteiro?: number[]; extrai?: InformacaoExtraida[] }

/**
 * A conversa que a gravação simulada "ouve" (GGVP-40): os fatos da ficha em papel de leituraDeExemplo, o telefone novo
 * (para a divergência do cadastro, GGVP-43) e o cofre na hora da senha, que nunca é dita (G9). O tempo é curto de
 * propósito, para a demonstração no localhost.
 */
export function conversaDeExemplo(ficha: Ficha, advogada: string): FalaDeExemplo[] {
  const cliente = ficha.nome.split(' ')[0]
  const a = (aos: number, texto: string, extra: Partial<FalaDeExemplo> = {}): FalaDeExemplo => ({ aos, quem: advogada, papel: 'advogada', texto, ...extra })
  const c = (aos: number, texto: string, extra: Partial<FalaDeExemplo> = {}): FalaDeExemplo => ({ aos, quem: cliente, papel: 'cliente', texto, ...extra })
  return [
    a(0, `${cliente}, essa conversa está sendo gravada e transcrita para preencher a sua ficha. Tudo bem?`),
    c(6, 'Tudo bem, sim.'),
    a(14, 'Me conta desde quando você não consegue trabalhar e o que aconteceu.'),
    c(24, 'Parei em junho de 2026. O último trabalho foi de auxiliar de limpeza, com carteira, até maio.', {
      roteiro: [0],
      extrai: [
        { id: 'desde', rotulo: 'Sem trabalhar desde', valor: '06/2026', destino: 'processo' },
        { id: 'vinculo', rotulo: 'Último vínculo', valor: 'auxiliar de limpeza · CLT · até 05/2026', destino: 'processo' },
        { id: 'profissao', rotulo: 'Profissão', valor: 'Auxiliar de limpeza', destino: 'ficha', campo: 'profissao' },
      ],
    }),
    a(34, 'Você já pediu algum benefício ao INSS? O que disseram?'),
    c(44, 'Pedi o auxílio e negaram em agosto. A carta do INSS está em casa.', {
      roteiro: [3],
      extrai: [
        { id: 'pedido', rotulo: 'Pedido anterior ao INSS', valor: 'auxílio negado em 08/2026', destino: 'processo' },
        { id: 'carta', rotulo: 'Documento citado', valor: 'carta de indeferimento do INSS', destino: 'documentacao' },
      ],
    }),
    a(54, 'E o tratamento? Está fazendo alguma coisa? Tem laudo?'),
    c(64, 'Faço fisioterapia duas vezes por semana. Tenho dois laudos do ortopedista.', {
      roteiro: [2, 4],
      extrai: [{ id: 'laudos', rotulo: 'Laudos citados', valor: '2 laudos do ortopedista', destino: 'documentacao' }],
    }),
    a(74, 'Qual é o seu estado civil? Quem mora com você?'),
    c(84, 'União estável, há vinte anos. Em casa somos três, com a minha filha Renata.', {
      roteiro: [5],
      extrai: [{ id: 'estado-civil', rotulo: 'Estado civil', valor: 'União estável', destino: 'ficha', campo: 'estadoCivil' }],
    }),
    a(94, 'Tem o telefone de alguém da família, para apoio? E o seu número continua o mesmo?'),
    c(104, 'O da Renata é (11) 90000-0022. O meu mudou: agora é (11) 90000-0021.', {
      extrai: [
        { id: 'apoio', rotulo: 'Contato de apoio', valor: 'filha Renata · (11) 90000-0022', destino: 'ficha', campo: 'contatoApoio' },
        { id: 'telefone', rotulo: 'Telefone', valor: telefoneDeExemplo(21), destino: 'ficha', campo: 'telefone' },
      ],
    }),
    a(114, 'Você tem a senha do gov.br em mãos? Não precisa falar em voz alta: eu abro o cofre para você digitar.', { roteiro: [1] }),
    c(122, 'Tenho, sim.'),
    // A advogada da Natália cita o benefício na conversa; a da Josefa deixa para decidir depois (GGVP-51, G3).
    a(
      132,
      ficha.beneficioInteresse === 'incapacidade-temporaria'
        ? 'Pelo que você contou e pelos laudos, o caminho é a aposentadoria por invalidez. Vou conferir os laudos com você. Obrigada.'
        : 'Pelo que você contou, vou conferir os laudos e definir o benefício com você. Obrigada.',
    ),
  ]
}

/**
 * As conversas do Antônio do Figma "Transcrições do processo" (1626:2), com as pessoas da semente: a entrevista com a
 * advogada, transcrita e conferida; a ligação do Atendimento, gravada no Chatwoot; e um registro sem áudio (GGVP-46).
 */
export function gravacoesDeExemplo(): Gravacao[] {
  const comum = { fichaId: 'antonio-exemplo', estado: 'encerrada' as const, extraidas: [], documentos: [], marcas: [] }
  const quando = (data: string, hora: string) => new Date(`${data}T${hora}:00`).toISOString()
  const conferida = quando('2026-07-10', '15:00')
  const extraida = (id: string, rotulo: string, valor: string, destino: InformacaoExtraida['destino'], campo?: InformacaoExtraida['campo']): InformacaoExtraida => ({
    id,
    rotulo,
    valor,
    destino,
    ...(campo && { campo }),
    conferidaEm: conferida,
  })
  const paula = (aos: number, texto: string, prova?: boolean): Trecho => ({ aos, quem: 'Dra. Paula', papel: 'advogada', texto, ...(prova && { prova }) })
  const antonio = (aos: number, texto: string, prova?: boolean): Trecho => ({ aos, quem: 'Antônio', papel: 'cliente', texto, ...(prova && { prova }) })
  const atendimento = (aos: number, texto: string): Trecho => ({ aos, quem: 'Atendimento', papel: 'atendimento', texto })
  return [
    {
      ...comum,
      id: 'antonio-entrevista',
      data: '2026-07-10',
      titulo: 'Entrevista com a advogada',
      canal: 'vídeo',
      participantes: ['Dra. Paula', 'Atendimento', 'Antônio Exemplo'],
      duracao: 2292,
      origem: 'portal',
      avisoEm: quando('2026-07-10', '14:00'),
      acoes: [
        { acao: 'avisou', quando: quando('2026-07-10', '14:00'), aos: 0 },
        { acao: 'gravou', quando: quando('2026-07-10', '14:00'), aos: 0 },
        { acao: 'abriu-cofre', quando: quando('2026-07-10', '14:12'), aos: 760 },
        { acao: 'guardou-senha', quando: quando('2026-07-10', '14:13'), aos: 760 },
        { acao: 'encerrou', quando: quando('2026-07-10', '14:39'), aos: 2292 },
      ],
      audio: { nome: 'entrevista-antonio-exemplo-2026-07-10.webm', formato: 'webm', tamanho: 2292 * 16_000, partes: 2 },
      transcricao: 'pronta',
      trechos: [
        paula(0, 'Seu Antônio, essa conversa está sendo gravada e transcrita para preencher sua ficha. O senhor concorda?'),
        antonio(6, 'Concordo, doutora.'),
        paula(135, 'Me conta desde quando o senhor não consegue trabalhar.'),
        antonio(140, 'Parei de trabalhar em março, depois da segunda crise na coluna. Estou sem receber desde então.', true),
        paula(348, 'Antes de porteiro, o senhor trabalhou na roça?', true),
        antonio(352, 'Trabalhei de 2018 a 2020, sem carteira. Tenho as notas do produtor, e o sindicato tem registro.', true),
        atendimento(760, 'O senhor tem a senha do gov.br? Não precisa falar; vou abrir o cofre para o senhor digitar.'),
        paula(1865, 'Pelo que o senhor contou e pelos laudos, o caminho é a aposentadoria por invalidez. Vamos pedir ao INSS e, se negar, entramos na Justiça.'),
      ],
      resumo:
        'Antônio, 62 anos, trabalhou como rural (2018–2020, sem registro) e como porteiro (2021–2025). Afastado desde 03/2026, sem receber, depois de crises na coluna. Três laudos do ortopedista, o último de 18/09. Já pediu auxílio ao INSS uma vez (negado, 2024). A advogada definiu Aposentadoria por Incapacidade Permanente; a IA havia sugerido o mesmo (G3). Pendências: prova do vínculo rural 2018–2020 (sem registro; notas do produtor) e CNIS atualizado.',
      extraidas: [
        extraida('dii', 'Início da incapacidade (DII)', '03/2026 — "parei de trabalhar em março, depois da segunda crise"', 'processo'),
        extraida('vinculo', 'Último vínculo', 'porteiro · CLT · 2021 a 02/2026', 'processo'),
        extraida('rural', 'Atividade rural', '2018–2020 · sem registro · notas do produtor com o sindicato', 'documentacao'),
        extraida('laudos', 'Laudos citados', '3 laudos do ortopedista · último 18/09', 'processo'),
        extraida('pedido', 'Pedido anterior ao INSS', 'auxílio negado em 2024', 'processo'),
        extraida('senha', 'Senha do gov.br', 'digitada no cofre: não consta na transcrição (G9)', 'cofre'),
        extraida('apoio', 'Contato de apoio', `filha Renata · (11) 90000-0023`, 'ficha', 'contatoApoio'),
        extraida('beneficio', 'Benefício definido', 'Aposentadoria por Incapacidade Permanente (decisão da advogada, G3)', 'processo'),
      ],
      documentos: ['Notas do produtor rural (2018–2020)', 'Certidão do sindicato rural', 'CNIS atualizado'],
      documentosConferidosEm: conferida,
      soJuridico: true,
      marcas: ['ficha atualizada'],
    },
    {
      ...comum,
      id: 'antonio-telefone',
      data: '2026-09-20',
      titulo: 'Telefone: indeferimento e próximo passo',
      canal: 'telefone',
      participantes: ['Atendimento', 'Antônio Exemplo'],
      duracao: 720,
      origem: 'arquivo',
      acoes: [{ acao: 'subiu-arquivo', quando: quando('2026-09-20', '16:30'), aos: 0 }],
      audio: { nome: 'ligacao-chatwoot-antonio-2026-09-20.ogg', formato: 'ogg', tamanho: 720 * 16_000, partes: 1 },
      transcricao: 'pronta',
      trechos: [
        atendimento(0, 'Seu Antônio, essa ligação está sendo gravada. O INSS respondeu o pedido: foi negado.'),
        antonio(9, 'Eu imaginei. E agora, o que a gente faz?'),
        atendimento(15, 'A doutora já tinha falado: o próximo passo é entrar na Justiça. O senhor concorda?'),
        antonio(24, 'Concordo. Pode seguir.'),
      ],
      resumo: 'Ligação do Atendimento: o INSS negou o pedido e o cliente concordou em ajuizar.',
      soJuridico: false,
    },
    {
      ...comum,
      id: 'antonio-whatsapp',
      data: '2026-09-27',
      titulo: 'WhatsApp: exigência do juiz',
      canal: 'WhatsApp',
      participantes: ['Atendimento', 'Antônio Exemplo'],
      duracao: 0,
      origem: 'registro',
      acoes: [],
      transcricao: 'sem-audio',
      trechos: [],
      registro: 'Avisado da exigência do juiz; vai buscar as notas do produtor.',
      soJuridico: false,
    },
  ]
}

/**
 * O CNIS anexado ao caso (GGVP-51 e GGVP-57): vínculos de empresas de exemplo, sem número de documento. O da Josefa foi
 * baixado do Meu INSS na renovação da senha; o da Natália, trazido impresso.
 */
export function cnisDeExemplo(): Cnis[] {
  return [
    {
      fichaId: 'josefa-exemplo',
      origem: 'meu-inss',
      extraidoEm: '2026-10-02',
      vinculos: [
        { empresa: 'Exemplo Comércio Ltda', inicio: '2012-01', fim: '2016-12' },
        { empresa: 'Exemplo Limpeza Ltda', inicio: '2019-03', fim: '2026-05' },
      ],
    },
    { fichaId: 'natalia-exemplo', origem: 'impresso', extraidoEm: '2026-10-01', vinculos: [{ empresa: 'Exemplo Serviços Ltda', inicio: '2021-02', fim: '2026-04' }] },
    { fichaId: 'antonio-exemplo', origem: 'meu-inss', extraidoEm: '2026-07-30', vinculos: [{ empresa: 'Exemplo Condomínio', inicio: '2021-01', fim: '2026-02' }] },
    // A Cleide da Aposentadoria PCD (GGVP-42): o indicador PCD e a insalubridade de cada vínculo.
    {
      fichaId: 'cleide-exemplo',
      origem: 'meu-inss',
      extraidoEm: '2026-06-30',
      vinculos: [
        { empresa: 'Exemplo Têxtil Ltda', inicio: '2008-02', fim: '2013-05', insalubre: true },
        { empresa: 'Exemplo Metalúrgica Ltda', inicio: '2013-08', fim: '2019-12', indicadorPcd: true, insalubre: true },
        { empresa: 'Exemplo Serviços Ltda', inicio: '2020-02', indicadorPcd: true },
      ],
    },
  ]
}

/**
 * As pessoas dos registros de exemplo e as que entram no portal de exemplo (a semente de `apps/api/src/banco/exemplo.ts`),
 * com o setor: o chat (GGVP-82), que ainda é de exemplo, e os testes. A pendência da conversa usa as do servidor (GGVP-138).
 */
export const PESSOAS_DO_ESCRITORIO_DE_EXEMPLO: { nome: string; setor: Setor }[] = [
  { nome: 'Carla (exemplo)', setor: 'Atendimento' },
  { nome: 'Dra. Paula (exemplo)', setor: 'Jurídico' },
  { nome: 'Dra. Renata (exemplo)', setor: 'Jurídico' },
  { nome: 'Marcos (exemplo)', setor: 'Financeiro' },
  { nome: 'Jéssica (exemplo)', setor: 'Documentação · ADM' },
  { nome: 'Dr. Otávio (exemplo)', setor: 'Jurídico' },
  { nome: 'Ana (exemplo)', setor: 'Atendimento' },
  { nome: 'Eva (exemplo, líder e atendimento)', setor: 'Atendimento' },
  { nome: 'Fábio (exemplo)', setor: 'Documentação · ADM' },
  { nome: 'Gabi (exemplo)', setor: 'Jurídico' },
  { nome: 'Helena (exemplo)', setor: 'Jurídico' },
  { nome: 'Otávio (exemplo, segunda Sênior)', setor: 'Jurídico' },
  { nome: 'Igor (exemplo)', setor: 'Jurídico' },
  { nome: 'Júlia (exemplo)', setor: 'Financeiro' },
]
