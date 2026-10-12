// GGVP-158: no navegador, o zod não tenta o `eval` (JIT). A CSP do portal o barra, e cada tentativa suja o console.
// No servidor, sem CSP, o JIT segue ligado. Fica à parte e é o primeiro import do index.ts porque o zod decide o JIT
// quando cada schema nasce. O teste pelo `globalThis` vale também nos arquivos do Node que importam os contratos (os
// ajudantes do Playwright), que não conhecem o tipo do `document`.
import { z } from 'zod'

if ('document' in globalThis) z.config({ jitless: true })
