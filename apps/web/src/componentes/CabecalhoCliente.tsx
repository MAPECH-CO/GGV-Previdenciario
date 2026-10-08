import type { Ficha } from '../dados/tipos.ts'
import { dataCurta, idadeEm } from '../regras/datas.ts'
import styles from './CabecalhoCliente.module.css'

/** "Antônio Exemplo" → "AE". */
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/)
  return (partes[0][0] + (partes.length > 1 ? partes.at(-1)![0] : '')).toUpperCase()
}

/** Topo do bloco de dados (Figma 73:215): iniciais, nome, idade e resumo, contato preferido e laudo novo. */
export function CabecalhoCliente({ ficha, hoje, laudoHref }: { ficha: Ficha; hoje: string; /** O aviso do laudo novo leva à análise do laudo (GGVP-86, CA5). */ laudoHref?: string }) {
  const idade = ficha.nascimento ? idadeEm(ficha.nascimento, hoje) : ficha.idade
  const linha = [idade !== undefined ? `${idade} anos` : '', ficha.resumo ?? ''].filter(Boolean).join(' · ')
  const preferido = ficha.contatoPreferido?.split(',')[0].trim()
  return (
    <div className={styles.cabecalho}>
      <span className={styles.avatar} aria-hidden="true">
        {iniciais(ficha.nome)}
      </span>
      <div className={styles.textos}>
        <h2 className={styles.nome}>{ficha.nome}</h2>
        {linha && <p className={styles.linha}>{linha}</p>}
        <p className={styles.chips}>
          {preferido && <span className={styles.chipOk}>{preferido} preferido</span>}
          {/* Ficha criada pelo scanner, que não lê telefone (GGVP-17, CA15). */}
          {!ficha.telefone && <span className={styles.chipAlerta}>completar telefone</span>}
          {ficha.laudoNovoEm &&
            (laudoHref ? (
              <a className={styles.chipAcento} href={laudoHref}>
                Laudo novo · {dataCurta(ficha.laudoNovoEm, hoje)}
              </a>
            ) : (
              <span className={styles.chipAcento}>Laudo novo · {dataCurta(ficha.laudoNovoEm, hoje)}</span>
            ))}
        </p>
      </div>
      {/* Foto do cliente é de outra história: avisa que está indisponível. */}
      <button type="button" className={styles.foto} aria-disabled="true">
        Trocar foto
      </button>
    </div>
  )
}
