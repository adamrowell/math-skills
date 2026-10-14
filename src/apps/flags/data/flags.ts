/**
 * Flag catalog for the Flags app (docs/GEO-LOGIC.md §C.2).
 * Images: `public/flags/4x3/<cc>.svg`, copied from the `flag-icons` package (MIT) by
 * scripts/copy-flags.mjs — every f(code, …) entry below is picked up by that script.
 */

export type Continent = 'Africa' | 'Asia' | 'Europe' | 'North America' | 'South America' | 'Oceania';

export interface FlagDef {
  /** ISO 3166 alpha-2, lower case = image file name. */
  cc: string;
  /** ISO 3166 numeric = COUNTRIES_MAP region id. */
  id: string;
  /** Kid-facing name; matches the Maps country label. */
  name: string;
  tier: 1 | 2 | 3;
  /** Dominant colours: r g b y w k(black) o(orange) p(purple) l(light blue) — used for distractors. */
  colors: string;
  /** Look-alike group ids (LOOKALIKES). */
  groups: string[];
  continent: Continent;
  /** One kid sentence (≤ 14 words). */
  fact: string;
}

const f = (
  cc: string,
  id: string,
  name: string,
  tier: 1 | 2 | 3,
  continent: Continent,
  colors: string,
  groups: string[],
  fact: string,
): FlagDef => ({ cc, id, name, tier, continent, colors, groups, fact });

const EU: Continent = 'Europe';
const AF: Continent = 'Africa';
const AS: Continent = 'Asia';
const NA: Continent = 'North America';
const SA: Continent = 'South America';
const OC: Continent = 'Oceania';

