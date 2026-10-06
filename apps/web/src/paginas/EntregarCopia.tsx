import { useEffect, useRef, useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { CabecalhoDoContrato } from '../componentes/CabecalhoDoContrato.tsx'
import { Campo } from '../componentes/Campo.tsx'
import { TopoPasso } from '../componentes/TopoPasso.tsx'
import { isoParaData } from '../campos.ts'
import { imprimirCopia, marcarVisitaDaCopia, obterContrato, registrarEntregaDaCopia, visitaDaCopia, type ContratoDoCaso } from '../dados/contrato.ts'
import { agora } from '../dados/servidor.ts'
import { errosDaEntrega, errosDaVisita, motivoParadoDaEntrega, type ValoresDaEntrega } from '../regras/contrato.ts'
import { dataCurta, dataHora, hojeIso } from '../regras/datas.ts'
import { soNumeroEMascara } from '../regras/formularios.ts'
import styles from './Balcao.module.css'
import proprio from './EntregarCopia.module.css'

// Figma: step_D1.20 "Entregar cópia do contrato" (2106:69), com a agenda (1941:2) e o compromisso "Entregar cópia do contrato"
// (2164:466). O cartão pede, além do desenho, "Imprimir cópia para o cliente" (CA1) e a visita marcada para depois (CA4).

const ROTAS: Record<string, string> = { preparar: 'preparar', assinatura: 'assinatura', leitura: 'assinatura', conferir: 'conferir' }

export function EntregarCopia({ processoId }: { processoId: string }) {
  const hoje = hojeIso(agora())
  const [caso, setCaso] = useState<ContratoDoCaso | null | undefined>(undefined)
  const [valores, setValores] = useState<ValoresDaEntrega>({ copiaDaVersaoAssinada: false, entregueEm: isoParaData(hoje) ?? '', quemRecebeu: '', observacao: '' })
  const [errosVistos, setErrosVistos] = useState<Partial<Record<'entregueEm' | 'quemRecebeu' | 'observacao', string>>>({})
  const [visita, setVisita] = useState({ data: '', hora: '' })
  const [errosVisita, setErrosVisita] = useState<Partial<Record<'data' | 'hora', string>>>({})
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
        <title>Entregar cópia do contrato · GGV Previdenciário</title>
        <h1 className={styles.titulo}>{caso === null ? 'Contrato não encontrado' : 'Abrindo a tarefa…'}</h1>
        {caso === null && <a href="/">Voltar ao início</a>}
      </main>
    )
  }

  const { ficha, processo, contrato } = caso
  const primeiro = ficha.nome.split(' ')[0]
  const assinadoEm = contrato.assinatura?.assinadoEm ? hojeIso(new Date(contrato.assinatura.assinadoEm)) : undefined
  const marcada = visitaDaCopia(ficha, contrato)
  const entregando = contrato.etapa === 'copia'
  const entrega = contrato.copia?.entrega
  const motivoParado = motivoParadoDaEntrega(valores, hoje)
  const subtitulo = [
    assinadoEm ? `contrato assinado ${dataCurta(assinadoEm, hoje)}` : 'contrato assinado',
    marcada ? `visita ao escritório ${marcada.data === hoje ? 'hoje' : dataCurta(marcada.data, hoje)} ${marcada.hora}` : '',
  ]
    .filter(Boolean)
    .join(' · ')

  async function agir(acao: () => Promise<void>) {
    if (travado.current) return
    travado.current = true
    setOcupado(true)
    setErro('')
    try {
      await acao()
      setCaso(await obterContrato(processoId))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para registrar.')
    } finally {
      travado.current = false
      setOcupado(false)
    }
  }

  const mudar = (campo: keyof ValoresDaEntrega, valor: string | boolean) => {
    setValores((v) => ({ ...v, [campo]: campo === 'entregueEm' && typeof valor === 'string' ? soNumeroEMascara(valor) : valor }))
    setErrosVistos((e) => ({ ...e, [campo]: undefined }))
  }
  const sair = (campo: 'entregueEm' | 'quemRecebeu' | 'observacao') => setErrosVistos((e) => ({ ...e, [campo]: errosDaEntrega(valores, hoje)[campo] }))

  const marcarVisita = () => {
    const erros = errosDaVisita(visita.data, visita.hora, hoje)
    setErrosVisita(erros)
    if (erros.data || erros.hora) return
    return agir(async () => {
      await marcarVisitaDaCopia(processoId, visita.data, visita.hora)
      setVisita({ data: '', hora: '' })
    })
  }

  return (
    <>
      <title>{`${ficha.nome} · Entregar cópia do contrato · GGV Previdenciário`}</title>
      <TopoPasso contexto={processo.numero ? `Processo ${processo.numero} · ${primeiro}` : `Cliente · ${ficha.nome}`} />
      <main className={styles.pagina}>
        <div className={styles.principal}>
          <CabecalhoDoContrato
            passo="D1.20"
            nomeDoPasso="Imprimir a cópia do contrato"
            tarefa="Entregar cópia do contrato"
            subtitulo={subtitulo}
            ficha={ficha}
            beneficio={processo.beneficio}
            instrucoes={`Imprima a cópia do contrato assinado e entregue numa pastinha para ${primeiro}. Confira se é a versão assinada ${
              contrato.assinatura?.forma === 'papel' ? 'em papel, a mesma da digitalização' : 'no ZapSign'
            }.`}
          />

          {!entregando && !entrega ? (
            <p className={styles.aviso}>
              O contrato ainda não está pronto para a cópia.{' '}
              {ROTAS[contrato.etapa] && (
                <a className={styles.avisoLink} href={`/contrato/${processoId}/${ROTAS[contrato.etapa]}`}>
                  Abrir a etapa do contrato
                </a>
              )}
            </p>
          ) : (
            <>
              <section className={styles.cartao} aria-labelledby="copia-titulo">
                <h2 id="copia-titulo" className={styles.cartaoTitulo}>
                  Cópia do contrato
                </h2>
                <p className={proprio.tarefa}>Imprimir a cópia assinada e entregar ao cliente.</p>
                {contrato.assinatura?.arquivo && <p className={styles.motivo}>Versão assinada: {contrato.assinatura.arquivo}</p>}
                {contrato.copia?.impressaEm && <p className={styles.motivo}>Impressa em {dataHora(contrato.copia.impressaEm)} (impressora simulada).</p>}
                {entregando && (
                  <button type="button" className={styles.atalho} disabled={ocupado} onClick={() => agir(async () => void (await imprimirCopia(processoId)))}>
                    Imprimir cópia para o cliente
                  </button>
                )}
              </section>

              {entregando && (
                <>
                  <section className={styles.cartao} aria-labelledby="entrega-titulo">
                    <h2 id="entrega-titulo" className={styles.cartaoTitulo}>
                      Registrar a entrega
                    </h2>
                    <label className={proprio.confirmacao}>
                      <input type="checkbox" checked={valores.copiaDaVersaoAssinada} onChange={(e) => mudar('copiaDaVersaoAssinada', e.target.checked)} />
                      É a cópia impressa da versão assinada *
                    </label>
                    <div className={proprio.linha}>
                      <Campo
                        id="entregue-em"
                        rotulo="Entregue em (data) *"
                        valor={valores.entregueEm}
                        aoMudar={(v) => mudar('entregueEm', v)}
                        aoSair={() => sair('entregueEm')}
                        erro={errosVistos.entregueEm}
                        inputMode="numeric"
                        maxLength={10}
                        placeholder="dd/mm/aaaa"
                      />
                      <Campo
                        id="quem-recebeu"
                        rotulo="Quem recebeu *"
                        valor={valores.quemRecebeu}
                        aoMudar={(v) => mudar('quemRecebeu', v)}
                        aoSair={() => sair('quemRecebeu')}
                        erro={errosVistos.quemRecebeu}
                        maxLength={120}
                      />
                    </div>
                    <Campo
                      id="observacao"
                      rotulo="Observação"
                      valor={valores.observacao}
                      aoMudar={(v) => mudar('observacao', v)}
                      aoSair={() => sair('observacao')}
                      erro={errosVistos.observacao}
                      maxLength={300}
                      largo
                    />
                  </section>

                  <section className={styles.cartao} aria-labelledby="visita-titulo">
                    <h2 id="visita-titulo" className={styles.cartaoTitulo}>
                      Entregar depois, numa visita
                    </h2>
                    {marcada && (
                      <p className={styles.motivo}>
                        Visita marcada: {marcada.data === hoje ? 'hoje' : dataCurta(marcada.data, hoje)} às {marcada.hora} · na agenda como "
                        {marcada.oQue}".
                      </p>
                    )}
                    <div className={proprio.linha}>
                      <Campo
                        id="visita-data"
                        rotulo="Data da visita *"
                        valor={visita.data}
                        aoMudar={(v) => setVisita((atual) => ({ ...atual, data: soNumeroEMascara(v) }))}
                        erro={errosVisita.data}
                        inputMode="numeric"
                        maxLength={10}
                        placeholder="dd/mm/aaaa"
                      />
                      <Campo
                        id="visita-hora"
                        rotulo="Hora *"
                        valor={visita.hora}
                        aoMudar={(v) => setVisita((atual) => ({ ...atual, hora: v }))}
                        erro={errosVisita.hora}
                        tipo="time"
                      />
                    </div>
                    <button type="button" className={styles.atalho} disabled={ocupado} onClick={marcarVisita}>
                      Marcar a visita na agenda
                    </button>
                  </section>
                </>
              )}
            </>
          )}

          {entrega ? (
            <section className={styles.feito} aria-labelledby="entregue">
              <h2 id="entregue" className={styles.feitoTitulo}>
                ✓ Entrega registrada
              </h2>
              <p>
                Entregue em {dataCurta(entrega.entregueEm, hoje)} a {entrega.quemRecebeu}. O caso segue para a conferência do checklist do benefício
                (D1.21).
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
            entregando && (
              <div className={styles.rodape}>
                <button
                  type="button"
                  className={styles.principalBotao}
                  disabled={motivoParado !== null || ocupado}
                  onClick={() => agir(async () => void (await registrarEntregaDaCopia(processoId, valores)))}
                >
                  {ocupado ? 'salvando…' : 'Registrar entrega'}
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
          <p className={styles.ladoSub}>O que o BPMN (Miro) pede no passo D1.20.</p>
          <h3 className={styles.ladoSecao}>Campos</h3>
          <ul className={styles.ladoLista}>
            <li>• Cópia impressa da versão assinada*</li>
            <li>• Entregue em (data)*</li>
            <li>• Quem recebeu*</li>
            <li>• Observação</li>
          </ul>
          <h3 className={styles.ladoSecao}>Travas</h3>
          <p className={styles.ladoSub}>«Registrar entrega» só habilita com os campos com * preenchidos.</p>
        </aside>
      </main>
      <AbaSuporte />
    </>
  )
}
