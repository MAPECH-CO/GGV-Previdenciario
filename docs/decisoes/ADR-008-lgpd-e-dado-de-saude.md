# ADR-008 · LGPD e dado de saúde

**Data de registro:** 2026-10-12 · **Estado:** decisões de produto registradas; região e contratos em aberto.
**Fonte:** decisões fornecidas por Pedro na GGVP-159; autorização de Lucas em 07/10/2026 para uso de dado de saúde pela IA.

## Contexto

O portal trata documentos médicos, áudio, transcrição e sugestões da IA. É necessário distinguir conteúdo médico de dados operacionais e registrar a guarda de cada tipo. Este ADR registra decisões do produto; não declara concluída a avaliação contratual ou de proteção de dados dos fornecedores.

## Decisões

| Tema | Regra decidida |
|---|---|
| Conteúdo médico | Laudo, CID, diagnóstico, parecer e texto de documento médico são restritos ao Jurídico e ao Sócio. |
| Dados operacionais | Status, resultado, datas e etapas são visíveis a todos os perfis que veem o caso. Não há filtro por palavra para determinar acesso. |
| IA | Pode usar dado de saúde, por autorização de Lucas em 07/10. A IA sugere e uma pessoa confere/decide; não calcula tempo, pontos, carência ou percentuais de chance. |
| Áudio e transcrição | Guardados para sempre, conforme decisão de produto recebida nesta história. |
| Documentos médicos | Guarda por tempo indeterminado; o controle de guarda será definido depois. |
| Saída da IA | Mesma classificação, acesso e regra de guarda do conteúdo de origem: conteúdo médico por tempo indeterminado; saída que compõe a transcrição acompanha sua guarda permanente. Não vira dado público por ser gerada pela IA. |
| Auditoria | Registrar quem acessou e quando, sem conteúdo médico, áudio, transcrição, senha ou documento nos logs. |
| Senha gov.br | Só no cofre; não exibir nem guardar em texto transcrito ou campo livre (G9). |

## Consequências

As permissões devem ser conferidas no servidor e respeitadas na tela, nas consultas e no chat. Leitura de conteúdo sensível deve ser auditada sem copiar o conteúdo para o log. O Sócio tem leitura de tudo, sem ganhar por isso poderes para executar uma etapa do caso.

A autorização funcional não desliga as verificações de acesso e configuração do motor de IA. Sem a condição necessária para chamar o fornecedor, a interface informa a indisponibilidade; não simula uma resposta.

Este registro não modifica armazenamento, rotinas de exclusão ou implantação. Verificação de implementação e definição do controle futuro de guarda permanecem trabalhos separados.

## Em aberto

- Região do banco no Supabase.
- Contratos e condições de tratamento com OpenAI e Mistral, inclusive transferência e guarda pelos fornecedores.
- Controle posterior de guarda de documentos médicos e tratamento de pedidos de exclusão; não presumir rotina já implementada.

Estas pendências continuam em [Dúvidas do produto](../requisitos/duvidas-abertas.md). Nenhum serviço externo ou dado real foi acessado para registrar esta decisão.
