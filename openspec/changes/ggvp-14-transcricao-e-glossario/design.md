# Design · GGVP-14 Transcrição e glossário

## GGVP-143 · Glossário do escritório

### Context

A Configuração do escritório (GGVP-104) já tem limites, kits e mensagens numa tela só, com o histórico da configuração no fim (eventos com alvo `configuracao`). O portal já conhece peritos (`perito`) e juízos (`juizo`) pelas tabelas da jurimetria. O catálogo de benefícios é `ROTULO_BENEFICIO`, em `packages/contratos`.

### Decisões

- **Tela:** o Figma não tem tela do glossário de termos (o "Glossário" de lá é o dos códigos do BPMN e dos portões). A seção "Glossário do escritório" segue o padrão das outras seções da Configuração: lista por tipo, formulário para acrescentar, "Corrigir" e "Tirar" em cada termo.
- **Quem:** ver com `gestao.ver`, como a página. Mudar só com `glossario.editar`, só a Sênior (matriz versão 16).
- **Histórico:** cada mudança grava, na mesma transação, um evento com alvo `configuracao` (`glossario_termo_acrescentado`, `glossario_termo_corrigido`, `glossario_termo_tirado`), com o antes e o depois. Aparece no "Histórico da configuração", descrito em `descrever` de `rotas/configuracao.ts`.
- **Tirar:** apaga a linha; o termo fica no histórico (antes). Termo repetido (sem diferença de maiúscula) é recusado pelo banco (índice único em `lower(termo)`) e pela rota (409).
- **Semente (CA3):** dentro da migração que cria a tabela, uma vez só: os rótulos de `ROTULO_BENEFICIO` (menos "Outro"), as oito siglas com o significado e os nomes de `perito` e `juizo`. Depois disso, termo novo é com a Sênior. O teste confere que os benefícios da semente são os do catálogo.
- **Leitura (CA2):** `termosDoGlossario(banco)`, em `apps/api/src/fluxo/glossario.ts`, devolve `{ termo, tipo, significado }`. A transcrição (GGVP-133) e o motor de IA usam esta função.

### Contratos (`packages/contratos/src/glossario.ts`)

- `TIPOS_DE_TERMO`: `beneficio`, `sigla`, `perito`, `juizo`, `outro`; `ROTULO_TIPO_DE_TERMO`.
- `TermoDoGlossario`: `{ id, termo, tipo, significado | null }`.
- `SalvarTermo` (POST e PUT): `termo`, `tipo`, `significado` opcional.
- `GlossarioDoEscritorio` (GET): `{ termos, podeEditar }`.

### Campos do formulário

| Campo | Função de `campos` | Regra no contrato |
|---|---|---|
| Termo | `normalizarNome` (tira espaço duplo e das pontas) | texto livre de 2 a 120 caracteres: sigla, nome de vara com número ("2ª Vara") e benefício com barra não cabem em `validarNome` |
| Tipo | nenhuma: lista fechada | `z.enum(TIPOS_DE_TERMO)` |
| Significado | `normalizarNome` | opcional, até 300 caracteres |

### Endpoints

| Método e caminho | Permissão | Entrada | Saída |
|---|---|---|---|
| GET `/api/configuracao/glossario` | `gestao.ver` | nada | `GlossarioDoEscritorio` |
| POST `/api/configuracao/glossario` | `glossario.editar` | `SalvarTermo` | 201 `{ ok, id }`; 409 termo repetido |
| PUT `/api/configuracao/glossario/:id` | `glossario.editar` | `SalvarTermo` | 201 `{ ok }`; 404; 409 |
| DELETE `/api/configuracao/glossario/:id` | `glossario.editar` | nada | 200 `{ ok }`; 404 |

### Banco

Tabela `glossario_termo`: `id`, `termo`, `tipo` (lista fechada), `significado`, `alterado_por`, `criado_em`, `atualizado_em`; RLS ligado; índice único em `lower(termo)`. A migração e a versão da matriz são geradas de novo no fim do grupo, sobre a main mais nova (quem entra depois renumera).
