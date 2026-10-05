// Busca do balcão (GGVP-16, CA1, CA2, CA5 e CA10): por nome, CPF ou telefone.
import { normalizarTelefone } from '../campos.ts'
import { nomeBeneficio } from '../dados/catalogos.ts'
import type { Ficha, ResultadoBusca } from '../dados/tipos.ts'
import { dataCurta } from './datas.ts'

/** Menos que isto não busca: 2 letras ou 3 dígitos. */
export const MINIMO_LETRAS = 2
export const MINIMO_DIGITOS = 3

/** "  Natália  " → "natalia". Sem acento, minúsculo, sem espaço sobrando. */
export function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Com letra, cada pedaço do termo tem de estar no nome. Sem letra, os dígitos têm de estar no CPF ou no telefone. */
export function bateNaBusca(ficha: Pick<Ficha, 'nome' | 'cpf' | 'telefone'>, termo: string): boolean {
  if (/\p{L}/u.test(termo)) {
    const pedacos = semAcento(termo).split(' ')
    if (pedacos.join('').length < MINIMO_LETRAS) return false
    const nome = semAcento(ficha.nome)
    return pedacos.every((pedaco) => nome.includes(pedaco))
  }
  const digitos = normalizarTelefone(termo)
  if (digitos.length < MINIMO_DIGITOS) return false
  return (ficha.cpf ?? '').includes(digitos) || ficha.telefone.includes(digitos)
}

/** O agendamento de hoje, se houver. */
export function agendamentoDoDia(ficha: Ficha, hoje: string) {
  return ficha.agendamentos.find((a) => a.data === hoje)
}

/** Onde a pessoa está, como o Atendimento lê. */
export function etapaDaFicha(ficha: Ficha, hoje: string): string {
  if (ficha.situacao === 'cliente') return ficha.processos[0]?.etapa ?? 'Cliente · sem caso em andamento'
  const proximo = ficha.agendamentos.filter((a) => a.data >= hoje).sort((a, b) => a.data.localeCompare(b.data))[0]
  if (proximo) {
    const quando = proximo.data === hoje ? 'hoje' : dataCurta(proximo.data, hoje)
    return `Lead · ${proximo.oQue.toLowerCase()} ${quando} ${proximo.hora}`
  }
  return ficha.contatos.length > 0 ? 'Lead · contato prévio' : 'Lead · primeiro contato'
}

export function resultadoDaFicha(ficha: Ficha, hoje: string): ResultadoBusca {
  return {
    id: ficha.id,
    nome: ficha.nome,
    situacao: ficha.situacao,
    etapa: etapaDaFicha(ficha, hoje),
    casos: ficha.processos.map((p) => ({ beneficio: nomeBeneficio(p.beneficio), etapa: p.etapa })),
    beneficioInteresse: ficha.situacao === 'lead' ? nomeBeneficio(ficha.beneficioInteresse) || undefined : undefined,
    agendamentoHoje: agendamentoDoDia(ficha, hoje),
    fichaAtendimentoPreenchida: ficha.fichaAtendimentoPreenchida,
  }
}

/** As pessoas que batem, em ordem de nome. */
export function buscar(fichas: Ficha[], termo: string, hoje: string): ResultadoBusca[] {
  return fichas
    .filter((f) => bateNaBusca(f, termo))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    .map((f) => resultadoDaFicha(f, hoje))
}
