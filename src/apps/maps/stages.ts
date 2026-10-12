/**
 * Packs, stages (levels) and per-region metadata for the Maps app (docs/DESIGN.md §1.9).
 * Region ids match the generated map data: US = postal code, continents/oceans = slug,
 * countries = ISO 3166 numeric code.
 */
import { usStates } from '../../data/geography/usStates';
import type { MapKind, PackId, StageDef, ViewBox } from './types';

export interface PackDef {
  id: PackId;
  title: string;
  emoji: string;
  map: MapKind;
  /** The Explore view of the whole pack. */
  exploreStage: string;
}

export const PACKS: PackDef[] = [
  { id: 'us', title: 'USA', emoji: '🇺🇸', map: 'us', exploreStage: 'us-all' },
  { id: 'world', title: 'World', emoji: '🌍', map: 'continents', exploreStage: 'earth' },
  { id: 'countries', title: 'Countries', emoji: '🗺️', map: 'countries', exploreStage: 'world-all' },
];

// ---------------------------------------------------------------------------------------------
// US
// ---------------------------------------------------------------------------------------------

const US_FULL: ViewBox = [0, 0, 975, 610];
/** All 50 + a 2× magnified inset of the small north-eastern states in the extra right margin. */
const US_ALL_VIEW: ViewBox = [0, 0, 1205, 610];
const US_NE_INSET = { src: [838, 124, 112, 176] as ViewBox, dst: [985, 150, 216, 339] as ViewBox };

const REGION_NAME = { west: 'the West', midwest: 'the Middle', south: 'the South', northeast: 'the Northeast' } as const;
const US_REGION_PRIOR = { west: 1.0, midwest: 1.2, northeast: 1.4, south: 1.1 } as const;
const US_FAMOUS = new Set(['CA', 'TX', 'FL', 'AK', 'NY', 'HI']);
const US_TINY = new Set(['RI', 'DE', 'CT', 'NJ', 'MD', 'VT', 'NH', 'MA']);

export interface RegionMeta {
  label: string;
  prior: number;
  group?: string;
}

const US_META: Record<string, RegionMeta> = Object.fromEntries(
  usStates.map((s) => {
    let prior: number = US_REGION_PRIOR[s.region];
    if (US_FAMOUS.has(s.abbreviation)) prior = 0.6;
    if (US_TINY.has(s.abbreviation)) prior += 0.2;
    return [s.abbreviation, { label: s.name, prior, group: REGION_NAME[s.region] }];
  }),
);

const statesIn = (region: 'west' | 'midwest' | 'south' | 'northeast') =>
  usStates.filter((s) => s.region === region).map((s) => s.abbreviation);

// ---------------------------------------------------------------------------------------------
// World (continents + oceans)
// ---------------------------------------------------------------------------------------------

const WORLD_META: Record<string, RegionMeta> = {
  'north-america': { label: 'North America', prior: 0.7 },
  'south-america': { label: 'South America', prior: 0.8 },
  europe: { label: 'Europe', prior: 1.0 },
  africa: { label: 'Africa', prior: 0.8 },
  asia: { label: 'Asia', prior: 0.8 },
  oceania: { label: 'Australia', prior: 0.8 },
  antarctica: { label: 'Antarctica', prior: 0.6 },
  pacific: { label: 'Pacific Ocean', prior: 0.9 },
  atlantic: { label: 'Atlantic Ocean', prior: 1.0 },
  indian: { label: 'Indian Ocean', prior: 1.1 },
  arctic: { label: 'Arctic Ocean', prior: 1.1 },
  southern: { label: 'Southern Ocean', prior: 1.2 },
};
const CONTINENT_IDS = ['north-america', 'south-america', 'europe', 'africa', 'asia', 'oceania', 'antarctica'];
const OCEAN_IDS = ['pacific', 'atlantic', 'indian', 'arctic', 'southern'];

// ---------------------------------------------------------------------------------------------
// Countries
// ---------------------------------------------------------------------------------------------

