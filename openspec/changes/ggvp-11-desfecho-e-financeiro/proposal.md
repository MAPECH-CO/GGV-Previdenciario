GGVP-11 · Desfecho e financeiro · histórias: GGVP-98 (agora); GGVP-22 e GGVP-19 depois.

## Por quê

O caso ganho ainda não fecha: depois do OK da advogada na prestação, o Financeiro recebe, mas falta quem avisa o cliente, marca a ida ao banco, confirma o recebimento e grava o caso no acervo. O Lucas respondeu em 06/10 que esse trabalho é do Financeiro (liga, explica o recebimento, marca a ida ao banco e põe no calendário) e que o Atendimento leva o cliente ao banco. O caminho é o mesmo para o deferido no INSS (GGVP-44, já pronto) e para o procedente na Justiça: uma regra só para os dois (decisão do Mateus, 07/10).

Branch empilhada na Garantia (`feat/GGVP-13-garantia-e-governanca`), porque a `main` ainda não tem o servidor; o PR deste épico aponta para ela.

## Histórias na ordem

1. **GGVP-98** · Financeiro recebe e cliente é avisado · Financeiro e Atendimento.
2. **GGVP-22** · Explicar o resultado ao cliente · Atendimento e advogada (o resumo escrito e aprovado pelo Jurídico; a IA só sugere quando voltar).
3. **GGVP-19** · Estudo de caso do processo perdido · Sênior (depende da IA, estacionada até 09/10).

## Travadas

- **GGVP-90** · Procedente: acompanhar o pagamento: em "Em análise" com o Lucas.
- **GGVP-92** · Prestação de contas montada pela IA e OK da advogada: com o Lucas, duas dúvidas abertas. Até ela, a prestação nasce só do deferimento no INSS; a do procedente na Justiça entra com ela e já cai no caminho desta change.
- **GGVP-100** · Improcedente: decidir se recorre: com o Lucas.

## Fora do escopo

- Envio real pelo Chatwoot: o portal registra o envio revisado por pessoa, como na GGVP-44.
- A tela da Agenda: a ida ao banco vira tarefa de quem acompanha, com a data; a Agenda (tela do Pedro) lê dali quando ligar.
- IA (GGVP-14): sem ela, nada é gerado sozinho.

## Portões envolvidos

- **G8**: o aviso ao cliente só sai depois do OK da advogada na prestação.
- Quem dá o OK não registra o recebimento (GGVP-96 CA16): o banco recusa, e o servidor recusa antes e registra a tentativa.
