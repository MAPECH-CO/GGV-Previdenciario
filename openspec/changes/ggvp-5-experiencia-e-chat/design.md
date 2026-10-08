# Design

## Context

- Esta change continua as changes `ggvp-6-recepcao-e-entrevista`, `ggvp-7-abertura-e-documentacao`, `ggvp-13-documentacao-medica` e `ggvp-10-pericia`: mesma base de telas, mesmo servidor de exemplo, mesmos clientes da semente. As decisões das `design.md` delas valem aqui.
- A perícia já existe (`dados/pericia.ts`, `/casos/:id/pericia`) e é usada, não refeita: o "Em perícia", as tarefas da perícia, a pergunta de um clique do perito (`peritosParaLigar`, `ligarPerito`) e o perfil do perito (`perfilDoPerito`).
- Quem age vem só do `usePerfil` de `dados/perfis.ts`. No main o "Trocar perfil" e o `?perfil=` saíram (quem age vem do login); nada novo é criado em cima deles, para a junção com o main ficar simples. Os testes seguem o jeito dos vizinhos desta branch (`iniciarPerfil('?perfil=…')`).

## Decisions (valem para o épico)

1. **Arquivo novo por assunto.** Caso: `src/regras/caso.ts` e `src/dados/caso.ts`. Chat: `src/regras/chat.ts` e `src/dados/chat.ts`. Telas em `src/paginas/` e `src/componentes/`.
2. **Arquivo comum só com acréscimo.** `servidor.ts` (`casos?` e `juizos?` no fim do `Banco`), `App.tsx` (a rota `/casos/:id` no fim de `Telas`), `CasoEmAndamento.tsx` (o caso fora da perícia abre `/casos/:id`, antes `/processos/:id`, que não existia), `CabecalhoCliente.tsx` (o aviso do laudo novo vira link, com `laudoHref` opcional).
3. **Semente do caso.** `casosDeExemplo` complementa cada processo de `exemplo.ts` sem mexer nele: NB ou protocolo, CNJ, juízo, a linha do processo (com quem fez: pessoa, sistema ou IA, e o passo), as esperas de fora, os laços dos setores, as tarefas, os prazos e os documentos com a origem. Datas a partir de hoje.
4. **Números são código (G19).** Etapa, fase, identificação, prazos da fase, ordem da linha e jurimetria em `regras/caso.ts`, com teste.
5. **Valores (orquestrador, 08/10).** Só o Financeiro e o Sócio veem valores. A advogada vê o valor da causa e a renda por pessoa do LOAS, e os valores da prestação de contas só no caso dela e quando o caso está na prestação de contas. O percentual de honorários aparece no contrato. `podeVerValor` em `regras/caso.ts`; o chat segue a mesma regra. A sênior e o Jurídico administrativo não veem valores.
6. **Dado de saúde e estratégia só para o Jurídico** (advogada, sênior, Jurídico administrativo). O Atendimento (e a Documentação) vê o caso sem petição, estratégia, valores nem o conteúdo dos laudos: o servidor de exemplo já devolve a visão do perfil (`visaoDoPerfil`).
7. **Portas.** Playwright desta sessão: `PORTA_E2E_API=3151` e `PORTA_E2E_WEB=5195`.

## GGVP-86 · Navegar pelo caso numa linha só

### Telas e rotas

