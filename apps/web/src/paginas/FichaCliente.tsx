import { useEffect, useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { CabecalhoCliente } from '../componentes/CabecalhoCliente.tsx'
import { Cartao } from '../componentes/Cartao.tsx'
import { CasoEmAndamento } from '../componentes/CasoEmAndamento.tsx'
import { DocumentosPessoais } from '../componentes/DocumentosPessoais.tsx'
import { EdicaoCliente } from '../componentes/EdicaoCliente.tsx'
import { ListaDatada } from '../componentes/ListaDatada.tsx'
import { Reunioes } from '../componentes/Reunioes.tsx'
import { TopoFicha } from '../componentes/TopoFicha.tsx'
import { agora, obterFicha } from '../dados/servidor.ts'
import type { Ficha } from '../dados/tipos.ts'
import { dataCurta, dataHora, hojeIso } from '../regras/datas.ts'
import styles from './FichaCliente.module.css'

// Figma: "Cliente · dados (Atendimento)" (73:199). A visão do Atendimento não traz petição, estratégia, valores nem laudo.

export function FichaCliente({ id }: { id: string }) {
  // undefined: abrindo; null: não existe.
  const [ficha, setFicha] = useState<Ficha | null | undefined>(undefined)
  const hoje = hojeIso(agora())

  useEffect(() => {
    let valendo = true
    obterFicha(id).then((f) => {
      if (valendo) setFicha(f)
    })
    return () => {
      valendo = false
    }
  }, [id])

  if (!ficha) {
    return (
      <main className={styles.vazia}>
        <title>Cliente · GGV Previdenciário</title>
        <h1 className={styles.titulo}>{ficha === null ? 'Ficha não encontrada' : 'Abrindo a ficha…'}</h1>
        {ficha === null && (
          <a className={styles.voltar} href="/balcao">
            Voltar ao balcão
          </a>
        )}
      </main>
    )
  }

  const contatos = [...ficha.contatos].sort((a, b) => b.data.localeCompare(a.data))
  const historico = [...ficha.historico].reverse()
  const laudoNovo = ficha.laudoNovoEm && `Laudo novo de ${dataCurta(ficha.laudoNovoEm, hoje)} enviado ao Jurídico: aguarda a análise.`

  return (
    <>
      <title>{`${ficha.nome} · GGV Previdenciário`}</title>
      <TopoFicha
        titulo="Cliente"
        chips={[
          { texto: `${ficha.situacao} desde ${ficha.desde}`, tom: 'neutro' },
          { texto: 'Atendimento não vê petição nem valores', tom: 'acento' },
        ]}
        acao={
          // Transcrições são de outra história: avisa que está indisponível.
          <button type="button" className={styles.transcricoes} aria-disabled="true">
            <span aria-hidden="true">▶ </span>Transcrições ({ficha.transcricoes})
          </button>
        }
      />
      <main className={styles.pagina}>
        <div className={styles.esquerda}>
          <Cartao rotulo={`Dados de ${ficha.nome}`}>
            <CabecalhoCliente ficha={ficha} hoje={hoje} />
            <EdicaoCliente ficha={ficha} hoje={hoje} aoSalvar={setFicha} />
          </Cartao>
          <DocumentosPessoais documentos={ficha.documentos} />
          <Cartao titulo="Últimos contatos">
            <ListaDatada
              nome="Últimos contatos"
              vazio="Nenhum contato registrado."
              itens={contatos.map((c, i) => ({ chave: `${c.data}-${i}`, quando: dataCurta(c.data, hoje), rotulo: c.canal, texto: c.texto }))}
            />
          </Cartao>
          <Cartao titulo="Histórico">
            <ListaDatada
              nome="Histórico"
              vazio="Nada registrado ainda."
              itens={historico.map((e, i) => ({ chave: `${e.quando}-${i}`, quando: dataHora(e.quando), rotulo: e.quem, texto: e.oQue }))}
            />
          </Cartao>
        </div>
        <div className={styles.direita}>
          <CasoEmAndamento ficha={ficha} />
          <Cartao titulo="Documentação médica">
            <p className={styles.texto}>
              {[ficha.documentacaoMedica ?? 'Nenhum laudo recebido ainda.', laudoNovo].filter(Boolean).join(' ')}
            </p>
          </Cartao>
          <Reunioes agendamentos={ficha.agendamentos} hoje={hoje} />
        </div>
      </main>
      <AbaSuporte />
    </>
  )
}
