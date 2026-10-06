import { useEffect, useRef, useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { CabecalhoDoContrato } from '../componentes/CabecalhoDoContrato.tsx'
import campoCss from '../componentes/Campo.module.css'
import { MensagemWhatsApp } from '../componentes/MensagemWhatsApp.tsx'
import { TopoPasso } from '../componentes/TopoPasso.tsx'
import { formatarTelefone } from '../campos.ts'
import { avisarClienteDaConferencia, obterContrato, verificarContrato, type ContratoDoCaso } from '../dados/contrato.ts'
import { problemaDoArquivo } from '../regras/arquivos.ts'
import { motivoParadoDaVerificacao, paginasDaLeitura, resumoDaLeitura } from '../regras/contrato.ts'
import styles from './Balcao.module.css'
import proprio from './ConferirContrato.module.css'

// Figma: step_D1.19 "Conferir contrato" (10:202). "A IA sugere · você confere" com a assinatura e as páginas, o contato do
// cliente, o contrato na íntegra, a página anexa e a decisão "Está tudo certo?" no painel, como no desenho.

export function ConferirContrato({ processoId }: { processoId: string }) {
  const [caso, setCaso] = useState<ContratoDoCaso | null | undefined>(undefined)
  const [tudoCerto, setTudoCerto] = useState<boolean | null>(null)
  const [oQueCorrigir, setOQueCorrigir] = useState('')
  const [pagina, setPagina] = useState<{ nome: string; tamanho: number } | null>(null)
  const [erroPagina, setErroPagina] = useState('')
  const [ligando, setLigando] = useState(false)
  const [whatsapp, setWhatsapp] = useState(false)
  const [avisado, setAvisado] = useState(false)
  const [feito, setFeito] = useState<'seguiu' | 'corrigir' | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const travado = useRef(false)

  useEffect(() => {
    let valendo = true
    obterContrato(processoId).then((c) => {
      if (valendo) setCaso(c)
    })
    return () => {
      valendo = false
    }
  }, [processoId])

  if (!caso) {
    return (
      <main className={proprio.vazia}>
        <title>Conferir contrato · GGV Previdenciário</title>
        <h1 className={styles.titulo}>{caso === null ? 'Contrato não encontrado' : 'Abrindo a tarefa…'}</h1>
        {caso === null && <a href="/">Voltar ao início</a>}
      </main>
    )
  }

  const { ficha, processo, contrato } = caso
  const leitura = contrato.leitura
  const primeiro = ficha.nome.split(' ')[0]
  const motivoParado = motivoParadoDaVerificacao(tudoCerto, oQueCorrigir)
  const conferindo = contrato.etapa === 'conferir' && feito === null

  function escolherPagina(arquivo: File | undefined) {
    if (!arquivo) return
    const dados = { nome: arquivo.name, tamanho: arquivo.size }
    const problema = problemaDoArquivo(dados)
    setErroPagina(problema ?? '')
    setPagina(problema ? null : dados)
  }

  async function concluir(certo: boolean) {
    if (travado.current || motivoParado || tudoCerto !== certo) return
    travado.current = true
    setOcupado(true)
    setErro('')
    try {
      await verificarContrato(processoId, certo ? { tudoCerto: true } : { tudoCerto: false, oQueCorrigir, ...(pagina && { paginaCorrigida: pagina }) })
      setFeito(certo ? 'seguiu' : 'corrigir')
      setCaso(await obterContrato(processoId))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para registrar.')
    } finally {
      travado.current = false
      setOcupado(false)
    }
  }

  const pendencia = leitura?.pendencias[0] ?? (leitura?.faltam.length ? `falta ${leitura.faltam.join(', ')}` : 'há uma pendência')

  return (
    <>
      <title>{`${ficha.nome} · Conferir contrato · GGV Previdenciário`}</title>
      <TopoPasso contexto={`Cliente · ${ficha.nome}`} />
      <main className={styles.pagina}>
        <div className={styles.principal}>
          <CabecalhoDoContrato
            passo="D1.19"
            nomeDoPasso="Verificar o contrato assinado"
            tarefa="Conferir contrato"
            subtitulo="contrato recebido"
            ficha={ficha}
            beneficio={processo.beneficio}
            beneficioNosChips
            instrucoes={
              'A IA leu o contrato assinado e comparou com a ficha. Confira nome, CPF, datas e se a página da assinatura está inteira. ' +
              'Se a assinatura estiver cortada ou faltar rubrica, anexe a página e peça nova assinatura. Só siga quando tudo estiver certo: ' +
              'é item do checklist antes do INSS (G1).'
            }
          />

          {leitura ? (
            <section className={styles.cartao} aria-labelledby="ia-sugere">
              <h2 id="ia-sugere" className={styles.cartaoTitulo}>
                A IA sugere · você confere
              </h2>
              {!leitura.reconhecido ? (
                <p className={styles.aviso}>A IA não entendeu o contrato: confira à mão antes de seguir.</p>
              ) : (
                (leitura.pendencias.length > 0 || leitura.faltam.length > 0 || !leitura.assinatura.reconhecida) && (
                  <p className={styles.aviso}>
                    {resumoDaLeitura(leitura).replace(/^a IA/, 'A IA')}: {pendencia}. Confira e peça a página inteira antes de seguir.
                  </p>
                )
              )}
              <dl className={proprio.leitura}>
                <div>
                  <dt>Assinatura</dt>
                  <dd data-problema={!leitura.assinatura.reconhecida}>{leitura.assinatura.texto}</dd>
                </div>
                <div>
                  <dt>Páginas</dt>
                  <dd data-problema={leitura.faltam.length > 0}>{paginasDaLeitura(leitura)}</dd>
                </div>
              </dl>
            </section>
          ) : (
            <p className={styles.aviso}>A IA ainda não leu o contrato assinado.</p>
          )}

          <p className={styles.trava}>A IA sugere; a pessoa confirma.</p>

          <section className={styles.cartao} aria-labelledby="contato-titulo">
            <h2 id="contato-titulo" className={styles.cartaoTitulo}>
              Contato do cliente
            </h2>
            <div className={proprio.contato}>
              <div>
                <p className={proprio.nome}>{ficha.nome}</p>
                <p className={styles.motivo}>{formatarTelefone(ficha.telefone)}</p>
              </div>
              <div className={styles.atalhos}>
                <button type="button" className={styles.atalho} onClick={() => setLigando(true)}>
                  Ligar
                </button>
                <button type="button" className={styles.atalho} onClick={() => setWhatsapp(true)}>
                  WhatsApp
                </button>
              </div>
            </div>
            {ligando && <p className={styles.motivo}>Ligue para {formatarTelefone(ficha.telefone)} (ligação simulada).</p>}
            {avisado && <p className={styles.motivo}>Aviso enviado pelo WhatsApp: ficou em "Últimos contatos".</p>}
          </section>

          <section className={styles.cartao} aria-labelledby="contrato-titulo">
            <h2 id="contrato-titulo" className={styles.cartaoTitulo}>
              Contrato
            </h2>
            <details className={proprio.integra}>
              <summary>Ver contrato na íntegra</summary>
              {contrato.assinatura?.arquivo && <p className={styles.motivo}>Arquivo assinado: {contrato.assinatura.arquivo}</p>}
              {contrato.documento?.textos.map((t) => (
                <p key={t.documento} className={proprio.texto}>
                  {t.texto}
                </p>
              ))}
            </details>
          </section>

          {conferindo && (
            <label className={proprio.anexar}>
              <span aria-hidden="true" className={proprio.seta}>
                ⬆
              </span>
              <span className={proprio.anexarTitulo}>Anexar a página da assinatura para conferência</span>
              <span className={styles.motivo}>{pagina ? `✓ ${pagina.nome}` : 'Arraste o arquivo ou clique para anexar (PDF, foto)'}</span>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" className={proprio.arquivo} onChange={(e) => escolherPagina(e.target.files?.[0])} />
              {erroPagina && <span className={campoCss.erro}>{erroPagina}</span>}
            </label>
          )}

          {conferindo && tudoCerto === false && (
            <section className={styles.cartao}>
              <div className={campoCss.campo}>
                <label className={campoCss.rotulo} htmlFor="o-que-corrigir">
                  O que corrigir *
                </label>
                <textarea
                  id="o-que-corrigir"
                  className={`${campoCss.entrada} ${proprio.textoCorrigir}`}
                  rows={3}
                  maxLength={500}
                  value={oQueCorrigir}
                  onChange={(e) => setOQueCorrigir(e.target.value)}
                />
              </div>
            </section>
          )}

          {feito === 'seguiu' || (feito === null && contrato.etapa === 'copia') ? (
            <section className={styles.feito} aria-labelledby="conferido">
              <h2 id="conferido" className={styles.feitoTitulo}>
                ✓ Contrato conferido: segue para a cópia
              </h2>
              <p>O contrato assinado está certo. A próxima tarefa é entregar a cópia ao cliente.</p>
              <div className={styles.atalhos}>
                <a className={styles.atalho} href={`/contrato/${processoId}/copia`}>
                  Entregar cópia do contrato
                </a>
                <a className={styles.atalho} href="/">
                  Voltar ao início
                </a>
              </div>
            </section>
          ) : feito === 'corrigir' || (feito === null && contrato.etapa === 'preparar') ? (
            <section className={styles.feito} aria-labelledby="corrigir">
              <h2 id="corrigir" className={styles.feitoTitulo}>
                ✓ Volta para corrigir e reenviar
              </h2>
              <p>
                A versão assinada ficou guardada no histórico. Corrija os campos no preparo do contrato e gere de novo: a versão nova vai para
                o cliente assinar.
              </p>
              <div className={styles.atalhos}>
                <a className={styles.atalho} href={`/contrato/${processoId}/preparar`}>
                  Preparar contrato
                </a>
              </div>
            </section>
          ) : (
            conferindo && (
              <div className={styles.rodape}>
                <button type="button" className={styles.principalBotao} disabled={tudoCerto !== true || ocupado} onClick={() => concluir(true)}>
                  {ocupado && tudoCerto ? 'salvando…' : 'Está certo — seguir'}
                </button>
                <button type="button" className={styles.atalho} disabled={tudoCerto !== false || motivoParado !== null || ocupado} onClick={() => concluir(false)}>
                  Corrigir
                </button>
                {motivoParado && <p className={styles.motivo}>{motivoParado}</p>}
              </div>
            )
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
          <p className={styles.ladoSub}>O que o BPMN (Miro) pede no passo D1.19.</p>
          <h3 className={styles.ladoSecao}>Decisões</h3>
          <div className={styles.decisao}>
            <p id="tudo-certo">Está tudo certo?</p>
            <div className={styles.ladoOpcoes} role="radiogroup" aria-labelledby="tudo-certo">
              <button type="button" role="radio" className={styles.chip} aria-checked={tudoCerto === true} disabled={!conferindo} onClick={() => setTudoCerto(true)}>
                Sim
              </button>
              <button type="button" role="radio" className={styles.chip} aria-checked={tudoCerto === false} disabled={!conferindo} onClick={() => setTudoCerto(false)}>
                Não, corrigir e reenviar
              </button>
            </div>
          </div>
          <h3 className={styles.ladoSecao}>Campos</h3>
          <ul className={styles.ladoLista}>
            <li>• Se «Não, corrigir e reenviar»: O que corrigir*</li>
            <li>• Se «Não, corrigir e reenviar»: Anexo: Anexar a página corrigida (opcional)</li>
          </ul>
          <h3 className={styles.ladoSecao}>Travas</h3>
          <p className={styles.ladoSub}>«Está certo — seguir» só habilita com as decisões respondidas e os campos com * preenchidos.</p>
        </aside>
      </main>
      {whatsapp && (
        <MensagemWhatsApp
          nome={ficha.nome}
          telefone={ficha.telefone}
          rotulo="Aviso da pendência no contrato (confira antes de enviar)"
          mensagemInicial={`Olá, ${primeiro}! Recebemos o contrato assinado, mas ${pendencia}. Vamos combinar uma nova assinatura dessa parte. Se tiver dúvida, é só responder aqui.`}
          aoEnviar={async (mensagem) => {
            await avisarClienteDaConferencia(processoId, mensagem)
            setWhatsapp(false)
            setAvisado(true)
          }}
          aoFechar={() => setWhatsapp(false)}
        />
      )}
      <AbaSuporte />
    </>
  )
}
