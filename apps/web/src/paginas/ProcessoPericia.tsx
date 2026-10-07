import { useEffect, useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { ConferirEnviar } from '../componentes/ConferirEnviar.tsx'
import { ParecerMedico } from '../componentes/ParecerMedico.tsx'
import { Topbar, type ItemNavegacao } from '../componentes/Topbar.tsx'
import { formatarCpf } from '../campos.ts'
import { nomeTipo } from '../dados/catalogos.ts'
import { JurimetriaPerito } from '../componentes/JurimetriaPerito.tsx'
import { autorizarRemarcacao, decidirFaltaDaPericia, hrefDoPasso, ligarPerito, peritosParaLigar, oQueAconteceAgora, obterPericia, type PericiaNaTela } from '../dados/pericia.ts'
import { usePerfil } from '../dados/perfis.ts'
import { agora } from '../dados/servidor.ts'
import { diaCurto } from '../regras/agenda.ts'
import { dataCurta, hojeIso } from '../regras/datas.ts'
import { NOMES_DA_INSTANCIA, NOMES_DA_SITUACAO, NOMES_DO_TIPO, prazoFalado, type SituacaoDaPericia } from '../regras/pericia.ts'
import passo from './Balcao.module.css'
import proprio from './Pericia.module.css'
import styles from './ProcessoPericia.module.css'

// Figma: "Advogada · Processo do cliente · perícia marcada" (2179:2), "avaliação social" (2179:333) e "perícia judicial
// marcada" (2179:664). A página do processo nasce aqui com a perícia em destaque (épico GGVP-10); as outras etapas aparecem
// e ficam indisponíveis até as histórias delas. Dado de saúde só para o Jurídico.

const navegacao: ItemNavegacao[] = [
  { id: 'inicio', glifo: '⌂', rotulo: 'Início', href: '/advogada' },
  { id: 'agenda', glifo: '▦', rotulo: 'Agenda', href: '/agenda' },
]

/** As etapas do processo, na ordem do Figma ("Ações do processo"). Só a etapa atual abre; as outras são de outras histórias. */
const ETAPAS = ['Entrevista', 'Pedido ao INSS', 'Exigência INSS', 'Perícia INSS', 'Despacho', 'Petição', 'Perícia judicial', 'Exigência do juiz', 'Minuta', 'Sentença · recurso', 'Prestação de contas']

const JURIDICO = ['advogada', 'senior', 'senior-2', 'juridico-adm']

const COR_DA_SITUACAO: Record<SituacaoDaPericia, string> = {
  'aguardando-inss': styles.neutro,
  marcar: styles.alerta,
  'aguardando-comprovante': styles.alerta,
  agendada: styles.alerta,
  'na-advogada': styles.alerta,
  'aguardando-resultado': styles.neutro,
}

/** Feita, atual ou ainda não chegou. A exigência do INSS só aparece feita quando a perícia veio dela, ou no judicial. */
function estadoDaEtapa(etapa: string, atual: string, t: PericiaNaTela): 'feita' | 'atual' | 'nao-chegou' | 'nao-houve' {
  const i = ETAPAS.indexOf(etapa)
  const a = ETAPAS.indexOf(atual)
  if (i === a) return 'atual'
  if (i > a) return 'nao-chegou'
  if (etapa === 'Exigência INSS' && t.pericia.origem === 'd2-necessidade') return 'nao-houve'
  return 'feita'
}

export function ProcessoPericia({ processoId, abrirPerito = false }: { processoId: string; /** "Ver o perfil do perito" do chat (GGVP-61). */ abrirPerito?: boolean }) {
  const perfil = usePerfil('Advogada')
  const juridico = JURIDICO.includes(perfil?.id ?? 'advogada')
  const [t, setT] = useState<PericiaNaTela | null | undefined>(undefined)
  const [aberto, setAberto] = useState<'parecer' | 'anexar' | 'perito' | null>(abrirPerito ? 'perito' : null)
  const [verOrientacao, setVerOrientacao] = useState(false)
  const [aviso, setAviso] = useState('')
  const [justificativa, setJustificativa] = useState('')
  const [decisao, setDecisao] = useState('')
  const [erro, setErro] = useState('')

  useEffect(() => {
    let valendo = true
    obterPericia(processoId).then((x) => valendo && setT(x))
    return () => {
      valendo = false
    }
  }, [processoId])

  if (!t) {
    return (
      <main className={passo.pagina}>
        <title>Processo · GGV Previdenciário</title>
        <h1 className={passo.titulo}>{t === null ? 'Este caso não tem perícia' : 'Abrindo o processo…'}</h1>
        {t === null && <a href={perfil?.inicio ?? '/advogada'}>Voltar ao início</a>}
      </main>
    )
  }

  const { pericia, ficha, processo } = t
  const hoje = hojeIso(agora())
  const judicial = pericia.instancia === 'juizo'
  const atual = judicial ? 'Perícia judicial' : 'Perícia INSS'
  const tipo = NOMES_DO_TIPO[pericia.tipo]
  const verAPericia = hrefDoPasso(t)
  const linhaAntes = ficha.historico.slice(-4)
  const m = pericia.marcacao
  const dia = (iso: string) => `${diaCurto(iso)}/${iso.slice(5, 7)}`
  const etiqueta = m?.origem === 'comprovante' ? 'comprovante lido pelo sistema' : m?.origem === 'juizo' ? 'data lida da publicação' : NOMES_DA_SITUACAO[t.situacao].toLowerCase()
  const advogada = (perfil?.id ?? 'advogada') === 'advogada'

  async function ligar(peritoId: string, nome: string) {
    setErro('')
    try {
      setT(await ligarPerito(processoId, peritoId, perfil?.usuario ?? 'Advogada'))
      setAviso(`Perito ligado: ${nome}. A orientação foi montada de novo pelo perfil dele.`)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para ligar o perito.')
    }
  }

  async function decidirFalta() {
    setErro('')
    try {
      setT(await decidirFaltaDaPericia(processoId, decisao, perfil?.usuario ?? 'Advogada'))
      setDecisao('')
      setAviso('Decisão registrada: a Documentação segue com ela.')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para registrar.')
    }
  }

  async function autorizar() {
    setErro('')
    try {
      setT(await autorizarRemarcacao(processoId, justificativa, perfil?.usuario ?? 'Advogada'))
      setJustificativa('')
      setAviso('Remarcação autorizada: a tarefa de marcar volta para o Jurídico administrativo.')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para registrar.')
    }
  }

  return (
    <>
      <title>{`${ficha.nome} · Processo · perícia · GGV Previdenciário`}</title>
      <Topbar itens={navegacao} ativo="" funcao={perfil?.rotulo ?? 'Advogada'} />
      <main className={styles.pagina}>
        <header className={styles.cabecalho}>
          <div className={styles.linha}>
            <h1 className={styles.numero}>{processo.numero ?? 'Processo ainda sem número'}</h1>
            <span className={proprio.selo}>{judicial ? 'Judicial · perícia' : 'Administrativo · perícia'}</span>
            <span className={passo.beneficio}>◆ {t.beneficio}</span>
            <span className={styles.etiqueta}>{etiqueta}</span>
            <button type="button" className={styles.transcricoes} aria-disabled="true" title="As transcrições abrem pela ficha (GGVP-102)">
              ▶ Transcrições ({ficha.transcricoes})
            </button>
          </div>
          <p className={styles.cliente}>
            <a href={`/clientes/${ficha.id}`}>{ficha.nome}</a>
            {ficha.idade !== undefined && ` · ${ficha.idade} anos`} · {NOMES_DA_INSTANCIA[pericia.instancia]} · Dra. Paula · {t.etapa}
            {m && <strong className={styles.urgente}>{` · perícia ${dia(m.data)}, ${m.hora}`}</strong>}
          </p>
        </header>

        <nav className={styles.acoes} aria-label="Ações do processo">
          <p className={styles.legenda}>
            <strong>Ações do processo</strong> · em ordem · só a etapa atual está habilitada · ✓ feito · ▶ agora · cinza: ainda não chegou
          </p>
          <ol className={styles.etapas}>
            {ETAPAS.map((etapa) => {
              const estado = estadoDaEtapa(etapa, atual, t)
              return (
                <li key={etapa} className={styles[estado]}>
                  {estado === 'atual' ? (
                    <a href={verAPericia} aria-current="step">
                      ▶ {etapa}
                    </a>
                  ) : (
                    <span aria-disabled="true">
                      {estado === 'feita' ? '✓ ' : ''}
                      {etapa}
                    </span>
                  )}
                </li>
              )
            })}
          </ol>
        </nav>

        <section className={styles.resumo} aria-labelledby="resumo-ia">
          <div>
            <h2 id="resumo-ia" className={proprio.iaTitulo}>
              Resumo da IA
            </h2>
            <p>{oQueAconteceAgora(t)}</p>
            <p>
              <strong>Em perícia desde {dataCurta(hojeIso(new Date(pericia.abertaEm)), hoje)}: a tarefa foi aberta pelo sistema (DP.01).</strong>
            </p>
          </div>
          <a className={passo.principalBotao} href={verAPericia}>
            Ver a perícia
          </a>
        </section>

        {aviso && (
          <p role="status" className={passo.aviso}>
            {aviso}
          </p>
        )}

        <div className={styles.grade}>
          <section className={styles.cartao} aria-labelledby="linha">
            <h2 id="linha" className={styles.cartaoTitulo}>
              Linha do processo
            </h2>
            <p className={styles.nota}>Do mais antigo ao momento atual. Quem fez, quando e o passo do BPMN.</p>
            {linhaAntes.length > 0 && (
              <>
                <h3 className={styles.grupo}>Antes da perícia</h3>
                <ol className={proprio.historico} aria-label="Antes da perícia">
                  {linhaAntes.map((e, i) => (
                    <li key={i} className={styles.evento}>
                      <span className={proprio.quando}>{dataCurta(hojeIso(new Date(e.quando)), hoje)}</span>
                      <span>{e.oQue}</span>
                    </li>
                  ))}
                </ol>
              </>
            )}
            <h3 className={styles.grupo}>
              Perícia · {NOMES_DA_INSTANCIA[pericia.instancia]} · {tipo}
            </h3>
            <ol className={proprio.historico} aria-label="Linha da perícia">
              {pericia.historico.map((e, i) => (
                <li key={i} className={styles.evento}>
                  <span className={proprio.quando}>{dataCurta(hojeIso(new Date(e.quando)), hoje)}</span>
                  <span>
                    {e.quem === 'Sistema' ? 'O sistema' : e.quem}: {e.oQue.charAt(0).toLowerCase() + e.oQue.slice(1)}
                  </span>
                  <span className={proprio.passo}>{e.passo}</span>
                </li>
              ))}
            </ol>
            <p className={styles.nota}>Ainda não existem: a perícia feita e o resultado. Aparecem quando acontecerem.</p>
          </section>

          <div className={styles.coluna}>
            <section className={`${styles.cartao} ${styles.destaque}`} aria-labelledby="pericias">
              <h2 id="pericias" className={styles.cartaoTitulo}>
                Perícias
              </h2>
              <div className={styles.pericia}>
                <span>
                  <strong>
                    {NOMES_DA_INSTANCIA[pericia.instancia]} · {tipo}
                  </strong>
                  <span className={styles.nota}>
                    {m
                      ? `${dia(m.data)} · ${m.hora} · ${m.local}`
                      : t.situacao === 'aguardando-inss'
                        ? 'esperando o INSS liberar o agendamento (D2.E1)'
                        : t.situacao === 'na-advogada'
                          ? `${pericia.remarcacoes} remarcações: passou do limite (G15)`
                          : t.proximaTentativa
                            ? `para marcar · tentativa diária · a próxima é ${prazoFalado(t.proximaTentativa, hoje).texto}`
                            : 'esperando o comprovante do INSS (DP.E1)'}
                  </span>
                </span>
                <span className={`${styles.situacao} ${COR_DA_SITUACAO[t.situacao]}`}>{NOMES_DA_SITUACAO[t.situacao]}</span>
              </div>
              {pericia.orientacao && (
                <div className={styles.pericia}>
                  <span>
                    <strong>Orientação ao cliente</strong>
                    <span className={styles.nota}>
                      {pericia.orientacao.modo === 'perfil' && t.perfil
                        ? `pelo perfil de ${t.perfil.perito.nome}, versão ${pericia.orientacao.versaoDoPerfil} (IA e acervo)`
                        : `padrão: ${pericia.orientacao.motivo}`}
                    </span>
                    <button type="button" className={styles.link} aria-expanded={verOrientacao} onClick={() => setVerOrientacao(!verOrientacao)}>
                      {verOrientacao ? 'Esconder a orientação' : 'Ver a orientação'}
                    </button>
                  </span>
                  <span className={`${styles.situacao} ${pericia.orientacao.bloqueio ? styles.alerta : styles.ok}`}>{pericia.orientacao.bloqueio ? 'Bloqueada' : 'Montada'}</span>
                </div>
              )}
              {t.documentos && (
                <div className={styles.pericia}>
                  <span>
                    <strong>Documentos da perícia</strong>
                    <span className={styles.nota}>
                      {pericia.documentos!.concluida
                        ? `reunidos pela Documentação em ${dataCurta(hojeIso(new Date(pericia.documentos!.concluida.quando)), hoje)}`
                        : `${t.documentos.itens.filter((i) => i.arquivo).length} de ${t.documentos.itens.length} anexados · a Documentação reúne${t.prazos ? ` até ${dataCurta(t.prazos.documentosAte, hoje)}` : ''}`}
                    </span>
                  </span>
                  <span className={`${styles.situacao} ${pericia.documentos!.concluida ? styles.ok : styles.alerta}`}>{pericia.documentos!.concluida ? 'Feito' : 'Pendente'}</span>
                </div>
              )}
            </section>

            {pericia.orientacao && verOrientacao && (
              <section className={styles.cartao} aria-labelledby="orientacao">
                <h2 id="orientacao" className={styles.cartaoTitulo}>
                  Orientação para o cliente
                </h2>
                <pre className={styles.orientacao} aria-label="Texto da orientação">
                  {pericia.orientacao.texto}
                </pre>
                {pericia.orientacao.bloqueio ? (
                  <p className={passo.trava}>Bloqueada pela verificação, pede revisão: {pericia.orientacao.bloqueio}</p>
                ) : (
                  <p className={styles.nota}>
                    Verificada antes de chegar ao Jurídico administrativo: sem instrução para esconder, mudar ou simular a situação, sem diagnóstico, CID nem frase
                    pronta (G11, G20).
                  </p>
                )}
                {juridico &&
                  (t.perfil ? (
                    <p>
                      Jurimetria de {t.perfil.perito.nome}:{' '}
                      {t.perfil.jurimetria.suficiente
                        ? `${t.perfil.jurimetria.taxa}% favoráveis em ${t.perfil.jurimetria.laudos} laudos`
                        : `amostra insuficiente (${t.perfil.jurimetria.laudos} laudos): não entra na orientação nem vai ao cliente (G22)`}
                      .{' '}
                      <button type="button" className={styles.link} onClick={() => setAberto('perito')}>
                        Ver a jurimetria do perito
                      </button>
                    </p>
                  ) : (
                    <p className={styles.nota}>A jurimetria não foi feita: o perito ainda não é conhecido.</p>
                  ))}
              </section>
            )}

            {!pericia.peritoId && pericia.orientacao && (
              <section className={styles.cartao} aria-labelledby="quem-e-o-perito">
                <h2 id="quem-e-o-perito" className={styles.cartaoTitulo}>
                  Quem é o perito?
                </h2>
                <p>
                  {pericia.peritoLido ? `O sistema não reconheceu o perito ${pericia.peritoLido}.` : 'O perito ainda não é conhecido.'} Nada trava: vale a
                  orientação padrão e a jurimetria não foi feita. Se algum documento disser quem é o perito, ligue aqui em um clique.
                </p>
                <div className={passo.atalhos} role="group" aria-label="Ligar o perito">
                  {peritosParaLigar(pericia.tipo).map((p) => (
                    <button key={p.id} type="button" className={passo.atalho} onClick={() => void ligar(p.id, p.nome)}>
                      {p.nome} · {p.especialidade}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {t.documentos?.passouDoLimite && (
              <section className={styles.cartao} aria-labelledby="decisao-documento">
                <h2 id="decisao-documento" className={styles.cartaoTitulo}>
                  Documento da perícia em falta (G15)
                </h2>
                <p>
                  Passou do limite de 10 dias antes da perícia e ainda falta: {t.documentos.faltando.map((i) => i.nome.toLowerCase()).join(', ')}. A advogada
                  responsável decide como segue; a Documentação registra a falta com justificativa e conclui.
                </p>
                {pericia.documentos!.decisaoDaAdvogada ? (
                  <p className={styles.nota}>
                    Decidido por {pericia.documentos!.decisaoDaAdvogada.quem}: {pericia.documentos!.decisaoDaAdvogada.texto}
                  </p>
                ) : advogada ? (
                  <>
                    <label className={proprio.campo}>
                      Decisão *
                      <textarea rows={2} maxLength={300} value={decisao} onChange={(e) => setDecisao(e.target.value)} />
                    </label>
                    <button type="button" className={passo.principalBotao} disabled={decisao.trim().length < 10} onClick={() => void decidirFalta()}>
                      Registrar a decisão
                    </button>
                  </>
                ) : (
                  <p className={styles.nota}>A decisão aparece para a advogada responsável.</p>
                )}
              </section>
            )}

            {t.situacao === 'na-advogada' && (
              <section className={styles.cartao} aria-labelledby="decisao-advogada">
                <h2 id="decisao-advogada" className={styles.cartaoTitulo}>
                  Decisão da advogada responsável (G15)
                </h2>
                <p>
                  A perícia já teve {pericia.remarcacoes} remarcações e passou do limite. Só a advogada responsável autoriza mais uma, com justificativa; a
                  tarefa de marcar volta para o Jurídico administrativo.
                </p>
                {advogada ? (
                  <>
                    <label className={proprio.campo}>
                      Justificativa *
                      <textarea rows={2} maxLength={300} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
                    </label>
                    <button type="button" className={passo.principalBotao} disabled={justificativa.trim().length < 10} onClick={() => void autorizar()}>
                      Autorizar mais uma remarcação
                    </button>
                  </>
                ) : (
                  <p className={styles.nota}>A decisão aparece para a advogada responsável.</p>
                )}
                {erro && (
                  <p role="alert" className={passo.motivo}>
                    {erro}
                  </p>
                )}
              </section>
            )}

            <section className={styles.cartao} aria-labelledby="dados">
              <h2 id="dados" className={styles.cartaoTitulo}>
                Dados do processo
              </h2>
              <dl className={styles.dados}>
                <dt>Cliente</dt>
                <dd>
                  {ficha.nome}
                  {ficha.cpf && ` · CPF ${formatarCpf(ficha.cpf)}`}
                </dd>
                <dt>Benefício</dt>
                <dd>{t.beneficio}</dd>
                <dt>{judicial ? 'Juízo' : 'Instância'}</dt>
                <dd>{NOMES_DA_INSTANCIA[pericia.instancia]}</dd>
                <dt>Perícia</dt>
                <dd>
                  {tipo} · pedida por {pericia.pedidaPor}
                  {pericia.oQuePede && ` · ${pericia.oQuePede}`}
                </dd>
                {processo.numero && (
                  <>
                    <dt>{judicial ? 'Processo' : 'Protocolo'}</dt>
                    <dd>{processo.numero}</dd>
                  </>
                )}
                {juridico && (
                  <>
                    <dt>Saúde (Jurídico)</dt>
                    <dd>
                      <button type="button" className={styles.link} onClick={() => setAberto('parecer')}>
                        Parecer médico
                      </button>
                    </dd>
                  </>
                )}
                <dt>Gov.br</dt>
                <dd>{ficha.senhaGov.situacao === 'no-cofre' ? 'senha no cofre (G9)' : 'sem senha no cofre: renove antes de marcar (G9)'}</dd>
              </dl>
            </section>
          </div>

          <div className={styles.coluna}>
            <section className={styles.cartao} aria-labelledby="prazos">
              <h2 id="prazos" className={styles.cartaoTitulo}>
                Prazos
              </h2>
              <dl className={styles.prazos}>
                {t.proximaTentativa && (
                  <>
                    <dt className={styles.urgente}>{dataCurta(t.proximaTentativa, hoje)}</dt>
                    <dd>Marcar a {tipo} (tentativa diária)</dd>
                  </>
                )}
                {t.situacao === 'aguardando-inss' && (
                  <>
                    <dt>INSS</dt>
                    <dd>Esperando liberar o agendamento (D2.E1)</dd>
                  </>
                )}
                {m && t.prazos ? (
                  <>
                    <dt className={styles.urgente}>{dataCurta(m.data, hoje)}</dt>
                    <dd>
                      {tipo.charAt(0).toUpperCase() + tipo.slice(1)}, {m.hora} · {m.local}
                    </dd>
                    {pericia.pedeDocumentoNovo && (
                      <>
                        <dt>{dataCurta(t.prazos.documentosAte, hoje)}</dt>
                        <dd>Documentos da perícia prontos (10 dias antes)</dd>
                      </>
                    )}
                    <dt>{dataCurta(t.prazos.preparoAte, hoje)}</dt>
                    <dd>Orientar o cliente (até 3 dias antes)</dd>
                    <dt>{dataCurta(t.prazos.vespera, hoje)}</dt>
                    <dd>Lembrete da véspera{pericia.lembrete?.enviadoEm ? ' · enviado' : ''}</dd>
                  </>
                ) : (
                  <>
                    <dt>Depois</dt>
                    <dd>Com a data: documentos até 10 dias antes, preparação até 3 dias antes e lembrete na véspera</dd>
                  </>
                )}
              </dl>
            </section>

            <section className={styles.cartao} aria-labelledby="documentos">
              <h2 id="documentos" className={styles.cartaoTitulo}>
                Documentos (abrir cada um)
              </h2>
              {ficha.arquivos.length === 0 ? (
                <p className={styles.nota}>Nenhum documento na pasta ainda.</p>
              ) : (
                <ul className={styles.documentos}>
                  {ficha.arquivos.slice(-6).map((a) => (
                    <li key={`${a.nome}-${a.data}`}>
                      <span className={styles.pdf} aria-hidden="true">
                        PDF
                      </span>
                      <span>
                        {nomeTipo(a.tipo) || a.nome}
                        <span className={styles.nota}>
                          {a.nome} · {dataCurta(a.data, hoje)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" className={styles.soltar} onClick={() => setAberto('anexar')}>
                <span aria-hidden="true">⬆</span>
                <span>
                  <strong>Solte os documentos aqui</strong>
                  <span className={styles.nota}>ou clique para escolher · PDF, JPG ou PNG</span>
                </span>
              </button>
            </section>

            <section className={styles.cartao} aria-labelledby="acoes">
              <h2 id="acoes" className={styles.cartaoTitulo}>
                Ações
              </h2>
              <a className={passo.principalBotao} href={verAPericia}>
                Ver o detalhe da perícia
              </a>
              <button type="button" className={proprio.secundario} aria-disabled="true">
                Registrar contato com o cliente
              </button>
              <button type="button" className={proprio.secundario} aria-disabled="true">
                Pedir documento à Documentação
              </button>
              <p className={styles.nota}>A IA preenche; você confere e assina (G6). Prazos e regras numéricas são código, não modelo (G19).</p>
            </section>
          </div>
        </div>
      </main>
      <AbaSuporte />
      {aberto === 'perito' && t.perfil && juridico && <JurimetriaPerito perfil={t.perfil} aoFechar={() => setAberto(null)} />}
      {aberto === 'parecer' && <ParecerMedico processoId={processoId} funcao={perfil?.rotulo ?? 'Advogada'} aoFechar={() => setAberto(null)} />}
      {aberto === 'anexar' && (
        <ConferirEnviar
          fichaId={ficha.id}
          origem="card"
          aoEnviar={async (r) => {
            setAberto(null)
            setT(await obterPericia(processoId))
            setAviso(`${r.arquivos.length === 1 ? '1 arquivo enviado' : `${r.arquivos.length} arquivos enviados`} para a pasta do cliente.`)
          }}
          aoFechar={() => setAberto(null)}
        />
      )}
    </>
  )
}
