import { useEffect, useState } from 'react'
import { PeritoEscolhido } from '@ggv/contratos'
import { isoParaData } from '@ggv/campos'
import { chamarApi } from '../api.ts'
import { usePode, useSessao } from '../sessao.ts'
import type { ParecerNaTela } from '../dados/parecer.ts'
import type { PericiaNaTela } from '../dados/pericia.ts'
import styles from '../paginas/ProcessoPericia.module.css'
import passo from '../paginas/Balcao.module.css'

type Perito = { id: string; nome: string; especialidade: string; tipo: 'medica' | 'social' }

/** Complementos por rotas já existentes, sem buscar exemplos quando a API não responde. */
export function ComplementosDoProcesso({ casoId }: { casoId: string }) {
  const sessao = useSessao()
  const veSaude = usePode('dado_saude.ver_detalhe')
  const orienta = usePode('pericia.orientar_cliente')
  const confereResultado = usePode('pericia.conferir_resultado')
  const [laudo, setLaudo] = useState<string | null | undefined>(undefined)
  const [avisoLaudo, setAvisoLaudo] = useState('')
  const [pericia, setPericia] = useState<PericiaNaTela | null>(null)
  const [peritos, setPeritos] = useState<Perito[]>([])
  const [avisoPerito, setAvisoPerito] = useState('Consultando a identificação do perito…')
  const [gravando, setGravando] = useState(false)

  useEffect(() => {
    let atual = true
    if (!sessao) return
    void chamarApi<ParecerNaTela>(`/processos/${casoId}/parecer`).then(r => {
      if (!atual) return
      if (!r.ok || !r.dados.processo) { setAvisoLaudo('A consulta de laudo novo está indisponível.'); return }
      setLaudo(r.dados.laudoNovoEm ?? null)
    }).catch(() => { if (atual) setAvisoLaudo('Não foi possível consultar se há laudo novo.') })
    if (veSaude) void chamarApi<PericiaNaTela>(`/processos/${casoId}/pericia`).then(async r => {
      if (!atual) return
      if (!r.ok || !r.dados.pericia) { setAvisoPerito(r.ok || r.status !== 404 ? 'A identificação do perito está indisponível.' : 'Não há perícia disponível para identificar o perito.'); return }
      setPericia(r.dados)
      setAvisoPerito('')
      if (!r.dados.pericia.peritoId) {
        const lista = await chamarApi<Perito[]>('/peritos')
        if (!atual) return
        if (lista.ok && Array.isArray(lista.dados)) setPeritos(lista.dados.filter(p => p.tipo === r.dados.pericia.tipo))
        else setAvisoPerito('A lista de peritos está indisponível.')
      }
    }).catch(() => { if (atual) setAvisoPerito('Não foi possível consultar a identificação do perito.') })
    return () => { atual = false }
  }, [casoId, sessao, veSaude])

  const laudoSemPerito = pericia?.pericia.resultado?.noPerfil === 'aguardando-perito'
  const podeLigar = laudoSemPerito ? confereResultado : orienta
  async function identificar(id: string) {
    if (gravando || !podeLigar) return
    const entrada = PeritoEscolhido.safeParse({ peritoId: id })
    if (!entrada.success) return
    setGravando(true)
    setAvisoPerito('')
    try {
      const r = await chamarApi<PericiaNaTela>(`/processos/${casoId}/pericia/${laudoSemPerito ? 'laudo/perito' : 'perito'}`, { method: 'POST', corpo: entrada.data })
      if (!r.ok || !r.dados.pericia?.peritoId) { setAvisoPerito('O servidor não confirmou a identificação do perito.'); return }
      setPericia(r.dados)
      setAvisoPerito('Perito identificado no processo.')
    } catch {
      setAvisoPerito('Não foi possível confirmar a identificação do perito. Consulte a perícia antes de repetir.')
    } finally { setGravando(false) }
  }

  if (!sessao) return null
  return <>
    {veSaude && <section className={styles.cartao} aria-label="Estratégia do processo">
      <h2 className={styles.cartaoTitulo}>Estratégia</h2>
      <p>A consulta e a edição da estratégia ainda não estão disponíveis para este processo.</p>
    </section>}
    <section className={styles.cartao} aria-label="Laudo novo do processo">
      <h2 className={styles.cartaoTitulo}>Laudo novo</h2>
      <p>{avisoLaudo || (laudo === undefined ? 'Consultando se há laudo novo…' : laudo ? `Há laudo novo desde ${isoParaData(laudo) ?? 'data não informada'}, aguardando análise.` : 'Nenhum laudo novo aguardando análise.')}</p>
      {laudo && veSaude && <a href={`/casos/${casoId}/laudo-novo`}>Analisar o laudo novo</a>}
    </section>
    {veSaude && <section className={styles.cartao} aria-label="Identificação do perito">
      <h2 className={styles.cartaoTitulo}>{pericia?.pericia.peritoId ? 'Perito do processo' : 'Quem é o perito?'}</h2>
      {pericia?.pericia.peritoId ? <p>{pericia.perfil?.perito.nome ?? 'Perito identificado pelo servidor'}</p> : pericia && <>
        <p>{pericia.pericia.peritoLido ? `Nome lido, ainda não confirmado: ${pericia.pericia.peritoLido}.` : 'O perito ainda não foi identificado.'} Confira no documento antes de escolher.</p>
        {podeLigar ? <div className={passo.atalhos} role="group" aria-label="Identificar o perito no servidor">
          {peritos.map(p => <button type="button" key={p.id} className={passo.atalho} disabled={gravando} onClick={() => void identificar(p.id)}>{p.nome} · {p.especialidade}</button>)}
          {!peritos.length && <p>Nenhum perito disponível para escolher.</p>}
        </div> : <p>A identificação deve ser feita pela equipe responsável pela perícia.</p>}
      </>}
      {avisoPerito && <p role="status">{avisoPerito}</p>}
      {pericia && <a href={`/casos/${casoId}/pericia`}>Abrir a perícia</a>}
    </section>}
  </>
}
