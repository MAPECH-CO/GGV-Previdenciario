# Definition of Ready

**Definition of Ready**, ou prontidão, é a lista mínima que uma história cumpre para poder entrar numa
sprint. Serve para uma coisa só: ninguém começa a construir sem saber o que é "pronto". Quem confere é
o Scrum Master, no refinamento de quarta. Se falta um item, a história não entra na planning e volta
para o Product Owner. É o portão de entrada da sprint; o de saída é a `definition-of-done.md`.

Uma história só entra na sprint se:

1. Tem título no formato "Como [papel do escritório], quero [ação] para [resultado]".
2. Está ligada a um passo do BPMN (`docs/bpmn/`, código `D1.05`, `DP.07` etc., também gravado no cartão do Miro) ou a uma tarefa técnica justificada.
3. Tem critérios de aceite em Dado / Quando / Então, no template de `docs/requisitos/`.
4. O PO respondeu as dúvidas do refinamento. Nenhuma dúvida aberta.
5. Cabe numa sprint. Se não cabe, foi quebrada.
6. Tem estimativa dos devs (P, M, G).
7. Se tem tela, tem esboço no Figma do perfil que usa a tela.
8. Se depende de integração ou de dado do escritório, o insumo já está disponível.
9. Se o benefício está na matriz de documentação médica (`docs/requisitos/roteiro-laudos.md`), os critérios cobrem o portão do parecer médico.
