import passo from '../paginas/Balcao.module.css'
import { isoParaData } from '../campos.ts'
import { MOTIVOS_DE_NAO_FECHAR } from '../dados/catalogos.ts'
import type { EsperaDoRecontato, PapelNoFechamento } from '../dados/tipos.ts'
import { DIAS_PARA_ESPERAR, DIAS_PARA_PENSAR, TAMANHO_DO_DETALHE, dataSugeridaDeRecontato } from '../regras/fechamento.ts'
import { soNumeroEMascara } from '../regras/formularios.ts'
import { Campo } from './Campo.tsx'
import styles from './CamposDoFechamento.module.css'

const PAPEIS = [
  { id: 'atendimento-senior', nome: 'Atendimento sênior' },
  { id: 'advogada-atendimento', nome: 'Advogada do atendimento' },
]

type Motivo = {
  motivo: string
  detalhe: string
  papel: PapelNoFechamento
  aoMudar: (campo: 'motivo' | 'detalhe' | 'papel', valor: string) => void
}

/** Motivo da lista (G16), quem registra a recusa do escritório (CA11) e o detalhe opcional (GGVP-60, CA6). */
export function CamposDoMotivo({ motivo, detalhe, papel, aoMudar }: Motivo) {
  return (
    <>
      <Campo id="motivo" rotulo="Motivo *" valor={motivo} opcoes={MOTIVOS_DE_NAO_FECHAR} aoMudar={(v) => aoMudar('motivo', v)} largo />
      {motivo === 'recusado' && (
        <Campo
          id="papel"
          rotulo="Quem registra a recusa *"
          valor={papel === 'atendimento' ? '' : papel}
          opcoes={PAPEIS}
          aoMudar={(v) => aoMudar('papel', v || 'atendimento')}
          dica="A recusa do escritório é registrada pelo Atendimento sênior ou pela advogada do atendimento."
          largo
        />
      )}
      <Campo
        id="detalhe"
        rotulo="Detalhe do motivo (opcional)"
        valor={detalhe}
        aoMudar={(v) => aoMudar('detalhe', v)}
        maxLength={TAMANHO_DO_DETALHE}
        placeholder="ex.: achou o valor alto e vai conversar com a família"
        largo
      />
    </>
  )
}

type Recontato = {
  data: string
  espera: EsperaDoRecontato | null
  hoje: string
  erro?: string
  aoMudar: (data: string, espera: EsperaDoRecontato | null) => void
  aoSair: () => void
}

/** "Recontatar em": a data, com a sugestão de 15 dias para quem ficou de pensar e 30 para quem pediu para esperar (CA12). */
export function CampoDoRecontato({ data, espera, hoje, erro, aoMudar, aoSair }: Recontato) {
  const sugerir = (e: EsperaDoRecontato) => aoMudar(isoParaData(dataSugeridaDeRecontato(hoje, e)) ?? '', e)
  return (
    <div className={styles.recontato}>
      <div className={passo.ladoOpcoes} role="radiogroup" aria-label="Por que recontatar">
        <button type="button" role="radio" className={passo.chip} aria-checked={espera === 'pensar'} onClick={() => sugerir('pensar')}>
          Ficou de pensar · {DIAS_PARA_PENSAR} dias
        </button>
        <button type="button" role="radio" className={passo.chip} aria-checked={espera === 'esperar'} onClick={() => sugerir('esperar')}>
          Pediu para esperar · {DIAS_PARA_ESPERAR} dias
        </button>
      </div>
      <Campo
        id="recontatar-em"
        rotulo="Recontatar em *"
        valor={data}
        aoMudar={(v) => aoMudar(soNumeroEMascara(v), espera)}
        aoSair={aoSair}
        erro={erro}
        inputMode="numeric"
        maxLength={10}
        placeholder={`dd/mm/aaaa · sugere ${DIAS_PARA_PENSAR} dias se ficou de pensar, ${DIAS_PARA_ESPERAR} se pediu para esperar`}
        largo
      />
    </div>
  )
}
