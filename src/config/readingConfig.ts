// Reading Mode Configuration
// Word lists sourced from Dolch and Fry sight word lists
// Organized by difficulty for kindergarten through 2nd grade
//
// EDITING WORD LISTS:
// General word categories (CVC, Dolch, First Grade, Second Grade, Advanced)
// are loaded from JSON files in /src/data/words/*.json
// You can edit those files directly to add/remove/modify words.
//
// Specialized categories (States, Minecraft, Science) are defined in this file.

// Import word lists from JSON files
import {
  cvcWords,
  dolchPrePrimerWords,
  dolchFirstGradeWords,
  dolchSecondGradeWords,
  advancedWords,
} from '../data/words';

export type GameMode = 'math' | 'reading' | 'geography' | 'charts' | 'comparison' | 'tables' | 'algebra' | 'graphExplorer' | 'wordProblems' | 'arcade';

export type WordCategory = 'cvc' | 'dolch' | 'first-grade' | 'second-grade' | 'advanced' | 'states' | 'minecraft' | 'science';

export interface ReadingWord {
  word: string;
  sentence: string;       // Short sentence with the word (2-8 words)
  syllables?: string[];   // Syllable breakdown for harder words
  pronunciations?: string[]; // Alternative pronunciations/homophones
  difficulty: 1 | 2 | 3 | 4 | 5 | 6; // Maps to level
  category?: WordCategory; // Category for themed levels
}

export interface ReadingLevelConfig {
  id: number;
  name: string;
  description: string;
  targetWordsPerMinute: number;
  wordsToWin: number;
  color: string;
  emoji: string;
  showSyllables: boolean;   // Whether to show syllable breakdown
  wordDifficulties?: number[]; // Which difficulty words to include (for general levels)
  wordCategories?: WordCategory[]; // Which categories to include (for themed levels)
}

// Reading levels - 6 general + 3 themed categories
export const readingLevels: ReadingLevelConfig[] = [
  // General reading levels
  {
    id: 1,
    name: "Letter Sounds",
    description: "Simple 3-letter CVC words (cat, dog, run)",
    targetWordsPerMinute: 3,
    wordsToWin: 30,
    color: "#4CAF50",
    emoji: "🐣",
    showSyllables: false,
    wordDifficulties: [1],
  },
  {
    id: 2,
    name: "Sight Words",
    description: "Common sight words every reader needs",
    targetWordsPerMinute: 4,
    wordsToWin: 30,
    color: "#2196F3",
    emoji: "👀",
    showSyllables: false,
    wordDifficulties: [1, 2],
  },
  {
    id: 3,
    name: "Word Builder",
    description: "Longer words with syllable helpers",
    targetWordsPerMinute: 4,
    wordsToWin: 30,
    color: "#9C27B0",
    emoji: "🔨",
    showSyllables: true,
    wordDifficulties: [2, 3],
  },
  {
    id: 4,
    name: "First Grade",
    description: "First grade reading words",
    targetWordsPerMinute: 5,
    wordsToWin: 30,
    color: "#FF9800",
    emoji: "📚",
    showSyllables: true,
    wordDifficulties: [3, 4],
  },
  {
    id: 5,
    name: "Second Grade",
    description: "Challenge yourself with harder words!",
    targetWordsPerMinute: 5,
    wordsToWin: 30,
    color: "#F44336",
    emoji: "🎓",
    showSyllables: true,
    wordDifficulties: [4, 5],
  },
  {
    id: 6,
    name: "Reading Star",
    description: "Master level - all word types!",
    targetWordsPerMinute: 6,
    wordsToWin: 35,
    color: "#E91E63",
    emoji: "⭐",
    showSyllables: true,
    wordDifficulties: [4, 5, 6],
  },
  // Themed categories
  {
    id: 7,
    name: "US States",
    description: "Learn all 50 state names!",
    targetWordsPerMinute: 4,
    wordsToWin: 30,
    color: "#1976D2",
    emoji: "🇺🇸",
    showSyllables: true,
    wordCategories: ['states'],
  },
  {
    id: 8,
    name: "Minecraft",
    description: "Words from your favorite game!",
    targetWordsPerMinute: 4,
    wordsToWin: 30,
    color: "#8BC34A",
    emoji: "⛏️",
    showSyllables: true,
    wordCategories: ['minecraft'],
  },
  {
    id: 9,
    name: "Science & Space",
    description: "Explore science vocabulary!",
    targetWordsPerMinute: 4,
    wordsToWin: 30,
    color: "#673AB7",
    emoji: "🔬",
    showSyllables: true,
    wordCategories: ['science'],
  },
];

