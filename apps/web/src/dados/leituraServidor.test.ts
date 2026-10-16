import { beforeEach, describe, expect, it } from 'vitest'
import { enviarArquivos } from './documentos.ts'
import { tarefasDePedirLegivel } from './leitura.ts'
import { configurarExemplo, gravar, ler, zerarExemplo } from './servidor.ts'

// GGVP-158 P12.4: o "Pedir documento legível" da ficha do servidor vem pela linha do servidor; a tela não repete.
const DO_BANCO = '6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b'
const pdf = (nome: string, tipo: string, n: number) => ({ nome, formato: 'pdf' as const, tamanho: 1000, tipo, hash: String(n).padStart(64, '0') })

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 5, 14, 32), latencia: 0, servidor: false })
  zerarExemplo()
})

describe('GGVP-158 P12.4 · o ilegível da ficha do servidor vem do servidor', () => {
  it('a ficha da semente segue com a tarefa calculada aqui; a cópia da ficha do servidor, não', async () => {
    await enviarArquivos('maria-exemplo', { origem: 'card', arquivos: [pdf('laudo ilegivel.pdf', 'laudo', 9)] })
    expect(tarefasDePedirLegivel().map((t) => t.acao)).toEqual(['Pedir documento legível'])

    // A mesma ficha como cópia do servidor (o id do banco), com a leitura que veio de lá.
    const banco = ler()
    banco.fichas = banco.fichas.map((f) => (f.id === 'maria-exemplo' ? { ...f, id: DO_BANCO } : f))
    banco.leituras = (banco.leituras ?? []).map((l) => (l.fichaId === 'maria-exemplo' ? { ...l, fichaId: DO_BANCO } : l))
    gravar(banco)
    configurarExemplo({ servidor: true })
    expect(tarefasDePedirLegivel()).toEqual([])
  })
})
