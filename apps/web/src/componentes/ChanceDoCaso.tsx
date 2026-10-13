import { useEffect, useState } from 'react'
import type { ChanceDeExito } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import styles from '../paginas/Passo.module.css'
import { taxaComCasos } from '../regras/caso.ts'
import { usePode } from '../sessao.ts'

/** GGVP-150 CA2: a faixa vem do servidor; a tela só pinta. */
const ROTULO_DA_COR = { vermelho: 'Vermelho · abaixo de 15%', amarelo: 'Amarelo · de 15% a 50%', verde: 'Verde · acima de 50%' }
const SELO_DA_COR = { vermelho: styles.seloErro, amarelo: styles.seloAlerta, verde: '' }

/**
 * A chance de êxito (GGVP-131, GGVP-150, GGVP-151): o número vem do sistema (acervo conferido), com os casos, a data da
 * base e a cor; os fatores da IA ficam prontos em segundo plano. Com o caso, a chance do caso; sem caso (na entrevista),
 * a do benefício escolhido. Veem a advogada, a Sênior e o Sócio (`chance.ver`); para os outros, nada aparece e nada é pedido.
 * Nunca vai ao texto da peça nem ao cliente.
 */
export function ChanceDoCaso({ casoId, beneficio }: { casoId?: string; beneficio?: string }) {
  const veChance = usePode('chance.ver')
  const [chance, setChance] = useState<ChanceDeExito | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!veChance || (!casoId && !beneficio)) return
    const pedido = casoId
      ? chamarApi<ChanceDeExito>(`/casos/${casoId}/chance`, { method: 'POST', corpo: {} })
      : chamarApi<ChanceDeExito>(`/chance?${new URLSearchParams({ beneficio: beneficio as string })}`)
    void pedido.then((r) => (r.ok ? setChance(r.dados) : setErro(r.erro)))
  }, [veChance, casoId, beneficio])

  if (!veChance || (!casoId && !beneficio)) return null
  return (
    <section className={styles.cartao} aria-label="Chance de êxito">
      <h2 className={styles.cartaoTitulo}>Chance de êxito</h2>
      {!chance ? (
        <p className={styles.dica}>{erro || 'Calculando…'}</p>
      ) : (
        <>
          {chance.cor && <span className={`${styles.selo} ${SELO_DA_COR[chance.cor]}`}>{ROTULO_DA_COR[chance.cor]}</span>}
          <p>
            {chance.porcentagem === null || !chance.baseEm ? (
              'Sem casos parecidos na casa ainda: sem porcentagem.'
            ) : (
              <strong>{taxaComCasos(chance.favoraveis, chance.casos, new Date(chance.baseEm).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }))}</strong>
            )}
          </p>
          {chance.sugereNaoPegar && (
            <p className={styles.dica} role="note">
              Abaixo de 15%: a sugestão é não pegar o caso. Não bloqueia nada: quem decide é o Jurídico.
            </p>
          )}
          {chance.faltaSaber.length > 0 && (
            <>
              <p className={styles.dica}>Para a chance ficar mais certa, falta saber:</p>
              <ul className={styles.lista} aria-label="O que falta saber">
                {chance.faltaSaber.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </>
          )}
          <p className={styles.dica}>Calculado pelo sistema: {chance.regra}. Uso interno: não vai ao cliente nem à peça.</p>
          {chance.fatores && (
            <>
              <span className={`${styles.selo} ${styles.seloAlerta}`}>Fatores sugeridos pela IA · confira</span>
              <p style={{ whiteSpace: 'pre-wrap' }}>{chance.fatores.texto}</p>
            </>
          )}
          {chance.motivoIa && <p className={styles.dica}>{chance.motivoIa}</p>}
        </>
      )}
    </section>
  )
}
