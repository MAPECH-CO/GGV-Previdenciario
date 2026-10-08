import { render, renderHook, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { usePerfil } from './perfis.ts'
import { SessaoContexto } from '../sessao.ts'
import { usuarioDeTeste } from './sessaoDeTeste.tsx'

function Quem({ padrao }: { padrao?: string }) {
  const p = usePerfil(padrao)
  return <p>{p ? `${p.id} · ${p.rotulo} · ${p.usuario}` : 'nenhum'}</p>
}

describe('usePerfil: quem está agindo nas telas vem da sessão (GGVP-96)', () => {
  it('com sessão, vale o perfil ativo e o nome de quem entrou, não a função da tela', () => {
    render(
      <SessaoContexto value={usuarioDeTeste('senior')}>
        <Quem padrao="Advogada" />
      </SessaoContexto>,
    )
    expect(screen.getByText('senior · Sênior · Dra. Renata (exemplo)')).toBeTruthy()
  })

  it('a segunda sênior é outra pessoa, com o mesmo perfil', () => {
    render(
      <SessaoContexto value={usuarioDeTeste('senior-2')}>
        <Quem />
      </SessaoContexto>,
    )
    expect(screen.getByText('senior · Sênior · Dr. Otávio (exemplo)')).toBeTruthy()
  })

  it('o Atendimento líder vira o id com hífen que as telas já usavam', () => {
    render(
      <SessaoContexto value={usuarioDeTeste('atendimento_lider')}>
        <Quem />
      </SessaoContexto>,
    )
    expect(screen.getByText('atendimento-lider · Atendimento · líder · atendimento_lider')).toBeTruthy()
  })

  it('sem sessão, a tela fica como foi desenhada: a função do padrão', () => {
    render(<Quem padrao="Documentação" />)
    expect(screen.getByText('documentacao · Documentação · Jéssica (exemplo)')).toBeTruthy()
  })

  it('o mesmo objeto enquanto a sessão não muda: a tela que põe o perfil num efeito não entra em laço', () => {
    const usuario = usuarioDeTeste('advogada')
    const comSessao = ({ children }: { children: ReactNode }) => <SessaoContexto value={usuario}>{children}</SessaoContexto>
    const { result, rerender } = renderHook(() => usePerfil('Advogada'), { wrapper: comSessao })
    const primeiro = result.current
    rerender()
    expect(result.current).toBe(primeiro)
  })
})
