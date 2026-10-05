import { useEffect, useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { CabecalhoDoContrato } from '../componentes/CabecalhoDoContrato.tsx'
import { CartaoKit } from '../componentes/CartaoKit.tsx'
import { TopoPasso } from '../componentes/TopoPasso.tsx'
import { nomeBeneficio } from '../dados/catalogos.ts'
import { obterContrato, type ContratoDoCaso } from '../dados/contrato.ts'
import { modeloPorId } from '../regras/contrato.ts'
import styles from './Balcao.module.css'
import proprio from './PrepararContrato.module.css'

// Figma: step_D1.16 "Preparar contrato" (10:143). O kit do benefício (GGVP-65) não tem tela própria no Figma: o cartão pede
// que ele apareça aqui, antes do preenchimento.

export function PrepararContrato({ processoId }: { processoId: string }) {
  const [caso, setCaso] = useState<ContratoDoCaso | null | undefined>(undefined)

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
        <title>Preparar contrato · GGV Previdenciário</title>
        <h1 className={styles.titulo}>{caso === null ? 'Contrato não encontrado' : 'Abrindo a tarefa…'}</h1>
        {caso === null && <a href="/">Voltar ao início</a>}
      </main>
    )
  }

  const { ficha, processo, contrato } = caso
  const { kit } = contrato
  const modelo = kit ? modeloPorId(kit.modelo) : null
  const primeiro = ficha.nome.split(' ')[0]
  const instrucoes =
    kit && modelo
      ? `Gere o contrato de ${primeiro} pelo ${modelo.nome}, com o kit de ${kit.nome}: ${kit.documentos.length} documentos. Confira nome, CPF, ` +
        `endereço e honorários (${modelo.honorarios ?? `os do ${modelo.nome}`}): o contrato cita o benefício certo. Se algo do modelo não ` +
        'bater com a ficha, corrija a ficha antes.'
      : `${nomeBeneficio(processo.beneficio)} ainda não tem kit cadastrado. Avise a gestão: nada vai para o cliente assinar sem o kit certo.`

  return (
    <>
      <title>{`${ficha.nome} · Preparar contrato · GGV Previdenciário`}</title>
      <TopoPasso contexto={`Cliente · ${ficha.nome}`} />
      <main className={styles.pagina}>
        <div className={styles.principal}>
          <CabecalhoDoContrato
            passo="D1.16"
            nomeDoPasso="Preparar o contrato pelo modelo e conferir"
            tarefa="Preparar contrato"
            subtitulo={`${nomeBeneficio(processo.beneficio)} · ${modelo ? `pelo ${modelo.nome}` : 'sem kit cadastrado'}`}
            ficha={ficha}
            beneficio={processo.beneficio}
            instrucoes={instrucoes}
          />
          <CartaoKit
            processoId={processoId}
            beneficio={processo.beneficio}
            contrato={contrato}
            editavel={contrato.etapa === 'preparar'}
            aoMudar={(c) => setCaso({ ...caso, contrato: c })}
          />
        </div>

        <aside className={styles.lado} aria-labelledby="antes-de-concluir">
          <h2 id="antes-de-concluir" className={styles.ladoTitulo}>
            Antes de concluir
          </h2>
          <p className={styles.ladoSub}>O que o BPMN (Miro) pede no passo D1.16.</p>
          <h3 className={styles.ladoSecao}>Kit</h3>
          <p>O kit é o do benefício do caso, pela tabela do escritório: nem mais nem menos documentos.</p>
        </aside>
      </main>
      <AbaSuporte />
    </>
  )
}
