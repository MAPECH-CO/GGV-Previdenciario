import { useEffect, useRef, useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { ConviteChatwoot } from '../componentes/ConviteChatwoot.tsx'
import { InstrucoesPasso } from '../componentes/InstrucoesPasso.tsx'
import { TopoPasso } from '../componentes/TopoPasso.tsx'
import { dataParaIso, formatarTelefone, isoParaData, normalizarData } from '../campos.ts'
import {
  esperarComprovante,
  lerComprovante,
  obterPericia,
  registrarMarcacao,
  registrarTentativa,
  remarcarPericia,
  type PericiaNaTela,
} from '../dados/pericia.ts'
import { usePerfil } from '../dados/perfis.ts'
import { agora } from '../dados/servidor.ts'
import { diaFalado } from '../regras/agenda.ts'
import { formatoDoArquivo, hashDoConteudo, problemaDoArquivo } from '../regras/arquivos.ts'
import { dataCurta, dataHora, hojeIso } from '../regras/datas.ts'
import {
  DIAS_ANTES_DOCUMENTOS,
  DIAS_ANTES_PREPARO,
  LIMITE_DE_REMARCACOES_DA_PERICIA,
  NOMES_DO_TIPO,
  motivoParaNaoRegistrarMarcacao,
  motivoParaNaoRegistrarTentativa,
  prazoFalado,
  type LidoDoComprovante,
} from '../regras/pericia.ts'
import styles from './Balcao.module.css'
import cobranca from './Cobranca.module.css'
import proprio from './Pericia.module.css'

// Figma: step_DP.02 (10:374), passos DP.02 e DP.04 do Miro. Tela do Jurídico administrativo (Lucas, 29/09): marca no Meu
// INSS (senha no cofre, G9), sobe o comprovante, confere o que o sistema leu e decide se a perícia pede documento novo.

type Tentativa = 'sim' | 'nao' | 'sem-comprovante'
const TENTATIVAS: { id: Tentativa; rotulo: string }[] = [
  { id: 'sim', rotulo: 'Sim, marcado' },
  { id: 'nao', rotulo: 'Não, tentar de novo' },
  { id: 'sem-comprovante', rotulo: 'Marcado, sem comprovante ainda' },
]

const kb = (bytes: number) => `${Math.max(1, Math.round(bytes / 1024))} KB`

export function MarcarPericia({ processoId, remarcar = false }: { processoId: string; remarcar?: boolean }) {
  const perfil = usePerfil('Jurídico administrativo')
  const quem = perfil?.usuario ?? 'Jurídico administrativo'
  const [t, setT] = useState<PericiaNaTela | null | undefined>(undefined)
  const [deuCerto, setDeuCerto] = useState<Tentativa>()
  const [dia, setDia] = useState('')
  const [oQueAconteceu, setOQueAconteceu] = useState('')
  const [comprovante, setComprovante] = useState<{ nome: string; tamanho: number; hash: string; arquivo: Blob }>()
  const [lido, setLido] = useState<LidoDoComprovante>()
  const [data, setData] = useState('')
  const [pedeDocumento, setPedeDocumento] = useState<boolean>()
  const [motivoRemarcar, setMotivoRemarcar] = useState('')
  const [abrirRemarcar, setAbrirRemarcar] = useState(remarcar)
  const [lembrete, setLembrete] = useState(false)
  // A data mudou no INSS: sobe o comprovante novo e o lembrete é reprogramado (CA8).
  const [trocar, setTrocar] = useState(false)
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

  if (!t) {
    return (
      <main className={styles.pagina}>
        <title>Marcar perícia · GGV Previdenciário</title>
        <h1 className={styles.titulo}>{t === null ? 'Este caso não tem perícia' : 'Abrindo a perícia…'}</h1>
        {t === null && <a href={perfil?.inicio ?? '/juridico-administrativo'}>Voltar ao início</a>}
      </main>
    )
  }

  const { pericia, ficha } = t
  const hoje = hojeIso(agora())
  const primeiro = ficha.nome.split(' ')[0]
  const tipo = NOMES_DO_TIPO[pericia.tipo]
  const remarcacao = pericia.remarcacoes > 0
  const lidoConferido = lido && { ...lido, data: dataParaIso(data) ?? '' }
  const motivoMarcacao = motivoParaNaoRegistrarMarcacao(
    { comprovante: comprovante?.nome, lido: lidoConferido && { ...lidoConferido, data: lidoConferido.data || null }, pedeDocumentoNovo: pedeDocumento },
    hoje,
  )
  const motivoTentativa = motivoParaNaoRegistrarTentativa({ dia: dataParaIso(dia), oQueAconteceu }, hoje)
  const marcando = t.situacao === 'marcar' || t.situacao === 'aguardando-comprovante'
  const comComprovante = (marcando && (deuCerto === 'sim' || (deuCerto === undefined && t.situacao === 'aguardando-comprovante'))) || (trocar && t.situacao === 'agendada')

  async function agir(acao: () => Promise<PericiaNaTela>, ok: string) {
    if (travado.current) return
    travado.current = true
    setErro('')
    try {
      setT(await acao())
      setAviso(ok)
      setDeuCerto(undefined)
      setComprovante(undefined)
      setLido(undefined)
      setPedeDocumento(undefined)
      setAbrirRemarcar(false)
      setTrocar(false)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para registrar.')
    } finally {
      travado.current = false
    }
  }

  async function anexar(arquivo: File | undefined) {
    if (!arquivo) return
    setErro('')
    const problema = problemaDoArquivo({ nome: arquivo.name, tamanho: arquivo.size })
    if (problema || formatoDoArquivo(arquivo.name) !== 'pdf') return setErro(problema ?? 'O comprovante do INSS é um PDF.')
    const hash = await hashDoConteudo(await arquivo.arrayBuffer())
    setComprovante({ nome: arquivo.name, tamanho: arquivo.size, hash, arquivo })
    const leitura = await lerComprovante(processoId, arquivo.name)
    setLido(leitura)
    setData(isoParaData(leitura.data) ?? '')
  }

  const decisaoDocumento = (
    <div className={styles.decisao}>
      <span>A perícia pede documento novo? *</span>
      <div className={styles.opcoes} role="radiogroup" aria-label="A perícia pede documento novo?">
        <button type="button" role="radio" aria-checked={pedeDocumento === true} className={styles.chip} onClick={() => setPedeDocumento(true)}>
          Sim: atribuir à Documentação
        </button>
        <button type="button" role="radio" aria-checked={pedeDocumento === false} className={styles.chip} onClick={() => setPedeDocumento(false)}>
          Não: seguir para ligar e orientar
        </button>
      </div>
    </div>
  )

  return (
    <>
      <title>{`${ficha.nome} · ${remarcacao ? 'Remarcar' : 'Marcar'} perícia · GGV Previdenciário`}</title>
      <TopoPasso contexto={`${t.processo.numero ? `Processo ${t.processo.numero} · ` : ''}${ficha.nome}`} inicio={perfil?.inicio ?? '/juridico-administrativo'} />
      <main className={styles.pagina}>
        <div className={styles.principal}>
          <div className={styles.cabecalho}>
            <div className={styles.chips}>
              <span className={styles.codigo} title="DP.02 · Marcar a perícia (passo do BPMN)">
                DP.02
              </span>
              <span className={styles.codigo}>Jurídico administrativo</span>
              <span className={styles.beneficio}>◆ {t.beneficio}</span>
            </div>
            <h1 className={styles.titulo}>
              <strong>{ficha.nome}</strong> · {remarcacao ? 'Remarcar perícia' : 'Marcar perícia'}
            </h1>
            <p className={styles.subtitulo}>
              {tipo} · {pericia.instancia === 'inss' ? 'no INSS; subir o comprovante' : 'data do juízo'}
              {remarcacao && ` · ${pericia.remarcacoes}ª remarcação`}
            </p>
          </div>

          <InstrucoesPasso beneficio={t.beneficio} de={ficha.nome} fichaId={ficha.id} processoId={processoId} funcao="Jurídico administrativo">
            {pericia.instancia === 'inss'
              ? `Marque a ${tipo} de ${primeiro} pelo Meu INSS (senha no cofre): o portal já liberou o agendamento. Baixe o comprovante do agendamento (PDF) e suba aqui: o sistema lê data, hora, local e tipo, coloca na agenda e na ficha e agenda o lembrete da véspera. Depois decida: se a perícia pede documento novo, atribua à Documentação (DP.03), que reúne até ${DIAS_ANTES_DOCUMENTOS} dias antes; se não pede, siga para ligar e orientar ${primeiro} (DP.06) até ${DIAS_ANTES_PREPARO} dias antes. Não deu? Registre a tentativa: a próxima é amanhã. Remarcação tem limite; estourou, sobe para a advogada (G15).`
              : `A data da ${tipo} de ${primeiro} veio do juízo: o sistema leu na publicação e pôs na agenda. Confira abaixo e siga para orientar ${primeiro} (DP.06) até ${DIAS_ANTES_PREPARO} dias antes.`}
          </InstrucoesPasso>

          {aviso && (
            <p role="status" className={styles.aviso}>
              {aviso}
            </p>
          )}

          {t.situacao === 'aguardando-inss' && <p className={styles.trava}>O INSS ainda não liberou o agendamento (D2.E1): a tarefa aparece na sua Central quando liberar.</p>}
          {t.situacao === 'na-advogada' && (
            <p className={styles.trava}>
              Passou do limite de {LIMITE_DE_REMARCACOES_DA_PERICIA} remarcações: a advogada responsável decide se vale mais uma (G15). A perícia volta para você
              se ela autorizar.
            </p>
          )}

          {t.situacao === 'aguardando-comprovante' && (
            <p className={styles.aviso}>
              Marcada no Meu INSS em {dataCurta(hojeIso(new Date(pericia.esperaComprovante!.desde)), hoje)}; o comprovante ainda não saiu (DP.E1). A tarefa
              espera, com lembrete diário: quando o comprovante sair, suba aqui.
            </p>
          )}

          {marcando && deuCerto === 'nao' && (
            <section className={styles.cartao} aria-labelledby="tentativa">
              <h2 id="tentativa" className={styles.cartaoTitulo}>
                Tentativa sem sucesso
              </h2>
              <div className={cobranca.formulario}>
                <label>
                  Dia da tentativa (dd/mm/aaaa) *
                  <input inputMode="numeric" maxLength={10} placeholder="dd/mm/aaaa" value={dia} onChange={(e) => setDia(e.target.value)} onBlur={() => setDia(normalizarData(dia))} />
                </label>
              </div>
              <label className={proprio.campo}>
                O que aconteceu *
                <textarea className={cobranca.justificativa} rows={2} maxLength={300} value={oQueAconteceu} onChange={(e) => setOQueAconteceu(e.target.value)} />
              </label>
            </section>
          )}

          {comComprovante && (
            <section className={styles.cartao} aria-labelledby="comprovante">
              <h2 id="comprovante" className={styles.cartaoTitulo}>
                Comprovante do agendamento
              </h2>
              <label className={proprio.campo}>
                Comprovante do INSS (PDF) *
                {comprovante ? (
                  <span className={proprio.arquivo}>
                    ▤ {comprovante.nome} · {kb(comprovante.tamanho)} · anexado
                  </span>
                ) : (
                  <input type="file" accept=".pdf" onChange={(e) => void anexar(e.target.files?.[0])} />
                )}
              </label>
              {lido && (
                <fieldset className={proprio.lido}>
                  <legend>Lido do comprovante · confira</legend>
                  <label>
                    Data (dd/mm/aaaa)
                    <input inputMode="numeric" maxLength={10} value={data} onChange={(e) => setData(e.target.value)} onBlur={() => setData(normalizarData(data))} />
                  </label>
                  <label>
                    Hora
                    <input type="time" value={lido.hora} onChange={(e) => setLido({ ...lido, hora: e.target.value })} />
                  </label>
                  <label className={proprio.largo}>
                    Local
                    <input maxLength={120} value={lido.local} onChange={(e) => setLido({ ...lido, local: e.target.value })} />
                  </label>
                  <p className={proprio.largo}>
                    {NOMES_DO_TIPO[lido.tipo]} · {lido.modalidade} · perito não consta no comprovante
                  </p>
                </fieldset>
              )}
              {decisaoDocumento}
            </section>
          )}

          {marcando && deuCerto === 'sem-comprovante' && (
            <section className={styles.cartao} aria-labelledby="sem-comprovante">
              <h2 id="sem-comprovante" className={styles.cartaoTitulo}>
                Marcado, sem o comprovante ainda
              </h2>
              <p>A tarefa fica esperando o comprovante do INSS (DP.E1), com lembrete diário. Se a perícia já pede documento novo, a Documentação começa agora.</p>
              {decisaoDocumento}
            </section>
          )}

          {t.situacao === 'agendada' && pericia.marcacao && (
            <section className={styles.feito} aria-labelledby="registrada">
              <h2 id="registrada" className={styles.feitoTitulo}>
                ✓ Perícia registrada
              </h2>
              <p>
                {diaFalado(pericia.marcacao.data)}, {pericia.marcacao.hora} · {pericia.marcacao.local} · {NOMES_DO_TIPO[pericia.marcacao.tipo]} ·{' '}
                {pericia.marcacao.modalidade}
              </p>
              <p>
                {pericia.marcacao.origem === 'juizo'
                  ? 'A data veio do juízo: o sistema leu na publicação e pôs na agenda e na ficha.'
                  : `Comprovante ${pericia.marcacao.comprovante} lido pelo sistema e conferido por ${pericia.marcacao.registradaPor}; a perícia está na agenda e na ficha.`}
              </p>
              <p>
                Lembrete da véspera: {dataCurta(pericia.lembrete!.para, hoje)}, pelo Chatwoot, revisado pelo Jurídico
                {pericia.lembrete!.enviadoEm ? ` · enviado em ${dataHora(pericia.lembrete!.enviadoEm)} por ${pericia.lembrete!.por}` : ''}.
              </p>
              <p>
                {pericia.pedeDocumentoNovo
                  ? `A perícia pede documento novo: a Documentação reúne até ${dataCurta(t.prazos!.documentosAte, hoje)} (${DIAS_ANTES_DOCUMENTOS} dias antes).`
                  : `Não pede documento novo: o próximo passo é ligar e orientar ${primeiro} até ${dataCurta(t.prazos!.preparoAte, hoje)} (${DIAS_ANTES_PREPARO} dias antes).`}
              </p>
              {(pericia.marcacoesAnteriores?.length ?? 0) > 0 && (
                <ul className={styles.ladoLista} aria-label="Datas anteriores">
                  {pericia.marcacoesAnteriores!.map((m) => (
                    <li key={m.registradaEm}>
                      • Antes: {dataCurta(m.data, hoje)}, {m.hora} · {m.local}
                    </li>
                  ))}
                </ul>
              )}
              <div className={styles.rodape}>
                {!pericia.lembrete!.enviadoEm && (
                  <button type="button" className={styles.principalBotao} disabled={!t.lembreteHoje} onClick={() => setLembrete(true)}>
                    Enviar o lembrete da véspera
                  </button>
                )}
                {pericia.marcacao.origem === 'comprovante' && (
                  <>
                    <button type="button" className={proprio.secundario} onClick={() => { setTrocar(true); setPedeDocumento(pericia.pedeDocumentoNovo) }}>
                      Subir o comprovante novo (data alterada)
                    </button>
                    <button type="button" className={proprio.secundario} onClick={() => setAbrirRemarcar(true)}>
                      Remarcar a perícia
                    </button>
                  </>
                )}
                {!t.lembreteHoje && !pericia.lembrete!.enviadoEm && <p className={styles.motivo}>O lembrete abre na véspera, {dataCurta(pericia.lembrete!.para, hoje)}.</p>}
              </div>
            </section>
          )}

          {t.situacao === 'agendada' && abrirRemarcar && (
            <section className={styles.cartao} aria-labelledby="remarcar">
              <h2 id="remarcar" className={styles.cartaoTitulo}>
                Remarcar a perícia
              </h2>
              <p>
                A remarcação conta no limite de {LIMITE_DE_REMARCACOES_DA_PERICIA}: já foram {pericia.remarcacoes}. Passou dele, a perícia sobe para a advogada
                responsável (G15). Depois de remarcar no Meu INSS, suba o comprovante novo: o lembrete é reprogramado.
              </p>
              <label className={proprio.campo}>
                Motivo da remarcação *
                <textarea className={cobranca.justificativa} rows={2} maxLength={300} value={motivoRemarcar} onChange={(e) => setMotivoRemarcar(e.target.value)} />
              </label>
              <div className={styles.rodape}>
                <button
                  type="button"
                  className={styles.principalBotao}
                  disabled={motivoRemarcar.trim().length < 3}
                  onClick={() => agir(() => remarcarPericia(processoId, motivoRemarcar, quem), 'Remarcação registrada: a tarefa de marcar volta para você.')}
                >
                  Registrar a remarcação
                </button>
              </div>
            </section>
          )}

          {(marcando || t.situacao === 'agendada') && <p className={styles.aviso}>Remarcação tem limite; estourou, sobe para a advogada (G15).</p>}

          {pericia.tentativas.length > 0 && (
            <section className={styles.cartao} aria-labelledby="tentativas">
              <h2 id="tentativas" className={styles.cartaoTitulo}>
                Tentativas
              </h2>
              <ul className={cobranca.lista} aria-label="Tentativas de marcar">
                {pericia.tentativas.map((x, i) => (
                  <li key={x.quando}>
                    {i + 1}ª · {dataCurta(x.dia, hoje)} · {x.oQueAconteceu} · {x.quem}
                  </li>
                ))}
              </ul>
              {t.proximaTentativa && <p className={cobranca.detalhe}>Próxima tentativa: {prazoFalado(t.proximaTentativa, hoje).texto} (uma por dia).</p>}
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
                <button type="button" className={cobranca.botao} aria-disabled="true" title="A conversa abre pelo Chatwoot (GGVP-102)">
                  WhatsApp
                </button>
              </span>
            </div>
          </section>

          {(marcando || comComprovante) && (
            <div className={styles.rodape}>
              {deuCerto === 'nao' ? (
                <>
                  <button
                    type="button"
                    className={styles.principalBotao}
                    disabled={motivoTentativa !== null}
                    onClick={() =>
                      agir(
                        () => registrarTentativa(processoId, { dia: dataParaIso(dia)!, oQueAconteceu }, quem),
                        'Tentativa registrada: a tarefa continua com você e volta amanhã.',
                      )
                    }
                  >
                    Registrar a tentativa
                  </button>
                  {motivoTentativa && <p className={styles.motivo}>{motivoTentativa}</p>}
                </>
              ) : deuCerto === 'sem-comprovante' ? (
                <>
                  <button
                    type="button"
                    className={styles.principalBotao}
                    disabled={pedeDocumento === undefined}
                    onClick={() =>
                      agir(() => esperarComprovante(processoId, { pedeDocumentoNovo: pedeDocumento! }, quem), 'A tarefa espera o comprovante, com lembrete diário.')
                    }
                  >
                    Esperar o comprovante
                  </button>
                  {pedeDocumento === undefined && <p className={styles.motivo}>Responda se a perícia pede documento novo.</p>}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className={styles.principalBotao}
                    disabled={!comComprovante || motivoMarcacao !== null}
                    onClick={() =>
                      agir(
                        () => registrarMarcacao(processoId, { comprovante: comprovante!, lido: lidoConferido!, pedeDocumentoNovo: pedeDocumento! }, quem),
                        'Perícia registrada: na agenda e na ficha, com o lembrete da véspera agendado.',
                      )
                    }
                  >
                    Registrar a perícia
                  </button>
                  {!comComprovante ? (
                    <p className={styles.motivo}>Responda se a tentativa deu certo.</p>
                  ) : (
                    motivoMarcacao && <p className={styles.motivo}>{motivoMarcacao}</p>
                  )}
                </>
              )}
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
          <p className={styles.ladoSub}>O que o BPMN (Miro) pede no passo DP.02.</p>
          <h3 className={styles.ladoSecao}>Decisões</h3>
          <div className={styles.decisao}>
            <span>A tentativa deu certo?</span>
            <div className={styles.ladoOpcoes} role="radiogroup" aria-label="A tentativa deu certo?">
              {TENTATIVAS.map((o) => (
                <button key={o.id} type="button" role="radio" aria-checked={deuCerto === o.id} className={styles.chip} disabled={!marcando} onClick={() => setDeuCerto(o.id)}>
                  {o.rotulo}
                </button>
              ))}
            </div>
          </div>
          <h3 className={styles.ladoSecao}>Campos</h3>
          <ul className={styles.ladoLista}>
            <li>• Se «Sim, marcado»: Comprovante do INSS (PDF)*</li>
            <li>• Se «Sim, marcado»: A perícia pede documento novo?*</li>
            <li>• Se «Não, tentar de novo»: o dia e o que aconteceu*</li>
          </ul>
          <h3 className={styles.ladoSecao}>Travas</h3>
          <p className={styles.trava}>Remarcação tem limite; passou, sobe para a advogada (G15).</p>
          <p className={styles.ladoSub}>«Registrar a perícia» só habilita com as decisões respondidas e o comprovante anexado.</p>
          <p className={styles.ladoSub}>A marcação é pelo Meu INSS, com a senha do cofre (G9): nenhum campo de senha aqui. A IA não escolhe nem sugere o perito.</p>
        </aside>
      </main>
      <AbaSuporte />
      {lembrete && (
        <ConviteChatwoot
          agendamentoId={processoId}
          assunto="pericia-lembrete"
          aoEnviado={async () => {
            setLembrete(false)
            setT(await obterPericia(processoId))
            setAviso('Lembrete da véspera enviado pelo Chatwoot e registrado na perícia.')
          }}
          aoFechar={() => setLembrete(false)}
        />
      )}
    </>
  )
}
