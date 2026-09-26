# Definition of Done

**Definition of Done**, ou conclusão, é a lista que diz quando uma história está de fato feita. Vale
para toda história, sem exceção e sem negociação por pressa: sob pressão corta-se escopo, nunca o
portão. Quem confere é o outro dev no pull request e o Product Owner em homologação. É o portão de
saída da sprint; o de entrada é a `definition-of-ready.md`.

Uma história só é "feita" quando TUDO abaixo é verdade:

1. Código na branch da história, PR aberto com o template preenchido.
2. Testes escritos para o comportamento novo e passando. Suíte inteira passando.
3. CI verde: typecheck, lint, testes, varredura de segredos.
4. Revisado e aprovado pelo outro dev. Comentários resolvidos. Merge por outra pessoa, não o autor.
5. Sem segredo, sem `.env`, sem dado real de cliente no repositório.
6. Implantado em homologação e funcionando lá, não só na máquina do dev.
7. Critérios de aceite verificados em homologação pelo PO, e a história marcada "Aceita" no Jira.
8. Documentação atualizada quando muda comportamento, tela ou dado.
9. Nenhuma mudança de arquitetura sem ADR em `docs/decisoes/`.

"Quase pronto" não existe. Se falta um item, a história não conta na sprint.