// US States - All 50 states with category tag
const usStatesWords: ReadingWord[] = [
  // A states
  { word: "Alabama", sentence: "Alabama is in the South.", difficulty: 4, syllables: ["Al", "a", "bam", "a"], category: 'states' },
  { word: "Alaska", sentence: "Alaska is very cold.", difficulty: 4, syllables: ["A", "las", "ka"], category: 'states' },
  { word: "Arizona", sentence: "Arizona is hot.", difficulty: 4, syllables: ["Ar", "i", "zo", "na"], category: 'states' },
  { word: "Arkansas", sentence: "Arkansas has forests.", difficulty: 4, syllables: ["Ar", "kan", "saw"], pronunciations: ["ar-kan-saw"], category: 'states' },
  // C states
  { word: "California", sentence: "California has beaches.", difficulty: 5, syllables: ["Cal", "i", "for", "nia"], category: 'states' },
  { word: "Colorado", sentence: "Colorado has skiing.", difficulty: 4, syllables: ["Col", "o", "ra", "do"], category: 'states' },
  { word: "Connecticut", sentence: "Connecticut is small.", difficulty: 5, syllables: ["Con", "nect", "i", "cut"], category: 'states' },
  // D states
  { word: "Delaware", sentence: "Delaware is tiny.", difficulty: 4, syllables: ["Del", "a", "ware"], category: 'states' },
  // F states
  { word: "Florida", sentence: "Florida is sunny.", difficulty: 4, syllables: ["Flor", "i", "da"], category: 'states' },
  // G states
  { word: "Georgia", sentence: "Georgia grows peaches.", difficulty: 3, syllables: ["Geor", "gia"], category: 'states' },
  // H states
  { word: "Hawaii", sentence: "Hawaii has beaches.", difficulty: 4, syllables: ["Ha", "wai", "i"], pronunciations: ["huh-why-ee"], category: 'states' },
  // I states
  { word: "Idaho", sentence: "Idaho has potatoes.", difficulty: 3, syllables: ["I", "da", "ho"], category: 'states' },
  { word: "Illinois", sentence: "Illinois has Chicago.", difficulty: 4, syllables: ["Il", "li", "nois"], pronunciations: ["il-uh-noy"], category: 'states' },
  { word: "Indiana", sentence: "Indiana has racing.", difficulty: 4, syllables: ["In", "di", "an", "a"], category: 'states' },
  { word: "Iowa", sentence: "Iowa grows corn.", difficulty: 3, syllables: ["I", "o", "wa"], category: 'states' },
  // K states
  { word: "Kansas", sentence: "Kansas has farms.", difficulty: 3, syllables: ["Kan", "sas"], category: 'states' },
  { word: "Kentucky", sentence: "Kentucky has horses.", difficulty: 4, syllables: ["Ken", "tuck", "y"], category: 'states' },
  // L states
  { word: "Louisiana", sentence: "Louisiana has jazz.", difficulty: 5, syllables: ["Lou", "i", "si", "ana"], category: 'states' },
  // M states
  { word: "Maine", sentence: "Maine has lobster.", difficulty: 3, category: 'states' },
  { word: "Maryland", sentence: "Maryland has crabs.", difficulty: 4, syllables: ["Mar", "y", "land"], category: 'states' },
  { word: "Massachusetts", sentence: "Massachusetts has Boston.", difficulty: 5, syllables: ["Mass", "a", "chu", "setts"], category: 'states' },
  { word: "Michigan", sentence: "Michigan has lakes.", difficulty: 4, syllables: ["Mich", "i", "gan"], category: 'states' },
  { word: "Minnesota", sentence: "Minnesota is cold.", difficulty: 4, syllables: ["Min", "ne", "so", "ta"], category: 'states' },
  { word: "Mississippi", sentence: "Mississippi has a river.", difficulty: 5, syllables: ["Miss", "iss", "ip", "pi"], category: 'states' },
  { word: "Missouri", sentence: "Missouri is central.", difficulty: 4, syllables: ["Miss", "our", "i"], category: 'states' },
  { word: "Montana", sentence: "Montana is big sky.", difficulty: 4, syllables: ["Mon", "tan", "a"], category: 'states' },
  // N states
  { word: "Nebraska", sentence: "Nebraska has farms.", difficulty: 4, syllables: ["Ne", "bras", "ka"], category: 'states' },
  { word: "Nevada", sentence: "Nevada has deserts.", difficulty: 3, syllables: ["Ne", "va", "da"], category: 'states' },
  { word: "New Hampshire", sentence: "New Hampshire has mountains.", difficulty: 4, syllables: ["New", "Hamp", "shire"], category: 'states' },
  { word: "New Jersey", sentence: "New Jersey has beaches.", difficulty: 4, syllables: ["New", "Jer", "sey"], category: 'states' },
  { word: "New Mexico", sentence: "New Mexico has deserts.", difficulty: 4, syllables: ["New", "Mex", "i", "co"], category: 'states' },
  { word: "New York", sentence: "New York is busy.", difficulty: 3, syllables: ["New", "York"], category: 'states' },
  { word: "North Carolina", sentence: "North Carolina has beaches.", difficulty: 5, syllables: ["North", "Car", "o", "li", "na"], category: 'states' },
  { word: "North Dakota", sentence: "North Dakota is cold.", difficulty: 4, syllables: ["North", "Da", "ko", "ta"], category: 'states' },
  // O states
  { word: "Ohio", sentence: "Ohio has nice lakes.", difficulty: 3, syllables: ["O", "hi", "o"], category: 'states' },
  { word: "Oklahoma", sentence: "Oklahoma has tornadoes.", difficulty: 4, syllables: ["Ok", "la", "ho", "ma"], category: 'states' },
  { word: "Oregon", sentence: "Oregon has forests.", difficulty: 3, syllables: ["Or", "e", "gon"], category: 'states' },
  // P states
  { word: "Pennsylvania", sentence: "Pennsylvania is historic.", difficulty: 5, syllables: ["Penn", "syl", "va", "nia"], category: 'states' },
  // R states
  { word: "Rhode Island", sentence: "Rhode Island is small.", difficulty: 4, syllables: ["Rhode", "Is", "land"], category: 'states' },
  // S states
  { word: "South Carolina", sentence: "South Carolina is warm.", difficulty: 5, syllables: ["South", "Car", "o", "li", "na"], category: 'states' },
  { word: "South Dakota", sentence: "South Dakota has Mount Rushmore.", difficulty: 4, syllables: ["South", "Da", "ko", "ta"], category: 'states' },
  // T states
  { word: "Tennessee", sentence: "Tennessee has music.", difficulty: 4, syllables: ["Ten", "nes", "see"], category: 'states' },
  { word: "Texas", sentence: "Texas is very big.", difficulty: 3, syllables: ["Tex", "as"], category: 'states' },
  // U states
  { word: "Utah", sentence: "Utah has mountains.", difficulty: 3, syllables: ["U", "tah"], category: 'states' },
  // V states
  { word: "Vermont", sentence: "Vermont has maple syrup.", difficulty: 3, syllables: ["Ver", "mont"], category: 'states' },
  { word: "Virginia", sentence: "Virginia is historic.", difficulty: 4, syllables: ["Vir", "gin", "ia"], category: 'states' },
  // W states
  { word: "Washington", sentence: "Washington has apples.", difficulty: 4, syllables: ["Wash", "ing", "ton"], category: 'states' },
  { word: "West Virginia", sentence: "West Virginia has mountains.", difficulty: 5, syllables: ["West", "Vir", "gin", "ia"], category: 'states' },
  { word: "Wisconsin", sentence: "Wisconsin has cheese.", difficulty: 4, syllables: ["Wis", "con", "sin"], category: 'states' },
  { word: "Wyoming", sentence: "Wyoming has cowboys.", difficulty: 3, syllables: ["Wy", "o", "ming"], category: 'states' },
];

