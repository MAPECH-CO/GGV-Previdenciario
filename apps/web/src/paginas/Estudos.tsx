import { useEffect, useState } from 'react'
import type { EstudosDeCaso } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import { agrupar, dia, textoDosEstudos } from '../componentes/estudos.ts'
import styles from './Passo.module.css'

/**
 * Estudos de caso (GGVP-19; Lucas, 06/10): a IA faz o estudo de cada processo perdido, sozinha. A tela separa por
 * benefício e pela chance que o caso tinha; quando o estudo indica novo processo, a Sênior decide aqui. Só o Jurídico vê.
 */
export function Estudos() {
  const [x, setX] = useState<EstudosDeCaso | null>(null)
  const [versao, setVersao] = useState(0)
  const [erro, setErro] = useState('')
  const [feito, setFeito] = useState('')

  useEffect(() => {
    void chamarApi<EstudosDeCaso>('/estudos').then((r) => (r.ok ? setX(r.dados) : setErro(r.erro)))
  }, [versao])

  async function revisar(casoId: string, novoProcesso: boolean) {
    const r = await chamarApi(`/casos/${casoId}/estudo/revisao`, { method: 'POST', corpo: { novoProcesso } })
    if (!r.ok) return setErro(r.erro)
    setErro('')
    setFeito(novoProcesso ? 'Revisão registrada: vamos entrar com novo processo. Ele começa pela recepção, como nova demanda do cliente.' : 'Revisão registrada: sem novo processo.')
    setVersao((v) => v + 1)
  }

  function baixar() {
    const url = URL.createObjectURL(new Blob([textoDosEstudos(x!.estudos)], { type: 'text/plain;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'estudos-de-caso.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className={styles.pagina}>
      <title>Estudos de caso · GGV Previdenciário</title>
      <a className={styles.voltar} href="/">
        ← Voltar ao início
      </a>
      <h1 className={styles.titulo}>Estudos de caso</h1>
      <p className={styles.subtitulo}>Feitos pela IA depois de cada processo perdido. Estratégia interna: não vão ao cliente.</p>
      {erro && (
        <p className={styles.erro} role="alert">
          {erro}
        </p>
      )}
      {feito && (
        <p className={styles.sucesso} role="status">
          {feito}
        </p>
      )}
      {x && x.estudos.length === 0 && <p className={styles.dica}>Nenhum estudo ainda: a IA faz um estudo para cada processo perdido.</p>}
      {x && x.estudos.length > 0 && (
        <div className={styles.acoes}>
          <button type="button" className={styles.botaoSecundario} onClick={baixar}>
            Baixar os estudos
          </button>
        </div>
      )}
      {x &&
        agrupar(x.estudos).map(({ beneficio, grupos }) => (
          <section key={beneficio} className={styles.cartao} aria-label={beneficio}>
            <h2 className={styles.cartaoTitulo}>{beneficio}</h2>
            {grupos
              .filter((g) => g.lista.length)
              .map((g) => (
                <section key={g.chance} aria-label={`${beneficio} · ${g.rotulo}`}>
                  <h3 className={styles.rotulo}>{g.rotulo}</h3>
                  {g.lista.map((item) => (
                    <article key={item.casoId} className={styles.cartao} aria-label={`Estudo de ${item.cliente}`}>
                      <h4 className={styles.cartaoTitulo}>
                        {item.cliente} · {item.resultado}
                      </h4>
                      <span className={styles.selo}>Estudo da IA · estratégia interna</span>
                      {item.aRevisar && <span className={`${styles.selo} ${styles.seloAlerta}`}>A IA indica novo processo · espera a revisão da Sênior</span>}
                      <p>
                        Matéria: {item.estudo.materia}
                        {item.estudo.vara ? ` · ${item.estudo.vara}` : ''}
                      </p>
                      {item.estudo.tese && <p>Tese: {item.estudo.tese}</p>}
                      <p>Resumo: {item.estudo.resumo}</p>
                      <p>
                        <strong>Motivo:</strong> {item.estudo.motivo}
                      </p>
                      <p>
                        <strong>Aprendizado:</strong> {item.estudo.aprendizado}
                      </p>
                      {item.estudo.novoProcesso && <p>O que refazer para um novo processo: {item.estudo.oQueRefazer ?? '—'}</p>}
                      {item.revisao && (
                        <p className={styles.dica}>
                          Revisado por {item.revisao.por} em {dia(item.revisao.em)}: {item.revisao.novoProcesso ? 'vamos entrar com novo processo' : 'sem novo processo'}.
                        </p>
                      )}
                      {item.aRevisar && x.podeRevisar && (
                        <div className={styles.acoes}>
                          <button type="button" className={styles.botao} onClick={() => void revisar(item.casoId, true)}>
                            Vamos entrar com novo processo
                          </button>
                          <button type="button" className={styles.botaoSecundario} onClick={() => void revisar(item.casoId, false)}>
                            Não vamos
                          </button>
                        </div>
                      )}
                      <p className={styles.dica}>
                        Feito pela IA em {dia(item.geradoEm)} ({item.modelo}).
                      </p>
                    </article>
                  ))}
                </section>
              ))}
          </section>
        ))}
    </main>
  )
}
