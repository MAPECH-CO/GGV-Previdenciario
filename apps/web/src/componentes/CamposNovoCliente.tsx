import { somenteDigitos } from '../campos.ts'
import { FONTES } from '../dados/catalogos.ts'
import { soNumeroEMascara, type ValoresNovoCliente } from '../regras/formularios.ts'
import { Campo } from './Campo.tsx'
import styles from './CamposNovoCliente.module.css'
import { EscolhaBeneficio } from './EscolhaBeneficio.tsx'

type Nome = keyof ValoresNovoCliente

type Props = {
  valores: ValoresNovoCliente
  erros: Partial<Record<Nome, string>>
  aoMudar: (campo: Nome, valor: string) => void
  aoSair: (campo: Nome) => void
}

// Letra não entra no CPF, no telefone nem na idade (CA15).
const LIMPAR: Partial<Record<Nome, (valor: string) => string>> = { cpf: soNumeroEMascara, telefone: soNumeroEMascara, idade: somenteDigitos }

/** Os campos de "Dados mínimos" (Figma 73:386). "O que a pessoa pretende *" vem do cartão (CA3), embora o Figma não o desenhe. */
export function CamposNovoCliente({ valores, erros, aoMudar, aoSair }: Props) {
  const ligar = (campo: Nome) => ({
    id: `novo-${campo}`,
    valor: valores[campo],
    erro: erros[campo],
    aoMudar: (valor: string) => aoMudar(campo, LIMPAR[campo]?.(valor) ?? valor),
    aoSair: () => aoSair(campo),
  })
  return (
    <>
      <div className={styles.linha}>
        <Campo {...ligar('nome')} rotulo="Nome completo *" maxLength={120} />
        <Campo {...ligar('cpf')} rotulo="CPF (opcional)" inputMode="numeric" maxLength={14} />
        <Campo {...ligar('idade')} rotulo="Idade *" inputMode="numeric" maxLength={3} />
      </div>
      <div className={styles.linha}>
        <Campo {...ligar('telefone')} rotulo="Telefone / WhatsApp *" inputMode="tel" maxLength={15} />
        <Campo {...ligar('email')} rotulo="E-mail (opcional)" inputMode="email" maxLength={120} />
      </div>
      <div className={styles.linha}>
        <Campo {...ligar('pretende')} rotulo="O que a pessoa pretende *" maxLength={500} largo />
      </div>
      <div className={styles.linha}>
        <Campo {...ligar('comoChegou')} rotulo="Como chegou (lista do escritório)" opcoes={FONTES} />
        {valores.comoChegou === 'indicacao' && <Campo {...ligar('indicadoPor')} rotulo="Quem indicou *" maxLength={120} />}
        <Campo {...ligar('cidadeUf')} rotulo="Cidade / UF" maxLength={80} />
      </div>
      <EscolhaBeneficio valor={valores.beneficioInteresse} aoMudar={(id) => aoMudar('beneficioInteresse', id)} />
      <p className={styles.nota}>A IA sugere o benefício depois da conversa; quem decide é a advogada (G3).</p>
      <div className={styles.linha}>
        <Campo {...ligar('observacao')} rotulo="Observação" maxLength={1000} largo />
      </div>
    </>
  )
}
