import { useRef, useState } from 'react'
import passo from '../paginas/Balcao.module.css'
import { salvarCondicoes, type Contrato } from '../dados/contrato.ts'
import { nomeBeneficio } from '../dados/catalogos.ts'
import { PASTA_DOS_MODELOS, linhaDoBeneficio, modeloPorId, type CondicoesDoKit } from '../regras/contrato.ts'
import styles from './CartaoKit.module.css'

type Props = {
  processoId: string
  beneficio: string
  contrato: Contrato
  /** O kit só muda antes de gerar o contrato. */
  editavel: boolean
  aoMudar: (contrato: Contrato) => void
}

const CONDICOES: { id: keyof CondicoesDoKit; rotulo: string }[] = [
  { id: 'representado', rotulo: 'O cliente é representado pelo genitor ou pela genitora' },
  { id: 'moradia', rotulo: 'O comprovante de residência não está no nome do cliente' },
  { id: 'uniaoEstavel', rotulo: 'Vive em união estável' },
  { id: 'separacaoDeFato', rotulo: 'É casado(a) no papel, mas separado(a) de fato' },
]

/** "Kit do benefício" (GGVP-65): os documentos da tabela do escritório, o modelo, quem assina e as condições do LOAS. */
export function CartaoKit({ processoId, beneficio, contrato, editavel, aoMudar }: Props) {
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const travado = useRef(false)
  const { kit } = contrato

  async function salvar(acao: () => Promise<Contrato>) {
    if (travado.current) return
    travado.current = true
    setSalvando(true)
    setErro('')
    try {
      aoMudar(await acao())
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para salvar.')
    } finally {
      travado.current = false
      setSalvando(false)
    }
  }

  if (!kit) {
    return (
      <section className={passo.cartao} aria-labelledby="kit-titulo">
        <h2 id="kit-titulo" className={passo.cartaoTitulo}>
          Kit do benefício
        </h2>
        <p className={passo.aviso}>
          {nomeBeneficio(beneficio) || 'Este benefício'} ainda não tem kit cadastrado. A gestão cadastra na configuração do escritório; até
          lá, nada é gerado para o cliente assinar.
        </p>
      </section>
    )
  }

  const modelo = modeloPorId(kit.modelo)
  const loas = linhaDoBeneficio(beneficio)?.loas === true
  return (
    <section className={passo.cartao} aria-labelledby="kit-titulo">
      <h2 id="kit-titulo" className={passo.cartaoTitulo}>
        Kit do benefício
      </h2>
      <p className={styles.linha}>
        <strong>{kit.nome}</strong> · modelo {modelo.nome} · pasta {PASTA_DOS_MODELOS}
      </p>
      <ul className={styles.documentos} aria-label="Documentos do kit">
        {kit.documentos.map((d) => (
          <li key={d.id} className={styles.documento}>
            <span className={styles.marca} aria-hidden="true">
              ✓
            </span>
            <span>
              {d.nome}
              {d.detalhe && <span className={styles.detalhe}> · {d.detalhe}</span>}
            </span>
            {d.condicional && <span className={styles.selo}>condição do caso</span>}
          </li>
        ))}
      </ul>
      <p className={styles.assinam}>Assinam: {kit.assinam.join(' e ')}.</p>

      {loas && (
        <fieldset className={styles.condicoes} disabled={!editavel || salvando}>
          <legend className={styles.legenda}>Condições do caso (LOAS)</legend>
          <p className={styles.ajuda}>A ficha de grupo familiar vai em todo LOAS. Marque o que vale para este caso: o kit se monta de novo.</p>
          {CONDICOES.map((c) => (
            <label key={c.id} className={styles.condicao}>
              <input
                type="checkbox"
                checked={contrato.condicoes[c.id]}
                onChange={(e) => salvar(() => salvarCondicoes(processoId, { ...contrato.condicoes, [c.id]: e.target.checked }))}
              />
              {c.rotulo}
            </label>
          ))}
        </fieldset>
      )}

      {salvando && <p className={passo.motivo}>salvando…</p>}
      {erro && (
        <p role="alert" className={passo.motivo}>
          {erro}
        </p>
      )}
    </section>
  )
}
