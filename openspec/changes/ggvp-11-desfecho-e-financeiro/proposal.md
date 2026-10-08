GGVP-11 · Desfecho e financeiro · histórias deste PR: GGVP-98 e GGVP-22. A GGVP-19 foi feita no PR da IA (#26). A GGVP-92 e a GGVP-100 ficam para o próximo PR do épico.

## Por quê

O caso ganho ainda não fecha: depois do OK da advogada na prestação, o Financeiro recebe, mas falta quem avisa o cliente, marca a ida ao banco, confirma o recebimento e grava o caso no acervo. O Lucas respondeu em 06/10 que esse trabalho é do Financeiro (liga, explica o recebimento, marca a ida ao banco e põe no calendário) e que o Atendimento leva o cliente ao banco. O caminho é o mesmo para o deferido no INSS (GGVP-44, já pronto) e para o procedente na Justiça: uma regra só para os dois (decisão do Mateus, 07/10).

A branch nasceu empilhada na Garantia (`feat/GGVP-13-garantia-e-governanca`), quando a `main` ainda não tinha o servidor. A Garantia (#18) entrou na `main` em 07/10. Desde 08/10, o PR deste épico aponta para a `main`.

## Histórias na ordem

1. **GGVP-98** · Financeiro recebe e cliente é avisado · Financeiro e Atendimento.
2. **GGVP-22** · Explicar o resultado ao cliente · Atendimento e advogada (o resumo escrito e aprovado pelo Jurídico; a IA só sugere quando voltar).
3. **GGVP-19** · Estudo de caso do processo perdido · Sênior. Foi feita no PR da IA (#26), na change `ggvp-14-ia-juridica`, porque depende do motor de IA. O estudo já chama `abrirExplicacaoDoResultado`.

## Próximo PR do épico e travadas (08/10)

- **GGVP-92** · Prestação de contas montada pela IA e OK da advogada: refinada pelo Lucas, entra no próximo PR, depois de 09/10. Até lá, a prestação nasce só do deferimento no INSS. A do procedente na Justiça entra com ela e já cai no caminho desta change.
- **GGVP-100** · Improcedente: decidir se recorre: refinada pelo Lucas, entra no próximo PR. Quando entrar, o "Não recorrer" chama `abrirExplicacaoDoResultado`. Essa ligação saiu da tarefa 2.8, que valia também para a GGVP-19, já ligada no PR da IA.
- **GGVP-90** · Procedente: acompanhar o pagamento: em "Tarefas pendentes", com o Lucas.

## Fora do escopo

- Envio real pelo Chatwoot: o portal registra o envio revisado por pessoa, como na GGVP-44.
- A tela da Agenda: a ida ao banco vira tarefa de quem acompanha, com a data; a Agenda (tela do Pedro) lê dali quando ligar.
- IA (GGVP-14): sem ela, nada é gerado sozinho.

## Portões envolvidos

- **G8**: o aviso ao cliente só sai depois do OK da advogada na prestação.
- Quem dá o OK não registra o recebimento (GGVP-96 CA16): o banco recusa, e o servidor recusa antes e registra a tentativa. A tentativa é gravada como `funcoes` (separação de funções), um código neutro como `setores` e `perfil`, e não como G8, que é "o aviso só sai depois do OK" (terceira revisão de 08/10).
- **Pergunta ao Lucas (08/10):** a separação de funções vira portão oficial, com número em `docs/requisitos/portoes-governanca.md`? Até a resposta, fica com o código neutro, e o painel da gestão mostra a descrição certa.
