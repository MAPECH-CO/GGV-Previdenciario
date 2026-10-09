import { describe, expect, it } from 'vitest'
import { provaEhSensivel } from './prova-medica.ts'

describe('GGVP-39 CA15 e GGVP-83 CA15 · prova de exigência que é documento médico', () => {
  it('o item que pede laudo, atestado, exame, receita ou prontuário sobe como sensível', () => {
    for (const d of ['Laudo atualizado', 'Atestado do ortopedista', 'Exames de imagem', 'Receituário', 'Prontuário do hospital', 'Relatório médico'])
      expect(provaEhSensivel(d, undefined)).toBe(true)
  })

  it('o que não é médico segue comum, a não ser que quem sobe marque', () => {
    for (const d of ['Comprovante de residência', 'CNIS atualizado', 'Certidão de casamento', null]) expect(provaEhSensivel(d, undefined)).toBe(false)
    expect(provaEhSensivel('Comprovante de tratamento', 'true')).toBe(true)
    expect(provaEhSensivel('Comprovante de tratamento', 'false')).toBe(false)
  })
})
