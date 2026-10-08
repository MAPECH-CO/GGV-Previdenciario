import styles from './OpcoesDaMarcacao.module.css'

export type Opcoes = { convite: boolean; gravar: boolean; pedirFicha: boolean; levar: boolean }

// Figma 73:520 a 73:528. A ficha de atendimento é em papel até o tablet chegar (Pedro, 05/10): vale isso, não o link do Figma.
const ROTULOS: { id: keyof Opcoes; texto: string }[] = [
  { id: 'convite', texto: 'Enviar convite e lembrete pelo Chatwoot (modelo, GGVP-102)' },
  { id: 'gravar', texto: 'Gravar e transcrever a entrevista · aviso de gravação no início (G10)' },
  { id: 'pedirFicha', texto: 'Pedir para a cliente preencher a ficha de atendimento em papel antes da conversa (D1.05)' },
  { id: 'levar', texto: 'Pedir ao cliente que traga RG, CPF e laudos (kit do benefício, G1)' },
]

/** As quatro opções da marcação, que entram no convite. */
export function OpcoesDaMarcacao({ valor, aoMudar }: { valor: Opcoes; aoMudar: (valor: Opcoes) => void }) {
  return (
    <div className={styles.opcoes}>
      {ROTULOS.map((r) => (
        <label key={r.id} className={styles.opcao}>
          <input type="checkbox" checked={valor[r.id]} onChange={(e) => aoMudar({ ...valor, [r.id]: e.target.checked })} />
          {r.texto}
        </label>
      ))}
    </div>
  )
}
