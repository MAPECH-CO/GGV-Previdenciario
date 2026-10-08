import { useEffect, useRef, useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { ConferirEnviar } from '../componentes/ConferirEnviar.tsx'
import { ConviteChatwoot } from '../componentes/ConviteChatwoot.tsx'
import { InstrucoesPasso } from '../componentes/InstrucoesPasso.tsx'
import { TopoPasso } from '../componentes/TopoPasso.tsx'
import { formatarTelefone } from '../campos.ts'
import { abordarSugeridoNaPericia, adiarCobrancaDaPericia, obterPericia, pedirAoMedicoNaPericia, type PericiaNaTela } from '../dados/pericia.ts'
import { usePerfil } from '../dados/perfis.ts'
import { agora } from '../dados/servidor.ts'
import { dataCurta, dataHora, hojeIso } from '../regras/datas.ts'
import { problemaG20 } from '../regras/parecer.ts'
import { DIAS_ANTES_DOCUMENTOS, prazoFalado } from '../regras/pericia.ts'
import styles from './Balcao.module.css'
import cobranca from './Cobranca.module.css'
import parecer from './Parecer.module.css'
import proprio from './Pericia.module.css'

// Figma: step_DP.03b · Cobrar documento da perícia (10:239). Pela resposta do Lucas (02/10), quem cobra é a Documentação,
// todo dia, até 10 dias antes da perícia; passou, sobe para a advogada responsável (G15). O pedido ao médico segue o G20.

export function CobrarDocumentoPericia({ processoId }: { processoId: string }) {
  const perfil = usePerfil('Documentação')
  const quem = perfil?.usuario ?? 'Documentação'
  const [t, setT] = useState<PericiaNaTela | null | undefined>(undefined)
  const [abordar, setAbordar] = useState('')
  const [aberto, setAberto] = useState<'chatwoot' | 'anexar' | null>(null)
  const [aviso, setAviso] = useState('')
  const [erro, setErro] = useState('')
  const travado = useRef(false)

  useEffect(() => {
    let valendo = true
    Promise.all([obterPericia(processoId), abordarSugeridoNaPericia(processoId)]).then(([x, sugestao]) => {
      if (!valendo) return
      setT(x)
      setAbordar(x?.pericia.documentos?.pedidosAoMedico.at(-1)?.abordar ?? sugestao)
    })
    return () => {
      valendo = false
    }
  }, [processoId])

  if (!t?.documentos) {
    return (
      <main className={styles.pagina}>
        <title>Cobrar documento da perícia · GGV Previdenciário</title>
        <h1 className={styles.titulo}>{t === undefined ? 'Abrindo a cobrança…' : 'Esta perícia não pede documento novo'}</h1>
        {t !== undefined && <a href={perfil?.inicio ?? '/'}>Voltar ao início</a>}
      </main>
    )
  }

  const { pericia, ficha, documentos } = t
  const hoje = hojeIso(agora())
  const primeiro = ficha.nome.split(' ')[0]
  const ate = t.prazos?.documentosAte
  const faltando = documentos.faltando
  const laudo = faltando.find((i) => i.laudo)
  const problema = problemaG20(abordar)
  const pedidos = pericia.documentos!.pedidosAoMedico
  const cobrancas = pericia.documentos!.cobrancas
  const parado = faltando.length === 0 || documentos.passouDoLimite || !documentos.cobrarHoje
  const vence = ate ? prazoFalado(ate, hoje).texto.replace('até', 'vence') : 'sem data da perícia ainda'

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

  return (
    <>
      <title>{`${ficha.nome} · Cobrar documento da perícia · GGV Previdenciário`}</title>
      <TopoPasso contexto={`${t.processo.numero ? `Processo ${t.processo.numero} · ` : ''}${ficha.nome}`} inicio={perfil?.inicio ?? '/'} />
      <main className={styles.pagina}>
        <div className={styles.principal}>
          <div className={styles.cabecalho}>
            <div className={styles.chips}>
              <span className={styles.codigo} title="DP.03 · Reunir o que a perícia pede (passo do BPMN)">
                DP.03
              </span>
              <span className={styles.codigo}>Documentação</span>
              <span className={styles.beneficio}>◆ {t.beneficio}</span>
            </div>
            <h1 className={styles.titulo}>
              <strong>{ficha.nome}</strong> · Cobrar documento
            </h1>
            <p className={styles.subtitulo}>
              {faltando.length === 0 ? 'nada faltando' : `${faltando.map((i) => i.nome.toLowerCase()).join(', ')} pendente`} · {vence}
            </p>
          </div>

          <InstrucoesPasso beneficio={t.beneficio} de={ficha.nome} fichaId={ficha.id} processoId={processoId} funcao="Documentação">
            Cobre de {primeiro} o que a perícia pede e ainda falta. A cobrança é uma por dia{ate ? `, até ${dataCurta(ate, hoje)} (${DIAS_ANTES_DOCUMENTOS} dias antes da perícia)` : ''}
            : depois, sobe para a advogada responsável, por ser perícia (G15).
            {laudo && ' Se falta o laudo, o pedido ao médico diz só o que o documento deve abordar: nunca sugira ao médico o que escrever (G20).'}
          </InstrucoesPasso>

          {aviso && (
            <p role="status" className={styles.aviso}>
              {aviso}
            </p>
          )}

          <p className={proprio.quadro}>Enviar a mensagem de cobrança do que falta ao cliente.</p>
          <p className={styles.aviso}>A cobrança tem limite; passou dele, sobe para a advogada responsável, por ser perícia (G15).</p>
          {documentos.passouDoLimite && <p className={styles.trava}>Passou do limite: a advogada responsável decide. A cobrança para aqui.</p>}

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
                <button type="button" className={cobranca.botao} disabled={parado} onClick={() => setAberto('chatwoot')}>
                  WhatsApp
                </button>
              </span>
            </div>
          </section>

          {laudo && (
            <section className={styles.cartao} aria-labelledby="medico">
              <h2 id="medico" className={styles.cartaoTitulo}>
                Pedido ao médico · {laudo.nome.toLowerCase()}
              </h2>
              <label className={parecer.campo}>
                O que o documento deve abordar
                <textarea className={cobranca.justificativa} rows={5} maxLength={1000} value={abordar} onChange={(e) => setAbordar(e.target.value)} />
              </label>
              <p className={cobranca.detalhe}>
                Sugerido pela IA com as perguntas do roteiro do benefício. Diz só o que o documento deve abordar, sem diagnóstico, CID, grau, conclusão nem frase
                pronta (G20).
              </p>
              {problema && <p className={styles.trava}>{problema}</p>}
              <button
                type="button"
                className={cobranca.botao}
                disabled={problema !== null || abordar.trim().length === 0}
                onClick={() => agir(() => pedirAoMedicoNaPericia(processoId, abordar, quem), 'Pedido ao médico salvo: ele vai junto na mensagem de cobrança.')}
              >
                Salvar o pedido ao médico
              </button>
              {pedidos.length > 0 && <p className={cobranca.detalhe}>Último pedido salvo em {dataHora(pedidos.at(-1)!.quando)} por {pedidos.at(-1)!.quem}.</p>}
            </section>
          )}

          <button type="button" className={cobranca.anexar} onClick={() => setAberto('anexar')}>
            <span className={cobranca.seta} aria-hidden="true">
              ⬆
            </span>
            <span className={cobranca.anexarTitulo}>Anexar o documento faltante</span>
            <span className={cobranca.anexarSub}>Arraste o arquivo ou clique para anexar (PDF, foto): segue a leitura da IA do D1</span>
          </button>

          {cobrancas.length > 0 && (
            <section className={styles.cartao} aria-labelledby="cobrancas">
              <h2 id="cobrancas" className={styles.cartaoTitulo}>
                Cobranças
              </h2>
              <ul className={cobranca.lista} aria-label="Cobranças da perícia">
                {cobrancas.map((c) => (
                  <li key={c.quando}>
                    {dataCurta(c.dia, hoje)} · {c.como === 'adiada' ? 'adiada para amanhã' : 'enviada pelo Chatwoot'} · {c.quem}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className={styles.rodape}>
            <button type="button" className={styles.principalBotao} disabled={parado} onClick={() => setAberto('chatwoot')}>
              Enviar cobrança
            </button>
            <button
              type="button"
              className={proprio.secundario}
              disabled={parado}
              onClick={() => agir(() => adiarCobrancaDaPericia(processoId, quem), 'Cobrança adiada: volta amanhã.')}
            >
              Adiar
            </button>
            {faltando.length > 0 && !documentos.cobrarHoje && !documentos.passouDoLimite && <p className={styles.motivo}>A cobrança de hoje já foi feita: a próxima é amanhã.</p>}
          </div>
          {erro && (
            <p role="alert" className={styles.motivo}>
              {erro}
            </p>
          )}
          <a className={styles.atalho} href={`/casos/${processoId}/pericia/documentos`}>
            Voltar à lista da perícia
          </a>
        </div>
      </main>
      <AbaSuporte />
      {aberto === 'chatwoot' && (
        <ConviteChatwoot
          agendamentoId={processoId}
          assunto="pericia-cobranca"
          aoEnviado={async () => {
            setAberto(null)
            setT(await obterPericia(processoId))
            setAviso('Cobrança enviada pelo Chatwoot e registrada.')
          }}
          aoFechar={() => setAberto(null)}
        />
      )}
      {aberto === 'anexar' && (
        <ConferirEnviar
          fichaId={ficha.id}
          origem="card"
          aoEnviar={async (r) => {
            setAberto(null)
            setT(await obterPericia(processoId))
            setAviso(`${r.arquivos.length === 1 ? '1 arquivo enviado' : `${r.arquivos.length} arquivos enviados`} para a pasta do cliente: seguem a leitura da IA (D1).`)
          }}
          aoFechar={() => setAberto(null)}
        />
      )}
    </>
  )
}
