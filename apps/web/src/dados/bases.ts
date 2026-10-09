// Clientes e Processos (GGVP-78): as duas listas vêm do servidor, já filtradas e na página pedida.
import { useEffect, useState } from 'react'
import { chamarApi } from '../api.ts'

export type Filtros = Record<string, string | number | undefined>

/** Com o termo da busca, POST: o CPF não vai no endereço (como a busca do balcão). Sem ele, GET com os filtros. */
export function consultarBase<T>(lista: 'clientes' | 'processos', filtros: Filtros) {
  const valendo = Object.fromEntries(
    Object.entries(filtros)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)]),
  )
  return valendo.busca ? chamarApi<T>(`/${lista}/busca`, { method: 'POST', corpo: valendo }) : chamarApi<T>(`/${lista}?${new URLSearchParams(valendo)}`)
}

/**
 * "Exportar CSV": separado por ponto e vírgula, com BOM, para o Excel em português abrir com acento. Texto que começa
 * com = + - @ ganha um apóstrofo, para o Excel não rodar como fórmula.
 */
export function baixarCsv(arquivo: string, linhas: (string | number | null)[][]) {
  const celula = (v: string | number | null) => `"${String(v ?? '').replace(/^[=+\-@\t\r]/, "'$&").replaceAll('"', '""')}"`
  const texto = '\uFEFF' + linhas.map((l) => l.map(celula).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = arquivo
  a.click()
  URL.revokeObjectURL(url)
}

/** As opções que o servidor mandou, com "Todos" na frente. */
export const comTodos = (lista: string[], todos = 'Todos'): [string, string][] => [['', todos], ...lista.map((o): [string, string] => [o, o])]

/** O termo vale depois de uma pausa na digitação, e com 2 caracteres ou mais (menos que isso a busca do balcão não acha). */
export function useTermo(busca: string) {
  const [termo, setTermo] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setTermo(busca.trim().length >= 2 ? busca.trim() : ''), 300)
    return () => clearTimeout(t)
  }, [busca])
  return termo
}

export const plural = (n: number, palavra: string) => `${n.toLocaleString('pt-BR')} ${palavra}${n === 1 ? '' : 's'}`
