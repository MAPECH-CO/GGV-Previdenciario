# GGVP-94 · Tarefa com laço, lembrete e escalonamento

> Candidata a história, diagrama **Histórias transversais**. Cartão no Jira: [GGVP-94](https://mapech.atlassian.net/browse/GGVP-94), rótulo `a-validar-bpmn`. Chave provisória original: GGVP-94. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** sênior\
**quero** que toda tarefa de cobrança, contato ou remarcação lembre a equipe em intervalos e suba para mim quando passar do limite\
**para** que nenhum caso fique parado em silêncio esperando o cliente.

**Passo BPMN:** D1.23, D2.05, D3.04, D3a.03, DP.02, DP.07 · **Épico:** Tarefas · **Prioridade do PO:** 1 · **Estimativa:** M\
**Perfil:** sênior

## Critérios de aceite
1. **Dado** uma tarefa de cobrança criada, **quando** o intervalo configurado passa sem conclusão, **então** o responsável recebe um lembrete e a tentativa conta no card.
2. **Dado** uma tarefa que atingiu o limite de tentativas, **quando** a última tentativa falha, **então** a tarefa aparece na fila da sênior (ou da advogada responsável, na perícia) com o histórico das tentativas.
3. **Dado** que a pessoa registra cada tentativa, **quando** abro a tarefa, **então** vejo data, canal e resultado de cada uma.
4. **Dado** vários setores acionados no mesmo caso, **quando** um sobe o card e outro não, **então** o caso continua esperando e mostra quem falta (a "espera os setores acionados" do BPMN).

## Fora do escopo desta história
- A definir no refinamento.

## Dados e permissões
- Quem usa: sênior. Quem vê e quem edita: a definir no refinamento, conforme `docs/requisitos/perfis.md`.

## Portões de governança
- Nenhum portão direto.

## Tela ou referência
- Figma: a desenhar, no arquivo do perfil "sênior".

## Dúvidas abertas (bloqueiam a DoR)
- Os limites e intervalos estão "a definir" no board (`docs/requisitos/duvidas-abertas.md`).
- Q1: Limites e intervalos de cobrança, contato e remarcação ("a definir")

## Dúvidas respondidas pelo PO
- Ajuste de 29/09/2026 (Lucas): na perícia, a remarcação é do Jurídico administrativo e, passado o limite, sobe para a advogada responsável.
