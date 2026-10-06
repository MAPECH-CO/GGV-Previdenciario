import { useEffect, useRef, useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { CabecalhoDoPasso } from '../componentes/CabecalhoDoPasso.tsx'
import { CampoDoRecontato, CamposDoMotivo } from '../componentes/CamposDoFechamento.tsx'
import { ResumoDoFechamento } from '../componentes/CartaoFechamento.tsx'
import { TopoPasso } from '../componentes/TopoPasso.tsx'
import { formatarTelefone } from '../campos.ts'
import { nomeMotivo } from '../dados/catalogos.ts'
import { obterFechamento, registrarRecontato, rotaDoCalculo, ultimoCalculo, type DadosDoFechamento } from '../dados/fechamento.ts'
import { agora } from '../dados/servidor.ts'
import type { EsperaDoRecontato, PapelNoFechamento, ResultadoDoRecontato } from '../dados/tipos.ts'
import { dataCurta, hojeIso } from '../regras/datas.ts'
import { erroDataDoCompromisso } from '../regras/formularios.ts'
import { beneficioDoFechamento, erroDoRecontato, podeRegistrarOMotivo, recontatoDevido, TAMANHO_DO_DETALHE } from '../regras/fechamento.ts'
import styles from './Balcao.module.css'
import proprio from './RegistrarFechamento.module.css'

// O recontato do lead que não fechou (GGVP-60, CA3, CA8 a CA10). Sem tela própria no Figma: segue o desenho das telas de passo
// (step_D1.14 `10:112`), com o compromisso "Recontatar lead" da agenda (1941:2).

type Escolha = ResultadoDoRecontato['resultado']

export function Recontatar({ fichaId }: { fichaId: string }) {
  const hoje = hojeIso(agora())
  const [dados, setDados] = useState<DadosDoFechamento | null | undefined>(undefined)
  const [escolha, setEscolha] = useState<Escolha | null>(null)
  const [data, setData] = useState('')
  const [espera, setEspera] = useState<EsperaDoRecontato | null>(null)
  const [erroData, setErroData] = useState<string | undefined>()
  const [motivo, setMotivo] = useState('')
  const [detalhe, setDetalhe] = useState('')
  const [papel, setPapel] = useState<PapelNoFechamento>('atendimento')
  const [ligando, setLigando] = useState(false)
  const [feito, setFeito] = useState<Escolha | null>(null)
  const [registrando, setRegistrando] = useState(false)
  const [erro, setErro] = useState('')
  const travado = useRef(false)

  useEffect(() => {
    let valendo = true
    obterFechamento(fichaId).then((d) => {
      if (valendo) setDados(d)
    })
    return () => {
      valendo = false
    }
  }, [fichaId])

  if (!dados) {
    return (
      <main className={proprio.vazia}>
        <title>Recontatar lead · GGV Previdenciário</title>
        <h1 className={styles.titulo}>{dados === null ? 'Ficha não encontrada' : 'Abrindo a tarefa…'}</h1>
        {dados === null && <a href="/">Voltar ao início</a>}
      </main>
    )
  }

  const { ficha } = dados
  const f = ficha.fechamento
  const primeiro = ficha.nome.split(' ')[0]
  const marcado = f?.situacao === 'recontatar' && feito === null
  const { atrasado } = recontatoDevido(ficha, hoje)
  const semDireito = f?.motivo === 'sem-direito'
  const calculo = ultimoCalculo(ficha)
  const motivoParado =
    escolha === null
      ? 'Responda o resultado do recontato.'
      : escolha === 'nova-data' && erroDataDoCompromisso(data, hoje)
        ? 'Escolha a nova data, de hoje em diante.'
        : escolha === 'arquivar' && !motivo
          ? 'Escolha o motivo para arquivar (G16).'
          : escolha === 'arquivar' && !podeRegistrarOMotivo(motivo, papel)
            ? 'A recusa do escritório é registrada pelo Atendimento sênior ou pela advogada do atendimento.'
            : escolha === 'arquivar' && detalhe.length > TAMANHO_DO_DETALHE
              ? `Detalhe até ${TAMANHO_DO_DETALHE} caracteres.`
              : null

  async function registrar() {
    if (travado.current || motivoParado || !escolha) return
    travado.current = true
    setRegistrando(true)
    setErro('')
    try {
      const r = await registrarRecontato(
        fichaId,
        escolha === 'calculo'
          ? { resultado: 'calculo' }
          : escolha === 'nova-data'
            ? { resultado: 'nova-data', data, ...(espera && { espera }) }
            : { resultado: 'arquivar', motivo, detalhe, papel },
      )
      setDados({ ...dados!, ficha: r.ficha })
      setFeito(escolha)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para registrar.')
    } finally {
      travado.current = false
      setRegistrando(false)
    }
  }

  const opcoes: { id: Escolha; rotulo: string }[] = [
    { id: 'calculo', rotulo: 'Quer seguir: voltar ao cálculo (D1.13)' },
    { id: 'nova-data', rotulo: 'Ainda não: nova data' },
    { id: 'arquivar', rotulo: 'Não vai seguir: arquivar' },
  ]

  return (
    <>
      <title>{`${ficha.nome} · Recontatar lead · GGV Previdenciário`}</title>
      <TopoPasso contexto={`Lead · ${ficha.nome}`} />
      <main className={styles.pagina}>
        <div className={styles.principal}>
          <CabecalhoDoPasso
            passo="D1.14"
            nomeDoPasso="Recontatar o lead na data prevista"
            setor="Atendimento"
            tarefa="Recontatar lead"
            subtitulo={
              f?.recontatarEm
                ? `recontato ${atrasado ? 'atrasado, era' : 'de'} ${dataCurta(f.recontatarEm, hoje)} · ${nomeMotivo(f.motivo).toLowerCase()}`
                : 'recontato'
            }
            ficha={ficha}
            beneficio={beneficioDoFechamento(ficha)}
            instrucoes={
              semDireito
                ? `Ligue para ${primeiro}: na entrevista, ainda não podia se aposentar. Se quiser seguir, o caso volta para o cálculo de ` +
                  'tempo e pontos (D1.13) com o tempo de agora. Se ainda não, combine uma nova data; se não vai seguir, arquive com o ' +
                  'motivo (G16).'
                : `Ligue para ${primeiro} e pergunte se quer seguir com o escritório. Se quiser, o caso volta para o cálculo de tempo e ` +
                  'pontos (D1.13). Se ainda não, combine uma nova data; se não vai seguir, arquive com o motivo (G16).'
            }
          />

          {f && (
            <section className={styles.cartao} aria-labelledby="por-que">
              <h2 id="por-que" className={styles.cartaoTitulo}>
                Por que não fechou
              </h2>
              <ResumoDoFechamento fechamento={f} hoje={hoje} />
            </section>
          )}

          <section className={styles.cartao} aria-labelledby="calculo">
            <h2 id="calculo" className={styles.cartaoTitulo}>
              Cálculo de tempo e pontos
            </h2>
            {semDireito && <p className={styles.aviso}>Ainda não podia se aposentar: o caso volta para o cálculo de tempo e pontos (D1.13).</p>}
            <p className={proprio.texto}>Último cálculo: {calculo ?? 'nenhum registrado'}.</p>
            <a className={styles.atalho} href={rotaDoCalculo(ficha)}>
              Abrir o cálculo (D1.13)
            </a>
          </section>

          <section className={styles.cartao} aria-labelledby="contato">
            <h2 id="contato" className={styles.cartaoTitulo}>
              Contato do lead
            </h2>
            <div className={proprio.contato}>
              <div>
                <p className={proprio.texto}>{ficha.nome}</p>
                <p className={styles.motivo}>{ficha.telefone ? formatarTelefone(ficha.telefone) : 'sem telefone'}</p>
              </div>
              <button type="button" className={styles.atalho} onClick={() => setLigando(true)}>
                Ligar
              </button>
            </div>
            {ligando && <p className={styles.motivo}>Ligue para {formatarTelefone(ficha.telefone)} (ligação simulada).</p>}
          </section>

          {feito ? (
            <section className={styles.feito} aria-labelledby="recontatado">
              <h2 id="recontatado" className={styles.feitoTitulo}>
                {feito === 'calculo'
                  ? '✓ O caso volta ao cálculo de tempo e pontos'
                  : feito === 'nova-data'
                    ? `✓ Novo recontato em ${dataCurta(ficha.fechamento!.recontatarEm!, hoje)}`
                    : '✓ Lead arquivado com o motivo'}
              </h2>
              <p>
                {feito === 'calculo'
                  ? 'Refeito o cálculo, o Atendimento registra de novo se fechou.'
                  : feito === 'nova-data'
                    ? 'O recontato novo está na agenda, e a tarefa volta à Central nesse dia.'
                    : 'Saiu das filas ativas e continua pesquisável no balcão, com o motivo e o histórico.'}
              </p>
              <div className={styles.atalhos}>
                {feito === 'calculo' && (
                  <a className={styles.atalho} href={rotaDoCalculo(ficha)}>
                    Abrir o cálculo (D1.13)
                  </a>
                )}
                <a className={styles.atalho} href="/">
                  Voltar ao início
                </a>
              </div>
            </section>
          ) : !marcado ? (
            <p className={styles.aviso}>Não há recontato marcado para este lead.</p>
          ) : (
            <>
              <section className={styles.cartao} aria-labelledby="resultado">
                <h2 id="resultado" className={styles.cartaoTitulo}>
                  Resultado do recontato
                </h2>
                <div className={styles.opcoes} role="radiogroup" aria-labelledby="resultado">
                  {opcoes.map((o) => (
                    <button key={o.id} type="button" role="radio" className={styles.opcao} aria-checked={escolha === o.id} onClick={() => setEscolha(o.id)}>
                      {o.rotulo}
                    </button>
                  ))}
                </div>
                {escolha === 'nova-data' && (
                  <div className={proprio.campos}>
                    <CampoDoRecontato
                      data={data}
                      espera={espera}
                      hoje={hoje}
                      erro={erroData}
                      aoMudar={(d, e) => {
                        setData(d)
                        setEspera(e)
                        setErroData(undefined)
                      }}
                      aoSair={() => setErroData(erroDoRecontato(data, hoje))}
                    />
                  </div>
                )}
                {escolha === 'arquivar' && (
                  <div className={proprio.campos}>
                    <CamposDoMotivo
                      motivo={motivo}
                      detalhe={detalhe}
                      papel={papel}
                      aoMudar={(campo, valor) => (campo === 'motivo' ? setMotivo(valor) : campo === 'detalhe' ? setDetalhe(valor) : setPapel(valor as PapelNoFechamento))}
                    />
                  </div>
                )}
              </section>
              <p className={styles.trava}>Todo lead que não vira cliente fica com o motivo registrado (G16).</p>
              <div className={styles.rodape}>
                <button type="button" className={styles.principalBotao} disabled={motivoParado !== null || registrando} onClick={registrar}>
                  {registrando ? 'registrando…' : 'Registrar o recontato'}
                </button>
                {motivoParado && <p className={styles.motivo}>{motivoParado}</p>}
                {erro && (
                  <p role="alert" className={styles.motivo}>
                    {erro}
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <aside className={styles.lado} aria-labelledby="antes-de-concluir">
          <h2 id="antes-de-concluir" className={styles.ladoTitulo}>
            Antes de concluir
          </h2>
          <p className={styles.ladoSub}>O que o BPMN (Miro) pede no recontato do passo D1.14.</p>
          <h3 className={styles.ladoSecao}>Decisões</h3>
          <p>Resultado do recontato: voltar ao cálculo (D1.13), nova data ou arquivar.</p>
          <h3 className={styles.ladoSecao}>Campos</h3>
          <ul className={styles.ladoLista}>
            <li>• Se «Ainda não»: Recontatar em*</li>
            <li>• Se «Não vai seguir»: Motivo* e Detalhe do motivo</li>
          </ul>
          <h3 className={styles.ladoSecao}>Travas</h3>
          <p className={styles.ladoSub}>
            O recontato não feito continua aberto e aparece como atrasado. «Registrar o recontato» só habilita com o resultado e os campos com *
            preenchidos.
          </p>
        </aside>
      </main>
      <AbaSuporte />
    </>
  )
}
