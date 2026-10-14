/**
 * The Landmarks catalog (docs/GEO-LOGIC.md §D.1): 103 places a kid should know, with the country
 * (and US state) he taps, where the pin drops and one short fact.
 *
 * `wiki` is the English Wikipedia article whose lead photo scripts/fetch-landmarks.mjs starts from;
 * `commonsFile` pins a specific Wikimedia Commons file instead (chosen by looking at the contact sheet).
 * Photos and their credits are generated into public/landmarks/ and data/credits.json.
 */
import { ALPHA2_TO_NUMERIC } from './iso';

export type LandmarkCategory = 'building' | 'nature' | 'ancient' | 'modern';
export type Tier = 1 | 2 | 3;

export interface LandmarkDef {
  id: string;
  name: string;
  /** ISO alpha-2 of the country he taps. */
  cc: string;
  /** US postal code (USA level, tap the state). Omitted for Washington, D.C. */
  state?: string;
  lat: number;
  lon: number;
  tier: Tier;
  category: LandmarkCategory;
  /** Other countries that also count (landmarks on or across a border). */
  accept?: string[];
  /** Other US states that also count. */
  stateAccept?: string[];
  /** One kid sentence, ≤ 16 words. */
  fact: string;
  wiki: string;
  commonsFile?: string;
  /** Where the 4:3 crop keeps the photo (default: sharp's "attention" — the most interesting part). */
  focus?: 'top' | 'bottom' | 'centre';
}

const L = (
  id: string,
  name: string,
  cc: string,
  lat: number,
  lon: number,
  tier: Tier,
  category: LandmarkCategory,
  fact: string,
  wiki: string,
  extra: Partial<Pick<LandmarkDef, 'state' | 'accept' | 'stateAccept' | 'commonsFile' | 'focus'>> = {},
): LandmarkDef => ({ id, name, cc, lat, lon, tier, category, fact, wiki, ...extra });

