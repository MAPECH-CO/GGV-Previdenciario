import { useEffect, useRef, useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { CabecalhoDoContrato } from '../componentes/CabecalhoDoContrato.tsx'
import { MensagemWhatsApp } from '../componentes/MensagemWhatsApp.tsx'
import { TopoPasso } from '../componentes/TopoPasso.tsx'
import { formatarTelefone } from '../campos.ts'
import {
  baixarKit,
  concluirAssinaturaEmPapel,
  digitalizarContratoAssinado,
  entrevistaDoContrato,
  enviarParaAssinatura,
  imprimirKit,
  kitDeVerdade,
  obterContrato,
  registrarTentativaDeAssinatura,
  servicosDoContrato,
  simularLeituraDoContrato,
  simularRetornoDoZapSign,
  type ContratoDoCaso,
  type ServicosDoContrato,
} from '../dados/contrato.ts'
import { TIPOS_DE_ENTREVISTA } from '../dados/catalogos.ts'
import { agora } from '../dados/servidor.ts'
import { baixarArquivo, imprimirPdf } from '../impressao.ts'
import {
  NOMES_DOS_CANAIS,
  TENTATIVAS_DE_ASSINATURA,
  cobrancaDaAssinatura,
  datasDoKit,
  identificadorDoKit,
  mensagemDoLink,
  papelNaHora,
  resumoDaLeitura,
  type FormaDeAssinar,
} from '../regras/contrato.ts'
import { dataCurta, dataHora, hojeIso } from '../regras/datas.ts'
import styles from './Balcao.module.css'
import proprio from './ColherAssinatura.module.css'

// Figma: step_D1.17 "Colher assinatura" (10:176). A decisão "Como a cliente vai assinar?" fica no cartão e no painel, como no
// desenho. O ZapSign e o Chatwoot são simulados (GGVP-72), e o scanner do papel também (GGVP-77). Com o ZapSign contratado, papel
// só aparece quando a entrevista foi presencial; sem ele, a opção do celular não aparece e o papel vale para qualquer entrevista
// (GGVP-136, CA8). No contrato do servidor, "Imprimir o kit" abre o PDF do kit do escritório na impressão do navegador, ou baixa
// o Word preenchido quando o servidor não converte (CA5); no contrato de exemplo, a impressora segue simulada.

type Janela = { mensagem: string; lembrete: boolean }
/** O kit que acabou de sair: o endereço do arquivo na memória do navegador, para abrir ou baixar de novo sem chamar o servidor. */
type KitImpresso = { url: string; nome: string; pdf: boolean }

export function ColherAssinatura({ processoId }: { processoId: string }) {
  const [caso, setCaso] = useState<ContratoDoCaso | null | undefined>(undefined)
  const [servicos, setServicos] = useState<ServicosDoContrato | null>(null)
  const [impresso, setImpresso] = useState<KitImpresso | null>(null)
  const [forma, setForma] = useState<FormaDeAssinar | null>(null)
  const [janela, setJanela] = useState<Janela | null>(null)
  const [ligando, setLigando] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const travado = useRef(false)
  const hoje = hojeIso(agora())

  useEffect(() => {
    let valendo = true
    Promise.all([obterContrato(processoId), servicosDoContrato(processoId)]).then(([c, s]) => {
      if (!valendo) return
      setCaso(c)
      setServicos(s)
      setForma(c?.contrato.assinatura?.forma ?? (s.zapsign ? null : 'papel')) // sem ZapSign, só há o papel
    })
    return () => {
      valendo = false
    }
  }, [processoId])

  if (!caso || !servicos) {
    return (
      <main className={proprio.vazia}>
        <title>Colher assinatura · GGV Previdenciário</title>
        <h1 className={styles.titulo}>{caso === null ? 'Contrato não encontrado' : 'Abrindo a tarefa…'}</h1>
        {caso === null && <a href="/">Voltar ao início</a>}
      </main>
    )
  }

  const { ficha, processo, contrato } = caso
  const assinatura = contrato.assinatura
  const zapsign = assinatura?.zapsign
  const cobranca = cobrancaDaAssinatura(assinatura?.tentativas ?? [], hoje)
  const naSenior = assinatura?.naSenior === true
  const assinado = zapsign?.status === 'assinado'
  const concluido = contrato.etapa !== 'preparar' && contrato.etapa !== 'assinatura'
  const papel = forma === 'papel' && !zapsign && contrato.etapa === 'assinatura'
  const escolhido = zapsign !== undefined || assinatura?.impressoEm !== undefined || concluido
  const entrevista = entrevistaDoContrato(caso)
  // O celular só aparece com o ZapSign contratado (ou se este contrato já foi por ele); sem o ZapSign, o papel vale para qualquer entrevista.
  const celular = servicos.zapsign || zapsign !== undefined
  const podePapel = !servicos.zapsign || papelNaHora(entrevista)
  const kitReal = kitDeVerdade(processoId)
  const datasImpressas = contrato.kit && assinatura?.impressoEm ? datasDoKit(contrato.kit, 'papel', hojeIso(new Date(assinatura.impressoEm))) : []
  const primeiro = ficha.nome.split(' ')[0]
  const comoFoi = TIPOS_DE_ENTREVISTA.find((t) => t.id === entrevista)?.nome.toLowerCase() ?? entrevista

  async function agir(acao: () => Promise<void>) {
    if (travado.current) return
    travado.current = true
    setOcupado(true)
    setErro('')
    try {
      await acao()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para registrar.')
    } finally {
      travado.current = false
      setOcupado(false)
    }
  }

  const recarregar = async () => setCaso(await obterContrato(processoId))

  const enviar = () =>
    agir(async () => {
      const r = await enviarParaAssinatura(processoId)
      await recarregar()
      if (r.resultado === 'gerado') setJanela({ mensagem: r.mensagem, lembrete: false })
    })

  async function mandarMensagem(mensagem: string) {
    await registrarTentativaDeAssinatura(processoId, 'whatsapp', mensagem)
    setJanela(null)
    await recarregar()
  }

  const registrarLigacao = () =>
    agir(async () => {
      await registrarTentativaDeAssinatura(processoId, 'ligacao')
      setLigando(false)
      await recarregar()
    })

  const simularRetorno = () =>
    agir(async () => {
      await simularRetornoDoZapSign(processoId)
      await recarregar()
    })

  // No contrato do servidor o arquivo vem primeiro: se ele não sai, nada é registrado como impresso. Com o PDF, abre a impressão do
  // navegador; com o Word (sem conversor), baixa para imprimir por ele.
  const imprimir = () =>
    agir(async () => {
      if (!kitReal) await imprimirKit(processoId)
      else {
        const kit = await baixarKit(processoId)
        await imprimirKit(processoId)
        if (impresso) URL.revokeObjectURL(impresso.url)
        const url = URL.createObjectURL(kit.blob)
        setImpresso({ url, nome: kit.nome, pdf: kit.pdf })
        if (kit.pdf) imprimirPdf(url)
        else baixarArquivo(url, kit.nome)
      }
      await recarregar()
    })

  const digitalizar = () =>
    agir(async () => {
      await digitalizarContratoAssinado(processoId)
      await recarregar()
    })

  const concluirPapel = () =>
    agir(async () => {
      await concluirAssinaturaEmPapel(processoId)
      await recarregar()
    })

  // A leitura do contrato assinado é da Documentação (GGVP-81): até a junção, o botão faz o papel dela (GGVP-85).
  const simularLeitura = () =>
    agir(async () => {
      await simularLeituraDoContrato(processoId)
      await recarregar()
    })

  const status = assinado
    ? `assinado em ${dataHora(assinatura!.assinadoEm!)}`
    : cobranca.feitas === 0
      ? 'gerado; o link ainda não foi enviado ao cliente'
      : 'enviado ao cliente; aguardando a assinatura'

  const instrucoes = !servicos.zapsign
    ? `Imprima o kit, colha a assinatura de ${primeiro} em papel e digitalize o contrato assinado (D1.18). Diga que a cópia assinada ` +
      'chega pelo WhatsApp. Sem assinatura, nada vai para o INSS (G1).'
    : podePapel
      ? `Pergunte como ${primeiro} prefere assinar. Pelo celular: envie pelo ZapSign e acompanhe; o link vai pelo WhatsApp. ` +
        'Se preferir papel, imprima, colha a assinatura e digitalize (D1.18). Diga que a cópia assinada chega pelo WhatsApp. ' +
        'Sem assinatura, nada vai para o INSS (G1).'
      : `A entrevista de ${primeiro} foi por ${comoFoi}: a assinatura vai pelo ZapSign, com o link pelo WhatsApp (papel só na ` +
        'entrevista presencial). Diga que a cópia assinada chega pelo WhatsApp. Sem assinatura, nada vai para o INSS (G1).'

  return (
    <>
      <title>{`${ficha.nome} · Colher assinatura · GGV Previdenciário`}</title>
      <TopoPasso contexto={`Cliente · ${ficha.nome}`} />
      <main className={styles.pagina}>
        <div className={styles.principal}>
          <CabecalhoDoContrato
            passo="D1.17"
            nomeDoPasso="Pedir a assinatura ao cliente"
            tarefa="Colher assinatura"
            subtitulo={servicos.zapsign ? 'assinar · ZapSign ou papel' : 'assinar · em papel'}
            ficha={ficha}
            beneficio={processo.beneficio}
            instrucoes={instrucoes}
          />

          {contrato.etapa === 'preparar' ? (
            <p className={styles.aviso}>
              O contrato ainda não foi gerado.{' '}
              <a className={styles.avisoLink} href={`/contrato/${processoId}/preparar`}>
                Preparar o contrato
              </a>
            </p>
          ) : (
            <section className={styles.cartao} aria-labelledby="como-assinar">
              <h2 id="como-assinar" className={styles.cartaoTitulo}>
                Como o cliente vai assinar?
              </h2>
              <div className={styles.opcoes} role="radiogroup" aria-labelledby="como-assinar">
                {celular && (
                  <button type="button" role="radio" className={`${styles.opcao} ${proprio.escolhida}`} aria-checked={forma === 'digital'} disabled={escolhido} onClick={() => setForma('digital')}>
                    ZapSign (digital)
                  </button>
                )}
                {podePapel && (
                  <button type="button" role="radio" className={`${styles.opcao} ${proprio.escolhida}`} aria-checked={forma === 'papel'} disabled={escolhido} onClick={() => setForma('papel')}>
                    {servicos.zapsign ? 'Em papel na hora' : 'Em papel'}
                  </button>
                )}
              </div>
              {contrato.kit && (
                <p className={styles.motivo}>
                  {contrato.kit.documentos.length} documentos do kit {contrato.kit.nome} · modelo {identificadorDoKit(contrato.kit)}
                  {contrato.documento ? ` · versão ${contrato.documento.versao}` : ''}
                </p>
              )}
            </section>
          )}

          {assinatura?.erro && !zapsign && (
            <div className={styles.aviso} role="alert">
              <p>{assinatura.erro}</p>
              <button type="button" className={styles.atalho} disabled={ocupado} onClick={enviar}>
                Tentar de novo
              </button>
            </div>
          )}

          {zapsign && (
            <section className={styles.cartao} aria-labelledby="zapsign-titulo">
              <h2 id="zapsign-titulo" className={styles.cartaoTitulo}>
                Assinatura pelo ZapSign
              </h2>
              <dl className={proprio.dados}>
                <div>
                  <dt>Documento no ZapSign</dt>
                  <dd>{zapsign.documentoId}</dd>
                </div>
                <div>
                  <dt>Link para o cliente</dt>
                  <dd>{zapsign.link}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{status}</dd>
                </div>
              </dl>

              {assinatura.tentativas.length > 0 && (
                <>
                  <h3 className={proprio.subtitulo}>Tentativas de contato</h3>
                  <ol className={proprio.tentativas} aria-label="Tentativas de contato">
                    {assinatura.tentativas.map((t, i) => (
                      <li key={t.quando}>
                        {dataCurta(t.data, hoje)} · {NOMES_DOS_CANAIS[t.canal]} · {i === 0 ? 'link enviado' : 'lembrete, com o mesmo link'} · {t.quem}
                      </li>
                    ))}
                  </ol>
                </>
              )}

              {!assinado && cobranca.feitas === 0 && (
                <button type="button" className={styles.atalho} disabled={ocupado} onClick={() => setJanela({ mensagem: mensagemDoLink(ficha.nome, zapsign.link, false), lembrete: false })}>
                  Enviar o link pelo WhatsApp
                </button>
              )}
              {!assinado && naSenior && (
                <p className={styles.aviso}>
                  Limite de {TENTATIVAS_DE_ASSINATURA} tentativas atingido (G15): o caso subiu para a advogada sênior. Se o cliente assinar, o
                  ZapSign devolve e a tarefa se encerra sozinha.
                </p>
              )}
              {!assinado && !naSenior && cobranca.lembrar && (
                <div className={styles.aviso}>
                  <p>
                    Hoje: tente contato de novo (tentativa {cobranca.feitas + 1} de {TENTATIVAS_DE_ASSINATURA}). O link é o mesmo: nenhum documento
                    novo no ZapSign. Sem assinatura depois dela, o caso sobe para a advogada sênior (G15).
                  </p>
                  <div className={styles.atalhos}>
                    <button
                      type="button"
                      className={styles.atalho}
                      disabled={ocupado}
                      onClick={() => setJanela({ mensagem: mensagemDoLink(ficha.nome, zapsign.link, true), lembrete: true })}
                    >
                      Lembrar pelo WhatsApp
                    </button>
                    <button type="button" className={styles.atalho} disabled={ocupado} onClick={() => setLigando(true)}>
                      Ligar
                    </button>
                  </div>
                  {ligando && (
                    <div className={proprio.ligacao}>
                      <p>Ligue para {formatarTelefone(ficha.telefone)} (ligação simulada).</p>
                      <button type="button" className={styles.atalho} disabled={ocupado} onClick={registrarLigacao}>
                        Registrar a ligação
                      </button>
                    </div>
                  )}
                </div>
              )}
              {!assinado && !naSenior && !cobranca.lembrar && cobranca.proximaEm && (
                <p className={styles.motivo}>Próxima tentativa em {dataCurta(cobranca.proximaEm, hoje)}, se o cliente não assinar antes.</p>
              )}
              {!assinado && (
                <div className={proprio.pendente}>
                  <p>Pendente: documento assinado devolvido pelo ZapSign.</p>
                  <button type="button" className={styles.atalho} disabled={ocupado} onClick={simularRetorno}>
                    Simular o retorno do ZapSign (assinado)
                  </button>
                </div>
              )}
            </section>
          )}

          {papel && (
            <section className={styles.cartao} aria-labelledby="papel-titulo">
              <h2 id="papel-titulo" className={styles.cartaoTitulo}>
                Assinatura em papel
              </h2>
              {!assinatura?.impressoEm ? (
                <>
                  <p className={styles.motivo}>O kit sai com as datas em branco, para preencher à mão na assinatura, menos o contrato de honorários.</p>
                  <button type="button" className={styles.atalho} disabled={ocupado} onClick={imprimir}>
                    Imprimir o kit
                  </button>
                </>
              ) : (
                <>
                  <p className={styles.motivo}>Impresso em {dataHora(assinatura.impressoEm)}{kitReal ? '.' : ' (impressora simulada).'}</p>
                  <ul className={proprio.tentativas} aria-label="Datas do kit impresso">
                    {datasImpressas.map((d) => (
                      <li key={d.documento}>
                        {d.documento} · {d.data}
                      </li>
                    ))}
                  </ul>
                  {impresso && (
                    <p className={styles.motivo}>
                      {impresso.pdf ? (
                        <>
                          O PDF abriu na impressão do navegador.{' '}
                          <a href={impresso.url} target="_blank" rel="noreferrer">
                            Abrir o PDF
                          </a>{' '}
                          ·{' '}
                          <a href={impresso.url} download={impresso.nome}>
                            Baixar o PDF
                          </a>
                        </>
                      ) : (
                        <>
                          O kit saiu em Word{servicos.pdf ? ' (o conversor de PDF não respondeu)' : ''}: abra o arquivo e imprima por ele.{' '}
                          <a href={impresso.url} download={impresso.nome}>
                            Baixar o Word
                          </a>
                        </>
                      )}
                    </p>
                  )}
                  {kitReal && (
                    <button type="button" className={styles.atalho} disabled={ocupado} onClick={imprimir}>
                      Imprimir de novo
                    </button>
                  )}
                  <p>Colha a assinatura do cliente e passe o contrato assinado no scanner do balcão.</p>
                  {!assinatura.arquivo && (
                    <button type="button" className={styles.atalho} disabled={ocupado} onClick={digitalizar}>
                      Digitalizar o contrato assinado (scanner simulado)
                    </button>
                  )}
                </>
              )}
              <p className={proprio.anexo} data-ok={assinatura?.arquivo !== undefined}>
                Anexo: digitalização do contrato assinado *{' '}
                {assinatura?.arquivo ? `· ✓ ${assinatura.arquivo}, PDF pesquisável na pasta do cliente` : '· falta'}
              </p>
            </section>
          )}

          {concluido ? (
            <section className={styles.feito} aria-labelledby="assinado">
              <h2 id="assinado" className={styles.feitoTitulo}>
                {assinatura?.forma === 'papel' ? '✓ Contrato assinado em papel' : '✓ Contrato assinado pelo ZapSign'}
              </h2>
              <p>
                {assinatura?.forma === 'papel'
                  ? `A digitalização do contrato assinado está na pasta do cliente: ${assinatura.arquivo}. Segue para a leitura da Documentação, e a tarefa de assinatura se encerrou.`
                  : `O arquivo final, com as evidências da assinatura, está na pasta do cliente: ${assinatura?.arquivo}. Segue para a leitura da Documentação, e a tarefa de assinatura se encerrou.`}
              </p>
              {contrato.etapa === 'conferir' && contrato.leitura && (
                <p>A IA leu o contrato assinado: {resumoDaLeitura(contrato.leitura)}. O Atendimento recebeu "Conferir contrato".</p>
              )}
              {contrato.etapa === 'copia' && <p>A IA leu o contrato assinado e reconheceu: tudo certo. Segue para a cópia do contrato.</p>}
              <div className={styles.atalhos}>
                {contrato.etapa === 'leitura' && (
                  <button type="button" className={styles.atalho} disabled={ocupado} onClick={simularLeitura}>
                    Simular a leitura da IA (D1.18)
                  </button>
                )}
                {contrato.etapa === 'conferir' && (
                  <a className={styles.atalho} href={`/contrato/${processoId}/conferir`}>
                    Conferir contrato
                  </a>
                )}
                <a className={styles.atalho} href={`/clientes/${ficha.id}`}>
                  Abrir a ficha do cliente
                </a>
                <a className={styles.atalho} href="/">
                  Voltar ao início
                </a>
              </div>
            </section>
          ) : papel ? (
            <div className={styles.rodape}>
              <button type="button" className={styles.principalBotao} disabled={!assinatura?.arquivo || ocupado} onClick={concluirPapel}>
                {ocupado ? 'salvando…' : 'Concluir a assinatura'}
              </button>
              {!assinatura?.arquivo && <p className={styles.motivo}>Anexe a digitalização do contrato assinado.</p>}
            </div>
          ) : (
            contrato.etapa === 'assinatura' &&
            !zapsign &&
            celular && (
              <div className={styles.rodape}>
                <button type="button" className={styles.principalBotao} disabled={forma !== 'digital' || ocupado} onClick={enviar}>
                  {ocupado ? 'enviando…' : 'Enviar para assinatura'}
                </button>
                {forma === null && <p className={styles.motivo}>Responda como o cliente vai assinar.</p>}
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
          <p className={styles.ladoSub}>O que o BPMN (Miro) pede no passo D1.17.</p>
          <h3 className={styles.ladoSecao}>Decisões</h3>
          <div className={styles.decisao}>
            <p id="como-assinar-lado">Como a cliente vai assinar?</p>
            <div className={styles.ladoOpcoes} role="radiogroup" aria-labelledby="como-assinar-lado">
              {celular && (
                <button type="button" role="radio" className={`${styles.chip} ${proprio.escolhida}`} aria-checked={forma === 'digital'} disabled={escolhido} onClick={() => setForma('digital')}>
                  ZapSign (digital)
                </button>
              )}
              {podePapel && (
                <button type="button" role="radio" className={`${styles.chip} ${proprio.escolhida}`} aria-checked={forma === 'papel'} disabled={escolhido} onClick={() => setForma('papel')}>
                  {servicos.zapsign ? 'Papel, na hora' : 'Em papel'}
                </button>
              )}
            </div>
          </div>
          <h3 className={styles.ladoSecao}>Campos</h3>
          <ul className={styles.ladoLista}>
            <li>{servicos.zapsign ? '• Se «Papel, na hora»: Anexo: Anexar a digitalização do contrato assinado*' : '• Anexo: Anexar a digitalização do contrato assinado*'}</li>
          </ul>
          {celular && (
            <>
              <h3 className={styles.ladoSecao}>Travas e estados</h3>
              <ul className={styles.ladoLista}>
                <li>
                  Tentativa {Math.max(cobranca.feitas, 1)} de {TENTATIVAS_DE_ASSINATURA} · limite (G15)
                </li>
                <li>Pendente: Documento assinado devolvido pelo ZapSign</li>
              </ul>
            </>
          )}
          <p className={styles.ladoSub}>
            {celular
              ? '«Enviar para assinatura» só habilita com as decisões respondidas, o anexo obrigatório e o pendente resolvido.'
              : '«Concluir a assinatura» só habilita com o anexo obrigatório.'}
          </p>
        </aside>
      </main>
      {janela && (
        <MensagemWhatsApp
          nome={ficha.nome}
          telefone={ficha.telefone}
          rotulo={janela.lembrete ? 'Lembrete com o mesmo link do ZapSign (confira antes de enviar)' : 'Mensagem com o link do ZapSign (confira antes de enviar)'}
          mensagemInicial={janela.mensagem}
          aoEnviar={mandarMensagem}
          aoFechar={() => setJanela(null)}
        />
      )}
      <AbaSuporte />
    </>
  )
}
