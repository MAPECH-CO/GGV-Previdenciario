# Design · GGVP-8 Via administrativa no INSS

Base: o modelo de dados da fundação (`caso`, `etapa`, `tarefa`, `decisao`, `documento`, `requerimento_inss`, `pericia`, `credencial_govbr`, `evento_auditoria`) e a matriz de permissões de `@ggv/contratos`.

## Grupo 1 · GGVP-27 e GGVP-31

### Contratos (`packages/contratos`)

| Contrato | Uso |
|---|---|
| `TarefaDaCentral` | `GET /api/tarefas`: tarefas abertas do perfil ativo (id, caso, cliente, passo, título, detalhe, prazo, urgente) |
| `CasoParaProtocolo` | `GET /api/casos/:id/protocolo`: cliente, benefício, OK da Sênior (quem e quando), documentos na ordem (só tipo e nome, nunca o conteúdo) e se há senha no cofre |
| `RegistrarProtocolo` | `POST /api/casos/:id/protocolo` (multipart): número do requerimento, DER (`dd/mm/aaaa` por `validarData` e `dataParaIso` de `@ggv/campos`), "Revisei o requerimento antes de enviar" (precisa ser `true`) e o comprovante (PDF ou imagem) |
| `SenhaDoCofre` | `POST /api/casos/:id/cofre`: a senha e por quantos segundos a tela pode mostrá-la (60) |
| `DecidirPericia` | `POST /api/casos/:id/pericia`: `precisa` (sim ou não) e, se sim, `tipos` (perícia médica, avaliação social ou as duas; ao menos um) |

### Campos de formulário

| Campo | Função de `@ggv/campos` |
|---|---|
| Número do requerimento | `somenteDigitos` (só número) |
| DER | `validarData`, `dataParaIso` |

### Servidor

- `exigir('protocolo_inss.registrar')` nas rotas do protocolo e do cofre; `exigir('pericia.decidir')` na decisão (ação nova na matriz, versão 2: advogada).
- G2: o protocolo só é aceito com a última decisão `D2.01 · aprovacao_inss` do caso = `aprovado`. A fila do Jurídico administrativo só traz esses casos (CA5).
- G9: a senha é decifrada (AES-256-GCM, chave `COFRE_CHAVE` do ambiente; sem chave em produção, a API não sobe) e o uso vai para o histórico (quem, quando, caso).
- Comprovante: `documento` com hash SHA-256; o arquivo vai para o armazenamento (Supabase Storage, bucket privado `documentos`, quando há `SUPABASE_URL` e a chave de serviço; senão, a pasta local `apps/api/.arquivos-local`).
- Junção do D2 ("protocolo feito e perícia resolvida ou sem perícia"): uma função só, chamada depois do protocolo, da decisão de perícia e do resultado da perícia; quando fecha, abre a etapa `D2.04` aguardando o INSS. Teste para as quatro combinações.
- Decisão de perícia: grava `decisao` (`D2.03`, autora e horário) e, se precisa, uma `pericia` por tipo e a tarefa `DP.01` para o Jurídico administrativo, aberta pelo sistema (ninguém tem a ação `pericia.abrir_tarefa`).

### Tela

- Central do Jurídico administrativo e da advogada: a fila vem de `GET /api/tarefas` (a mesma linha de tarefa do Atendimento).
- Protocolar no Meu INSS (`/casos/:id/protocolo`) e Decidir perícia (`/casos/:id/pericia`), dentro de `<Exige>`.

### Dados de exemplo

O banco local ganha casos de exemplo, marcados como exemplo: um caso aprovado pela Sênior, com documentos, senha no cofre e as tarefas de protocolar e de decidir perícia.

### Dependências novas e por quê

- `@fastify/multipart`: receber o comprovante do protocolo na mesma requisição dos campos.
