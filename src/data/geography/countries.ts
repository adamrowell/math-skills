// World Countries Data
// Coordinates are approximate center points [longitude, latitude]

export interface CountryData {
  id: string; // ISO 3166-1 alpha-2 code
  name: string;
  capital: string;
  continent: 'Africa' | 'Asia' | 'Europe' | 'North America' | 'South America' | 'Oceania';
  coordinates: [number, number];
  population: number;
  funFact: string;
  pronunciations?: string[];
}

// Major countries organized by continent (kid-friendly selection)
export const countries: CountryData[] = [
  // ===== AFRICA =====
  { id: "EG", name: "Egypt", capital: "Cairo", continent: "Africa", coordinates: [30.8, 26.8], population: 102334404, funFact: "Home to the ancient pyramids and the Sphinx!" },
  { id: "ZA", name: "South Africa", capital: "Pretoria", continent: "Africa", coordinates: [24.9, -28.5], population: 59308690, funFact: "Has three capital cities!" },
  { id: "KE", name: "Kenya", capital: "Nairobi", continent: "Africa", coordinates: [37.9, -0.0], population: 53771296, funFact: "Famous for its safari animals and the Great Migration!" },
  { id: "NG", name: "Nigeria", capital: "Abuja", continent: "Africa", coordinates: [8.7, 9.1], population: 206139589, funFact: "The most populated country in Africa!" },
  { id: "MA", name: "Morocco", capital: "Rabat", continent: "Africa", coordinates: [-7.1, 31.8], population: 36910560, funFact: "Has beautiful blue cities and desert landscapes!" },
  { id: "TZ", name: "Tanzania", capital: "Dodoma", continent: "Africa", coordinates: [34.9, -6.4], population: 59734218, funFact: "Home to Mount Kilimanjaro, Africa's tallest mountain!" },
  { id: "ET", name: "Ethiopia", capital: "Addis Ababa", continent: "Africa", coordinates: [40.5, 9.1], population: 114963588, funFact: "The birthplace of coffee!" },
  { id: "GH", name: "Ghana", capital: "Accra", continent: "Africa", coordinates: [-1.0, 7.9], population: 31072940, funFact: "Known as the Gold Coast because of its gold!" },
  { id: "DZ", name: "Algeria", capital: "Algiers", continent: "Africa", coordinates: [1.7, 28.0], population: 43851044, funFact: "The largest country in Africa!" },
  { id: "TN", name: "Tunisia", capital: "Tunis", continent: "Africa", coordinates: [9.5, 33.9], population: 11818619, funFact: "Star Wars was filmed here in the Sahara Desert!" },
  { id: "ZW", name: "Zimbabwe", capital: "Harare", continent: "Africa", coordinates: [29.2, -19.0], population: 14862924, funFact: "Home to Victoria Falls, one of the largest waterfalls!" },
  { id: "AO", name: "Angola", capital: "Luanda", continent: "Africa", coordinates: [17.9, -11.2], population: 32866272, funFact: "Has one of the largest oil reserves in Africa!" },
  { id: "CM", name: "Cameroon", capital: "Yaounde", continent: "Africa", coordinates: [12.4, 7.4], population: 26545863, funFact: "Known as 'Africa in miniature' for its diverse landscapes!" },
  { id: "CI", name: "Ivory Coast", capital: "Yamoussoukro", continent: "Africa", coordinates: [-5.5, 7.5], population: 26378274, funFact: "Produces more cocoa than any other country!" },
  { id: "SN", name: "Senegal", capital: "Dakar", continent: "Africa", coordinates: [-14.5, 14.5], population: 16743927, funFact: "Home to the famous Paris-Dakar Rally finish line!" },
  { id: "SO", name: "Somalia", capital: "Mogadishu", continent: "Africa", coordinates: [46.2, 5.2], population: 15893222, funFact: "Has the longest coastline in mainland Africa!" },
  { id: "SD", name: "Sudan", capital: "Khartoum", continent: "Africa", coordinates: [30.2, 12.9], population: 43849260, funFact: "Has more pyramids than Egypt!" },
  { id: "LY", name: "Libya", capital: "Tripoli", continent: "Africa", coordinates: [17.2, 26.3], population: 6871292, funFact: "About 90% of the country is desert!" },
  { id: "UG", name: "Uganda", capital: "Kampala", continent: "Africa", coordinates: [32.3, 1.4], population: 45741007, funFact: "Home to half of the world's mountain gorillas!" },
  { id: "CD", name: "Democratic Republic of the Congo", capital: "Kinshasa", continent: "Africa", coordinates: [21.8, -4.0], population: 89561403, funFact: "Has the second largest rainforest in the world!" },
  { id: "CG", name: "Republic of the Congo", capital: "Brazzaville", continent: "Africa", coordinates: [15.8, -0.2], population: 5518087, funFact: "The two Congos' capitals face each other across a river!" },
  { id: "MZ", name: "Mozambique", capital: "Maputo", continent: "Africa", coordinates: [35.5, -18.7], population: 31255435, funFact: "Has the only flag with a rifle on it!" },
  { id: "MG", name: "Madagascar", capital: "Antananarivo", continent: "Africa", coordinates: [46.9, -18.8], population: 27691018, funFact: "Most of its animals are found nowhere else on Earth!" },
  { id: "ZM", name: "Zambia", capital: "Lusaka", continent: "Africa", coordinates: [27.8, -13.1], population: 18383955, funFact: "Home to Victoria Falls, called 'The Smoke that Thunders'!" },
  { id: "MW", name: "Malawi", capital: "Lilongwe", continent: "Africa", coordinates: [34.3, -13.3], population: 19129952, funFact: "Known as 'The Warm Heart of Africa'!" },
  { id: "ML", name: "Mali", capital: "Bamako", continent: "Africa", coordinates: [-4.0, 17.6], population: 20250833, funFact: "Home to the famous mud mosque of Djenne!" },
  { id: "NE", name: "Niger", capital: "Niamey", continent: "Africa", coordinates: [8.1, 17.6], population: 24206644, funFact: "Named after the Niger River!" },
  { id: "BF", name: "Burkina Faso", capital: "Ouagadougou", continent: "Africa", coordinates: [-1.6, 12.2], population: 20903273, funFact: "The name means 'Land of Honest People'!" },
  { id: "TD", name: "Chad", capital: "N'Djamena", continent: "Africa", coordinates: [18.7, 15.5], population: 16425864, funFact: "Has a lake that shrinks and grows with the seasons!" },
  { id: "MR", name: "Mauritania", capital: "Nouakchott", continent: "Africa", coordinates: [-10.9, 21.0], population: 4649658, funFact: "Has a giant rock formation called the 'Eye of the Sahara'!" },
  { id: "ER", name: "Eritrea", capital: "Asmara", continent: "Africa", coordinates: [39.8, 15.2], population: 3546421, funFact: "Has a railway built over 100 years ago that still runs!" },
  { id: "NA", name: "Namibia", capital: "Windhoek", continent: "Africa", coordinates: [18.5, -22.6], population: 2540905, funFact: "Has the world's oldest desert - the Namib!" },
  { id: "BW", name: "Botswana", capital: "Gaborone", continent: "Africa", coordinates: [24.7, -22.3], population: 2351627, funFact: "Has the largest elephant population in the world!" },
  { id: "GA", name: "Gabon", capital: "Libreville", continent: "Africa", coordinates: [11.8, -0.8], population: 2225734, funFact: "85% of the country is covered in rainforest!" },
  { id: "CF", name: "Central African Republic", capital: "Bangui", continent: "Africa", coordinates: [20.9, 6.6], population: 4829767, funFact: "Home to lowland gorillas and forest elephants!" },
  { id: "SS", name: "South Sudan", capital: "Juba", continent: "Africa", coordinates: [31.6, 6.9], population: 11193725, funFact: "The world's youngest country, founded in 2011!" },
  { id: "GN", name: "Guinea", capital: "Conakry", continent: "Africa", coordinates: [-9.7, 9.9], population: 13132795, funFact: "Home to the source of the Niger River!" },
  { id: "LR", name: "Liberia", capital: "Monrovia", continent: "Africa", coordinates: [-9.4, 6.4], population: 5057681, funFact: "Founded by freed American slaves!" },

  // ===== ASIA =====
  { id: "CN", name: "China", capital: "Beijing", continent: "Asia", coordinates: [104.2, 35.9], population: 1439323776, funFact: "Has the Great Wall, visible from space!" },
  { id: "JP", name: "Japan", capital: "Tokyo", continent: "Asia", coordinates: [138.3, 36.2], population: 126476461, funFact: "Has more vending machines per person than any country!" },
  { id: "IN", name: "India", capital: "New Delhi", continent: "Asia", coordinates: [78.9, 20.6], population: 1380004385, funFact: "Invented chess and the number zero!" },
  { id: "KR", name: "South Korea", capital: "Seoul", continent: "Asia", coordinates: [127.8, 35.9], population: 51269185, funFact: "Internet here is super fast - among the fastest in the world!" },
  { id: "TH", name: "Thailand", capital: "Bangkok", continent: "Asia", coordinates: [101.0, 15.9], population: 69799978, funFact: "Known as the 'Land of Smiles'!" },
  { id: "VN", name: "Vietnam", capital: "Hanoi", continent: "Asia", coordinates: [108.3, 14.1], population: 97338579, funFact: "Home to the world's largest cave!" },
  { id: "PH", name: "Philippines", capital: "Manila", continent: "Asia", coordinates: [122.0, 12.9], population: 109581078, funFact: "Has over 7,000 islands!" },
  { id: "ID", name: "Indonesia", capital: "Jakarta", continent: "Asia", coordinates: [113.9, -0.8], population: 273523615, funFact: "Has more than 17,000 islands - the most of any country!" },
  { id: "MY", name: "Malaysia", capital: "Kuala Lumpur", continent: "Asia", coordinates: [101.9, 4.2], population: 32365999, funFact: "Has one of the tallest twin towers in the world!" },
  { id: "SG", name: "Singapore", capital: "Singapore", continent: "Asia", coordinates: [103.8, 1.4], population: 5850342, funFact: "Chewing gum is banned here!" },
  { id: "AE", name: "United Arab Emirates", capital: "Abu Dhabi", continent: "Asia", coordinates: [54.0, 23.4], population: 9890402, funFact: "Has the tallest building in the world - Burj Khalifa!" },
  { id: "SA", name: "Saudi Arabia", capital: "Riyadh", continent: "Asia", coordinates: [45.1, 23.9], population: 34813871, funFact: "Has no rivers at all!" },
  { id: "TR", name: "Turkey", capital: "Ankara", continent: "Asia", coordinates: [35.2, 38.9], population: 84339067, funFact: "Spans two continents - Europe and Asia!" },
  { id: "IL", name: "Israel", capital: "Jerusalem", continent: "Asia", coordinates: [34.9, 31.0], population: 8655535, funFact: "The Dead Sea here is the lowest point on Earth!" },
  { id: "PK", name: "Pakistan", capital: "Islamabad", continent: "Asia", coordinates: [69.3, 30.4], population: 220892340, funFact: "Has some of the highest mountains in the world!" },
  { id: "BD", name: "Bangladesh", capital: "Dhaka", continent: "Asia", coordinates: [90.4, 23.7], population: 164689383, funFact: "Has the longest natural sea beach in the world!" },
  { id: "NP", name: "Nepal", capital: "Kathmandu", continent: "Asia", coordinates: [84.1, 28.4], population: 29136808, funFact: "Home to Mount Everest, the tallest mountain!" },
  { id: "LK", name: "Sri Lanka", capital: "Colombo", continent: "Asia", coordinates: [80.8, 7.9], population: 21413249, funFact: "Shaped like a teardrop!" },
  { id: "MM", name: "Myanmar", capital: "Naypyidaw", continent: "Asia", coordinates: [96.0, 21.9], population: 54409800, funFact: "Has more than 10,000 Buddhist temples!" },
  { id: "KH", name: "Cambodia", capital: "Phnom Penh", continent: "Asia", coordinates: [105.0, 12.6], population: 16718965, funFact: "Home to Angkor Wat, the largest religious monument!" },

  // ===== EUROPE =====
  { id: "GB", name: "United Kingdom", capital: "London", continent: "Europe", coordinates: [-3.4, 55.4], population: 67886011, funFact: "Big Ben isn't the clock - it's the bell inside!" },
  { id: "FR", name: "France", capital: "Paris", continent: "Europe", coordinates: [2.2, 46.2], population: 65273511, funFact: "Home to the Eiffel Tower - made of 18,000 iron pieces!" },
  { id: "DE", name: "Germany", capital: "Berlin", continent: "Europe", coordinates: [10.5, 51.2], population: 83783942, funFact: "Invented the printing press and the gummy bear!" },
  { id: "IT", name: "Italy", capital: "Rome", continent: "Europe", coordinates: [12.6, 41.9], population: 60461826, funFact: "Home to the leaning Tower of Pisa and amazing pizza!" },
  { id: "ES", name: "Spain", capital: "Madrid", continent: "Europe", coordinates: [-3.7, 40.5], population: 46754778, funFact: "People take afternoon naps called 'siestas'!" },
  { id: "PT", name: "Portugal", capital: "Lisbon", continent: "Europe", coordinates: [-8.2, 39.4], population: 10196709, funFact: "The oldest country in Europe with the same borders!" },
  { id: "NL", name: "Netherlands", capital: "Amsterdam", continent: "Europe", coordinates: [5.3, 52.1], population: 17134872, funFact: "Has more bicycles than people!" },
  { id: "BE", name: "Belgium", capital: "Brussels", continent: "Europe", coordinates: [4.5, 50.5], population: 11589623, funFact: "Famous for chocolate, waffles, and french fries!" },
  { id: "CH", name: "Switzerland", capital: "Bern", continent: "Europe", coordinates: [8.2, 46.8], population: 8654622, funFact: "Has the most mountains of any European country!" },
  { id: "AT", name: "Austria", capital: "Vienna", continent: "Europe", coordinates: [14.6, 47.5], population: 9006398, funFact: "The birthplace of Mozart!" },
  { id: "SE", name: "Sweden", capital: "Stockholm", continent: "Europe", coordinates: [18.6, 60.1], population: 10099265, funFact: "Home to IKEA and the Nobel Prize!" },
  { id: "NO", name: "Norway", capital: "Oslo", continent: "Europe", coordinates: [8.5, 60.5], population: 5421241, funFact: "Has fjords - long narrow inlets from the sea!" },
  { id: "DK", name: "Denmark", capital: "Copenhagen", continent: "Europe", coordinates: [9.5, 56.3], population: 5792202, funFact: "Home to LEGO bricks!" },
  { id: "FI", name: "Finland", capital: "Helsinki", continent: "Europe", coordinates: [26.0, 61.9], population: 5540720, funFact: "Has more saunas than cars!" },
  { id: "PL", name: "Poland", capital: "Warsaw", continent: "Europe", coordinates: [19.1, 51.9], population: 37846611, funFact: "Has Europe's last primeval forest!" },
  { id: "CZ", name: "Czech Republic", capital: "Prague", continent: "Europe", coordinates: [15.5, 49.8], population: 10708981, funFact: "Has one of the oldest universities in the world!" },
  { id: "GR", name: "Greece", capital: "Athens", continent: "Europe", coordinates: [21.8, 39.1], population: 10423054, funFact: "The birthplace of the Olympic Games!" },
  { id: "RU", name: "Russia", capital: "Moscow", continent: "Europe", coordinates: [105.3, 61.5], population: 145934462, funFact: "The largest country in the world - spans 11 time zones!" },
  { id: "UA", name: "Ukraine", capital: "Kyiv", continent: "Europe", coordinates: [31.2, 48.4], population: 43733762, funFact: "Has the deepest metro station in the world!" },
  { id: "IE", name: "Ireland", capital: "Dublin", continent: "Europe", coordinates: [-8.2, 53.4], population: 4937786, funFact: "Known as the Emerald Isle for its green landscapes!" },
  { id: "IS", name: "Iceland", capital: "Reykjavik", continent: "Europe", coordinates: [-19.0, 65.0], population: 341243, funFact: "Has no mosquitoes at all!" },
  { id: "HU", name: "Hungary", capital: "Budapest", continent: "Europe", coordinates: [19.5, 47.2], population: 9660351, funFact: "Invented the Rubik's Cube!" },
  { id: "RO", name: "Romania", capital: "Bucharest", continent: "Europe", coordinates: [25.0, 46.0], population: 19237691, funFact: "Home to Dracula's castle!" },

  // ===== NORTH AMERICA =====
  { id: "US", name: "United States", capital: "Washington D.C.", continent: "North America", coordinates: [-95.7, 37.1], population: 331002651, funFact: "Has the Grand Canyon, one of the seven natural wonders!" },
  { id: "CA", name: "Canada", capital: "Ottawa", continent: "North America", coordinates: [-106.3, 56.1], population: 37742154, funFact: "Has the longest coastline of any country!" },
  { id: "MX", name: "Mexico", capital: "Mexico City", continent: "North America", coordinates: [-102.6, 23.6], population: 128932753, funFact: "Invented chocolate drinks!" },
  { id: "CU", name: "Cuba", capital: "Havana", continent: "North America", coordinates: [-77.8, 21.5], population: 11326616, funFact: "Has classic cars from the 1950s still driving around!" },
  { id: "JM", name: "Jamaica", capital: "Kingston", continent: "North America", coordinates: [-77.3, 18.1], population: 2961167, funFact: "Birthplace of reggae music and Bob Marley!" },
  { id: "HT", name: "Haiti", capital: "Port-au-Prince", continent: "North America", coordinates: [-72.3, 19.0], population: 11402528, funFact: "The first Black republic in the world!" },
  { id: "DO", name: "Dominican Republic", capital: "Santo Domingo", continent: "North America", coordinates: [-70.2, 18.7], population: 10847910, funFact: "Where Christopher Columbus first landed in 1492!" },
  { id: "CR", name: "Costa Rica", capital: "San Jose", continent: "North America", coordinates: [-84.0, 9.7], population: 5094118, funFact: "Has no army - and uses that money for education!" },
  { id: "PA", name: "Panama", capital: "Panama City", continent: "North America", coordinates: [-80.8, 8.5], population: 4314767, funFact: "Has a famous canal connecting two oceans!" },
  { id: "GT", name: "Guatemala", capital: "Guatemala City", continent: "North America", coordinates: [-90.2, 15.8], population: 17915568, funFact: "Has ancient Mayan pyramids!" },
  { id: "HN", name: "Honduras", capital: "Tegucigalpa", continent: "North America", coordinates: [-86.2, 15.0], population: 9904607, funFact: "Has the second largest coral reef in the world!" },
  { id: "NI", name: "Nicaragua", capital: "Managua", continent: "North America", coordinates: [-85.2, 12.9], population: 6624554, funFact: "Has two lakes with freshwater sharks!" },
  { id: "SV", name: "El Salvador", capital: "San Salvador", continent: "North America", coordinates: [-88.9, 13.8], population: 6486205, funFact: "The smallest country in Central America!" },
  { id: "BZ", name: "Belize", capital: "Belmopan", continent: "North America", coordinates: [-88.5, 17.2], population: 397628, funFact: "Has the only jaguar preserve in the world!" },

  // ===== SOUTH AMERICA =====
  { id: "BR", name: "Brazil", capital: "Brasilia", continent: "South America", coordinates: [-51.9, -14.2], population: 212559417, funFact: "Has the Amazon Rainforest - the lungs of the Earth!" },
  { id: "AR", name: "Argentina", capital: "Buenos Aires", continent: "South America", coordinates: [-63.6, -38.4], population: 45195774, funFact: "Invented the tango dance!" },
  { id: "CL", name: "Chile", capital: "Santiago", continent: "South America", coordinates: [-71.5, -35.7], population: 19116201, funFact: "Is the longest and thinnest country!" },
  { id: "PE", name: "Peru", capital: "Lima", continent: "South America", coordinates: [-75.0, -9.2], population: 32971854, funFact: "Has Machu Picchu, the lost city of the Incas!" },
  { id: "CO", name: "Colombia", capital: "Bogota", continent: "South America", coordinates: [-74.3, 4.6], population: 50882891, funFact: "The only South American country with two coastlines!" },
  { id: "VE", name: "Venezuela", capital: "Caracas", continent: "South America", coordinates: [-66.6, 6.4], population: 28435940, funFact: "Has the world's highest waterfall - Angel Falls!" },
  { id: "EC", name: "Ecuador", capital: "Quito", continent: "South America", coordinates: [-78.2, -1.8], population: 17643054, funFact: "Named after the equator which runs through it!" },
  { id: "BO", name: "Bolivia", capital: "La Paz", continent: "South America", coordinates: [-63.6, -16.3], population: 11673021, funFact: "Has two capital cities and a salt flat you can walk on!" },
  { id: "PY", name: "Paraguay", capital: "Asuncion", continent: "South America", coordinates: [-58.4, -23.4], population: 7132538, funFact: "One of only two landlocked countries in South America!" },
  { id: "UY", name: "Uruguay", capital: "Montevideo", continent: "South America", coordinates: [-55.8, -32.5], population: 3473730, funFact: "Won the first ever FIFA World Cup in 1930!" },
  { id: "GY", name: "Guyana", capital: "Georgetown", continent: "South America", coordinates: [-58.9, 5.0], population: 786552, funFact: "The only English-speaking country in South America!" },
  { id: "SR", name: "Suriname", capital: "Paramaribo", continent: "South America", coordinates: [-56.0, 4.0], population: 586632, funFact: "The smallest country in South America!" },

  // ===== OCEANIA =====
  { id: "AU", name: "Australia", capital: "Canberra", continent: "Oceania", coordinates: [133.8, -25.3], population: 25499884, funFact: "Has animals found nowhere else - kangaroos and koalas!" },
  { id: "NZ", name: "New Zealand", capital: "Wellington", continent: "Oceania", coordinates: [174.9, -40.9], population: 4822233, funFact: "Where Lord of the Rings was filmed - it looks like Middle-earth!" },
  { id: "FJ", name: "Fiji", capital: "Suva", continent: "Oceania", coordinates: [178.0, -18.0], population: 896445, funFact: "Has over 300 islands but only 100 are inhabited!" },
  { id: "PG", name: "Papua New Guinea", capital: "Port Moresby", continent: "Oceania", coordinates: [147.2, -6.3], population: 8947024, funFact: "Has over 800 different languages spoken!" },
  { id: "WS", name: "Samoa", capital: "Apia", continent: "Oceania", coordinates: [-172.1, -13.8], population: 198414, funFact: "The sun rises here first each day!" },
  { id: "TO", name: "Tonga", capital: "Nukualofa", continent: "Oceania", coordinates: [-175.2, -21.2], population: 105695, funFact: "The only Pacific island never colonized by Europeans!" },
  { id: "VU", name: "Vanuatu", capital: "Port Vila", continent: "Oceania", coordinates: [166.9, -15.4], population: 307145, funFact: "Has active volcanoes you can visit!" },
  { id: "SB", name: "Solomon Islands", capital: "Honiara", continent: "Oceania", coordinates: [160.2, -9.6], population: 686884, funFact: "Has over 900 islands forming a chain!" },
  { id: "PW", name: "Palau", capital: "Ngerulmud", continent: "Oceania", coordinates: [134.6, 7.5], population: 18094, funFact: "Has a lake full of jellyfish that don't sting!" },
  { id: "NR", name: "Nauru", capital: "Yaren", continent: "Oceania", coordinates: [166.9, -0.5], population: 10824, funFact: "The third smallest country in the world!" },
];