export const LANDMARKS: LandmarkDef[] = [
  // ---- Tier 1: super famous (24) ----------------------------------------------------------------
  L('eiffel-tower', 'Eiffel Tower', 'FR', 48.858, 2.295, 1, 'building', 'It was meant to be torn down after 20 years.', 'Eiffel Tower'),
  L('statue-liberty', 'Statue of Liberty', 'US', 40.689, -74.045, 1, 'building', 'A gift from France, shipped across the ocean in 350 pieces.', 'Statue of Liberty', { state: 'NY' }),
  L('great-wall', 'Great Wall of China', 'CN', 40.432, 116.57, 1, 'ancient', 'All its parts together are over 13,000 miles long.', 'Great Wall of China'),
  L('pyramids-giza', 'Pyramids of Giza', 'EG', 29.979, 31.134, 1, 'ancient', 'The oldest of the Seven Wonders, and the only one still standing.', 'Giza pyramid complex'),
  L('taj-mahal', 'Taj Mahal', 'IN', 27.175, 78.042, 1, 'building', 'Built from white marble that glows pink at sunrise.', 'Taj Mahal'),
  L('colosseum', 'Colosseum', 'IT', 41.89, 12.492, 1, 'ancient', '50,000 Romans came here to watch shows and games.', 'Colosseum'),
  L('big-ben', 'Big Ben', 'GB', 51.501, -0.125, 1, 'building', 'Big Ben is really the name of the giant bell inside the tower.', 'Big Ben'),
  L('sydney-opera', 'Sydney Opera House', 'AU', -33.857, 151.215, 1, 'modern', 'Its roof looks like big white sails on the harbour.', 'Sydney Opera House'),
  L('golden-gate', 'Golden Gate Bridge', 'US', 37.82, -122.478, 1, 'modern', 'Painted "international orange" so ships can see it in the fog.', 'Golden Gate Bridge', { state: 'CA' }),
  L('mount-fuji', 'Mount Fuji', 'JP', 35.361, 138.727, 1, 'nature', "A volcano, and Japan's tallest mountain.", 'Mount Fuji'),
  L('grand-canyon', 'Grand Canyon', 'US', 36.054, -112.14, 1, 'nature', 'The Colorado River carved it over millions of years.', 'Grand Canyon', { state: 'AZ' }),
  L('niagara-falls', 'Niagara Falls', 'US', 43.083, -79.074, 1, 'nature', 'Enough water falls each second to fill an Olympic swimming pool.', 'Niagara Falls', { state: 'NY', accept: ['CA'] }),
  L('mount-everest', 'Mount Everest', 'NP', 27.988, 86.925, 1, 'nature', 'The highest mountain on Earth.', 'Mount Everest', { accept: ['CN'] }),
  L('leaning-tower', 'Leaning Tower of Pisa', 'IT', 43.723, 10.396, 1, 'building', 'It started leaning while it was still being built.', 'Leaning Tower of Pisa'),
  L('christ-redeemer', 'Christ the Redeemer', 'BR', -22.952, -43.21, 1, 'building', 'A 98-foot statue with open arms on a mountain above Rio.', 'Christ the Redeemer (statue)'),
  L('machu-picchu', 'Machu Picchu', 'PE', -13.163, -72.545, 1, 'ancient', 'A city in the clouds, built by the Inca.', 'Machu Picchu'),
  L('stonehenge', 'Stonehenge', 'GB', 51.179, -1.826, 1, 'ancient', 'Giant stones set up 5,000 years ago. Nobody knows exactly how.', 'Stonehenge'),
  L('tower-bridge', 'Tower Bridge', 'GB', 51.506, -0.075, 1, 'building', 'The road lifts up in the middle to let ships through.', 'Tower Bridge'),
  L('burj-khalifa', 'Burj Khalifa', 'AE', 25.197, 55.274, 1, 'modern', 'The tallest building in the world.', 'Burj Khalifa', { commonsFile: 'Burj dubai 3.11.08.jpg' }),
  L('mount-rushmore', 'Mount Rushmore', 'US', 43.879, -103.459, 1, 'building', "Four presidents' faces carved into a mountain.", 'Mount Rushmore', { state: 'SD' }),
  L('hollywood-sign', 'Hollywood Sign', 'US', 34.134, -118.322, 1, 'modern', 'Each letter is 45 feet tall.', 'Hollywood Sign', { state: 'CA' }),
  L('white-house', 'White House', 'US', 38.898, -77.037, 1, 'building', 'Where the President of the United States lives and works.', 'White House', { commonsFile: 'WhiteHouseSouthFacade.JPG' }),
  L('uluru', 'Uluru', 'AU', -25.344, 131.037, 1, 'nature', 'A giant red rock in the middle of Australia.', 'Uluru'),
  L('great-barrier-reef', 'Great Barrier Reef', 'AU', -18.287, 147.699, 1, 'nature', 'The biggest coral reef on Earth. You can see it from space!', 'Great Barrier Reef', { commonsFile: 'Coral Outcrop Flynn Reef.jpg' }),

  // ---- Tier 2: world famous (38) ----------------------------------------------------------------
  L('petra', 'Petra', 'JO', 30.329, 35.444, 2, 'ancient', 'A whole city carved into pink rock.', 'Petra'),
  L('angkor-wat', 'Angkor Wat', 'KH', 13.413, 103.867, 2, 'ancient', 'The largest temple in the world, in the jungle.', 'Angkor Wat'),
  L('empire-state', 'Empire State Building', 'US', 40.748, -73.986, 2, 'building', 'Builders finished it in just 410 days.', 'Empire State Building', { state: 'NY' }),
  L('sagrada-familia', 'Sagrada Família', 'ES', 41.404, 2.174, 2, 'building', 'Builders have been working on this church since 1882!', 'Sagrada Família', { commonsFile: 'Sagrada Família exterior Barcelona 2026.jpg' }),
  L('st-basils', "St Basil's Cathedral", 'RU', 55.753, 37.623, 2, 'building', 'Its colourful onion domes look like swirly candy.', "Saint Basil's Cathedral"),
  L('forbidden-city', 'Forbidden City', 'CN', 39.916, 116.397, 2, 'ancient', "The emperors' palace, with nearly 9,000 rooms.", 'Forbidden City', { commonsFile: 'Hall of Supreme Harmony, Forbidden City, from southeast.jpg' }),
  L('brandenburg-gate', 'Brandenburg Gate', 'DE', 52.516, 13.378, 2, 'building', 'A chariot pulled by four horses stands on top.', 'Brandenburg Gate'),
  L('neuschwanstein', 'Neuschwanstein Castle', 'DE', 47.558, 10.75, 2, 'building', "The fairy-tale castle that inspired Sleeping Beauty's castle.", 'Neuschwanstein Castle'),
  L('acropolis', 'Acropolis & Parthenon', 'GR', 37.972, 23.726, 2, 'ancient', 'A temple on a hill, about 2,500 years old.', 'Parthenon'),
  L('chichen-itza', 'Chichén Itzá', 'MX', 20.684, -88.568, 2, 'ancient', 'Clap at the pyramid and the echo chirps like a bird.', 'Chichen Itza'),
  L('moai', 'Easter Island Moai', 'CL', -27.113, -109.35, 2, 'ancient', 'Nearly 900 giant stone heads on a tiny island.', 'Moai'),
  L('victoria-falls', 'Victoria Falls', 'ZW', -17.924, 25.857, 2, 'nature', 'People here call it "the smoke that thunders".', 'Victoria Falls', { accept: ['ZM'] }),
  L('kilimanjaro', 'Mount Kilimanjaro', 'TZ', -3.067, 37.356, 2, 'nature', 'It has snow on top, even though it is near the equator.', 'Mount Kilimanjaro'),
  L('sahara', 'Sahara Desert', 'MA', 31.1, -4.0, 2, 'nature', 'The biggest hot desert, almost as big as the United States.', 'Sahara', {
    accept: ['DZ', 'LY', 'EG', 'TN', 'ML', 'NE', 'TD', 'SD', 'MR', 'EH'], commonsFile: 'Erg Chebbi in the evening light.jpg' }),
  L('amazon', 'Amazon Rainforest', 'BR', -3.1, -60.0, 2, 'nature', 'One in ten of all known kinds of animals lives here.', 'Amazon rainforest', { accept: ['PE', 'CO', 'EC', 'BO', 'VE', 'GY', 'SR'] }),
  L('yellowstone', 'Old Faithful, Yellowstone', 'US', 44.46, -110.828, 2, 'nature', 'A geyser that shoots hot water up about every 90 minutes.', 'Old Faithful', { state: 'WY' }),
  L('hagia-sophia', 'Hagia Sophia', 'TR', 41.009, 28.98, 2, 'building', 'Nearly 1,500 years old, with a giant dome.', 'Hagia Sophia'),
  L('arc-triomphe', 'Arc de Triomphe', 'FR', 48.874, 2.295, 2, 'building', 'Twelve roads meet in a big circle around it.', 'Arc de Triomphe'),
  L('louvre', 'Louvre Museum', 'FR', 48.861, 2.338, 2, 'building', 'A glass pyramid is the door to the Mona Lisa.', 'Louvre Pyramid', { commonsFile: 'North facade of the Denon Wing & Louvre Pyramid, 1 May 2018.jpg' }),
  L('notre-dame', 'Notre-Dame', 'FR', 48.853, 2.35, 2, 'building', 'A cathedral famous for its gargoyles and giant bells.', 'Notre-Dame de Paris'),
  L('alhambra', 'Alhambra', 'ES', 37.176, -3.588, 2, 'ancient', 'A red palace with a fountain held up by stone lions.', 'Alhambra'),
  L('grand-canal', 'Grand Canal, Venice', 'IT', 45.437, 12.333, 2, 'building', 'A city with boats instead of cars.', 'Grand Canal (Venice)'),
  L('matterhorn', 'Matterhorn', 'CH', 45.976, 7.658, 2, 'nature', 'A mountain shaped like a giant pointy pyramid.', 'Matterhorn', { accept: ['IT'] }),
  L('iguazu', 'Iguazu Falls', 'AR', -25.695, -54.437, 2, 'nature', 'About 275 waterfalls side by side.', 'Iguazu Falls', { accept: ['BR'] }),
  L('table-mountain', 'Table Mountain', 'ZA', -33.963, 18.424, 2, 'nature', 'Flat like a table, with a cloud "tablecloth" on top.', 'Table Mountain'),
  L('gateway-arch', 'Gateway Arch', 'US', 38.625, -90.185, 2, 'modern', 'A silver arch 630 feet tall. A tiny tram rides to the top!', 'Gateway Arch', { state: 'MO' }),
  L('space-needle', 'Space Needle', 'US', 47.621, -122.349, 2, 'modern', "Built for a World's Fair about the future.", 'Space Needle', { state: 'WA', commonsFile: 'Space Needle and Seattle skyline from Kerry Park with waxing gibbous moon, 27 June 2026.jpg' }),
  L('cn-tower', 'CN Tower', 'CA', 43.643, -79.387, 2, 'modern', 'You can walk on a glass floor 1,100 feet up.', 'CN Tower'),
  L('galapagos', 'Galápagos Islands', 'EC', -0.6, -90.4, 2, 'nature', 'Home of giant tortoises that live over 100 years.', 'Galápagos Islands', { commonsFile: 'Santa Cruz giant tortoise 04.jpg' }),
  L('petronas', 'Petronas Towers', 'MY', 3.158, 101.712, 2, 'modern', 'Twin towers joined by a bridge in the sky.', 'Petronas Towers', { commonsFile: '2016 Kuala Lumpur, Petronas Towers (26).jpg' }),
  L('marina-bay', 'Marina Bay Sands', 'SG', 1.283, 103.86, 2, 'modern', 'A giant swimming pool sits on top of three towers.', 'Marina Bay Sands'),
  L('ha-long-bay', 'Ha Long Bay', 'VN', 20.91, 107.18, 2, 'nature', 'Nearly 2,000 rocky islands rising out of green water.', 'Ha Long Bay'),
  L('dead-sea', 'Dead Sea', 'JO', 31.5, 35.5, 2, 'nature', 'So salty that you float like a cork.', 'Dead Sea', { accept: ['IL', 'PS'], commonsFile: 'Dead Sea shore.jpg' }),
  L('vesuvius', 'Mount Vesuvius & Pompeii', 'IT', 40.821, 14.426, 2, 'nature', 'The volcano that buried a whole Roman city in ash.', 'Mount Vesuvius'),
  L('northern-lights', 'Northern Lights', 'NO', 69.649, 18.955, 2, 'nature', 'Glowing green curtains of light in the night sky.', 'Aurora', { accept: ['IS', 'SE', 'FI', 'CA'], commonsFile: 'Northern Lights - Aurora Borealis Norway Ringvassøya Tromsø.jpg' }),
  L('geysir', 'Strokkur Geyser', 'IS', 64.313, -20.302, 2, 'nature', 'It shoots boiling water high into the air every few minutes.', 'Strokkur', { commonsFile: 'Strokkur Eruption - Wide.jpg' }),
  L('lake-louise', 'Lake Louise, Banff', 'CA', 51.417, -116.217, 2, 'nature', 'A bright turquoise lake under snowy mountains.', 'Lake Louise (Alberta)'),
  L('golden-temple', 'Golden Temple', 'IN', 31.62, 74.876, 2, 'building', 'Covered in real gold and surrounded by water.', 'Golden Temple'),

  // ---- Tier 3: explorer (41) ----------------------------------------------------------------------
  L('alamo', 'The Alamo', 'US', 29.426, -98.486, 3, 'ancient', 'An old mission where a famous battle happened in 1836.', 'Alamo Mission in San Antonio', { state: 'TX' }),
  L('kennedy-space', 'Kennedy Space Center', 'US', 28.573, -80.649, 3, 'modern', 'Where the rockets to the Moon took off.', 'Kennedy Space Center', { state: 'FL' }),
  L('yosemite', 'Half Dome, Yosemite', 'US', 37.746, -119.533, 3, 'nature', 'A giant granite dome that climbers love.', 'Half Dome', { state: 'CA' }),
  L('monument-valley', 'Monument Valley', 'US', 36.983, -110.111, 3, 'nature', 'Red rock towers from old cowboy movies.', 'Monument Valley', { state: 'AZ', stateAccept: ['UT'] }),
  L('denali', 'Denali', 'US', 63.069, -151.007, 3, 'nature', 'The tallest mountain in North America.', 'Denali', { state: 'AK' }),
  L('kilauea', 'Kīlauea Volcano', 'US', 19.421, -155.287, 3, 'nature', 'One of the most active volcanoes on Earth.', 'Kīlauea', { state: 'HI' }),
  L('everglades', 'Everglades', 'US', 25.3, -80.9, 3, 'nature', 'A slow "river of grass" full of alligators.', 'Everglades', { state: 'FL' }),
  L('alcatraz', 'Alcatraz', 'US', 37.827, -122.423, 3, 'building', 'A famous old prison on an island in San Francisco Bay.', 'Alcatraz Island', { state: 'CA' }),
  L('arches', 'Delicate Arch', 'US', 38.743, -109.499, 3, 'nature', "A natural stone arch that is on Utah's license plates.", 'Delicate Arch', { state: 'UT' }),
  L('brooklyn-bridge', 'Brooklyn Bridge', 'US', 40.706, -73.997, 3, 'building', '21 elephants walked across it to prove it was safe.', 'Brooklyn Bridge', { state: 'NY' }),
  L('lincoln-memorial', 'Lincoln Memorial', 'US', 38.889, -77.05, 3, 'building', 'A giant marble Abraham Lincoln sitting in a chair.', 'Lincoln Memorial'),
  L('buckingham-palace', 'Buckingham Palace', 'GB', 51.501, -0.142, 3, 'building', "The King's home in London, with 775 rooms.", 'Buckingham Palace'),
  L('edinburgh-castle', 'Edinburgh Castle', 'GB', 55.948, -3.199, 3, 'building', 'A castle on top of an old volcano in Scotland.', 'Edinburgh Castle', { commonsFile: 'Edinburgh Castle from Princes Street Gardens - geograph.org.uk - 3518148.jpg', focus: 'top' }),
  L('giants-causeway', "Giant's Causeway", 'GB', 55.241, -6.512, 3, 'nature', "40,000 stone columns, like a giant's stepping stones.", "Giant's Causeway"),
  L('cliffs-moher', 'Cliffs of Moher', 'IE', 52.972, -9.427, 3, 'nature', 'Cliffs that drop 700 feet straight down to the ocean.', 'Cliffs of Moher'),
  L('mont-saint-michel', 'Mont-Saint-Michel', 'FR', 48.636, -1.511, 3, 'building', 'An island abbey. The tide cuts it off from land twice a day.', 'Mont-Saint-Michel'),
  L('versailles', 'Palace of Versailles', 'FR', 48.805, 2.12, 3, 'building', 'A palace with a hall of 357 mirrors.', 'Palace of Versailles'),
  L('charles-bridge', 'Charles Bridge', 'CZ', 50.086, 14.411, 3, 'building', 'An old stone bridge lined with 30 statues.', 'Charles Bridge'),
  L('kinderdijk', 'Kinderdijk Windmills', 'NL', 51.883, 4.64, 3, 'building', 'Nineteen windmills that pump water off the land.', 'Kinderdijk'),
  L('atomium', 'Atomium', 'BE', 50.895, 4.342, 3, 'modern', 'A model of a tiny iron crystal, 165 billion times bigger.', 'Atomium'),
  L('little-mermaid', 'The Little Mermaid', 'DK', 55.693, 12.599, 3, 'building', 'A small bronze mermaid sitting on a rock by the harbour.', 'The Little Mermaid (statue)', { commonsFile: 'Denmark, Copenhagen, Little Mermaid, Langelinie Promenade 150422-26.jpg', focus: 'top' }),
  L('santorini', 'Santorini', 'GR', 36.393, 25.461, 3, 'nature', "White houses with blue roofs on a volcano's edge.", 'Santorini', { commonsFile: 'Oia Santorini Blue Domes.jpg' }),
  L('plitvice', 'Plitvice Lakes', 'HR', 44.881, 15.616, 3, 'nature', 'Sixteen lakes linked by waterfalls.', 'Plitvice Lakes National Park', { commonsFile: 'Plitvice Lakes (225492887).jpeg' }),
  L('cappadocia', 'Cappadocia', 'TR', 38.643, 34.828, 3, 'nature', 'Hot-air balloons float over rocky "fairy chimneys".', 'Cappadocia'),
  L('pamukkale', 'Pamukkale', 'TR', 37.924, 29.123, 3, 'nature', 'White terraces of warm water. Its name means "cotton castle".', 'Pamukkale'),
  L('lalibela', 'Lalibela Churches', 'ET', 12.032, 39.041, 3, 'ancient', 'Churches carved down into solid rock.', 'Church of Saint George, Lalibela'),
  L('serengeti', 'Serengeti', 'TZ', -2.333, 34.833, 3, 'nature', 'Over a million wildebeest travel across it every year.', 'Serengeti', { accept: ['KE'], commonsFile: 'Zebra in the Serengeti Wildebeest Migration.jpg' }),
  L('potala', 'Potala Palace', 'CN', 29.656, 91.117, 3, 'building', 'A palace with 1,000 rooms, high in the mountains of Tibet.', 'Potala Palace'),
  L('terracotta-army', 'Terracotta Army', 'CN', 34.385, 109.279, 3, 'ancient', '8,000 clay soldiers guarding an emperor.', 'Terracotta Army'),
  L('himeji', 'Himeji Castle', 'JP', 34.839, 134.694, 3, 'building', 'A white castle nicknamed the White Heron.', 'Himeji Castle'),
  L('fushimi-inari', 'Fushimi Inari Shrine', 'JP', 34.967, 135.773, 3, 'building', 'A path through 10,000 bright orange gates.', 'Fushimi Inari-taisha'),
  L('gyeongbokgung', 'Gyeongbokgung Palace', 'KR', 37.58, 126.977, 3, 'building', 'A 600-year-old palace with a changing of the guard.', 'Gyeongbokgung'),
  L('borobudur', 'Borobudur', 'ID', -7.608, 110.204, 3, 'ancient', 'The biggest Buddhist temple, with 504 statues.', 'Borobudur', { commonsFile: 'Borobudur Magelang.jpg' }),
  L('bagan', 'Bagan Temples', 'MM', 21.172, 94.86, 3, 'ancient', 'Over 2,000 old temples on one wide plain.', 'Bagan'),
  L('sigiriya', 'Sigiriya', 'LK', 7.957, 80.76, 3, 'ancient', "A palace on top of a giant rock, entered between a lion's paws.", 'Sigiriya'),
  L('twelve-apostles', 'Twelve Apostles', 'AU', -38.665, 143.104, 3, 'nature', 'Tall rock towers standing in the ocean.', 'The Twelve Apostles (Victoria)'),
  L('milford-sound', 'Milford Sound', 'NZ', -44.672, 167.925, 3, 'nature', 'Steep cliffs and waterfalls dropping into the sea.', 'Milford Sound'),
  L('angel-falls', 'Angel Falls', 'VE', 5.97, -62.536, 3, 'nature', 'The tallest waterfall in the world.', 'Angel Falls'),
  L('salar-uyuni', 'Salar de Uyuni', 'BO', -20.134, -67.489, 3, 'nature', 'A giant salt flat that turns into a mirror after rain.', 'Salar de Uyuni'),
  L('panama-canal', 'Panama Canal', 'PA', 9.08, -79.68, 3, 'modern', 'Water elevators lift ships across a whole country.', 'Panama Canal', { commonsFile: 'Millaflores Locks - Panama Canal - 3812235764.jpg' }),
  L('teotihuacan', 'Teotihuacan', 'MX', 19.692, -98.844, 3, 'ancient', 'An ancient city with the Pyramids of the Sun and Moon.', 'Teotihuacan'),
];