export const FLAGS: FlagDef[] = [
  // Tier 1 — Famous flags (16)
  f('us', '840', 'United States', 1, NA, 'rwb', ['stars-stripes'], 'Stars and stripes: 50 stars, one for each state.'),
  f('ca', '124', 'Canada', 1, NA, 'rw', ['red-white-red', 'red-white-symbol'], "A red maple leaf — the tree's leaves turn red in fall."),
  f('gb', '826', 'United Kingdom', 1, EU, 'rwb', ['southern-cross'], 'The Union Jack mixes crosses from England, Scotland and Ireland.'),
  f('fr', '250', 'France', 1, EU, 'bwr', ['vertical-bwr'], 'Blue, white, red stripes — the French tricolore.'),
  f('jp', '392', 'Japan', 1, AS, 'wr', ['red-white-symbol'], 'A red sun on white — the Land of the Rising Sun.'),
  f('br', '076', 'Brazil', 1, SA, 'gyb', ['green-yellow'], 'A green field, a yellow diamond and a starry night sky.'),
  f('cn', '156', 'China', 1, AS, 'ry', ['red-yellow-star'], 'Red with five yellow stars.'),
  f('au', '036', 'Australia', 1, OC, 'bwr', ['southern-cross'], 'The Union Jack plus the Southern Cross stars.'),
  f('mx', '484', 'Mexico', 1, NA, 'gwr', ['green-white-red', 'rwg-stripes'], 'An eagle eating a snake on a cactus!'),
  f('it', '380', 'Italy', 1, EU, 'gwr', ['green-white-red', 'green-white-orange', 'rwg-stripes'], 'Green, white and red — like pizza toppings.'),
  f('de', '276', 'Germany', 1, EU, 'kry', ['black-red-gold'], 'Black, red and gold stripes.'),
  f('in', '356', 'India', 1, AS, 'owgb', ['orange-white-green'], 'Orange, white, green, with a blue wheel in the middle.'),
  f('es', '724', 'Spain', 1, EU, 'ry', ['red-yellow'], 'Red and yellow with a coat of arms.'),
  f('kr', '410', 'South Korea', 1, AS, 'wrbk', ['red-white-symbol'], 'A red-and-blue circle with four black lines around it.'),
  f('gr', '300', 'Greece', 1, EU, 'bw', ['blue-white'], 'Nine blue-and-white stripes and a cross.'),
  f('ch', '756', 'Switzerland', 1, EU, 'rw', ['red-white-symbol', 'red-cross'], 'A white cross on red — and it is square!'),

  // Tier 2 — World flags (24)
  f('ar', '032', 'Argentina', 2, SA, 'lwy', ['blue-white'], 'Sky blue, white, sky blue with a smiling sun.'),
  f('eg', '818', 'Egypt', 2, AF, 'rwky', ['red-white-black'], 'Red, white, black with a golden eagle.'),
  f('za', '710', 'South Africa', 2, AF, 'rbgykw', ['green-yellow'], 'Six colours in a sideways Y.'),
  f('ru', '643', 'Russia', 2, EU, 'wbr', ['rwb-horizontal'], 'White, blue, red stripes.'),
  f('se', '752', 'Sweden', 2, EU, 'by', ['nordic-cross'], 'A yellow cross on blue.'),
  f('no', '578', 'Norway', 2, EU, 'rwb', ['nordic-cross'], 'A blue cross with a white edge on red.'),
  f('dk', '208', 'Denmark', 2, EU, 'rw', ['nordic-cross', 'red-cross'], 'A white cross on red — the oldest flag still used.'),
  f('ie', '372', 'Ireland', 2, EU, 'gwo', ['green-white-orange'], 'Green, white, orange — green first.'),
  f('pt', '620', 'Portugal', 2, EU, 'gry', ['red-yellow'], 'Green and red with a globe and shield.'),
  f('nl', '528', 'Netherlands', 2, EU, 'rwb', ['rwb-horizontal'], 'Red, white, blue stripes.'),
  f('tr', '792', 'Turkey', 2, AS, 'rw', ['red-white-symbol', 'moon-star'], 'A white moon and star on red.'),
  f('sa', '682', 'Saudi Arabia', 2, AS, 'gw', ['moon-star'], 'Green with white writing and a sword.'),
  f('il', '376', 'Israel', 2, AS, 'bw', ['blue-white'], 'A blue star between two blue stripes.'),
  f('ke', '404', 'Kenya', 2, AF, 'krgw', ['red-white-black'], 'Black, red, green with a shield and two spears.'),
  f('ng', '566', 'Nigeria', 2, AF, 'gw', ['green-white-orange'], 'Green, white, green.'),
  f('jm', '388', 'Jamaica', 2, NA, 'gyk', ['green-yellow'], 'A yellow X splits green and black.'),
  f('vn', '704', 'Vietnam', 2, AS, 'ry', ['red-yellow-star'], 'A big yellow star on red.'),
  f('th', '764', 'Thailand', 2, AS, 'rwb', ['rwb-horizontal'], 'Red, white, blue, white, red — the blue stripe is widest.'),
  f('ph', '608', 'Philippines', 2, AS, 'brwy', ['stars-stripes'], 'A sun with eight rays and three stars.'),
  f('nz', '554', 'New Zealand', 2, OC, 'bwr', ['southern-cross'], 'The Union Jack with four red stars.'),
  f('ua', '804', 'Ukraine', 2, EU, 'by', ['blue-yellow'], 'Blue sky over a yellow wheat field.'),
  f('pl', '616', 'Poland', 2, EU, 'wr', ['red-white-halves'], 'White on top, red below.'),
  f('cu', '192', 'Cuba', 2, NA, 'bwr', ['stars-stripes'], 'Blue and white stripes with a red triangle.'),
  f('pe', '604', 'Peru', 2, SA, 'rw', ['red-white-red'], 'Red, white, red — up and down.'),

  // Tier 3 — Look-alikes (24)
  f('td', '148', 'Chad', 3, AF, 'byr', ['tricolor-byr'], 'Blue, yellow, red — almost the same as Romania!'),
  f('ro', '642', 'Romania', 3, EU, 'byr', ['tricolor-byr'], 'Blue, yellow, red — a lighter blue than Chad.'),
  f('id', '360', 'Indonesia', 3, AS, 'rw', ['red-white-halves'], "Red on top, white below — Monaco's twin."),
  f('mc', '492', 'Monaco', 3, EU, 'rw', ['red-white-halves'], 'Red over white, just like Indonesia! The real flags differ only in shape.'),
  f('ci', '384', 'Ivory Coast', 3, AF, 'owg', ['green-white-orange', 'orange-white-green'], 'Orange, white, green — Ireland backwards!'),
  f('lu', '442', 'Luxembourg', 3, EU, 'rwl', ['rwb-horizontal'], "Red, white, light blue — the Netherlands' lighter cousin."),
  f('is', '352', 'Iceland', 3, EU, 'bwr', ['nordic-cross'], "A red cross with a white edge on blue — Norway's colours swapped."),
  f('fi', '246', 'Finland', 3, EU, 'wb', ['nordic-cross', 'blue-white'], 'A blue cross on white.'),
  f('co', '170', 'Colombia', 3, SA, 'ybr', ['ybr-horizontal'], 'Yellow (big), blue, red.'),
  f('ec', '218', 'Ecuador', 3, SA, 'ybr', ['ybr-horizontal'], 'Yellow, blue, red with a coat of arms in the middle.'),
  f('ve', '862', 'Venezuela', 3, SA, 'ybrw', ['ybr-horizontal'], 'Yellow, blue, red with an arc of stars.'),
  f('at', '040', 'Austria', 3, EU, 'rw', ['red-white-red'], 'Red, white, red — side to side.'),
  f('lv', '428', 'Latvia', 3, EU, 'rw', ['red-white-red'], 'Dark red, white, dark red — thinner white stripe.'),
  f('ml', '466', 'Mali', 3, AF, 'gyr', ['pan-african'], 'Green, yellow, red — up and down.'),
  f('sn', '686', 'Senegal', 3, AF, 'gyr', ['pan-african'], 'Green, yellow, red with a green star.'),
  f('gn', '324', 'Guinea', 3, AF, 'ryg', ['pan-african'], 'Red, yellow, green — Mali flipped.'),
  f('sk', '703', 'Slovakia', 3, EU, 'wbr', ['rwb-horizontal'], 'White, blue, red with a shield on the left.'),
  f('si', '705', 'Slovenia', 3, EU, 'wbr', ['rwb-horizontal'], 'White, blue, red with a mountain shield.'),
  f('qa', '634', 'Qatar', 3, AS, 'pw', ['zigzag'], 'Maroon and white with a zig-zag edge.'),
  f('bh', '048', 'Bahrain', 3, AS, 'rw', ['zigzag'], 'Red and white with a zig-zag — five points.'),
  f('hu', '348', 'Hungary', 3, EU, 'rwg', ['rwg-stripes'], 'Red, white, green stripes.'),
  f('bg', '100', 'Bulgaria', 3, EU, 'wgr', ['rwg-stripes'], 'White, green, red stripes.'),
  f('ad', '020', 'Andorra', 3, EU, 'byr', ['tricolor-byr'], 'Blue, yellow, red with a coat of arms.'),
  f('md', '498', 'Moldova', 3, EU, 'byr', ['tricolor-byr'], 'Blue, yellow, red with an eagle.'),
];

