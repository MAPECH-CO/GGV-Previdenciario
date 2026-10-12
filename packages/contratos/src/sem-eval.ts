// GGVP-158: no navegador, o zod não tenta o `eval` (JIT). A CSP do portal o barra, e cada tentativa suja o console.
// No servidor, sem CSP, o JIT segue ligado. Fica à parte e é o primeiro import do index.ts porque o zod decide o JIT
// quando cada schema nasce.
import { z } from 'zod'

if (typeof document !== 'undefined') z.config({ jitless: true })
