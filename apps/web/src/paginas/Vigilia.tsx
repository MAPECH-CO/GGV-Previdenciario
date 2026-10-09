import { useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'
import { hojeIso, isoParaData } from '@ggv/campos'
import { nomeDoBeneficio, EncerrarCaso, RespostaDoInss, type VigiliaDoCaso } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import { usePode } from '../sessao.ts'
import styles from './Passo.module.css'
import { PrestarContas } from './PrestarContas.tsx'
import { TratarExigencia } from './TratarExigencia.tsx'

type Tipo = 'deferido' | 'indeferido' | 'exigencia'
const dia = (iso: string) => new Date(iso).toLocaleDateString('pt-BR')

/** GGVP-48: a Sênior pode encerrar o indeferido em vez de levar à Justiça, com o motivo. */
export function EncerrarSemJudicializar({ casoId, aoEncerrar }: { casoId: string; aoEncerrar: () => void }) {
  const idMotivo = useId()
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState('')

  async function encerrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const entrada = EncerrarCaso.safeParse({ motivo })
    if (!entrada.success) return setErro(entrada.error.issues[0]?.message ?? 'Escreva o motivo.')
    const r = await chamarApi(`/casos/${casoId}/encerrar`, { method: 'POST', corpo: entrada.data })
    if (!r.ok) return setErro(r.erro)
    aoEncerrar()
  }

  return (
    <form className={styles.cartao} onSubmit={encerrar} noValidate>
      <h2 className={styles.cartaoTitulo}>Encerrar sem judicializar</h2>
      <label className={styles.rotulo} htmlFor={idMotivo}>
        Por que o caso é encerrado
      </label>
      <textarea id={idMotivo} className={styles.campo} rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      {erro && (
        <p className={styles.erro} role="alert">
          {erro}
        </p>
      )}
      <div className={styles.acoes}>
        <button type="submit" className={styles.botaoSecundario}>
          Encerrar o caso
        </button>
      </div>
    </form>
  )
}

/**
 * Vigília do Meu INSS (GGVP-35 e GGVP-48). A consulta ao INSS é manual: quem olhou registra aqui a decisão
 * (com a comunicação anexada) ou a exigência (texto e data). O sistema abre o próximo passo; o servidor confere de novo.
 */
