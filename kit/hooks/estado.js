#!/usr/bin/env node
// Hook UserPromptSubmit do kit. Nunca bloqueia. Só lembra ao Claude em que ponto o épico está.
// Entrada: JSON do Claude Code no stdin. Saída: JSON com additionalContext (ou nada).
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function sh(cmd, cwd) {
  try { return execSync(cmd, { cwd, stdio: ['ignore', 'pipe', 'ignore'], timeout: 4000 }).toString().trim(); }
  catch { return ''; }
}

// Lê o tasks.md da change do épico: uma seção "## GGVP-n · título" por história.
function lerTarefas(arquivo) {
  let t;
  try { t = fs.readFileSync(arquivo, 'utf8'); } catch { return null; }
  const secoes = [];
  let atual = null;
  for (const linha of t.split(/\r?\n/)) {
    const h = linha.match(/^##\s+(GGVP-\d+)\s*[·:-]?\s*(.*)$/i);
    if (h) { atual = { chave: h[1].toUpperCase(), titulo: h[2].trim(), feitas: 0, abertas: 0 }; secoes.push(atual); continue; }
    if (!atual) continue;
    if (/^\s*- \[[xX]\]/.test(linha)) atual.feitas++;
    else if (/^\s*- \[ \]/.test(linha)) atual.abertas++;
  }
  return secoes;
}

function main() {
  let entrada = '';
  try { entrada = fs.readFileSync(0, 'utf8'); } catch { /* sem stdin */ }
  let cwd = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  try { const j = JSON.parse(entrada || '{}'); if (j.cwd && fs.existsSync(j.cwd)) cwd = j.cwd; } catch { /* ignora */ }

  const raiz = sh('git rev-parse --show-toplevel', cwd) || cwd;
  const branch = sh('git rev-parse --abbrev-ref HEAD', raiz) || '?';
  const m = branch.match(/GGVP-(\d+)/i);
  const linhas = [];

  if (!m) {
    linhas.push(`Kit GGV · branch \`${branch}\`, sem épico.`);
    linhas.push('Se o pedido é desenvolvimento: não escreva código aqui. Responda só "digite /epico <nome do épico>". O /epico cria a branch e a change do épico.');
  } else {
    const epico = `GGVP-${m[1]}`;
    const dirChanges = path.join(raiz, 'openspec', 'changes');
    let change = null;
    try {
      change = fs.readdirSync(dirChanges, { withFileTypes: true })
        .filter(d => d.isDirectory() && d.name !== 'archive' && d.name.toLowerCase().startsWith(`ggvp-${m[1]}-`))
        .map(d => d.name)[0] || null;
    } catch { /* sem openspec */ }

    if (!change) {
      linhas.push(`Kit GGV · épico ${epico}, branch \`${branch}\`, SEM change do épico em openspec/changes/.`);
      linhas.push('Não escreva código antes de o /epico criar a change (proposal, design, tasks). Só história em "Refinada" no Jira vira código.');
    } else {
      const secoes = lerTarefas(path.join(dirChanges, change, 'tasks.md')) || [];
      const feitas = secoes.filter(s => s.abertas === 0 && s.feitas > 0).length;
      const atual = secoes.find(s => s.abertas > 0);
      linhas.push(`Kit GGV · épico ${epico}, change \`${change}\`, ${feitas} história(s) com tarefas todas marcadas.`);
      if (atual) {
        linhas.push(`História atual: ${atual.chave} · ${atual.titulo || ''} · ${atual.feitas}/${atual.feitas + atual.abertas} tarefas. Uma tarefa por vez, com teste e saída na tela. Ao terminar ou depois de cada ajuste: verificações e a pergunta "Agora ok?". Com o ok: commit com a chave da história, push, cartão para "Em análise", próxima história. Sem subagente. Menor mudança que cumpre o critério. Fale simples: sem id de tela, de card ou nome de arquivo na conversa.`);
      } else {
        linhas.push('Nenhuma história aberta no tasks.md. Próxima: a primeira do épico em "Refinada" e sem responsável, na ordem de kit/entrega-09-10.md. Nenhuma refinada: liste o que falta e quem revisa, e pare.');
      }
    }
  }

  const saida = { hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: linhas.join(' ') } };
  process.stdout.write(JSON.stringify(saida));
}

try { main(); } catch { /* nunca derruba o prompt */ }
process.exit(0);
