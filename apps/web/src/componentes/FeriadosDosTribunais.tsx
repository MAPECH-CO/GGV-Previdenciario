import { useEffect, useId, useState } from 'react'
import { ANOS_DE_FERIADOS, FeriadosDoEscritorio, TRIBUNAIS_CONHECIDOS, type TribunalConhecido } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import { isoParaData, normalizarData, validarData } from '../campos.ts'
import styles from '../paginas/Passo.module.css'

// GGVP-146, parte 3: os feriados e as suspensões dos tribunais, na Configuração do escritório. A contagem de prazo usa
// esta lista (os nacionais e os do tribunal do processo). A gestão vê; a Sênior e o Sócio mantêm; tudo no histórico.

const NACIONAL = 'nacional'
const momento = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })
const TRIBUNAIS = Object.entries(TRIBUNAIS_CONHECIDOS) as [TribunalConhecido, string][]

export function FeriadosDosTribunais() {
  const ids = { tribunal: useId(), ano: useId(), data: useId(), onde: useId(), descricao: useId() }
  const [dados, setDados] = useState<FeriadosDoEscritorio | null>(null)
  const [versao, setVersao] = useState(0)
  const [tribunal, setTribunal] = useState<string>(NACIONAL)
  const [ano, setAno] = useState<number>(ANOS_DE_FERIADOS[0])
  const [novo, setNovo] = useState({ data: '', onde: NACIONAL, descricao: '' })
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [feito, setFeito] = useState('')

  useEffect(() => {
    void chamarApi<unknown>('/configuracao/feriados').then((r) => {
      const lido = r.ok ? FeriadosDoEscritorio.safeParse(r.dados) : null
      if (lido?.success) setDados(lido.data)
      else setErro(r.ok ? 'Não deu para abrir os feriados.' : r.erro)
    })
  }, [versao])

  async function mudar(caminho: string, method: 'POST' | 'DELETE', aviso: (r: { acrescentados?: number }) => string, corpo?: object) {
    setEnviando(true)
    const r = await chamarApi<{ acrescentados?: number }>(caminho, { method, corpo })
    setEnviando(false)
    if (!r.ok) {
      setFeito('')
      setErro(r.erro)
      return false
    }
    setErro('')
    setFeito(aviso(r.dados))
    setVersao((v) => v + 1)
    return true
  }

  if (!dados) return erro ? <p className={styles.dica}>{erro}</p> : null
  const daLista = dados.feriados.filter((f) => (f.tribunal ?? NACIONAL) === tribunal && f.data.startsWith(String(ano)))
  const dataValida = validarData(normalizarData(novo.data))
  const nomeDe = (t: string) => (t === NACIONAL ? 'Nacional' : TRIBUNAIS_CONHECIDOS[t as TribunalConhecido])

  return (
    <section className={styles.cartao} aria-label="Feriados e suspensões dos tribunais">
      <h2 className={styles.cartaoTitulo}>Feriados e suspensões dos tribunais</h2>
      <p className={styles.dica}>
        A contagem dos prazos pula estes dias: os nacionais em todo processo e no prazo do INSS; os de um tribunal, só nos processos dele. Sem a lista,
        o prazo só pula sábado e domingo.
      </p>
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
      {dados.podeEditar && (
        <div className={styles.acoes}>
          <button
            type="button"
            className={styles.botao}
            disabled={enviando}
            onClick={() => void mudar('/configuracao/feriados/carga', 'POST', (r) => `Feriados da lei de ${ANOS_DE_FERIADOS.join(' e ')}: ${r.acrescentados} dia(s) acrescentado(s).`)}
          >
            Carregar os feriados da lei de {ANOS_DE_FERIADOS.join(' e ')}
          </button>
        </div>
      )}
      {dados.podeEditar && (
        <p className={styles.dica}>
          A carga traz o que a lei fixa: os nacionais, os da Justiça Federal e a suspensão do fim do ano no TJSP. O feriado da cidade da vara, o Corpus Christi
          e a suspensão de cada ano entram aqui embaixo.
        </p>
      )}

      <label className={styles.rotulo} htmlFor={ids.tribunal}>
        Tribunal
      </label>
      <select id={ids.tribunal} className={styles.campo} value={tribunal} onChange={(e) => setTribunal(e.target.value)}>
        <option value={NACIONAL}>Nacional</option>
        {TRIBUNAIS.map(([codigo, nome]) => (
          <option key={codigo} value={codigo}>
            {nome}
          </option>
        ))}
      </select>
      <label className={styles.rotulo} htmlFor={ids.ano}>
        Ano
      </label>
      <select id={ids.ano} className={styles.campo} value={ano} onChange={(e) => setAno(Number(e.target.value))}>
        {ANOS_DE_FERIADOS.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
      {daLista.length === 0 ? (
        <p className={styles.dica}>
          Nenhum dia de {nomeDe(tribunal)} em {ano}.
        </p>
      ) : (
        <ul className={styles.lista} aria-label={`Feriados de ${nomeDe(tribunal)} em ${ano}`}>
          {daLista.map((f) => (
            <li key={f.id}>
              {isoParaData(f.data)} · {f.descricao}
              {dados.podeEditar && (
                <button
                  type="button"
                  className={styles.botaoSecundario}
                  disabled={enviando}
                  aria-label={`Tirar ${isoParaData(f.data)} · ${f.descricao}`}
                  onClick={() => void mudar(`/configuracao/feriados/${f.id}`, 'DELETE', () => `Tirado: ${isoParaData(f.data)}.`)}
                >
                  Tirar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {dados.podeEditar && (
        <form
          aria-label="Acrescentar feriado ou suspensão"
          onSubmit={(e) => {
            e.preventDefault()
            void mudar('/configuracao/feriados', 'POST', () => `Acrescentado: ${normalizarData(novo.data)}.`, {
              data: normalizarData(novo.data),
              tribunal: novo.onde === NACIONAL ? null : novo.onde,
              descricao: novo.descricao,
            }).then((ok) => ok && setNovo((n) => ({ ...n, data: '', descricao: '' })))
          }}
        >
          <label className={styles.rotulo} htmlFor={ids.data}>
            Dia (dd/mm/aaaa)
          </label>
          <input
            id={ids.data}
            className={styles.campo}
            inputMode="numeric"
            maxLength={10}
            value={novo.data}
            aria-invalid={novo.data !== '' && !dataValida}
            onChange={(e) => setNovo({ ...novo, data: normalizarData(e.target.value) })}
          />
          <label className={styles.rotulo} htmlFor={ids.onde}>
            Vale para
          </label>
          <select id={ids.onde} className={styles.campo} value={novo.onde} onChange={(e) => setNovo({ ...novo, onde: e.target.value })}>
            <option value={NACIONAL}>Todos (nacional)</option>
            {TRIBUNAIS.map(([codigo, nome]) => (
              <option key={codigo} value={codigo}>
                {nome}
              </option>
            ))}
          </select>
          <label className={styles.rotulo} htmlFor={ids.descricao}>
            O que é
          </label>
          <input id={ids.descricao} className={styles.campo} maxLength={120} value={novo.descricao} onChange={(e) => setNovo({ ...novo, descricao: e.target.value })} />
          <div className={styles.acoes}>
            <button type="submit" className={styles.botao} disabled={enviando || !dataValida || novo.descricao.trim().length < 3}>
              Acrescentar
            </button>
          </div>
        </form>
      )}

      {dados.historico.length > 0 && (
        <>
          <h3 className={styles.rotulo}>Histórico dos feriados</h3>
          <ol className={styles.lista} aria-label="Histórico dos feriados">
            {dados.historico.map((h, i) => (
              <li key={`${h.quando}-${i}`}>
                {momento(h.quando)} · {h.quem} · {h.descricao}
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  )
}