// Minecraft Words - Expanded with category tag
const minecraftWords: ReadingWord[] = [
  // Basic items and blocks
  { word: "block", sentence: "Place a block here.", difficulty: 3, category: 'minecraft' },
  { word: "mine", sentence: "Mine for diamonds.", difficulty: 3, category: 'minecraft' },
  { word: "craft", sentence: "Craft a new tool.", difficulty: 3, category: 'minecraft' },
  { word: "build", sentence: "Build a house.", difficulty: 3, category: 'minecraft' },
  { word: "sword", sentence: "Use your sword.", difficulty: 3, category: 'minecraft' },
  { word: "wood", sentence: "Chop the wood.", difficulty: 3, category: 'minecraft' },
  { word: "stone", sentence: "Make stone tools.", difficulty: 3, category: 'minecraft' },
  { word: "dirt", sentence: "Dig the dirt.", difficulty: 3, category: 'minecraft' },
  { word: "sand", sentence: "Find some sand.", difficulty: 3, category: 'minecraft' },
  { word: "tree", sentence: "Cut down a tree.", difficulty: 3, category: 'minecraft' },
  { word: "gold", sentence: "I found gold!", difficulty: 3, category: 'minecraft' },
  { word: "iron", sentence: "I need iron ore.", difficulty: 3, syllables: ["i", "ron"], category: 'minecraft' },
  { word: "coal", sentence: "Mine some coal.", difficulty: 3, category: 'minecraft' },
  { word: "bed", sentence: "Sleep in a bed.", difficulty: 3, category: 'minecraft' },
  { word: "door", sentence: "Open the door.", difficulty: 3, category: 'minecraft' },
  { word: "axe", sentence: "Chop with an axe.", difficulty: 3, category: 'minecraft' },
  { word: "bow", sentence: "Shoot the bow.", difficulty: 3, category: 'minecraft' },
  { word: "egg", sentence: "Throw an egg.", difficulty: 3, category: 'minecraft' },
  { word: "fish", sentence: "Catch a fish.", difficulty: 3, category: 'minecraft' },
  { word: "food", sentence: "Eat some food.", difficulty: 3, category: 'minecraft' },

  // Animals
  { word: "pig", sentence: "A pig is nearby.", difficulty: 3, category: 'minecraft' },
  { word: "cow", sentence: "Milk the cow.", difficulty: 3, category: 'minecraft' },
  { word: "sheep", sentence: "Shear the sheep.", difficulty: 3, category: 'minecraft' },
  { word: "wolf", sentence: "Tame the wolf.", difficulty: 3, category: 'minecraft' },
  { word: "cat", sentence: "Pet the cat.", difficulty: 3, category: 'minecraft' },
  { word: "horse", sentence: "Ride the horse.", difficulty: 3, category: 'minecraft' },
  { word: "chicken", sentence: "The chicken lays eggs.", difficulty: 4, syllables: ["chick", "en"], category: 'minecraft' },
  { word: "rabbit", sentence: "A rabbit hops.", difficulty: 4, syllables: ["rab", "bit"], category: 'minecraft' },
  { word: "parrot", sentence: "The parrot flies.", difficulty: 4, syllables: ["par", "rot"], category: 'minecraft' },
  { word: "dolphin", sentence: "Swim with the dolphin.", difficulty: 4, syllables: ["dol", "phin"], category: 'minecraft' },
  { word: "turtle", sentence: "A turtle swims.", difficulty: 4, syllables: ["tur", "tle"], category: 'minecraft' },
  { word: "panda", sentence: "A panda eats bamboo.", difficulty: 4, syllables: ["pan", "da"], category: 'minecraft' },
  { word: "fox", sentence: "A fox is sneaky.", difficulty: 3, category: 'minecraft' },
  { word: "bee", sentence: "The bee makes honey.", difficulty: 3, category: 'minecraft' },

  // Monsters
  { word: "creeper", sentence: "Watch out for the creeper!", difficulty: 4, syllables: ["creep", "er"], category: 'minecraft' },
  { word: "zombie", sentence: "A zombie is coming.", difficulty: 4, syllables: ["zom", "bie"], category: 'minecraft' },
  { word: "skeleton", sentence: "The skeleton shoots arrows.", difficulty: 4, syllables: ["skel", "e", "ton"], category: 'minecraft' },
  { word: "spider", sentence: "A spider climbs walls.", difficulty: 4, syllables: ["spi", "der"], category: 'minecraft' },
  { word: "slime", sentence: "A slime bounces.", difficulty: 3, category: 'minecraft' },
  { word: "ghast", sentence: "A ghast shoots fireballs.", difficulty: 3, category: 'minecraft' },
  { word: "blaze", sentence: "A blaze is on fire.", difficulty: 3, category: 'minecraft' },
  { word: "witch", sentence: "A witch throws potions.", difficulty: 3, category: 'minecraft' },
  { word: "warden", sentence: "The warden is scary.", difficulty: 4, syllables: ["war", "den"], category: 'minecraft' },
  { word: "phantom", sentence: "A phantom attacks at night.", difficulty: 4, syllables: ["phan", "tom"], category: 'minecraft' },
  { word: "drowned", sentence: "The drowned swims.", difficulty: 3, category: 'minecraft' },
  { word: "piglin", sentence: "Trade with a piglin.", difficulty: 4, syllables: ["pig", "lin"], category: 'minecraft' },

  // Items and tools
  { word: "diamond", sentence: "I found a diamond!", difficulty: 4, syllables: ["di", "a", "mond"], category: 'minecraft' },
  { word: "pickaxe", sentence: "Use your pickaxe.", difficulty: 4, syllables: ["pick", "axe"], category: 'minecraft' },
  { word: "armor", sentence: "Wear your armor.", difficulty: 4, syllables: ["ar", "mor"], category: 'minecraft' },
  { word: "chest", sentence: "Open the chest.", difficulty: 3, category: 'minecraft' },
  { word: "torch", sentence: "Place a torch.", difficulty: 3, category: 'minecraft' },
  { word: "ladder", sentence: "Climb the ladder.", difficulty: 4, syllables: ["lad", "der"], category: 'minecraft' },
  { word: "bucket", sentence: "Fill the bucket.", difficulty: 4, syllables: ["buck", "et"], category: 'minecraft' },
  { word: "shield", sentence: "Block with your shield.", difficulty: 3, category: 'minecraft' },
  { word: "helmet", sentence: "Wear a helmet.", difficulty: 4, syllables: ["hel", "met"], category: 'minecraft' },
  { word: "boots", sentence: "Wear iron boots.", difficulty: 3, category: 'minecraft' },
  { word: "arrow", sentence: "Shoot an arrow.", difficulty: 4, syllables: ["ar", "row"], category: 'minecraft' },
  { word: "shovel", sentence: "Dig with a shovel.", difficulty: 4, syllables: ["shov", "el"], category: 'minecraft' },
  { word: "hoe", sentence: "Use the hoe.", difficulty: 3, category: 'minecraft' },

  // Blocks and materials
  { word: "cobblestone", sentence: "Make cobblestone walls.", difficulty: 5, syllables: ["cob", "ble", "stone"], category: 'minecraft' },
  { word: "obsidian", sentence: "Mine obsidian carefully.", difficulty: 5, syllables: ["ob", "sid", "i", "an"], category: 'minecraft' },
  { word: "netherite", sentence: "Netherite is the strongest.", difficulty: 5, syllables: ["neth", "er", "ite"], category: 'minecraft' },
  { word: "emerald", sentence: "An emerald is green.", difficulty: 4, syllables: ["em", "er", "ald"], category: 'minecraft' },
  { word: "copper", sentence: "Copper turns green.", difficulty: 4, syllables: ["cop", "per"], category: 'minecraft' },
  { word: "amethyst", sentence: "Amethyst is purple.", difficulty: 5, syllables: ["am", "e", "thyst"], category: 'minecraft' },
  { word: "gravel", sentence: "Gravel falls down.", difficulty: 4, syllables: ["grav", "el"], category: 'minecraft' },
  { word: "glass", sentence: "Make some glass.", difficulty: 3, category: 'minecraft' },
  { word: "brick", sentence: "Build with bricks.", difficulty: 3, category: 'minecraft' },

  // Structures and places
  { word: "village", sentence: "Find a village.", difficulty: 4, syllables: ["vil", "lage"], category: 'minecraft' },
  { word: "portal", sentence: "Enter the portal.", difficulty: 4, syllables: ["por", "tal"], category: 'minecraft' },
  { word: "nether", sentence: "Go to the nether.", difficulty: 4, syllables: ["neth", "er"], category: 'minecraft' },
  { word: "furnace", sentence: "Smelt in the furnace.", difficulty: 4, syllables: ["fur", "nace"], category: 'minecraft' },
  { word: "beacon", sentence: "Make a beacon.", difficulty: 4, syllables: ["bea", "con"], category: 'minecraft' },
  { word: "anvil", sentence: "Use the anvil.", difficulty: 4, syllables: ["an", "vil"], category: 'minecraft' },
  { word: "spawner", sentence: "Find a spawner.", difficulty: 4, syllables: ["spawn", "er"], category: 'minecraft' },
  { word: "dungeon", sentence: "Explore the dungeon.", difficulty: 4, syllables: ["dun", "geon"], category: 'minecraft' },
  { word: "stronghold", sentence: "Find the stronghold.", difficulty: 4, syllables: ["strong", "hold"], category: 'minecraft' },
  { word: "mansion", sentence: "Find the mansion.", difficulty: 4, syllables: ["man", "sion"], category: 'minecraft' },
  { word: "temple", sentence: "Explore the temple.", difficulty: 4, syllables: ["tem", "ple"], category: 'minecraft' },
  { word: "biome", sentence: "A new biome!", difficulty: 4, syllables: ["bi", "ome"], category: 'minecraft' },

  // Elements
  { word: "lava", sentence: "Don't fall in lava!", difficulty: 4, syllables: ["la", "va"], category: 'minecraft' },
  { word: "water", sentence: "Get some water.", difficulty: 4, syllables: ["wa", "ter"], category: 'minecraft' },
  { word: "fire", sentence: "Put out the fire.", difficulty: 3, category: 'minecraft' },

  // Advanced concepts
  { word: "enderman", sentence: "Don't look at the enderman!", difficulty: 5, syllables: ["en", "der", "man"], category: 'minecraft' },
  { word: "ender dragon", sentence: "Defeat the ender dragon.", difficulty: 5, syllables: ["en", "der", "dra", "gon"], category: 'minecraft' },
  { word: "enchant", sentence: "Enchant your sword.", difficulty: 4, syllables: ["en", "chant"], category: 'minecraft' },
  { word: "potion", sentence: "Brew a potion.", difficulty: 4, syllables: ["po", "tion"], category: 'minecraft' },
  { word: "villager", sentence: "Trade with the villager.", difficulty: 5, syllables: ["vil", "la", "ger"], category: 'minecraft' },
  { word: "redstone", sentence: "Use redstone for power.", difficulty: 4, syllables: ["red", "stone"], category: 'minecraft' },
  { word: "survival", sentence: "Play survival mode.", difficulty: 5, syllables: ["sur", "vi", "val"], category: 'minecraft' },
  { word: "creative", sentence: "Build in creative mode.", difficulty: 5, syllables: ["cre", "a", "tive"], category: 'minecraft' },
  { word: "adventure", sentence: "Start an adventure.", difficulty: 5, syllables: ["ad", "ven", "ture"], category: 'minecraft' },
  { word: "inventory", sentence: "Check your inventory.", difficulty: 5, syllables: ["in", "ven", "tor", "y"], category: 'minecraft' },
  { word: "experience", sentence: "Gain experience points.", difficulty: 5, syllables: ["ex", "per", "i", "ence"], category: 'minecraft' },
  { word: "crafting", sentence: "Use the crafting table.", difficulty: 4, syllables: ["craft", "ing"], category: 'minecraft' },
  { word: "smelting", sentence: "Smelting makes iron.", difficulty: 4, syllables: ["smelt", "ing"], category: 'minecraft' },
  { word: "brewing", sentence: "Brewing makes potions.", difficulty: 4, syllables: ["brew", "ing"], category: 'minecraft' },
  { word: "respawn", sentence: "Respawn at your bed.", difficulty: 4, syllables: ["re", "spawn"], category: 'minecraft' },
  { word: "hardcore", sentence: "Hardcore mode is hard.", difficulty: 4, syllables: ["hard", "core"], category: 'minecraft' },
];

