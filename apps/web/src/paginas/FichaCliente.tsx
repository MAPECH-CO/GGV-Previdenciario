import { useEffect, useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { CabecalhoCliente } from '../componentes/CabecalhoCliente.tsx'
import { Cartao } from '../componentes/Cartao.tsx'
import { CartaoFichaAtendimento } from '../componentes/CartaoFichaAtendimento.tsx'
import { CasoEmAndamento } from '../componentes/CasoEmAndamento.tsx'
import { ConferirEnviar } from '../componentes/ConferirEnviar.tsx'
import { DocumentosPessoais } from '../componentes/DocumentosPessoais.tsx'
import { EdicaoCliente } from '../componentes/EdicaoCliente.tsx'
import { ListaDatada } from '../componentes/ListaDatada.tsx'
import { PastasDosProcessos } from '../componentes/PastasDosProcessos.tsx'
import { RegistrarConversa } from '../componentes/RegistrarConversa.tsx'
import { Reunioes } from '../componentes/Reunioes.tsx'
import { TopoFicha } from '../componentes/TopoFicha.tsx'
import { Transcricoes } from '../componentes/Transcricoes.tsx'
import { CartaoFechamento } from '../componentes/CartaoFechamento.tsx'
import { nomeTipo } from '../dados/catalogos.ts'
import { agora, obterFicha } from '../dados/servidor.ts'
import { resumoParaAFicha } from '../dados/parecer.ts'
import type { Ficha, RespostaEnvio } from '../dados/tipos.ts'
import { dataCurta, dataHora, hojeIso } from '../regras/datas.ts'
import styles from './FichaCliente.module.css'

// Figma: "Cliente · dados (Atendimento)" (73:199). A visão do Atendimento não traz petição, estratégia, valores nem laudo.

export function FichaCliente({ id }: { id: string }) {
  // undefined: abrindo; null: não existe.
  const [ficha, setFicha] = useState<Ficha | null | undefined>(undefined)
  // Arquivos da janela "Conferir e enviar"; null com a janela fechada (GGVP-17).
  const [envio, setEnvio] = useState<File[] | null>(null)
  const [enviados, setEnviados] = useState('')
  // A janela "Transcrições" (GGVP-46), na visão do Atendimento.
  const [transcricoes, setTranscricoes] = useState(false)
  // A janela "Registrar conversa" do "Iniciar conversa" (GGVP-76).
  const [conversa, setConversa] = useState(false)
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
  // As miniaturas da semente e o que entrou depois em Documentos pessoais, pelo scanner ou pelo card.
  const pessoais = [
    ...ficha.documentos,
    ...ficha.arquivos
      .filter((a) => a.local === 'pessoais')
      .map((a) => ({ nome: nomeTipo(a.tipo), detalhe: [dataCurta(a.data, hoje), a.repetido ? 'repetido' : ''].filter(Boolean).join(' · ') })),
  ]

  async function aoEnviar(resposta: Extract<RespostaEnvio, { resultado: 'enviado' }>) {
    setEnvio(null)
    const n = resposta.arquivos.length
    setEnviados(`${n === 1 ? '1 arquivo enviado' : `${n} arquivos enviados`} para a pasta do cliente.${resposta.laudoNovo ? ' Laudo novo enviado ao Jurídico.' : ''}`)
    setFicha(await obterFicha(id))
  }

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
          <>
            {ficha.situacao === 'cliente' && (
              <a className={styles.novaDemanda} href={`/clientes/${ficha.id}/nova-demanda`}>
                + Nova demanda
              </a>
            )}
            <button type="button" className={styles.transcricoes} onClick={() => setTranscricoes(true)}>
              <span aria-hidden="true">▶ </span>Transcrições ({ficha.transcricoes})
            </button>
          </>
        }
      />
      <main className={styles.pagina}>
        <div className={styles.esquerda}>
          <Cartao rotulo={`Dados de ${ficha.nome}`}>
            <CabecalhoCliente ficha={ficha} hoje={hoje} />
            <EdicaoCliente ficha={ficha} hoje={hoje} aoSalvar={setFicha} aoIniciarConversa={() => setConversa(true)} />
          </Cartao>
          <DocumentosPessoais documentos={pessoais} aoSoltar={setEnvio} aviso={enviados} />
          <PastasDosProcessos ficha={ficha} hoje={hoje} />
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
          <CartaoFechamento fechamento={ficha.fechamento} hoje={hoje} fichaId={ficha.id} />
          <Cartao titulo="Documentação médica">
            <p className={styles.texto}>
              {/* O resultado do parecer (GGVP-20), nunca o conteúdo; sem análise ainda, o texto da semente. */}
              {[resumoParaAFicha(ficha.id) ?? ficha.documentacaoMedica ?? 'Nenhum laudo recebido ainda.', laudoNovo].filter(Boolean).join(' ')}
            </p>
          </Cartao>
          <CartaoFichaAtendimento ficha={ficha} hoje={hoje} />
          <Reunioes agendamentos={ficha.agendamentos} hoje={hoje} />
        </div>
      </main>
      <AbaSuporte />
      {transcricoes && (
        <Transcricoes ficha={ficha} perfil="atendimento" aoFechar={() => setTranscricoes(false)} aoMudar={async () => setFicha(await obterFicha(id))} />
      )}
      {conversa && <RegistrarConversa ficha={ficha} aoFechar={() => setConversa(false)} />}
      {envio && <ConferirEnviar fichaId={ficha.id} origem="card" iniciais={envio} aoEnviar={aoEnviar} aoFechar={() => setEnvio(null)} />}
    </>
  )
}
