import { useEffect, useId, useRef, useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import campoCss from '../componentes/Campo.module.css'
import { TopoPasso } from '../componentes/TopoPasso.tsx'
import { nomeBeneficio } from '../dados/catalogos.ts'
import { obterPreparacao } from '../dados/preparacao.ts'
import { registrarRenovacao } from '../dados/renovacao.ts'
import { agora } from '../dados/servidor.ts'
import type { Preparacao, SenhaGov } from '../dados/tipos.ts'
import { dataCurta, dataHora, hojeIso } from '../regras/datas.ts'
import { situacaoDaSenha } from '../regras/fichaAtendimento.ts'
import styles from './Balcao.module.css'
import proprio from './RenovarSenha.module.css'

// Figma: step_D1.08 "Renovar senha do gov.br" (10:89). A decisão "Conseguiu renovar?" fica no painel, como no desenho.
// A senha é digitada numa caixa mascarada que vai direto ao cofre e é esquecida na hora (G9).

type Resultado = 'renovou' | 'nao-conseguiu'

export function RenovarSenha({ agendamentoId }: { agendamentoId: string }) {
  const idSenha = useId()
  const idMotivo = useId()
  const [dados, setDados] = useState<Preparacao | null | undefined>(undefined)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [senha, setSenha] = useState('')
  const [conferiu, setConferiu] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [avisou, setAvisou] = useState(false)
  const [registrando, setRegistrando] = useState(false)
  const [feito, setFeito] = useState<{ senhaGov: SenhaGov; resultado: Resultado } | null>(null)
  const [erro, setErro] = useState('')
  const travado = useRef(false)
  const hoje = hojeIso(agora())

  useEffect(() => {
    let valendo = true
    obterPreparacao(agendamentoId).then((d) => {
      if (valendo) setDados(d)
    })
    return () => {
      valendo = false
    }
  }, [agendamentoId])

  if (!dados) {
    return (
      <main className={proprio.vazia}>
        <title>Renovar senha do gov.br · GGV Previdenciário</title>
        <h1 className={styles.titulo}>{dados === null ? 'Entrevista não encontrada' : 'Abrindo a tarefa…'}</h1>
        {dados === null && <a href="/">Voltar ao início</a>}
      </main>
    )
  }

  const { ficha, agendamento: a } = dados
  const primeiro = ficha.nome.split(' ')[0]
  const quando = `${a.data === hoje ? 'hoje' : dataCurta(a.data, hoje)} às ${a.hora}`
  const motivoParado = !resultado
    ? 'Responda se conseguiu renovar.'
    : resultado === 'renovou'
      ? senha === ''
        ? 'Digite a nova senha na caixa do cofre.'
        : !conferiu
          ? 'Confira que o Meu INSS abre e que o CNIS aparece.'
          : null
      : motivo.trim().length < 3
        ? 'Escreva por que não foi possível.'
        : !avisou
          ? 'Avise o cliente e marque o aviso.'
          : null

  function escolher(r: Resultado) {
    setResultado(r)
    setErro('')
    // A senha não fica na tela à toa: trocar para "Não" apaga o que foi digitado.
    if (r === 'nao-conseguiu') setSenha('')
  }

  async function registrar() {
    if (travado.current || motivoParado || !resultado) return
    travado.current = true
    setRegistrando(true)
    setErro('')
    try {
      const r = await registrarRenovacao(
        agendamentoId,
        resultado === 'renovou' ? { resultado, senha, conferiMeuInss: true } : { resultado, motivo, aviseiOCliente: true },
      )
      setSenha('')
      setFeito({ senhaGov: r.senhaGov, resultado })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para registrar.')
    } finally {
      travado.current = false
      setRegistrando(false)
    }
  }

  return (
    <>
      <title>{`${ficha.nome} · Renovar senha do gov.br · GGV Previdenciário`}</title>
      <TopoPasso contexto={`${ficha.situacao === 'lead' ? 'Lead' : 'Cliente'} · ${ficha.nome}`} />
      <main className={styles.pagina}>
        <div className={styles.principal}>
          <div className={styles.cabecalho}>
            <div className={styles.chips}>
              <span className={styles.codigo} title="D1.08 · Renovar a senha do gov.br (passo do BPMN)">
                D1.08
              </span>
              <span className={styles.codigo}>Atendimento</span>
            </div>
            <h1 className={styles.titulo}>
              <strong>{ficha.nome}</strong> · Renovar senha do gov.br
            </h1>
            <p className={styles.subtitulo}>antes da entrevista de {quando}</p>
          </div>

          <section className={styles.instrucoes} aria-labelledby="o-que-fazer">
            <div className={styles.instrucoesTopo}>
              <span className={styles.estrela} aria-hidden="true">
                ✦
              </span>
              <h2 id="o-que-fazer" className={styles.instrucoesTitulo}>
                O que você deve fazer
              </h2>
              <span className={styles.beneficio}>◆ {nomeBeneficio(ficha.beneficioInteresse) || 'a definir'}</span>
              <span className={styles.instrucoesDe}>· {ficha.nome}</span>
            </div>
            <p className={styles.instrucoesTexto}>
              Antes da entrevista de {primeiro}, renove a senha do gov.br junto com o cliente. O código de verificação chega
              no celular do próprio cliente (ou no e-mail dele): peça que ele esteja com o celular. Digite a senha direto no
              cofre, sem ditar nem anotar (G9). Confirme que o Meu INSS abre e que o CNIS está acessível: a advogada precisa
              dele.
            </p>
            <div className={styles.atalhos}>
              <a className={styles.atalho} href={`/clientes/${ficha.id}`}>
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
            <p className={proprio.tarefa}>Renovar a senha do Meu INSS e guardar no cofre.</p>
            <p className={proprio.situacao} data-ok={(feito?.senhaGov ?? ficha.senhaGov).situacao === 'no-cofre'}>
              gov.br: {situacaoDaSenha(feito?.senhaGov ?? ficha.senhaGov, hoje)}
            </p>
            {ficha.renovacao && !feito && (
              <p className={styles.nota}>
                Tentativa anterior: {ficha.renovacao.resultado === 'renovou' ? 'renovou' : `não conseguiu (${ficha.renovacao.motivo})`}, em{' '}
                {dataHora(ficha.renovacao.quando)}.
              </p>
            )}

            {!feito && resultado === 'renovou' && (
              <div className={proprio.campos}>
                <div className={campoCss.campo}>
                  <label className={campoCss.rotulo} htmlFor={idSenha}>
                    Nova senha do gov.br (vai direto ao cofre, G9)
                  </label>
                  <input
                    id={idSenha}
                    className={campoCss.entrada}
                    type="password"
                    autoComplete="new-password"
                    maxLength={100}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                  />
                </div>
                <label className={proprio.conferencia}>
                  <input type="checkbox" checked={conferiu} onChange={(e) => setConferiu(e.target.checked)} />
                  Conferi que o Meu INSS abre e que o CNIS aparece
                </label>
              </div>
            )}

            {!feito && resultado === 'nao-conseguiu' && (
              <div className={proprio.campos}>
                <div className={campoCss.campo}>
                  <label className={campoCss.rotulo} htmlFor={idMotivo}>
                    Por que não foi possível *
                  </label>
                  <textarea id={idMotivo} className={campoCss.entrada} rows={3} maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                </div>
                <label className={proprio.conferencia}>
                  <input type="checkbox" checked={avisou} onChange={(e) => setAvisou(e.target.checked)} />
                  Avisei o cliente que precisa recuperar a senha, se preciso numa agência do INSS
                </label>
              </div>
            )}
          </section>

          <p className={styles.trava}>Senha só no cofre; nunca em texto transcrito (G9).</p>

          {feito ? (
            <section className={styles.feito} aria-labelledby="renovacao-registrada">
              <h2 id="renovacao-registrada" className={styles.feitoTitulo}>
                {feito.resultado === 'renovou' ? `✓ ${situacaoDaSenha(feito.senhaGov, hoje)}` : '✓ Registrado: não foi possível renovar'}
              </h2>
              <p>
                {feito.resultado === 'renovou'
                  ? 'O Meu INSS abriu e o CNIS aparece. A entrevista segue, e a advogada vê o resultado na preparação.'
                  : 'O aviso ao cliente ficou em "Últimos contatos". A entrevista segue no horário marcado, e a advogada vê o resultado na preparação.'}
              </p>
              <div className={styles.atalhos}>
                <a className={styles.atalho} href={`/clientes/${ficha.id}`}>
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
                {registrando ? 'guardando…' : resultado === 'nao-conseguiu' ? 'Registrar' : 'Guardar no cofre'}
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

        <aside className={styles.lado} aria-labelledby="antes-de-concluir">
          <h2 id="antes-de-concluir" className={styles.ladoTitulo}>
            Antes de concluir
          </h2>
          <p className={styles.ladoSub}>O que o BPMN (Miro) pede no passo D1.08.</p>
          <h3 className={styles.ladoSecao}>Decisões</h3>
          <div className={styles.decisao}>
            <p id="conseguiu">Conseguiu renovar?</p>
            <div className={styles.ladoOpcoes} role="radiogroup" aria-labelledby="conseguiu">
              <button type="button" role="radio" className={styles.chip} aria-checked={resultado === 'renovou'} disabled={feito !== null} onClick={() => escolher('renovou')}>
                Sim
              </button>
              <button
                type="button"
                role="radio"
                className={styles.chip}
                aria-checked={resultado === 'nao-conseguiu'}
                disabled={feito !== null}
                onClick={() => escolher('nao-conseguiu')}
              >
                Não
              </button>
            </div>
          </div>
          <h3 className={styles.ladoSecao}>Campos</h3>
          <ul className={styles.ladoLista}>
            <li>• Se «Sim»: Nova senha do gov.br (vai direto ao cofre, G9)</li>
            <li>• Se «Não»: Por que não foi possível*</li>
          </ul>
          <h3 className={styles.ladoSecao}>Travas</h3>
          <p className={styles.trava}>
            Se «Não»: avise a cliente que ela precisa recuperar a senha (se preciso, numa agência do INSS). A entrevista segue no
            horário marcado.
          </p>
          <p className={styles.ladoSub}>«Guardar no cofre» só habilita com as decisões respondidas e os campos com * preenchidos.</p>
        </aside>
      </main>
      <AbaSuporte />
    </>
  )
}