| Rota | Figma | O que faz |
|---|---|---|
| `/casos/:id` | Advogada · Processo do cliente (completo) `72:2`, tema escuro `72:287`, fonte grande `72:572`, variantes `1578:2` a `2179:664` | Cabeçalho com a identificação da fase (NB, protocolo ou CNJ), o selo da etapa, "Laudo novo · data", o benefício; o cliente, o juízo (clicável) e o prazo urgente; "Histórico"; as cinco etapas com a atual em destaque, as que não se aplicam apagadas e o "Em perícia" na etapa que pediu; o detalhe da etapa feita; "Onde o caso está"; a linha do processo agrupada por etapa; esperando os setores; esperando alguém de fora; tarefas em andamento por setor; quem é o perito; dados do processo; prazos da fase; documentos com a origem; ações |
| sobreposição "Histórico do processo" | `59:11` | Do mais recente ao mais antigo, com quem fez e o passo |
| sobreposição da jurimetria | `2184:2`, `2184:53`, `2184:97`, `2184:143`, `2184:183` | Perito ou juízo: números do sistema com o número de casos ao lado, sem amostra mínima; o que costuma observar ou os entendimentos; os processos com ele |
| ficha do cliente (muda) | `73:2`, `73:199` | "Laudo novo · data" leva à análise do laudo; o caso fora da perícia abre `/casos/:id` |

### Contrato (vai para `packages/contratos/casos.ts`)

```ts
export const IdEtapa = z.enum(['entrevista', 'inss', 'justica', 'vigilia', 'desfecho'])          // D1, D2, D3, D3a, D3b
export const EstadoDaEtapa = z.enum(['feita', 'atual', 'futura', 'nao-se-aplica'])
export const EventoDoCaso = z.object({
  quando: z.string(), quem: z.string(), tipo: z.enum(['pessoa', 'sistema', 'ia']),
  oQue: z.string(), passo: z.string(), etapa: IdEtapa,
  documentos: z.array(z.string()).optional(), restrito: z.boolean().optional(), peloChat: z.boolean().optional(),
})
export const Espera = z.object({ quem: z.enum(['cliente', 'inss', 'perito', 'justica']), oQue: z.string(), desde: dataIso, prazo: dataIso.optional(), lembrete: z.string().optional() })
export const Laco = z.object({ setor: z.string(), oQue: z.string(), subiu: z.object({ quem: z.string(), quando: z.string() }).optional() })
export const TarefaDoCaso = z.object({ setor: z.string(), titulo: z.string(), responsavel: z.string(), prazo: z.string(), paralela: z.boolean().optional(), href: z.string().optional() })
export const DocumentoDoCaso = z.object({ nome: z.string(), tipo: z.string(), origem: z.string(), data: dataIso, passo: z.string().optional(), saude: z.boolean().optional(), restrito: z.boolean().optional() })
export const CasoNaTela = z.object({ /* ficha, processo, fase, identificacao, etapas, emPericia, pendentes, esperas, tarefas, linha, prazos, documentos, laudoNovo, juizo, perito, peritoParaIdentificar, visao, valores, estrategia, saude */ })
```

| Endpoint (quando ligar no servidor) | Entrada | Saída | Função de exemplo |
|---|---|---|---|
| `GET /api/casos/:id` | perfil da sessão | `CasoNaTela` na visão do perfil | `obterCaso` |
| `POST /api/casos/:id/perito` | `{ peritoId }` | `CasoNaTela` | `identificarPerito` (usa `ligarPerito` da perícia) |
| `GET /api/juizos/:id/jurimetria` | | números do acervo | `jurimetriaDoJuizoDoCaso` |
| `GET /api/peritos/:id` | | perfil do perito | `perfilDoPeritoDoCaso` |

### Decisões da história

