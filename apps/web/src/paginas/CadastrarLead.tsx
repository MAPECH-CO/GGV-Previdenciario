import { useEffect, useRef, useState, type HTMLAttributes } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { Campo } from '../componentes/Campo.tsx'
import { TopoPasso } from '../componentes/TopoPasso.tsx'
import { Transcricoes } from '../componentes/Transcricoes.tsx'
import { dataParaIso, formatarCep, formatarCpf, formatarTelefone, normalizarData, validarCep, validarCpf, validarTelefone } from '../campos.ts'
import { buscarEndereco, obterCadastro, salvarCadastro } from '../dados/cadastro.ts'
import { PROFISSOES, nomeBeneficio, type ItemCatalogo } from '../dados/catalogos.ts'
import { entrarNaEdicao } from '../dados/presenca.ts'
import { QUEM_ADVOGADA, agora } from '../dados/servidor.ts'
import type { Cadastro, Ficha, Representante } from '../dados/tipos.ts'
import {
  ESTADOS_CIVIS,
  PARENTESCOS,
  ROTULOS_DO_CADASTRO,
  cadastroDaFicha,
  errosDoCadastro,
  errosDoRepresentante,
  faltaParaOKit,
  oQueFaltaNoCadastro,
  preencherCadastro,
  type Fonte,
} from '../regras/cadastro.ts'
import { hojeIso, idadeEm } from '../regras/datas.ts'
import { soNumeroEMascara } from '../regras/formularios.ts'
import styles from './Balcao.module.css'
import proprio from './CadastrarLead.module.css'

// Figma: step_D1.10 "Cadastrar lead" (14:89). O cartão manda os campos: os do modelo do contrato (CA3), preenchidos pela
// ficha e pela entrevista (CA1, CA8), na mesma ficha do primeiro contato (CA9).

type Linha = { campo: keyof Cadastro; mascara?: boolean; inputMode?: HTMLAttributes<HTMLInputElement>['inputMode']; maxLength?: number; largo?: boolean }

const LINHAS: Linha[][] = [
  [{ campo: 'nome', maxLength: 120, largo: true }],
  [
    { campo: 'cpf', mascara: true, inputMode: 'numeric', maxLength: 14 },
    { campo: 'rg', maxLength: 20 },
    { campo: 'nascimento', mascara: true, inputMode: 'numeric', maxLength: 10 },
  ],
  [{ campo: 'estadoCivil' }, { campo: 'profissao' }, { campo: 'telefone', mascara: true, inputMode: 'tel', maxLength: 15 }],
  [{ campo: 'cep', mascara: true, inputMode: 'numeric', maxLength: 9 }, { campo: 'rua', maxLength: 150, largo: true }],
  [{ campo: 'bairro', maxLength: 80 }, { campo: 'cidade', maxLength: 80 }, { campo: 'uf', maxLength: 2 }],
]

const OBRIGATORIOS = new Set<keyof Cadastro>(['nome', 'cpf', 'rg', 'estadoCivil', 'profissao', 'telefone', 'cep', 'rua', 'bairro', 'cidade', 'uf'])

const lista = (itens: string[]): ItemCatalogo[] => itens.map((nome) => ({ id: nome, nome }))
const OPCOES: Partial<Record<keyof Cadastro, ItemCatalogo[]>> = { estadoCivil: lista(ESTADOS_CIVIS), profissao: PROFISSOES }

const REPRESENTANTE_VAZIO: Representante = { nome: '', cpf: '', rg: '', parentesco: '', estadoCivil: '', profissao: '' }

const DE_ONDE: Record<Fonte, string> = { ficha: 'da ficha', entrevista: 'da entrevista · confira' }

/** O que a máscara deixa e como o campo fica ao sair dele. */
function formatar(campo: keyof Cadastro, valor: string): string {
  if (campo === 'cpf' && validarCpf(valor)) return formatarCpf(valor)
  if (campo === 'telefone' && validarTelefone(valor)) return formatarTelefone(valor)
  if (campo === 'cep') return formatarCep(valor)
  if (campo === 'uf') return valor.toUpperCase()
  return valor
}

