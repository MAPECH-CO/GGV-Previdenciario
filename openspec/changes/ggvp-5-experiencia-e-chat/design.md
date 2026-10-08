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
