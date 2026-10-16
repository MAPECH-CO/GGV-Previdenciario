import { useEffect, useState, type ReactNode } from 'react'
import { nomeBeneficio } from '../dados/catalogos.ts'
import { agora, obterFicha } from '../dados/servidor.ts'
import type { Ficha } from '../dados/tipos.ts'
import { emAberto } from '../regras/busca.ts'
import { dataCurta, hojeIso } from '../regras/datas.ts'
import { usePode } from '../sessao.ts'
import { Previa } from './Previa.tsx'
import estilo from './Previa.module.css'

/** As fichas já lidas, por id: passar de novo pela mesma linha não busca de novo. Falha sai do mapa para tentar outra vez. */
const lidas = new Map<string, Promise<Ficha | null>>()

function fichaDoMapa(id: string): Promise<Ficha | null> {
  let ficha = lidas.get(id)
  if (!ficha) {
    ficha = obterFicha(id)
    lidas.set(id, ficha)
    void ficha.catch(() => lidas.delete(id))
  }
  return ficha
}

/** "11988887777" → "(11) 98888-7777". */
function telefoneBonito(t: string): string {
  if (t.length === 11) return `(${t.slice(0, 2)}) ${t.slice(2, 7)}-${t.slice(7)}`
  if (t.length === 10) return `(${t.slice(0, 2)}) ${t.slice(2, 6)}-${t.slice(6)}`
  return t
}

/** O que a prévia mostra do cliente; o balão da tarefa usa também. */
export function ConteudoDoCliente({ id }: { id: string }) {
  const [ficha, setFicha] = useState<Ficha | null | undefined>(undefined)
  const [falhou, setFalhou] = useState(false)

  useEffect(() => {
    let valendo = true
    fichaDoMapa(id).then(
      (f) => {
        if (valendo) setFicha(f)
      },
      () => {
        if (valendo) setFalhou(true)
      },
    )
    return () => {
      valendo = false
    }
  }, [id])

  if (falhou || ficha === null) return <p className={estilo.linha}>Não deu para carregar a prévia.</p>
  if (ficha === undefined) return <p className={estilo.linha}>Carregando…</p>

  const hoje = hojeIso(agora())
  const proximo = ficha.agendamentos
    .filter((a) => a.data >= hoje && emAberto(a))
    .sort((a, b) => a.data.localeCompare(b.data) || a.hora.localeCompare(b.hora))[0]

  return (
    <>
      <p className={estilo.linha}>
        {ficha.situacao === 'cliente' ? 'Cliente' : 'Lead'}
        {ficha.telefone && ` · ${telefoneBonito(ficha.telefone)}`}
      </p>
      {ficha.processos.slice(0, 2).map((p) => (
        <p key={p.id} className={estilo.linha}>
          {nomeBeneficio(p.beneficio)} · {p.etapa}
        </p>
      ))}
      {proximo && (
        <p className={estilo.linha}>
          {proximo.oQue} · {dataCurta(proximo.data, hoje)} {proximo.hora}
          {proximo.com ? ` · ${proximo.com}` : ''}
        </p>
      )}
    </>
  )
}

type Props = { id: string; nome: string; children: ReactNode }

/** O que carregar do cliente ao passar o mouse. Sem permissão de ver o caso, devolve o link sem prévia. */
export function PreviaDoCliente({ id, nome, children }: Props) {
  const pode = usePode('caso.ver')
  if (!pode) return <>{children}</>
  return <Previa rotulo={nome} conteudo={() => <ConteudoDoCliente id={id} />}>{children}</Previa>
}
