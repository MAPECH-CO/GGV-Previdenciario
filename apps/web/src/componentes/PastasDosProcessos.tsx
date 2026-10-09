import { nomeBeneficio, nomeTipo } from '../dados/catalogos.ts'
import type { Ficha } from '../dados/tipos.ts'
import { dataCurta } from '../regras/datas.ts'
import { Cartao } from './Cartao.tsx'
import { ListaDatada } from './ListaDatada.tsx'
import styles from './PastasDosProcessos.module.css'

/** O resto da pasta do cliente no Drive: uma subpasta por processo (GGVP-17, CA14). Não está no Figma; o cartão pede. */
export function PastasDosProcessos({ ficha, hoje }: { ficha: Ficha; hoje: string }) {
  if (ficha.processos.length === 0) return null
  return (
    <Cartao titulo="Pastas dos processos">
      {ficha.processos.map((p) => {
        const beneficio = nomeBeneficio(p.beneficio)
        const arquivos = ficha.arquivos.filter((a) => a.local === p.id)
        return (
          <div key={p.id} className={styles.subpasta}>
            <h3 className={styles.titulo}>◆ {beneficio}</h3>
            <ListaDatada
              nome={`Subpasta ${beneficio}`}
              vazio="Nenhum arquivo nesta subpasta ainda."
              itens={arquivos.map((a, i) => ({
                chave: `${a.nome}-${i}`,
                quando: dataCurta(a.data, hoje),
                rotulo: [nomeTipo(a.tipo), a.repetido && 'repetido', a.aguardaLeitura && 'aguarda a leitura'].filter(Boolean).join(' · '),
                texto: a.nome,
              }))}
            />
          </div>
        )
      })}
    </Cartao>
  )
}
