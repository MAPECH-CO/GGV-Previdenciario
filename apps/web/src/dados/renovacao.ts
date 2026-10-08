// EXEMPLO. Servidor de exemplo da renovação da senha do gov.br (GGVP-36), sobre o mesmo banco de servidor.ts. A senha
// vai e não volta: o servidor de exemplo descarta o valor e grava só a situação, quem, quando e a data em que funcionou.
// Ligar no servidor: trocar o corpo por fetch no endpoint da design.md e guardar no cofre de verdade (GGVP-103).
import { hojeIso } from '../regras/datas.ts'
import { TAMANHO_DA_SENHA, registrarNoCofre } from './cofre.ts'
import { QUEM, agora, esperar, evento, gravar, ler } from './servidor.ts'
import type { RegistroDaRenovacao, Renovacao, SenhaGov } from './tipos.ts'

/**
 * POST /api/entrevistas/:id/renovacao. "Renovou": a senha vai ao cofre, com a data em que funcionou (CA2, CA5, CA9, CA11);
 * "Não conseguiu": motivo e aviso ao cliente, que fica em "Últimos contatos" (CA3, CA6). A entrevista segue nos dois.
 * A trilha do cofre grava quem, quando e a ação, nunca o valor (CA8).
 */
export async function registrarRenovacao(agendamentoId: string, r: RegistroDaRenovacao): Promise<{ senhaGov: SenhaGov; renovacao: Renovacao }> {
  await esperar()
  const valido =
    r.resultado === 'renovou'
      ? r.senha.length >= TAMANHO_DA_SENHA.minimo && r.senha.length <= TAMANHO_DA_SENHA.maximo && r.conferiMeuInss === true
      : r.resultado === 'nao-conseguiu' && r.motivo.trim().length >= 3 && r.motivo.trim().length <= 300 && r.aviseiOCliente === true
  if (!valido) throw new Error('Renovação inválida')
  const banco = ler()
  const ficha = banco.fichas.find((f) => f.agendamentos.some((a) => a.id === agendamentoId))
  if (!ficha) throw new Error('Entrevista não encontrada')
  const quando = agora().toISOString()
  const hoje = hojeIso(agora())
  let renovacao: Renovacao
  if (r.resultado === 'renovou') {
    // O valor da senha termina aqui: no servidor de verdade, vai cifrado para o cofre (GGVP-103).
    ficha.senhaGov = { situacao: 'no-cofre', atualizadaEm: quando, por: QUEM, funcionouEm: hoje }
    registrarNoCofre(banco, ficha.id, 'renovou')
    renovacao = { resultado: 'renovou', quem: QUEM, quando }
    ficha.historico.push(evento('Renovou a senha do gov.br e guardou no cofre; conferiu que o Meu INSS abre e que o CNIS aparece'))
  } else {
    const motivo = r.motivo.trim()
    renovacao = { resultado: 'nao-conseguiu', motivo, quem: QUEM, quando }
    ficha.contatos.push({
      data: hoje,
      canal: 'Aviso',
      texto: 'Avisado de que precisa recuperar a senha do gov.br, se preciso numa agência do INSS. A entrevista segue no horário marcado.',
    })
    ficha.historico.push(evento(`Não conseguiu renovar a senha do gov.br: ${motivo}. Avisou o cliente; a entrevista segue`))
  }
  ficha.renovacao = renovacao
  for (const t of banco.tarefas) if (t.cliente?.id === ficha.id && t.acao === 'Renovar senha do gov.br') t.concluida = true
  gravar(banco)
  return { senhaGov: ficha.senhaGov, renovacao }
}
