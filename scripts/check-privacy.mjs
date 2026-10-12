#!/usr/bin/env node
/**
 * Privacy gate for a public repo: fails if any file that is (or would be) committed contains
 * a personal filesystem path, a cloud-storage folder, a scratch/temp path, an e-mail address,
 * or the local user's own account name / git identity.
 *
 * The personal values are read from the machine at run time (os.userInfo, git config) and are
 * never written into the repo. Patterns below are generic.
 *
 *   npm run check:privacy            # scan
 *   npm run check:privacy -- --list  # also print the files scanned
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { userInfo } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = /^(node_modules|dist|test-results|playwright-report|blob-report|coverage)\//;
const SELF = 'scripts/check-privacy.mjs';
const MAX_BYTES = 20 * 1024 * 1024;

/** Generic patterns: [label, regex]. Keep them generic — no real names here. */
const PATTERNS = [
  ['macOS home path', /\/Users\/(?!Shared\b)[A-Za-z0-9._-]{2,}/],
  ['Linux home path', /(?<![\w#.\-/])\/home\/(?!runner\b)[a-z_][a-z0-9._-]{1,}\//],
  ['Windows profile path', /[A-Za-z]:[\\/]+(?:Users|Documents and Settings)[\\/]+[A-Za-z0-9._ -]{2,}/i],
  ['cloud-storage folder', /\b(?:OneDrive(?:\s?-\s?[^/\\\n]+)?[\\/]|Dropbox[\\/]|Google ?Drive[\\/]|GoogleDrive-|Mobile Documents[\\/]|iCloud ?Drive[\\/]|CloudStorage[\\/])/],
  ['temp/scratch path', /\/private\/(?:tmp|var)\/|\/var\/folders\/[\w]+\/|\/tmp\/claude-|claude-\d{2,}\/|\/scratchpad\//],
  ['e-mail address', /[A-Za-z0-9._%+-]+@(?!example\.(?:com|org|net)\b)(?!users\.noreply\.github\.com\b)(?!anthropic\.com\b)[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.(?:com|net|org|io|dev|co|uk|edu|me|app|ai)\b/],
];

/** Things that look like e-mails but are not (npm scopes, git URLs, @font-face, decorators). */
const EMAIL_ALLOW = [/^git@github\.com$/i, /^noreply@/i, /^no-reply@/i];

function sh(cmd, args) {
  try {
    return execFileSync(cmd, args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

/** Personal tokens from this machine (never persisted). */
function personalTokens() {
  const out = new Set();
  const add = (v) => {
    const s = (v ?? '').trim();
    if (s.length >= 4 && !/^(runner|root|user|admin|ubuntu|node|github-actions.*|vscode|codespace)$/i.test(s)) out.add(s);
  };
  try {
    add(userInfo().username);
  } catch {
    /* no user */
  }
  const name = sh('git', ['config', 'user.name']);
  add(name);
  // Surname / distinctive parts of the git name (first names alone are too common to scan for).
  name.split(/\s+/).slice(1).forEach(add);
  add(sh('git', ['config', 'user.email']));
  const email = sh('git', ['config', 'user.email']);
  if (email.includes('@')) add(email.split('@')[1]?.split('.')[0]); // e-mail domain label
  return [...out].filter((t) => !/^(gmail|outlook|hotmail|yahoo|icloud|proton|users)$/i.test(t));
}

function listFiles() {
  const out = sh('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard']);
  if (!out) {
    console.error('check-privacy: git is required (run inside the repo).');
    process.exit(2);
  }
  return [...new Set(out.split('\0').filter(Boolean))].filter((f) => !SKIP_DIRS.test(f) && existsSync(join(root, f)));
}

const files = listFiles();
const tokens = personalTokens().map((t) => [`local identity (${'*'.repeat(Math.min(t.length, 6))})`, new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')]);
const findings = [];

for (const f of files) {
  const p = join(root, f);
  let st;
  try {
    st = statSync(p);
  } catch {
    continue;
  }
  if (!st.isFile() || st.size > MAX_BYTES) continue;
  // latin1 keeps byte offsets 1:1 and lets us scan binary metadata (PNG tEXt, WAV LIST) too.
  const text = readFileSync(p).toString('latin1');
  // Scan the path itself as well (a file named after a person is a leak too).
  const subjects = [['path', f], ['content', text]];
  for (const [where, s] of subjects) {
    // This script contains the generic patterns themselves; only the identity tokens apply to it.
    const rules = f === SELF ? tokens : [...PATTERNS, ...tokens];
    for (const [label, re] of rules) {
      const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
      let m;
      while ((m = g.exec(s))) {
        if (label === 'e-mail address' && EMAIL_ALLOW.some((a) => a.test(m[0]))) continue;
        const line = where === 'path' ? 0 : s.slice(0, m.index).split('\n').length;
        findings.push(`${f}${line ? `:${line}` : ' (file name)'}  ${label}: ${label.startsWith('local identity') ? '[redacted]' : JSON.stringify(m[0].slice(0, 80))}`);
        if (findings.length > 500) break;
      }
    }
  }
}

if (process.argv.includes('--list')) console.log(files.join('\n'));
if (findings.length) {
  console.error(`check-privacy: ${findings.length} problem(s) in files that would be committed:\n`);
  console.error(findings.map((x) => '  ' + x).join('\n'));
  console.error('\nRemove personal paths/names/e-mails (use relative paths or os.tmpdir() in tests).');
  process.exit(1);
}
console.log(`check-privacy: OK (${files.length} files scanned, ${tokens.length} local identity token(s) checked)`);
