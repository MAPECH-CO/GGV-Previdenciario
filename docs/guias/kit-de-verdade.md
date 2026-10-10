# Kit de verdade: os modelos do Word do escritório, preenchidos para imprimir e assinar

Guia da GGVP-136 (passos D1.15 e D1.16 do BPMN, mais colher a assinatura, conferir o assinado e entregar a cópia). É para quem sobe os modelos, para quem opera a homologação e para o Mateus, que liga o conversor de PDF. Traz só nomes de variáveis, nunca valores, e nenhum texto de modelo: o texto é do escritório e o repositório é público.

## 1. O caminho

1. A Sênior sobe o modelo de cada linha do kit na **Configuração**, seção **Modelos do kit**. Cada envio vira a versão seguinte. O kit usa sempre a versão em vigor; o kit já gerado guarda o modelo e a versão da época.
2. A Atendimento abre **Preparar contrato**. O portal usa o modelo da linha do benefício. Os honorários vêm do texto do modelo, sem campo para digitar, e a tela pede para conferir no kit antes de imprimir.
3. Ao gerar, cada `{{VARIÁVEL}}` sai preenchida com a ficha e o caso. Se falta dado da ficha (bairro, cidade, UF, CEP...), o kit não é gerado: a tela lista o que falta e dá o atalho **Completar a ficha**. Gerado, o Word fica na pasta do cliente, com o modelo e a versão usados, e o histórico da ficha registra.
4. Em **Colher assinatura**, **Imprimir o kit** abre o PDF na janela de impressão do navegador e deixa baixar. Sem conversor de PDF, baixa o Word preenchido para imprimir por ele.
5. No papel, a data do contrato de honorários (a primeira `{{DATA DE HOJE}}` do modelo) sai preenchida; as outras saem em branco (`dia ____ de ____ de AAAA`), para preencher à mão na assinatura.
6. O assinado volta digitalizado e segue o caminho de sempre: concluir a assinatura, leitura, conferir o contrato assinado e entregar a cópia.

## 2. Os modelos e as linhas do kit

São nove arquivos do Word, um por linha do kit. Cada um já é o kit inteiro (contrato de honorários, procuração, declarações, Anexo XXII, termo de responsabilidade).

| Modelo na Configuração | Identificador | Linha do kit |
|---|---|---|
| Contrato Completo de aposentadorias | `contrato-completo-aposentadorias` | Aposentadorias |
| Contrato Completo de auxílio acidentário | `contrato-completo-auxilio-acidentario` | Auxílio acidentário |
| Contrato Completo de auxílio incapacidade | `contrato-completo-auxilio-incapacidade` | Auxílio incapacidade |
| Contrato Completo de LOAS idoso e deficiente | `contrato-completo-loas` | LOAS idoso ou deficiente |
| Contrato Completo de LOAS representado por genitor(a) | `contrato-completo-loas-representado` | LOAS, quando o caso é representado |
| Modelo 6 (curatela) | `modelo-6` | Curatela |
| Modelo 7 (restituição de contribuições) | `modelo-7` | nenhuma ainda |
| Modelo 8 (kit consumidor) | `modelo-8` | Empréstimo fraudulento |
| Modelo 10 (seguros) | `modelo-10` | Seguro de vida |

A linha **Isenção de IR** fica sem modelo: o kit avisa que falta. O modelo 7 é o de restituição de contribuições, e a tabela do kit só diz "isenção de IR". Fica a pergunta para o Lucas: a que benefício o modelo 7 se liga? Até a resposta, a linha não gera kit.

## 3. O que o modelo precisa ter

Dentro do Word, cada dado do cliente é uma `{{VARIÁVEL}}`, no padrão dos modelos do ZapSign. O Word às vezes parte o texto de uma variável em pedaços; o portal junta os pedaços antes de ler. A lista é fechada, e o envio **recusa** o arquivo que:

- não é um documento do Word (`.docx`) ou passa de 10 MB;
- não tem nenhuma variável (provavelmente é um documento já preenchido);
- tem variável que o portal não conhece (um erro de escrita sairia em branco no papel);
- traz um CPF escrito (dado de cliente que ficou no modelo).

As variáveis, em três grupos:

- **O cliente:** `NOME COMPLETO`, `ESTADO CIVIL`, `NACIONALIDADE`, `PROFISSÃO`, `NÚMERO DO CPF`, `NÚMERO DO RG`, `ENDEREÇO COMPLETO`, `Nº`, `BAIRRO`, `CIDADE`, `UF`, `CEP`, `TELEFONE`, `TELEFONE P/ CONTATO` (opcional), `DATA DE HOJE`. O modelo 7 chama os telefones de `TEL 1` e `TEL 2` (opcional).
- **O beneficiário** (o representado do LOAS; o curatelado): as seis variáveis pessoais com o sufixo ` DO BENEFICIÁRIO` e `DATA DE NASCIMENTO DO BENEFICIÁRIO`.
- **O genitor ou a genitora** que representa: as seis variáveis pessoais com o sufixo ` GENITOR(A)`. Endereço e telefone dele são os do cliente.

