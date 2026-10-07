# Design · GGVP-13 Garantia e governança

## Grupo 1 · GGVP-109 e GGVP-25

### Context

Cada portão já recusa no servidor, no passo dele: G2 no protocolo do INSS, G1 e G17 na conferência da Sênior, G21 na resposta ao INSS e na manifestação, G6 e G7 nos protocolos da Justiça, G8 no aviso da ida ao banco, e a espera dos setores no pedido da petição. A trava por perfil (`exigir`) recusa e grava `acesso_negado`. O registro das recusas, porém, é desigual: umas gravam evento, outras não, e nenhuma tela mostra as tentativas à gestão. As regras numéricas do roteiro (`docs/requisitos/roteiro-laudos.md`) ainda não existem em código.

### Goals / Non-Goals

- Toda recusa de portão grava o mesmo formato no histórico (`evento_auditoria`): quem, quando, `caso:<id>`, `detalhe.portao` e `detalhe.passo`. A gestão lista as tentativas.
- Os botões principais com item de conferência obrigatório ficam desabilitados até a marcação.
- As quatro regras do roteiro em código puro, versionadas, com teste, atrás de um endpoint que as telas médicas do Pedro chamam.
- Fora: a liberação ao Jurídico (D1.24, épico do Pedro) e o chat com ação (não entra até 09/10). A liberação usa o mesmo formato de registro quando entrar.

### Decisions

1. **Sem tabela nova para as tentativas.** Elas já vão para `evento_auditoria`. A recusa que já tinha evento (`protocolo_recusado_sem_ok`, `conferencia_recusada`, `protocolo_bloqueado`, `pacote_divergente`) ganha `portao` e `passo` no `detalhe`. A que não tinha grava `portao_bloqueado`. A lista da gestão lê os eventos com `detalhe.portao` mais os `acesso_negado`.
2. **Nada de dado de saúde no registro.** O `detalhe` leva o código do portão, o passo e contagens (por exemplo, quantos itens sem prova), nunca a descrição do item.
3. **`acesso_negado` passa a levar o caso** quando a rota é `/api/casos/:id/...`, para a gestão ver em que caso foi.
4. **Regras como funções puras** em `apps/api/src/fluxo/regras.ts`, como o prazo judicial: `hoje` entra como parâmetro, e o mesmo insumo dá o mesmo resultado (CA8). Cada regra tem `versao` e `fundamento`. Mudou a regra, sobe a versão. O resultado devolve as entradas usadas e a versão; quem guarda o resultado no caso (o parecer e a perícia do Pedro) guarda a versão junto.
5. **Sem permissão nova.** O endpoint das regras usa `laudo.conferir`: as regras servem a quem confere a documentação médica. A matriz continua na versão 8, sem conflito com o Pedro.
6. **Valores das regras explícitos e com a lei citada:** 24 meses (LOAS, Lei 8.742, art. 20, §10); mais de 15 dias e janela de 60 dias (Decreto 3.048, art. 75, §§ 4º e 5º); carência de 12 contribuições, metade (6) depois de perder a qualidade e isenção marcada pela advogada (Lei 8.213, arts. 25, I; 26, II; 27-A); qualidade por 12 meses, mais 12 com mais de 120 contribuições sem perda e mais 12 com desemprego comprovado, até o dia 15 do segundo mês depois do fim da graça (Lei 8.213, art. 15; Decreto 3.048, art. 14).

### Contratos (`packages/contratos`, arquivo novo `governanca.ts`)

- `TentativaBloqueada` e `TentativasBloqueadas` (GET `/api/gestao/tentativas`, `gestao.ver`).
- `REGRAS`, `EntradaLoas24`, `EntradaIncapacidade`, `EntradaPcd`, `EntradaDii` e `ResultadoDaRegra` (POST `/api/regras/:regra`, `laudo.conferir`).

### Campos de formulário

Não há formulário novo neste grupo. As datas de entrada das regras usam `validarData` e `dataParaIso` de `campos`, para a tela médica que chamar o endpoint. As competências das contribuições vêm no formato `mm/aaaa`.

### Telas

- "Tentativas bloqueadas" (`/gestao/tentativas`), com quando, quem, caso, portão e passo. O link fica no topo da Central, só para quem tem `gestao.ver`.
- Protocolo no INSS, manifestação e prestação de contas: o botão principal fica desabilitado até a caixa de conferência obrigatória.

### Risks / Trade-offs

- A carência e a qualidade de segurado são a leitura da lei, e o Lucas confere na homologação. Os valores ficam como constantes nomeadas, com o artigo ao lado.
- A lista da gestão lê até 200 eventos, os mais recentes. Paginação só quando a gestão pedir.

