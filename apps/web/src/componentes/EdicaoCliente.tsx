import { useRef, useState, type FormEvent, type HTMLAttributes } from 'react'
import { formatarCep, formatarCpf, formatarTelefone, isoParaData } from '../campos.ts'
import { FONTES } from '../dados/catalogos.ts'
import { salvarFicha } from '../dados/servidor.ts'
import type { Ficha } from '../dados/tipos.ts'
import { soNumeroEMascara, validarEdicao, type ValoresFicha } from '../regras/formularios.ts'
import { Campo } from './Campo.tsx'
import styles from './EdicaoCliente.module.css'

type Erros = Partial<Record<keyof ValoresFicha, string>>

type Definicao = {
  campo: keyof ValoresFicha
  rotulo: string
  /** Letra não entra: CPF, data, telefone e CEP. */
  mascara?: boolean
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode']
  maxLength?: number
}

// As linhas do Figma 73:229 a 73:281, na mesma ordem.
const LINHAS: Definicao[][] = [
  [
    { campo: 'nome', rotulo: 'Nome completo *', maxLength: 120 },
    { campo: 'cpf', rotulo: 'CPF', mascara: true, inputMode: 'numeric', maxLength: 14 },
    { campo: 'nascimento', rotulo: 'Data de nascimento', mascara: true, inputMode: 'numeric', maxLength: 10 },
  ],
  [
    { campo: 'telefone', rotulo: 'Telefone / WhatsApp *', mascara: true, inputMode: 'tel', maxLength: 15 },
    { campo: 'email', rotulo: 'E-mail', inputMode: 'email', maxLength: 120 },
    { campo: 'estadoCivil', rotulo: 'Estado civil', maxLength: 40 },
  ],
  [
    { campo: 'endereco', rotulo: 'Endereço', maxLength: 200 },
    { campo: 'cidadeUf', rotulo: 'Cidade / UF', maxLength: 80 },
    { campo: 'cep', rotulo: 'CEP', mascara: true, inputMode: 'numeric', maxLength: 9 },
  ],
  [
    { campo: 'profissao', rotulo: 'Profissão / última atividade', maxLength: 200 },
    { campo: 'comoChegou', rotulo: 'Como chegou' },
    { campo: 'contatoPreferido', rotulo: 'Contato preferido', maxLength: 80 },
  ],
  [
    { campo: 'contatoApoio', rotulo: 'Contato de apoio', maxLength: 200 },
    { campo: 'observacoes', rotulo: 'Observações', maxLength: 1000 },
  ],
]

function valoresDa(f: Ficha): ValoresFicha {
  return {
    nome: f.nome,
    cpf: f.cpf ? formatarCpf(f.cpf) : '',
    nascimento: isoParaData(f.nascimento) ?? '',
    telefone: formatarTelefone(f.telefone),
    email: f.email ?? '',
    estadoCivil: f.estadoCivil ?? '',
    endereco: f.endereco ?? '',
    cidadeUf: f.cidadeUf ?? '',
    cep: f.cep ? formatarCep(f.cep) : '',
    profissao: f.profissao ?? '',
    comoChegou: f.comoChegou ?? '',
    contatoPreferido: f.contatoPreferido ?? '',
    contatoApoio: f.contatoApoio ?? '',
    observacoes: f.observacoes ?? '',
  }
}

/** "Editar dados do cliente" (Figma 73:228 a 73:297). Valida ao sair do campo e de novo ao salvar (CA15). */
export function EdicaoCliente({ ficha, hoje, aoSalvar }: { ficha: Ficha; hoje: string; aoSalvar: (ficha: Ficha) => void }) {
  const [valores, setValores] = useState(() => valoresDa(ficha))
  const [erros, setErros] = useState<Erros>({})
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState('')
  // Trava no mesmo clique, antes de o React redesenhar o botão (CA16).
  const travado = useRef(false)
  const regras = { cpfObrigatorio: ficha.situacao === 'cliente', hoje }
  const fontes = FONTES.map((f) => (f.id === 'indicacao' && ficha.indicadoPor ? { ...f, nome: `Indicação (${ficha.indicadoPor})` } : f))

  function mudar(d: Definicao, valor: string) {
    setValores((v) => ({ ...v, [d.campo]: d.mascara ? soNumeroEMascara(valor) : valor }))
    setAviso('')
  }

  function sair(campo: keyof ValoresFicha) {
    setErros((e) => ({ ...e, [campo]: validarEdicao(valores, regras).erros[campo] }))
  }

  async function salvar(evento: FormEvent) {
    evento.preventDefault()
    if (travado.current) return
    const { erros: novos, dados } = validarEdicao(valores, regras)
    setErros(novos)
    if (!dados) return setAviso('Confira os campos marcados em vermelho.')
    travado.current = true
    setSalvando(true)
    try {
      const resposta = await salvarFicha(ficha.id, dados)
      if ('erro' in resposta) return setErros({ cpf: `Este CPF já está na ficha de ${resposta.nome}.` })
      setValores(valoresDa(resposta.ficha))
      aoSalvar(resposta.ficha)
      setAviso('Alterações salvas. Ficaram no histórico.')
    } finally {
      travado.current = false
      setSalvando(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={salvar} noValidate aria-labelledby="editar-dados">
      <h3 id="editar-dados" className={styles.titulo}>
        Editar dados do cliente
      </h3>
      {LINHAS.map((linha) => (
        <div key={linha[0].campo} className={styles.linha}>
          {linha.map((d) => (
            <Campo
              key={d.campo}
              id={`ficha-${d.campo}`}
              rotulo={d.campo === 'cpf' && regras.cpfObrigatorio ? 'CPF *' : d.rotulo}
              valor={valores[d.campo]}
              aoMudar={(valor) => mudar(d, valor)}
              aoSair={() => sair(d.campo)}
              erro={erros[d.campo]}
              opcoes={d.campo === 'comoChegou' ? fontes : undefined}
              inputMode={d.inputMode}
              maxLength={d.maxLength}
            />
          ))}
        </div>
      ))}
      <div className={styles.botoes}>
        <button type="submit" className={styles.salvar} disabled={salvando}>
          {salvando ? 'salvando…' : 'Salvar alterações'}
        </button>
        {/* Registrar contato é de outra história: avisa que está indisponível. */}
        <button type="button" className={styles.botao} aria-disabled="true">
          Registrar contato
        </button>
        {/* O cartão chama de "Marcar entrevista" (GGVP-123, CA1); o Figma, de "Marcar reunião". Vale o cartão. */}
        <a className={styles.botao} href={`/agenda/marcar/${ficha.id}`}>
          Marcar entrevista
        </a>
        <p role="status" className={styles.aviso}>
          {aviso}
        </p>
      </div>
      <p className={styles.nota}>
        Toda alteração fica no histórico (quem, quando, o que mudou). Dado de saúde só aparece para o Jurídico.
      </p>
    </form>
  )
}
