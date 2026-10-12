/**
 * A small English "sounds-like" key tuned for early-reader vocabulary.
 *
 * Unlike classic Metaphone (which drops vowels, so bat = bit = but), this key keeps a
 * coarse vowel class, because for reading practice "cat" vs "cut" is exactly the mistake
 * we must not accept. It folds silent letters (kn, wr, gh, mb, magic-e), common digraphs
 * and spelling variants so true homophones collide: night/knight, right/write, gray/grey,
 * see/sea, new/knew, rode/road, tail/tale.
 *
 * Symbols: consonants are lowercase letters (c = ch, s = sh/s, t = th…), long vowels are
 * uppercase A E I O U, R = r-coloured vowel (er/ir/ur/ar/or), W = ow/ou, Y = oi/oy.
 */

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

/** Words ending in "ow" said like "now" (the rest — snow, grow, know, yellow — end in long O). */
const OW_AS_IN_NOW = new Set(['now', 'how', 'cow', 'wow', 'vow', 'pow', 'brow', 'plow', 'chow', 'allow', 'eyebrow', 'meow', 'somehow']);

function isVowel(ch: string | undefined): boolean {
  return ch !== undefined && VOWELS.has(ch);
}

export function phoneticKey(word: string): string {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return '';

  // Irregular sight words whose spelling misleads the rules below.
  const IRREGULAR: Record<string, string> = { of: 'uv', are: 'ar', through: 'thrU' };
  if (IRREGULAR[w]) w = IRREGULAR[w];
  // "ow" as in now/cow (not snow/grow).
  if (OW_AS_IN_NOW.has(w)) w = w.replace(/ow$/, 'W');
  // ough: tough/rough/enough (uf), cough (of), thought/bought (ot); though/dough stay long O.
  w = w.replace(/^(t|r|en|sl)ough/, '$1uf').replace(/^cough/, 'cof').replace(/ought/, 'ot');
  // guide/guile: the u is silent.
  w = w.replace(/^gui([a-z])e$/, 'gi$1e');
  // Soft c / g before a final e: face (fAs), force (fors), page (pAj).
  w = w.replace(/ce$/, 'se').replace(/([^d])ge$/, '$1je');
  // Irregular "-ere" words: were (wur) vs where/there (air).
  if (w === 'were') w = 'wur';
  else if (/^(th|wh|)ere$/.test(w) || w === 'where' || w === 'there') w = w.replace(/ere$/, 'air');
  // Initial silent / special clusters.
  w = w.replace(/^kn/, 'n').replace(/^gn/, 'n').replace(/^wr/, 'r').replace(/^ps/, 's').replace(/^pn/, 'n').replace(/^wh/, 'w');
  w = w.replace(/^x/, 'z');
  // Final clusters.
  w = w.replace(/mb$/, 'm').replace(/gn$/, 'n');

  // Magic e: V C e at the end makes the vowel long ("make", "bike", "home", "cute", "these").
  let magic = false;
  const me = /([aeiou])([bcdfgklmnprstvz])e$/.exec(w);
  if (me && w.length >= 3) {
    const vi = w.length - 3;
    // Only when that vowel is a single vowel (not part of a digraph like "ou" in "house").
    if (!isVowel(w[vi - 1])) {
      magic = true;
      w = w.slice(0, vi) + me[1].toUpperCase() + me[2];
    }
  }
  // Remaining silent final e after a consonant ("have", "give", "little" keeps le).
  if (!magic && w.length > 2 && w.endsWith('e') && !isVowel(w[w.length - 2]) && !w.endsWith('le')) w = w.slice(0, -1);

  const out: string[] = [];
  const push = (s: string) => {
    if (out.length && out[out.length - 1] === s) return; // collapse doubles
    out.push(s);
  };

  let i = 0;
  const at = (k: number) => w[k];
  const rest = (k: number) => w.slice(k);
  while (i < w.length) {
    const r = rest(i);
    const c = at(i);
    const last = i === w.length - 1;
    // Long-vowel uppercase markers from magic-e.
    if (/[AEIOU]/.test(c)) {
      push(c);
      i += 1;
      continue;
    }
    // --- multi-letter vowel patterns (longest first)
    if (r.startsWith('eigh')) { push('A'); i += 4; continue; }
    if (r.startsWith('igh')) { push('I'); i += 3; continue; }
    if (r.startsWith('ough')) { push('O'); i += 4; continue; }
    if (r.startsWith('augh')) { push('o'); i += 4; continue; }
    if (r.startsWith('ear') && !r.startsWith('earl') && !r.startsWith('eart')) { push('E'); push('r'); i += 3; continue; }
    if (r.startsWith('air') || r.startsWith('are') || r.startsWith('ear')) { push('A'); push('r'); i += 3; continue; }
    if (r.startsWith('ee') || r.startsWith('ea')) { push('E'); i += 2; continue; }
    if (r.startsWith('ie') && i + 2 < w.length) { push('E'); i += 2; continue; }
    if (r.startsWith('ie') && last === false) { push('I'); i += 2; continue; }
    if (r === 'ie') { push('I'); i += 2; continue; }
    if (r === 'ey' || r === 'ay' || r.startsWith('ai') || r.startsWith('ay') || r.startsWith('ei') || r.startsWith('ey')) { push('A'); i += 2; continue; }
    if (r.startsWith('oa') || r.startsWith('oe')) { push('O'); i += 2; continue; }
    if (r === 'ow') { push('O'); i += 2; continue; } // snow, grow, show (final ow)
    if (r.startsWith('ow') || r.startsWith('ou')) { push('W'); i += 2; continue; }
    if (r.startsWith('oo')) { push('U'); i += 2; continue; }
    if (r.startsWith('oi') || r.startsWith('oy')) { push('Y'); i += 2; continue; }
    if (r.startsWith('au') || r.startsWith('aw')) { push('o'); i += 2; continue; }
    if (r.startsWith('ue') || r.startsWith('ew') || r.startsWith('ui')) { push('U'); i += 2; continue; }
    if (/^(er|ir|ur)/.test(r)) { push('R'); i += 2; continue; }
    if (r.startsWith('ar')) { push('a'); push('r'); i += 2; continue; }
    if (r.startsWith('or')) { push('o'); push('r'); i += 2; continue; }
    // --- consonant patterns
    if (r.startsWith('tch')) { push('c'); i += 3; continue; }
    if (r.startsWith('dge')) { push('j'); i += 3; continue; }
    if (r.startsWith('chr')) { push('k'); push('r'); i += 3; continue; }
    if (r.startsWith('ch')) { push('c'); i += 2; continue; }
    if (r.startsWith('sh')) { push('s'); push('h'); i += 2; continue; }
    if (r.startsWith('th')) { push('t'); push('h'); i += 2; continue; }
    if (r.startsWith('ph')) { push('f'); i += 2; continue; }
    if (r.startsWith('gh')) { if (i === 0) push('g'); i += 2; continue; }
    if (r.startsWith('ck')) { push('k'); i += 2; continue; }
    if (r.startsWith('wh')) { push('w'); i += 2; continue; }
    if (r.startsWith('qu')) { push('k'); push('w'); i += 2; continue; }
    if (r.startsWith('ng')) { push('n'); push('g'); i += 2; continue; }
    if (c === 'c') { push(/[eiy]/.test(at(i + 1) ?? '') ? 's' : 'k'); i += 1; continue; }
    if (c === 'g' && last === false && at(i + 1) === 'e' && i + 2 === w.length) { push('j'); i += 2; continue; }
    if (c === 'q') { push('k'); i += 1; continue; }
    if (c === 'x') { push('k'); push('s'); i += 1; continue; }
    if (c === 'z') { push('z'); i += 1; continue; }
    if (c === 'y') {
      if (i === 0 && isVowel(at(i + 1))) { push('y'); i += 1; continue; }
      // final y: "my", "fly" → I ; "happy", "baby" → E
      if (last) { push(out.some((s) => /[aeiouAEIOURWY]/.test(s)) ? 'E' : 'I'); i += 1; continue; }
      push('i');
      i += 1;
      continue;
    }
    if (c === 'w' && !isVowel(at(i + 1)) && i > 0) { i += 1; continue; } // "saw"-type handled above; stray w silent
    if (c === 'h' && i > 0 && !isVowel(at(i + 1))) { i += 1; continue; } // silent h
    push(c);
    i += 1;
  }
  // Final single "o" in short words is long ("go", "no", "so").
  if (out.length >= 2 && out[out.length - 1] === 'o' && w.endsWith('o')) out[out.length - 1] = 'O';
  // Final "e" as only vowel in short words is long ("me", "he", "we", "be").
  if (out.length === 2 && out[1] === 'e' && w.length === 2) out[1] = 'E';
  return out.join('');
}

/** First consonant/vowel sound — differing onsets are the classic minimal pair (bed/red). */
export function onsetOf(key: string): string {
  return key.slice(0, 1);
}
