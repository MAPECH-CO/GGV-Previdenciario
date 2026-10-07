import { useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'
import { hojeIso, isoParaData } from '@ggv/campos'
import { AgendarIdaAoBanco, CANAIS_DE_AVISO, RegistrarEnvio, type IdaAoBancoDoCaso } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import styles from './Passo.module.css'

const ROTULO_CANAL = { whatsapp: 'WhatsApp', telefone: 'Telefone', email: 'E-mail', sms: 'SMS' } as const

/**
 * Avisar resultado e agendar a ida ao banco (GGVP-44 e GGVP-98, Financeiro; Lucas, 06/10): data, hora, local e quem do
 * Atendimento leva o cliente, todos obrigatórios (CA6). Depois, a mensagem do modelo para revisar e enviar; o portal registra
 * o envio (CA5). Feita a ida, "Confirmar recebimento" fecha o caso (CA9).
 */
export function IdaAoBanco({ casoId }: { casoId: string }) {
  const ids = { data: useId(), hora: useId(), local: useId(), acompanhante: useId(), canal: useId() }
  const [b, setB] = useState<IdaAoBancoDoCaso | null>(null)
  const [versao, setVersao] = useState(0)
  const [data, setData] = useState('')
  const [hora, setHora] = useState('')
  const [local, setLocal] = useState('')
  const [acompanhanteId, setAcompanhanteId] = useState('')
  const [canal, setCanal] = useState('whatsapp')
  const [erro, setErro] = useState('')
  const [feito, setFeito] = useState('')

  useEffect(() => {
    void chamarApi<IdaAoBancoDoCaso>(`/casos/${casoId}/banco`).then((r) => (r.ok ? setB(r.dados) : setErro(r.erro)))
  }, [casoId, versao])

  async function agendar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const corpo = { data: isoParaData(data) ?? '', hora, local, acompanhanteId }
    const entrada = AgendarIdaAoBanco.safeParse(corpo)
    if (!entrada.success) return setErro(entrada.error.issues[0]?.message ?? 'Confira os campos.')
    const r = await chamarApi(`/casos/${casoId}/banco`, { method: 'POST', corpo })
    if (!r.ok) return setErro(r.erro)
    setErro('')
    setFeito(b?.agendamento ? 'Remarcado. O Financeiro já vê a nova data; avise o cliente de novo.' : 'Agendado. Agora revise a mensagem e avise o cliente.')
    setVersao((v) => v + 1)
  }

  async function registrarEnvio() {
    const entrada = RegistrarEnvio.safeParse({ canal })
    if (!entrada.success) return setErro(entrada.error.issues[0]?.message ?? 'Escolha o canal')
    const r = await chamarApi(`/casos/${casoId}/banco/envio`, { method: 'POST', corpo: entrada.data })
    if (!r.ok) return setErro(r.erro)
    setErro('')
    setFeito('Envio registrado. O caso entrou no acervo como processo bom.')
    setVersao((v) => v + 1)
  }

  async function confirmar() {
    const r = await chamarApi(`/casos/${casoId}/banco/confirmacao`, { method: 'POST', corpo: {} })
    if (!r.ok) return setErro(r.erro)
    setErro('')
    setFeito('Recebimento confirmado. Caso encerrado.')
    setVersao((v) => v + 1)
  }

  if (!b)
    return (
      <main className={styles.pagina}>
        <title>Avisar e agendar a ida ao banco · GGV Previdenciário</title>
        {erro && (
          <p className={styles.erro} role="alert">
            {erro}
          </p>
        )}
      </main>
    )

  return (
    <main className={styles.pagina}>
      <title>Avisar e agendar a ida ao banco · GGV Previdenciário</title>
      <a className={styles.voltar} href="/">
        ← Voltar ao início
      </a>
      <h1 className={styles.titulo}>Avisar resultado e agendar a ida ao banco</h1>
      <p className={styles.subtitulo}>{b.cliente}</p>

      {b.agendamento && (
        <section className={styles.cartao} aria-label="Agendada">
          <span className={styles.selo}>
            {b.agendamento.data} às {b.agendamento.hora} · {b.agendamento.local} · leva: {b.agendamento.acompanhante ?? '—'}
          </span>
        </section>
      )}

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

      {b.podeAgendar ? (
        <form className={styles.cartao} onSubmit={agendar} noValidate>
          <h2 className={styles.cartaoTitulo}>{b.agendamento ? 'Remarcar' : 'Agendar'}</h2>
          <label className={styles.rotulo} htmlFor={ids.data}>
            Data
          </label>
          <input id={ids.data} className={styles.campo} type="date" min={hojeIso()} value={data} onChange={(e) => setData(e.target.value)} />
          <label className={styles.rotulo} htmlFor={ids.hora}>
            Hora
          </label>
          <input id={ids.hora} className={styles.campo} type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
          <label className={styles.rotulo} htmlFor={ids.local}>
            Agência ou local
          </label>
          <input id={ids.local} className={styles.campo} value={local} onChange={(e) => setLocal(e.target.value)} />
          <label className={styles.rotulo} htmlFor={ids.acompanhante}>
            Quem do Atendimento leva o cliente
          </label>
          <select id={ids.acompanhante} className={styles.campo} value={acompanhanteId} onChange={(e) => setAcompanhanteId(e.target.value)}>
            <option value="">Escolha</option>
            {b.equipe.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
          <div className={styles.acoes}>
            <button type="submit" className={styles.botao}>
              {b.agendamento ? 'Remarcar' : 'Agendar'}
            </button>
          </div>
        </form>
      ) : (
        !b.encerrado && <p className={styles.dica}>A ida ao banco é agendada depois que o Financeiro recebe a prestação.</p>
      )}

      {b.agendamento && (
        <section className={styles.cartao} aria-label="Aviso ao cliente">
          <h2 className={styles.cartaoTitulo}>Aviso ao cliente</h2>
          {!b.okAdvogada && <p className={styles.dica}>O aviso só sai depois do OK da advogada na prestação de contas (G8).</p>}
          {b.mensagem ? (
            <>
              <p className={styles.dica}>Revise o texto, envie pelo celular e registre aqui.</p>
              <blockquote className={styles.cartao} aria-label="Mensagem">
                {b.mensagem}
              </blockquote>
              <label className={styles.rotulo} htmlFor={ids.canal}>
                Canal
              </label>
              <select id={ids.canal} className={styles.campo} value={canal} onChange={(e) => setCanal(e.target.value)}>
                {CANAIS_DE_AVISO.map((c) => (
                  <option key={c} value={c}>
                    {ROTULO_CANAL[c]}
                  </option>
                ))}
              </select>
              <div className={styles.acoes}>
                <button type="button" className={styles.botao} disabled={!b.okAdvogada} onClick={() => void registrarEnvio()}>
                  Revisei e enviei
                </button>
              </div>
            </>
          ) : (
            !b.modeloCadastrado && <p className={styles.dica}>Modelo "Confirmação da ida ao banco" não cadastrado.</p>
          )}
          {b.avisos.length > 0 && (
            <ol className={styles.lista} aria-label="Avisos enviados">
              {b.avisos.map((a) => (
                <li key={a.quando}>
                  {new Date(a.quando).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })} ·{' '}
                  {ROTULO_CANAL[a.canal as keyof typeof ROTULO_CANAL] ?? a.canal} · {a.quem}
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {b.podeConfirmar && (
        <section className={styles.cartao} aria-label="Confirmar recebimento">
          <p className={styles.dica}>Depois da ida ao banco, confirme que o cliente recebeu. O caso fecha.</p>
          <div className={styles.acoes}>
            <button type="button" className={styles.botao} onClick={() => void confirmar()}>
              Confirmar recebimento
            </button>
          </div>
        </section>
      )}
      {b.encerrado && <span className={styles.selo}>Recebimento confirmado · caso encerrado</span>}
    </main>
  )
}
