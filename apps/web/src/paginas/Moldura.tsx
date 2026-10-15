import type { ReactNode } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { DadosDoProcesso } from '../componentes/DadosDoProcesso.tsx'
import { Topbar } from '../componentes/Topbar.tsx'
import styles from './Passo.module.css'

const ITENS = [
  { id: 'inicio', rotulo: 'Início', href: '/' },
  { id: 'agenda', rotulo: 'Agenda', href: '/agenda' },
]

/**
 * Uma tela de passo inteira (11/10): o topo de toda tela, com o "Voltar", a coluna do passo e o Suporte. Antes era só a
 * coluna, com o "← Voltar ao início" escrito em cima.
 */
export function TelaDePasso({ children }: { children: ReactNode }) {
  // GGVP-86 CA14 (Pedro, 14/10): a tela de passo de um caso mora em /casos/<id>/...; ali, os dados do processo vêm no topo.
  const casoId = window.location.pathname.match(/^\/casos\/([0-9a-f-]{36})\//)?.[1]
  return (
    <>
      <Topbar itens={ITENS} ativo="" funcao="" voltar />
      <main className={styles.pagina}>
        {casoId && <DadosDoProcesso casoId={casoId} />}
        {children}
      </main>
      <AbaSuporte />
    </>
  )
}

/**
 * A moldura de uma tela de passo: a tela inteira (título da aba, o topo e o cabeçalho) ou, quando o passo segue
 * dentro de outra tela, um cartão com o título (ajuste do Mateus, 06/10: a resposta do INSS e o passo seguinte numa
 * tela só, se quem registrou quiser).
 */
export function Moldura({ titulo, cabecalho, embutida = false, children }: { titulo: string; cabecalho?: ReactNode; embutida?: boolean; children: ReactNode }) {
  if (embutida)
    return (
      <section className={styles.cartao} aria-label={titulo}>
        <h2 className={styles.cartaoTitulo}>{titulo}</h2>
        {children}
      </section>
    )
  return (
    <TelaDePasso>
      <title>{`${titulo} · GGV Previdenciário`}</title>
      {cabecalho}
      {children}
    </TelaDePasso>
  )
}
