import { useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'
import { AprovarResumo, CANAIS_DO_CONTATO, ROTULO_CANAL_DO_CONTATO, RegistrarContato, type ResultadoParaExplicar } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import styles from './Passo.module.css'

const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })

/**
 * Explicar o resultado ao cliente (GGVP-22). O Jurídico escreve e aprova o resumo, sem estratégia interna, e escolhe
 * quem fala (CA3, CA5); quem fala vê o resumo com o nome de quem aprovou e registra cada contato (CA4). Sem IA até 09/10.
 */
export function ExplicarResultado({ casoId }: { casoId: string }) {
  const ids = { texto: useId(), canal: useId(), explicado: useId() }
  const [r, setR] = useState<ResultadoParaExplicar | null>(null)
  const [versao, setVersao] = useState(0)
  const [texto, setTexto] = useState('')
  const [quemFala, setQuemFala] = useState('')
  const [canal, setCanal] = useState('telefone')
  const [explicado, setExplicado] = useState('')
  const [erro, setErro] = useState('')
  const [feito, setFeito] = useState('')

  useEffect(() => {
    void chamarApi<ResultadoParaExplicar>(`/casos/${casoId}/resultado`).then((x) => (x.ok ? setR(x.dados) : setErro(x.erro)))
  }, [casoId, versao])

  async function enviar(url: string, corpo: unknown, mensagem: string) {
    const x = await chamarApi(`/casos/${casoId}/resultado/${url}`, { method: 'POST', corpo })
    if (!x.ok) return setErro(x.erro)
    setErro('')
    setFeito(mensagem)
    setVersao((v) => v + 1)
  }

  function aprovar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const entrada = AprovarResumo.safeParse({ texto, quemFala: quemFala || undefined })
    if (!entrada.success) return setErro(entrada.error.issues[0]?.message ?? 'Confira o resumo.')
    void enviar('resumo', entrada.data, entrada.data.quemFala === 'advogada' ? 'Resumo aprovado. A explicação ficou com você.' : 'Resumo aprovado. O Atendimento vai explicar ao cliente.')
  }

  function contato(resultado: 'sem_contato' | 'explicado') {
    const entrada = RegistrarContato.safeParse(resultado === 'explicado' ? { resultado, canal, explicado } : { resultado, canal })
    if (!entrada.success) return setErro(entrada.error.issues[0]?.message ?? 'Confira o contato.')
    void enviar('contato', entrada.data, resultado === 'explicado' ? 'Explicação registrada. Caso encerrado.' : 'Tentativa registrada. A tarefa continua aberta.')
  }

  if (!r)
    return (
      <main className={styles.pagina}>
        <title>Explicar o resultado · GGV Previdenciário</title>
        {erro && (
          <p className={styles.erro} role="alert">
            {erro}
          </p>
        )}
      </main>
    )

  return (
    <main className={styles.pagina}>
      <title>Explicar o resultado · GGV Previdenciário</title>
      <a className={styles.voltar} href="/">
        ← Voltar ao início
      </a>
      <h1 className={styles.titulo}>Explicar o resultado ao cliente</h1>
      <p className={styles.subtitulo}>{r.cliente}</p>
      {r.encerrado && <span className={styles.selo}>Perdemos: estudo registrado</span>}

      {feito && (
        <p className={styles.sucesso} role="status">
          {feito}
        </p>
      )}
      {erro && (
        <p className={styles.erro} role="alert">
          {erro}
        </p>
      )}

      {r.resumo ? (
        <section className={styles.cartao} aria-label="Resumo para o cliente">
          <h2 className={styles.cartaoTitulo}>Resumo para o cliente</h2>
          <blockquote className={styles.cartao}>{r.resumo.texto}</blockquote>
          <p className={styles.dica}>
            Aprovado pelo Jurídico: {r.resumo.aprovadoPor} em {quando(r.resumo.aprovadoEm)} · fala com o cliente: {r.resumo.quemFala === 'advogada' ? 'a advogada' : 'o Atendimento'}
          </p>
        </section>
      ) : r.podeAprovar ? (
        <form className={styles.cartao} onSubmit={aprovar} noValidate>
          <h2 className={styles.cartaoTitulo}>Resumo para o cliente</h2>
          <p className={styles.dica}>Em linguagem simples e sem estratégia interna: é o que o cliente vai ouvir.</p>
          <label className={styles.rotulo} htmlFor={ids.texto}>
            O que dizer ao cliente
          </label>
          <textarea id={ids.texto} className={styles.campo} rows={5} value={texto} onChange={(e) => setTexto(e.target.value)} />
          <fieldset className={styles.cartao}>
            <legend className={styles.rotulo}>Quem fala com o cliente</legend>
            <label className={styles.escolha}>
              <input type="radio" name="quemFala" checked={quemFala === 'atendimento'} onChange={() => setQuemFala('atendimento')} />
              O Atendimento, no padrão
            </label>
            <label className={styles.escolha}>
              <input type="radio" name="quemFala" checked={quemFala === 'advogada'} onChange={() => setQuemFala('advogada')} />
              Eu ligo (caso complexo)
            </label>
          </fieldset>
          <div className={styles.acoes}>
            <button type="submit" className={styles.botao}>
              Aprovar o resumo
            </button>
          </div>
        </form>
      ) : (
        <p className={styles.dica}>O resumo ainda não foi aprovado pelo Jurídico.</p>
      )}

      {r.podeRegistrar && (
        <section className={styles.cartao} aria-label="Registrar o contato">
          <h2 className={styles.cartaoTitulo}>Contato com o cliente</h2>
          <label className={styles.rotulo} htmlFor={ids.canal}>
            Canal
          </label>
          <select id={ids.canal} className={styles.campo} value={canal} onChange={(e) => setCanal(e.target.value)}>
            {CANAIS_DO_CONTATO.map((c) => (
              <option key={c} value={c}>
                {ROTULO_CANAL_DO_CONTATO[c]}
              </option>
            ))}
          </select>
          <label className={styles.rotulo} htmlFor={ids.explicado}>
            O que foi explicado
          </label>
          <textarea id={ids.explicado} className={styles.campo} rows={3} value={explicado} onChange={(e) => setExplicado(e.target.value)} />
          <div className={styles.acoes}>
            <button type="button" className={styles.botao} onClick={() => contato('explicado')}>
              Expliquei ao cliente
            </button>
            <button type="button" className={styles.botaoSecundario} onClick={() => contato('sem_contato')}>
              Sem contato, tentar de novo
            </button>
          </div>
        </section>
      )}

      {r.contatos.length > 0 && (
        <ol className={styles.lista} aria-label="Contatos">
          {r.contatos.map((x) => (
            <li key={x.quando}>
              {quando(x.quando)} · {ROTULO_CANAL_DO_CONTATO[x.canal as keyof typeof ROTULO_CANAL_DO_CONTATO] ?? x.canal} · {x.quem} ·{' '}
              {x.explicado ?? 'sem contato'}
            </li>
          ))}
        </ol>
      )}
    </main>
  )
}