1. **As cinco etapas** (CA1): Entrevista (D1), INSS (D2), Justiça (D3), Vigília (D3a) e Desfecho (D3b). A atual sai do texto da etapa do processo (`etapaAtual`). Deferido no INSS: Justiça, Vigília e Desfecho "não se aplica" (apagadas, tracejadas). Caso que foi direto à Justiça: o INSS não se aplica (`semInss`, nenhum na semente).
2. **"Em perícia"** (CA2): a caixa pontilhada embaixo da etapa que pediu (`etapaDaOrigem`: D2 → INSS, D3 → Justiça, D3a → Vigília), com a situação, e leva à página da perícia.
3. **Setores** (CA3): os laços da exigência (D3a.03) ou do despacho (D3.04), cada setor com "subiu o card" ou "ainda não subiu o card".
4. **Passo concluído** (CA4): clicar numa etapa feita abre o detalhe com quem fez (e se foi pessoa, sistema ou IA), quando, o passo e os documentos.
5. **Laudo novo** (CA5): no cabeçalho do processo e na ficha, com a data, levando a `/casos/:id/laudo-novo`; a análise já mostra a visão do perfil.
6. **Jurimetria** (CA6): clicar no juízo ou no perito abre a sobreposição, só para o Jurídico. Números com o número de casos ao lado, sem amostra mínima (Lucas, 06/10). **Ponta para ligar:** GGVP-59 (jurimetria do perito), GGVP-64 (jurimetria do juízo) e GGVP-131 (acervo que aprende). A janela antiga da perícia (`JurimetriaPerito`, com a amostra mínima do G22) não foi mexida: o G22 vai ser revisto (anotado para o Lucas).
7. **Perito** (CA7): sem perito conhecido e com a perícia marcada ou o nome lido, "Quem é o perito?" com um botão por perito da base (o mesmo da perícia). Nada trava.
8. **Esperas de fora** (CA8): da semente (cliente, Justiça, INSS) e da perícia (o INSS liberar, o comprovante, o resultado). Quem, desde quando, o prazo ou o lembrete.
9. **Tarefas** (CA9): por setor, com responsável, prazo e "em paralelo"; a perícia aberta entra como tarefa de quem cuida dela agora.
10. **Linha** (CA10): a do caso e a da perícia juntas, em ordem (`emOrdem`), agrupadas por etapa, com o selo pessoa, sistema ou IA e o passo.
11. **Documento** (CA11): "Abrir" mostra o tipo, o arquivo, a origem, a data e o passo; laudo para quem não é do Jurídico: só que existe.
12. **Prazos da fase** (CA12): `prazosDaFase` tira a vigília do Meu INSS do judicial e a das publicações do administrativo.
13. **Identificação** (CA13): NB (formatado pela biblioteca `campos`) ou protocolo na administrativa; CNJ com processo judicial.

### Anotado para o Lucas

- "O valor da causa e a renda por pessoa do LOAS": li que a advogada vê esses em qualquer caso; a restrição "do caso dela" ficou só na prestação de contas. Confirmar.
- A Sênior não vê valores (a regra diz só Financeiro e Sócio). Não há perfil "Sócio" no "Trocar perfil" desta branch; a regra já o aceita (`socio`).
- A semente do Antônio tem o número `0000001-00.2025.4.03.0000`, que não passa no dígito do CNJ: aparece como está. A Lúcia ganhou um CNJ válido.

## GGVP-82 · Conversar com o portal em linguagem natural

### Telas e rotas

| Onde | Figma | O que faz |
|---|---|---|
| Centrais (`/`, `/advogada`, `/juridico-administrativo`) | Centrais `11:2`, `59:449`, `2051:173` | "✦ Pergunte ou peça" abaixo da busca: anexar arquivo (um ou vários), gravar áudio (a fala vira texto no campo, pela voz do navegador), enviar texto e as sugestões do perfil; a conversa com as respostas, os links, as fontes e os cartões |
| aba "✦ Suporte" (todas as outras telas) | Overlay · Chat de suporte `60:2`, `60:193` | O mesmo chat num painel à direita, com o perfil de quem age e as sugestões dele; aberto de dentro de um caso, a pergunta sem nome de cliente é sobre ele; explica os portões ("O que é o G8?") |
| respostas e cartões | Atendimento `2052:2`, `2107:2`, `2107:215`, `2186:631`, `2186:405`; Advogada `2052:186`, `2176:2`, `2176:195`, `2176:388`, `2086:2`, `2107:442`, `2107:667`, `2186:2`, `2186:211`; Estagiário `2085:2`, `2107:892`, `2107:1091`, `2186:857`; Sênior `2108:2`, `2107:1276`, `2107:1445`, `2186:1192`, `2186:1039`; Financeiro `2108:163`, `2107:1621`, `2107:1742`; títulos `2110:2` | Resposta com o caso e o passo e o link; recusa com o portão; pergunta de volta com as opções em um clique; cartão "Ação para confirmar" (ou "Fora do seu perfil") com os passos numerados, o que conferir, as travas, a linha "Responsável" com "Trocar", a escolha obrigatória quando há, "Confirmar" e "Cancelar" |

