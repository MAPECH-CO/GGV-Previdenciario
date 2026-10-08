import { useEffect, useRef, useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { InstrucoesPasso } from '../componentes/InstrucoesPasso.tsx'
import { TopoPasso } from '../componentes/TopoPasso.tsx'
import { formatarTelefone } from '../campos.ts'
import { MINIMO_DO_MOTIVO, confirmarPresenca, obterPericia, registrarComparecimento, remarcarPericia, type PericiaNaTela } from '../dados/pericia.ts'
import { usePerfil } from '../dados/perfis.ts'
import { agora } from '../dados/servidor.ts'
import { dataCurta, dataHora, hojeIso } from '../regras/datas.ts'
import { HORA_DA_CONFIRMACAO, LIMITE_DE_REMARCACOES_DA_PERICIA, NOMES_DA_INSTANCIA, NOMES_DO_TIPO } from '../regras/pericia.ts'
import styles from './Balcao.module.css'
import cobranca from './Cobranca.module.css'
import proprio from './Pericia.module.css'

// Figma: step_DP.07 · Registrar o comparecimento à perícia (1818:289). Antes da perícia, a confirmação de presença da
// véspera (CA7, CA8) e o "não vai poder ir", que remarca na hora (CA9); depois do dia e da hora, "compareceu?" (CA1).
// Remarcação tem limite (G15): passou dele, sobe para a advogada responsável, nunca para a sênior (Lucas, 29/09).

type Confirmacao = 'confirmou' | 'nao-confirmou' | 'nao-vai'
const CONFIRMACOES: { id: Confirmacao; rotulo: string; campo: string }[] = [
  { id: 'confirmou', rotulo: 'Confirmou', campo: 'Observação (opcional)' },
  { id: 'nao-confirmou', rotulo: 'Não consegui confirmar', campo: 'O que aconteceu *' },
  { id: 'nao-vai', rotulo: 'Não vai poder ir', campo: 'Motivo da remarcação *' },
]

export function ComparecimentoPericia({ processoId }: { processoId: string }) {
  const perfil = usePerfil('Jurídico administrativo')
  const quem = perfil?.usuario ?? 'Jurídico administrativo'
  const [t, setT] = useState<PericiaNaTela | null | undefined>(undefined)
  const [compareceu, setCompareceu] = useState<boolean>()
  const [justificativa, setJustificativa] = useState('')
  const [confirmacao, setConfirmacao] = useState<Confirmacao>()
  const [observacao, setObservacao] = useState('')
  const [aviso, setAviso] = useState('')
  const [erro, setErro] = useState('')
  const travado = useRef(false)

  useEffect(() => {
    let valendo = true
    obterPericia(processoId).then((x) => valendo && setT(x))
    return () => {
      valendo = false
    }
  }, [processoId])

  // A marcação de agora ou, depois de uma falta ou remarcação, a última que a perícia teve.
  const ultima = t?.pericia.marcacao ?? t?.pericia.marcacoesAnteriores?.at(-1)
  if (!t || !ultima) {
    return (
      <main className={styles.pagina}>
        <title>Registrar comparecimento · GGV Previdenciário</title>
        <h1 className={styles.titulo}>{t === undefined ? 'Abrindo o comparecimento…' : 'A perícia ainda não tem data'}</h1>
        {t !== undefined && <a href={perfil?.inicio ?? '/'}>Voltar ao início</a>}
      </main>
    )
  }

  const { pericia, ficha } = t
  const hoje = hojeIso(agora())
  const primeiro = ficha.nome.split(' ')[0]
  const tipo = NOMES_DO_TIPO[pericia.tipo]
  const m = pericia.marcacao
  const depois = t.jaPassou || t.situacao === 'aguardando-resultado'
  const falta = !m ? ultima.comparecimento : undefined
  const quando = `${dataCurta(ultima.data, hoje)}, ${ultima.hora}`
  const opcao = CONFIRMACOES.find((c) => c.id === confirmacao)
  const motivoConfirmar = !confirmacao
    ? 'Responda como foi a confirmação.'
    : confirmacao === 'nao-vai' && observacao.trim().length < MINIMO_DO_MOTIVO
      ? 'Diga o motivo da remarcação.'
      : confirmacao === 'nao-confirmou' && !observacao.trim()
        ? 'Diga o que aconteceu na tentativa.'
        : null

  async function agir(acao: () => Promise<PericiaNaTela>, ok: string) {
    if (travado.current) return
    travado.current = true
    setErro('')
    try {
      setT(await acao())
      setAviso(ok)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para registrar.')
    } finally {
      travado.current = false
    }
  }

  function confirmar() {
    if (confirmacao === 'nao-vai') {
      return agir(() => remarcarPericia(processoId, observacao, quem), 'Remarcação registrada: a tarefa de marcar a nova data volta para você.')
    }
    return agir(
      () => confirmarPresenca(processoId, { confirmou: confirmacao === 'confirmou', observacao }, quem),
      confirmacao === 'confirmou' ? 'Presença confirmada e registrada.' : 'Tentativa registrada: a confirmação segue na sua Central.',
    )
  }

  return (
    <>
      <title>{`${ficha.nome} · ${depois ? 'Registrar comparecimento' : 'Confirmar presença na perícia'} · GGV Previdenciário`}</title>
      <TopoPasso contexto={`${t.processo.numero ? `Processo ${t.processo.numero} · ` : ''}${ficha.nome}`} inicio={perfil?.inicio ?? '/'} />
      <main className={styles.pagina}>
        <div className={styles.principal}>
          <div className={styles.cabecalho}>
            <div className={styles.chips}>
              <span className={styles.codigo} title="DP.07 · Registrar o comparecimento à perícia (passo do BPMN)">
                DP.07
              </span>
              <span className={styles.codigo}>Jurídico administrativo</span>
            </div>
            <h1 className={styles.titulo}>
              <strong>{ficha.nome}</strong> · {depois || falta ? 'Registrar comparecimento' : 'Confirmar presença na perícia'}
            </h1>
            <p className={styles.subtitulo}>
              {tipo} do {NOMES_DA_INSTANCIA[pericia.instancia]} {quando} · {ultima.local}
            </p>
          </div>

          <InstrucoesPasso beneficio={t.beneficio} de={ficha.nome} fichaId={ficha.id} processoId={processoId} funcao="Jurídico administrativo">
            {depois || falta
              ? `Depois de ${dataCurta(ultima.data, hoje)}, registre se ${primeiro} foi. Se faltou, marque de novo.`
              : `Na véspera, confirme com ${primeiro} a ${tipo} de ${quando}, em ${ultima.local}, até as ${HORA_DA_CONFIRMACAO}h. Se ${primeiro} não puder ir, remarque na hora e registre o motivo: a remarcação conta no limite (G15).`}
          </InstrucoesPasso>

          {aviso && (
            <p role="status" className={styles.aviso}>
              {aviso}
            </p>
          )}

          {t.situacao === 'aguardando-resultado' && m?.comparecimento && (
            <section className={styles.feito} aria-labelledby="registrado">
              <h2 id="registrado" className={styles.feitoTitulo}>
                ✓ Comparecimento registrado
              </h2>
              <p>
                Compareceu · registrado em {dataHora(m.comparecimento.quando)} por {m.comparecimento.quem}
                {m.comparecimento.justificativa && ` · ${m.comparecimento.justificativa}`}.
              </p>
              <p>
                O caso espera o perito e o resultado (DP.E3, DP.E4): a advogada responsável acompanha {pericia.instancia === 'inss' ? 'no GERID' : 'no processo'} e
                confere o resultado.
              </p>
              <a className={styles.atalho} href={`/casos/${processoId}/pericia`}>
                Ver a perícia
              </a>
            </section>
          )}

          {!m && (
            <section className={styles.feito} aria-labelledby="sem-data">
              <h2 id="sem-data" className={styles.feitoTitulo}>
                {falta ? '✓ Falta registrada' : '✓ Remarcação registrada'}
              </h2>
              {falta && (
                <p>
                  {primeiro} não compareceu à perícia de {quando}
                  {falta.justificativa ? ` · ${falta.justificativa}` : ' · sem justificativa'}. Registrado em {dataHora(falta.quando)} por {falta.quem}.
                </p>
              )}
              {t.situacao === 'na-advogada' ? (
                <p className={styles.trava}>
                  Passou do limite de {LIMITE_DE_REMARCACOES_DA_PERICIA} remarcações: a perícia subiu para a advogada responsável (G15). Ela decide se vale mais uma.
                </p>
              ) : (
                <>
                  <p>
                    A perícia voltou para remarcar: {pericia.remarcacoes}ª remarcação, limite {LIMITE_DE_REMARCACOES_DA_PERICIA} (G15).
                  </p>
                  <a className={styles.atalho} href={`/casos/${processoId}/pericia/marcar`}>
                    Remarcar a perícia
                  </a>
                </>
              )}
            </section>
          )}

          {t.jaPassou && (
            <>
              <section className={styles.cartao} aria-labelledby="compareceu">
                <h2 id="compareceu" className={styles.cartaoTitulo}>
                  {primeiro} compareceu?
                </h2>
                <div className={styles.opcoes} role="radiogroup" aria-label={`${primeiro} compareceu?`}>
                  {([true, false] as const).map((v) => (
                    <button key={String(v)} type="button" role="radio" aria-checked={compareceu === v} className={styles.opcao} onClick={() => setCompareceu(v)}>
                      {v ? 'Compareceu' : 'Faltou'}
                    </button>
                  ))}
                </div>
                <label className={proprio.campo}>
                  Justificativa, se houver
                  <textarea className={cobranca.justificativa} rows={2} maxLength={300} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
                </label>
              </section>
              <p className={styles.aviso}>
                Se faltou: remarcação {pericia.remarcacoes + 1} · limite {LIMITE_DE_REMARCACOES_DA_PERICIA} (G15); passou, sobe para a advogada.
              </p>
              <div className={styles.rodape}>
                <button
                  type="button"
                  className={styles.principalBotao}
                  disabled={compareceu === undefined}
                  onClick={() =>
                    agir(
                      () => registrarComparecimento(processoId, { compareceu: compareceu!, justificativa }, quem),
                      compareceu ? 'Comparecimento registrado: o caso espera o resultado com a advogada responsável.' : 'Falta registrada.',
                    )
                  }
                >
                  Registrar
                </button>
                {compareceu === undefined && <p className={styles.motivo}>Responda se {primeiro} compareceu.</p>}
              </div>
            </>
          )}

          {m && !depois && (
            <section className={styles.cartao} aria-labelledby="confirmacao">
              <h2 id="confirmacao" className={styles.cartaoTitulo}>
                Confirmação de presença (véspera)
              </h2>
              {t.presenca === 'ainda-nao' && <p className={cobranca.detalhe}>A confirmação entra na sua Central na véspera, {dataCurta(t.prazos!.vespera, hoje)}.</p>}
              {t.presenca === 'atrasada' && <p className={styles.trava}>Presença não confirmada até {HORA_DA_CONFIRMACAO}h: contate o cliente.</p>}
              {m.confirmacao && (
                <p className={m.confirmacao.confirmou ? styles.aviso : cobranca.detalhe}>
                  {m.confirmacao.confirmou ? '✓ Presença confirmada' : `Não confirmou: ${m.confirmacao.observacao}`} · {dataHora(m.confirmacao.quando)} ·{' '}
                  {m.confirmacao.quem}
                </p>
              )}
              {!m.confirmacao?.confirmou && (
                <>
                  <div className={styles.opcoes} role="radiogroup" aria-label="Como foi a confirmação?">
                    {CONFIRMACOES.map((c) => (
                      <button key={c.id} type="button" role="radio" aria-checked={confirmacao === c.id} className={styles.opcao} onClick={() => setConfirmacao(c.id)}>
                        {c.rotulo}
                      </button>
                    ))}
                  </div>
                  {opcao && (
                    <label className={proprio.campo}>
                      {opcao.campo}
                      <textarea className={cobranca.justificativa} rows={2} maxLength={300} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
                    </label>
                  )}
                  {confirmacao === 'nao-vai' && (
                    <p className={styles.aviso}>
                      Remarcar na hora: remarcação {pericia.remarcacoes + 1} · limite {LIMITE_DE_REMARCACOES_DA_PERICIA} (G15); passou, sobe para a advogada.
                    </p>
                  )}
                  <div className={styles.rodape}>
                    <button type="button" className={styles.principalBotao} disabled={motivoConfirmar !== null} onClick={() => void confirmar()}>
                      {confirmacao === 'nao-vai' ? 'Remarcar agora' : 'Registrar a confirmação'}
                    </button>
                    {motivoConfirmar && <p className={styles.motivo}>{motivoConfirmar}</p>}
                  </div>
                </>
              )}
            </section>
          )}

          {erro && (
            <p role="alert" className={styles.motivo}>
              {erro}
            </p>
          )}

          <section className={styles.cartao} aria-labelledby="contato">
            <h2 id="contato" className={styles.cartaoTitulo}>
              Contato do cliente
            </h2>
            <div className={cobranca.contato}>
              <span className={cobranca.pessoa}>
                <span className={cobranca.nome}>{ficha.nome}</span>
                <span className={cobranca.detalhe}>{ficha.telefone ? formatarTelefone(ficha.telefone) : 'sem telefone: complete na ficha'}</span>
              </span>
              <span className={styles.atalhos}>
                {ficha.telefone ? (
                  <a className={cobranca.botao} href={`tel:+55${ficha.telefone}`}>
                    Ligar
                  </a>
                ) : (
                  <button type="button" className={cobranca.botao} aria-disabled="true">
                    Ligar
                  </button>
                )}
                <button type="button" className={cobranca.botao} aria-disabled="true" title="A conversa abre pelo Chatwoot (GGVP-102)">
                  WhatsApp
                </button>
              </span>
            </div>
          </section>
        </div>

        <aside className={styles.lado} aria-labelledby="antes-de-concluir">
          <h2 id="antes-de-concluir" className={styles.ladoTitulo}>
            Antes de concluir
          </h2>
          <p className={styles.ladoSub}>O que o BPMN (Miro) pede no passo DP.07.</p>
          <h3 className={styles.ladoSecao}>Decisões</h3>
          <ul className={styles.ladoLista}>
            <li>• Na véspera: confirmou, não confirmou ou não vai poder ir</li>
            <li>• Depois da perícia: o cliente compareceu?</li>
          </ul>
          <h3 className={styles.ladoSecao}>Campos</h3>
          <ul className={styles.ladoLista}>
            <li>• Justificativa, se houver</li>
            <li>• Se não vai poder ir: o motivo da remarcação*</li>
          </ul>
          <h3 className={styles.ladoSecao}>Travas</h3>
          <p className={styles.trava}>Remarcação tem limite (G15): passou, sobe para a advogada responsável, nunca para a sênior.</p>
          <p className={styles.ladoSub}>«Registrar» só habilita depois do dia e da hora da perícia, com a resposta.</p>
          <p className={styles.ladoSub}>Sem a presença confirmada até {HORA_DA_CONFIRMACAO}h da véspera, vem o alerta para contatar o cliente.</p>
        </aside>
      </main>
      <AbaSuporte />
    </>
  )
}