export function Vigilia({ casoId }: { casoId: string }) {
  const ids = { texto: useId(), data: useId(), motivo: useId(), meuMotivo: useId(), arquivo: useId(), diferente: useId() }
  const [caso, setCaso] = useState<VigiliaDoCaso | null>(null)
  const [tipo, setTipo] = useState<Tipo | null>(null)
  const [texto, setTexto] = useState('')
  const [data, setData] = useState(() => hojeIso()) // calendário do navegador, já em hoje; aceita datas anteriores, não futuras
  const [motivoInss, setMotivoInss] = useState('')
  const [motivoEscrito, setMotivoEscrito] = useState('')
  const [diferente, setDiferente] = useState(false)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [erro, setErro] = useState('')
  const [feito, setFeito] = useState('')
  const [enviando, setEnviando] = useState(false)
  // Ajuste do Mateus (06/10): depois de registrar, o passo seguinte da advogada pode ser feito aqui mesmo.
  const [seguir, setSeguir] = useState<'exigencia' | 'prestacao' | null>(null)
  const podeTratar = usePode('exigencia_inss.tratar')
  const podePrestar = usePode('prestacao.dar_ok')

  const [versao, setVersao] = useState(0) // muda depois de registrar: recarrega a situação e os registros

  useEffect(() => {
    void chamarApi<VigiliaDoCaso>(`/casos/${casoId}/vigilia`).then((r) => (r.ok ? setCaso(r.dados) : setErro(r.erro)))
  }, [casoId, versao])

  async function registrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const campos =
      tipo === 'exigencia'
        ? { tipo, texto, data: isoParaData(data) ?? '' }
        : {
            tipo: 'decisao',
            resultado: tipo ?? undefined,
            texto,
            diferenteDoPedido: diferente,
            motivoInss: tipo === 'indeferido' ? motivoInss : undefined,
            motivoEscrito: tipo === 'indeferido' ? motivoEscrito : undefined,
          }
    const entrada = RespostaDoInss.safeParse(campos)
    if (!entrada.success) return setErro(entrada.error.issues[0]?.message ?? 'Confira os campos.')
    if (tipo !== 'exigencia' && !arquivo)
      return setErro(tipo === 'indeferido' ? 'Anexe a carta de indeferimento (PDF ou imagem, até 25 MB).' : 'Anexe a comunicação do INSS (PDF ou imagem, até 25 MB).')
    const dados = new FormData()
    for (const [k, v] of Object.entries(campos)) if (v !== undefined) dados.set(k, String(v))
    if (arquivo) dados.set('arquivo', arquivo)
    setEnviando(true)
    const r = await chamarApi<{ aberto: string }>(`/casos/${casoId}/vigilia`, { method: 'POST', corpo: dados })
    setEnviando(false)
    if (!r.ok) return setErro(r.erro)
    setErro('')
    setFeito(
      {
        prestacao: 'Deferido registrado. O sistema abriu "Prestar contas" para a advogada.',
        analise: 'Deferido diferente do pedido. O sistema abriu a análise para a advogada.',
        justica: 'Indeferido registrado com o seu motivo. O caso foi para a Justiça e a Sênior recebeu "Despachar caso".',
        exigencia: 'Exigência registrada. O sistema abriu "Tratar exigência do INSS"; o caso continua vigiado.',
      }[r.dados.aberto] ?? 'Registrado.',
    )
    setSeguir(r.dados.aberto === 'exigencia' ? 'exigencia' : r.dados.aberto === 'prestacao' || r.dados.aberto === 'analise' ? 'prestacao' : null)
    setVersao((v) => v + 1)
  }

  if (!caso)
    return (
      <main className={styles.pagina}>
        <title>Vigília do INSS · GGV Previdenciário</title>
        {erro && (
          <p className={styles.erro} role="alert">
            {erro}
          </p>
        )}
      </main>
    )

  return (
    <main className={styles.pagina}>
      <title>Vigília do INSS · GGV Previdenciário</title>
      <a className={styles.voltar} href="/">
        ← Voltar ao início
      </a>
      <h1 className={styles.titulo}>Vigília do Meu INSS</h1>
      <p className={styles.subtitulo}>
        {caso.cliente} · {nomeDoBeneficio(caso.beneficio)} · <a href={`/casos/${casoId}/historico`}>Histórico do processo</a>
      </p>

      <section className={styles.cartao} aria-label="Situação">
        {caso.esperando && caso.desde ? (
          <span className={styles.selo}>
            Esperando: {caso.esperando} · desde {dia(caso.desde)}
          </span>
        ) : (
          <span className={styles.selo}>{caso.fase === 'judicial' ? 'Indeferido: o caso está na Justiça' : 'Sem espera do INSS aberta'}</span>
        )}
        <p className={styles.dica}>O INSS não avisa o escritório: alguém olha o Meu INSS e registra aqui o que viu.</p>
        {caso.registros.length > 0 && (
          <ol className={styles.lista} aria-label="Registros">
            {caso.registros.map((x) => (
              <li key={x.quando + x.tipo}>
                {dia(x.quando)} · {x.resumo} · {x.quem}
              </li>
            ))}
          </ol>
        )}
      </section>

      {feito && (
        <p className={styles.sucesso} role="status">
          {feito}
        </p>
      )}

      {caso.podeRegistrar && !seguir && (
        <form className={styles.cartao} onSubmit={registrar} noValidate>
          <h2 className={styles.cartaoTitulo}>O que o INSS respondeu?</h2>
          <fieldset className={styles.cartao}>
            <legend className={styles.rotulo}>Resposta</legend>
            {(
              [
                ['deferido', 'Deferido'],
                ['indeferido', 'Indeferido'],
                ['exigencia', 'Exigência'],
              ] as const
            ).map(([valor, rotulo]) => (
              <label key={valor} className={styles.escolha}>
                <input type="radio" name="tipo" checked={tipo === valor} onChange={() => setTipo(valor)} />
                {rotulo}
              </label>
            ))}
          </fieldset>
          <label className={styles.rotulo} htmlFor={ids.texto}>
            {tipo === 'exigencia' ? 'Texto da exigência' : 'Texto da comunicação do INSS'}
          </label>
          <textarea id={ids.texto} className={styles.campo} rows={4} value={texto} onChange={(e) => setTexto(e.target.value)} />
          {tipo === 'exigencia' && (
            <>
              <label className={styles.rotulo} htmlFor={ids.data}>
                Data da exigência
              </label>
              <input id={ids.data} className={styles.campo} type="date" max={hojeIso()} value={data} onChange={(e) => setData(e.target.value)} />
              <p className={styles.dica}>O prazo para cumprir fica "a calcular" até a regra de prazo entrar.</p>
            </>
          )}
          {tipo === 'deferido' && (
            <label className={styles.escolha} htmlFor={ids.diferente}>
              <input id={ids.diferente} type="checkbox" checked={diferente} onChange={(e) => setDiferente(e.target.checked)} />
              Deferido diferente do pedido
            </label>
          )}
          {tipo === 'indeferido' && (
            <>
              <label className={styles.rotulo} htmlFor={ids.motivo}>
                Motivo que consta no sistema do INSS
              </label>
              <input id={ids.motivo} className={styles.campo} value={motivoInss} onChange={(e) => setMotivoInss(e.target.value)} />
              <label className={styles.rotulo} htmlFor={ids.meuMotivo}>
                Motivo com as suas palavras
              </label>
              <textarea id={ids.meuMotivo} className={styles.campo} rows={3} value={motivoEscrito} onChange={(e) => setMotivoEscrito(e.target.value)} />
              <p className={styles.dica}>Por que o INSS negou, do jeito que você entendeu. Vai para o banco de motivos e para a Sênior despachar.</p>
            </>
          )}
          <label className={styles.rotulo} htmlFor={ids.arquivo}>
            {tipo === 'indeferido' ? 'Carta de indeferimento' : tipo === 'exigencia' ? 'Comunicação do INSS (opcional)' : 'Comunicação do INSS'}
          </label>
          <input id={ids.arquivo} type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
          {erro && (
            <p className={styles.erro} role="alert">
              {erro}
            </p>
          )}
          <div className={styles.acoes}>
            <button type="submit" className={styles.botao} disabled={!tipo || enviando}>
              Registrar
            </button>
          </div>
        </form>
      )}

      {seguir === 'exigencia' && podeTratar && (
        <>
          <p className={styles.dica}>Pode tratar a exigência aqui mesmo, ou depois: a tarefa ficou na sua Central.</p>
          <TratarExigencia casoId={casoId} embutida />
        </>
      )}
      {seguir === 'prestacao' && podePrestar && (
        <>
          <p className={styles.dica}>Pode prestar contas aqui mesmo, ou depois: a tarefa ficou na sua Central.</p>
          <PrestarContas casoId={casoId} embutida />
        </>
      )}

      {caso.podeEncerrar && <EncerrarSemJudicializar casoId={casoId} aoEncerrar={() => {
            setFeito('Caso encerrado sem judicializar.')
            setVersao((v) => v + 1)
          }} />}
    </main>
  )
}