Os dados que a ficha do balcão não tem (a nacionalidade, o que falta do representante, os dados do curatelado) entram como campos do contrato em **Preparar contrato**, no contrato do servidor.

## 4. Subir os modelos na homologação

Os modelos moram numa pasta da máquina de quem sobe, fora do repositório. O script `modelos:subir` entra no portal como a Sênior e sobe cada `.docx` da pasta pela mesma rota da tela de Configuração. O e-mail e a senha dela vêm de variáveis de ambiente que a pessoa digita na hora: nunca de arquivo, e o script não os mostra.

No PowerShell, na raiz do clone (a senha não aparece enquanto se digita):

```powershell
$env:PORTAL_URL = 'https://<endereço da homologação>'
$env:SENIOR_EMAIL = '<e-mail da Sênior>'
$env:SENIOR_SENHA = [System.Net.NetworkCredential]::new('', (Read-Host 'Senha da Sênior' -AsSecureString)).Password
pnpm --filter @ggv/api modelos:subir 'C:\caminho\da\pasta\dos\modelos'
```

O nome do arquivo diz o modelo: o do contrato é o identificador inteiro (`contrato-completo-loas.docx`) e os numerados começam por `modelo-N-` (`modelo-6-curatela.docx`). Arquivo que não bate com nenhum modelo é pulado, e o script não escreve o nome dele. A cada envio, escreve só o identificador e a versão (`contrato-completo-loas: versão 1 no ar`) ou a recusa do portal. No fim, diz quais modelos ficaram sem arquivo. Rodar de novo sobe a versão seguinte de cada arquivo da pasta.

`PORTAL_URL` não tem valor padrão de propósito: o endereço é sempre digitado, para não subir modelo no lugar errado. Depois de usar, feche o terminal ou limpe as variáveis (`Remove-Item Env:SENIOR_SENHA`).

## 5. Variáveis de ambiente do servidor

| Variável | Para que serve | Sem ela |
|---|---|---|
| `GOTENBERG_URL` | Endereço do serviço Gotenberg, que converte o Word preenchido em PDF (por exemplo `http://gotenberg:3000`, sem barra no fim). | O portal entrega o Word preenchido para baixar e imprimir. |
| `ZAPSIGN_API_TOKEN` | Diz que o ZapSign está contratado. Hoje o ZapSign do portal é simulado, e a API real pede plano pago. | Só papel: vale para qualquer entrevista, a opção do celular não aparece e o servidor recusa montar documento no ZapSign. |

`GET /api/contrato/servicos` mostra o que o servidor entendeu: `{ "zapsign": false, "pdf": true }`, por exemplo. Nunca ponha o valor de um token em arquivo do repositório.

## 6. Nota para o Mateus: o Gotenberg no Coolify

O PDF sai de um serviço à parte, o **Gotenberg** (o LibreOffice atrás de uma API HTTP). O portal só chama; subir o serviço é da infraestrutura.

1. No Coolify, no mesmo projeto e na mesma rede da API: um serviço novo pela imagem `gotenberg/gotenberg:8`, porta `3000`.
2. **Sem domínio público.** O serviço não tem login, e o que passa por ele é contrato de cliente. Só a API o alcança, pela rede interna.
3. Na aplicação da API, a variável `GOTENBERG_URL` com o endereço interno do serviço (o nome que o Coolify dá a ele, com a porta).
4. O portal chama `POST {GOTENBERG_URL}/forms/libreoffice/convert`, com o `.docx` no campo `files`, e espera até 60 segundos. Se o serviço não responde ou devolve erro, a tela baixa o Word no lugar, e a impressão não fica parada.
5. Conferir: `GET /api/contrato/servicos` com `"pdf": true`, e **Imprimir o kit** de um contrato de teste abrindo o PDF.
6. Antes de usar de verdade, confira um PDF de kit de verdade contra o Word: fonte que o serviço não tem é trocada, e a paginação pode mudar.

## 7. O que fica de fora

- O ZapSign de verdade (a API pede plano pago). A opção do celular volta quando o servidor tiver `ZAPSIGN_API_TOKEN` e a integração real estiver ligada.
- Contratos gerados antes do kit de verdade não têm o Word guardado: **Imprimir o kit** dá "Este contrato ainda não tem o kit gerado". Esses contratos precisam ser gerados de novo.
- Os modelos do escritório: ficam fora do repositório, até os limpos. Os testes criam um `.docx` inventado.
