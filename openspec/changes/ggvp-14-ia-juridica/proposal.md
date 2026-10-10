GGVP-14 · IA jurídica e knowledge graph · histórias: GGVP-106, GGVP-110 e as da IA nas telas (abaixo), inclusive GGVP-38, GGVP-45 e GGVP-19; depois GGVP-41.

## Por quê

A IA estava estacionada até 09/10. Em 07/10 o Mateus decidiu ligar: a OpenAI sugere (texto, classificação, resumo) e a Mistral lê documento (OCR de PDF e foto). As chaves ficam só no ambiente (`.env.ia` local e Coolify). Antes de qualquer função usar a IA, vem a plataforma que garante as regras do projeto: a IA sugere, a pessoa decide, cada chamada fica registrada, e sem chave nada trava.

Branch empilhada na Garantia (`feat/GGVP-13-garantia-e-governanca`, PR #18), que tem a matriz de permissões e o registro de bloqueios.

## Histórias na ordem

1. **GGVP-106** · Guardrails de IA e do chat: a IA sugere, a pessoa confirma, tudo registrado · sistema.
2. **GGVP-110** · Conteúdo malicioso não manipula a IA · sistema.
3. **GGVP-41** · Medir ganho e perda e gravar no acervo · Sênior. A parte 1 (Mateus, 08/10), item 14 abaixo. A **GGVP-38** e a **GGVP-45**, antes previstas para depois, entraram neste pedido (itens 8 e 13 abaixo).

## Autorização do escritório (07/10)

O Mateus informou em 07/10 que o escritório (Lucas, dono e PO) autoriza o uso da IA no sistema inteiro, inclusive com dado de saúde (laudo, receita, parecer). A plataforma continua exigindo `IA_PERMITE_DADO_DE_SAUDE=sim` no ambiente (`.env.ia` e Coolify), para a autorização ficar explícita e poder ser desligada. Não precisa de registro no Jira (Mateus, 07/10).

## A IA no que já existe (depois da plataforma)

Cada integração completa a parte de IA que a história deixou para este épico, com a spec dela nesta change:

4. **GGVP-34 e GGVP-74** · Ler a publicação: a IA sugere a classe, os dias de prazo escritos na decisão e um resumo; a advogada confirma ou troca.
5. **GGVP-63** · Pedir a petição: a IA escreve a versão 1, com as fontes; a advogada confere e assina (G6).
6. **GGVP-22** · Explicar o resultado: a IA sugere o resumo para o cliente; o Jurídico completa e aprova.
7. **GGVP-131** · Chance de êxito do caso: recorte a combinar, depende de o acervo ter dados.

## A IA que o BPMN pede e ainda faltava (07/10, Miro com as histórias)

8. **GGVP-45** · Buscar no acervo antes de escrever: busca por texto no PostgreSQL sobre petições aprovadas, decisões de mérito, motivos de indeferimento e modelos, sem dado pessoal de outro cliente; entra na minuta e na análise do indeferimento.
9. **GGVP-54** (parte de IA) · A IA analisa o motivo do indeferimento e sugere o que falta; a Sênior despacha (G4).
10. **GGVP-67** (parte de IA) · Conferir a petição: "Não está boa" pede outra versão à IA com o que mudar; a advogada revisa e salva a versão seguinte.
11. **GGVP-79** (parte de IA) · Exigência do juiz: a IA lê a publicação com o caso e sugere "só ciência" ou os itens por setor; a advogada decide (G5).
12. **GGVP-19** (épico Desfecho, aqui porque depende desta plataforma) · Estudo de caso do processo perdido: automático depois do resultado negativo, numa tela de estudos; tarefa da Sênior só quando indica novo processo (Lucas, 06/10).
13. **GGVP-38** · Recomendação sobre a perícia: pronta para a advogada antes de marcar (o que levar, pontos fortes e fracos; na perícia do juiz, quesitos e assistente técnico); sem a jurimetria do perito, que espera a GGVP-59.
14. **GGVP-41** (parte 1) · Medir ganho e perda: cada desfecho do portal entra no acervo com a ficha da IA (matéria, vara, tese, resumo e lição, sem dado pessoal); o perdido entra pelo estudo de caso; a Sênior confere a ficha e a tese; a Gestão ganha o recorte por tese (CA1, CA3 a CA7, CA9 a CA11).
15. **GGVP-153** (conferência da jurimetria, 09/10) · Pergunta de um clique para juiz, vara e tese: na conferência do acervo, a Sênior completa o que falta, com as opções que o portal já conhece; o caso volta ao recorte, e nada trava.
16. **GGVP-154** (conferência da jurimetria, 09/10) · O acervo aprende com toda publicação classificada por pessoa; o documento do Drive entra quando a leitura de documentos existir (GGVP-95, GGVP-81).

## A sugestão chega pronta (Mateus, 07/10)

Em toda tarefa com IA, a sugestão já aparece quando a pessoa abre, preenchendo o formulário para ela conferir e confirmar; nada de botão para pedir. O sistema prepara em segundo plano e guarda pelo conteúdo. Botão só para pedir algo novo: outra versão da petição, ou a minuta de novo depois de mudar o pedido.

## Fora do escopo

- O chat que executa ações (cards de confirmação): fora até 09/10 pelo plano de entrega; o chat só consulta.
- A IA nas telas do Pedro (leitura do laudo, sugestão do benefício, comprovante da perícia): entram quando ele ligar essas telas no servidor (GGVP-125, GGVP-132), sobre esta plataforma.
- Google Drive (GGVP-107).
- **GGVP-41, a parte 2:** o perdido na Justiça registrado pelo portal (GGVP-100, travada pela Q26); a vara pelo nome (GGVP-64, parte 2); a lição no acervo de trechos (GGVP-141, PR #11).
