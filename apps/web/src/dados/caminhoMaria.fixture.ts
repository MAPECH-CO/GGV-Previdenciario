import type { Ficha } from './tipos.ts'
import type { Banco } from './servidor.ts'

// Dados inventados exclusivamente para os testes de fechamento das telas.
export const ID_FICTICIO = '11111111-1111-4111-8111-111111111111'
export const CASO_FICTICIO = '22222222-2222-4222-8222-222222222222'
export const ENTREVISTA_FICTICIA = ID_FICTICIO + '-ag-teste'
export function fichaInventada(): Ficha {
  return { id: ID_FICTICIO, nome: 'Pessoa Inventada no Teste', telefone: '11900000000', situacao: 'lead', desde: '10/2026',
    senhaGov: { situacao: 'sem-senha' }, fichaAtendimentoPreenchida: true,
    fichaAtendimento: { data: '2026-10-11', origem: 'papel', modelo: 'GGV', ultimaAtividade: 'Atividade inventada', emBranco: [] },
    processos: [], contatos: [], documentos: [], arquivos: [], historico: [], transcricoes: 0,
    agendamentos: [{ id: ENTREVISTA_FICTICIA, data: '2026-10-15', hora: '10:00', oQue: 'Entrevista', com: 'Advogada Inventada', tipo: 'video', estado: 'marcado' }],
  }
}
export function bancoInventado(fichas: Ficha[] = []): Banco {
  return { fichas, internos: [], gravacoes: [], pastas: [], tarefas: [], resumosDeLaudo: [], cofre: [], leiturasMedicas: [], pericias: [], seq: 0 }
}
