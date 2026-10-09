# GGVP-7 · Abertura e documentação · passos BPMN: D1.15 a D1.24 · perfis: Atendimento, Documentação e advogada responsável

## Por quê

Depois da entrevista, o benefício está definido e a pessoa vira cliente. Falta montar o kit de documentos, preencher e assinar o contrato, ler e arquivar os papéis, conferir o checklist, dar as boas-vindas, cobrar o que falta e liberar o caso ao Jurídico. Hoje isso vive no papel, no ZapSign e no Airtable. O épico leva esse caminho para o portal, tela por tela, fiel ao Figma (`nHOPzl005CpWDXUWyVZIo6`) e ao frame D1 do Miro.

## O que muda

Duas sessões em paralelo, cada uma na sua árvore e na sua branch, decisão do Pedro em 05/10. O orquestrador junta as duas em `feat/GGVP-7-abertura-e-documentacao`. Antes de cada história, reler o cartão: se o cartão e o Figma divergirem, vale o cartão.

**Grupo contrato** (`feat/GGVP-7-grupo-contrato`), na ordem do fluxo:

1. GGVP-65 · Kit de documentos por benefício (D1.15)
2. GGVP-69 · Preencher o contrato pelo modelo e conferir (D1.16)
3. GGVP-72 · Assinatura digital pelo ZapSign (D1.17)
4. GGVP-77 · Assinatura em papel na entrevista (D1.17)
5. GGVP-85 · Verificar o contrato assinado (D1.19)
6. GGVP-89 · Cópia do contrato para o cliente levar (D1.20)

**Grupo documentos** (`feat/GGVP-7-grupo-documentos`), na ordem do fluxo:

1. GGVP-81 · Ler e arquivar os documentos (D1.18)
2. GGVP-91 · Checklist de documentos obrigatórios do benefício (D1.21)
3. GGVP-97 · Boas-vindas ao cliente (D1.22)
4. GGVP-101 · Cobrar os documentos pendentes (D1.23)
5. GGVP-18 · Liberar o caso ao Jurídico (D1.24)

**Ligar no servidor** (`feat/GGVP-7-ligar-no-servidor`, GGVP-125, Mateus, desde 08/10): as telas da Recepção e desta
Abertura passam a gravar no banco do portal, em blocos (1 a 6), com as regras do Pedro e os portões no servidor; spec em
`specs/ggvp-125/spec.md`.

Cada história ganha uma spec em `specs/ggvp-n/spec.md` e uma seção no `tasks.md`, no bloco do seu grupo.

## Fora do escopo

- Servidor, banco e implantação: Supabase e Coolify são do Mateus. Aqui só tela, sobre dados de exemplo em `apps/web/src/dados/`, menos o que a GGVP-125 liga no servidor. Cada história deixa aberta a tarefa "ligar no servidor".
- Serviço de fora (ZapSign, Google Drive, Chatwoot, OpenAI, n8n, scanner): simulado na tela, sem chamada de verdade.
- O que o épico de Recepção e entrevista já fez: esta change usa, não refaz.

## Portões envolvidos

- G9 (senha do gov.br só no cofre), G19 (número e prazo por código com teste) e os que cada cartão citar. Cada spec diz o seu.