// Science and Space Words (Difficulty 3-6)
const scienceSpaceWords: ReadingWord[] = [
  // ===== SPACE & ASTRONOMY =====
  // Basic space words (Difficulty 3)
  { word: "sun", sentence: "The sun is a star.", difficulty: 3, category: 'science' },
  { word: "moon", sentence: "The moon glows bright.", difficulty: 3, category: 'science' },
  { word: "star", sentence: "A star twinkles.", difficulty: 3, category: 'science' },
  { word: "sky", sentence: "Look at the sky.", difficulty: 3, category: 'science' },

  // Planets (Difficulty 4-5)
  { word: "planet", sentence: "Earth is our planet.", difficulty: 4, syllables: ["plan", "et"], category: 'science' },
  { word: "Earth", sentence: "We live on Earth.", difficulty: 4, category: 'science' },
  { word: "Mars", sentence: "Mars is the red planet.", difficulty: 4, category: 'science' },
  { word: "Venus", sentence: "Venus is very hot.", difficulty: 4, syllables: ["Ve", "nus"], category: 'science' },
  { word: "Saturn", sentence: "Saturn has rings.", difficulty: 4, syllables: ["Sat", "urn"], category: 'science' },
  { word: "Jupiter", sentence: "Jupiter is huge.", difficulty: 4, syllables: ["Ju", "pi", "ter"], category: 'science' },
  { word: "Neptune", sentence: "Neptune is far away.", difficulty: 5, syllables: ["Nep", "tune"], category: 'science' },
  { word: "Uranus", sentence: "Uranus is an ice giant.", difficulty: 5, syllables: ["U", "ra", "nus"], pronunciations: ["yoor-uh-nuhs"], category: 'science' },
  { word: "Mercury", sentence: "Mercury is closest to the sun.", difficulty: 5, syllables: ["Mer", "cu", "ry"], category: 'science' },
  { word: "Pluto", sentence: "Pluto is a dwarf planet.", difficulty: 5, syllables: ["Plu", "to"], category: 'science' },

  // Space objects and concepts
  { word: "space", sentence: "Rockets go to space.", difficulty: 4, category: 'science' },
  { word: "rocket", sentence: "The rocket takes off.", difficulty: 4, syllables: ["rock", "et"], category: 'science' },
  { word: "orbit", sentence: "The moon orbits Earth.", difficulty: 4, syllables: ["or", "bit"], category: 'science' },
  { word: "comet", sentence: "A comet has a tail.", difficulty: 4, syllables: ["com", "et"], category: 'science' },
  { word: "asteroid", sentence: "An asteroid flies through space.", difficulty: 5, syllables: ["as", "ter", "oid"], category: 'science' },
  { word: "telescope", sentence: "Look through a telescope.", difficulty: 5, syllables: ["tel", "e", "scope"], category: 'science' },
  { word: "astronaut", sentence: "An astronaut goes to space.", difficulty: 5, syllables: ["as", "tro", "naut"], category: 'science' },
  { word: "gravity", sentence: "Gravity pulls us down.", difficulty: 5, syllables: ["grav", "i", "ty"], category: 'science' },
  { word: "constellation", sentence: "Find a constellation.", difficulty: 6, syllables: ["con", "stel", "la", "tion"], category: 'science' },
  { word: "atmosphere", sentence: "Earth has an atmosphere.", difficulty: 6, syllables: ["at", "mos", "phere"], category: 'science' },
  { word: "galaxy", sentence: "We live in a galaxy.", difficulty: 5, syllables: ["gal", "ax", "y"], category: 'science' },
  { word: "meteor", sentence: "A meteor shoots across the sky.", difficulty: 5, syllables: ["me", "te", "or"], category: 'science' },
  { word: "shuttle", sentence: "The space shuttle launched.", difficulty: 4, syllables: ["shut", "tle"], category: 'science' },
  { word: "satellite", sentence: "A satellite orbits Earth.", difficulty: 5, syllables: ["sat", "el", "lite"], category: 'science' },
  { word: "lunar", sentence: "A lunar eclipse is cool.", difficulty: 4, syllables: ["lu", "nar"], category: 'science' },
  { word: "solar", sentence: "The solar system is big.", difficulty: 4, syllables: ["so", "lar"], category: 'science' },
  { word: "cosmos", sentence: "The cosmos is endless.", difficulty: 5, syllables: ["cos", "mos"], category: 'science' },
  { word: "nebula", sentence: "A nebula is colorful.", difficulty: 5, syllables: ["neb", "u", "la"], category: 'science' },

  // ===== BIOLOGY & BODY =====
  // Body parts (Difficulty 3-4)
  { word: "heart", sentence: "Your heart pumps blood.", difficulty: 3, category: 'science' },
  { word: "brain", sentence: "Your brain helps you think.", difficulty: 3, category: 'science' },
  { word: "lungs", sentence: "Your lungs help you breathe.", difficulty: 3, category: 'science' },
  { word: "bone", sentence: "A bone is hard.", difficulty: 3, category: 'science' },
  { word: "skin", sentence: "Skin protects your body.", difficulty: 3, category: 'science' },
  { word: "blood", sentence: "Blood is red.", difficulty: 3, category: 'science' },
  { word: "muscle", sentence: "A muscle helps you move.", difficulty: 4, syllables: ["mus", "cle"], category: 'science' },
  { word: "stomach", sentence: "Food goes to your stomach.", difficulty: 4, syllables: ["stom", "ach"], category: 'science' },
  { word: "kidney", sentence: "You have two kidneys.", difficulty: 4, syllables: ["kid", "ney"], category: 'science' },
  { word: "liver", sentence: "The liver cleans blood.", difficulty: 4, syllables: ["liv", "er"], category: 'science' },
  { word: "spine", sentence: "Your spine helps you stand.", difficulty: 3, category: 'science' },
  { word: "nerve", sentence: "A nerve sends signals.", difficulty: 3, category: 'science' },
  { word: "vein", sentence: "Blood flows in a vein.", difficulty: 3, category: 'science' },
  { word: "skeleton", sentence: "A skeleton is made of bones.", difficulty: 5, syllables: ["skel", "e", "ton"], category: 'science' },

  // Cells and biology
  { word: "cell", sentence: "A cell is very tiny.", difficulty: 3, category: 'science' },
  { word: "germ", sentence: "Wash away the germs.", difficulty: 3, category: 'science' },
  { word: "virus", sentence: "A virus can make you sick.", difficulty: 4, syllables: ["vi", "rus"], category: 'science' },
  { word: "bacteria", sentence: "Bacteria are tiny.", difficulty: 5, syllables: ["bac", "te", "ria"], category: 'science' },
  { word: "molecule", sentence: "Water is a molecule.", difficulty: 5, syllables: ["mol", "e", "cule"], category: 'science' },
  { word: "nucleus", sentence: "A cell has a nucleus.", difficulty: 5, syllables: ["nu", "cle", "us"], category: 'science' },
  { word: "protein", sentence: "Meat has protein.", difficulty: 4, syllables: ["pro", "tein"], category: 'science' },
  { word: "oxygen", sentence: "We breathe oxygen.", difficulty: 4, syllables: ["ox", "y", "gen"], category: 'science' },
  { word: "carbon", sentence: "Carbon is in plants.", difficulty: 4, syllables: ["car", "bon"], category: 'science' },

  // Animals and classification
  { word: "mammal", sentence: "A dog is a mammal.", difficulty: 4, syllables: ["mam", "mal"], category: 'science' },
  { word: "reptile", sentence: "A snake is a reptile.", difficulty: 4, syllables: ["rep", "tile"], category: 'science' },
  { word: "insect", sentence: "An insect has six legs.", difficulty: 4, syllables: ["in", "sect"], category: 'science' },
  { word: "amphibian", sentence: "A frog is an amphibian.", difficulty: 5, syllables: ["am", "phib", "i", "an"], category: 'science' },
  { word: "species", sentence: "Many species live here.", difficulty: 5, syllables: ["spe", "cies"], category: 'science' },
  { word: "predator", sentence: "A lion is a predator.", difficulty: 5, syllables: ["pred", "a", "tor"], category: 'science' },
  { word: "prey", sentence: "The deer is prey.", difficulty: 3, category: 'science' },
  { word: "habitat", sentence: "A forest is a habitat.", difficulty: 4, syllables: ["hab", "i", "tat"], category: 'science' },
  { word: "dinosaur", sentence: "A dinosaur lived long ago.", difficulty: 5, syllables: ["di", "no", "saur"], category: 'science' },
  { word: "fossil", sentence: "Find a fossil.", difficulty: 4, syllables: ["fos", "sil"], category: 'science' },
  { word: "extinct", sentence: "Dinosaurs are extinct.", difficulty: 4, syllables: ["ex", "tinct"], category: 'science' },

  // Plants
  { word: "tree", sentence: "A tree needs sun.", difficulty: 3, category: 'science' },
  { word: "leaf", sentence: "A green leaf.", difficulty: 3, category: 'science' },
  { word: "seed", sentence: "Plant a seed.", difficulty: 3, category: 'science' },
  { word: "root", sentence: "Roots grow down.", difficulty: 3, category: 'science' },
  { word: "stem", sentence: "The stem holds the flower.", difficulty: 3, category: 'science' },
  { word: "petal", sentence: "A flower has petals.", difficulty: 4, syllables: ["pet", "al"], category: 'science' },
  { word: "pollen", sentence: "Bees carry pollen.", difficulty: 4, syllables: ["pol", "len"], category: 'science' },
  { word: "photosynthesis", sentence: "Plants use photosynthesis.", difficulty: 6, syllables: ["pho", "to", "syn", "the", "sis"], category: 'science' },
  { word: "chlorophyll", sentence: "Chlorophyll makes leaves green.", difficulty: 6, syllables: ["chlo", "ro", "phyll"], category: 'science' },

  // ===== EARTH SCIENCE =====
  // Weather
  { word: "rain", sentence: "Rain falls down.", difficulty: 3, category: 'science' },
  { word: "snow", sentence: "Snow is cold.", difficulty: 3, category: 'science' },
  { word: "wind", sentence: "The wind blows.", difficulty: 3, category: 'science' },
  { word: "cloud", sentence: "A cloud is white.", difficulty: 3, category: 'science' },
  { word: "storm", sentence: "A storm is loud.", difficulty: 3, category: 'science' },
  { word: "thunder", sentence: "Thunder booms.", difficulty: 4, syllables: ["thun", "der"], category: 'science' },
  { word: "lightning", sentence: "Lightning flashes bright.", difficulty: 4, syllables: ["light", "ning"], category: 'science' },
  { word: "tornado", sentence: "A tornado spins fast.", difficulty: 5, syllables: ["tor", "na", "do"], category: 'science' },
  { word: "hurricane", sentence: "A hurricane has strong winds.", difficulty: 5, syllables: ["hur", "ri", "cane"], category: 'science' },
  { word: "weather", sentence: "Check the weather today.", difficulty: 4, syllables: ["weath", "er"], category: 'science' },
  { word: "climate", sentence: "The climate is changing.", difficulty: 4, syllables: ["cli", "mate"], category: 'science' },
  { word: "temperature", sentence: "Check the temperature.", difficulty: 5, syllables: ["tem", "per", "a", "ture"], category: 'science' },
  { word: "evaporation", sentence: "Water rises by evaporation.", difficulty: 6, syllables: ["e", "vap", "o", "ra", "tion"], category: 'science' },
  { word: "precipitation", sentence: "Rain is precipitation.", difficulty: 6, syllables: ["pre", "cip", "i", "ta", "tion"], category: 'science' },

  // Geology and Earth
  { word: "rock", sentence: "A rock is hard.", difficulty: 3, category: 'science' },
  { word: "soil", sentence: "Seeds grow in soil.", difficulty: 3, category: 'science' },
  { word: "sand", sentence: "Sand is on the beach.", difficulty: 3, category: 'science' },
  { word: "dirt", sentence: "Dig in the dirt.", difficulty: 3, category: 'science' },
  { word: "ocean", sentence: "The ocean is deep.", difficulty: 4, syllables: ["o", "cean"], category: 'science' },
  { word: "river", sentence: "A river flows.", difficulty: 4, syllables: ["riv", "er"], category: 'science' },
  { word: "lake", sentence: "The lake is calm.", difficulty: 3, category: 'science' },
  { word: "mountain", sentence: "Climb the mountain.", difficulty: 4, syllables: ["moun", "tain"], category: 'science' },
  { word: "volcano", sentence: "A volcano can erupt.", difficulty: 5, syllables: ["vol", "ca", "no"], category: 'science' },
  { word: "earthquake", sentence: "An earthquake shakes the ground.", difficulty: 4, syllables: ["earth", "quake"], category: 'science' },
  { word: "lava", sentence: "Lava is very hot.", difficulty: 4, syllables: ["la", "va"], category: 'science' },
  { word: "magma", sentence: "Magma is under Earth.", difficulty: 4, syllables: ["mag", "ma"], category: 'science' },
  { word: "crystal", sentence: "A crystal sparkles.", difficulty: 4, syllables: ["crys", "tal"], category: 'science' },
  { word: "mineral", sentence: "A diamond is a mineral.", difficulty: 4, syllables: ["min", "er", "al"], category: 'science' },
  { word: "erosion", sentence: "Erosion wears rocks down.", difficulty: 5, syllables: ["e", "ro", "sion"], category: 'science' },
  { word: "glacier", sentence: "A glacier moves slowly.", difficulty: 5, syllables: ["gla", "cier"], category: 'science' },
  { word: "continent", sentence: "Africa is a continent.", difficulty: 5, syllables: ["con", "ti", "nent"], category: 'science' },
  { word: "tectonic", sentence: "Tectonic plates move.", difficulty: 5, syllables: ["tec", "ton", "ic"], category: 'science' },
  { word: "crust", sentence: "We live on Earth's crust.", difficulty: 3, category: 'science' },
  { word: "mantle", sentence: "The mantle is hot rock.", difficulty: 4, syllables: ["man", "tle"], category: 'science' },
  { word: "core", sentence: "Earth has a hot core.", difficulty: 3, category: 'science' },

  // ===== COLORS & LIGHT =====
  { word: "red", sentence: "Red is a warm color.", difficulty: 3, category: 'science' },
  { word: "blue", sentence: "The sky is blue.", difficulty: 3, category: 'science' },
  { word: "green", sentence: "Grass is green.", difficulty: 3, category: 'science' },
  { word: "yellow", sentence: "The sun looks yellow.", difficulty: 4, syllables: ["yel", "low"], category: 'science' },
  { word: "orange", sentence: "Orange is bright.", difficulty: 4, syllables: ["or", "ange"], category: 'science' },
  { word: "purple", sentence: "Purple is red and blue mixed.", difficulty: 4, syllables: ["pur", "ple"], category: 'science' },
  { word: "rainbow", sentence: "A rainbow has seven colors.", difficulty: 4, syllables: ["rain", "bow"], category: 'science' },
  { word: "spectrum", sentence: "Light has a spectrum.", difficulty: 5, syllables: ["spec", "trum"], category: 'science' },
  { word: "prism", sentence: "A prism splits light.", difficulty: 4, syllables: ["pri", "sm"], category: 'science' },
  { word: "light", sentence: "Light travels fast.", difficulty: 3, category: 'science' },
  { word: "shadow", sentence: "You make a shadow.", difficulty: 4, syllables: ["shad", "ow"], category: 'science' },
  { word: "reflect", sentence: "Mirrors reflect light.", difficulty: 4, syllables: ["re", "flect"], category: 'science' },
  { word: "refract", sentence: "Water refracts light.", difficulty: 5, syllables: ["re", "fract"], category: 'science' },
  { word: "wavelength", sentence: "Colors have wavelengths.", difficulty: 4, syllables: ["wave", "length"], category: 'science' },
  { word: "ultraviolet", sentence: "Sunscreen blocks ultraviolet.", difficulty: 6, syllables: ["ul", "tra", "vi", "o", "let"], category: 'science' },
  { word: "infrared", sentence: "Infrared is invisible.", difficulty: 5, syllables: ["in", "fra", "red"], category: 'science' },

  // ===== COMPUTERS & TECHNOLOGY =====
  // Basic tech words
  { word: "computer", sentence: "A computer can do math.", difficulty: 4, syllables: ["com", "pu", "ter"], category: 'science' },
  { word: "keyboard", sentence: "Type on the keyboard.", difficulty: 4, syllables: ["key", "board"], category: 'science' },
  { word: "mouse", sentence: "Click the mouse.", difficulty: 3, category: 'science' },
  { word: "screen", sentence: "Look at the screen.", difficulty: 3, category: 'science' },
  { word: "tablet", sentence: "Draw on the tablet.", difficulty: 4, syllables: ["tab", "let"], category: 'science' },
  { word: "phone", sentence: "Call on the phone.", difficulty: 3, category: 'science' },
  { word: "laptop", sentence: "Carry your laptop.", difficulty: 4, syllables: ["lap", "top"], category: 'science' },
  { word: "printer", sentence: "The printer prints paper.", difficulty: 4, syllables: ["print", "er"], category: 'science' },
  { word: "speaker", sentence: "Sound comes from the speaker.", difficulty: 4, syllables: ["speak", "er"], category: 'science' },
  { word: "camera", sentence: "Take a picture with the camera.", difficulty: 4, syllables: ["cam", "er", "a"], category: 'science' },

  // Software and internet
  { word: "app", sentence: "Download an app.", difficulty: 3, category: 'science' },
  { word: "game", sentence: "Play a video game.", difficulty: 3, category: 'science' },
  { word: "code", sentence: "Write the code.", difficulty: 3, category: 'science' },
  { word: "program", sentence: "Run the program.", difficulty: 4, syllables: ["pro", "gram"], category: 'science' },
  { word: "website", sentence: "Visit a website.", difficulty: 4, syllables: ["web", "site"], category: 'science' },
  { word: "internet", sentence: "Connect to the internet.", difficulty: 4, syllables: ["in", "ter", "net"], category: 'science' },
  { word: "email", sentence: "Send an email.", difficulty: 4, syllables: ["e", "mail"], category: 'science' },
  { word: "download", sentence: "Download the file.", difficulty: 4, syllables: ["down", "load"], category: 'science' },
  { word: "upload", sentence: "Upload your photo.", difficulty: 4, syllables: ["up", "load"], category: 'science' },
  { word: "password", sentence: "Keep your password secret.", difficulty: 4, syllables: ["pass", "word"], category: 'science' },
  { word: "username", sentence: "Enter your username.", difficulty: 4, syllables: ["user", "name"], category: 'science' },
  { word: "search", sentence: "Search for an answer.", difficulty: 3, category: 'science' },
  { word: "click", sentence: "Click the button.", difficulty: 3, category: 'science' },
  { word: "scroll", sentence: "Scroll down the page.", difficulty: 3, category: 'science' },
  { word: "browser", sentence: "Open the browser.", difficulty: 4, syllables: ["brows", "er"], category: 'science' },

  // Hardware and components
  { word: "chip", sentence: "A chip is in the computer.", difficulty: 3, category: 'science' },
  { word: "battery", sentence: "Charge the battery.", difficulty: 4, syllables: ["bat", "ter", "y"], category: 'science' },
  { word: "charger", sentence: "Plug in the charger.", difficulty: 4, syllables: ["char", "ger"], category: 'science' },
  { word: "cable", sentence: "Connect the cable.", difficulty: 4, syllables: ["ca", "ble"], category: 'science' },
  { word: "robot", sentence: "A robot can help.", difficulty: 4, syllables: ["ro", "bot"], category: 'science' },
  { word: "sensor", sentence: "The sensor detects motion.", difficulty: 4, syllables: ["sen", "sor"], category: 'science' },
  { word: "digital", sentence: "A digital clock is exact.", difficulty: 4, syllables: ["dig", "i", "tal"], category: 'science' },
  { word: "data", sentence: "Save your data.", difficulty: 4, syllables: ["da", "ta"], category: 'science' },
  { word: "server", sentence: "Data is on the server.", difficulty: 4, syllables: ["serv", "er"], category: 'science' },
  { word: "pixel", sentence: "A pixel is tiny.", difficulty: 4, syllables: ["pix", "el"], category: 'science' },

  // ===== GENERAL SCIENCE =====
  { word: "magnet", sentence: "A magnet attracts metal.", difficulty: 4, syllables: ["mag", "net"], category: 'science' },
  { word: "energy", sentence: "The sun gives energy.", difficulty: 4, syllables: ["en", "er", "gy"], category: 'science' },
  { word: "experiment", sentence: "Do a science experiment.", difficulty: 5, syllables: ["ex", "per", "i", "ment"], category: 'science' },
  { word: "scientist", sentence: "A scientist studies nature.", difficulty: 5, syllables: ["sci", "en", "tist"], category: 'science' },
  { word: "laboratory", sentence: "Work in a laboratory.", difficulty: 5, syllables: ["lab", "o", "ra", "tor", "y"], category: 'science' },
  { word: "microscope", sentence: "Look through a microscope.", difficulty: 5, syllables: ["mi", "cro", "scope"], category: 'science' },
  { word: "ecosystem", sentence: "A forest is an ecosystem.", difficulty: 6, syllables: ["e", "co", "sys", "tem"], category: 'science' },
  { word: "electricity", sentence: "Lights need electricity.", difficulty: 6, syllables: ["e", "lec", "tric", "i", "ty"], category: 'science' },
  { word: "hibernation", sentence: "Bears go into hibernation.", difficulty: 6, syllables: ["hi", "ber", "na", "tion"], category: 'science' },
  { word: "metamorphosis", sentence: "A caterpillar goes through metamorphosis.", difficulty: 6, syllables: ["met", "a", "mor", "pho", "sis"], category: 'science' },
  { word: "hypothesis", sentence: "Test your hypothesis.", difficulty: 6, syllables: ["hy", "poth", "e", "sis"], category: 'science' },
  { word: "theory", sentence: "A theory explains things.", difficulty: 5, syllables: ["the", "o", "ry"], category: 'science' },
  { word: "element", sentence: "Gold is an element.", difficulty: 4, syllables: ["el", "e", "ment"], category: 'science' },
  { word: "atom", sentence: "An atom is very small.", difficulty: 4, syllables: ["at", "om"], category: 'science' },
  { word: "chemical", sentence: "A chemical reaction.", difficulty: 4, syllables: ["chem", "i", "cal"], category: 'science' },
  { word: "formula", sentence: "Water's formula is H2O.", difficulty: 5, syllables: ["for", "mu", "la"], category: 'science' },
  { word: "reaction", sentence: "Watch the reaction.", difficulty: 4, syllables: ["re", "ac", "tion"], category: 'science' },
  { word: "solution", sentence: "Mix the solution.", difficulty: 4, syllables: ["so", "lu", "tion"], category: 'science' },
  { word: "solid", sentence: "Ice is solid.", difficulty: 4, syllables: ["sol", "id"], category: 'science' },
  { word: "liquid", sentence: "Water is a liquid.", difficulty: 4, syllables: ["liq", "uid"], category: 'science' },
  { word: "gas", sentence: "Air is a gas.", difficulty: 3, category: 'science' },
  { word: "matter", sentence: "Everything is matter.", difficulty: 4, syllables: ["mat", "ter"], category: 'science' },
  { word: "force", sentence: "Push with force.", difficulty: 3, category: 'science' },
  { word: "motion", sentence: "Motion is movement.", difficulty: 4, syllables: ["mo", "tion"], category: 'science' },
  { word: "friction", sentence: "Friction slows things down.", difficulty: 4, syllables: ["fric", "tion"], category: 'science' },
  { word: "velocity", sentence: "Measure the velocity.", difficulty: 5, syllables: ["ve", "loc", "i", "ty"], category: 'science' },
  { word: "pressure", sentence: "Feel the pressure.", difficulty: 4, syllables: ["pres", "sure"], category: 'science' },
  { word: "volume", sentence: "Measure the volume.", difficulty: 4, syllables: ["vol", "ume"], category: 'science' },
  { word: "density", sentence: "Oil has low density.", difficulty: 5, syllables: ["den", "si", "ty"], category: 'science' },
  { word: "mass", sentence: "Mass is how much matter.", difficulty: 3, category: 'science' },
  { word: "weight", sentence: "Check your weight.", difficulty: 3, category: 'science' },
];

