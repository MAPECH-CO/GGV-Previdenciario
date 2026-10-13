import { useEffect, useState } from 'react'
import { isoParaData } from '@ggv/campos'
import { JurimetriaDoJuizo } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import type { PericiaNaTela } from '../dados/pericia.ts'
import { amostraPerito } from '../regras/amostraPerito.ts'
import { NOMES_DO_TIPO, O_QUE_LEVAR } from '../regras/pericia.ts'
import styles from '../paginas/Passo.module.css'

const data = (iso: string) => isoParaData(iso) ?? iso
const baseFalado = (n: number, base: string | null) => `${n} ${n === 1 ? 'caso' : 'casos'} · ${base ? 'base de ' + data(base).slice(0, 5) : 'base ainda indisponível'}`

/** Consultas próprias, sem espelho no navegador e sem completar a resposta com a semente. */
export function JusticaDoCaso({ processoId, veJurimetria, judicial = true }: { processoId: string; veJurimetria: boolean; judicial?: boolean }) {
  const [pericia, setPericia] = useState<PericiaNaTela | null>(null)
  const [juizo, setJuizo] = useState<JurimetriaDoJuizo | null>(null)
  const [erroPericia, setErroPericia] = useState('')
  const [erroJuizo, setErroJuizo] = useState('')
  const [abrirJuizo, setAbrirJuizo] = useState(false)
  const [abrirPerito, setAbrirPerito] = useState(false)
  useEffect(() => {
    if (!veJurimetria) return
    let atual = true
    void chamarApi<PericiaNaTela>(`/processos/${processoId}/pericia`).then(r => {
      if (!atual) return
      if (r.ok) setPericia(r.dados?.pericia ? r.dados : null)
      else if (r.status !== 404) setErroPericia('Não foi possível consultar a perícia agora.')
    }).catch(() => { if (atual) setErroPericia('Não foi possível consultar a perícia agora.') })
    if (veJurimetria && judicial) void chamarApi<unknown>(`/casos/${processoId}/juizo`).then(r => {
      if (!atual) return
      const dados = r.ok ? JurimetriaDoJuizo.safeParse(r.dados) : null
      if (dados?.success) setJuizo(dados.data)
      else setErroJuizo(r.ok ? 'Os dados do juízo ainda não estão disponíveis.' : r.erro)
    }).catch(() => { if (atual) setErroJuizo('Não foi possível consultar o juízo agora.') })
    return () => { atual = false }
  }, [processoId, veJurimetria, judicial])

  const p = pericia?.pericia
  const m = p?.marcacao
  const automatica = m?.origem === 'juizo' && m.registradaPor === 'Sistema'
  const perfil = veJurimetria ? pericia?.perfil : null
  const amostra = perfil ? amostraPerito(perfil.perito.laudos) : null

  if (!veJurimetria) return null
  return <section id="juizo-do-processo" className={styles.cartao} aria-label="Juízo e perícia do servidor">
    <h2 className={styles.cartaoTitulo}>Juízo e perícia</h2>
    {erroPericia && <p role="alert" className={styles.erro}>{erroPericia}</p>}
    {automatica && p && m && <div role="status">
      <p>O sistema marcou a perícia em {data(m.data)}, às {m.hora}, a partir da publicação{m.local ? ': ' + m.local : '.'}</p>
      <p>Preparar para a {NOMES_DO_TIPO[p.tipo]}: chegar 30 minutos antes; levar {O_QUE_LEVAR[p.tipo]}; responder com a verdade.</p>
      <a href={`/casos/${processoId}/pericia`}>Ver a perícia e a orientação</a>
    </div>}
    {veJurimetria && <>
      {erroJuizo && <p role="alert" className={styles.erro}>Jurimetria do juízo indisponível: {erroJuizo}</p>}
      {juizo && <>
        <button type="button" className={styles.botaoSecundario} aria-expanded={abrirJuizo} onClick={() => setAbrirJuizo(!abrirJuizo)}>
          {juizo.vara ?? juizo.juizo} · {juizo.juiz ?? 'Juiz ainda não identificado'} · {baseFalado(juizo.processos.length, juizo.base)}
        </button>
        {abrirJuizo && <section aria-label="Jurimetria do juízo">
          <h3>Procedência por benefício</h3>
          {juizo.porBeneficio.length === 0 && <p>Nenhum caso decidido no mérito nesta base.</p>}
          <ul className={styles.lista}>{juizo.porBeneficio.map(b => <li key={b.beneficio}>
            {b.nome}: {b.texto} · {baseFalado(b.decididos, juizo.base)}
          </li>)}</ul>
          {juizo.tempoAteASentenca && <p>Tempo até a sentença: {juizo.tempoAteASentenca.meses} meses · {baseFalado(juizo.tempoAteASentenca.processos, juizo.base)}</p>}
          {juizo.entendimentos.length > 0 && <><h3>Entendimentos recorrentes · confira as fontes</h3><ul>{juizo.entendimentos.map(e => <li key={e.texto}>{e.texto} · processos: {e.processos.join(', ')}</li>)}</ul></>}
          <ul aria-label="Casos da base do juízo">{juizo.processos.map(p => <li key={p.numeroCnj}>{p.numeroCnj} · {p.desfecho}</li>)}</ul>
        </section>}
      </>}
      {perfil && amostra ? <>
        <button type="button" className={styles.botaoSecundario} aria-expanded={abrirPerito} onClick={() => setAbrirPerito(!abrirPerito)}>
          {perfil.perito.nome} · {baseFalado(amostra.casos, amostra.base)}
        </button>
        {abrirPerito && <section aria-label="Perfil e jurimetria do perito">
          <h3>{perfil.perito.especialidade}</h3>
          <p>{perfil.perito.onde}</p>
          {amostra.base ? <>
            <p>Laudos favoráveis: {perfil.jurimetria.taxa}% · {perfil.jurimetria.favoraveis} de {perfil.jurimetria.laudos} laudos · {baseFalado(amostra.casos, amostra.base)}</p>
            <p>Tempo até o laudo: {perfil.jurimetria.diasAteOLaudo} dias em média · {baseFalado(amostra.casos, amostra.base)}</p>
            <p className={styles.dica}>A data da base é a do último laudo retornado pelo servidor. Um caso pode ter mais de um laudo.</p>
          </> : <p>Nenhum laudo no acervo; ainda não há taxa nem data de base.</p>}
          <h3>O que costuma observar, perguntar e pedir</h3>
          <ul>{[...perfil.observou, ...perfil.perguntou, ...perfil.pediu].map((texto, i) => <li key={i}>{texto}</li>)}</ul>
        </section>}
      </> : <p>Perfil e jurimetria do perito ainda não disponíveis para este caso.</p>}
      <p><a href="/peritos">Consultar cadastro de peritos</a></p>
    </>}
  </section>
}
