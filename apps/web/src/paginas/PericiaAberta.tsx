import { useEffect, useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { TopoPasso } from '../componentes/TopoPasso.tsx'
import { oQueAconteceAgora, obterPericia, type PericiaNaTela } from '../dados/pericia.ts'
import { usePerfil } from '../dados/perfis.ts'
import { agora } from '../dados/servidor.ts'
import { dataHora, hojeIso } from '../regras/datas.ts'
import { DIAS_ANTES_DOCUMENTOS, DIAS_ANTES_PREPARO, NOMES_DA_INSTANCIA, NOMES_DO_TIPO, ORIGENS, esperaOInss, prazoFalado } from '../regras/pericia.ts'
import styles from './Balcao.module.css'
import proprio from './Pericia.module.css'

// Figma: step_DP.01 (14:534), na visão da advogada responsável. Com o pedido do Lucas no cartão (02/10): a próxima ação
// explicada com o contexto que a IA já sabe, a data em que a tarefa foi aberta, os prazos máximos e o botão até a tarefa.

const primeiraMaiuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1)

export function PericiaAberta({ processoId }: { processoId: string }) {
  const perfil = usePerfil('Advogada')
  const [t, setT] = useState<PericiaNaTela | null | undefined>(undefined)

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
        <title>Tarefa de perícia · GGV Previdenciário</title>
        <h1 className={styles.titulo}>{t === null ? 'Este caso não tem perícia' : 'Abrindo a perícia…'}</h1>
        {t === null && <a href={perfil?.inicio ?? '/advogada'}>Voltar ao início</a>}
      </main>
    )
  }

  const { pericia, ficha } = t
  const hoje = hojeIso(agora())
  const origem = ORIGENS[pericia.origem]
  const esperando = t.situacao === 'aguardando-inss'
  const tarefa = `/casos/${processoId}/pericia/marcar`

  return (
    <>
      <title>{`${ficha.nome} · Tarefa de perícia aberta pelo sistema · GGV Previdenciário`}</title>
      <TopoPasso contexto={`${perfil?.usuario ?? 'Você'} · ${perfil?.rotulo ?? 'Advogada responsável'}`} inicio={perfil?.inicio ?? '/advogada'} />
      <main className={styles.pagina}>
        <div className={styles.principal}>
          <div className={styles.cabecalho}>
            <div className={styles.chips}>
              <span className={styles.codigo} title="DP.01 · Iniciar a tarefa de perícia (passo do BPMN)">
                DP.01
              </span>
              <span className={proprio.selo}>Sistema</span>
            </div>
            <h1 className={styles.titulo}>Tarefa de perícia aberta pelo sistema</h1>
            <p className={styles.subtitulo}>
              {ficha.nome} · {NOMES_DO_TIPO[pericia.tipo]}
            </p>
          </div>

          <p className={proprio.quadro}>
            O sistema abriu sozinho a tarefa «Marcar a perícia» para o Jurídico administrativo (estagiário). A advogada só decide: tipo e instância vêm da
            decisão do D2.03, do despacho ou do pedido do juiz.
          </p>

          <section className={proprio.ia} aria-labelledby="agora">
            <h2 id="agora" className={proprio.iaTitulo}>
              O que acontece agora
            </h2>
            <p>{oQueAconteceAgora(t)}</p>
            <p className={styles.nota}>Montado pela IA a partir do pedido e do caso. Confira antes de agir.</p>
          </section>

          <section className={styles.cartao} aria-labelledby="prazos">
            <h2 id="prazos" className={styles.cartaoTitulo}>
              Datas e prazos máximos
            </h2>
            <dl className={proprio.prazos}>
              <dt>Tarefa aberta em</dt>
              <dd>{dataHora(pericia.abertaEm)}, pelo sistema</dd>
              {esperaOInss(pericia.origem) && (
                <>
                  <dt>Agendamento no INSS</dt>
                  <dd>{pericia.liberadaEm ? `liberado em ${dataHora(pericia.liberadaEm)} (D2.E1)` : 'esperando o INSS liberar (D2.E1)'}</dd>
                </>
              )}
              <dt>Marcar a perícia</dt>
              <dd>{t.proximaTentativa ? `tentativa diária; a próxima é ${prazoFalado(t.proximaTentativa, hoje).texto}` : 'tentativa diária, a partir da liberação'}</dd>
              <dt>Documentos da perícia</dt>
              <dd>até {DIAS_ANTES_DOCUMENTOS} dias antes da perícia, se ela pedir documento novo</dd>
              <dt>Preparar o cliente</dt>
              <dd>até {DIAS_ANTES_PREPARO} dias antes da perícia</dd>
              <dt>Lembrete ao cliente</dt>
              <dd>na véspera, pelo Chatwoot, revisado pelo Jurídico</dd>
            </dl>
          </section>

          <div className={styles.rodape}>
            {esperando ? (
              <>
                <button type="button" className={styles.principalBotao} disabled>
                  Ver a tarefa aberta
                </button>
                <p className={styles.motivo}>A tarefa entra na Central do Jurídico administrativo quando o INSS liberar o agendamento (D2.E1).</p>
              </>
            ) : (
              <a className={styles.principalBotao} href={tarefa}>
                Ver a tarefa aberta
              </a>
            )}
            <a className={proprio.secundario} href={`/casos/${processoId}/pericia`}>
              Abrir a página do processo
            </a>
          </div>

          <section className={styles.cartao} aria-labelledby="historico">
            <h2 id="historico" className={styles.cartaoTitulo}>
              Histórico da perícia
            </h2>
            <ol className={proprio.historico} aria-label="Histórico da perícia">
              {pericia.historico.map((e, i) => (
                <li key={i} className={proprio.evento}>
                  <span className={proprio.quando}>{dataHora(e.quando)}</span>
                  <span>
                    <strong>{e.quem}</strong> · {e.oQue}
                  </span>
                  <span className={proprio.passo}>{e.passo}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className={styles.lado} aria-labelledby="antes-de-concluir">
          <h2 id="antes-de-concluir" className={styles.ladoTitulo}>
            Antes de concluir
          </h2>
          <p className={styles.ladoSub}>No BPMN, o DP.01 agora é do sistema (ajuste de 29/09).</p>
          <h3 className={styles.ladoSecao}>Preenchido pelo sistema</h3>
          <ul className={styles.ladoLista} aria-label="Preenchido pelo sistema">
            <li>
              • Quem pediu: {origem.rotulo} · {pericia.pedidaPor}
            </li>
            <li>• Tipo: {primeiraMaiuscula(NOMES_DO_TIPO[pericia.tipo])}</li>
            <li>• Instância: {NOMES_DA_INSTANCIA[pericia.instancia]}</li>
            <li>• O que a perícia pede: {pericia.oQuePede ?? 'ainda não se sabe; vem com a marcação'}</li>
          </ul>
          <h3 className={styles.ladoSecao}>Travas</h3>
          <p className={styles.ladoSub}>Sem trava: o sistema abre a tarefa sozinho quando o pedido é protocolado (D2), despachado (D3) ou pedido pelo juiz (D3a).</p>
        </aside>
      </main>
      <AbaSuporte />
    </>
  )
}
