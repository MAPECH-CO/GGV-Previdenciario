import { useEffect, useRef } from 'react'
import { jurimetriaDoJuizoDoCaso, perfilDoPeritoDoCaso } from '../dados/caso.ts'
import { processosComOPerito } from '../dados/pericia.ts'
import { agora } from '../dados/servidor.ts'
import { hojeIso } from '../regras/datas.ts'
import { numerosDaJurimetria } from '../regras/pericia.ts'
import janelas from './DetalheCompromisso.module.css'
import styles from './JurimetriaPerito.module.css'

type Props = { tipo: 'perito' | 'juizo'; id: string; aoFechar: () => void }

/**
 * A jurimetria do perito ou do juízo numa sobreposição, sem sair do caso (GGVP-86, CA6; Figma 2184:2 a 2184:183). Os números
 * vêm do sistema, com o número de casos ao lado e sem amostra mínima (Lucas, 06/10); a IA só resume o que os documentos dizem.
 * Ponta para ligar: GGVP-59 (perito), GGVP-64 (juízo) e GGVP-131 (acervo que aprende).
 */
export function JurimetriaDoCaso({ tipo, id, aoFechar }: Props) {
  const janela = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialogo = janela.current
    // O jsdom dos testes não tem showModal: abre sem o fundo escuro.
    if (typeof dialogo?.showModal === 'function') {
      if (!dialogo.open) dialogo.showModal()
    } else dialogo?.setAttribute('open', '')
  }, [])

  const perfil = tipo === 'perito' ? perfilDoPeritoDoCaso(id) : null
  const juizo = tipo === 'juizo' ? jurimetriaDoJuizoDoCaso(id) : null
  const processos = perfil ? processosComOPerito(id).map((p) => ({ ...p, href: `/casos/${p.processoId}` })) : (juizo?.processos ?? []).map((p) => ({ ...p, href: `/casos/${p.processoId}` }))

  return (
    <dialog ref={janela} className={`${janelas.janela} ${styles.janela}`} aria-labelledby="jurimetria-titulo" onClose={aoFechar}>
      <div className={styles.cabeca}>
        <div>
          <p className={styles.linha}>
            <span className={styles.rotulo}>{tipo === 'perito' ? 'Perito' : 'Juízo'}</span>
            <strong id="jurimetria-titulo" className={styles.nome}>
              {perfil?.perito.nome ?? juizo?.juizo.nome ?? 'Não encontrado'}
            </strong>
          </p>
          <p className={styles.sub}>
            {perfil && `${perfil.perito.especialidade} · ${perfil.jurimetria.laudos} laudos no acervo`}
            {juizo && `${juizo.juizo.juiz} · ${juizo.numeros.casos} processos decididos no acervo`}
          </p>
        </div>
        <button type="button" className={janelas.fechar} aria-label="Fechar" onClick={aoFechar}>
          ×
        </button>
      </div>

      <div className={styles.corpo}>
        {perfil && (
          <>
            <h3 className={styles.secao}>Laudos favoráveis</h3>
            <dl className={styles.numeros}>
              <dt>Todos os laudos</dt>
              <dd>{numerosDaJurimetria(perfil.jurimetria, hojeIso(agora()))}</dd>
              {perfil.porAssunto.map((a) => (
                <div key={a.assunto} className={styles.par}>
                  <dt>{a.assunto.charAt(0).toUpperCase() + a.assunto.slice(1)}</dt>
                  <dd>{numerosDaJurimetria(a.jurimetria, hojeIso(agora()))}</dd>
                </div>
              ))}
              <dt>Tempo até o laudo</dt>
              <dd>{perfil.jurimetria.laudos ? `${perfil.jurimetria.diasAteOLaudo} dias em média · ${perfil.jurimetria.laudos} laudos` : '—'}</dd>
            </dl>
            <h3 className={styles.secao}>O que costuma observar e perguntar</h3>
            <ul className={styles.lista}>
              {[...perfil.observou, ...perfil.perguntou].map((p) => (
                <li key={p}>• {p.charAt(0).toUpperCase() + p.slice(1)}</li>
              ))}
            </ul>
          </>
        )}
        {juizo && (
          <>
            <h3 className={styles.secao}>Procedência por benefício</h3>
            <dl className={styles.numeros}>
              {juizo.numeros.porBeneficio.map((b) => (
                <div key={b.beneficio} className={styles.par}>
                  <dt>{b.nome}</dt>
                  <dd>{b.texto}</dd>
                </div>
              ))}
              <dt>Tempo até a sentença</dt>
              <dd>
                {juizo.numeros.mesesAteASentenca} meses em média · {juizo.numeros.casos} processos
              </dd>
            </dl>
            <h3 className={styles.secao}>Entendimentos recorrentes</h3>
            <ul className={styles.lista}>
              {juizo.juizo.entendimentos.map((e) => (
                <li key={e}>• {e}</li>
              ))}
            </ul>
          </>
        )}
        {processos.length > 0 && (
          <>
            <h3 className={styles.secao}>{tipo === 'perito' ? 'Processos com este perito' : 'Processos neste juízo'}</h3>
            <ul className={styles.processos}>
              {processos.map((p) => (
                <li key={p.processoId}>
                  <a className={styles.processo} href={p.href}>
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
          Números calculados pelo sistema a partir do acervo, com o número de casos ao lado; toda jurimetria do acervo conta. A IA só resume o que os documentos
          dizem.
        </p>
        <button type="button" className={styles.botao} onClick={aoFechar}>
          Fechar
        </button>
      </div>
    </dialog>
  )
}
