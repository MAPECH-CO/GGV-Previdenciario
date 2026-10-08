import { useEffect, useRef, useState } from 'react'
import { criarCompromissoInterno } from '../dados/agenda.ts'
import { EQUIPE } from '../dados/catalogos.ts'
import { buscarNoBalcao } from '../dados/servidor.ts'
import type { ResultadoBusca } from '../dados/tipos.ts'
import { DURACOES } from '../regras/agenda.ts'
import { erroDataDoCompromisso, soNumeroEMascara } from '../regras/formularios.ts'
import { dataParaIso, normalizarData } from '../campos.ts'
import { Campo } from './Campo.tsx'
import styles from './NovoEvento.module.css'

type Props = { hoje: string; aoCriado: () => void; aoFechar: () => void; navegar: (url: string) => void }

const RESPONSAVEIS = EQUIPE.filter((m) => m.papel !== 'captador').map((m) => ({ id: m.id, nome: m.nome }))

/** "+ Novo evento" (Figma 1941:2): a entrevista de um cliente vai para a tela de marcar (CA1); o interno nasce aqui (CA5). */
export function NovoEvento({ hoje, aoCriado, aoFechar, navegar }: Props) {
  const janela = useRef<HTMLDialogElement>(null)
  const [modo, setModo] = useState<'entrevista' | 'interno'>('entrevista')
  const [termo, setTermo] = useState('')
  const [achados, setAchados] = useState<ResultadoBusca[]>([])
  const [titulo, setTitulo] = useState('')
  const [data, setData] = useState('')
  const [hora, setHora] = useState('')
  const [duracao, setDuracao] = useState('60')
  const [responsavel, setResponsavel] = useState('atendimento')
  const [erros, setErros] = useState<{ titulo?: string; data?: string; hora?: string }>({})
  const [salvando, setSalvando] = useState(false)
  const travado = useRef(false)

  useEffect(() => {
    const dialogo = janela.current
    // O jsdom dos testes não tem showModal: abre sem o fundo escuro.
    if (typeof dialogo?.showModal === 'function') {
      if (!dialogo.open) dialogo.showModal()
    } else dialogo?.setAttribute('open', '')
  }, [])

  useEffect(() => {
    if (termo.trim().length < 2) return
    let valendo = true
    buscarNoBalcao(termo).then((lista) => {
      if (valendo) setAchados(lista)
    })
    return () => {
      valendo = false
    }
  }, [termo])

  async function salvar() {
    if (travado.current) return
    const novos = {
      titulo: titulo.trim().length >= 3 ? undefined : 'Escreva o título, com 3 letras ou mais.',
      data: erroDataDoCompromisso(data, hoje),
      hora: /^([01]\d|2[0-3]):[0-5]\d$/.test(hora) ? undefined : 'Escolha a hora.',
    }
    setErros(novos)
    if (novos.titulo || novos.data || novos.hora) return
    travado.current = true
    setSalvando(true)
    try {
      await criarCompromissoInterno({ titulo, data: dataParaIso(normalizarData(data))!, hora, duracao: Number(duracao), responsavel })
      aoCriado()
    } finally {
      travado.current = false
      setSalvando(false)
    }
  }

  return (
    <dialog ref={janela} className={styles.janela} aria-labelledby="novo-evento" onClose={aoFechar}>
      <div className={styles.cabeca}>
        <h2 id="novo-evento" className={styles.titulo}>
          Novo evento
        </h2>
        <button type="button" className={styles.fechar} aria-label="Fechar" onClick={aoFechar}>
          ×
        </button>
      </div>
      <div className={styles.modos} role="radiogroup" aria-label="Que evento">
        {(['entrevista', 'interno'] as const).map((m) => (
          <button key={m} type="button" role="radio" aria-checked={modo === m} className={styles.modo} onClick={() => setModo(m)}>
            {m === 'entrevista' ? 'Entrevista com um cliente' : 'Compromisso interno'}
          </button>
        ))}
      </div>
      {modo === 'entrevista' ? (
        <div className={styles.corpo}>
          <input
            className={styles.busca}
            type="search"
            aria-label="Buscar o cliente por nome, CPF ou telefone"
            placeholder="Buscar o cliente por nome, CPF ou telefone"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
          />
          {termo.trim().length >= 2 && (
            <ul className={styles.achados} aria-label="Clientes encontrados">
              {achados.map((p) => (
                <li key={p.id}>
                  <button type="button" className={styles.pessoa} onClick={() => navegar(`/agenda/marcar/${p.id}`)}>
                    <strong>{p.nome}</strong> · {p.etapa}
                  </button>
                </li>
              ))}
              {achados.length === 0 && <li className={styles.nada}>Ninguém com esse nome, CPF ou telefone.</li>}
            </ul>
          )}
        </div>
      ) : (
        <div className={styles.corpo}>
          <Campo id="evento-titulo" rotulo="Título *" valor={titulo} aoMudar={setTitulo} erro={erros.titulo} maxLength={80} largo />
          <div className={styles.linha}>
            <Campo
              id="evento-data"
              rotulo="Data * (dd/mm/aaaa)"
              valor={data}
              aoMudar={(v) => setData(soNumeroEMascara(v))}
              aoSair={() => setErros((e) => ({ ...e, data: erroDataDoCompromisso(data, hoje) }))}
              erro={erros.data}
              inputMode="numeric"
              maxLength={10}
            />
            <Campo id="evento-hora" rotulo="Hora *" valor={hora} aoMudar={setHora} erro={erros.hora} tipo="time" />
            <Campo id="evento-duracao" rotulo="Duração" valor={duracao} aoMudar={setDuracao} opcoes={DURACOES.map((d) => ({ id: String(d), nome: `${d} min` }))} />
          </div>
          <Campo id="evento-responsavel" rotulo="Responsável" valor={responsavel} aoMudar={setResponsavel} opcoes={RESPONSAVEIS} />
          <div className={styles.pe}>
            <button type="button" className={styles.cancelar} onClick={aoFechar}>
              Cancelar
            </button>
            <button type="button" className={styles.salvar} disabled={salvando} onClick={salvar}>
              {salvando ? 'salvando…' : 'Pôr na agenda'}
            </button>
          </div>
        </div>
      )}
    </dialog>
  )
}
