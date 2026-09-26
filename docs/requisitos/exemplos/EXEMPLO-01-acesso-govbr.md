# EXEMPLO-01 · Guardar e revelar o acesso gov.br do cliente com segurança

> **Exemplo didático, não é história do projeto.** Baseado no portal da GGV Previdenciário, primeiro produto da MAPECH, e nas lacunas que a auditoria de uso de 11/09/2026 encontrou nele. Não está no backlog do GGV Trabalhista e não deve ser construído. Serve só para mostrar como o template de história deve ser preenchido. Pessoas aparecem só por papel, e as respostas do PO são ilustrativas.

**Como** pessoa da documentação\
**quero** cadastrar a senha do Meu INSS do cliente e revelá-la só no momento de usar, com confirmação da minha identidade e registro\
**para** usar o acesso no requerimento sem expor a senha na tela, na ficha do cliente ou a quem não precisa.

**Passo BPMN:** `prev 1.3` · Solicitação e recepção de documentos, raia ADMINISTRATIVO. Numa história real, use o código do passo em `docs/bpmn/`.\
**Épico:** Cadastro e documentação\
**Prioridade do PO:** 2\
**Estimativa:** M

## Critérios de aceite
1. **Dado** que tenho permissão de cadastrar acessos gov, **quando** cadastro login e senha de um cliente, **então** a senha é gravada cifrada e a tela mostra apenas `••••••` com o botão Revelar.
2. **Dado** um cliente com acesso cadastrado, **quando** abro a ficha do cliente, **então** a senha não aparece em texto claro em lugar nenhum da ficha, só na página Acessos Gov, atrás do botão Revelar.
3. **Dado** que tenho permissão de revelar, **quando** clico em Revelar e confirmo a minha senha do portal, **então** login e senha ficam visíveis por 30 segundos, com os botões "Copiar login" e "Copiar senha" rotulados, e depois voltam a ficar ocultos.
4. **Dado** que alguém revelou um acesso, **quando** consulto o histórico desse acesso, **então** vejo quem revelou, quando e de qual cliente, sem a senha aparecer no histórico.
5. **Dado** uma pessoa sem permissão de revelar, **quando** abre Acessos Gov, **então** vê o nome do cliente e se ele tem acesso cadastrado, mas não vê o botão Revelar nem o de cadastrar.
6. **Dado** um agente de IA usando token de API, **quando** pede qualquer dado de Acessos Gov, **então** recebe acesso negado e a tentativa fica registrada.
7. **Dado** que conheço só o CPF do cliente, **quando** busco pelo CPF em Acessos Gov, **então** encontro o acesso dele.

## Fora do escopo desta história
- Entrar automaticamente no Meu INSS com a senha guardada.
- Trocar a senha no site do INSS pelo portal.
- Importar as senhas que já existem em outros sistemas: fica numa história própria, com conferência.
- Cofre de senhas para os acessos do próprio escritório.

## Dados e permissões
- **Ver a lista** de clientes com acesso cadastrado: toda a equipe humana.
- **Revelar:** quem tem a permissão `gov.reveal`. No Prev, o equivalente era o perfil GOV.
- **Cadastrar e editar:** só responsáveis designados, com a permissão `gov.create`.
- **Agente de IA:** nenhum acesso, nem de leitura.
- **Dado sensível:** sim. Senha de terceiro e CPF. Cifrados em repouso, nunca gravados em log, nunca exibidos sem Revelar. A retenção está nas dúvidas abaixo.

## Tela ou referência
- Tela Acessos Gov do Prev, com as quatro correções que a auditoria de 11/09 apontou: senha fora da ficha do cliente, rótulos nos botões de copiar, busca por CPF e botão de cadastrar visível para quem pode.
- Esboço da linha revelada: `Nome do cliente · CPF só com os últimos dígitos · login ●●● · senha ●●● · [Copiar login] [Copiar senha] · oculta em 30 s`

## Dúvidas respondidas pelo PO
- Quanto tempo a senha fica visível depois de revelada? → 30 segundos. 15/09/2026, resposta ilustrativa.
- Quem pode revelar? → Quem tem a permissão de revelar, e cada revelação fica registrada. 15/09/2026, resposta ilustrativa.
- O agente de IA pode usar a senha para automatizar o requerimento? → Não, nunca. 15/09/2026, resposta ilustrativa.
- O que acontece com a senha quando o caso é arquivado? → É apagada 90 dias depois do arquivamento. 15/09/2026, resposta ilustrativa.

---

## Por que este exemplo está bem preenchido
_Esta seção existe só no exemplo. Não faz parte do template._
- O papel é de alguém do escritório, e o "para" diz o resultado de negócio, não a tela.
- Cada critério é observável em homologação: dá para testar clicando, sem ler código.
- Os critérios cobrem o caminho normal, a falta de permissão, o agente de IA e o histórico, que foi exatamente onde o Prev falhou.
- O fora do escopo impede que a história cresça durante a sprint.
- Dados e permissões dizem quem faz o quê e como o dado sensível é tratado.
- Cada dúvida tem resposta e data: nenhuma decisão fica só na cabeça de alguém.