### Um motor só (junção dos três chats)

- `perguntar` (`dados/chat.ts`) é o caminho único de toda pergunta, de toda Central e do Suporte; `confirmarAcao` é o único que executa. `ChatDoPortal` é a casca única; `LaudoPeloChat` e `ChatDaPericia` viraram atalhos para ele, e os testes deles passam sobre o motor.
- As recusas que já valiam viraram o primeiro passo do motor (`recusaImediata`): pular o parecer médico (G17) e pedir para esconder ou mudar a situação real na perícia (G11, a recusa fica registrada). O `ChatIA` chama a mesma função, na hora.
- Os casos de antes viraram casos do motor, com as mesmas funções da perícia: "perícias para marcar", "o cliente me ligou" (com o lembrete de confirmar a identidade no Atendimento; com a orientação pronta no Jurídico administrativo), "dica para a perícia", "perícias da semana" e o comprovante do INSS anexado. O laudo novo do Atendimento segue o card da GGVP-17.
- Testes antigos que mudaram de propósito: "enviar sem servidor avisa que não está ligado" (Central do Atendimento e LaudoPeloChat) passou a esperar a resposta do motor; "Suporte e Gravar áudio indisponíveis" passou a abrir o Suporte e a avisar quando o navegador não transforma fala em texto; "como o perito avalia" passou a mostrar a porcentagem com o número de laudos, sem amostra mínima (Lucas, 06/10); a resposta agora vem do servidor, então "Perícias para marcar" espera a resposta (`findByText`). Dois testes de navegador da perícia tinham a data de 07/10 escrita no texto: passaram a aceitar qualquer data.

### Contrato (`packages/contratos/src/chat.ts`)

`PerguntaDoChat` (texto, anexos com nome e tamanho, `processoId` do contexto), `RespostaDoChat` (`tipo`: resposta, recusa, pergunta ou ação; `sugestao`; `links`; `portao`; `opcoes`; `acao`), `CartaoDeAcao` (tipo, título, cliente, processo, passos, o que conferir, travas, responsável, fora do perfil, escolha, rótulo do botão) e `ConfirmacaoDoCartao`. `FonteDaIa` e `SugestaoDaIa` têm o mesmo nome e a mesma forma das de `packages/contratos/src/ia.ts` do pedido #26.

