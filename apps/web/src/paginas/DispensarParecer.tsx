import { useEffect, useRef, useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { TopoPasso } from '../componentes/TopoPasso.tsx'
import { obterParecer, pedirDispensa, responderDispensa, type ParecerNaTela } from '../dados/parecer.ts'
import { usePerfil } from '../dados/perfis.ts'
import { agora } from '../dados/servidor.ts'
import { dataCurta, dataHora, hojeIso } from '../regras/datas.ts'
import { NOMES_DO_PARECER, TEXTO_MAXIMO_DO_PARECER, motivoParaNaoAprovarDispensa, motivoParaNaoPedirDispensa } from '../regras/parecer.ts'
import styles from './Balcao.module.css'
import proprio from './Parecer.module.css'

// Sem quadro da dispensa no Figma: visual das telas de passo, com o aviso do Parecer médico (1654:2) "Só a sênior dispensa o
// parecer, com justificativa". Duas sêniores de acordo (resposta do Lucas de 01/10, Q14). GGVP-33.

const SITUACOES: Record<string, string> = { ...NOMES_DO_PARECER, 'sem-documentos': 'Sem documentos', dispensado: 'Dispensado' }

export function DispensarParecer({ processoId }: { processoId: string }) {
  const perfil = usePerfil('Sênior')
  const senior = perfil?.id.startsWith('senior') === true
  const quem = { perfil: perfil?.id, nome: perfil?.usuario ?? 'Sênior' }
  const [p, setP] = useState<ParecerNaTela | null | undefined>(undefined)
  const [justificativa, setJustificativa] = useState('')
  const [aviso, setAviso] = useState('')
  const [erro, setErro] = useState('')
  const travado = useRef(false)
  const hoje = hojeIso(agora())

  useEffect(() => {
    let valendo = true
    obterParecer(processoId, 'juridico').then((x) => valendo && setP(x))
    return () => {
      valendo = false
    }
  }, [processoId])

  if (!p) {
    return (
      <main className={proprio.vazia}>
        <title>Dispensar o parecer médico · GGV Previdenciário</title>
        <h1 className={styles.titulo}>{p === null ? 'Caso não encontrado' : 'Abrindo o parecer…'}</h1>
        {p === null && <a href="/advogada">Voltar ao início</a>}
      </main>
    )
  }

  const { ficha, processo, beneficio, dispensa } = p
  const curta = (iso: string) => dataCurta(hojeIso(new Date(iso)), hoje)
  const esperando = dispensa && !dispensa.aprovadaPor && !dispensa.recusadaPor ? dispensa : undefined
  const motivoPedir = motivoParaNaoPedirDispensa(justificativa)
  const motivoAprovar = motivoParaNaoAprovarDispensa(esperando, quem.nome)

  async function agir(acao: () => Promise<ParecerNaTela>, ok: string) {
    if (travado.current) return
    travado.current = true
    setErro('')
    try {
      setP(await acao())
      setAviso(ok)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para registrar.')
    } finally {
      travado.current = false
    }
  }

  return (
    <>
      <title>{`${ficha.nome} · Dispensar o parecer médico · GGV Previdenciário`}</title>
      <TopoPasso contexto={`${processo.numero ? `Processo ${processo.numero} · ` : ''}${ficha.nome.split(' ')[0]}`} inicio={perfil?.inicio ?? '/advogada'} />
      <main className={styles.pagina}>
        <div className={styles.principal}>
          <div className={styles.cabecalho}>
            <div className={styles.chips}>
              <span className={styles.codigo} title="D1.24 · Liberar ao Jurídico (passo do BPMN)">
                D1.24
              </span>
              <span className={styles.codigo}>G17</span>
              <span className={proprio.senior}>Sênior</span>
              <span className={styles.beneficio}>◆ {beneficio}</span>
            </div>
            <h1 className={styles.titulo}>
              <strong>{ficha.nome}</strong> · Dispensar o parecer médico
            </h1>
            <p className={styles.subtitulo}>{beneficio} · só a sênior, com duas aprovações e justificativa</p>
          </div>

          <section className={styles.cartao} aria-labelledby="situacao">
            <h2 id="situacao" className={styles.cartaoTitulo}>
              Situação do parecer
            </h2>
            <p>
              <span className={proprio[p.situacao === 'sem-documentos' ? 'pendente' : p.situacao === 'dispensado' ? 'suficiente' : p.situacao]}>
                {SITUACOES[p.situacao]}
              </span>{' '}
              {p.confirmado ? `confirmado por ${p.confirmado.quem} em ${curta(p.confirmado.quando)}` : 'sem confirmação do Jurídico'}
            </p>
            {p.faltaPedir.length > 0 && <p className={proprio.detalhe}>Falta: {p.faltaPedir.join(' · ')}</p>}
            <a className={styles.atalho} href={`/casos/${processo.id}/parecer`}>
              Abrir o parecer
            </a>
          </section>

          <p className={styles.aviso}>
            Dispensar é seguir sem a prova médica e assumir o risco. Uma pessoa sozinha não decide: precisa de duas sêniores de acordo, e a justificativa e as
            duas aprovações ficam no histórico (G17).
          </p>

          {aviso && (
            <p role="status" className={styles.aviso}>
              {aviso}
            </p>
          )}

          {!senior ? (
            <p className={styles.trava}>Só a sênior dispensa o parecer médico. Você está como {perfil?.rotulo ?? 'outro perfil'}.</p>
          ) : p.situacao === 'dispensado' && dispensa ? (
            <section className={styles.feito} aria-labelledby="dispensado">
              <h2 id="dispensado" className={styles.feitoTitulo}>
                ✓ Parecer dispensado
              </h2>
              <p>
                Pedido por {dispensa.pedidaPor} em {dataHora(dispensa.pedidaEm)} e aprovado por {dispensa.aprovadaPor} em {dataHora(dispensa.aprovadaEm!)}.
                Justificativa: {dispensa.justificativa}. A liberação e os passos seguintes já veem a dispensa.
              </p>
            </section>
          ) : p.situacao === 'suficiente' ? (
            <p className={styles.motivo}>O parecer está Suficiente: não há o que dispensar.</p>
          ) : esperando ? (
            <section className={styles.cartao} aria-labelledby="segunda">
              <h2 id="segunda" className={styles.cartaoTitulo}>
                Segunda aprovação
              </h2>
              <p>
                {esperando.pedidaPor} pediu a dispensa em {dataHora(esperando.pedidaEm)}. Justificativa: {esperando.justificativa}
              </p>
              <div className={styles.rodape}>
                <button
                  type="button"
                  className={styles.principalBotao}
                  disabled={motivoAprovar !== null}
                  onClick={() => agir(() => responderDispensa(processoId, true, quem), 'Dispensa aprovada pela segunda sênior.')}
                >
                  Aprovar a dispensa (2ª sênior)
                </button>
                <button
                  type="button"
                  className={styles.atalho}
                  disabled={motivoAprovar !== null}
                  onClick={() => agir(() => responderDispensa(processoId, false, quem), 'Dispensa recusada: o caso continua esperando o parecer.')}
                >
                  Recusar
                </button>
                {motivoAprovar && <p className={styles.motivo}>{motivoAprovar}</p>}
              </div>
            </section>
          ) : (
            <section className={styles.cartao} aria-labelledby="pedir">
              <h2 id="pedir" className={styles.cartaoTitulo}>
                Pedir a dispensa
              </h2>
              {dispensa?.recusadaPor && (
                <p className={proprio.detalhe}>
                  O último pedido, de {dispensa.pedidaPor}, foi recusado por {dispensa.recusadaPor}.
                </p>
              )}
              <label className={proprio.campo}>
                Justificativa: por que seguir sem a prova médica *
                <textarea rows={4} maxLength={TEXTO_MAXIMO_DO_PARECER} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
              </label>
              <div className={styles.rodape}>
                <button
                  type="button"
                  className={styles.principalBotao}
                  disabled={motivoPedir !== null}
                  onClick={() => agir(() => pedirDispensa(processoId, justificativa, quem), 'Pedido registrado: falta a aprovação de outra sênior.')}
                >
                  Pedir a dispensa (1ª sênior)
                </button>
                {motivoPedir && <p className={styles.motivo}>{motivoPedir}</p>}
              </div>
            </section>
          )}
          {erro && (
            <p role="alert" className={styles.motivo}>
              {erro}
            </p>
          )}
        </div>

        <aside className={styles.lado} aria-labelledby="antes-de-concluir">
          <h2 id="antes-de-concluir" className={styles.ladoTitulo}>
            Antes de concluir
          </h2>
          <p className={styles.ladoSub}>O portão do parecer médico (G17) nos passos D1.24, D2.01 e D3.05.</p>
          <h3 className={styles.ladoSecao}>Campos</h3>
          <p>• Justificativa: por que seguir sem a prova médica*</p>
          <h3 className={styles.ladoSecao}>Travas</h3>
          <p className={styles.ladoSub}>A segunda aprovação é de outra sênior: quem pediu não aprova.</p>
          <h3 className={styles.ladoSecao}>Como segue</h3>
          <p>Aprovada, a dispensa vale na liberação ao Jurídico, na aprovação para o INSS e no pedido da petição, até um parecer novo ser registrado.</p>
        </aside>
      </main>
      <AbaSuporte />
    </>
  )
}
