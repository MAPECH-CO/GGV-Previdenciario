GGVP-14 · IA jurídica e knowledge graph · histórias: GGVP-106 (agora), GGVP-110; depois GGVP-38, GGVP-41, GGVP-45.

## Por quê

A IA estava estacionada até 09/10. Em 07/10 o Mateus decidiu ligar: a OpenAI sugere (texto, classificação, resumo) e a Mistral lê documento (OCR de PDF e foto). As chaves ficam só no ambiente (`.env.ia` local e Coolify). Antes de qualquer função usar a IA, vem a plataforma que garante as regras do projeto: a IA sugere, a pessoa decide, cada chamada fica registrada, e sem chave nada trava.

Branch empilhada na Garantia (`feat/GGVP-13-garantia-e-governanca`, PR #18), que tem a matriz de permissões e o registro de bloqueios.

## Histórias na ordem

1. **GGVP-106** · Guardrails de IA e do chat: a IA sugere, a pessoa confirma, tudo registrado · sistema.
2. **GGVP-110** · Conteúdo malicioso não manipula a IA · sistema.
3. **GGVP-38** · Recomendação sobre a perícia; **GGVP-41** · Medir ganho e perda e gravar no acervo; **GGVP-45** · Buscar no acervo antes de escrever: depois, quando o acervo tiver dado.

## Autorização do escritório (07/10)

O Mateus informou em 07/10 que o escritório autoriza o uso da IA no sistema inteiro, inclusive com dado de saúde (laudo, receita, parecer). A plataforma continua exigindo `IA_PERMITE_DADO_DE_SAUDE=sim` no ambiente (`.env.ia` e Coolify), para a autorização ficar explícita e poder ser desligada. Pedido ao Lucas: registrar a autorização no Jira.

## A IA no que já existe (depois da plataforma)

Cada integração completa a parte de IA que a história deixou para este épico, com a spec dela nesta change:

4. **GGVP-34 e GGVP-74** · Ler a publicação: a IA sugere a classe, os dias de prazo escritos na decisão e um resumo; a advogada confirma ou troca.
5. **GGVP-63** · Pedir a petição: a IA escreve a versão 1, com as fontes; a advogada confere e assina (G6).
6. **GGVP-22** · Explicar o resultado: a IA sugere o resumo para o cliente; o Jurídico completa e aprova.
7. **GGVP-131** · Chance de êxito do caso: recorte a combinar, depende de o acervo ter dados.

## Fora do escopo

- O chat que executa ações (cards de confirmação): fora até 09/10 pelo plano de entrega; o chat só consulta.
- A IA nas telas do Pedro (leitura do laudo, sugestão do benefício, comprovante da perícia): entram quando ele ligar essas telas no servidor (GGVP-125, GGVP-132), sobre esta plataforma.
- Google Drive (GGVP-107).
