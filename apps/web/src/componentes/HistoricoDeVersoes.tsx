import { useEffect, useRef, useState } from 'react'
import { obterVersoes, voltarParaVersao } from '../dados/conversa.ts'
import { usePerfil } from '../dados/perfis.ts'
import type { Ficha } from '../dados/tipos.ts'
import { CAMPOS_DA_CONVERSA, papelDoPerfil, podeVoltarVersao, valorLido, type VersaoDoCampo } from '../regras/conversa.ts'
import { dataHora } from '../regras/datas.ts'
import styles from './HistoricoDeVersoes.module.css'

type Props = { ficha: Ficha; /** A função da tela, até a pessoa escolher outro perfil. */ funcao?: string; aoFechar: () => void }

const somaAoCaso = (campo: VersaoDoCampo['campo']) => campo === 'fato' || campo === 'documento'

/**
 * Figma "Overlay · Histórico do processo" (59:11), para os campos que a conversa mudou (GGVP-84, CA2): cada versão com quem
 * mudou e quando, da mais recente à mais antiga; a Sênior tem "Voltar para esta versão".
 */
export function HistoricoDeVersoes({ ficha, funcao = 'Atendimento', aoFechar }: Props) {
  const perfil = usePerfil(funcao)
  const janela = useRef<HTMLDialogElement>(null)
  const [versoes, setVersoes] = useState<VersaoDoCampo[] | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    const dialogo = janela.current
    // O jsdom dos testes não tem showModal: abre sem o fundo escuro.
    if (typeof dialogo?.showModal === 'function') {
      if (!dialogo.open) dialogo.showModal()
    } else dialogo?.setAttribute('open', '')
    let valendo = true
    obterVersoes(ficha.id).then((v) => {
      if (valendo) setVersoes(v)
    })
    return () => {
      valendo = false
    }
  }, [ficha.id])

  const senior = podeVoltarVersao(perfil?.id)
  const juridico = papelDoPerfil(perfil?.id) === 'juridico'
  const grupos = new Map<string, VersaoDoCampo[]>()
  for (const v of versoes ?? []) {
    const chave = [v.onde, v.processoId ?? '', v.campo].join('|')
    grupos.set(chave, [...(grupos.get(chave) ?? []), v])
  }
  const numero = ficha.processos[0]?.numero

  async function voltar(v: VersaoDoCampo, indice: number) {
    if (ocupado || !perfil) return
    setOcupado(true)
    setErro('')
    try {
      setVersoes(await voltarParaVersao({ fichaId: v.fichaId, processoId: v.processoId, onde: v.onde, campo: v.campo }, indice, { quem: perfil.usuario, perfil: perfil.id }))
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não deu para voltar a versão.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <dialog ref={janela} className={styles.janela} aria-labelledby="historico-versoes-titulo" onClose={aoFechar}>
      <header className={styles.cabeca}>
        <div>
          <h2 id="historico-versoes-titulo" className={styles.titulo}>
            Histórico do processo <span className={styles.selo}>histórico</span>
          </h2>
          <p className={styles.sub}>{[numero, ficha.nome, 'campos mudados pela conversa · do mais recente ao mais antigo'].filter(Boolean).join(' · ')}</p>
        </div>
        <button type="button" className={styles.fechar} aria-label="Fechar" onClick={aoFechar}>
          ×
        </button>
      </header>
      {erro && (
        <p role="alert" className={styles.erro}>
          {erro}
        </p>
      )}
      {versoes && grupos.size === 0 && <p className={styles.nota}>Nenhum campo mudou pela conversa ainda.</p>}
      {[...grupos.values()].map((lista) => {
        const { onde, campo } = lista[0]
        const rotulo = CAMPOS_DA_CONVERSA[campo]
        const oculto = campo === 'fato' && !juridico
        return (
          <section key={`${onde}-${lista[0].processoId}-${campo}`} className={styles.campo} aria-label={`${onde === 'ficha' ? 'Ficha' : 'Processo'} · ${rotulo}`}>
            <h3 className={styles.campoTitulo}>
              {onde === 'ficha' ? 'Ficha' : 'Processo'} · {rotulo}
            </h3>
            <ol className={styles.versoes}>
              {lista
                .map((v, indice) => ({ v, indice }))
                .reverse()
                .map(({ v, indice }) => (
                  <li key={indice} className={styles.versao}>
                    <span className={styles.ponto} aria-hidden="true" />
                    <span className={styles.quando}>
                      {dataHora(v.quando)} · {v.quem}
                      {indice === lista.length - 1 && !somaAoCaso(campo) ? ' · em vigor' : ''}
                    </span>
                    <span>{oculto ? 'fato novo de saúde · só o Jurídico vê' : valorLido(campo, v.valor)}</span>
                    {senior && indice < lista.length - 1 && !somaAoCaso(campo) && (
                      <button
                        type="button"
                        className={styles.voltar}
                        disabled={ocupado}
                        aria-label={`Voltar ${rotulo} para a versão de ${dataHora(v.quando)}`}
                        onClick={() => voltar(v, indice)}
                      >
                        Voltar para esta versão
                      </button>
                    )}
                  </li>
                ))}
            </ol>
          </section>
        )
      })}
      <p className={styles.nota}>
        A IA só muda o que foi dito; o valor antigo fica aqui e {senior ? 'você pode voltar a versão' : 'a Sênior pode voltar a versão'} (G14).
      </p>
    </dialog>
  )
}
