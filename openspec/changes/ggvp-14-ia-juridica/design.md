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

## GGVP-45 · Buscar no acervo antes de escrever

### Decisions
- **Busca por texto no PostgreSQL, sem tabela nova.** `buscarNoAcervo` (`apps/api/src/ia/acervo.ts`) junta, numa consulta, petições aprovadas, decisões de mérito publicadas e motivos de indeferimento de outros casos (mesmo benefício quando o caso tem) e os modelos de petição ativos; ordena por `ts_rank` com `to_tsvector('portuguese')` contra as palavras do pedido (OU entre elas) e devolve até 3. Calculado na hora, sem índice: o acervo é pequeno. Índice GIN ou embeddings (pgvector) quando o volume ou a qualidade pedirem.
- **Só o que uma pessoa aprovou ou registrou.** Versão não aprovada, rascunho da IA e publicação sem classe não entram.
- **Anonimizar antes de sair do banco.** CPF, CEP, telefone, e-mail, endereço e o nome do cliente de origem viram marcadores; o trecho tem até 400 caracteres.
- **A fonte diz a origem.** `tipo: 'acervo'`, `referencia: 'caso:<id>'` (ou `modelo:<id>`), `trecho: '<de onde>: <texto>'`.

## GGVP-54 · A IA analisa o motivo do indeferimento

### Decisions
- Finalidade `analisar_indeferimento` (JSON, leva dado de saúde, não barra CID: é leitura interna da Sênior). Saída validada por `AnaliseDoIndeferimentoPelaIa`; fora do formato, sem sugestão.
- A análise é pedida pelo botão na tela da Sênior. "Usar a sugestão" preenche o formulário; o prazo continua pergunta da Sênior.
- `Despachar` aceita `chamadaIaId`; o despacho grava `decisao.sugestao_ia = { chamadaId }` (a saída completa está em `chamada_ia`).

## GGVP-67 · A IA faz outra versão da petição

### Decisions
- A IA não grava versão: a sugestão cai na caixa de "Editar eu mesma" e a rota de versões que já existe grava (com o tratamento do CA7 depois da aprovação). Uma rota de gravação só, um caminho para a versão nova.
- Finalidade `nova_versao_peticao`: recebe a última versão e o pedido; mantém o resto do texto; mesmas regras da minuta (não inventar, sem organização interna, sem número de jurimetria). Leva dado de saúde e não barra CID (a peça cita o CID do laudo do caso).
- A marca fica em `peticao_versao.gerada_por` ("<nome> · versão da IA"), como na versão 1 da minuta; a chamada vai para o histórico da versão nova (`chamadaIa`).
