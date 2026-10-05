// EXEMPLO. Semente do servidor de exemplo, falsa de propósito: nomes com "Exemplo" e telefones
// (11) 90000-00xx. São as pessoas da Central (atendimento.ts), para seguir uma pessoa do balcão
// até o benefício no localhost. Sai quando o servidor de verdade existir.
import { isoParaData } from '../campos.ts'
import { somarDias } from '../regras/agenda.ts'
import type { EnvioDaFicha, Ficha, LoteDigitalizado, PastaDrive, Processo } from './tipos.ts'

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
      { beneficio: 'incapacidade-temporaria', etapa: 'Administrativo · perícia em 02/10', proximaAcao: 'cobrar o laudo que a perícia pede', prazo: 'vence hoje', urgente: true },
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
    cliente(7, 'sebastiao-exemplo', 'Sebastião Exemplo', [
      { beneficio: 'auxilio-acidente', etapa: 'Documentação · liberar ao Jurídico', proximaAcao: 'conferir a documentação', prazo: 'amanhã' },
    ]),
    cliente(8, 'pedro-exemplo', 'Pedro Exemplo', [
      { beneficio: 'loas-idoso', etapa: 'Administrativo · exigência do INSS', proximaAcao: 'responder a exigência', prazo: 'vence em 2 dias', urgente: true },
    ]),
    cliente(9, 'lucia-exemplo', 'Lúcia Exemplo', [
      { beneficio: 'pensao-morte', etapa: 'Judicial · sentença procedente', proximaAcao: 'avisar a cliente depois do OK da advogada', prazo: 'hoje', urgente: true },
    ]),
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
