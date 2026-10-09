import { useEffect, useId, useState } from 'react'
import { confirmarMudancaBancaria, obterDadosBancarios, pedirMudancaBancaria, type PedidoBancario, type RegistroBancario } from '../dados/seguranca.ts'
import { dataHora } from '../regras/datas.ts'
import { COMO_VERIFICOU, erroDosDadosBancarios, motivoParaNaoMudar, type ComoVerificou, type DadosBancarios } from '../regras/seguranca.ts'
import { Cartao } from './Cartao.tsx'
import styles from './CartaoDadosBancarios.module.css'

type Props = { fichaId: string; /** Mudou: quem abriu relê a ficha (o histórico). */ aoMudar: () => void }

const VAZIO: DadosBancarios = { banco: '', agencia: '', conta: '', pix: '' }

const lido = (d: DadosBancarios) => `${d.banco} · agência ${d.agencia} · conta ${d.conta}${d.pix ? ` · Pix: ${d.pix}` : ''}`

/**
 * "Dados bancários para o repasse" no card do cliente (GGVP-111): mudam só com o cliente verificado e em contrato novo
 * (CA1), com a segunda confirmação de outra pessoa e o aviso ao contato anterior (CA5); perto da prestação de contas, a
 * advogada e o Financeiro recebem o alerta (CA2). Sem quadro no Figma: no visual dos cartões do card (73:199).
 */
export function CartaoDadosBancarios({ fichaId, aoMudar }: Props) {
  const id = useId()
  const [atual, setAtual] = useState<RegistroBancario | null>(null)
  const [pedido, setPedido] = useState<PedidoBancario | null>(null)
  const [mudando, setMudando] = useState(false)
  const [dados, setDados] = useState<DadosBancarios>(VAZIO)
  const [verificacao, setVerificacao] = useState<{ como?: ComoVerificou; contratoNovo?: true }>({})
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')

  async function recarregar() {
    const r = await obterDadosBancarios(fichaId)
    setAtual(r.atual)
    setPedido(r.pedido)
  }

  useEffect(() => {
    let valendo = true
    // A ficha da semente não está no banco: a API recusa e o cartão fica sem dados.
    obterDadosBancarios(fichaId)
      .then((r) => {
        if (!valendo) return
        setAtual(r.atual)
        setPedido(r.pedido)
      })
      .catch(() => undefined)
    return () => {
      valendo = false
    }
  }, [fichaId])

  const motivo = erroDosDadosBancarios(dados) ?? motivoParaNaoMudar('dadosBancarios', verificacao)

  async function fazer(acao: () => Promise<unknown>, feito: string) {
    if (ocupado) return
    setOcupado(true)
    setErro('')
    try {
      await acao()
      await recarregar()
      setMudando(false)
      setDados(VAZIO)
      setVerificacao({})
      setAviso(feito)
      aoMudar()
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não deu para registrar.')
    } finally {
      setOcupado(false)
    }
  }

  const campo = (chave: keyof DadosBancarios, rotulo: string, extra: { inputMode?: 'numeric'; placeholder?: string } = {}) => (
    <label className={styles.campo} htmlFor={`${id}-${chave}`}>
      {rotulo}
      <input id={`${id}-${chave}`} className={styles.entrada} value={dados[chave] ?? ''} onChange={(e) => setDados((d) => ({ ...d, [chave]: e.target.value }))} {...extra} />
    </label>
  )

  return (
    <Cartao titulo="Dados bancários para o repasse">
      <p className={styles.texto}>{atual ? `${lido(atual)} · desde ${dataHora(atual.desde).slice(0, 10)}` : 'Nenhum dado bancário cadastrado.'}</p>
      <p className={styles.nota}>O repasse vai por Pix para a conta cadastrada (RPV) ou na ida ao banco com o cliente (administrativo).</p>

      {pedido ? (
        <div className={styles.pedido} role="group" aria-label="Mudança dos dados bancários">
          <p>
            <strong>Mudança pedida</strong> por {pedido.pediu} em {dataHora(pedido.pedidoEm)}: {lido(pedido.dados)} ·{' '}
            {COMO_VERIFICOU[pedido.verificacao.como].toLowerCase()}; em contrato novo.
          </p>
          <p className={styles.nota}>Espera a segunda confirmação, de outra pessoa (Atendimento líder, advogada ou Sênior).</p>
          <button type="button" className={styles.botao} disabled={ocupado} onClick={() => fazer(() => confirmarMudancaBancaria(fichaId), 'Dados bancários mudados. O contato anterior recebeu o aviso pelo Chatwoot.')}>
            Confirmar a mudança (segunda pessoa)
          </button>
        </div>
      ) : mudando ? (
        <div className={styles.pedido} role="group" aria-label="Mudar dados bancários">
          <div className={styles.linha}>
            {campo('banco', 'Banco *')}
            {campo('agencia', 'Agência *', { inputMode: 'numeric', placeholder: '0001' })}
            {campo('conta', 'Conta com dígito *', { placeholder: '12345-6' })}
          </div>
          {campo('pix', 'Chave Pix (opcional)')}
          <p className={styles.legenda}>Como você confirmou que é o cliente?</p>
          <div className={styles.opcoes} role="radiogroup" aria-label="Como você confirmou que é o cliente?">
            {(Object.keys(COMO_VERIFICOU) as ComoVerificou[]).map((como) => (
              <label key={como} className={styles.opcao}>
                <input type="radio" name={`${id}-como`} checked={verificacao.como === como} onChange={() => setVerificacao((v) => ({ ...v, como }))} />
                {COMO_VERIFICOU[como]}
              </label>
            ))}
          </div>
          <label className={styles.opcao}>
            <input type="checkbox" checked={verificacao.contratoNovo === true} onChange={(e) => setVerificacao((v) => ({ ...v, contratoNovo: e.target.checked ? true : undefined }))} />
            A alteração vai em contrato novo
          </label>
          {motivo && <p className={styles.motivo}>{motivo}</p>}
          <div className={styles.acoes}>
            <button
              type="button"
              className={styles.principal}
              disabled={motivo !== null || ocupado}
              onClick={() => fazer(() => pedirMudancaBancaria(fichaId, { dados, verificacao }), 'Mudança pedida: espera a segunda confirmação.')}
            >
              Pedir a mudança
            </button>
            <button type="button" className={styles.botao} onClick={() => setMudando(false)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className={styles.botao} onClick={() => (setMudando(true), setAviso(''))}>
          Mudar dados bancários
        </button>
      )}
      {erro && (
        <p role="alert" className={styles.motivo}>
          {erro}
        </p>
      )}
      <p role="status" className={styles.nota}>
        {aviso}
      </p>
    </Cartao>
  )
}
