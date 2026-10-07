# Design · GGVP-14 IA jurídica

## GGVP-106 · Guardrails de IA e do chat

### Context

O banco já separa a sugestão da IA da decisão da pessoa (`decisao.sugestao_ia`, `parecer_medico.sugestao_ia`, `publicacao.classe_sugerida_ia`), e todo portão é validado no servidor sobre a ação de uma pessoa (GGVP-109). Falta o lugar único por onde passa toda chamada à IA: quem chama, com que finalidade, o que voltou, e o registro para auditoria.

### Decisions

1. **Um módulo só** (`apps/api/src/ia/`), com duas portas: `sugerir` (OpenAI, Chat Completions) e `lerDocumento` (Mistral OCR). Chamada por `fetch` do Node, sem dependência nova. O `fetch` entra como parâmetro, e os testes nunca chamam o serviço de verdade.
2. **Sem chave, IA desligada:** `OPENAI_API_KEY` e `MISTRAL_API_KEY` vêm do ambiente (`.env.ia` local, que o `pnpm dev` da API passa a ler, e Coolify). Sem chave, ou com o serviço fora do ar, a função devolve "sem sugestão" e grava a tentativa; a tela segue manual e nada trava.
3. **Modelo configurável:** `OPENAI_MODELO` (padrão `gpt-4.1-mini`) e `MISTRAL_MODELO_OCR` (padrão `mistral-ocr-latest`). O modelo e a versão da instrução vão no registro (CA4).
4. **A IA só sugere** (CA1, CA2): o módulo não grava decisão, tarefa nem estado de caso; devolve uma `SugestaoDaIa` (marcada como sugestão, com as fontes, o modelo e o id da chamada). Quem grava a decisão é a rota da pessoa, com o perfil da sessão, como já é hoje.
5. **Registro de toda chamada** (CA4): tabela nova `chamada_ia` (migração 0013, RLS ligado): finalidade, fornecedor, modelo, versão da instrução, caso, quem pediu, entrada resumida (tamanho e hash, nunca o conteúdo), fontes, saída, situação (`ok`, `desligada`, `falhou`, `recusada`), erro e duração. A saída pode ter dado de saúde: a auditoria (`GET /api/casos/:id/ia`) mostra a saída só a quem tem `dado_saude.ver_detalhe` e grava o acesso em `acesso_dado_sensivel`.
6. **Dado de saúde só com autorização** (pergunta ao Lucas): cada finalidade diz se leva dado de saúde; documento com `sensivel = true` também. Enquanto `IA_PERMITE_DADO_DE_SAUDE` não for `sim` no ambiente, o módulo recusa (situação `recusada`) sem chamar o serviço.
7. **Números vêm de código** (CA11): a instrução de sistema de toda finalidade manda a IA não calcular e usar só os números que o sistema passa, com o número de casos ao lado (G22). O teste confere a instrução.
8. **Conteúdo de fora é dado, não ordem:** o texto do documento ou da publicação vai num bloco marcado como conteúdo, separado da instrução. A defesa completa e os testes de injeção são da GGVP-110 (CA12).

### O que fica com cada função (critérios do cartão)

- CA3 (versões da peça): `peticao_versao`, já na Judicialização; a minuta da IA grava a versão com quem pediu quando ligar.
- CA5 (benefício na entrevista), CA6 (laudo novo, G20 e G17) e CA7 (comprovante da perícia): entram nas histórias dessas telas, sobre `sugerir` e `lerDocumento`.
- CA8, CA9, CA10 e CA13 (cards do chat que executa): fora até 09/10; o chat só consulta.

### Contratos (`packages/contratos/src/ia.ts`)

- `SugestaoDaIa`: `{ chamadaId, sugestao: true, texto, fontes: { tipo, referencia, trecho? }[], modelo, geradaEm }`.
- `ChamadaDaIa` (auditoria): `{ id, finalidade, fornecedor, modelo, situacao, quem, quando, fontes, saida | null }`.
