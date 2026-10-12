// Bodies of Water Data
// Oceans, seas, lakes, and major rivers

export interface BodyOfWaterData {
  id: string;
  name: string;
  type: 'ocean' | 'sea' | 'lake' | 'gulf' | 'bay';
  coordinates: [number, number];
  area?: number; // in square km
  funFact: string;
  borderingRegions?: string[];
  pronunciations?: string[];
}

export const bodiesOfWater: BodyOfWaterData[] = [
  // ===== OCEANS =====
  {
    id: "pacific",
    name: "Pacific Ocean",
    type: "ocean",
    coordinates: [-160, 0],
    area: 165250000,
    funFact: "The largest ocean - bigger than all the land on Earth combined!",
    borderingRegions: ["Asia", "Australia", "North America", "South America"],
  },
  {
    id: "atlantic",
    name: "Atlantic Ocean",
    type: "ocean",
    coordinates: [-30, 0],
    area: 106460000,
    funFact: "Named after Atlas, a Greek god who held up the sky!",
    borderingRegions: ["Europe", "Africa", "North America", "South America"],
  },
  {
    id: "indian",
    name: "Indian Ocean",
    type: "ocean",
    coordinates: [75, -20],
    area: 70560000,
    funFact: "The warmest ocean in the world!",
    borderingRegions: ["Africa", "Asia", "Australia"],
  },
  {
    id: "southern",
    name: "Southern Ocean",
    type: "ocean",
    coordinates: [0, -65],
    area: 21960000,
    funFact: "Surrounds Antarctica and has the strongest winds on Earth!",
    borderingRegions: ["Antarctica"],
  },
  {
    id: "arctic",
    name: "Arctic Ocean",
    type: "ocean",
    coordinates: [0, 85],
    area: 14060000,
    funFact: "The smallest and coldest ocean - mostly covered in ice!",
    borderingRegions: ["Russia", "Canada", "Greenland", "Norway"],
  },

  // ===== SEAS =====
  {
    id: "mediterranean",
    name: "Mediterranean Sea",
    type: "sea",
    coordinates: [18, 35],
    area: 2500000,
    funFact: "Its name means 'middle of the Earth' in Latin!",
    borderingRegions: ["Europe", "Africa", "Asia"],
  },
  {
    id: "caribbean",
    name: "Caribbean Sea",
    type: "sea",
    coordinates: [-75, 15],
    area: 2754000,
    funFact: "Famous for pirates and beautiful tropical islands!",
    borderingRegions: ["Central America", "South America", "Caribbean Islands"],
  },
  {
    id: "south-china",
    name: "South China Sea",
    type: "sea",
    coordinates: [115, 12],
    area: 3500000,
    funFact: "One of the busiest shipping routes in the world!",
    borderingRegions: ["China", "Vietnam", "Philippines", "Malaysia"],
  },
  {
    id: "red-sea",
    name: "Red Sea",
    type: "sea",
    coordinates: [38, 20],
    area: 438000,
    funFact: "One of the saltiest seas in the world!",
    borderingRegions: ["Egypt", "Saudi Arabia", "Sudan", "Eritrea"],
  },
  {
    id: "black-sea",
    name: "Black Sea",
    type: "sea",
    coordinates: [35, 43],
    area: 436400,
    funFact: "Called 'black' because it looks dark on stormy days!",
    borderingRegions: ["Turkey", "Russia", "Ukraine", "Romania", "Bulgaria", "Georgia"],
  },
  {
    id: "baltic",
    name: "Baltic Sea",
    type: "sea",
    coordinates: [18, 58],
    area: 377000,
    funFact: "Has almost no tide - the water stays at the same level!",
    borderingRegions: ["Sweden", "Finland", "Russia", "Estonia", "Latvia", "Lithuania", "Poland", "Germany", "Denmark"],
  },
  {
    id: "north-sea",
    name: "North Sea",
    type: "sea",
    coordinates: [4, 56],
    area: 570000,
    funFact: "Has lots of oil under it and is very important for fishing!",
    borderingRegions: ["United Kingdom", "Norway", "Denmark", "Germany", "Netherlands", "Belgium"],
  },
  {
    id: "arabian",
    name: "Arabian Sea",
    type: "sea",
    coordinates: [65, 15],
    area: 3862000,
    funFact: "Ancient sailors used monsoon winds to trade across it!",
    borderingRegions: ["India", "Pakistan", "Oman", "Yemen", "Somalia"],
  },
  {
    id: "coral",
    name: "Coral Sea",
    type: "sea",
    coordinates: [155, -18],
    area: 4791000,
    funFact: "Contains the Great Barrier Reef - the largest coral reef!",
    borderingRegions: ["Australia", "Papua New Guinea"],
  },
  {
    id: "bering",
    name: "Bering Sea",
    type: "sea",
    coordinates: [-175, 58],
    area: 2000000,
    funFact: "Between Alaska and Russia - they're only 55 miles apart here!",
    borderingRegions: ["Alaska", "Russia"],
  },

  // ===== GULFS =====
  {
    id: "gulf-mexico",
    name: "Gulf of Mexico",
    type: "gulf",
    coordinates: [-90, 25],
    area: 1550000,
    funFact: "Hurricanes often form here due to warm waters!",
    borderingRegions: ["United States", "Mexico", "Cuba"],
  },
  {
    id: "persian-gulf",
    name: "Persian Gulf",
    type: "gulf",
    coordinates: [52, 27],
    area: 251000,
    funFact: "Has about 1/3 of the world's oil underneath it!",
    borderingRegions: ["Iran", "Iraq", "Kuwait", "Saudi Arabia", "Qatar", "UAE", "Oman"],
  },
  {
    id: "bengal",
    name: "Bay of Bengal",
    type: "bay",
    coordinates: [87, 15],
    area: 2172000,
    funFact: "The largest bay in the world!",
    borderingRegions: ["India", "Bangladesh", "Myanmar", "Sri Lanka"],
  },

  // ===== GREAT LAKES =====
  {
    id: "superior",
    name: "Lake Superior",
    type: "lake",
    coordinates: [-87, 47],
    area: 82100,
    funFact: "The largest freshwater lake by area in the world!",
    borderingRegions: ["Michigan", "Wisconsin", "Minnesota", "Ontario"],
  },
  {
    id: "michigan",
    name: "Lake Michigan",
    type: "lake",
    coordinates: [-87, 44],
    area: 57800,
    funFact: "The only Great Lake entirely in the United States!",
    borderingRegions: ["Michigan", "Wisconsin", "Illinois", "Indiana"],
  },
  {
    id: "huron",
    name: "Lake Huron",
    type: "lake",
    coordinates: [-82, 45],
    area: 59600,
    funFact: "Has over 30,000 islands - more than any other lake!",
    borderingRegions: ["Michigan", "Ontario"],
  },
  {
    id: "erie",
    name: "Lake Erie",
    type: "lake",
    coordinates: [-81, 42],
    area: 25700,
    funFact: "The shallowest and warmest of the Great Lakes!",
    borderingRegions: ["Ohio", "Pennsylvania", "New York", "Michigan", "Ontario"],
  },
  {
    id: "ontario",
    name: "Lake Ontario",
    type: "lake",
    coordinates: [-77, 43.5],
    area: 19000,
    funFact: "Water from all the other Great Lakes flows through it!",
    borderingRegions: ["New York", "Ontario"],
  },

  // ===== OTHER NOTABLE LAKES =====
  {
    id: "caspian",
    name: "Caspian Sea",
    type: "lake",
    coordinates: [51, 41],
    area: 371000,
    funFact: "Actually the world's largest lake, not a sea!",
    borderingRegions: ["Russia", "Kazakhstan", "Turkmenistan", "Iran", "Azerbaijan"],
  },
  {
    id: "victoria",
    name: "Lake Victoria",
    type: "lake",
    coordinates: [33, -1],
    area: 68870,
    funFact: "Africa's largest lake and source of the Nile River!",
    borderingRegions: ["Uganda", "Kenya", "Tanzania"],
  },
  {
    id: "baikal",
    name: "Lake Baikal",
    type: "lake",
    coordinates: [108, 53],
    area: 31500,
    funFact: "The deepest lake in the world - over a mile deep!",
    borderingRegions: ["Russia"],
  },
  {
    id: "tanganyika",
    name: "Lake Tanganyika",
    type: "lake",
    coordinates: [29, -6],
    area: 32600,
    funFact: "The longest freshwater lake in the world!",
    borderingRegions: ["Tanzania", "Democratic Republic of Congo", "Burundi", "Zambia"],
  },
  {
    id: "titicaca",
    name: "Lake Titicaca",
    type: "lake",
    coordinates: [-69, -16],
    area: 8372,
    funFact: "The highest navigable lake in the world!",
    borderingRegions: ["Peru", "Bolivia"],
    pronunciations: ["tee-tee-kah-kah"],
  },
];