// Get countries by continent
export function getCountriesByContinent(continent: CountryData['continent']): CountryData[] {
  return countries.filter(country => country.continent === continent);
}

// Get country by ISO code
export function getCountryByCode(code: string): CountryData | undefined {
  return countries.find(country => country.id === code.toUpperCase());
}

// Get country by name
export function getCountryByName(name: string): CountryData | undefined {
  return countries.find(country => country.name.toLowerCase() === name.toLowerCase());
}

// Get random country
export function getRandomCountry(continent?: CountryData['continent'], exclude?: string[]): CountryData {
  let available = continent
    ? countries.filter(c => c.continent === continent)
    : countries;

  if (exclude) {
    available = available.filter(c => !exclude.includes(c.id));
  }

  return available[Math.floor(Math.random() * available.length)];
}

// Get flag URL for a country
export function getFlagUrl(countryCode: string, size: number = 80): string {
  return `https://flagcdn.com/w${size}/${countryCode.toLowerCase()}.png`;
}

// Continent metadata
export const continentInfo = {
  'Africa': { color: '#8BC34A', emoji: '🌍', countries: 54 },
  'Asia': { color: '#FF9800', emoji: '🌏', countries: 48 },
  'Europe': { color: '#4CAF50', emoji: '🏰', countries: 44 },
  'North America': { color: '#9C27B0', emoji: '🦅', countries: 23 },
  'South America': { color: '#673AB7', emoji: '🌴', countries: 12 },
  'Oceania': { color: '#00BCD4', emoji: '🏝️', countries: 14 },
};

export default countries;