/** Kid-facing names for the generated (Natural Earth) names. */
export const COUNTRY_LABELS: Record<string, string> = {
  'United States of America': 'United States',
  'Dem. Rep. Congo': 'Congo (DRC)',
  'Central African Rep.': 'Central African Republic',
  'Dominican Rep.': 'Dominican Republic',
  'Bosnia and Herz.': 'Bosnia',
  'S. Sudan': 'South Sudan',
  'W. Sahara': 'Western Sahara',
  'Eq. Guinea': 'Equatorial Guinea',
  'Solomon Is.': 'Solomon Islands',
  'Falkland Is.': 'Falkland Islands',
  'Fr. S. Antarctic Lands': 'French Southern Lands',
  'Fr. Polynesia': 'French Polynesia',
  'N. Cyprus': 'Northern Cyprus',
  "Côte d'Ivoire": 'Ivory Coast',
  eSwatini: 'Eswatini',
  Czechia: 'Czechia',
  'Faeroe Is.': 'Faroe Islands',
  'Marshall Is.': 'Marshall Islands',
  'N. Mariana Is.': 'Northern Mariana Islands',
  'Cayman Is.': 'Cayman Islands',
  'Turks and Caicos Is.': 'Turks and Caicos',
  'U.S. Virgin Is.': 'U.S. Virgin Islands',
  'British Virgin Is.': 'British Virgin Islands',
  'Antigua and Barb.': 'Antigua and Barbuda',
  'St. Vin. and Gren.': 'St. Vincent',
  'St. Kitts and Nevis': 'St. Kitts and Nevis',
  'S. Geo. and the Is.': 'South Georgia',
  'Br. Indian Ocean Ter.': 'British Indian Ocean Territory',
  'Heard I. and McDonald Is.': 'Heard Island',
  'Cook Is.': 'Cook Islands',
  'Pitcairn Is.': 'Pitcairn Islands',
  'Wallis and Futuna Is.': 'Wallis and Futuna',
  'Ashmore and Cartier Is.': 'Ashmore Islands',
  'Indian Ocean Ter.': 'Christmas Island',
};

const C = {
  russia: '643', canada: '124', usa: '840', china: '156', brazil: '076', australia: '036', india: '356',
  argentina: '032', mexico: '484', egypt: '818', southAfrica: '710', japan: '392',
  uk: '826', ireland: '372', france: '250', spain: '724', portugal: '620', germany: '276', italy: '380',
  greece: '300', norway: '578', sweden: '752', poland: '616', ukraine: '804',
  saudi: '682', turkey: '792', mongolia: '496', indonesia: '360', thailand: '764', southKorea: '410',
  philippines: '608', kenya: '404', nigeria: '566', madagascar: '450', morocco: '504', ethiopia: '231',
} as const;

const GIANTS = [C.russia, C.canada, C.usa, C.china, C.brazil, C.australia, C.india, C.argentina, C.mexico, C.egypt, C.southAfrica, C.japan];
const EUROPE = [C.uk, C.ireland, C.france, C.spain, C.portugal, C.germany, C.italy, C.greece, C.norway, C.sweden, C.poland, C.ukraine];
const ASIA_AFRICA = [C.saudi, C.turkey, C.mongolia, C.indonesia, C.thailand, C.southKorea, C.philippines, C.kenya, C.nigeria, C.madagascar, C.morocco, C.ethiopia];

const COUNTRY_PRIOR: Record<string, number> = {
  [C.russia]: 0.5, [C.canada]: 0.6, [C.usa]: 0.4, [C.china]: 0.6, [C.brazil]: 0.6, [C.australia]: 0.5,
  [C.india]: 0.7, [C.argentina]: 0.9, [C.mexico]: 0.6, [C.egypt]: 0.9, [C.southAfrica]: 0.9, [C.japan]: 0.8,
  [C.uk]: 1.0, [C.ireland]: 1.3, [C.france]: 1.1, [C.spain]: 1.1, [C.portugal]: 1.4, [C.germany]: 1.2,
  [C.italy]: 1.0, [C.greece]: 1.3, [C.norway]: 1.2, [C.sweden]: 1.3, [C.poland]: 1.4, [C.ukraine]: 1.3,
  [C.saudi]: 1.2, [C.turkey]: 1.2, [C.mongolia]: 1.2, [C.indonesia]: 1.2, [C.thailand]: 1.4, [C.southKorea]: 1.4,
  [C.philippines]: 1.3, [C.kenya]: 1.3, [C.nigeria]: 1.3, [C.madagascar]: 1.0, [C.morocco]: 1.3, [C.ethiopia]: 1.4,
};

