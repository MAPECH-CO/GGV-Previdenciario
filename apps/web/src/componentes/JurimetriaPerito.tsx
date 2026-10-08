import { useEffect, useRef } from 'react'
import { processosComOPerito } from '../dados/pericia.ts'
import type { PerfilDoPerito } from '../dados/peritos.ts'
import { agora } from '../dados/servidor.ts'
import { dataCurta, hojeIso } from '../regras/datas.ts'
import { numerosDaJurimetria, type Jurimetria } from '../regras/pericia.ts'
import janelas from './DetalheCompromisso.module.css'
import styles from './JurimetriaPerito.module.css'

const numeros = (j: Jurimetria) => numerosDaJurimetria(j, hojeIso(agora()))

/**
 * A jurimetria do perito (Figma 2184:2 e 2184:53): os números do acervo, calculados pelo sistema, o que ele costuma
 * perguntar, a dica para a ligação e os processos com ele. Toda porcentagem com o número de laudos e a data da base, sem
 * amostra mínima (G22). A IA só resume o que os laudos dizem. Só para o Jurídico.
 */
export function JurimetriaPerito({ perfil, aoFechar }: { perfil: PerfilDoPerito; aoFechar: () => void }) {
  const janela = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialogo = janela.current
    // O jsdom dos testes não tem showModal: abre sem o fundo escuro.
    if (typeof dialogo?.showModal === 'function') {
      if (!dialogo.open) dialogo.showModal()
    } else dialogo?.setAttribute('open', '')
  }, [])

  const { perito, jurimetria } = perfil
  const processos = processosComOPerito(perito.id)
  return (
    <dialog ref={janela} className={`${janelas.janela} ${styles.janela}`} aria-labelledby="perito-titulo" onClose={aoFechar}>
      <div className={styles.cabeca}>
        <div>
          <p className={styles.linha}>
            <span className={styles.rotulo}>Perito</span>
            <strong id="perito-titulo" className={styles.nome}>
              {perito.nome}
            </strong>
            <span className={jurimetria.laudos ? styles.suficiente : styles.insuficiente}>
              números do sistema (G22)
            </span>
          </p>
          <p className={styles.sub}>
            {perito.especialidade} · aparece em {jurimetria.laudos} laudos do acervo · perfil versão {perfil.versao}
          </p>
        </div>
        <button type="button" className={janelas.fechar} aria-label="Fechar" onClick={aoFechar}>
          ×
        </button>
      </div>

      <div className={styles.corpo}>
        <h3 className={styles.secao}>Números do acervo</h3>
        <dl className={styles.numeros}>
          <dt>Laudos favoráveis</dt>
          <dd>{numeros(jurimetria)}</dd>
          {perfil.porAssunto.length > 1 &&
            perfil.porAssunto.map((a) => (
              <div key={a.assunto} className={styles.par}>
                <dt>{a.assunto.charAt(0).toUpperCase() + a.assunto.slice(1)}</dt>
                <dd>{numeros(a.jurimetria)}</dd>
              </div>
            ))}
          <dt>Tempo até o laudo</dt>
          <dd>{jurimetria.laudos ? `${jurimetria.diasAteOLaudo} dias em média` : '—'}</dd>
        </dl>

        <h3 className={styles.secao}>O que costuma perguntar</h3>
        <ul className={styles.lista}>
          {perfil.perguntou.map((p) => (
            <li key={p}>• {p.charAt(0).toUpperCase() + p.slice(1)}</li>
          ))}
        </ul>

        <h3 className={styles.secao}>Dica para orientar o cliente · use na ligação</h3>
        {jurimetria.laudos ? (
          <p className={styles.dica}>
            Leve {perfil.pediu.join(' e ')}. Conte como é o seu dia: {perfil.perguntou[0]}. Responda com calma e com sinceridade.
          </p>
        ) : (
          <p className={styles.sub}>
            Sem laudo do perito no acervo, não há dica pelo perfil: vale a orientação padrão.
          </p>
        )}

        {/* O histórico do perfil: um registro por laudo, sem sobrescrever; a versão é quantos laudos o formam (GGVP-73, CA3). */}
        <h3 className={styles.secao}>
          Histórico do perfil · {perfil.versao} laudos
        </h3>
        <ul className={styles.lista} aria-label="Últimos laudos do perfil">
          {perito.laudos
            .slice(-5)
            .reverse()
            .map((l) => (
              <li key={l.id}>
                • {dataCurta(l.data, hojeIso(agora()))} · {l.caso} · {l.assunto} · {l.resultado === 'favoravel' ? 'favorável' : 'desfavorável'}
              </li>
            ))}
        </ul>

        {processos.length > 0 && (
          <>
            <h3 className={styles.secao}>Processos com este perito</h3>
            <ul className={styles.processos}>
              {processos.map((p) => (
                <li key={p.processoId}>
                  <a className={styles.processo} href={`/casos/${p.processoId}/pericia`}>
                    <span>
                      <strong>{p.cliente}</strong> · {p.sub} <span aria-hidden="true">›</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className={styles.pe}>
        <p className={styles.nota}>
          Números calculados pelo sistema a partir do acervo. A IA só resume o que os documentos dizem. Nada disto vai ao cliente com amostra pequena (G22).
        </p>
        <button type="button" className={styles.botao} onClick={aoFechar}>
          Fechar
        </button>
      </div>
    </dialog>
  )
}