## Grupo 2 · GGVP-94 e GGVP-68

### Context

Os laços de cobrança já existem nos passos do portal: a exigência do juiz (D3a.03) e as pendências do despacho (D3.04), com o mesmo código (`LACOS`), e a cobrança da exigência do INSS (D2.05). Cada tentativa grava data, canal e resultado, o limite vem da configuração, o card mostra o próximo lembrete, e no limite a tarefa sobe para a Sênior. O lembrete é a própria tarefa na Central, na data do próximo lembrete. Os alertas da exigência a 5 e 2 dias úteis já aparecem na fila da Sênior (GGVP-39 CA14). Faltam o intervalo em dias úteis com a compressão pelo prazo, o lembrete descrito no card, a decisão da Sênior quando o laço passa do limite, o alerta ao líder do administrativo, o status de cada setor com o acionamento e a última tentativa, e o item ligado à peça.

### Decisions

1. **Lembrete sem tabela nova.** Ele continua sendo a tarefa na Central (canal "Central de tarefas"). A função pura `proximoLembrete(hoje, intervalo, prazo, restantes, feriados)` em `fluxo/exigencia.ts` conta dias úteis com os feriados nacionais. Sem prazo de fora, o intervalo é o da configuração (`cobranca.intervalo_dias`, 3 dias úteis, Lucas 02/10). Com prazo, as tentativas que faltam se comprimem para caber antes dele, com pelo menos 1 dia útil, e o lembrete nunca passa do prazo.
2. **O card descreve o lembrete** (CA11): gatilho (intervalo sem retorno), destinatário (o setor), canal (Central de tarefas), modelo (o título da tarefa) e a data.
3. **Decisão da Sênior no laço que subiu** (CA8 a CA10): o texto "O que o setor deve fazer" é obrigatório, porque as opções do Figma seguem em aberto (Q1). A decisão grava uma linha em `decisao` e entra no histórico do laço como uma tentativa com canal `decisao_senior`. Depois zera a contagem, tira a escalada, marca o próximo lembrete e fecha a tarefa da Sênior quando não sobra item escalado no laço. As permissões são as da Sênior que já existem: `exigencia_juiz.autorizar_dilacao` (juízo), `caso.despachar_indeferimento` (despacho) e `exigencia_inss.decidir_vencida` (INSS). A matriz fica na versão 8.
4. **CA12:** o portal não envia nada sozinho, então não há falha de envio nem reenvio. Quando houver canal de fora, a falha vira tarefa do Atendimento.
5. **GGVP-68 CA4:** os alertas da exigência vão também para o "Atendimento · líder" (Lucas, 02/10), com o mesmo topo da fila a 2 dias úteis. O alerta abre a tela da exigência (`caso.ver`), onde está o item com o histórico (CA15).
6. **CA14 e CA5:** cada item da exigência traz a data do acionamento (a criação da tarefa do setor), a última tentativa e, depois do protocolo, a peça que o cumpriu (a manifestação protocolada, com a versão e a data).

### Contratos

- `DecidirLaco` (`oQueFazer`, obrigatório) para POST `/api/casos/:id/{exigencia-juiz|pendencias}/itens/:item/decisao` e POST `/api/casos/:id/exigencia/cobrancas/decisao`.
- `Lembrete` (gatilho, destinatário, canal, modelo, data) nos itens de `ItensDoSetor` e no card da exigência do INSS.
- `ExigenciaDoJuiz.itens[]` ganha `acionadoEm` e `ultimaTentativa`; `ExigenciaDoJuiz` ganha `peca` (versão e data do protocolo); `Despacho.setores[]` ganha `acionadoEm` e `ultimaTentativa`.

### Campos de formulário

- "O que o setor deve fazer": texto livre, obrigatório, validado pelo contrato. Não há CPF, data nem número.

### Risks / Trade-offs

- Mudar o intervalo para dias úteis muda as datas de lembrete das histórias da Judicialização. Os testes delas passam a contar dias úteis.

## Grupo 3 · GGVP-99, GGVP-103 e GGVP-104

### Context

O histórico (`evento_auditoria`) já recebe os eventos de cada passo, e o banco já recusa alterar ou apagar a tabela (trava da fundação, com teste). As decisões de pessoa ficam em `decisao`. O cofre do gov.br já cifra a senha (AES-256-GCM, chave em `COFRE_CHAVE`) e já revela por 60 segundos com a senha do portal (GGVP-27). Faltam a linha do processo, a recusa pela API, a exportação autorizada, o relatório de prazos, o cadastro pelo cofre, a trava de uso por tarefa, o relatório e o alerta do cofre, a guarda de 1 ano e a configuração do escritório.

### Decisions

