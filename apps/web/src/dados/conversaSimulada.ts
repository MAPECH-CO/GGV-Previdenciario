// EXEMPLO. A conversa do D5 simulada (GGVP-76, GGVP-80): o que a gravação "ouve" e o que a IA tira de cada fala. Desde a
// transcrição de verdade (GGVP-133), só o servidor falso dos testes das telas usa: a tela e o servidor não inventam falas.
import type { CanalDoRegistro, ComQuem, Dito, PapelNaConversa } from '../regras/conversa.ts'
import type { Ficha, Trecho } from './tipos.ts'

/** Uma fala da conversa de exemplo, com o que a IA tira dela (GGVP-80). */
export type FalaDaConversa = Trecho & { diz?: Dito[]; combinado?: string; senha?: true }

/** O nome que aparece na transcrição: sem o "(exemplo)" das pessoas da semente. */
const falado = (quem: string) => quem.replace(/\s*\(exemplo\)$/, '')

/**
 * O que a gravação simulada "ouve" (GGVP-76, CA9): o endereço e o telefone novos, a perícia remarcada e a ida ao hospital
 * (só com processo), a senha dita em voz alta (G9) e o combinado. Curta de propósito, para a demonstração no localhost.
 */
export function falasDaConversa(ficha: Ficha, c: { canal: CanalDoRegistro; comQuem: ComQuem; processoId?: string; quem: string; papel: PapelNaConversa }): FalaDaConversa[] {
  const primeiro = ficha.nome.split(' ')[0]
  const outro = c.comQuem === 'cliente' ? primeiro : c.comQuem === 'familiar' ? 'Familiar' : 'Clínica'
  const eu = (aos: number, texto: string, extra: Partial<FalaDaConversa> = {}): FalaDaConversa => ({
    aos,
    quem: falado(c.quem),
    papel: c.papel === 'juridico' ? 'advogada' : 'atendimento',
    texto,
    ...extra,
  })
  const ele = (aos: number, texto: string, extra: Partial<FalaDaConversa> = {}): FalaDaConversa => ({ aos, quem: outro, papel: 'cliente', texto, ...extra })
  const gravando = c.canal === 'ligacao' ? 'esta ligação está sendo gravada' : 'esta conversa vai ser gravada'
  const falas = [
    eu(0, `${primeiro}, ${gravando} e transcrita para atualizar a sua ficha. Tudo bem?`),
    ele(6, 'Tudo bem.'),
    eu(12, 'Em que posso ajudar?'),
    ele(20, 'Mudei de casa. Agora moro na Rua Exemplo das Acácias, 45.', { diz: [{ onde: 'ficha', campo: 'endereco', valor: 'Rua Exemplo das Acácias, 45' }] }),
    eu(30, 'Anotado. E o telefone, continua o mesmo?'),
    ele(38, 'Não, troquei de número: agora é (11) 90000-0044.', { diz: [{ onde: 'ficha', campo: 'telefone', valor: '11900000044' }] }),
  ]
  if (c.processoId) {
    falas.push(
      eu(48, 'E o INSS, mandou alguma coisa?'),
      ele(56, 'Mandou: remarcaram a perícia para 16/10, às 8h30.', { diz: [{ onde: 'processo', campo: 'pericia', valor: '2026-10-16' }] }),
      ele(66, 'E fiquei três dias no hospital no fim de setembro. Trouxe o relatório da alta.', {
        diz: [
          { onde: 'processo', campo: 'fato', valor: 'Três dias no hospital no fim de setembro', saude: true },
          { onde: 'processo', campo: 'documento', valor: 'Relatório da alta hospitalar' },
        ],
      }),
    )
  }
  falas.push(
    eu(78, 'Se precisar da senha do gov.br, você digita no cofre. Não precisa falar em voz alta.'),
    ele(86, 'A minha senha do gov.br é Exemplo@2026, pode anotar.', { senha: true }),
    c.processoId
      ? eu(96, 'Não precisa: a senha vai para o cofre. A Documentação vai receber o relatório da alta.', {
          combinado: 'Documentação: receber e digitalizar o relatório da alta hospitalar.',
        })
      : eu(96, 'Não precisa: a senha vai para o cofre. Traga o comprovante do endereço novo, por favor.', {
          combinado: 'Atendimento: pedir o comprovante do endereço novo.',
        }),
    ele(106, 'Combinado.'),
  )
  return falas
}
