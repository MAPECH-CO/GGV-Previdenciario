# Design

## Context

- Esta change continua as changes `ggvp-6-recepcao-e-entrevista` e `ggvp-7-abertura-e-documentacao`: mesma base de telas, mesmo servidor de exemplo, mesmos clientes. As decisões das `design.md` delas valem aqui (servidor de exemplo em `src/dados/`, regras puras em `src/regras/`, `campos` pelo `src/campos.ts`, catálogos únicos em `src/dados/catalogos.ts`, arquivo comum só com acréscimo).
- As pontas que a Recepção e a Abertura deixaram para cá: o laudo novo que espera a análise (GGVP-17, `dados/documentos.ts`), a leitura que separa documento médico (GGVP-81, `dados/leitura.ts`), o parecer "de exemplo, até a GGVP-20" da liberação (GGVP-18, `dados/liberacao.ts`) e o roteiro em `docs/requisitos/roteiro-laudos.md`.
- O main trouxe o monorepo e o login: toda tela passa pela sessão. O usuário de exemplo é do Atendimento; as outras funções se veem pelo "Trocar perfil" (`dados/perfis.ts`), como nas telas anteriores.

## Decisions (valem para o épico)

1. **Arquivo novo por assunto.** Roteiro: `src/regras/roteiro.ts` e `src/dados/roteiro.ts`. Parecer e portão: `src/regras/parecer.ts` e `src/dados/parecer.ts`. Complemento: `src/dados/complemento.ts`. Tipo novo fica no arquivo do assunto.
2. **Arquivo comum só com acréscimo.** Em `servidor.ts` (tipo `Banco`), `exemplo.ts`, `tipos.ts`, `catalogos.ts`, `perfis.ts`, `App.tsx` e nas Centrais: acrescentar no fim, sem reordenar nem reformatar. Campo novo no `Banco` é opcional (`roteiros?`, `pareceres?`, `complementos?`) e a chave do `sessionStorage` não muda. Rota nova vai dentro de `Telas`, depois da conferência de sessão.
3. **Dado de saúde por perfil.** Conteúdo clínico (trecho, página, CID, texto do laudo, a comparação) só para o Jurídico: advogada e sênior. Atendimento e Documentação veem que o documento existe (tipo, data, emitente), o resultado do parecer e o que falta pedir, em linguagem simples. O servidor de exemplo devolve a visão de cada perfil (`visao: 'juridico' | 'atendimento'`); ao ligar no servidor, o perfil vem da sessão. Nada de saúde vai para o histórico: só o que aconteceu.
4. **A IA sugere, a pessoa decide.** A análise da IA é sempre "sugerida"; o parecer só vale com o registro de uma pessoa do Jurídico (G17). A IA nunca sugere diagnóstico, CID, grau nem conclusão (G20). IA simulada por tabelas da semente e, no que sobe pelo card, por pistas no nome do arquivo, como a GGVP-17 e a GGVP-81 já fazem.
5. **Quem fez.** A tela manda o nome da pessoa do perfil escolhido (`usePerfil`); sem escolha, o da função da tela. Ao ligar no servidor, vem da sessão.
6. **Portas.** Portal na 5173. Playwright desta sessão: `PORTA_E2E_API=3193` e `PORTA_E2E_WEB=5193`, para não pegar a porta de outra sessão.

## GGVP-93 · Roteiro de conteúdo mínimo por benefício

### Telas e rotas

| Rota | Figma | O que faz |
|---|---|---|
| `/roteiros` | sem quadro próprio; visual das telas de passo | Lista dos roteiros, com os benefícios de cada um, a versão em vigor e "sem laudo" quando é régua documental |
| `/roteiros/:id` | sem quadro próprio; o roteiro aplicado aparece no Parecer médico `1654:2` e no step_D1.21M `14:195` | Itens por tipo (obrigatório, contradição que bloqueia, complementar) com o texto do escritório; "Editar" só para a sênior; "Salvar nova versão"; as versões anteriores com autor e data |

Quem não é do Jurídico não vê o roteiro: a tela diz que ele é do Jurídico e que o que falta pedir aparece no parecer.

### Contrato (vai para `packages/contratos/roteiros.ts`)

```ts
export const TipoDoItem = z.enum(['obrigatorio', 'contradicao', 'complementar'])
export const ItemDoRoteiro = z.object({
  id: z.string(),
  tipo: TipoDoItem,
  texto: z.string().trim().min(3).max(300),
  pergunta: z.string().trim().max(300).optional(),   // como o item vira pergunta ao médico (GGVP-29, G20)
})
export const VersaoDoRoteiro = z.object({ versao: z.number().int().positive(), autor: z.string(), quando: z.string(), itens: z.array(ItemDoRoteiro).min(1) })
export const Roteiro = z.object({
  id: z.string(), nome: z.string(),
  beneficios: z.array(z.enum(BENEFICIOS)).min(1),
  laudo: z.boolean(),                                 // false: régua documental, sem laudo
  versoes: z.array(VersaoDoRoteiro).min(1),           // a última é a que vale
})
export const EdicaoDoRoteiro = z.object({ itens: z.array(ItemDoRoteiro).min(1) })   // pelo menos um obrigatório
```

| Endpoint (quando ligar no servidor) | Entrada | Saída | Função de exemplo |
|---|---|---|---|
| `GET /api/roteiros` | | `Roteiro[]` | `obterRoteiros` |
| `GET /api/roteiros/:id` | | `Roteiro` | `obterRoteiro` |
| `POST /api/roteiros/:id/versoes` | `EdicaoDoRoteiro` | `Roteiro` | `salvarRoteiro` |

### Campos

| Campo | Regra |
|---|---|
| Tipo do item | lista fixa: obrigatório, contradição que bloqueia, complementar |
| Texto do item | texto, obrigatório, de 3 a 300 letras |
| Pergunta ao médico | texto, até 300 letras; checada pela regra do G20 na GGVP-29 |

Nenhum campo da biblioteca `campos` (não há CPF, data nem número aqui). O servidor de exemplo valida de novo com `motivoParaNaoSalvar`.

### Decisões da história

1. **A semente** vem da matriz de `docs/requisitos/roteiro-laudos.md` (PDF do escritório, 26/09) para os cinco benefícios com laudo, e da resposta do Lucas de 01/10 (Q18) para LOAS Idoso (socioeconômico), aposentadorias comuns e especial (régua documental, sem laudo), Curatela e Isenção de IR. A checagem de gastos entra também no LOAS Deficiente, como complementar (Lucas, 01/10).
2. **Um roteiro, vários benefícios.** A Aposentadoria PCD vale por contribuição e por idade; a Incapacidade Permanente, também para a acidentária. Benefício fora de todo roteiro é "sem roteiro" (CA3).
3. **Versão.** Salvar cria a versão seguinte com autor e data; nada é sobrescrito. A análise e o parecer guardam o número da versão usada, e mostram essa, não a de agora (CA2, CA4).
4. **Pergunta ao médico** fica no item, para o sênior ajustar junto com a régua. A orientação ao médico (GGVP-29) é montada com elas.
5. **Frases-chave**: o texto do item é para reconhecer no documento se o requisito foi atendido, nunca para ditar ao médico (G20). Por isso a orientação usa a pergunta, não o texto do item.
