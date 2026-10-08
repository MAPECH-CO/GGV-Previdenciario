GGVP-8 · Via administrativa no INSS · histórias: GGVP-27, GGVP-31, GGVP-23, GGVP-35, GGVP-48, GGVP-39, GGVP-44.

## Por quê

Depois da conferência da Sênior, o caso vai ao INSS: protocolo no Meu INSS, decisão sobre perícia, vigília da resposta, exigências e o desfecho (deferido com prestação de contas, ou indeferido para a Justiça). É o primeiro trecho do processo que o Lucas testa em homologação no dia 09/10.

## Histórias na ordem

Grupo 1 (feito, PR #14):
1. **GGVP-27** · Protocolar no Meu INSS · Jurídico administrativo.
2. **GGVP-31** · Mandar para perícia quando o benefício pede · advogada responsável.

Grupo 2 (feito, PR #14):
3. **GGVP-23** · Conferência do sênior antes do INSS · Sênior (os outros perfis veem só para leitura).
4. **GGVP-35** · Vigiar o Meu INSS todo dia · advogada responsável e equipe do Jurídico.
5. **GGVP-48** · Indeferido segue para a Justiça · advogada responsável; a Sênior pode encerrar com motivo. Depende do registro da decisão do INSS, que é da GGVP-35.

Grupo 3 (agora):
6. **GGVP-39** · Tratar exigência do INSS · a advogada decide o que a exigência pede (documentos, perícia ou os dois) e o sistema conta o prazo; a Documentação cobra o cliente, junta a prova de cada item e responde no portal do INSS; perto do vencimento, a Sênior é avisada.
7. **GGVP-44** · Benefício deferido: prestação de contas e ida ao banco · a advogada faz a prestação com os valores calculados pelo sistema; ao concluir, o Financeiro recebe e o Atendimento agenda a ida ao banco, ao mesmo tempo; a confirmação ao cliente sai pelo modelo, revisada por pessoa.

Dúvidas das histórias dos grupos 2 e 3 respondidas pelo revisor (Mateus) em 05/10, registradas nos comentários dos cartões; o Lucas valida em homologação.

## Travadas

- Nenhuma no grupo 3: a GGVP-39 e a GGVP-44 estão em "Refinada", com as dúvidas respondidas pelo revisor em 05/10.

## Fora do escopo

- Guardar a senha no cofre (GGVP-103, épico Garantia e governança): aqui só se lê a senha que já está lá.
- A marcação e o resultado da perícia (épico Perícia, GGVP-49 em diante): aqui o sistema só abre a tarefa.
- Integração com o Meu INSS: não há API; o protocolo, a vigília e a resposta à exigência são registrados por pessoa.
- IA no grupo 3 (sugerir a classificação da exigência e redigir a resposta): fica para o épico IA jurídica (GGVP-14). Sem IA, a classificação é sempre escolha da advogada (G5), e a resposta segue o BPMN (a Documentação responde).
- Envio automático pelo WhatsApp: não há integração. O portal monta a mensagem pelo modelo, a pessoa revisa, envia pelo celular e registra o envio (Q5).
- O resultado da perícia aberta pela exigência é registrado no épico Perícia; aqui o sistema abre a tarefa e, quando o resultado chega, devolve o caso à vigília.
- Lançar e conciliar no Financeiro, recibo e custas: fora; o Financeiro registra "Recebido" ou "Divergência".

## Portões envolvidos

G2 (nada é protocolado sem o OK da Sênior), G9 (senha do gov.br só do cofre, por tempo limitado, com histórico), G1 e G17 (na conferência, grupo 2), G21, G15, G12 e G5 (exigência, grupo 3), G8 (prestação, grupo 3).
