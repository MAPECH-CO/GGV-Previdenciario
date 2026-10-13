// As três travas antes de protocolar na Justiça (G7; GGVP-71 CA2, CA6, CA7, CA11): cada uma com o critério, o status e
// a evidência, para a advogada confirmar pela evidência. Sem IA até o épico IA jurídica, a verificação é feita por código.
import { formatarCpf, normalizarCpf, validarCpf } from '@ggv/campos'
import type { ArquivoDoPacote } from './pacote.ts'

export type ChaveDaTrava = 'tema350' | 'cpf' | 'pacote'
export type Trava = { chave: ChaveDaTrava; nome: string; criterio: string; ok: boolean; evidencia: string }
export type Tribunal = { nome: string; site: string; tamanhoMaximoMb: number }
type Citado = { documentoId: string | null; nome: string }

/** Tema 350 (STF): a carta de indeferimento do INSS está no pacote. */
export function travaTema350(pacote: ArquivoDoPacote[] | null): Trava {
  const carta = pacote?.find((a) => a.papel === 'carta')
  return {
    chave: 'tema350',
    nome: 'Tema 350',
    criterio: 'A carta de indeferimento do INSS está no pacote.',
    ok: Boolean(carta),
    evidencia: carta ? `No pacote: ${carta.nome}` : 'A carta de indeferimento não está no pacote.',
  }
}

/** CPF conferido: a petição traz o CPF do cliente, e todo CPF escrito nela é igual ao do cadastro. */
export function travaCpf(texto: string, cpfDoCadastro: string | null): Trava {
  const trava = { chave: 'cpf' as const, nome: 'CPF conferido', criterio: 'Todo CPF escrito na petição é igual ao CPF do cadastro do cliente.' }
  const cadastro = normalizarCpf(cpfDoCadastro ?? '')
  // Onze dígitos, com ou sem pontuação, que não fazem parte de um número maior (CNJ, NB, valores).
  const naPeticao = [...new Set((texto.match(/(?<![\d.-])\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?![\d.-])/g) ?? []).map((c) => normalizarCpf(c)))]
  if (!validarCpf(cadastro)) return { ...trava, ok: false, evidencia: 'O cadastro do cliente não tem um CPF válido.' }
  if (!naPeticao.length) return { ...trava, ok: false, evidencia: `A petição não traz o CPF do cliente (no cadastro: ${formatarCpf(cadastro)}).` }
  return {
    ...trava,
    ok: naPeticao.every((c) => c === cadastro),
    evidencia: `Na petição: ${naPeticao.map((c) => formatarCpf(c)).join(', ')} · no cadastro: ${formatarCpf(cadastro)}`,
  }
}

/**
 * Pacote completo: nenhum citado falta, todo citado foi lido e está no pacote, e cada arquivo (sempre PDF) cabe no
 * tamanho que o tribunal aceita. `tamanhos` é o tamanho, em bytes, de cada documento do pacote. `noDrive`: se o pacote
 * já foi salvo no Drive (GGVP-107 CA6); `null` com o Drive desligado, e a trava não cobra.
 */
export function travaPacote(citados: Citado[], pacote: ArquivoDoPacote[] | null, tamanhos: Record<string, number>, tribunal: Tribunal | null, noDrive: boolean | null = null): Trava {
  const trava = { chave: 'pacote' as const, nome: 'Pacote completo', criterio: 'Os documentos citados na petição estão no pacote, em PDF e no tamanho aceito pelo tribunal.' }
  if (!pacote) return { ...trava, ok: false, evidencia: 'O pacote ainda não foi gerado.' }
  const mb = (bytes: number) => Math.round((bytes / 1_048_576) * 10) / 10
  const problemas = [
    ...citados.filter((c) => !c.documentoId).map((c) => `Falta: ${c.nome}`),
    ...citados.filter((c) => c.documentoId && !pacote.some((a) => a.origemId === c.documentoId)).map((c) => `Não deu para ler: ${c.nome}`),
    ...(tribunal
      ? pacote
          .filter((a) => (tamanhos[a.documentoId] ?? 0) > tribunal.tamanhoMaximoMb * 1_048_576)
          .map((a) => `Grande demais para ${tribunal.nome}: ${a.nome} (${mb(tamanhos[a.documentoId])} MB; o limite é ${tribunal.tamanhoMaximoMb} MB)`)
      : []),
    ...(noDrive === false ? ['O pacote ainda não está no Drive; o portal salva sozinho em até um minuto'] : []),
  ]
  return {
    ...trava,
    ok: problemas.length === 0,
    evidencia: problemas.length ? problemas.join(' · ') : `${pacote.length} arquivos em PDF: ${pacote.map((a) => a.nome).join(', ')}`,
  }
}