**Ponta para ligar no motor de IA** (pedido #26, `feat/GGVP-14-ia-juridica`, Mateus): na junção, `FonteDaIa` e `SugestaoDaIa` saem de `chat.ts` e passam a vir de `./ia.ts`; `perguntar` vira `POST /api/chat` e a `sugestao` passa a vir do motor (com as fontes e o modelo de verdade, a chamada registrada para auditoria). As recusas, os portões, a regra do responsável, a lista fixa das ações, as permissões e os números ficam no servidor, como código, antes e depois do modelo. Aqui a IA é simulada no servidor de exemplo (`modelo: 'simulado · servidor de exemplo'`).

| Endpoint (quando ligar no servidor) | Entrada | Saída | Função de exemplo |
|---|---|---|---|
| `POST /api/chat` | `PerguntaDoChat` + perfil da sessão | `RespostaDoChat` | `perguntar` |
| `POST /api/chat/acoes/:id` | `ConfirmacaoDoCartao` + os arquivos | o resultado | `confirmarAcao` |
| `DELETE /api/chat/acoes/:id` | | | `cancelarAcao` |
| `GET /api/tarefas?criadasPeloChat` | perfil da sessão | `Tarefa[]` | `tarefasCriadasPeloChat` |

### Decisões da história

1. **Consulta** (CA1): o cliente citado (`identificarCliente`) ou o caso do contexto; a resposta diz a etapa, o passo, a identificação, a próxima ação, a perícia, os setores que faltam e as esperas, na visão do perfil (`obterCaso`), com o link "Abrir o caso". Lead sem processo: a ficha.
2. **Sem acesso** (CA2): valores seguem `podeVerValor`; jurimetria e dica da perícia só o Jurídico. A recusa diz que não tem acesso e não traz o dado.
3. **Cartão** (CA3): `perguntar` só monta o cartão e guarda a ação pendente no servidor; `confirmarAcao` executa; "Cancelar" apaga a pendente. Só quem pediu confirma.
4. **Portões** (CA4, `portaoDoPedido`): protocolar no INSS sem o OK do sênior (G2); protocolar na Justiça (G7); aprovar parecer (G17), despacho (G4), exigência (G5), petição (G6); avisar o cliente (G8, e o chat não fala com o cliente); calcular valor ou honorários (G19); a senha do gov.br (G9, nunca devolvida); escolher ou sugerir o perito (a IA não escolhe).
5. **Histórico** (CA5): toda ação confirmada entra na linha do caso com o nome, a hora e "feito pelo chat"; a tarefa criada aparece no caso ("criada pelo chat") e na Central de quem vai fazer.
6. **Responsável** (CA7, `responsavelDaTarefa`): cita a pessoa, é ela; cita só o setor, o chat pergunta quem do setor; ninguém, pergunta quem é; "para mim", quem pediu. "Trocar" lista as pessoas do escritório; trocada a pessoa, a ação do título vem da lista dela quando o pedido cita uma.
7. **Fora do perfil** (CA8, `foraDoPerfil`): petição ou peça fora da advogada e da sênior; marcar perícia fora do Jurídico; acervo fora da sênior. A recusa diz de quem é e o cartão "Criar tarefa para" quem pode.
8. **Título** (CA9): "cliente · ação" com a ação da lista fixa do perfil de quem vai fazer (`ACOES_DO_PERFIL`, Glossário 2110:2); sem ação da lista no pedido, o chat pergunta qual. Sem cliente, o contexto ("Acervo").
9. **Jurimetria** (CA10): os números são do sistema (`taxaComCasos`, `perfilDoPerito`, `jurimetriaDoJuizo`), com o número de casos ao lado, sem amostra mínima; a resposta cita as fontes (a regra e os laudos do acervo).
10. **Perícias da semana** (CA11): `periciasDaSemana` da perícia; cada item abre `/casos/:id/pericia`, não a Agenda.
11. **Anexos** (CA12, `tipoDoAnexo`): laudo novo (o Atendimento não vê o conteúdo), comprovante do INSS (a IA não escolhe nem sugere o perito; a pergunta do documento novo antes de confirmar), comprovante de RPV no Financeiro (o valor vem do comprovante, a IA não calcula honorários, G19; a advogada recebe "Aprovar prestação de contas" e o aviso só depois do OK, G8), lote de PDFs para o acervo na sênior (o que não dá para ler fica de fora, nada trava; ponta da GGVP-131) e documento comum.
12. **Gravar áudio** (CA6): a fala vira texto no campo pela voz do navegador (Chrome e Edge), para a pessoa conferir antes de enviar; sem ela, o chat avisa.
13. **Pedir a peça** (fora do escopo: escrever): a advogada pede a minuta com um cartão; a minuta entra na tarefa "Conferir petição" dela (G6). Quem escreve é a GGVP-63.

### Anotado para o Lucas

- As Centrais da Sênior e do Financeiro ainda não existem neste repositório (são de outras histórias): para esses perfis, o chat fica na aba Suporte, com as sugestões do Figma.
- "Marca a perícia do Pedro" vira tarefa para o Jurídico administrativo quando a advogada pede; o Jurídico administrativo marca anexando o comprovante (o cartão vem com ele). Marcar entrevista abre a agenda do cliente.
- O "Falar com uma pessoa" do Suporte (Chatwoot) ficou de fora: é a GGVP-102.