// Get bodies of water by type
export function getBodiesByType(type: BodyOfWaterData['type']): BodyOfWaterData[] {
  return bodiesOfWater.filter(body => body.type === type);
}

// Get all oceans
export function getOceans(): BodyOfWaterData[] {
  return getBodiesByType('ocean');
}

// Get all seas
export function getSeas(): BodyOfWaterData[] {
  return getBodiesByType('sea');
}

// Get all lakes (including Great Lakes)
export function getLakes(): BodyOfWaterData[] {
  return getBodiesByType('lake');
}

// Get Great Lakes specifically
export function getGreatLakes(): BodyOfWaterData[] {
  const greatLakeIds = ['superior', 'michigan', 'huron', 'erie', 'ontario'];
  return bodiesOfWater.filter(body => greatLakeIds.includes(body.id));
}

// Get body of water by ID
export function getBodyOfWaterById(id: string): BodyOfWaterData | undefined {
  return bodiesOfWater.find(body => body.id === id);
}

// Get random body of water
export function getRandomBodyOfWater(type?: BodyOfWaterData['type'], exclude?: string[]): BodyOfWaterData {
  let available = type
    ? bodiesOfWater.filter(b => b.type === type)
    : bodiesOfWater;

  if (exclude) {
    available = available.filter(b => !exclude.includes(b.id));
  }

  return available[Math.floor(Math.random() * available.length)];
}

export default bodiesOfWater;
