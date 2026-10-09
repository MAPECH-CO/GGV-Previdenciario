import { useEffect, useRef, useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { AntesDeConcluirConfirmacao, type Resultado } from '../componentes/AntesDeConcluirConfirmacao.tsx'
import { ConviteChatwoot } from '../componentes/ConviteChatwoot.tsx'
import { TopoPasso } from '../componentes/TopoPasso.tsx'
import { formatarTelefone } from '../campos.ts'
import { TIPOS_DE_ENTREVISTA, nomeBeneficio } from '../dados/catalogos.ts'
import { obterConfirmacao, registrarConfirmacao, type DadosDaConfirmacao } from '../dados/confirmacao.ts'
import { agora } from '../dados/servidor.ts'
import type { CanalDoContato, RespostaDaConfirmacao } from '../dados/tipos.ts'
import { DIAS_ENTRE_TENTATIVAS, TENTATIVAS_DE_CONFIRMACAO, confirmada, instrucaoDaConfirmacao } from '../regras/confirmacao.ts'
import { emAberto } from '../regras/busca.ts'
import { dataCurta, hojeIso, hora } from '../regras/datas.ts'
import styles from './Balcao.module.css'
import proprio from './ConfirmarAgendamento.module.css'

// Figma: step_D1.04 "Confirmar agendamento" (10:33). As decisões ficam no painel "Antes de concluir", como no desenho.

function LogoChatwoot() {
  return (
    <svg className={proprio.logo} viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="8" fill="#1f93ff" />
      <circle cx="8" cy="8" r="3.5" fill="none" stroke="#fff" strokeWidth="2" />
    </svg>
  )
}

export function ConfirmarAgendamento({ agendamentoId }: { agendamentoId: string }) {
  const [dados, setDados] = useState<DadosDaConfirmacao | null | undefined>(undefined)
  const [canal, setCanal] = useState<CanalDoContato | null>(null)
  const [contato, setContato] = useState('')
  const [chatwoot, setChatwoot] = useState(false)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [ficha, setFicha] = useState<boolean | null>(null)
  const [registrando, setRegistrando] = useState(false)
  const [feito, setFeito] = useState<RespostaDaConfirmacao | null>(null)
  const [erro, setErro] = useState('')
  // Trava no mesmo clique, antes de o React redesenhar o botão.
  const travado = useRef(false)
  const hoje = hojeIso(agora())

  useEffect(() => {
    let valendo = true
    obterConfirmacao(agendamentoId).then((d) => {
      if (valendo) setDados(d)
    })
    return () => {
      valendo = false
    }
  }, [agendamentoId])

  if (!dados) {
    return (
      <main className={proprio.vazia}>
        <title>Confirmar agendamento · GGV Previdenciário</title>
        <h1 className={styles.titulo}>{dados === null ? 'Compromisso não encontrado' : 'Abrindo a tarefa…'}</h1>
        {dados === null && <a href="/">Voltar ao início</a>}
      </main>
    )
  }

  const { ficha: pessoa, agendamento: a, tentativa } = dados
  const primeiro = pessoa.nome.split(' ')[0]
  const beneficio = nomeBeneficio(pessoa.beneficioInteresse) || 'a definir'
  const telefone = pessoa.telefone ? formatarTelefone(pessoa.telefone) : 'sem telefone'
  const tipo = TIPOS_DE_ENTREVISTA.find((t) => t.id === a.tipo)?.nome.toLowerCase() ?? 'presencial'
  const quando = `${a.data === hoje ? 'Hoje' : dataCurta(a.data, hoje)} às ${a.hora}`
  const aberta = pessoa.situacao === 'lead' && a.oQue === 'Entrevista' && emAberto(a) && a.data >= hoje && !confirmada(a.confirmacao)
  const naSenior = a.confirmacao?.naSenior === true
  const proxima = a.confirmacao?.proximaEm
  const semRespostaBloqueada = proxima !== undefined && proxima > hoje

  const estado = naSenior
    ? `Com a advogada sênior: ${TENTATIVAS_DE_CONFIRMACAO} tentativas sem resposta. Ela resolve e entra em contato com o lead.`
    : semRespostaBloqueada
      ? `Tentativa ${tentativa} de ${TENTATIVAS_DE_CONFIRMACAO} a partir de ${dataCurta(proxima, hoje)} · sem resposta na segunda, sobe para a sênior (G15)`
      : `Tentativa ${tentativa} de ${TENTATIVAS_DE_CONFIRMACAO}${tentativa < TENTATIVAS_DE_CONFIRMACAO ? ` · a próxima em ${DIAS_ENTRE_TENTATIVAS} dias` : ''} · sem resposta na segunda, sobe para a sênior (G15)`

  const motivoParado = !aberta
    ? confirmada(a.confirmacao)
      ? 'Esta entrevista já foi confirmada.'
      : 'Esta entrevista não espera confirmação.'
    : !canal
      ? 'Ligue ou mande a mensagem pelo Chatwoot.'
      : !resultado
        ? 'Responda o resultado do contato de hoje.'
        : resultado === 'confirmou' && ficha === null
          ? 'Responda se já preencheu a ficha de atendimento.'
          : null

  function ligar() {
    setCanal('ligacao')
    setContato(`Ligação simulada para ${telefone}: registre o resultado ao lado.`)
  }

  async function registrar() {
    if (travado.current || motivoParado || !canal || !resultado) return
    travado.current = true
    setRegistrando(true)
    setErro('')
    try {
      setFeito(
        await registrarConfirmacao(
          agendamentoId,
          resultado === 'confirmou' ? { resultado, canal, jaPreencheuFicha: ficha === true } : { resultado, canal },
        ),
      )
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para registrar.')
    } finally {
      travado.current = false
      setRegistrando(false)
    }
  }

  return (
    <>
      <title>{`${pessoa.nome} · Confirmar agendamento · GGV Previdenciário`}</title>
      <TopoPasso contexto={`Lead · ${pessoa.nome}`} />
      <main className={styles.pagina}>
        <div className={styles.principal}>
          <div className={styles.cabecalho}>
            <div className={styles.chips}>
              <span className={styles.codigo} title="D1.04 · Confirmar agendamento (passo do BPMN)">
                D1.04
              </span>
              <span className={styles.codigo}>Atendimento</span>
              <span className={styles.beneficio}>◆ {beneficio}</span>
            </div>
            <h1 className={styles.titulo}>
              <strong>{pessoa.nome}</strong> · Confirmar agendamento
            </h1>
            <p className={styles.subtitulo}>
              {telefone} · {pessoa.situacao}
            </p>
          </div>

          <section className={styles.instrucoes} aria-labelledby="o-que-fazer">
            <div className={styles.instrucoesTopo}>
              <span className={styles.estrela} aria-hidden="true">
                ✦
              </span>
              <h2 id="o-que-fazer" className={styles.instrucoesTitulo}>
                O que você deve fazer
              </h2>
              <span className={styles.beneficio}>◆ {beneficio}</span>
              <span className={styles.instrucoesDe}>
                · {pessoa.nome} ({pessoa.situacao})
              </span>
            </div>
            <p className={styles.instrucoesTexto}>{instrucaoDaConfirmacao(pessoa.nome, pessoa.beneficioInteresse)}</p>
            <div className={styles.atalhos}>
              <a className={styles.atalho} href={`/clientes/${pessoa.id}`}>
                Abrir a ficha do cliente
              </a>
              <button type="button" className={styles.atalho} aria-disabled="true">
                ▶ Entrevista e transcrições
              </button>
              <button type="button" className={styles.atalho} aria-disabled="true">
                Parecer médico
              </button>
            </div>
            <p className={styles.nota}>Montado pela IA a partir da entrevista, do benefício e do caso. Confira antes de agir.</p>
          </section>

          <section className={styles.cartao}>
            <p className={proprio.tarefa}>Confirmar a entrevista com o lead e, se ainda não tem ficha, preencher.</p>
          </section>

          <section className={styles.cartao} aria-labelledby="contato-do-cliente">
            <h2 id="contato-do-cliente" className={styles.cartaoTitulo}>
              Contato do cliente
            </h2>
            <div className={proprio.contato}>
              <div>
                <p className={proprio.nome}>{pessoa.nome}</p>
                <p className={proprio.linha}>{telefone}</p>
                <p className={proprio.linha}>
                  Entrevista {quando.toLowerCase()} · {tipo}
                  {a.com ? ` com ${a.com}` : ''}
                </p>
                <p className={proprio.linha}>
                  Ficha de atendimento: {pessoa.fichaAtendimentoPreenchida ? 'preenchida' : 'ainda não preenchida'}
                </p>
              </div>
              <div className={proprio.botoes}>
                <button type="button" className={styles.atalho} disabled={!aberta || !pessoa.telefone || feito !== null} onClick={ligar}>
                  Ligar
                </button>
                <button
                  type="button"
                  className={styles.atalho}
                  disabled={!aberta || !pessoa.telefone || feito !== null}
                  onClick={() => setChatwoot(true)}
                >
                  <LogoChatwoot />
                  Chatwoot
                </button>
              </div>
            </div>
            {contato && (
              <p role="status" className={proprio.feitoContato}>
                {contato}
              </p>
            )}
          </section>

          {feito ? (
            <section className={styles.feito} aria-labelledby="registrado">
              <h2 id="registrado" className={styles.feitoTitulo}>
                {resultado === 'confirmou'
                  ? `✓ Entrevista confirmada às ${hora(agora().toISOString())}`
                  : `Tentativa ${feito.tentativa} de ${TENTATIVAS_DE_CONFIRMACAO} registrada`}
              </h2>
              <p>
                {resultado === 'confirmou'
                  ? ficha
                    ? `${a.com ?? 'A advogada'} recebeu "Preparar entrevista" com a ficha de ${primeiro}.`
                    : `Ficou a pendência "Preencher ficha" ${feito.tarefa?.prazo ?? ''}: a ficha em papel, preenchida no balcão ou com quem captou ${primeiro}, escaneada antes da entrevista.`
                  : feito.naSenior
                    ? 'Sem resposta na segunda tentativa: a tarefa passou para a advogada sênior, que resolve e entra em contato com o lead.'
                    : `Sem resposta: a próxima tentativa é em ${dataCurta(feito.proximaEm!, hoje)}.`}
              </p>
              <div className={styles.atalhos}>
                {resultado === 'confirmou' && !ficha && (
                  <a className={styles.atalho} href={`/clientes/${pessoa.id}/ficha-de-atendimento`}>
                    Preencher a ficha agora
                  </a>
                )}
                <a className={styles.atalho} href={`/clientes/${pessoa.id}`}>
                  Abrir a ficha do cliente
                </a>
                <a className={styles.atalho} href="/">
                  Voltar ao início
                </a>
              </div>
            </section>
          ) : (
            <div className={styles.rodape}>
              <button type="button" className={styles.principalBotao} disabled={motivoParado !== null || registrando} onClick={registrar}>
                {registrando ? 'registrando…' : resultado === 'sem-resposta' ? 'Registrar tentativa' : 'Confirmar entrevista'}
              </button>
              {motivoParado && <p className={styles.motivo}>{motivoParado}</p>}
              {erro && (
                <p role="alert" className={styles.motivo}>
                  {erro}
                </p>
              )}
            </div>
          )}
        </div>
        <AntesDeConcluirConfirmacao
          resultado={resultado}
          aoResultado={(r) => {
            setResultado(r)
            if (r === 'sem-resposta') setFicha(null)
          }}
          ficha={ficha}
          aoFicha={setFicha}
          estado={estado}
          semRespostaBloqueada={semRespostaBloqueada}
          travado={!aberta || feito !== null}
        />
      </main>
      <AbaSuporte />
      {chatwoot && (
        <ConviteChatwoot
          agendamentoId={a.id}
          assunto="confirmacao"
          aoEnviado={() => {
            setChatwoot(false)
            setCanal('mensagem')
            setContato(`Mensagem de confirmação enviada pelo Chatwoot às ${hora(agora().toISOString())}: registre o resultado ao lado.`)
          }}
          aoFechar={() => setChatwoot(false)}
        />
      )}
    </>
  )
}
