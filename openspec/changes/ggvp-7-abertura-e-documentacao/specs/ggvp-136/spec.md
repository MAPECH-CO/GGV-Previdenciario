# Spec Delta · ggvp-136 · Kit de verdade: os modelos do escritório preenchidos, para imprimir e assinar

## Purpose

O Atendimento gera o kit do cliente com os modelos do próprio escritório, já preenchidos com os dados da ficha e do caso, e imprime pelo navegador, para o cliente assinar no papel. Passos D1.15 e D1.16 do Miro (escolher o kit e preencher o contrato), depois colher a assinatura, conferir o assinado e entregar a cópia. Telas que já existem: Preparar contrato, Colher assinatura ("Imprimir o kit", que era simulado), Conferir contrato e Entregar a cópia (Figma step_D1.16 `10:143`).

Os modelos são arquivos do Word do escritório, um por linha do kit; cada um já é o kit inteiro (contrato de honorários, procuração, declarações, Anexo XXII, termo de responsabilidade). O assinado volta digitalizado e segue o caminho de sempre. O ZapSign (assinatura pelo celular) fica fora: a API dele pede plano pago.

Contrato (Zod, `packages/contratos/src/modelos.ts`; as regras puras em `apps/web/src/regras/kitDoModelo.ts`):

```ts
export const ModelosDoEscritorio = z.object({
  modelos: z.array(z.object({ id: z.string(), nome: z.string(), versao: z.number().nullable(), vigenteDesde: z.string().nullable() })),
  podeSubir: z.boolean(),
})
// Contrato ganha, em `documento`, o modelo e a versão usados e o arquivo do kit guardado (CA6).
```

| Endpoint | Entrada | Saída |
|---|---|---|
| `GET /api/configuracao/modelos` (`gestao.ver`) | — | `ModelosDoEscritorio` |
| `PUT /api/configuracao/modelos/:id` (`modelo.subir`, só a Sênior) | multipart, campo `arquivo` (.docx) | `{ ok, versao }` |
| `POST /api/processos/:id/contrato/gerar` | o envio que já existe | `gerado`; ou `faltam` (campos do contrato) ou `faltam-na-ficha` (o que a ficha não tem), com a lista (CA4); ou `sem-modelo` |
| `GET /api/processos/:id/contrato/kit` | — | o PDF (com `GOTENBERG_URL`) ou o .docx preenchido (CA5) |

Decisões:

1. **Onde o modelo fica.** Cada versão é uma linha de `modelo` (tipo "contrato", nome igual ao identificador do modelo); o arquivo vai para o armazenamento privado e a linha guarda a chave, o tamanho e o hash. A versão em vigor é a única com `ativo`; as anteriores ficam guardadas, e o kit já gerado guarda o modelo e a versão da época. O nome do arquivo enviado não é guardado (pode ter nome de cliente).
2. **Variáveis.** `{{NOME COMPLETO}}`, `{{NÚMERO DO CPF}}`... no padrão dos modelos do ZapSign, em lista fechada (`VARIAVEIS_DO_KIT`). O envio recusa o modelo com variável desconhecida (escrita errada sairia em branco no papel), sem nenhuma variável (provavelmente um documento já preenchido) ou com CPF escrito. A biblioteca `docxtemplater` junta os pedaços que o Word quebra; entra no lugar de uma troca de texto à mão, que erraria nesses pedaços.
3. **O que o modelo é.** Um modelo por linha do kit: aposentadorias, auxílio acidentário, auxílio incapacidade, LOAS idoso e deficiente, LOAS representado por genitor(a), curatela (modelo 6), kit consumidor (modelo 8) e seguros (modelo 10). O modelo 7 é o de restituição de contribuições e a tabela do kit diz "isenção de IR" para ele: até o Lucas dizer a que benefício ele se liga, a linha "Isenção de IR" fica sem modelo e o kit avisa que falta (Orquestrador, 09/10).
4. **Honorários.** Vêm do texto do modelo, sem campo para digitar; a tela diz que são os do modelo e pede para conferir no kit antes de imprimir.
5. **Datas no papel.** O contrato de honorários, o primeiro documento do modelo, sai com a data de hoje (`{{DATA DE HOJE}}`); as outras datas saem em branco, para preencher à mão.
6. **O que a ficha não tem.** Nacionalidade do cliente e, no LOAS representado, estado civil, nacionalidade e profissão do genitor(a), e na curatela os dados do curatelado, entram como campos do contrato na tela Preparar contrato, como o RG já é. Endereço e telefone do genitor são os do cliente. O telefone para contato é opcional.
7. **Papel sem ZapSign.** Enquanto o ZapSign não estiver contratado, papel vale para qualquer entrevista, e a opção do celular não aparece (Orquestrador, 09/10: 99% assinam no papel).
8. **PDF plugável.** Com `GOTENBERG_URL`, o servidor converte o .docx preenchido em PDF; sem ela, o portal entrega o .docx preenchido. O serviço de conversão (Gotenberg no Coolify) é do Mateus.
9. **Modelos fora do repositório.** O texto é do escritório e o repositório é público: nenhum modelo entra aqui, nem limpo. Os testes criam um .docx inventado. Para a homologação, um script sobe os modelos da pasta local pela rota da Configuração.

