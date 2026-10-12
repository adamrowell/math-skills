/**
 * Story Problems cast: names and themed "things" (block world, animals, space, sports, party).
 * Each thing knows how to phrase the start, a gain, a loss, groups and sharing in plain words
 * a 7-year-old can read (short sentences, present tense, singular/plural handled here).
 */

export type Theme = 'blocks' | 'animals' | 'space' | 'sports' | 'party';

export const THEMES: Record<Theme, { title: string; emoji: string }> = {
  blocks: { title: 'Block world', emoji: '🧱' },
  animals: { title: 'Animals', emoji: '🐾' },
  space: { title: 'Space', emoji: '🚀' },
  sports: { title: 'Sports', emoji: '⚽' },
  party: { title: 'Party', emoji: '🎉' },
};

/** Twelve first names, short and easy to decode. */
export const NAMES = ['Sam', 'Mia', 'Leo', 'Ava', 'Max', 'Zoe', 'Ben', 'Lily', 'Omar', 'Ruby', 'Jack', 'Nina'] as const;

export interface Thing {
  id: string;
  theme: Theme;
  one: string;
  many: string;
  emoji: string;
  /** Owned things read "{name} has 5 …"; sightings read "{name} sees 5 …". */
  owned: boolean;
  /** Works with numbers above 20 (diamonds yes, soccer goals no). */
  big: boolean;
  /** "{name} mines 3 more." */
  gain: (name: string, n: number) => string;
  /** "{name} drops 3 of them in the lava." */
  lose: (name: string, n: number) => string;
  /** Container for equal groups: ['chest', 'chests']. */
  holder: [string, string];
  /** The holder is something you can put things into ("puts them into 3 chests"). */
  container?: boolean;
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

const them = (n: number) => (n === 1 ? '1 of them' : `${n} of them`);

export const THINGS: Thing[] = [
  // ---- block world ----
  {
    id: 'diamonds', theme: 'blocks', one: 'diamond', many: 'diamonds', emoji: '💎', owned: true, big: true,
    gain: (p, n) => `${p} mines ${n} more.`,
    lose: (p, n) => `${p} drops ${them(n)} in the lava.`,
    holder: ['chest', 'chests'], container: true,
  },
  {
    id: 'blocks', theme: 'blocks', one: 'block', many: 'blocks', emoji: '🧱', owned: true, big: true,
    gain: (p, n) => `${p} digs up ${n} more.`,
    lose: (_p, n) => `A creeper blows up ${them(n)}.`,
    holder: ['tower', 'towers'],
  },
  {
    id: 'carrots', theme: 'blocks', one: 'carrot', many: 'carrots', emoji: '🥕', owned: true, big: true,
    gain: (p, n) => `${p} grows ${n} more.`,
    lose: (_p, n) => `A hungry pig eats ${them(n)}.`,
    holder: ['basket', 'baskets'], container: true,
  },
  {
    id: 'zombies', theme: 'blocks', one: 'zombie', many: 'zombies', emoji: '🧟', owned: false, big: false,
    gain: (_p, n) => `${n} more ${n === 1 ? 'zombie comes' : 'zombies come'} out of the cave.`,
    lose: (p, n) => `${p} chases ${them(n)} away.`,
    holder: ['cave', 'caves'],
  },
  // ---- animals ----
  {
    id: 'fish', theme: 'animals', one: 'fish', many: 'fish', emoji: '🐟', owned: false, big: true,
    gain: (_p, n) => `${n} more fish ${n === 1 ? 'swims' : 'swim'} over.`,
    lose: (_p, n) => `${n === 1 ? '1 of them swims' : `${n} of them swim`} away.`,
    holder: ['tank', 'tanks'],
  },
  {
    id: 'ducks', theme: 'animals', one: 'duck', many: 'ducks', emoji: '🦆', owned: false, big: false,
    gain: (_p, n) => `${n} more ${n === 1 ? 'duck lands' : 'ducks land'} on the pond.`,
    lose: (_p, n) => `${n === 1 ? '1 of them flies' : `${n} of them fly`} away.`,
    holder: ['pond', 'ponds'],
  },
  {
    id: 'frogs', theme: 'animals', one: 'frog', many: 'frogs', emoji: '🐸', owned: false, big: false,
    gain: (_p, n) => `${n} more ${n === 1 ? 'frog hops' : 'frogs hop'} onto the log.`,
    lose: (_p, n) => `${n === 1 ? '1 of them jumps' : `${n} of them jump`} into the water.`,
    holder: ['log', 'logs'],
  },
  {
    id: 'bones', theme: 'animals', one: 'bone', many: 'bones', emoji: '🦴', owned: true, big: true,
    gain: (p, n) => `${p}'s puppy digs up ${n} more.`,
    lose: (p, n) => `${p}'s puppy buries ${them(n)}.`,
    holder: ['bowl', 'bowls'], container: true,
  },
  // ---- space ----
  {
    id: 'stars', theme: 'space', one: 'star', many: 'stars', emoji: '⭐', owned: false, big: true,
    gain: (_p, n) => `${n} more ${n === 1 ? 'star comes' : 'stars come'} out.`,
    lose: (_p, n) => `A cloud hides ${them(n)}.`,
    holder: ['sky', 'skies'],
  },
  {
    id: 'rockets', theme: 'space', one: 'rocket', many: 'rockets', emoji: '🚀', owned: false, big: false,
    gain: (_p, n) => `${n} more ${n === 1 ? 'rocket lands' : 'rockets land'} on the moon.`,
    lose: (_p, n) => `${n === 1 ? '1 of them blasts' : `${n} of them blast`} off to Mars.`,
    holder: ['launch pad', 'launch pads'],
  },
  {
    id: 'moonrocks', theme: 'space', one: 'moon rock', many: 'moon rocks', emoji: '🪨', owned: true, big: true,
    gain: (p, n) => `${p} finds ${n} more on the moon.`,
    lose: (p, n) => `${p} gives ${them(n)} to a friendly alien.`,
    holder: ['bag', 'bags'], container: true,
  },
  {
    id: 'aliens', theme: 'space', one: 'alien', many: 'aliens', emoji: '👽', owned: false, big: false,
    gain: (_p, n) => `${n} more ${n === 1 ? 'alien climbs' : 'aliens climb'} out of a spaceship.`,
    lose: (_p, n) => `${n === 1 ? '1 of them zooms' : `${n} of them zoom`} home.`,
    holder: ['spaceship', 'spaceships'],
  },
  // ---- sports ----
  {
    id: 'points', theme: 'sports', one: 'point', many: 'points', emoji: '🏀', owned: true, big: true,
    gain: (p, n) => `${p} scores ${n} more in the game.`,
    lose: (p, n) => `${p} loses ${them(n)} for a foul.`,
    holder: ['game', 'games'],
  },
  {
    id: 'balls', theme: 'sports', one: 'soccer ball', many: 'soccer balls', emoji: '⚽', owned: true, big: false,
    gain: (p, n) => `The coach gives ${p} ${n} more.`,
    lose: (_p, n) => `${n === 1 ? '1 of them rolls' : `${n} of them roll`} over the fence.`,
    holder: ['net bag', 'net bags'], container: true,
  },
  {
    id: 'medals', theme: 'sports', one: 'medal', many: 'medals', emoji: '🏅', owned: true, big: false,
    gain: (p, n) => `${p} wins ${n} more at the races.`,
    lose: (p, n) => `${p} gives ${them(n)} to the team.`,
    holder: ['box', 'boxes'], container: true,
  },
  // ---- party ----
  {
    id: 'cookies', theme: 'party', one: 'cookie', many: 'cookies', emoji: '🍪', owned: true, big: true,
    gain: (p, n) => `${p} bakes ${n} more.`,
    lose: (p, n) => `${p} eats ${them(n)}. Yum!`,
    holder: ['box', 'boxes'], container: true,
  },
  {
    id: 'balloons', theme: 'party', one: 'balloon', many: 'balloons', emoji: '🎈', owned: true, big: true,
    gain: (p, n) => `${p} blows up ${n} more.`,
    lose: (_p, n) => `Pop! ${n === 1 ? '1 of them bursts' : `${n} of them burst`}.`,
    holder: ['bunch', 'bunches'],
  },
  {
    id: 'stickers', theme: 'party', one: 'sticker', many: 'stickers', emoji: '🌟', owned: true, big: true,
    gain: (p, n) => `${p} gets ${n} more from the teacher.`,
    lose: (p, n) => `${p} sticks ${them(n)} on a card for Grandma.`,
    holder: ['envelope', 'envelopes'], container: true,
  },
];

export function startLine(t: Thing, name: string, n: number): string {
  return t.owned ? `${name} has ${plural(n, t.one, t.many)}.` : `${name} sees ${plural(n, t.one, t.many)}.`;
}

/** "How many diamonds does Mia have now?" / "How many ducks are there now?" / "… are left?" */
export function nowQuestion(t: Thing, name: string, word: 'now' | 'left' = 'now'): string {
  if (t.owned) return `How many ${t.many} does ${name} have ${word}?`;
  return word === 'left' ? `How many ${t.many} are left?` : `How many ${t.many} are there now?`;
}

/** "Mia has 5 diamonds now." / "There are 5 ducks now." / "1 frog is left." */
export function nowAnswer(t: Thing, name: string, n: number, word: 'now' | 'left' = 'now'): string {
  if (t.owned) return `${name} has ${plural(n, t.one, t.many)} ${word}.`;
  const be = n === 1 && t.one !== t.many ? 'is' : 'are';
  return word === 'left' ? `${plural(n, t.one, t.many)} ${be} left.` : `There ${be} ${plural(n, t.one, t.many)} now.`;
}