// Combine all words
export const allReadingWords: ReadingWord[] = [
  ...cvcWords,
  ...dolchPrePrimerWords,
  ...dolchFirstGradeWords,
  ...dolchSecondGradeWords,
  ...advancedWords,
  ...usStatesWords,
  ...minecraftWords,
  ...scienceSpaceWords,
];

// Get words for a specific level
export function getWordsForLevel(level: ReadingLevelConfig): ReadingWord[] {
  // If level has categories, filter by category
  if (level.wordCategories && level.wordCategories.length > 0) {
    return allReadingWords.filter(word =>
      word.category && level.wordCategories!.includes(word.category)
    );
  }
  // Otherwise filter by difficulty
  if (level.wordDifficulties && level.wordDifficulties.length > 0) {
    return allReadingWords.filter(word =>
      level.wordDifficulties!.includes(word.difficulty)
    );
  }
  return allReadingWords;
}

// Get a random word for the level
export function getRandomWord(level: ReadingLevelConfig, excludeWord?: string): ReadingWord {
  const words = getWordsForLevel(level);
  const filtered = excludeWord
    ? words.filter(w => w.word !== excludeWord)
    : words;
  return filtered[Math.floor(Math.random() * filtered.length)];
}

// Reading-specific config
export const readingConfig = {
  // Timer settings (same as math for consistency)
  timerDuration: 10 * 60, // 10 minutes in seconds
  warningThreshold: 60, // seconds remaining to show warning

  // Skip and hear settings
  skipPenalty: 0, // No penalty for skipping - learning is the goal
  hearWordDelay: 500, // Milliseconds before word is spoken
  repeatOnSkip: 2, // How many times to repeat word when skipped

  // Voice settings
  voiceEnabled: true,
  speechRate: 0.75, // Slower for children - clearer pronunciation
  speechPitch: 1.05, // Slightly higher pitch - more friendly/clear

  // UI settings
  showSentence: true,
  highlightWordInSentence: true,
};

export default readingConfig;