## ADDED Requirements

### Requirement: CA1 · Modelo com versão, subido pela Configuração
Quando a Sênior sobe ou troca um modelo na Configuração, o portal SHALL guardá-lo com a versão, e o kit SHALL usar sempre a versão em vigor. Só a Sênior sobe.

#### Scenario: CA1 · Subir e trocar o modelo
- **Dado** os modelos do escritório
- **Quando** a Sênior sobe ou troca um modelo na configuração
- **Então** ele fica guardado no portal com a versão, e o kit usa a versão em vigor

### Requirement: CA2 · O kit usa o modelo da linha do benefício
Ao preparar o contrato, o portal SHALL usar o modelo da linha do kit do benefício (`KITS`, `apps/web/src/regras/contrato.ts`), e os honorários SHALL vir do texto do modelo, sem campo para digitar.

#### Scenario: CA2 · Preparar o contrato
- **Dado** um caso
- **Quando** a pessoa prepara o contrato
- **Então** o portal usa o modelo da linha do kit do benefício, e os honorários vêm do modelo

### Requirement: CA3 · Cada variável sai preenchida
Ao gerar o kit, cada `{{VARIÁVEL}}` SHALL sair preenchida com o dado da ficha e do caso: nome completo, nacionalidade, estado civil, profissão, RG, CPF, endereço, número, bairro, cidade, UF, CEP, telefones e a data. No LOAS representado, saem também os dados do genitor(a).

#### Scenario: CA3 · Gerar o kit
- **Dado** o modelo escolhido
- **Quando** o kit é gerado
- **Então** cada `{{VARIÁVEL}}` sai preenchida com o dado da ficha e do caso

### Requirement: CA4 · Falta dado: não gera e diz o que falta
Com dado faltando, o portal SHALL NOT gerar o kit, SHALL listar o que falta e SHALL dar o atalho para completar a ficha.

#### Scenario: CA4 · Falta dado na ficha
- **Dado** um dado que falta na ficha
- **Quando** a pessoa tenta gerar o kit
- **Então** o portal não gera e lista o que falta, com o atalho para completar a ficha

### Requirement: CA5 · Imprimir o kit
Ao clicar em "Imprimir o kit", o PDF SHALL abrir no navegador com a janela de impressão, e SHALL dar para baixar. Sem o conversor de PDF, o portal SHALL entregar o .docx preenchido para baixar e imprimir. No papel, as datas SHALL sair em branco, menos a do contrato de honorários.

#### Scenario: CA5 · Imprimir
- **Dado** o kit gerado
- **Quando** a pessoa clica em "Imprimir o kit"
- **Então** o PDF abre no navegador e aparece a janela de impressão; dá também para baixar

### Requirement: CA6 · O kit fica na pasta do cliente
O kit gerado SHALL ficar na pasta do cliente, com o modelo e a versão usados, e o registro SHALL entrar no histórico.

#### Scenario: CA6 · Salvar o kit
- **Dado** o kit gerado
- **Quando** é salvo
- **Então** fica na pasta do cliente, com o modelo e a versão usados e o registro no histórico

### Requirement: CA7 · O assinado segue o caminho que já existe
O papel assinado SHALL voltar digitalizado e seguir para conferir o assinado e entregar a cópia, como já é.

#### Scenario: CA7 · O assinado volta
- **Dado** o papel assinado
- **Quando** volta digitalizado
- **Então** segue o caminho que já existe

### Requirement: CA8 · Sem ZapSign, a opção do celular não aparece
Com o ZapSign não contratado, a opção de assinar pelo celular SHALL NOT aparecer na tela de colher a assinatura.

#### Scenario: CA8 · A tela de colher a assinatura
- **Dado** que o ZapSign não está contratado
- **Quando** abro a tela de colher a assinatura
- **Então** a opção do celular não aparece