1. **A linha do processo (GGVP-99 CA7, CA11)** junta, em ordem cronológica, os eventos do caso (`alvo = caso:<id>`) e as decisões. A descrição vem de um mapa de ação para texto. O `detalhe` não sai na tela, porque pode ter códigos internos, e a linha não leva dado de saúde.
2. **A recusa pela API (CA9):** PUT, PATCH e DELETE em `/api/casos/:id/historico` e em `/api/casos/:id/historico/:evento` respondem 403 e gravam `historico_alteracao_recusada`. Não há ação na matriz para isso.
3. **A exportação (CA12, Lucas 01/10):** a gestão pede com o motivo, e a direção (o Sócio, ação nova `historico.autorizar_exportacao`) autoriza pela tarefa "Autorizar exportação do histórico". Autorizada, quem pediu baixa a trilha (JSON). O estado sai dos próprios eventos: `exportacao_pedida`, `exportacao_autorizada` e `historico_exportado`.
4. **O relatório de prazos (CA14)** lê os eventos de cumprimento (`exigencia_inss_respondida`, `manifestacao_protocolada`) e de perda (`exigencia_perdida`, `exigencia_juiz_perdida`), para a gestão.
5. **O cofre:** a ação nova `cofre.cadastrar` (Atendimento, líder e Jurídico) cadastra e troca a senha por POST `/api/pessoas/:id/cofre`. Revelar exige tarefa aberta de gov.br no caso: protocolar no Meu INSS (D2.02) ou marcar a perícia (DP.01, DP.02). Cada ação grava quem, o caso, o motivo e nunca o valor. O relatório de usos por pessoa fica em GET `/api/gestao/cofre`. O alerta (leituras no dia acima do limite, ou fora do horário) vira tarefa da Sênior, uma por pessoa por dia; os limites estão em `cofre.alerta.leituras_por_dia` e `cofre.alerta.horario`. A guarda de 1 ano é a função `apagarSenhasVencidas`, que roda uma vez por dia no relógio do servidor.
6. **Matriz na versão 9:** `cofre.cadastrar` e `historico.autorizar_exportacao`. O Pedro precisa saber, por causa do número da versão.

### Contratos (`packages/contratos/src/governanca.ts`)

- `EventoDoHistorico`, `HistoricoDoCaso` (com o estado da exportação), `PedirExportacao` (`motivo`) e `PrazosDoEscritorio`.
- `CadastrarSenhaGovbr` (`senha`, obrigatória) e `UsoDoCofre` (por pessoa: leituras, cadastros e trocas, recusas e o último uso).

### Campos de formulário

- Senha do gov.br: campo de senha, sem `autocomplete`, que vai direto ao cofre. Não é campo de texto da ficha.
- Motivo da exportação: texto obrigatório.

### Configuração do escritório (GGVP-104)

1. **Uma tela, três partes:** limites e parâmetros (a tabela `configuracao`), kits por benefício (`kit_documento`, o checklist do G1) e mensagens padrão (`modelo`, tipo `mensagem`). Quem edita é a gestão do escritório (ação nova `configuracao.editar`: Sócio e Sênior, matriz versão 10). Quem tem `gestao.ver` vê.
2. **Parâmetros editáveis numa lista fechada**, cada um com o rótulo e a validação: `cobranca.limite` e `cobranca.intervalo_dias` (dias úteis), `contato.limite` e `contato.janela_dias` (cliente sumido), `pericia.remarcacao.limite` e os limites do cofre (`cofre.alerta.leituras_por_dia`, `cofre.alerta.horario`). Os valores do Lucas (02/10) entram nos dados de exemplo. Os laços de contato e de remarcação são de outros épicos, que leem a mesma chave.
3. **Kit com versão (CA1, CA6), migração 0012:** `kit_documento` ganha `versao`, `vigente_desde` e `revogado_em`, e o único passa a ser benefício, documento e versão. Publicar revoga a versão vigente e grava a seguinte. A conferência da Sênior lê a versão vigente quando o caso foi aberto (`caso.criado_em`). Assim o caso aberto fica com o kit da época sem coluna nova no caso.
4. **Histórico (CA3):** cada mudança grava `configuracao_alterada`, `kit_publicado` ou `mensagem_alterada`, com quem, o antes e o depois, alvo `configuracao`.
5. **Catálogo (CA5):** `BENEFICIOS` e `ROTULO_BENEFICIO` passam para `packages/contratos`. O banco (a trava `caso_beneficio`) e as telas leem dali.
6. **Fora (CA2, CA7 a CA10):** os modelos de contrato e a liberação ao Jurídico são do épico Abertura e documentação, e o ZapSign real não entra até 09/10.