/** Map region id (ISO numeric) of the landmark's country. */
export const regionOf = (l: LandmarkDef): string => ALPHA2_TO_NUMERIC[l.cc];

/** Every countries-map region id that counts as correct for a landmark. */
export function acceptedRegions(l: LandmarkDef): string[] {
  return [l.cc, ...(l.accept ?? [])].map((cc) => ALPHA2_TO_NUMERIC[cc]).filter(Boolean);
}

/** Every US-map state that counts as correct (USA level). */
export function acceptedStates(l: LandmarkDef): string[] {
  return l.state ? [l.state, ...(l.stateAccept ?? [])] : [];
}

export const LANDMARK_BY_ID: ReadonlyMap<string, LandmarkDef> = new Map(LANDMARKS.map((l) => [l.id, l]));

/** Landmarks said with "the" ("Where is the Eiffel Tower?" but "Where is Stonehenge?"). */
const WITH_THE = new Set([
  'eiffel-tower', 'statue-liberty', 'great-wall', 'pyramids-giza', 'taj-mahal', 'colosseum', 'sydney-opera', 'golden-gate',
  'grand-canyon', 'niagara-falls', 'leaning-tower', 'tower-bridge', 'burj-khalifa', 'hollywood-sign', 'white-house',
  'great-barrier-reef', 'empire-state', 'sagrada-familia', 'forbidden-city', 'brandenburg-gate', 'acropolis', 'moai',
  'victoria-falls', 'sahara', 'amazon', 'arc-triomphe', 'louvre', 'alhambra', 'grand-canal', 'matterhorn', 'iguazu',
  'gateway-arch', 'space-needle', 'cn-tower', 'galapagos', 'petronas', 'dead-sea', 'northern-lights', 'golden-temple',
  'kennedy-space', 'everglades', 'lincoln-memorial', 'giants-causeway', 'cliffs-moher', 'palace-versailles', 'versailles',
  'charles-bridge', 'kinderdijk', 'atomium', 'plitvice', 'lalibela', 'serengeti', 'potala', 'terracotta-army',
  'himeji', 'fushimi-inari', 'bagan', 'twelve-apostles', 'salar-uyuni', 'panama-canal', 'christ-redeemer', 'strokkur', 'geysir',
  'buckingham-palace', 'gyeongbokgung', 'st-basils', 'chichen-itza', 'brooklyn-bridge',
]);

/** "the Eiffel Tower", "Stonehenge", "The Alamo" → "the Alamo". */
export function spokenName(l: LandmarkDef): string {
  if (/^The /.test(l.name)) return 'the ' + l.name.slice(4);
  const base = l.name.replace(/,.*$/, '').replace(/ & .*$/, '');
  return WITH_THE.has(l.id) ? `the ${base}` : base;
}