function juntar(itens: string[]): string {
  return itens.length <= 1 ? itens.join('') : `${itens.slice(0, -1).join(', ')} e ${itens.at(-1)}`
}

type Estado = { ficha: Ficha; base: Cadastro; valores: Cadastro; origem: Partial<Record<keyof Cadastro, Fonte>>; divergencias: ReturnType<typeof preencherCadastro>['divergencias'] }

export function CadastrarLead({ fichaId }: { fichaId: string }) {
  const [estado, setEstado] = useState<Estado | null | undefined>(undefined)
  const [tocados, setTocados] = useState<Set<string>>(new Set())
  const [escolhas, setEscolhas] = useState<Partial<Record<keyof Cadastro, Fonte>>>({})
  const [comRepresentante, setComRepresentante] = useState(false)
  const [representante, setRepresentante] = useState<Representante>(REPRESENTANTE_VAZIO)
  const [cep, setCep] = useState('')
  const [outros, setOutros] = useState<string[]>([])
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState<Ficha | null>(null)
  const [dono, setDono] = useState<{ id: string; nome: string } | null>(null)
  const [conflito, setConflito] = useState<string[]>([])
  const [erro, setErro] = useState('')
  const [transcricoes, setTranscricoes] = useState(false)
  const travado = useRef(false)
  const hoje = hojeIso(agora())

  useEffect(() => {
    let valendo = true
    obterCadastro(fichaId).then((d) => {
      if (!valendo) return
      if (!d) return setEstado(null)
      const { valores, origem, divergencias } = preencherCadastro(d.ficha, d.extraidas)
      setEstado({ ficha: d.ficha, base: cadastroDaFicha(d.ficha), valores, origem, divergencias })
      setComRepresentante(d.ficha.representante !== undefined)
      setRepresentante(d.ficha.representante ?? REPRESENTANTE_VAZIO)
    })
    return () => {
      valendo = false
    }
  }, [fichaId])

  // "Fulano está editando", na hora (CA11).
  useEffect(() => entrarNaEdicao(fichaId, QUEM_ADVOGADA, setOutros), [fichaId])

  if (!estado) {
    return (
      <main className={proprio.vazia}>
        <title>Cadastrar lead · GGV Previdenciário</title>
        <h1 className={styles.titulo}>{estado === null ? 'Ficha não encontrada' : 'Abrindo o cadastro…'}</h1>
        {estado === null && <a href="/advogada">Voltar ao início</a>}
      </main>
    )
  }

  const { ficha, valores, origem, divergencias } = estado
  const erros = errosDoCadastro(valores, hoje)
  const errosRep = comRepresentante ? errosDoRepresentante(representante) : {}
  const falta = oQueFaltaNoCadastro(valores, comRepresentante ? representante : undefined, hoje)
  const nascimentoIso = dataParaIso(normalizarData(valores.nascimento))
  const idade = nascimentoIso && nascimentoIso <= hoje ? `${idadeEm(nascimentoIso, hoje)} anos` : undefined
  const profissaoDaFicha = ficha.profissao && !valores.profissao ? `Na ficha: ${ficha.profissao} · escolha na lista` : undefined
  const kit = faltaParaOKit(salvo ?? ficha)
  const entrevista = ficha.agendamentos.filter((a) => a.estado === 'realizado').at(-1)

  function mudar(campo: keyof Cadastro, valor: string, mascara?: boolean) {
    setEstado((e) => e && { ...e, valores: { ...e.valores, [campo]: mascara ? soNumeroEMascara(valor) : valor } })
    setDono(null)
  }

  function sair(campo: keyof Cadastro) {
    setTocados((t) => new Set(t).add(campo))
    setEstado((e) => e && { ...e, valores: { ...e.valores, [campo]: formatar(campo, e.valores[campo]) } })
    if (campo === 'cep') preencherPeloCep(valores.cep)
  }

  async function preencherPeloCep(valor: string) {
    if (!validarCep(valor)) return
    const endereco = await buscarEndereco(valor)
    if (!endereco) return setCep('CEP não encontrado: digite o endereço.')
    setCep('Endereço pelo CEP (ViaCEP simulado): confira e complete o número.')
    setEstado(
      (e) =>
        e && {
          ...e,
          valores: { ...e.valores, rua: e.valores.rua || `${endereco.logradouro}, `, bairro: endereco.bairro, cidade: endereco.cidade, uf: endereco.uf },
        },
    )
  }

  function escolher(campo: keyof Cadastro, fonte: Fonte, valor: string) {
    setEscolhas((x) => ({ ...x, [campo]: fonte }))
    mudar(campo, valor)
  }

  async function salvar() {
    if (travado.current || falta.length > 0) return
    travado.current = true
    setSalvando(true)
    setErro('')
    setConflito([])
    try {
      const r = await salvarCadastro(fichaId, { base: estado!.base, valores, representante: comRepresentante ? representante : undefined })
      if (r.resultado === 'cpf-de-outra-ficha') return setDono({ id: r.id, nome: r.nome })
      if (r.resultado === 'conflito') {
        // Fica o que a outra pessoa salvou nos campos que os dois mexeram; a advogada confere e salva de novo.
        const atual = await obterCadastro(fichaId)
        const deles = Object.fromEntries(r.campos.map((c) => [c.campo, c.deles]))
        setEstado((e) => e && atual && { ...e, ficha: atual.ficha, base: cadastroDaFicha(atual.ficha), valores: { ...e.valores, ...deles } })
        return setConflito(r.campos.map((c) => ROTULOS_DO_CADASTRO[c.campo]))
      }
      setSalvo(r.ficha)
      setEstado((e) => e && { ...e, ficha: r.ficha, base: cadastroDaFicha(r.ficha) })
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não deu para salvar.')
    } finally {
      travado.current = false
      setSalvando(false)
    }
  }

  const rotuloDe = (campo: keyof Cadastro) => `${ROTULOS_DO_CADASTRO[campo]}${OBRIGATORIOS.has(campo) ? ' *' : ''}`
  const dicaDe = (campo: keyof Cadastro) =>
    (campo === 'nascimento' && idade) ||
    (campo === 'profissao' && profissaoDaFicha) ||
    (campo === 'cep' && cep) ||
    (origem[campo] && valores[campo] ? DE_ONDE[origem[campo]] : undefined) ||
    undefined

  return (
    <>
      <title>{`${ficha.nome} · Cadastrar lead · GGV Previdenciário`}</title>
      <TopoPasso contexto="Você · Advogada responsável" inicio="/advogada" />
      <main className={styles.pagina}>
        <div className={styles.principal}>
          <div className={styles.cabecalho}>
            <div className={styles.chips}>
              <span className={styles.codigo} title="D1.10 · Cadastrar o lead (passo do BPMN)">
                D1.10
              </span>
              <span className={proprio.advogada}>Advogada</span>
            </div>
            <h1 className={styles.titulo}>
              <strong>{ficha.nome}</strong> · Cadastrar lead
            </h1>
            <p className={styles.subtitulo}>Após a entrevista</p>
          </div>

          {outros.length > 0 && (
            <p className={proprio.alerta} role="alert">
              {juntar([...new Set(outros)])}, em outra aba, está editando esta ficha agora. Ao salvar, o que a outra pessoa salvou não se perde.
            </p>
          )}
          {conflito.length > 0 && (
            <p className={proprio.alerta} role="alert">
              Outra pessoa salvou {juntar(conflito)} enquanto você editava. Ficou o que ela salvou: confira e salve de novo.
            </p>
          )}

          {divergencias.length > 0 && !salvo && (
            <section className={proprio.divergencias} aria-labelledby="divergencias">
              <h2 id="divergencias" className={styles.cartaoTitulo}>
                A ficha e a entrevista dizem diferente
              </h2>
              {divergencias.map((d) => (
                <div key={d.campo} className={proprio.divergencia}>
                  <p id={`div-${d.campo}`}>{ROTULOS_DO_CADASTRO[d.campo]}</p>
                  <div className={styles.ladoOpcoes} role="radiogroup" aria-labelledby={`div-${d.campo}`}>
                    <button type="button" role="radio" className={styles.chip} aria-checked={(escolhas[d.campo] ?? 'ficha') === 'ficha'} onClick={() => escolher(d.campo, 'ficha', d.ficha)}>
                      Ficha: {d.ficha}
                    </button>
                    <button type="button" role="radio" className={styles.chip} aria-checked={escolhas[d.campo] === 'entrevista'} onClick={() => escolher(d.campo, 'entrevista', d.entrevista)}>
                      Entrevista: {d.entrevista}
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )}

          <section className={styles.cartao} aria-labelledby="preencher">
            <h2 id="preencher" className={styles.cartaoTitulo}>
              Preencher
            </h2>
            {LINHAS.map((linha) => (
              <div key={linha[0].campo} className={proprio.linha}>
                {linha.map((d) => (
                  <Campo
                    key={d.campo}
                    id={`cadastro-${d.campo}`}
                    rotulo={rotuloDe(d.campo)}
                    valor={valores[d.campo]}
                    aoMudar={(v) => mudar(d.campo, v, d.mascara)}
                    aoSair={() => sair(d.campo)}
                    erro={tocados.has(d.campo) ? erros[d.campo] : undefined}
                    opcoes={OPCOES[d.campo]}
                    inputMode={d.inputMode}
                    maxLength={d.maxLength}
                    largo={d.largo}
                    dica={dicaDe(d.campo)}
                  />
                ))}
              </div>
            ))}
            <p className={proprio.beneficio}>
              Benefício: {nomeBeneficio(ficha.beneficioInteresse) || 'a definir'} · a advogada define no D1.12
            </p>

            <label className={proprio.conferencia}>
              <input type="checkbox" checked={comRepresentante} onChange={(e) => setComRepresentante(e.target.checked)} />
              Tem representante legal (LOAS de criança, curatela…)
            </label>
            {comRepresentante && (
              <fieldset className={proprio.representante}>
                <legend className={styles.cartaoTitulo}>Representante legal</legend>
                <div className={proprio.linha}>
                  <Campo
                    id="rep-nome"
                    rotulo="Nome completo do representante *"
                    valor={representante.nome}
                    aoMudar={(v) => setRepresentante((r) => ({ ...r, nome: v }))}
                    aoSair={() => setTocados((t) => new Set(t).add('rep-nome'))}
                    erro={tocados.has('rep-nome') ? errosRep.nome : undefined}
                    maxLength={120}
                    largo
                  />
                </div>
                <div className={proprio.linha}>
                  <Campo
                    id="rep-cpf"
                    rotulo="CPF do representante *"
                    valor={representante.cpf}
                    aoMudar={(v) => setRepresentante((r) => ({ ...r, cpf: soNumeroEMascara(v) }))}
                    aoSair={() => {
                      setTocados((t) => new Set(t).add('rep-cpf'))
                      setRepresentante((r) => ({ ...r, cpf: validarCpf(r.cpf) ? formatarCpf(r.cpf) : r.cpf }))
                    }}
                    erro={tocados.has('rep-cpf') ? errosRep.cpf : undefined}
                    inputMode="numeric"
                    maxLength={14}
                  />
                  <Campo
                    id="rep-rg"
                    rotulo="RG do representante *"
                    valor={representante.rg}
                    aoMudar={(v) => setRepresentante((r) => ({ ...r, rg: v }))}
                    aoSair={() => setTocados((t) => new Set(t).add('rep-rg'))}
                    erro={tocados.has('rep-rg') ? errosRep.rg : undefined}
                    maxLength={20}
                  />
                  <Campo
                    id="rep-parentesco"
                    rotulo="Parentesco *"
                    valor={representante.parentesco}
                    aoMudar={(v) => setRepresentante((r) => ({ ...r, parentesco: v }))}
                    opcoes={lista(PARENTESCOS)}
                  />
                </div>
                <div className={proprio.linha}>
                  <Campo
                    id="rep-estado-civil"
                    rotulo="Estado civil do representante *"
                    valor={representante.estadoCivil}
                    aoMudar={(v) => setRepresentante((r) => ({ ...r, estadoCivil: v }))}
                    opcoes={lista(ESTADOS_CIVIS)}
                  />
                  <Campo
                    id="rep-profissao"
                    rotulo="Profissão do representante *"
                    valor={representante.profissao}
                    aoMudar={(v) => setRepresentante((r) => ({ ...r, profissao: v }))}
                    opcoes={PROFISSOES}
                  />
                </div>
              </fieldset>
            )}
          </section>

          {dono && (
            <p className={proprio.alerta} role="alert">
              Este CPF já é do cadastro de {dono.nome}. O portal não cria outro.{' '}
              <a className={styles.avisoLink} href={`/clientes/${dono.id}`}>
                Abrir o cadastro existente
              </a>
            </p>
          )}

          {salvo ? (
            <section className={styles.feito} aria-labelledby="cadastro-salvo">
              <h2 id="cadastro-salvo" className={styles.feitoTitulo}>
                ✓ Cadastro salvo na mesma ficha ({salvo.situacao})
              </h2>
              <p>Cada alteração ficou no histórico, com o valor anterior.</p>
              <div className={styles.atalhos}>
                <a className={styles.atalho} href={`/clientes/${ficha.id}`}>
                  Abrir a ficha do cliente
                </a>
                {entrevista && (
                  <a className={styles.atalho} href={`/entrevista/${entrevista.id}/beneficio`}>
                    Definir o benefício (D1.12)
                  </a>
                )}
              </div>
            </section>
          ) : (
            <div className={styles.rodape}>
              <button type="button" className={styles.principalBotao} disabled={falta.length > 0 || salvando} onClick={salvar}>
                {salvando ? 'salvando…' : 'Salvar cadastro'}
              </button>
              {falta.length > 0 && <p className={styles.motivo}>Falta: {juntar(falta)}.</p>}
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
          <p className={styles.ladoSub}>O que o BPMN (Miro) pede no passo D1.10.</p>
          <h3 className={styles.ladoSecao}>Campos</h3>
          <ul className={styles.ladoLista}>
            <li>• Nome completo*</li>
            <li>• CPF*</li>
            <li>• Estado civil* ({ESTADOS_CIVIS.join(', ')})</li>
            <li>• Profissão*</li>
            <li>• RG*</li>
            <li>• Endereço*</li>
          </ul>
          <h3 className={styles.ladoSecao}>Travas</h3>
          <p className={styles.ladoSub}>«Salvar cadastro» só habilita com os campos com * preenchidos.</p>
          <h3 className={styles.ladoSecao}>Como segue</h3>
          <p>
            Campos exigidos pelo modelo do contrato: nome, estado civil, profissão, CPF, RG, endereço e telefone (e os do
            representante, quando houver).
          </p>
          <button type="button" className={styles.atalho} onClick={() => setTranscricoes(true)}>
            ▶ Abrir a transcrição
          </button>
          <h3 className={styles.ladoSecao}>Kit do benefício (D1.15)</h3>
          <p className={proprio.kit} data-ok={kit.length === 0}>
            {kit.length === 0 ? 'Pode ser gerado: o cadastro tem os campos do modelo.' : `Ainda não pode ser gerado. Falta: ${juntar(kit)}.`}
          </p>
        </aside>
      </main>
      <AbaSuporte />
      {transcricoes && <Transcricoes ficha={ficha} perfil="juridico" aoFechar={() => setTranscricoes(false)} />}
    </>
  )
}