const WORLD_NO_ANTARCTICA: ViewBox = [0, 0, 1000, 448];
/** Whole world + a magnified Europe inset over the empty South Pacific. */
const WORLD_ALL_INSET = { src: [448, 52, 160, 100] as ViewBox, dst: [8, 250, 272, 170] as ViewBox };

// ---------------------------------------------------------------------------------------------
// Stages
// ---------------------------------------------------------------------------------------------

export const STAGES: StageDef[] = [
  {
    id: 'us-big', pack: 'us', map: 'us', title: 'Big States', emoji: '🤠', view: US_FULL,
    targets: ['CA', 'TX', 'FL', 'AK', 'NY', 'AZ', 'WA', 'CO', 'MT', 'HI', 'NV', 'MI'],
  },
  { id: 'us-west', pack: 'us', map: 'us', title: 'The West', emoji: '🏔️', view: [0, 0, 455, 610], targets: statesIn('west') },
  { id: 'us-middle', pack: 'us', map: 'us', title: 'The Middle', emoji: '🌽', view: [345, 40, 445, 330], targets: statesIn('midwest') },
  {
    id: 'us-south', pack: 'us', map: 'us', title: 'The South', emoji: '🌴', view: [280, 205, 600, 405],
    targets: statesIn('south').filter((s) => s !== 'DE' && s !== 'MD'),
  },
  {
    id: 'us-east', pack: 'us', map: 'us', title: 'East Coast', emoji: '🗽', view: [725, 30, 250, 262],
    targets: [...statesIn('northeast'), 'DE', 'MD'],
  },
  {
    id: 'us-all', pack: 'us', map: 'us', title: 'All 50', emoji: '⭐', view: US_ALL_VIEW, inset: US_NE_INSET,
    portrait: { view: [0, 0, 975, 1090], inset: { src: US_NE_INSET.src, dst: [330, 640, 286, 449.4] } },
    targets: usStates.map((s) => s.abbreviation),
  },

  { id: 'continents', pack: 'world', map: 'continents', title: 'Continents', emoji: '🌎', targets: CONTINENT_IDS },
  { id: 'oceans', pack: 'world', map: 'continents', title: 'Oceans', emoji: '🌊', targets: OCEAN_IDS },
  { id: 'earth', pack: 'world', map: 'continents', title: 'Land & Sea', emoji: '🐳', targets: [...CONTINENT_IDS, ...OCEAN_IDS] },

  { id: 'giants', pack: 'countries', map: 'countries', title: 'Giant Countries', emoji: '🐘', view: WORLD_NO_ANTARCTICA, targets: GIANTS },
  { id: 'europe', pack: 'countries', map: 'countries', title: 'Europe', emoji: '🏰', view: [440, 36, 190, 128], targets: EUROPE },
  { id: 'asia-africa', pack: 'countries', map: 'countries', title: 'Asia & Africa', emoji: '🐼', view: [450, 80, 430, 270], targets: ASIA_AFRICA },
  {
    id: 'world-all', pack: 'countries', map: 'countries', title: 'All Countries', emoji: '🌐', view: WORLD_NO_ANTARCTICA,
    inset: WORLD_ALL_INSET,
    portrait: { view: [0, 0, 1000, 790], inset: { src: WORLD_ALL_INSET.src, dst: [230, 470, 540, 337.5] } },
    targets: [...GIANTS, ...EUROPE, ...ASIA_AFRICA],
  },
];

export function stageById(id: string): StageDef | undefined {
  return STAGES.find((s) => s.id === id);
}

export function stagesOf(pack: PackId): StageDef[] {
  return STAGES.filter((s) => s.pack === pack);
}

export function packOf(id: PackId): PackDef {
  return PACKS.find((p) => p.id === id) ?? PACKS[0];
}

/** Metadata for a region of a map; unknown countries fall back to their generated name. */
export function regionMeta(map: MapKind, id: string, generatedName: string): RegionMeta {
  if (map === 'us') return US_META[id] ?? { label: generatedName, prior: 1 };
  if (map === 'continents') return WORLD_META[id] ?? { label: generatedName, prior: 1 };
  return { label: COUNTRY_LABELS[generatedName] ?? generatedName, prior: COUNTRY_PRIOR[id] ?? 1.2 };
}

/** Mastery key for a region (one mastery store for the whole app). */
export const masteryId = (map: MapKind, regionId: string) => `${map}:${regionId}`;

export const ROUND_LENGTH = 12;
