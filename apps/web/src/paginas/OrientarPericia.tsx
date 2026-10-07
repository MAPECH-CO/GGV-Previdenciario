import { useEffect, useRef, useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { InstrucoesPasso } from '../componentes/InstrucoesPasso.tsx'
import { TopoPasso } from '../componentes/TopoPasso.tsx'
import { formatarTelefone } from '../campos.ts'
import { enviarOrientacao, obterPericia, type CanalDaOrientacao, type PericiaNaTela } from '../dados/pericia.ts'
import { usePerfil } from '../dados/perfis.ts'
import { agora } from '../dados/servidor.ts'
import { dataCurta, dataHora, hojeIso } from '../regras/datas.ts'
import { DIAS_ANTES_PREPARO, NOMES_DO_TIPO, O_QUE_LEVAR, problemaDaOrientacao } from '../regras/pericia.ts'
import styles from './Balcao.module.css'
import cobranca from './Cobranca.module.css'
import proprio from './Pericia.module.css'

// Figma: step_DP.06 · Orientar para a perícia (10:405). O documento para conferir, editar e imprimir, o "Revisei a
// orientação" e o envio pelo Chatwoot vêm do cartão (CA1, CA3; Lucas 02/10, Q5: o canal oficial é o Chatwoot). O servidor
// verifica o texto de novo antes de enviar e registra a recusa (G11, G20).

export function OrientarPericia({ processoId }: { processoId: string }) {
  const perfil = usePerfil('Jurídico administrativo')
  const quem = perfil?.usuario ?? 'Jurídico administrativo'
  const [t, setT] = useState<PericiaNaTela | null | undefined>(undefined)
  const [texto, setTexto] = useState('')
  const [revisei, setRevisei] = useState(false)
  const [aviso, setAviso] = useState('')
  const [erro, setErro] = useState('')
  const travado = useRef(false)

  useEffect(() => {
    let valendo = true
    obterPericia(processoId).then((x) => {
      if (!valendo) return
      setT(x)
      setTexto(x?.pericia.orientacao?.texto ?? '')
    })
    return () => {
      valendo = false
    }
  }, [processoId])

  const m = t?.pericia.marcacao
  const o = t?.pericia.orientacao
  if (!t || !m || !o) {
    return (
      <main className={styles.pagina}>
        <title>Orientar para a perícia · GGV Previdenciário</title>
        <h1 className={styles.titulo}>{t === undefined ? 'Abrindo a orientação…' : 'A orientação ainda não está pronta'}</h1>
        {t !== undefined && <p>A orientação sai quando a perícia tem data: marque a perícia primeiro.</p>}
        {t !== undefined && <a href={perfil?.inicio ?? '/'}>Voltar ao início</a>}
      </main>
    )
  }

  const { pericia, ficha } = t
  const hoje = hojeIso(agora())
  const primeiro = ficha.nome.split(' ')[0]
  const tipo = NOMES_DO_TIPO[pericia.tipo]
  const social = pericia.tipo === 'social'
  const feita = pericia.preparacao
  const problema = problemaDaOrientacao(texto)
  const motivo = !revisei ? 'Marque «Revisei a orientação» antes de enviar.' : texto.trim() ? null : 'Escreva a orientação.'
  const documentosAbertos = pericia.pedeDocumentoNovo && !pericia.documentos?.concluida
  const recusas = pericia.enviosRecusados ?? []

  async function enviar(canal: CanalDaOrientacao) {
    if (travado.current) return
    travado.current = true
    setErro('')
    try {
      setT(await enviarOrientacao(processoId, { texto, canal, revisei }, quem))
      setAviso(canal === 'chatwoot' ? 'Orientação enviada pelo Chatwoot e guardada no caso.' : 'Ligação registrada: a orientação ficou guardada no caso.')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para enviar.')
      // A recusa do servidor fica registrada na perícia (CA6): a tela mostra.
      setT(await obterPericia(processoId))
    } finally {
      travado.current = false
    }
  }

  return (
    <>
      <title>{`${ficha.nome} · Orientar para a perícia · GGV Previdenciário`}</title>
      <TopoPasso contexto={`${t.processo.numero ? `Processo ${t.processo.numero} · ` : ''}${ficha.nome}`} inicio={perfil?.inicio ?? '/'} />
      <main className={styles.pagina}>
        <div className={styles.principal}>
          <div className={styles.cabecalho}>
            <div className={styles.chips}>
              <span className={styles.codigo} title="DP.06 · Ligar e orientar o cliente (passo do BPMN)">
                DP.06
              </span>
              <span className={styles.codigo}>Jurídico administrativo</span>
              <span className={styles.beneficio}>◆ {t.beneficio}</span>
            </div>
            <h1 className={styles.titulo}>
              <strong>{ficha.nome}</strong> · Orientar para a perícia
            </h1>
            <p className={styles.subtitulo}>
              perícia {dataCurta(m.data, hoje)} · ligar para o cliente{t.prazos && ` · até ${dataCurta(t.prazos.preparoAte, hoje)}`}
            </p>
          </div>

          <InstrucoesPasso beneficio={t.beneficio} de={ficha.nome} fichaId={ficha.id} processoId={processoId} funcao="Jurídico administrativo">
            Ligue para {primeiro} e explique a {tipo} de {dataCurta(m.data, hoje)}: chegar 30 min antes; levar {O_QUE_LEVAR[pericia.tipo]};{' '}
            {social ? 'mostrar a casa como ela é no dia a dia e responder com calma' : 'contar ao perito o que sente no dia a dia e o que não consegue mais fazer no trabalho'}.
            Oriente a responder com a verdade: nunca sugira esconder nem mudar a situação real (G11), nem diagnóstico ou frase pronta (G20). Ou envie o documento
            pelo Chatwoot. Confirme presença um dia antes (DP.07); se {primeiro} não puder ir, remarque na hora e registre o motivo.
          </InstrucoesPasso>

          {aviso && (
            <p role="status" className={styles.aviso}>
              {aviso}
            </p>
          )}
          {o.bloqueio && !feita && <p className={styles.trava}>A verificação bloqueou a orientação montada pela IA: revise o texto antes de enviar. {o.bloqueio}</p>}
          {documentosAbertos && (
            <p className={styles.aviso}>
              A Documentação ainda reúne o que a perícia pede{t.prazos && ` (até ${dataCurta(t.prazos.documentosAte, hoje)})`}: a tarefa de orientar entra na sua
              Central quando ela concluir.
            </p>
          )}

          <section className={styles.cartao} aria-label="Orientação">
            <dl className={proprio.linhas}>
              <div>
                <dt>Orientação</dt>
                <dd>{o.modo === 'perfil' && t.perfil ? `pelo perfil do perito: ${t.perfil.perito.nome} · versão de ${o.versaoDoPerfil} laudos` : `padrão (${o.motivo})`}</dd>
              </div>
              <div>
                <dt>Regra de ouro</dt>
                <dd>nunca instruir a esconder ou mudar a real situação (G11)</dd>
              </div>
              <div>
                <dt>Levar</dt>
                <dd>{O_QUE_LEVAR[pericia.tipo]}</dd>
              </div>
              {social && (
                <div>
                  <dt>Visita</dt>
                  <dd>em casa: a assistente social conversa com quem mora ali e vê como a família vive</dd>
                </div>
              )}
            </dl>
          </section>

          {feita ? (
            <section className={styles.feito} aria-labelledby="orientado">
              <h2 id="orientado" className={styles.feitoTitulo}>
                ✓ Orientação passada
              </h2>
              <p>
                {feita.canal === 'chatwoot' ? 'Enviada pelo Chatwoot, como documento e instrução' : 'Na ligação'}, em {dataHora(feita.quando)}, por {feita.quem}. O
                texto ficou guardado no caso:
              </p>
              <p className={proprio.documento}>{feita.texto}</p>
              <p>Se a data ou o local mudar, a orientação sai de novo e a tarefa volta para você.</p>
              <div className={styles.rodape}>
                <button type="button" className={proprio.secundario} onClick={() => window.print()}>
                  Imprimir
                </button>
                <a className={styles.atalho} href={`/casos/${processoId}/pericia`}>
                  Ver a perícia
                </a>
              </div>
            </section>
          ) : (
            <section className={styles.cartao} aria-labelledby="documento">
              <h2 id="documento" className={styles.cartaoTitulo}>
                Documento de orientação
              </h2>
              <label className={proprio.campo}>
                Orientação para {primeiro} (confira e edite se precisar)
                <textarea
                  className={cobranca.justificativa}
                  rows={12}
                  maxLength={3000}
                  value={texto}
                  onChange={(e) => {
                    setTexto(e.target.value)
                    setRevisei(false)
                  }}
                />
              </label>
              <p className={cobranca.detalhe}>
                Montado pela IA em {dataHora(o.geradaEm)} ({o.modo === 'perfil' ? 'pelo perfil do perito' : 'padrão'}). Antes de sair, o servidor verifica o texto de
                novo: nada de esconder ou mudar a situação real (G11), nem diagnóstico ou frase pronta (G20).
              </p>
              {problema && <p className={styles.trava}>A verificação vai recusar este texto: {problema}</p>}
              <label className={proprio.marcar}>
                <input type="checkbox" checked={revisei} onChange={(e) => setRevisei(e.target.checked)} />
                Revisei a orientação
              </label>
              <button type="button" className={proprio.secundario} onClick={() => window.print()}>
                Imprimir
              </button>
            </section>
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
                <button
                  type="button"
                  className={cobranca.botao}
                  disabled={!!feita || motivo !== null || !ficha.telefone}
                  title="Envia o documento de orientação pelo Chatwoot"
                  onClick={() => void enviar('chatwoot')}
                >
                  WhatsApp
                </button>
              </span>
            </div>
          </section>

          {recusas.length > 0 && (
            <section className={styles.cartao} aria-labelledby="recusas">
              <h2 id="recusas" className={styles.cartaoTitulo}>
                Envios recusados pela verificação
              </h2>
              <ul className={cobranca.lista} aria-label="Envios recusados">
                {recusas.map((r) => (
                  <li key={r.quando}>
                    {dataHora(r.quando)} · {r.quem} · {r.motivo}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {!feita && (
            <div className={styles.rodape}>
              <button type="button" className={styles.principalBotao} disabled={motivo !== null} onClick={() => void enviar('ligacao')}>
                Registrar a ligação e a orientação
              </button>
              <button type="button" className={proprio.secundario} disabled={motivo !== null || !ficha.telefone} onClick={() => void enviar('chatwoot')}>
                Enviar orientação
              </button>
              {motivo && <p className={styles.motivo}>{motivo}</p>}
            </div>
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
          <p className={styles.ladoSub}>O que o BPMN (Miro) pede no passo DP.06.</p>
          <h3 className={styles.ladoSecao}>Travas</h3>
          <p className={styles.ladoSub}>Conferir: Revisei a orientação</p>
          <p className={styles.ladoSub}>«Enviar orientação» só habilita com as conferências marcadas.</p>
          <p className={styles.trava}>Nunca instruir a esconder ou mudar a real situação (G11).</p>
          <p className={styles.ladoSub}>
            Até {DIAS_ANTES_PREPARO} dias antes da perícia. O envio recusado pela verificação fica registrado no caso.
          </p>
        </aside>
      </main>
      <div className={proprio.impressao}>{feita?.texto ?? texto}</div>
      <AbaSuporte />
    </>
  )
}