/**
 * Flags that look the SAME in our pictures (Indonesia/Monaco are both red over white; Chad and
 * Romania differ only by a shade of blue). They are never offered side by side as choices, and the
 * name is never hidden for them — that would be a coin flip, not a test.
 */
export const TWINS: Readonly<Record<string, string>> = { id: 'mc', mc: 'id', td: 'ro', ro: 'td' };

/** Look-alike groups: flags easy to mix up. Distractors come from here first. */
export const LOOKALIKES: Record<string, string> = {
  'tricolor-byr': 'Blue, yellow, red',
  'red-white-halves': 'Red and white halves',
  'green-white-orange': 'Green, white, orange',
  'orange-white-green': 'Orange, white, green',
  'southern-cross': 'Union Jack flags',
  'rwb-horizontal': 'White, blue, red stripes',
  'nordic-cross': 'Nordic crosses',
  'ybr-horizontal': 'Yellow, blue, red',
  'red-white-red': 'Red, white, red',
  'pan-african': 'Green, yellow, red',
  zigzag: 'Zig-zags',
  'rwg-stripes': 'Red, white, green',
  'green-white-red': 'Green, white, red',
  'blue-white': 'Blue and white',
  'moon-star': 'Moons and stars',
  'stars-stripes': 'Stars and stripes',
  'red-white-symbol': 'A symbol on red or white',
  'red-cross': 'White crosses on red',
  'red-yellow-star': 'Yellow stars on red',
  'red-yellow': 'Red and yellow',
  'green-yellow': 'Green and yellow',
  'red-white-black': 'Red, white, black',
  'black-red-gold': 'Black, red, gold',
  'vertical-bwr': 'Blue, white, red',
  'blue-yellow': 'Blue and yellow',
};

export const FLAG_BY_CC: ReadonlyMap<string, FlagDef> = new Map(FLAGS.map((x) => [x.cc, x]));
export const FLAG_BY_ID: ReadonlyMap<string, FlagDef> = new Map(FLAGS.map((x) => [x.id, x]));

/** Image URL (relative: works on the dev server and under the Pages sub-path). */
export const flagSrc = (cc: string) => `./flags/4x3/${cc}.svg`;
