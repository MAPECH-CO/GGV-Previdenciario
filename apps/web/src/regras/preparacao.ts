// A preparação da conversa (GGVP-32): os pontos de atenção que a advogada vê antes de o cliente entrar. Regra, não IA.
import { nomeBeneficio } from '../dados/catalogos.ts'
import type { Ficha, PontoDeAtencao } from '../dados/tipos.ts'
import { dataCurta } from './datas.ts'

/** Benefícios que já dizem que o caso é acidentário. */
const ACIDENTARIOS = new Set(['auxilio-acidente', 'incapacidade-permanente-acidentaria'])

function juntar(itens: string[]): string {
  return itens.length <= 1 ? itens.join('') : `${itens.slice(0, -1).join(', ')} e ${itens.at(-1)}`
}

/** A senha do gov.br pela situação, nunca pelo valor (CA2, CA4, G9). */
function pontoDaSenha(ficha: Ficha, hoje: string): PontoDeAtencao {
  const s = ficha.senhaGov
  if (s.situacao === 'no-cofre') {
    const funcionou = s.funcionouEm ? `funcionou pela última vez em ${dataCurta(s.funcionouEm, hoje)}` : 'ainda sem registro de que funcionou'
    return { tipo: 'senha', texto: `Senha do gov.br no cofre · ${funcionou}`, curto: '', alerta: false }
  }
  if (s.situacao === 'escritorio-tem') {
    return { tipo: 'senha', texto: 'Senha do gov.br: o escritório tem, mas ainda não está no cofre', curto: 'senha fora do cofre', alerta: true }
  }
  const r = ficha.renovacao
  const tentou =
    r?.resultado === 'nao-conseguiu' ? `o Atendimento tentou renovar e não conseguiu: ${r.motivo}` : 'o Atendimento ainda não tentou renovar'
  return { tipo: 'senha', texto: `Sem senha do gov.br${s.naoSabe ? ' (o cliente não sabe)' : ''} · ${tentou}`, curto: 'sem senha do gov.br', alerta: true }
}

/** O acidentário: o que a análise da ficha decidiu ou, antes dela, o benefício procurado. */
function pontoDoAcidentario(ficha: Ficha): PontoDeAtencao {
  if (ficha.analise) {
    return ficha.analise.acidentario
      ? { tipo: 'acidentario', texto: 'Pode ser auxílio acidentário (decidido na análise da ficha)', curto: 'pode ser acidentário', alerta: true }
      : { tipo: 'acidentario', texto: 'Não é auxílio acidentário (decidido na análise da ficha)', curto: '', alerta: false }
  }
  return ACIDENTARIOS.has(ficha.beneficioInteresse ?? '')
    ? { tipo: 'acidentario', texto: 'O benefício procurado é acidentário: confirme na análise da ficha', curto: 'pode ser acidentário', alerta: true }
    : { tipo: 'acidentario', texto: 'Acidentário: decidir na análise da ficha', curto: '', alerta: false }
}

/** Os pontos de atenção da preparação, na ordem do cartão: acidentário, senha, benefício e o que ficou em branco. */
export function pontosDeAtencao(ficha: Ficha, hoje: string): PontoDeAtencao[] {
  const beneficio = ficha.beneficioInteresse && ficha.beneficioInteresse !== 'nao-sei' ? nomeBeneficio(ficha.beneficioInteresse) : ''
  const pontos = [
    pontoDoAcidentario(ficha),
    pontoDaSenha(ficha, hoje),
    {
      tipo: 'beneficio' as const,
      texto: beneficio ? `Benefício que o cliente procura: ${beneficio}` : 'O cliente ainda não sabe o benefício',
      curto: '',
      alerta: false,
    },
  ]
  if (!ficha.fichaAtendimentoPreenchida) {
    pontos.push({ tipo: 'em-branco', texto: 'A ficha de atendimento ainda não foi preenchida', curto: 'ficha não preenchida', alerta: true })
  } else if (ficha.fichaAtendimento && ficha.fichaAtendimento.emBranco.length > 0) {
    const branco = ficha.fichaAtendimento.emBranco
    pontos.push({ tipo: 'em-branco', texto: `Ficou em branco na ficha: ${juntar(branco)}`, curto: 'campos em branco', alerta: true })
  }
  return pontos
}

/** "atenção: sem senha do gov.br e campos em branco" para o detalhe da tarefa da fila (CA1). */
export function atencaoCurta(pontos: PontoDeAtencao[]): string {
  const alertas = pontos.filter((p) => p.alerta && p.curto).map((p) => p.curto)
  return alertas.length ? `atenção: ${juntar(alertas)}` : 'sem pontos de atenção'
}

/** Por que "Iniciar entrevista" ainda não libera; nulo quando libera. A segunda ficha entra com a GGVP-28. */
export function motivoParaIniciar(ficha: Ficha): string | null {
  return ficha.analise ? null : 'Analise a ficha antes: pode ser auxílio acidentário?'
}
