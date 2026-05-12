import { createDungeonState, getCell, inBounds } from "./dungeon-state.js";
import { STANDARD_GEOMORPH_LIBRARY } from "./standard-geomorph-library.js";

const DIRS = [
  { name: "north", dx: 0, dy: -1, opposite: "south" },
  { name: "east", dx: 1, dy: 0, opposite: "west" },
  { name: "south", dx: 0, dy: 1, opposite: "north" },
  { name: "west", dx: -1, dy: 0, opposite: "east" },
];

const DIR_BY_NAME = Object.fromEntries(DIRS.map((dir) => [dir.name, dir]));
const SECRET_DOOR_CHANCE = 0.08;
const OPEN_DOOR_CHANCE = 0.15;
const LOCKED_ROOM_CHANCE = 0.1;
const GEOMORPH_SOCKET_OFFSETS = {
  10: [2, 7],
  20: [2, 7, 12, 17],
};
const MAX_FLOORS = 10;
const FLOOR_CHANCE = {
  small: { start: 0.1, decay: 0.03, min: 1 },
  medium: { start: 0.2, decay: 0.03, min: 1 },
  large: { start: 0.3, decay: 0.02, min: 1 },
  super: { start: 0.4, decay: 0.02, min: 2 },
};

const SUPER_LATTICE = Object.freeze({
  origin: 1,
  districtsPerSide: 4,
  districtSize: 40,
  connectorSize: 10,
  blockSize: 10,
  connectorIndexes: [4, 9, 14],
  unitsPerSide: 19,
});

const DUNGEON_TYPES = {
  lost_civilization: {
    label: "Lost Civilization",
    districtTypes: ["old_halls", "noble_quarters", "library_archives", "shrine", "armory", "storage", "cavern_edge"],
    roomScale: 0.78,
    loopRate: 0.12,
    districtGutter: 5,
    transitionRate: 0.35,
    sameNeighborChance: 0.45,
  },
  ruined_stronghold: {
    label: "Ruined Stronghold",
    districtTypes: ["guard_post", "barracks", "armory", "storage", "noble_quarters", "ruined_halls", "cavern_edge"],
    roomScale: 0.82,
    loopRate: 0.14,
    districtGutter: 4,
    transitionRate: 0.3,
    sameNeighborChance: 0.5,
  },
  demonic_temple: {
    label: "Demonic Temple",
    districtTypes: ["occult_sanctum", "summoning_halls", "shrine", "sealed_vaults", "cavern_edge"],
    roomScale: 0.7,
    loopRate: 0.1,
    districtGutter: 6,
    transitionRate: 0.45,
    sameNeighborChance: 0.38,
  },
  necromancer_lair: {
    label: "Necromancer Lair",
    districtTypes: ["tombs", "ossuary", "occult_sanctum", "library_archives", "sealed_vaults", "cavern_edge"],
    roomScale: 0.74,
    loopRate: 0.1,
    districtGutter: 5,
    transitionRate: 0.4,
    sameNeighborChance: 0.42,
  },
  deathtrap_dungeon: {
    label: "Deathtrap Dungeon",
    districtTypes: ["sealed_vaults", "guard_post", "armory", "old_halls", "ruined_halls"],
    roomScale: 0.62,
    loopRate: 0.08,
    districtGutter: 6,
    transitionRate: 0.55,
    sameNeighborChance: 0.3,
  },
  flooded_underworks: {
    label: "Flooded Underworks",
    districtTypes: ["flooded_halls", "cistern", "storage", "old_halls", "cavern_edge"],
    roomScale: 0.72,
    loopRate: 0.16,
    districtGutter: 5,
    transitionRate: 0.4,
    sameNeighborChance: 0.5,
  },
};

function themeProfile(label, districtTypes, objectPalette, encounterFilters, dressingTables, geomorphFamilies = []) {
  return {
    label,
    districtTypes,
    objectPalette,
    encounterFilters,
    dressingTables,
    geomorphFamilies,
  };
}

const DUNGEON_THEMES = {
  standard_dungeon: themeProfile("Classic Fantasy", ["old_halls", "guard_post", "shrine", "storage", "armory", "library_archives", "noble_quarters", "cavern_edge"], ["stone_walls", "wooden_doors", "pillars", "pits", "stairs"], ["dungeon", "any"], ["standard_room", "standard_corridor"], ["generic", "crossroads", "side_rooms"]),
  ancient: themeProfile("Ancient", ["old_halls", "library_archives", "shrine", "sealed_vaults", "cavern_edge"], ["stone_walls", "pillars", "statues", "runes", "stairs"], ["construct", "undead", "dungeon"], ["standard_room", "standard_corridor"], ["formal", "relics", "ruined"]),
  corrupted: themeProfile("Corrupted", ["occult_sanctum", "summoning_halls", "ruined_halls", "cavern_edge"], ["stone_walls", "black_patch_pits", "mist", "occult_events", "rubble"], ["occult", "demon", "ooze"], ["horror_room", "occult_corridor"], ["warped", "hazard", "ritual"]),
  fortified: themeProfile("Fortified", ["guard_post", "barracks", "armory", "storage", "sealed_vaults"], ["stone_walls", "wooden_doors", "gates", "crates", "stairs"], ["humanoid", "construct", "beast"], ["standard_room", "standard_corridor"], ["military", "checkpoint", "gates"]),
  hallowed: themeProfile("Hallowed", ["shrine", "old_halls", "sealed_vaults", "library_archives"], ["stone_walls", "pillars", "altars", "statues", "stairs"], ["spirit", "construct", "cult"], ["standard_room", "standard_corridor"], ["temple", "processional", "reliquary"]),
  haunted: themeProfile("Haunted", ["tombs", "noble_quarters", "old_halls", "library_archives"], ["stone_walls", "mist", "sealed_doors", "pillars", "stairs"], ["spirit", "undead", "occult"], ["horror_room", "horror_corridor"], ["haunted", "secret", "decayed"]),
  infested: themeProfile("Infested", ["cavern_edge", "storage", "ruined_halls", "flooded_halls"], ["stone_walls", "nests", "webs", "rubble", "pits"], ["vermin", "beast", "ooze"], ["horror_room", "cavern_passage"], ["nests", "side_chambers", "blocked"]),
  ravaged: themeProfile("Ravaged", ["ruined_halls", "guard_post", "storage", "cavern_edge"], ["stone_walls", "rubble", "pits", "broken_doors", "stairs"], ["beast", "humanoid", "undead"], ["ruin_room", "ruin_corridor"], ["collapsed", "breached", "scarred"]),
  wild: themeProfile("Wild", ["cavern_edge", "ruined_halls", "shrine", "flooded_halls"], ["stone_walls", "plants", "rubble", "water_hazards", "pits"], ["beast", "fae", "vermin"], ["mist_room", "cavern_passage"], ["overgrown", "natural", "broken"]),
  barrow: themeProfile("Barrow", ["tombs", "ossuary", "shrine", "sealed_vaults"], ["stone_walls", "sealed_doors", "sarcophagi", "pillars", "stairs"], ["undead", "vermin", "cult"], ["crypt_room", "crypt_corridor"], ["tombs", "alcoves", "sealed"]),
  cavern: themeProfile("Cavern", ["cavern_edge", "flooded_halls", "storage", "ruined_halls"], ["stone_walls", "pits", "water_hazards", "rubble", "black_patch_pits"], ["beast", "vermin", "ooze"], ["ruin_room", "cavern_passage"], ["natural", "irregular", "pockets"]),
  frozen_cavern: themeProfile("Frozen Cavern", ["cavern_edge", "flooded_halls", "sealed_vaults"], ["stone_walls", "ice", "pits", "sealed_doors", "stairs"], ["beast", "undead", "construct"], ["standard_room", "cavern_passage"], ["frozen", "cavern", "blocked"]),
  icereach: themeProfile("Icereach", ["old_halls", "cavern_edge", "sealed_vaults", "shrine"], ["stone_walls", "ice", "pillars", "sealed_doors", "stairs"], ["beast", "spirit", "undead"], ["standard_room", "standard_corridor"], ["frozen", "ancient", "windcut"]),
  mine: themeProfile("Mine", ["cavern_edge", "storage", "armory", "ruined_halls"], ["stone_walls", "rails", "rubble", "pits", "crates"], ["beast", "vermin", "humanoid"], ["ruin_room", "cavern_passage"], ["worksite", "branches", "shafts"]),
  pass: themeProfile("Pass", ["cavern_edge", "guard_post", "ruined_halls", "storage"], ["stone_walls", "gates", "rubble", "pits", "stairs"], ["humanoid", "beast", "vermin"], ["ruin_room", "cavern_passage"], ["linear", "checkpoint", "choke"]),
  ruin: themeProfile("Ruin", ["ruined_halls", "old_halls", "storage", "cavern_edge"], ["stone_walls", "rubble", "wooden_doors", "pillars", "stairs"], ["humanoid", "beast", "undead"], ["ruin_room", "ruin_corridor"], ["collapsed", "overgrown", "broken"]),
  sea_cave: themeProfile("Sea Cave", ["flooded_halls", "cavern_edge", "storage", "ruined_halls"], ["stone_walls", "water_hazards", "pools", "rubble", "stairs"], ["aquatic", "ooze", "beast"], ["flooded_room", "flooded_corridor"], ["tide", "cavern", "docks"]),
  shadowfen: themeProfile("Shadowfen", ["flooded_halls", "cavern_edge", "ruined_halls", "shrine"], ["stone_walls", "mist", "water_hazards", "plants", "black_patch_pits"], ["spirit", "ooze", "beast"], ["mist_room", "mist_corridor"], ["swamp", "haunted", "sunken"]),
  stronghold: themeProfile("Stronghold", ["guard_post", "barracks", "armory", "storage", "noble_quarters"], ["stone_walls", "wooden_doors", "gates", "pillars", "stairs"], ["humanoid", "construct", "beast"], ["standard_room", "standard_corridor"], ["military", "living", "vaults"]),
  tanglewood: themeProfile("Tanglewood", ["cavern_edge", "ruined_halls", "shrine", "old_halls"], ["stone_walls", "plants", "webs", "mist", "rubble"], ["fae", "beast", "vermin"], ["mist_room", "cavern_passage"], ["overgrown", "groves", "ruins"]),
  underkeep: themeProfile("Underkeep", ["guard_post", "barracks", "storage", "sealed_vaults", "old_halls"], ["stone_walls", "wooden_doors", "gates", "stairs", "crates"], ["humanoid", "undead", "vermin"], ["standard_room", "standard_corridor"], ["fortified", "basement", "service"]),
  crypt: themeProfile("Crypt", ["tombs", "ossuary", "shrine", "sealed_vaults", "cavern_edge"], ["stone_walls", "pillars", "pits", "stairs", "sealed_doors"], ["undead", "cult", "vermin"], ["crypt_room", "crypt_corridor"], ["tombs", "alcoves", "sealed"]),
  ruined_stronghold: themeProfile("Ruined Stronghold", ["guard_post", "barracks", "armory", "storage", "noble_quarters", "ruined_halls", "cavern_edge"], ["stone_walls", "wooden_doors", "wall_fixes", "pillars", "rubble"], ["humanoid", "beast", "vermin"], ["ruin_room", "ruin_corridor"], ["military", "ruined", "guarded"]),
  borderland_ruin: themeProfile("Borderland Ruin", ["ruined_halls", "guard_post", "storage", "cavern_edge", "old_halls"], ["stone_walls", "wooden_doors", "wall_fixes", "rubble", "stairs"], ["humanoid", "beast", "vermin"], ["ruin_room", "ruin_corridor"], ["ruins", "collapsed", "guarded"]),
  old_empire: themeProfile("Old Empire", ["old_halls", "noble_quarters", "library_archives", "shrine", "storage"], ["stone_walls", "pillars", "stairs", "statues", "mosaic"], ["dungeon", "construct", "cult"], ["standard_room", "standard_corridor"], ["formal", "processional", "archives"]),
  lost_civilization: themeProfile("Lost Civilization", ["old_halls", "noble_quarters", "library_archives", "shrine", "cavern_edge"], ["stone_walls", "pillars", "stairs", "rubble", "relics"], ["construct", "undead", "beast"], ["ruin_room", "standard_corridor"], ["formal", "ruined", "set_piece"]),
  barrow_crypt: themeProfile("Barrow Crypt", ["tombs", "ossuary", "shrine", "sealed_vaults"], ["stone_walls", "pillars", "sealed_doors", "stairs", "sarcophagi"], ["undead", "vermin", "cult"], ["crypt_room", "crypt_corridor"], ["tombs", "alcoves", "sealed"]),
  royal_tombs: themeProfile("Royal Tombs", ["tombs", "sealed_vaults", "shrine", "ossuary", "noble_quarters"], ["stone_walls", "sealed_doors", "pillars", "treasure", "statues"], ["undead", "construct", "cult"], ["crypt_room", "crypt_corridor"], ["vaults", "processional", "guardians"]),
  ossuary_depths: themeProfile("Ossuary Depths", ["ossuary", "tombs", "sealed_vaults", "cavern_edge"], ["stone_walls", "sealed_doors", "pits", "stairs", "bone_piles"], ["undead", "ooze", "vermin"], ["crypt_room", "crypt_corridor"], ["dense_cells", "niches", "dead_ends"]),
  plague_catacombs: themeProfile("Plague Catacombs", ["tombs", "ossuary", "flooded_halls", "cavern_edge"], ["stone_walls", "sealed_doors", "mist", "pits", "rubble"], ["undead", "ooze", "vermin"], ["horror_room", "crypt_corridor"], ["tight", "contaminated", "blocked"]),
  undead_stronghold: themeProfile("Undead Stronghold", ["tombs", "ossuary", "sealed_vaults", "guard_post", "shrine"], ["stone_walls", "pillars", "pits", "stairs", "sealed_doors"], ["undead", "cult", "vermin"], ["crypt_room", "crypt_corridor"], ["guarded", "crypt", "barracks"]),
  haunted_manor_undercrypt: themeProfile("Haunted Manor Undercrypt", ["noble_quarters", "tombs", "library_archives", "occult_sanctum"], ["stone_walls", "wooden_doors", "mist", "sealed_doors", "stairs"], ["spirit", "undead", "occult"], ["horror_room", "horror_corridor"], ["suite", "secret", "undercrypt"]),
  demonic_outpost: themeProfile("Demonic Outpost", ["occult_sanctum", "summoning_halls", "sealed_vaults", "shrine", "cavern_edge"], ["stone_walls", "black_patch_pits", "pillars", "occult_events", "stairs"], ["demon", "cult", "occult"], ["occult_room", "occult_corridor"], ["ritual", "gatehouse", "hazard"]),
  infernal_temple: themeProfile("Infernal Temple", ["summoning_halls", "shrine", "occult_sanctum", "sealed_vaults"], ["stone_walls", "black_patch_pits", "pillars", "altars", "fire"], ["demon", "cult", "construct"], ["occult_room", "occult_corridor"], ["axis", "altar", "sacrifice"]),
  cult_hideout: themeProfile("Cult Hideout", ["occult_sanctum", "living_quarters", "storage", "shrine"], ["stone_walls", "wooden_doors", "hidden_doors", "altars", "crates"], ["cult", "humanoid", "occult"], ["occult_room", "standard_corridor"], ["secret", "living", "ritual"]),
  cult: themeProfile("Cult", ["occult_sanctum", "shrine", "living_quarters", "sealed_vaults"], ["stone_walls", "wooden_doors", "altars", "hidden_doors", "occult_events"], ["cult", "occult", "demon"], ["occult_room", "occult_corridor"], ["ritual", "secret", "cells"]),
  occult_depths: themeProfile("Occult Depths", ["occult_sanctum", "summoning_halls", "sealed_vaults", "library_archives", "shrine", "cavern_edge"], ["stone_walls", "black_patch_pits", "pillars", "occult_events", "stairs"], ["occult", "demon", "undead"], ["occult_room", "occult_corridor"], ["ritual", "secret", "hazard"]),
  forbidden_library: themeProfile("Forbidden Library", ["library_archives", "occult_sanctum", "sealed_vaults", "old_halls"], ["stone_walls", "wooden_doors", "bookshelves", "sealed_doors", "stairs"], ["construct", "occult", "undead"], ["occult_room", "standard_corridor"], ["archives", "stacks", "secret"]),
  wizard_school_ruin: themeProfile("Wizard School Ruin", ["library_archives", "occult_sanctum", "summoning_halls", "noble_quarters"], ["stone_walls", "pillars", "occult_events", "rubble", "stairs"], ["construct", "occult", "ooze"], ["ruin_room", "occult_corridor"], ["classrooms", "labs", "broken_magic"]),
  alchemical_works: themeProfile("Alchemical Works", ["occult_sanctum", "storage", "library_archives", "flooded_halls"], ["stone_walls", "wooden_doors", "vats", "pipes", "pits"], ["ooze", "construct", "humanoid"], ["occult_room", "standard_corridor"], ["laboratory", "vats", "service"]),
  necromancer_lair: themeProfile("Necromancer Lair", ["tombs", "ossuary", "occult_sanctum", "library_archives", "sealed_vaults"], ["stone_walls", "sealed_doors", "pillars", "occult_events", "bone_piles"], ["undead", "cult", "occult"], ["horror_room", "crypt_corridor"], ["laboratory", "crypt", "summoning"]),
  deathtrap_dungeon: themeProfile("Deathtrap Dungeon", ["sealed_vaults", "guard_post", "armory", "old_halls", "ruined_halls"], ["stone_walls", "pits", "sealed_doors", "pressure_plates", "stairs"], ["construct", "vermin", "dungeon"], ["standard_room", "standard_corridor"], ["traps", "maze", "gauntlet"]),
  death_trap: themeProfile("Death Trap", ["sealed_vaults", "guard_post", "armory", "old_halls", "ruined_halls"], ["stone_walls", "pits", "sealed_doors", "pressure_plates", "stairs"], ["construct", "vermin", "dungeon"], ["standard_room", "standard_corridor"], ["traps", "maze", "gauntlet"]),
  puzzle_vault: themeProfile("Puzzle Vault", ["sealed_vaults", "library_archives", "old_halls", "shrine"], ["stone_walls", "sealed_doors", "pillars", "statues", "runes"], ["construct", "dungeon", "occult"], ["standard_room", "standard_corridor"], ["logic_rooms", "keys", "loops"]),
  treasure_vaults: themeProfile("Treasure Vaults", ["sealed_vaults", "storage", "guard_post", "armory"], ["stone_walls", "sealed_doors", "treasure", "pillars", "traps"], ["construct", "humanoid", "vermin"], ["vault_room", "standard_corridor"], ["vaults", "locked", "guarded"]),
  dwarven_hold: themeProfile("Dwarven Hold", ["armory", "storage", "barracks", "old_halls", "flooded_halls"], ["stone_walls", "pillars", "forges", "stairs", "wall_fixes"], ["humanoid", "construct", "vermin"], ["standard_room", "standard_corridor"], ["ordered", "workshops", "halls"]),
  mine_works: themeProfile("Mine Works", ["cavern_edge", "storage", "armory", "ruined_halls"], ["stone_walls", "wooden_doors", "rubble", "pits", "rails"], ["beast", "vermin", "humanoid"], ["ruin_room", "cavern_passage"], ["cavern", "worksite", "branches"]),
  forge_complex: themeProfile("Forge Complex", ["armory", "storage", "old_halls", "flooded_halls"], ["stone_walls", "forges", "pipes", "crates", "stairs"], ["construct", "humanoid", "ooze"], ["standard_room", "standard_corridor"], ["forge", "service", "vaults"]),
  sewer_underworks: themeProfile("Sewer Underworks", ["flooded_halls", "cistern", "storage", "cavern_edge"], ["stone_walls", "water_hazards", "pipes", "grates", "stairs"], ["ooze", "vermin", "aquatic"], ["flooded_room", "flooded_corridor"], ["channels", "bridges", "cistern"]),
  flooded_halls: themeProfile("Flooded Halls", ["flooded_halls", "cistern", "old_halls", "cavern_edge", "storage"], ["stone_walls", "pits", "stairs", "water_hazards", "alcoves"], ["aquatic", "ooze", "vermin"], ["flooded_room", "flooded_corridor"], ["water", "ruin", "crossings"]),
  sunken_temple: themeProfile("Sunken Temple", ["flooded_halls", "shrine", "cavern_edge", "sealed_vaults"], ["stone_walls", "water_hazards", "pillars", "altars", "stairs"], ["aquatic", "cult", "undead"], ["flooded_room", "flooded_corridor"], ["temple", "pools", "processional"]),
  temple: themeProfile("Temple", ["shrine", "old_halls", "sealed_vaults", "library_archives"], ["stone_walls", "pillars", "altars", "statues", "stairs"], ["cult", "construct", "undead"], ["standard_room", "standard_corridor"], ["processional", "chapels", "reliquary"]),
  cavern_breach: themeProfile("Cavern Breach", ["cavern_edge", "ruined_halls", "flooded_halls", "storage"], ["stone_walls", "rubble", "pits", "black_patch_pits", "water_hazards"], ["beast", "vermin", "ooze"], ["ruin_room", "cavern_passage"], ["natural", "transition", "rough"]),
  fungal_caverns: themeProfile("Fungal Caverns", ["cavern_edge", "flooded_halls", "storage", "ruined_halls"], ["stone_walls", "fungus", "mist", "water_hazards", "pits"], ["beast", "ooze", "vermin"], ["mist_room", "cavern_passage"], ["organic", "groves", "hazards"]),
  crystal_grotto: themeProfile("Crystal Grotto", ["cavern_edge", "sealed_vaults", "shrine", "old_halls"], ["stone_walls", "crystals", "pits", "water_hazards", "stairs"], ["construct", "beast", "occult"], ["standard_room", "cavern_passage"], ["cavern", "vaults", "radiant"]),
  volcanic_depths: themeProfile("Volcanic Depths", ["cavern_edge", "old_halls", "summoning_halls", "forge_complex"], ["stone_walls", "fire", "pits", "black_patch_pits", "forges"], ["demon", "beast", "construct"], ["occult_room", "cavern_passage"], ["lava", "bridges", "hazard"]),
  icebound_halls: themeProfile("Icebound Halls", ["old_halls", "cavern_edge", "sealed_vaults", "storage"], ["stone_walls", "ice", "sealed_doors", "pits", "stairs"], ["beast", "undead", "construct"], ["standard_room", "standard_corridor"], ["frozen", "blocked", "vaults"]),
  elemental: themeProfile("Elemental", ["cavern_edge", "shrine", "summoning_halls", "sealed_vaults"], ["stone_walls", "pits", "water_hazards", "fire", "crystals"], ["elemental", "construct", "occult"], ["occult_room", "cavern_passage"], ["node", "hazard", "ritual"]),
  mist_filled: themeProfile("Mist Filled", ["cavern_edge", "flooded_halls", "old_halls", "shrine"], ["stone_walls", "mist", "pits", "stairs", "alcoves"], ["spirit", "fae", "undead", "beast"], ["mist_room", "mist_corridor"], ["obscured", "loops", "haunted"]),
  fae_crossing: themeProfile("Fae Crossing", ["cavern_edge", "shrine", "noble_quarters", "library_archives"], ["stone_walls", "mist", "pools", "pillars", "plants"], ["fae", "beast", "spirit"], ["mist_room", "standard_corridor"], ["strange", "gardens", "mirrors"]),
  shadow_maze: themeProfile("Shadow Maze", ["occult_sanctum", "sealed_vaults", "old_halls", "cavern_edge"], ["stone_walls", "black_patch_pits", "hidden_doors", "mist", "stairs"], ["spirit", "occult", "undead"], ["horror_room", "horror_corridor"], ["maze", "secret", "loops"]),
  prison_warren: themeProfile("Prison Warren", ["guard_post", "barracks", "storage", "old_halls"], ["stone_walls", "wooden_doors", "cells", "locked_doors", "stairs"], ["humanoid", "undead", "vermin"], ["standard_room", "standard_corridor"], ["cells", "guarded", "linear"]),
  beast_pens: themeProfile("Beast Pens", ["guard_post", "storage", "cavern_edge", "flooded_halls"], ["stone_walls", "wooden_doors", "pens", "pits", "rubble"], ["beast", "humanoid", "vermin"], ["ruin_room", "standard_corridor"], ["pens", "wide_halls", "gates"]),
  arena_complex: themeProfile("Arena Complex", ["guard_post", "barracks", "armory", "old_halls"], ["stone_walls", "pillars", "pits", "gates", "stairs"], ["humanoid", "beast", "construct"], ["standard_room", "standard_corridor"], ["arena", "holding", "spectator"]),
  thieves_den: themeProfile("Thieves' Den", ["storage", "living_quarters", "guard_post", "sealed_vaults"], ["stone_walls", "wooden_doors", "hidden_doors", "crates", "stairs"], ["humanoid", "vermin", "beast"], ["standard_room", "standard_corridor"], ["secret", "storage", "living"]),
  bandit: themeProfile("Bandit", ["guard_post", "living_quarters", "storage", "cavern_edge"], ["stone_walls", "wooden_doors", "crates", "hidden_doors", "stairs"], ["humanoid", "beast", "vermin"], ["standard_room", "standard_corridor"], ["hideout", "loot", "guarded"]),
  market_undercity: themeProfile("Market Undercity", ["storage", "living_quarters", "old_halls", "flooded_halls"], ["stone_walls", "wooden_doors", "stalls", "crates", "stairs"], ["humanoid", "vermin", "ooze"], ["standard_room", "standard_corridor"], ["market", "service", "alleys"]),
  noble_villa_ruins: themeProfile("Noble Villa Ruins", ["noble_quarters", "living_quarters", "library_archives", "ruined_halls"], ["stone_walls", "wooden_doors", "pillars", "rubble", "pools"], ["undead", "beast", "humanoid"], ["ruin_room", "ruin_corridor"], ["suite", "courtyard", "bath"]),
  warlord_bunker: themeProfile("Warlord Bunker", ["guard_post", "barracks", "armory", "storage", "sealed_vaults"], ["stone_walls", "wooden_doors", "gates", "crates", "stairs"], ["humanoid", "beast", "construct"], ["standard_room", "standard_corridor"], ["military", "checkpoint", "armory"]),
  monster_hive: themeProfile("Monster Hive", ["cavern_edge", "storage", "ruined_halls", "flooded_halls"], ["stone_walls", "rubble", "pits", "webs", "nests"], ["beast", "vermin", "ooze"], ["horror_room", "cavern_passage"], ["organic", "nests", "side_chambers"]),
  planar_embassy: themeProfile("Planar Embassy", ["noble_quarters", "shrine", "occult_sanctum", "sealed_vaults"], ["stone_walls", "pillars", "portals", "statues", "stairs"], ["outsider", "construct", "occult"], ["occult_room", "standard_corridor"], ["formal", "portals", "suites"]),
  planar: themeProfile("Planar", ["occult_sanctum", "shrine", "sealed_vaults", "cavern_edge"], ["stone_walls", "portals", "pillars", "runes", "black_patch_pits"], ["outsider", "elemental", "occult"], ["occult_room", "occult_corridor"], ["portals", "warped", "threshold"]),
  underworld_port: themeProfile("Underworld Port", ["flooded_halls", "storage", "market_undercity", "guard_post"], ["stone_walls", "water_hazards", "crates", "docks", "stairs"], ["aquatic", "humanoid", "ooze"], ["flooded_room", "flooded_corridor"], ["docks", "warehouses", "channels"]),
  time_lost_sanctum: themeProfile("Time-Lost Sanctum", ["old_halls", "library_archives", "shrine", "sealed_vaults"], ["stone_walls", "pillars", "runes", "statues", "stairs"], ["construct", "spirit", "occult"], ["standard_room", "standard_corridor"], ["formal", "puzzle", "relics"]),
  dragon: themeProfile("Dragon", ["cavern_edge", "sealed_vaults", "storage", "old_halls"], ["stone_walls", "treasure", "pits", "rubble", "stairs"], ["dragon", "beast", "humanoid"], ["standard_room", "cavern_passage"], ["lair", "vaults", "hoard"]),
  death: themeProfile("Death", ["tombs", "ossuary", "sealed_vaults", "occult_sanctum"], ["stone_walls", "sealed_doors", "bone_piles", "black_patch_pits", "stairs"], ["undead", "spirit", "occult"], ["horror_room", "crypt_corridor"], ["funerary", "occult", "sealed"]),
  lizard: themeProfile("Lizard", ["flooded_halls", "cavern_edge", "guard_post", "storage"], ["stone_walls", "water_hazards", "pools", "crates", "stairs"], ["reptile", "aquatic", "humanoid"], ["flooded_room", "cavern_passage"], ["wet", "tribal", "cavern"]),
  orc: themeProfile("Orc", ["guard_post", "barracks", "armory", "storage", "cavern_edge"], ["stone_walls", "wooden_doors", "gates", "crates", "rubble"], ["humanoid", "beast", "vermin"], ["standard_room", "standard_corridor"], ["warlike", "barracks", "pens"]),
  goblin: themeProfile("Goblin", ["cavern_edge", "storage", "guard_post", "ruined_halls"], ["stone_walls", "wooden_doors", "crates", "pits", "rubble"], ["humanoid", "vermin", "beast"], ["ruin_room", "cavern_passage"], ["warren", "traps", "messy"]),
  alien: themeProfile("Alien", ["occult_sanctum", "cavern_edge", "sealed_vaults", "library_archives"], ["stone_walls", "crystals", "black_patch_pits", "runes", "portals"], ["outsider", "ooze", "construct"], ["occult_room", "cavern_passage"], ["strange", "symmetry", "hazard"]),
  terror: themeProfile("Terror", ["tombs", "occult_sanctum", "cavern_edge", "ruined_halls"], ["stone_walls", "mist", "black_patch_pits", "webs", "sealed_doors"], ["spirit", "undead", "beast"], ["horror_room", "horror_corridor"], ["horror", "ambush", "tight"]),
  sun: themeProfile("Sun", ["shrine", "old_halls", "sealed_vaults", "noble_quarters"], ["stone_walls", "pillars", "altars", "statues", "mosaic"], ["cult", "construct", "spirit"], ["standard_room", "standard_corridor"], ["solar", "processional", "radiant"]),
  moon: themeProfile("Moon", ["shrine", "occult_sanctum", "flooded_halls", "library_archives"], ["stone_walls", "mist", "pools", "runes", "pillars"], ["spirit", "fae", "occult"], ["mist_room", "standard_corridor"], ["lunar", "oracle", "secret"]),
  evil_magic: themeProfile("Evil Magic", ["occult_sanctum", "summoning_halls", "library_archives", "sealed_vaults"], ["stone_walls", "black_patch_pits", "occult_events", "runes", "sealed_doors"], ["occult", "demon", "undead"], ["occult_room", "occult_corridor"], ["ritual", "library", "hazard"]),
  living: themeProfile("Living", ["living_quarters", "noble_quarters", "storage", "guard_post"], ["stone_walls", "wooden_doors", "beds", "tables", "crates"], ["humanoid", "vermin", "beast"], ["standard_room", "standard_corridor"], ["habitation", "service", "suite"]),
  tomb: themeProfile("Tomb", ["tombs", "ossuary", "sealed_vaults", "shrine"], ["stone_walls", "sealed_doors", "sarcophagi", "pillars", "stairs"], ["undead", "construct", "vermin"], ["crypt_room", "crypt_corridor"], ["funerary", "vaults", "niches"]),
};

const DISTRICT_PROFILES = {
  old_halls: { label: "Old Halls", eventLink: "standard_room", corridorEventLink: "standard_corridor", templates: ["small_room", "long_gallery", "wide_hall", "split_chamber"], landmarks: ["grand_hall", "pillared_hall", "audience_hall", "fountain_court"] },
  guard_post: { label: "Guard Post", eventLink: "guard_room", corridorEventLink: "standard_corridor", templates: ["small_room", "cell_block", "long_gallery", "storage_room"], landmarks: ["barracks_hall", "watch_hall"] },
  barracks: { label: "Barracks", eventLink: "barracks_room", corridorEventLink: "standard_corridor", templates: ["small_room", "long_gallery", "storage_room", "wide_hall"], landmarks: ["barracks_hall", "mess_hall", "banquet_hall"] },
  living_quarters: { label: "Living Quarters", eventLink: "noble_room", corridorEventLink: "standard_corridor", templates: ["small_room", "storage_room", "wide_hall"], landmarks: ["bedroom_suite", "mess_hall", "bathing_hall"] },
  armory: { label: "Armory", eventLink: "armory_room", corridorEventLink: "standard_corridor", templates: ["small_room", "storage_room", "long_gallery"], landmarks: ["weapons_hall", "armory_vault", "training_floor"] },
  library_archives: { label: "Library Archives", eventLink: "library_room", corridorEventLink: "standard_corridor", templates: ["small_room", "long_gallery", "storage_room", "split_chamber"], landmarks: ["library_hall", "archive_stacks", "scriptorium"] },
  noble_quarters: { label: "Noble Quarters", eventLink: "noble_room", corridorEventLink: "standard_corridor", templates: ["small_room", "wide_hall", "storage_room"], landmarks: ["throne_room", "bedroom_suite", "bathing_hall", "banquet_hall"] },
  storage: { label: "Stores", eventLink: "storage_room", corridorEventLink: "standard_corridor", templates: ["small_room", "storage_room", "long_gallery"], landmarks: ["warehouse", "treasure_vault"] },
  shrine: { label: "Shrine", eventLink: "shrine_room", corridorEventLink: "standard_corridor", templates: ["small_room", "wide_hall", "split_chamber"], landmarks: ["shrine_hall", "ritual_octagon", "temple_nave", "reliquary"] },
  tombs: { label: "Tombs", eventLink: "crypt_room", corridorEventLink: "crypt_corridor", templates: ["small_room", "cell_block", "long_gallery", "storage_room"], landmarks: ["burial_hall", "ritual_octagon", "ancestral_crypt"] },
  ossuary: { label: "Ossuary", eventLink: "crypt_room", corridorEventLink: "crypt_corridor", templates: ["small_room", "cell_block", "split_chamber"], landmarks: ["ossuary_hall", "burial_hall"] },
  sealed_vaults: { label: "Sealed Vaults", eventLink: "vault_room", corridorEventLink: "standard_corridor", templates: ["small_room", "storage_room", "split_chamber"], landmarks: ["sealed_vault", "treasure_vault", "reliquary"] },
  ruined_halls: { label: "Ruined Halls", eventLink: "ruin_room", corridorEventLink: "ruin_corridor", templates: ["small_room", "long_gallery", "wide_hall", "ruined_room"], landmarks: ["collapsed_hall", "grand_hall"] },
  flooded_halls: { label: "Flooded Halls", eventLink: "flooded_room", corridorEventLink: "flooded_corridor", templates: ["small_room", "long_gallery", "wide_hall"], landmarks: ["cistern_hall", "flooded_chamber"] },
  cistern: { label: "Cistern", eventLink: "flooded_room", corridorEventLink: "flooded_corridor", templates: ["small_room", "wide_hall", "storage_room"], landmarks: ["cistern_hall", "flooded_chamber", "bathing_hall"] },
  forge_complex: { label: "Forge Complex", eventLink: "armory_room", corridorEventLink: "standard_corridor", templates: ["small_room", "storage_room", "long_gallery"], landmarks: ["weapons_hall", "armory_vault", "training_floor"] },
  market_undercity: { label: "Market Undercity", eventLink: "storage_room", corridorEventLink: "standard_corridor", templates: ["small_room", "storage_room", "wide_hall", "long_gallery"], landmarks: ["warehouse", "banquet_hall", "fountain_court"] },
  occult_sanctum: { label: "Occult Sanctum", eventLink: "occult_room", corridorEventLink: "occult_corridor", templates: ["small_room", "wide_hall", "split_chamber"], landmarks: ["summoning_hall", "ritual_octagon", "forbidden_library"] },
  summoning_halls: { label: "Summoning Halls", eventLink: "occult_room", corridorEventLink: "occult_corridor", templates: ["small_room", "long_gallery", "wide_hall"], landmarks: ["summoning_hall", "grand_hall"] },
  cavern_edge: { label: "Cavern Edge", eventLink: "cavern_chamber", corridorEventLink: "cavern_passage", templates: ["cave_chamber", "small_room", "wide_hall"], landmarks: ["cavern_lake", "great_cavern"] },
};

const PRECINCT_BLUEPRINTS = {
  tomb_grid: {
    label: "Tomb Grid",
    shape: "grid",
    themeGroups: ["Crypts", "Undead", "Generic Dungeon"],
    templates: ["small_room", "cell_block"],
    landmarks: ["burial_hall", "ossuary_hall", "ancestral_crypt"],
    roomDensity: 1.15,
    connectionStyle: "compact_cluster",
    tags: ["precinct", "crypt", "dense_rooms"],
  },
  crypt_gallery: {
    label: "Crypt Gallery",
    shape: "linear",
    themeGroups: ["Crypts", "Religious", "Undead"],
    templates: ["small_room", "long_gallery", "cell_block"],
    landmarks: ["burial_hall", "reliquary"],
    roomDensity: 0.9,
    connectionStyle: "linear_gallery",
    tags: ["precinct", "crypt", "linear"],
  },
  shrine_complex: {
    label: "Shrine Complex",
    shape: "hub",
    themeGroups: ["Religious", "Occult", "Undead Stronghold"],
    templates: ["small_room", "wide_hall", "split_chamber"],
    landmarks: ["shrine_hall", "temple_nave", "reliquary"],
    roomDensity: 0.75,
    connectionStyle: "hub_spoke",
    tags: ["precinct", "religious", "hub"],
  },
  ritual_axis: {
    label: "Ritual Axis",
    shape: "axis",
    themeGroups: ["Religious", "Occult", "Demonic"],
    templates: ["small_room", "long_gallery", "wide_hall"],
    landmarks: ["ritual_octagon", "summoning_hall", "temple_nave"],
    roomDensity: 0.7,
    connectionStyle: "linear_gallery",
    tags: ["precinct", "ritual", "axis"],
  },
  pillared_hall: {
    label: "Pillared Hall",
    shape: "landmark",
    themeGroups: ["Generic Dungeon", "Lost Civilization", "Religious"],
    templates: ["small_room", "wide_hall"],
    landmarks: ["pillared_hall", "grand_hall", "audience_hall"],
    roomDensity: 0.55,
    connectionStyle: "hub_spoke",
    tags: ["precinct", "landmark", "open"],
  },
  barracks_block: {
    label: "Barracks Block",
    shape: "suite",
    themeGroups: ["Military", "Living Quarters", "Stronghold"],
    templates: ["small_room", "long_gallery", "storage_room"],
    landmarks: ["barracks_hall", "watch_hall", "mess_hall"],
    roomDensity: 1,
    connectionStyle: "compact_cluster",
    tags: ["precinct", "military", "living"],
  },
  living_quarters: {
    label: "Living Quarters",
    shape: "suite",
    themeGroups: ["Living Quarters", "Noble", "Lost Civilization"],
    templates: ["small_room", "storage_room", "wide_hall"],
    landmarks: ["bedroom_suite", "bathing_hall", "banquet_hall"],
    roomDensity: 0.95,
    connectionStyle: "compact_cluster",
    tags: ["precinct", "living", "suite"],
  },
  workshop_cluster: {
    label: "Workshop Cluster",
    shape: "mixed",
    themeGroups: ["Workshops", "Forges", "Laboratories"],
    templates: ["small_room", "storage_room", "long_gallery"],
    landmarks: ["warehouse", "training_floor"],
    roomDensity: 0.9,
    connectionStyle: "compact_cluster",
    tags: ["precinct", "workshop", "service"],
  },
  transition_hall: {
    label: "Transition Hall",
    shape: "connector",
    themeGroups: ["Generic Dungeon", "Connector"],
    templates: ["long_gallery", "small_room"],
    landmarks: ["grand_hall", "watch_hall"],
    roomDensity: 0.45,
    connectionStyle: "linear_gallery",
    tags: ["precinct", "transition", "connector"],
  },
  dead_end_vault: {
    label: "Dead-End Vault",
    shape: "branch",
    themeGroups: ["Vaults", "Treasure", "Deathtrap", "Generic Dungeon"],
    templates: ["small_room", "storage_room"],
    landmarks: ["sealed_vault", "treasure_vault", "armory_vault"],
    roomDensity: 0.55,
    connectionStyle: "branch",
    tags: ["precinct", "vault", "dead_end"],
  },
  cave_intrusion: {
    label: "Cave Intrusion",
    shape: "organic",
    themeGroups: ["Caverns", "Ruins", "Waterworks"],
    templates: ["cave_chamber", "small_room", "wide_hall"],
    landmarks: ["great_cavern", "cavern_lake", "flooded_chamber"],
    roomDensity: 0.65,
    connectionStyle: "loose_cluster",
    tags: ["precinct", "cavern", "organic"],
  },
};

const PRECINCTS_BY_DISTRICT = {
  tombs: ["tomb_grid", "crypt_gallery", "dead_end_vault"],
  ossuary: ["tomb_grid", "crypt_gallery", "dead_end_vault"],
  shrine: ["shrine_complex", "ritual_axis", "pillared_hall", "transition_hall"],
  occult_sanctum: ["ritual_axis", "shrine_complex", "dead_end_vault"],
  summoning_halls: ["ritual_axis", "pillared_hall", "transition_hall"],
  guard_post: ["barracks_block", "transition_hall", "dead_end_vault"],
  barracks: ["barracks_block", "living_quarters", "transition_hall"],
  living_quarters: ["living_quarters", "barracks_block", "transition_hall"],
  armory: ["workshop_cluster", "dead_end_vault", "barracks_block"],
  forge_complex: ["workshop_cluster", "dead_end_vault", "transition_hall"],
  market_undercity: ["workshop_cluster", "living_quarters", "transition_hall"],
  storage: ["workshop_cluster", "dead_end_vault", "transition_hall"],
  library_archives: ["workshop_cluster", "dead_end_vault", "shrine_complex"],
  noble_quarters: ["living_quarters", "pillared_hall", "transition_hall"],
  old_halls: ["transition_hall", "pillared_hall", "living_quarters", "workshop_cluster"],
  ruined_halls: ["transition_hall", "cave_intrusion", "pillared_hall", "dead_end_vault"],
  flooded_halls: ["cave_intrusion", "pillared_hall", "transition_hall"],
  cistern: ["cave_intrusion", "pillared_hall", "dead_end_vault"],
  sealed_vaults: ["dead_end_vault", "transition_hall", "shrine_complex"],
  cavern_edge: ["cave_intrusion", "transition_hall", "dead_end_vault"],
};

const GEOMORPH_BLUEPRINTS = {
  compact_tomb_cells: {
    label: "Compact Tomb Cells",
    precinctTypes: ["tomb_grid", "crypt_gallery"],
    width: 10,
    height: 10,
    weight: 10,
    tags: ["geomorph", "crypt", "compact"],
    rooms: [
      { key: "burial_hall", label: "Small Tomb", x: 3, y: 3, width: 4, height: 4, tags: ["crypt"] },
      { key: "cell_block", label: "North Cell", x: 3, y: 1, width: 4, height: 2, tags: ["crypt", "side_cell"] },
      { key: "cell_block", label: "South Cell", x: 3, y: 7, width: 4, height: 2, tags: ["crypt", "side_cell"] },
    ],
  },
  tomb_cross: {
    label: "Tomb Cross",
    precinctTypes: ["tomb_grid", "crypt_gallery"],
    width: 14,
    height: 14,
    weight: 8,
    tags: ["geomorph", "crypt"],
    rooms: [
      { key: "burial_hall", label: "Central Tomb", x: 5, y: 5, width: 4, height: 4, tags: ["landmark", "crypt"] },
      { key: "cell_block", label: "North Burial Cell", x: 5, y: 1, width: 4, height: 3, tags: ["crypt", "side_cell"] },
      { key: "cell_block", label: "South Burial Cell", x: 5, y: 10, width: 4, height: 3, tags: ["crypt", "side_cell"] },
      { key: "cell_block", label: "West Burial Cell", x: 1, y: 5, width: 3, height: 4, tags: ["crypt", "side_cell"] },
      { key: "cell_block", label: "East Burial Cell", x: 10, y: 5, width: 3, height: 4, tags: ["crypt", "side_cell"] },
    ],
  },
  crypt_gallery_line: {
    label: "Crypt Gallery Line",
    precinctTypes: ["tomb_grid", "crypt_gallery", "dead_end_vault"],
    width: 18,
    height: 8,
    weight: 7,
    tags: ["geomorph", "gallery", "crypt"],
    rooms: [
      { key: "long_gallery", label: "Burial Gallery", x: 2, y: 3, width: 14, height: 2, tags: ["gallery", "crypt"] },
      { key: "small_room", label: "West Niche", x: 2, y: 1, width: 3, height: 2, tags: ["crypt", "niche"] },
      { key: "small_room", label: "Mid Niche", x: 7, y: 5, width: 4, height: 2, tags: ["crypt", "niche"] },
      { key: "small_room", label: "East Niche", x: 13, y: 1, width: 3, height: 2, tags: ["crypt", "niche"] },
    ],
  },
  shrine_axis: {
    label: "Shrine Axis",
    precinctTypes: ["shrine_complex", "ritual_axis"],
    width: 16,
    height: 18,
    weight: 9,
    tags: ["geomorph", "religious", "axis"],
    rooms: [
      { key: "temple_nave", label: "Processional Hall", x: 5, y: 2, width: 6, height: 10, tags: ["landmark", "temple"] },
      { key: "shrine_hall", label: "Inner Shrine", x: 4, y: 13, width: 8, height: 4, tags: ["shrine"] },
      { key: "small_room", label: "West Chapel", x: 1, y: 6, width: 3, height: 4, tags: ["chapel"] },
      { key: "small_room", label: "East Chapel", x: 12, y: 6, width: 3, height: 4, tags: ["chapel"] },
    ],
  },
  small_shrine_suite: {
    label: "Small Shrine Suite",
    precinctTypes: ["shrine_complex", "ritual_axis"],
    width: 12,
    height: 12,
    weight: 10,
    tags: ["geomorph", "religious", "compact"],
    rooms: [
      { key: "shrine_hall", label: "Shrine Room", x: 3, y: 5, width: 6, height: 4, tags: ["shrine"] },
      { key: "small_room", label: "Vestry", x: 1, y: 1, width: 4, height: 3, tags: ["religious"] },
      { key: "small_room", label: "Offering Room", x: 7, y: 1, width: 4, height: 3, tags: ["storage", "religious"] },
    ],
  },
  ritual_octagon_cluster: {
    label: "Ritual Octagon Cluster",
    precinctTypes: ["ritual_axis", "shrine_complex", "pillared_hall"],
    width: 18,
    height: 16,
    weight: 7,
    tags: ["geomorph", "occult", "hub"],
    rooms: [
      { key: "ritual_octagon", label: "Ritual Focus", x: 6, y: 5, width: 6, height: 6, tags: ["landmark", "ritual"] },
      { key: "small_room", label: "West Preparation Room", x: 1, y: 6, width: 4, height: 4, tags: ["occult"] },
      { key: "small_room", label: "East Preparation Room", x: 13, y: 6, width: 4, height: 4, tags: ["occult"] },
      { key: "storage_room", label: "Offering Store", x: 7, y: 1, width: 4, height: 3, tags: ["storage", "occult"] },
      { key: "sealed_vault", label: "Sealed Reliquary", x: 6, y: 12, width: 6, height: 3, tags: ["vault", "occult"] },
    ],
  },
  barracks_suite: {
    label: "Barracks Suite",
    precinctTypes: ["barracks_block", "living_quarters"],
    width: 18,
    height: 14,
    weight: 8,
    tags: ["geomorph", "living", "military"],
    rooms: [
      { key: "barracks_hall", label: "Bunk Hall", x: 5, y: 4, width: 8, height: 6, tags: ["barracks"] },
      { key: "small_room", label: "Officer Cell", x: 1, y: 1, width: 4, height: 4, tags: ["quarters"] },
      { key: "storage_room", label: "Gear Store", x: 13, y: 1, width: 4, height: 4, tags: ["storage"] },
      { key: "mess_hall", label: "Mess Room", x: 4, y: 10, width: 10, height: 3, tags: ["mess"] },
    ],
  },
  compact_barracks: {
    label: "Compact Barracks",
    precinctTypes: ["barracks_block", "living_quarters"],
    width: 12,
    height: 10,
    weight: 10,
    tags: ["geomorph", "living", "military", "compact"],
    rooms: [
      { key: "wide_hall", label: "Bunk Room", x: 4, y: 3, width: 5, height: 4, tags: ["barracks"] },
      { key: "small_room", label: "Officer Room", x: 1, y: 1, width: 3, height: 3, tags: ["quarters"] },
      { key: "storage_room", label: "Gear Closet", x: 8, y: 1, width: 3, height: 3, tags: ["storage"] },
    ],
  },
  workshop_yard: {
    label: "Workshop Yard",
    precinctTypes: ["workshop_cluster"],
    width: 18,
    height: 16,
    weight: 7,
    tags: ["geomorph", "workshop", "service"],
    rooms: [
      { key: "wide_hall", label: "Work Floor", x: 5, y: 5, width: 8, height: 6, tags: ["workshop"] },
      { key: "storage_room", label: "Raw Stores", x: 1, y: 2, width: 4, height: 5, tags: ["storage"] },
      { key: "storage_room", label: "Tool Cage", x: 13, y: 2, width: 4, height: 5, tags: ["storage"] },
      { key: "small_room", label: "Overseer Office", x: 7, y: 12, width: 4, height: 3, tags: ["office"] },
    ],
  },
  compact_workshop: {
    label: "Compact Workshop",
    precinctTypes: ["workshop_cluster"],
    width: 12,
    height: 10,
    weight: 10,
    tags: ["geomorph", "workshop", "compact"],
    rooms: [
      { key: "wide_hall", label: "Work Room", x: 3, y: 3, width: 6, height: 4, tags: ["workshop"] },
      { key: "storage_room", label: "Supply Closet", x: 1, y: 1, width: 3, height: 3, tags: ["storage"] },
      { key: "small_room", label: "Office Nook", x: 8, y: 7, width: 3, height: 2, tags: ["office"] },
    ],
  },
  vault_branch: {
    label: "Vault Branch",
    precinctTypes: ["dead_end_vault"],
    width: 16,
    height: 12,
    weight: 9,
    tags: ["geomorph", "vault", "branch"],
    rooms: [
      { key: "long_gallery", label: "Guarded Approach", x: 1, y: 5, width: 8, height: 2, tags: ["gallery"] },
      { key: "sealed_vault", label: "Sealed Vault", x: 10, y: 3, width: 5, height: 6, tags: ["landmark", "vault"] },
      { key: "small_room", label: "Guard Niche", x: 4, y: 2, width: 3, height: 3, tags: ["guard"] },
      { key: "storage_room", label: "False Treasury", x: 4, y: 8, width: 4, height: 3, tags: ["storage", "trap_candidate"] },
    ],
  },
  compact_vault: {
    label: "Compact Vault",
    precinctTypes: ["dead_end_vault"],
    width: 10,
    height: 8,
    weight: 10,
    tags: ["geomorph", "vault", "compact"],
    rooms: [
      { key: "long_gallery", label: "Short Approach", x: 1, y: 3, width: 5, height: 2, tags: ["gallery"] },
      { key: "sealed_vault", label: "Small Vault", x: 6, y: 2, width: 3, height: 4, tags: ["vault"] },
    ],
  },
  cavern_pocket: {
    label: "Cavern Pocket",
    precinctTypes: ["cave_intrusion"],
    width: 20,
    height: 16,
    weight: 8,
    tags: ["geomorph", "cavern", "organic"],
    rooms: [
      { key: "great_cavern", label: "Rough Cavern", x: 4, y: 4, width: 10, height: 8, tags: ["landmark", "cavern", "open_chamber"], accessType: "open_chamber" },
      { key: "cave_chamber", label: "Side Pocket", x: 1, y: 2, width: 5, height: 4, tags: ["cavern", "open_chamber"], accessType: "open_chamber" },
      { key: "cave_chamber", label: "Lower Pocket", x: 13, y: 10, width: 5, height: 4, tags: ["cavern", "open_chamber"], accessType: "open_chamber" },
    ],
  },
  small_cavern_pocket: {
    label: "Small Cavern Pocket",
    precinctTypes: ["cave_intrusion"],
    width: 12,
    height: 10,
    weight: 10,
    tags: ["geomorph", "cavern", "organic", "compact"],
    rooms: [
      { key: "cave_chamber", label: "Rough Chamber", x: 3, y: 2, width: 6, height: 5, tags: ["cavern", "open_chamber"], accessType: "open_chamber" },
      { key: "cave_chamber", label: "Side Pocket", x: 1, y: 6, width: 4, height: 3, tags: ["cavern", "open_chamber"], accessType: "open_chamber" },
    ],
  },
  hall_room_cluster: {
    label: "Hall Room Cluster",
    precinctTypes: ["transition_hall", "pillared_hall", "old_halls"],
    width: 16,
    height: 14,
    weight: 10,
    tags: ["geomorph", "hall_cluster"],
    rooms: [
      { key: "wide_hall", label: "Central Hall", x: 5, y: 5, width: 6, height: 4, tags: ["hall"] },
      { key: "small_room", label: "West Chamber", x: 1, y: 4, width: 4, height: 4, tags: ["room"] },
      { key: "small_room", label: "East Chamber", x: 11, y: 4, width: 4, height: 4, tags: ["room"] },
      { key: "storage_room", label: "Rear Store", x: 6, y: 10, width: 4, height: 3, tags: ["storage"] },
    ],
  },
  narrow_crossing: {
    label: "Narrow Crossing",
    precinctTypes: ["transition_hall", "pillared_hall", "ritual_axis", "tomb_grid", "dead_end_vault", "barracks_block", "workshop_cluster"],
    width: 10,
    height: 12,
    weight: 10,
    tags: ["geomorph", "connector", "compact"],
    rooms: [
      { key: "wide_hall", label: "Small Crossing", x: 3, y: 4, width: 4, height: 4, tags: ["hall", "connector"] },
      { key: "long_gallery", label: "North Hall", x: 4, y: 1, width: 2, height: 3, tags: ["gallery"] },
      { key: "long_gallery", label: "South Hall", x: 4, y: 8, width: 2, height: 3, tags: ["gallery"] },
    ],
  },
  dogleg_connector: {
    label: "Dogleg Connector",
    precinctTypes: ["transition_hall", "pillared_hall", "ritual_axis", "crypt_gallery", "barracks_block", "workshop_cluster", "cave_intrusion"],
    width: 14,
    height: 12,
    weight: 8,
    tags: ["geomorph", "connector", "dogleg"],
    rooms: [
      { key: "long_gallery", label: "West Passage", x: 1, y: 4, width: 6, height: 2, tags: ["gallery", "connector"] },
      { key: "wide_hall", label: "Turn Chamber", x: 6, y: 4, width: 4, height: 4, tags: ["hall", "connector"] },
      { key: "long_gallery", label: "North Passage", x: 8, y: 1, width: 2, height: 4, tags: ["gallery", "connector"] },
      { key: "small_room", label: "Side Guard Room", x: 10, y: 7, width: 3, height: 3, tags: ["side_room", "guard"] },
    ],
  },
  side_room_passage: {
    label: "Side-Room Passage",
    precinctTypes: ["transition_hall", "pillared_hall", "ritual_axis", "tomb_grid", "crypt_gallery", "dead_end_vault", "living_quarters"],
    width: 16,
    height: 10,
    weight: 9,
    tags: ["geomorph", "connector", "side_passage"],
    rooms: [
      { key: "long_gallery", label: "Main Passage", x: 1, y: 4, width: 14, height: 2, tags: ["gallery", "connector"] },
      { key: "small_room", label: "North Side Room", x: 4, y: 1, width: 4, height: 3, tags: ["side_room"] },
      { key: "storage_room", label: "South Side Room", x: 10, y: 6, width: 4, height: 3, tags: ["side_room", "storage"] },
    ],
  },
  tee_connector: {
    label: "Tee Connector",
    precinctTypes: ["transition_hall", "pillared_hall", "ritual_axis", "shrine_complex", "barracks_block", "workshop_cluster"],
    width: 14,
    height: 14,
    weight: 8,
    tags: ["geomorph", "connector", "junction"],
    rooms: [
      { key: "wide_hall", label: "Tee Junction", x: 5, y: 5, width: 4, height: 4, tags: ["hall", "connector"] },
      { key: "long_gallery", label: "West Passage", x: 1, y: 6, width: 5, height: 2, tags: ["gallery", "connector"] },
      { key: "long_gallery", label: "East Passage", x: 8, y: 6, width: 5, height: 2, tags: ["gallery", "connector"] },
      { key: "long_gallery", label: "North Passage", x: 6, y: 1, width: 2, height: 5, tags: ["gallery", "connector"] },
      { key: "small_room", label: "Junction Niche", x: 9, y: 9, width: 3, height: 3, tags: ["side_room"] },
    ],
  },
  alcove_gallery: {
    label: "Alcove Gallery",
    precinctTypes: ["transition_hall", "pillared_hall", "crypt_gallery", "tomb_grid", "shrine_complex", "dead_end_vault"],
    width: 18,
    height: 8,
    weight: 7,
    tags: ["geomorph", "connector", "gallery", "alcoves"],
    rooms: [
      { key: "long_gallery", label: "Alcove Passage", x: 1, y: 3, width: 16, height: 2, tags: ["gallery", "connector"] },
      { key: "small_room", label: "West Alcove", x: 3, y: 1, width: 3, height: 2, tags: ["alcove"] },
      { key: "small_room", label: "East Alcove", x: 12, y: 5, width: 3, height: 2, tags: ["alcove"] },
    ],
  },
  transition_crossing: {
    label: "Transition Crossing",
    precinctTypes: ["transition_hall", "pillared_hall", "ritual_axis", "shrine_complex", "barracks_block", "workshop_cluster"],
    width: 18,
    height: 18,
    weight: 6,
    tags: ["geomorph", "connector", "crossing"],
    rooms: [
      { key: "wide_hall", label: "Crossing Hall", x: 6, y: 6, width: 6, height: 6, tags: ["hall", "connector"] },
      { key: "long_gallery", label: "North Passage", x: 7, y: 1, width: 4, height: 5, tags: ["gallery"] },
      { key: "long_gallery", label: "South Passage", x: 7, y: 12, width: 4, height: 5, tags: ["gallery"] },
      { key: "long_gallery", label: "West Passage", x: 1, y: 7, width: 5, height: 4, tags: ["gallery"] },
      { key: "long_gallery", label: "East Passage", x: 12, y: 7, width: 5, height: 4, tags: ["gallery"] },
    ],
  },
};

const ROOM_TEMPLATES = {
  small_room: { label: "Small Room", minW: 2, maxW: 6, minH: 2, maxH: 6, weight: 10, tags: ["room"] },
  storage_room: { label: "Store Room", minW: 2, maxW: 5, minH: 2, maxH: 7, weight: 7, tags: ["storage"] },
  cell_block: { label: "Cell Block", minW: 2, maxW: 4, minH: 3, maxH: 8, weight: 6, tags: ["cell_block"] },
  long_gallery: { label: "Long Gallery", minW: 3, maxW: 12, minH: 2, maxH: 4, weight: 7, tags: ["gallery"] },
  wide_hall: { label: "Wide Hall", minW: 5, maxW: 10, minH: 4, maxH: 8, weight: 6, tags: ["hall"] },
  split_chamber: { label: "Split Chamber", minW: 4, maxW: 9, minH: 4, maxH: 9, weight: 4, tags: ["split_chamber"] },
  ruined_room: { label: "Ruined Room", minW: 3, maxW: 9, minH: 3, maxH: 9, weight: 5, tags: ["ruined"] },
  cave_chamber: { label: "Cave Chamber", minW: 4, maxW: 12, minH: 4, maxH: 10, weight: 5, tags: ["cavern", "open_chamber"], accessType: "open_chamber" },
};

const LANDMARK_TEMPLATES = {
  grand_hall: { label: "Grand Hall", minW: 10, maxW: 18, minH: 5, maxH: 10, tags: ["landmark", "grand_hall"] },
  pillared_hall: { label: "Pillared Hall", minW: 8, maxW: 14, minH: 6, maxH: 10, tags: ["landmark", "pillared"] },
  barracks_hall: { label: "Barracks Hall", minW: 8, maxW: 14, minH: 5, maxH: 9, tags: ["landmark", "barracks"] },
  watch_hall: { label: "Watch Hall", minW: 6, maxW: 12, minH: 4, maxH: 8, tags: ["landmark", "guard_post"] },
  mess_hall: { label: "Mess Hall", minW: 8, maxW: 14, minH: 5, maxH: 8, tags: ["landmark", "barracks"] },
  warehouse: { label: "Warehouse", minW: 8, maxW: 16, minH: 5, maxH: 9, tags: ["landmark", "storage"] },
  shrine_hall: { label: "Shrine Hall", minW: 7, maxW: 13, minH: 6, maxH: 10, tags: ["landmark", "shrine"] },
  ritual_octagon: { label: "Ritual Chamber", minW: 7, maxW: 11, minH: 7, maxH: 11, tags: ["landmark", "ritual"] },
  burial_hall: { label: "Burial Hall", minW: 8, maxW: 14, minH: 5, maxH: 10, tags: ["landmark", "tomb"] },
  ossuary_hall: { label: "Ossuary Hall", minW: 6, maxW: 12, minH: 5, maxH: 9, tags: ["landmark", "ossuary"] },
  sealed_vault: { label: "Sealed Vault", minW: 5, maxW: 9, minH: 5, maxH: 9, tags: ["landmark", "vault"] },
  treasure_vault: { label: "Treasure Vault", minW: 5, maxW: 10, minH: 4, maxH: 8, tags: ["landmark", "vault", "treasure"] },
  collapsed_hall: { label: "Collapsed Hall", minW: 7, maxW: 14, minH: 4, maxH: 9, tags: ["landmark", "ruined"] },
  cistern_hall: { label: "Cistern Hall", minW: 8, maxW: 16, minH: 6, maxH: 12, tags: ["landmark", "water"] },
  flooded_chamber: { label: "Flooded Chamber", minW: 7, maxW: 14, minH: 5, maxH: 10, tags: ["landmark", "water", "open_chamber"], accessType: "open_chamber" },
  summoning_hall: { label: "Summoning Hall", minW: 7, maxW: 13, minH: 6, maxH: 10, tags: ["landmark", "occult"] },
  cavern_lake: { label: "Cavern Lake", minW: 10, maxW: 18, minH: 8, maxH: 14, tags: ["landmark", "cavern", "water", "open_chamber"], accessType: "open_chamber" },
  great_cavern: { label: "Great Cavern", minW: 10, maxW: 20, minH: 8, maxH: 16, tags: ["landmark", "cavern", "open_chamber"], accessType: "open_chamber" },
};

const CHAMBER_BLUEPRINTS = {
  throne_room: {
    label: "Throne Room",
    shape: "rectangular_axis",
    minW: 9,
    maxW: 15,
    minH: 7,
    maxH: 12,
    eventLink: "throne_room",
    tags: ["landmark", "court", "boss_candidate"],
    doorPlan: "grand_entry_plus_side_doors",
    features: ["raised dais", "central aisle", "flanking pillars", "possible secret escape door"],
  },
  audience_hall: {
    label: "Audience Hall",
    shape: "long_rectangular",
    minW: 10,
    maxW: 18,
    minH: 5,
    maxH: 8,
    eventLink: "noble_room",
    tags: ["landmark", "court", "social_space"],
    doorPlan: "opposed_entries",
    features: ["wide approach", "side alcoves", "formal center line"],
  },
  weapons_hall: {
    label: "Weapons Hall",
    shape: "rectangular_with_bays",
    minW: 8,
    maxW: 14,
    minH: 5,
    maxH: 9,
    eventLink: "armory_room",
    tags: ["landmark", "armory", "treasure_candidate"],
    doorPlan: "secure_doors",
    features: ["weapon racks", "display alcoves", "locked side cage"],
  },
  armory_vault: {
    label: "Armory Vault",
    shape: "compact_secure",
    minW: 5,
    maxW: 9,
    minH: 4,
    maxH: 7,
    eventLink: "armory_room",
    tags: ["landmark", "armory", "vault", "locked"],
    doorPlan: "single_locked_entry",
    features: ["reinforced door", "stored weapons", "possible key objective"],
  },
  training_floor: {
    label: "Training Floor",
    shape: "wide_rectangular",
    minW: 9,
    maxW: 16,
    minH: 7,
    maxH: 12,
    eventLink: "barracks_room",
    tags: ["landmark", "armory", "combat_space"],
    doorPlan: "multiple_openings",
    features: ["practice ring", "weapon stands", "cover objects"],
  },
  banquet_hall: {
    label: "Banquet Hall",
    shape: "long_rectangular",
    minW: 10,
    maxW: 18,
    minH: 5,
    maxH: 9,
    eventLink: "noble_room",
    tags: ["landmark", "court", "social_space"],
    doorPlan: "main_entry_service_entry",
    features: ["long tables", "service alcove", "kitchen connection"],
  },
  library_hall: {
    label: "Library Hall",
    shape: "rectangular_with_stacks",
    minW: 8,
    maxW: 15,
    minH: 6,
    maxH: 11,
    eventLink: "library_room",
    tags: ["landmark", "library", "knowledge"],
    doorPlan: "controlled_entry",
    features: ["book stacks", "reading tables", "upper gallery candidate"],
  },
  archive_stacks: {
    label: "Archive Stacks",
    shape: "narrow_parallel_aisles",
    minW: 6,
    maxW: 12,
    minH: 7,
    maxH: 14,
    eventLink: "library_room",
    tags: ["landmark", "library", "maze_like"],
    doorPlan: "one_or_two_entries",
    features: ["tight aisles", "locked cabinets", "hidden document chance"],
  },
  forbidden_library: {
    label: "Forbidden Library",
    shape: "split_chamber",
    minW: 7,
    maxW: 13,
    minH: 6,
    maxH: 11,
    eventLink: "occult_room",
    tags: ["landmark", "library", "occult", "haunt_candidate"],
    doorPlan: "secret_or_locked_entry",
    features: ["sealed shelves", "summoning diagram", "occult event hook"],
  },
  scriptorium: {
    label: "Scriptorium",
    shape: "rectangular_workroom",
    minW: 6,
    maxW: 12,
    minH: 4,
    maxH: 8,
    eventLink: "library_room",
    tags: ["landmark", "library", "workroom"],
    doorPlan: "service_entry",
    features: ["writing desks", "ink stores", "map or scroll clue"],
  },
  bedroom_suite: {
    label: "Bedroom Suite",
    shape: "suite_cluster",
    minW: 7,
    maxW: 13,
    minH: 5,
    maxH: 10,
    eventLink: "noble_room",
    tags: ["landmark", "quarters", "searchable"],
    doorPlan: "suite_entry_plus_private_door",
    features: ["bed chamber", "dressing nook", "locked chest", "secret exit chance"],
  },
  bathing_hall: {
    label: "Bathing Hall",
    shape: "pool_room",
    minW: 7,
    maxW: 14,
    minH: 6,
    maxH: 11,
    eventLink: "flooded_room",
    tags: ["landmark", "water", "quarters"],
    doorPlan: "service_entry",
    features: ["central pool", "steam hazard chance", "drain passage chance"],
  },
  fountain_court: {
    label: "Fountain Court",
    shape: "open_court",
    minW: 8,
    maxW: 16,
    minH: 8,
    maxH: 14,
    eventLink: "standard_room",
    tags: ["landmark", "court", "open_chamber"],
    accessType: "open_chamber",
    doorPlan: "several_archways",
    features: ["central fountain", "ring path", "multiple exits"],
  },
  temple_nave: {
    label: "Temple Nave",
    shape: "long_sacred_hall",
    minW: 8,
    maxW: 14,
    minH: 10,
    maxH: 18,
    eventLink: "shrine_room",
    tags: ["landmark", "temple", "ritual"],
    doorPlan: "processional_entry",
    features: ["altar end", "side chapels", "ritual aisle"],
  },
  reliquary: {
    label: "Reliquary",
    shape: "compact_secure",
    minW: 4,
    maxW: 8,
    minH: 4,
    maxH: 8,
    eventLink: "vault_room",
    tags: ["landmark", "temple", "vault", "treasure_candidate"],
    doorPlan: "single_locked_or_secret_entry",
    features: ["relic case", "trap chance", "cult objective hook"],
  },
  ancestral_crypt: {
    label: "Ancestral Crypt",
    shape: "rectangular_with_side_cells",
    minW: 8,
    maxW: 15,
    minH: 6,
    maxH: 12,
    eventLink: "crypt_room",
    tags: ["landmark", "crypt", "undead"],
    doorPlan: "sealed_entry",
    features: ["sarcophagus line", "side burial niches", "haunt chance"],
  },
};

Object.assign(LANDMARK_TEMPLATES, CHAMBER_BLUEPRINTS);

const GENERATION_STEP_DELAY = 20;

export function makeRng(seedText) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedText.length; i += 1) {
    h ^= seedText.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return function rng() {
    h += 0x6D2B79F5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function choose(rng, items) {
  return items[Math.floor(rng() * items.length)];
}

function shuffle(rng, items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function weightedChoice(rng, items) {
  const total = items.reduce((sum, item) => sum + (item.weight ?? 1), 0);
  let roll = rng() * total;
  for (const item of items) {
    roll -= item.weight ?? 1;
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

function resolveDungeonProfile(options) {
  const legacyTypeMap = {
    standard_dungeon: "lost_civilization",
    crypt: "necromancer_lair",
    occult_depths: "demonic_temple",
    flooded_halls: "flooded_underworks",
  };
  const dungeonTypeId = options.dungeonTypeId ?? legacyTypeMap[options.themeId] ?? "lost_civilization";
  const themeId = options.themeId && DUNGEON_THEMES[options.themeId] ? options.themeId : "standard_dungeon";
  return {
    dungeonTypeId,
    dungeonType: DUNGEON_TYPES[dungeonTypeId] ?? DUNGEON_TYPES.lost_civilization,
    themeId,
    theme: DUNGEON_THEMES[themeId] ?? DUNGEON_THEMES.standard_dungeon,
  };
}

export function generateDungeon(options) {
  const rng = makeRng(options.seed || "dungeon");
  const floorCount = determineFloorCount(options, rng);
  const { dungeonType, dungeonTypeId, theme, themeId } = resolveDungeonProfile(options);
  const dungeon = createDungeonState({
    size: options.size,
    floorCount,
    seed: options.seed,
    floorTile: options.floorTile,
    dungeonTypeId,
    dungeonType,
    themeId,
    theme,
    themeInfluences: {
      objectPalette: theme.objectPalette,
      encounterFilters: theme.encounterFilters,
      dressingTables: theme.dressingTables,
    },
    generationPlan: makeGenerationPlan(options, floorCount, theme, dungeonType),
    name: `Dungeon ${String(options.seed || "seed").slice(0, 18)}`,
  });

  for (let f = 0; f < dungeon.floorCount; f += 1) {
    generateFloor(dungeon, f, rng, options);
  }
  addFloorConnections(dungeon, rng);
  finishDungeonGeneration(dungeon);

  return dungeon;
}

export async function generateDungeonAsync(options, onProgress) {
  const rng = makeRng(options.seed || "dungeon");
  const floorCount = determineFloorCount(options, rng);
  const { dungeonType, dungeonTypeId, theme, themeId } = resolveDungeonProfile(options);
  const dungeon = createDungeonState({
    size: options.size,
    floorCount,
    seed: options.seed,
    floorTile: options.floorTile,
    dungeonTypeId,
    dungeonType,
    themeId,
    theme,
    themeInfluences: {
      objectPalette: theme.objectPalette,
      encounterFilters: theme.encounterFilters,
      dressingTables: theme.dressingTables,
    },
    generationPlan: makeGenerationPlan(options, floorCount, theme, dungeonType),
    name: `Dungeon ${String(options.seed || "seed").slice(0, 18)}`,
  });

  onProgress?.({ phase: "start", floorIndex: -1, floorCount, message: `Preparing ${dungeonType.label} with ${theme.label} theme.` });

  for (let f = 0; f < dungeon.floorCount; f += 1) {
    onProgress?.({ phase: "floor", floorIndex: f, floorCount, message: `Building layer ${f + 1} of ${floorCount}.` });
    await delay(GENERATION_STEP_DELAY);
    generateFloor(dungeon, f, rng, options);
  }

  onProgress?.({ phase: "connections", floorIndex: floorCount - 1, floorCount, message: "Linking stairs and passages between layers." });
  await delay(GENERATION_STEP_DELAY);
  addFloorConnections(dungeon, rng);
  finishDungeonGeneration(dungeon);

  onProgress?.({ phase: "complete", floorIndex: floorCount - 1, floorCount, message: "Dungeon ready." });

  return dungeon;
}

function finishDungeonGeneration(dungeon) {
  const firstRoom = dungeon.rooms.find((room) => room.floorIndex === 0);
  if (firstRoom) {
    dungeon.player.floorIndex = 0;
    dungeon.player.wallX = Math.floor(firstRoom.x + firstRoom.width / 2);
    dungeon.player.wallY = Math.floor(firstRoom.y + firstRoom.height / 2);
    markVisited(dungeon, dungeon.player.floorIndex, dungeon.player.wallX, dungeon.player.wallY);
  }

  dungeon.eventLog.push({
    turn: 1,
    text: `Generated ${dungeon.rooms.length} rooms across ${dungeon.floorCount} layer(s).`,
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function determineFloorCount(options, rng) {
  const rule = FLOOR_CHANCE[options.size] ?? FLOOR_CHANCE.medium;
  const requestedMax = Number(options.floorCount) || MAX_FLOORS;
  const maxFloors = Math.max(rule.min, Math.min(requestedMax, MAX_FLOORS));
  let floorCount = rule.min;
  while (floorCount < maxFloors) {
    const generatedAfterFirst = Math.max(0, floorCount - 1);
    const chance = Math.max(0, rule.start - rule.decay * generatedAfterFirst);
    if (rng() >= chance) break;
    floorCount += 1;
  }
  return floorCount;
}

function makeGenerationPlan(options, floorCount, theme, dungeonType = DUNGEON_TYPES.lost_civilization) {
  return {
    sizeCategory: options.size,
    floorCount,
    smallDungeonThemePolicy: "small_dungeons_use_one_theme_type",
    structureModel: "typed_blocks_clustered_districts_transition_routes",
    floorConnectionPolicy: "size_based_recursive_chance",
    floorChanceRule: FLOOR_CHANCE[options.size] ?? FLOOR_CHANCE.medium,
    layerBuildMode: "one_layer_at_a_time",
    variableLayerSizes: "planned",
    skipFloorConnections: "planned",
    dungeonType: dungeonType.label,
    theme: theme.label,
    themeInfluences: {
      objectPalette: theme.objectPalette,
      encounterFilters: theme.encounterFilters,
      dressingTables: theme.dressingTables,
      geomorphFamilies: theme.geomorphFamilies,
    },
  };
}

function generateFloor(dungeon, floorIndex, rng, options) {
  const plan = roomPlanForDungeon(dungeon, options, rng);
  const districts = makeFloorDistricts(dungeon, floorIndex, plan, rng);
  dungeon.floors[floorIndex].districts = districts;
  const precincts = makeFloorPrecincts(dungeon, floorIndex, districts, plan, rng);
  dungeon.floors[floorIndex].precincts = precincts;
  const rooms = [];
  const geomorphs = seedGeomorphs(dungeon, floorIndex, rng, rooms, precincts, plan);
  dungeon.floors[floorIndex].geomorphs = geomorphs;
  const geomorphAssembly = usesGeomorphAssembly(dungeon.sizeCategory);

  if (!geomorphAssembly) {
    for (const precinct of precincts) {
      const landmarkCount = precinct.landmarkTarget;
      for (let i = 0; i < landmarkCount; i += 1) {
        tryPlaceRoomFromTemplate(dungeon, floorIndex, rng, rooms, precinct, chooseLandmarkTemplate(rng, precinct), {
          landmark: true,
        });
      }
    }
  }

  let attempts = 0;
  const looseRoomTarget = geomorphAssembly ? rooms.length : plan.totalRooms;
  while (rooms.length < looseRoomTarget && attempts < plan.totalRooms * 120) {
    attempts += 1;
    const precinct = choosePrecinctForRoom(rng, precincts);
    const template = chooseRoomTemplate(rng, precinct);
    const placed = tryPlaceRoomFromTemplate(dungeon, floorIndex, rng, rooms, precinct, template, {
      openChamberIndex: rooms.filter((room) => room.accessType === "open_chamber").length,
      openChambers: plan.openChambers,
    });
    if (!placed && attempts % 8 === 0) {
      tryPlaceRoomFromTemplate(dungeon, floorIndex, rng, rooms, precinct, { key: "small_room", ...ROOM_TEMPLATES.small_room }, {
        openChamberIndex: rooms.filter((room) => room.accessType === "open_chamber").length,
        openChambers: plan.openChambers,
      });
    }
  }

  if (rooms.length < plan.minimumRooms) {
    if (geomorphAssembly) {
      addGeomorphAnnexRooms(dungeon, floorIndex, rng, rooms, geomorphs, plan.minimumRooms);
    } else {
      placeFallbackRooms(dungeon, floorIndex, rng, rooms, precincts, plan.minimumRooms);
    }
  }

  if (!rooms.length) return;

  if (geomorphAssembly) {
    connectGeomorphBlockGraph(dungeon, rooms, geomorphs, rng);
  } else {
    connectPrecinctRoomGraphs(dungeon, floorIndex, districts, precincts, rooms, rng);
  }
  if (geomorphAssembly) {
    const annexTarget = Math.min(plan.maximumRooms, rooms.length + Math.max(2, Math.floor(geomorphs.length * 0.25)));
    addGeomorphAnnexRooms(dungeon, floorIndex, rng, rooms, geomorphs, annexTarget);
  }

  addLoops(dungeon, rooms, rng, geomorphAssembly ? plan.loopRate * 0.12 : plan.loopRate);
  if (!geomorphAssembly) {
    addDeadEnds(dungeon, floorIndex, rng, Math.max(2, Math.floor(rooms.length / 4)));
  }
  assignBossRoom(dungeon, floorIndex, rooms);
  finalizeDoorStates(dungeon, floorIndex, rng);
  deriveEdges(dungeon, floorIndex);
  revealAroundRooms(dungeon, floorIndex, rooms);
}

function roomPlanForDungeon(dungeon, options, rng) {
  const type = dungeon.dungeonType ?? DUNGEON_TYPES.lost_civilization;
  const minimumRooms = minimumRoomCountForSize(dungeon.sizeCategory, dungeon.pixelWidth, dungeon.pixelHeight);
  const scaledMinimum = Math.max(minimumRooms, Math.round(minimumRooms * (type.roomScale ?? 1)));
  const maximumRooms = Math.floor(scaledMinimum * 2.5);
  const requestedRooms = Number(options.roomCount) || 0;
  const totalRooms = requestedRooms > 0
    ? Math.max(scaledMinimum, Math.min(requestedRooms, maximumRooms))
    : randInt(rng, scaledMinimum, maximumRooms);
  const districtCount = dungeon.sizeCategory === "small"
    ? 1
    : dungeon.sizeCategory === "super"
      ? 16
      : Math.min(totalRooms, randInt(rng, ...districtCountRange(dungeon.sizeCategory)));
  const openChambers = Math.max(1, Math.floor(minimumRooms / 8));
  const landmarkCount = dungeon.sizeCategory === "small"
    ? randInt(rng, 1, 2)
    : Math.max(2, Math.floor(totalRooms / (dungeon.sizeCategory === "super" ? 9 : 12)));
  const loopRate = dungeon.sizeCategory === "small" ? 0.12 : type.loopRate ?? 0.14;
  return { minimumRooms: scaledMinimum, maximumRooms, requestedRooms, totalRooms, openChambers, districtCount, landmarkCount, loopRate };
}

function minimumRoomCountForSize(sizeCategory, pixelWidth, pixelHeight) {
  if (sizeCategory === "small") return 6;
  if (sizeCategory === "medium") return 24;
  if (sizeCategory === "large") return 48;
  if (sizeCategory === "super") return 96;
  return Math.max(6, Math.floor(Math.min(pixelWidth, pixelHeight) / 100));
}

function districtCountRange(sizeCategory) {
  if (sizeCategory === "medium") return [4, 4];
  if (sizeCategory === "large") return [4, 4];
  if (sizeCategory === "super") return [16, 16];
  return [1, 1];
}

function makeFloorDistricts(dungeon, floorIndex, plan, rng) {
  const dungeonType = dungeon.dungeonType ?? DUNGEON_TYPES.lost_civilization;
  const theme = dungeon.theme ?? DUNGEON_THEMES.standard_dungeon;
  const typePool = dungeonType.districtTypes?.length ? dungeonType.districtTypes : DUNGEON_TYPES.lost_civilization.districtTypes;
  const themePool = theme.districtTypes?.length ? theme.districtTypes : [];
  const districtTypePool = [...typePool, ...typePool, ...themePool];
  if (dungeon.sizeCategory === "super") {
    return makeSuperLatticeDistricts(dungeon, floorIndex, plan, rng, districtTypePool);
  }
  const districts = [];
  const columns = Math.ceil(Math.sqrt(plan.districtCount));
  const rows = Math.ceil(plan.districtCount / columns);
  const typeGutter = dungeonType.districtGutter ?? 4;
  const margin = dungeon.sizeCategory === "small" ? 2 : Math.min(dungeon.sizeCategory === "medium" ? 4 : 6, typeGutter);
  const gutter = dungeon.sizeCategory === "small" ? 0 : Math.max(1, Math.floor(typeGutter / 3));
  const cellW = Math.floor((dungeon.wallGridWidth - margin * 2) / columns);
  const cellH = Math.floor((dungeon.wallGridHeight - margin * 2) / rows);
  const singleType = choose(rng, districtTypePool);

  for (let i = 0; i < plan.districtCount; i += 1) {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const type = chooseDistrictTypeForBlock(dungeon, districts, col, row, columns, singleType, districtTypePool, rng);
    const profile = DISTRICT_PROFILES[type] ?? DISTRICT_PROFILES.old_halls;
    const x = margin + col * cellW + gutter;
    const y = margin + row * cellH + gutter;
    const width = Math.max(8, (col === columns - 1 ? dungeon.wallGridWidth - x - margin : cellW) - gutter * 2);
    const height = Math.max(8, (row === rows - 1 ? dungeon.wallGridHeight - y - margin : cellH) - gutter * 2);
    districts.push({
      id: `district_${floorIndex}_${i + 1}`,
      floorIndex,
      blockCol: col,
      blockRow: row,
      type,
      label: profile.label,
      profile,
      x,
      y,
      width,
      height,
      roomTarget: Math.max(1, Math.round(plan.totalRooms / plan.districtCount)),
      landmarkTarget: i < plan.landmarkCount ? 1 : 0,
      tags: dungeon.sizeCategory === "small" ? ["single_theme_site"] : ["district"],
    });
  }
  return districts;
}

function makeSuperLatticeDistricts(dungeon, floorIndex, plan, rng, districtTypePool) {
  const lattice = superLatticeLayout(dungeon);
  if (!lattice) return [];
  const districts = [];
  const singleType = choose(rng, districtTypePool);
  for (let row = 0; row < SUPER_LATTICE.districtsPerSide; row += 1) {
    for (let col = 0; col < SUPER_LATTICE.districtsPerSide; col += 1) {
      const type = chooseDistrictTypeForBlock(dungeon, districts, col, row, SUPER_LATTICE.districtsPerSide, singleType, districtTypePool, rng);
      const profile = DISTRICT_PROFILES[type] ?? DISTRICT_PROFILES.old_halls;
      const x = lattice.origin + col * (SUPER_LATTICE.districtSize + SUPER_LATTICE.connectorSize);
      const y = lattice.origin + row * (SUPER_LATTICE.districtSize + SUPER_LATTICE.connectorSize);
      districts.push({
        id: `district_${floorIndex}_${districts.length + 1}`,
        floorIndex,
        blockCol: col,
        blockRow: row,
        type,
        label: profile.label,
        profile,
        x,
        y,
        width: SUPER_LATTICE.districtSize,
        height: SUPER_LATTICE.districtSize,
        roomTarget: Math.max(1, Math.round(plan.totalRooms / 16)),
        landmarkTarget: districts.length < plan.landmarkCount ? 1 : 0,
        tags: ["district", "super_lattice_district"],
      });
    }
  }
  return districts;
}

function chooseDistrictTypeForBlock(dungeon, districts, col, row, columns, singleType, districtTypePool, rng) {
  if (dungeon.sizeCategory === "small") return singleType;
  const dungeonType = dungeon.dungeonType ?? DUNGEON_TYPES.lost_civilization;
  const sameChance = dungeonType.sameNeighborChance ?? 0.4;
  const left = districts.find((district) => district.blockCol === col - 1 && district.blockRow === row);
  const above = districts.find((district) => district.blockCol === col && district.blockRow === row - 1);
  const neighbor = rng() < 0.55 ? left : above;
  if (neighbor && rng() < sameChance) return neighbor.type;
  return choose(rng, districtTypePool);
}

function chooseDistrictForRoom(rng, districts) {
  return weightedChoice(rng, districts.map((district) => ({
    ...district,
    weight: district.roomTarget + (district.landmarkTarget ? 1 : 0),
  })));
}

function makeFloorPrecincts(dungeon, floorIndex, districts, plan, rng) {
  const precincts = [];
  for (const district of districts) {
    const count = precinctCountForDistrict(dungeon, district);
    const slices = splitDistrictIntoPrecinctBounds(district, count, rng);
    for (let i = 0; i < slices.length; i += 1) {
      const blueprintKey = choosePrecinctBlueprintKey(district, rng);
      const blueprint = PRECINCT_BLUEPRINTS[blueprintKey] ?? PRECINCT_BLUEPRINTS.transition_hall;
      const roomTarget = Math.max(1, Math.round((district.roomTarget / slices.length) * (blueprint.roomDensity ?? 1)));
      const profile = {
        label: blueprint.label,
        eventLink: district.profile.eventLink,
        corridorEventLink: district.profile.corridorEventLink,
        templates: blueprint.templates?.length ? blueprint.templates : district.profile.templates,
        landmarks: blueprint.landmarks?.length ? blueprint.landmarks : district.profile.landmarks,
      };
      precincts.push({
        id: `precinct_${floorIndex}_${precincts.length + 1}`,
        precinctId: `precinct_${floorIndex}_${precincts.length + 1}`,
        floorIndex,
        districtId: district.id,
        districtType: district.type,
        districtLabel: district.label,
        type: blueprintKey,
        label: blueprint.label,
        profile,
        blueprint,
        connectionStyle: blueprint.connectionStyle ?? "compact_cluster",
        x: slices[i].x,
        y: slices[i].y,
        width: slices[i].width,
        height: slices[i].height,
        roomTarget,
        landmarkTarget: i === 0 && district.landmarkTarget > 0 ? 1 : 0,
        tags: [...new Set([...(district.tags ?? []), ...(blueprint.tags ?? [])])],
      });
    }
  }
  if (dungeon.sizeCategory === "super") {
    precincts.push(...makeSuperLatticeConnectorPrecincts(dungeon, floorIndex));
  }
  return precincts;
}

function makeSuperLatticeConnectorPrecincts(dungeon, floorIndex) {
  const lattice = superLatticeLayout(dungeon);
  if (!lattice) return [];
  const blueprint = PRECINCT_BLUEPRINTS.transition_hall;
  const profile = {
    label: "Connector Zone",
    eventLink: "standard_corridor",
    corridorEventLink: "standard_corridor",
    templates: ["long_gallery", "wide_hall", "small_room"],
    landmarks: ["pillared_hall", "watch_hall"],
  };
  const precincts = [];
  for (const unit of SUPER_LATTICE.connectorIndexes) {
    const coord = lattice.origin + unit * lattice.blockSize;
    precincts.push({
      id: `connector_${floorIndex}_v_${unit}`,
      precinctId: `connector_${floorIndex}_v_${unit}`,
      floorIndex,
      districtId: `connector_v_${unit}`,
      districtType: "connector_zone",
      districtLabel: "Connector Zone",
      type: "transition_hall",
      label: "Vertical Connector Zone",
      profile,
      blueprint,
      connectionStyle: "lattice_connector",
      x: coord,
      y: lattice.origin,
      width: SUPER_LATTICE.connectorSize,
      height: lattice.contentSize,
      roomTarget: 1,
      landmarkTarget: 0,
      tags: ["connector_zone", "super_lattice_connector"],
    });
    precincts.push({
      id: `connector_${floorIndex}_h_${unit}`,
      precinctId: `connector_${floorIndex}_h_${unit}`,
      floorIndex,
      districtId: `connector_h_${unit}`,
      districtType: "connector_zone",
      districtLabel: "Connector Zone",
      type: "transition_hall",
      label: "Horizontal Connector Zone",
      profile,
      blueprint,
      connectionStyle: "lattice_connector",
      x: lattice.origin,
      y: coord,
      width: lattice.contentSize,
      height: SUPER_LATTICE.connectorSize,
      roomTarget: 1,
      landmarkTarget: 0,
      tags: ["connector_zone", "super_lattice_connector"],
    });
  }
  return precincts;
}

function precinctCountForDistrict(dungeon, district) {
  if (dungeon.sizeCategory === "small") return 1;
  if (dungeon.sizeCategory === "medium") return 1;
  const area = district.width * district.height;
  if (dungeon.sizeCategory === "large") return area > 700 ? 2 : 1;
  return area > 900 ? 3 : 2;
}

function splitDistrictIntoPrecinctBounds(district, count, rng) {
  if (count <= 1) return [{ x: district.x, y: district.y, width: district.width, height: district.height }];
  const bounds = [];
  const vertical = district.width >= district.height;
  const gutter = 2;
  for (let i = 0; i < count; i += 1) {
    if (vertical) {
      const sliceW = Math.floor((district.width - gutter * (count - 1)) / count);
      const x = district.x + i * (sliceW + gutter);
      const width = i === count - 1 ? Math.max(6, district.x + district.width - x) : Math.max(6, sliceW);
      bounds.push({ x, y: district.y, width, height: district.height });
    } else {
      const sliceH = Math.floor((district.height - gutter * (count - 1)) / count);
      const y = district.y + i * (sliceH + gutter);
      const height = i === count - 1 ? Math.max(6, district.y + district.height - y) : Math.max(6, sliceH);
      bounds.push({ x: district.x, y, width: district.width, height });
    }
  }
  if (rng() < 0.35) bounds.reverse();
  return bounds;
}

function choosePrecinctBlueprintKey(district, rng) {
  const keys = PRECINCTS_BY_DISTRICT[district.type] ?? ["transition_hall", "pillared_hall", "dead_end_vault"];
  return choose(rng, keys);
}

function choosePrecinctForRoom(rng, precincts) {
  return weightedChoice(rng, precincts.map((precinct) => ({
    ...precinct,
    weight: precinct.roomTarget + (precinct.landmarkTarget ? 2 : 0),
  })));
}

function chooseRoomTemplate(rng, district) {
  const keys = district.profile.templates?.length ? district.profile.templates : ["small_room"];
  return weightedChoice(rng, keys.map((key) => ({ key, ...ROOM_TEMPLATES[key] })).filter((item) => item.label));
}

function chooseLandmarkTemplate(rng, district) {
  const keys = district.profile.landmarks?.length ? district.profile.landmarks : ["grand_hall"];
  return choose(rng, keys.map((key) => ({ key, ...LANDMARK_TEMPLATES[key] })).filter((item) => item.label));
}

function usesGeomorphAssembly(sizeCategory) {
  return sizeCategory === "medium" || sizeCategory === "large" || sizeCategory === "super";
}

function seedGeomorphs(dungeon, floorIndex, rng, rooms, precincts, plan) {
  if (dungeon.sizeCategory === "super") {
    return seedSuperLatticeGeomorphGrid(dungeon, floorIndex, rng, rooms, precincts, plan);
  }
  if (usesGeomorphAssembly(dungeon.sizeCategory)) {
    return seedGeomorphGrid(dungeon, floorIndex, rng, rooms, precincts, plan);
  }
  return seedGeomorphScatter(dungeon, floorIndex, rng, rooms, precincts, plan);
}

function seedSuperLatticeGeomorphGrid(dungeon, floorIndex, rng, rooms, precincts, plan) {
  const lattice = superLatticeLayout(dungeon);
  if (!lattice) return seedGeomorphGrid(dungeon, floorIndex, rng, rooms, precincts, plan);
  const occupied = new Map();
  const geomorphs = [];
  const usedKeys = [];

  for (const cell of shuffle(rng, superLatticeCells("district"))) {
    if (occupied.has(blockKey(cell.blockX, cell.blockY))) continue;
    const precinct = precinctForLatticeBlock(precincts, cell.blockX, cell.blockY, lattice);
    const wantsLandmark = rng() < 0.24 && superLatticeCanPlaceFootprint(occupied, cell.blockX, cell.blockY, 2, "district", lattice);
    const blueprint = chooseSuperLatticeBlueprint(rng, precinct, wantsLandmark ? 20 : 10, "normal", plan, usedKeys);
    if (!blueprint) continue;
    const transform = chooseExitMatchedTransform(rng, blueprint);
    if (!transform) continue;
    const footprintBlocks = geomorphFootprintBlocks(blueprint, lattice.blockSize);
    if (!superLatticeCanPlaceFootprint(occupied, cell.blockX, cell.blockY, footprintBlocks, "district", lattice)) continue;
    const placed = tryPlaceGeomorphAt(dungeon, floorIndex, rooms, precinct, blueprint, transform, lattice.origin + cell.blockX * lattice.blockSize, lattice.origin + cell.blockY * lattice.blockSize, rng, {
      blockX: cell.blockX,
      blockY: cell.blockY,
      blockWidth: footprintBlocks,
      blockHeight: footprintBlocks,
      parentId: null,
      latticeZone: "district",
    });
    if (!placed) continue;
    geomorphs.push(placed);
    rememberGeomorphKey(usedKeys, placed.blueprintKey);
    markGeomorphBlocks(occupied, placed);
  }

  for (const cell of shuffle(rng, superLatticeCells("connector"))) {
    if (occupied.has(blockKey(cell.blockX, cell.blockY))) continue;
    const precinct = precinctForLatticeBlock(precincts, cell.blockX, cell.blockY, lattice);
    const blueprint = chooseSuperLatticeBlueprint(rng, precinct, 10, "connector", plan, usedKeys);
    if (!blueprint) continue;
    const transform = chooseSuperConnectorTransform(rng, blueprint, cell);
    if (!transform) continue;
    const placed = tryPlaceGeomorphAt(dungeon, floorIndex, rooms, precinct, blueprint, transform, lattice.origin + cell.blockX * lattice.blockSize, lattice.origin + cell.blockY * lattice.blockSize, rng, {
      blockX: cell.blockX,
      blockY: cell.blockY,
      blockWidth: 1,
      blockHeight: 1,
      parentId: null,
      latticeZone: "connector",
    });
    if (!placed) continue;
    geomorphs.push(placed);
    rememberGeomorphKey(usedKeys, placed.blueprintKey);
    markGeomorphBlocks(occupied, placed);
  }

  return geomorphs;
}

function seedGeomorphScatter(dungeon, floorIndex, rng, rooms, precincts, plan) {
  if (!precincts.length) return [];
  const target = geomorphTargetForSize(dungeon.sizeCategory, precincts.length, plan);
  const geomorphs = [];
  const orderedPrecincts = nearestRoute([...precincts]);
  const flowState = { connectorStreak: 0, normalRun: 0, recentKeys: [] };
  let attempts = 0;
  while (geomorphs.length < target && attempts < target * 12) {
    attempts += 1;
    const precinct = choosePrecinctForGeomorph(rng, orderedPrecincts);
    const blueprint = chooseGeomorphBlueprint(rng, precinct, flowState);
    if (!blueprint) continue;
    const placed = tryPlaceGeomorph(dungeon, floorIndex, rng, rooms, precinct, blueprint);
    if (placed) {
      geomorphs.push(placed);
      updateGeomorphFlowState(flowState, placed);
    }
  }
  return geomorphs;
}

function seedGeomorphGrid(dungeon, floorIndex, rng, rooms, precincts, plan) {
  const blockSize = 10;
  const blockCols = Math.floor(dungeon.wallGridWidth / blockSize);
  const blockRows = Math.floor(dungeon.wallGridHeight / blockSize);
  const targetBlocks = geomorphBlockTargetForSize(dungeon.sizeCategory, blockCols, blockRows);
  const occupied = new Map();
  const geomorphs = [];
  const frontier = [];
  const flowState = { connectorStreak: 0, normalRun: 0, recentKeys: [] };
  let occupiedBlocks = 0;
  let attempts = 0;

  const startBlock = {
    blockX: Math.max(0, Math.floor(blockCols / 2)),
    blockY: Math.max(0, Math.floor(blockRows / 2)),
  };
  const startPrecinct = precinctForGridBlock(precincts, startBlock.blockX, startBlock.blockY, blockSize);
  const startBlueprint = chooseExitMatchedGeomorphBlueprint(rng, startPrecinct, flowState, null, plan);
  if (!startBlueprint) return [];
  const startTransform = chooseExitMatchedTransform(rng, startBlueprint);
  const startFootprintBlocks = geomorphFootprintBlocks(startBlueprint, blockSize);
  const startPlaced = tryPlaceGeomorphAt(dungeon, floorIndex, rooms, startPrecinct, startBlueprint, startTransform, startBlock.blockX * blockSize, startBlock.blockY * blockSize, rng, {
    blockX: startBlock.blockX,
    blockY: startBlock.blockY,
    blockWidth: startFootprintBlocks,
    blockHeight: startFootprintBlocks,
    parentId: null,
  });
  if (!startPlaced) return [];
  geomorphs.push(startPlaced);
  occupiedBlocks += startFootprintBlocks * startFootprintBlocks;
  markGeomorphBlocks(occupied, startPlaced);
  addExitFrontier(frontier, occupied, startPlaced, startBlueprint, startTransform, blockCols, blockRows);
  updateGeomorphFlowState(flowState, startPlaced);

  while (occupiedBlocks < targetBlocks && attempts < targetBlocks * 80) {
    attempts += 1;
    const frontierExit = chooseExitFrontier(rng, frontier, occupied, blockCols, blockRows);
    if (!frontierExit) {
      const clusterSeed = placeGeomorphClusterSeed(dungeon, floorIndex, rng, rooms, precincts, occupied, geomorphs, flowState, blockCols, blockRows, blockSize, plan);
      if (!clusterSeed) break;
      occupiedBlocks += clusterSeed.placed.blockWidth * clusterSeed.placed.blockHeight;
      addExitFrontier(frontier, occupied, clusterSeed.placed, clusterSeed.blueprint, clusterSeed.transform, blockCols, blockRows);
      continue;
    }
    const dir = DIR_BY_NAME[frontierExit.side];
    const targetBlockX = frontierExit.blockX + dir.dx;
    const targetBlockY = frontierExit.blockY + dir.dy;
    if (!gridFootprintIsFree(occupied, targetBlockX, targetBlockY, 1, 1, blockCols, blockRows)) continue;
    const precinct = precinctForGridBlock(precincts, targetBlockX, targetBlockY, blockSize);
    const requiredSocket = { side: dir.opposite, offset: frontierExit.offset, width: frontierExit.width };
    const blueprint = chooseExitMatchedGeomorphBlueprint(rng, precinct, flowState, requiredSocket, plan);
    if (!blueprint) continue;
    const transform = chooseExitMatchedTransform(rng, blueprint, requiredSocket);
    if (!transform) continue;
    const footprintBlocks = geomorphFootprintBlocks(blueprint, blockSize);
    const placement = geomorphPlacementForRequiredSocket(targetBlockX, targetBlockY, footprintBlocks, requiredSocket, blockSize);
    if (!gridFootprintIsFree(occupied, placement.blockX, placement.blockY, footprintBlocks, footprintBlocks, blockCols, blockRows)) continue;
    const placed = tryPlaceGeomorphAt(dungeon, floorIndex, rooms, precinct, blueprint, transform, placement.blockX * blockSize, placement.blockY * blockSize, rng, {
      blockX: placement.blockX,
      blockY: placement.blockY,
      blockWidth: footprintBlocks,
      blockHeight: footprintBlocks,
      parentId: frontierExit.geomorphId,
      attachedFrom: frontierExit.side,
      attachedTo: requiredSocket.side,
      attachedOffset: requiredSocket.offset,
    });
    if (!placed) continue;

    geomorphs.push(placed);
    occupiedBlocks += footprintBlocks * footprintBlocks;
    markGeomorphBlocks(occupied, placed);
    addExitFrontier(frontier, occupied, placed, blueprint, transform, blockCols, blockRows, requiredSocket);
    updateGeomorphFlowState(flowState, placed);
  }

  return geomorphs;
}

function placeGeomorphClusterSeed(dungeon, floorIndex, rng, rooms, precincts, occupied, geomorphs, flowState, blockCols, blockRows, blockSize, plan) {
  const seedBlock = chooseNewClusterBlock(rng, occupied, blockCols, blockRows);
  if (!seedBlock) return null;
  const precinct = precinctForGridBlock(precincts, seedBlock.blockX, seedBlock.blockY, blockSize);
  const blueprint = chooseExitMatchedGeomorphBlueprint(rng, precinct, flowState, null, plan);
  if (!blueprint) return null;
  const transform = chooseExitMatchedTransform(rng, blueprint);
  if (!transform) return null;
  const footprintBlocks = geomorphFootprintBlocks(blueprint, blockSize);
  if (!gridFootprintIsFree(occupied, seedBlock.blockX, seedBlock.blockY, footprintBlocks, footprintBlocks, blockCols, blockRows)) return null;
  const placed = tryPlaceGeomorphAt(dungeon, floorIndex, rooms, precinct, blueprint, transform, seedBlock.blockX * blockSize, seedBlock.blockY * blockSize, rng, {
    blockX: seedBlock.blockX,
    blockY: seedBlock.blockY,
    blockWidth: footprintBlocks,
    blockHeight: footprintBlocks,
    parentId: null,
    clusterSeed: true,
  });
  if (!placed) return null;
  geomorphs.push(placed);
  markGeomorphBlocks(occupied, placed);
  updateGeomorphFlowState(flowState, placed);
  return { placed, blueprint, transform };
}

function superLatticeLayout(dungeon) {
  const contentSize = SUPER_LATTICE.districtsPerSide * SUPER_LATTICE.districtSize
    + (SUPER_LATTICE.districtsPerSide - 1) * SUPER_LATTICE.connectorSize;
  if (dungeon.wallGridWidth < contentSize + SUPER_LATTICE.origin * 2 || dungeon.wallGridHeight < contentSize + SUPER_LATTICE.origin * 2) return null;
  return {
    ...SUPER_LATTICE,
    contentSize,
  };
}

function superLatticeCells(kind) {
  const cells = [];
  for (let blockY = 0; blockY < SUPER_LATTICE.unitsPerSide; blockY += 1) {
    for (let blockX = 0; blockX < SUPER_LATTICE.unitsPerSide; blockX += 1) {
      const zone = superLatticeZoneAt(blockX, blockY);
      if (kind === zone) cells.push({ blockX, blockY, zone, orientation: superLatticeConnectorOrientation(blockX, blockY) });
    }
  }
  return cells;
}

function superLatticeZoneAt(blockX, blockY) {
  const connectorX = SUPER_LATTICE.connectorIndexes.includes(blockX);
  const connectorY = SUPER_LATTICE.connectorIndexes.includes(blockY);
  return connectorX || connectorY ? "connector" : "district";
}

function superLatticeConnectorOrientation(blockX, blockY) {
  const connectorX = SUPER_LATTICE.connectorIndexes.includes(blockX);
  const connectorY = SUPER_LATTICE.connectorIndexes.includes(blockY);
  if (connectorX && connectorY) return "cross";
  return connectorX ? "vertical" : "horizontal";
}

function superLatticeCanPlaceFootprint(occupied, blockX, blockY, footprintBlocks, zone, lattice) {
  if (blockX < 0 || blockY < 0 || blockX + footprintBlocks > lattice.unitsPerSide || blockY + footprintBlocks > lattice.unitsPerSide) return false;
  for (let y = blockY; y < blockY + footprintBlocks; y += 1) {
    for (let x = blockX; x < blockX + footprintBlocks; x += 1) {
      if (occupied.has(blockKey(x, y)) || superLatticeZoneAt(x, y) !== zone) return false;
    }
  }
  return true;
}

function precinctForLatticeBlock(precincts, blockX, blockY, lattice) {
  const x = lattice.origin + blockX * lattice.blockSize + Math.floor(lattice.blockSize / 2);
  const y = lattice.origin + blockY * lattice.blockSize + Math.floor(lattice.blockSize / 2);
  return precincts.find((precinct) => x >= precinct.x && x < precinct.x + precinct.width && y >= precinct.y && y < precinct.y + precinct.height)
    ?? precincts[0];
}

function chooseSuperLatticeBlueprint(rng, precinct, size, kind, plan, recentKeys = []) {
  const candidates = STANDARD_GEOMORPH_LIBRARY
    .filter((blueprint) => (blueprint.size ?? 10) === size)
    .filter((blueprint) => kind === "connector" ? blueprint.kind === "connector" : blueprint.kind !== "connector")
    .filter((blueprint) => kind === "connector" || geomorphMatchesPrecinct(blueprint, precinct))
    .map((blueprint) => normalizeStandardGeomorphBlueprint(blueprint));
  const recent = new Set(recentKeys.slice(0, 4));
  const varied = candidates.filter((blueprint) => !recent.has(blueprint.key));
  const pool = (varied.length ? varied : candidates).map((blueprint) => ({
    ...blueprint,
    weight: (blueprint.weight ?? 5)
      * (kind === "connector" ? 1.15 : 1.35)
      * geomorphThemeWeight(blueprint, plan)
      * (recentKeys.includes(blueprint.key) ? 0.15 : 1),
  }));
  return pool.length ? weightedChoice(rng, pool) : null;
}

function chooseSuperConnectorTransform(rng, blueprint, cell) {
  const transforms = exitMatchedTransforms(blueprint);
  const preferred = transforms.filter((transform) => {
    const sides = transformedExitSides(blueprint, transform);
    if (cell.orientation === "horizontal") return sides.includes("west") && sides.includes("east");
    if (cell.orientation === "vertical") return sides.includes("north") && sides.includes("south");
    return sides.length >= 3 || (sides.includes("north") && sides.includes("south") && sides.includes("east") && sides.includes("west"));
  });
  return choose(rng, preferred.length ? preferred : transforms);
}

function rememberGeomorphKey(keys, key) {
  keys.unshift(key);
  keys.splice(8);
}

function chooseNewClusterBlock(rng, occupied, blockCols, blockRows) {
  const candidates = [];
  const margin = 1;
  for (let y = margin; y < blockRows - margin; y += 1) {
    for (let x = margin; x < blockCols - margin; x += 1) {
      if (occupied.has(blockKey(x, y))) continue;
      const nearOccupied = countOccupiedBlocksNear(occupied, x, y, 4);
      const adjacentOccupied = hasOccupiedNeighbor(occupied, x, y);
      candidates.push({
        blockX: x,
        blockY: y,
        weight: adjacentOccupied ? 0.25 : Math.max(1, 6 - nearOccupied),
      });
    }
  }
  return candidates.length ? weightedChoice(rng, candidates) : null;
}

function countOccupiedBlocksNear(occupied, blockX, blockY, radius) {
  let count = 0;
  for (let y = blockY - radius; y <= blockY + radius; y += 1) {
    for (let x = blockX - radius; x <= blockX + radius; x += 1) {
      if (occupied.has(blockKey(x, y))) count += 1;
    }
  }
  return count;
}

function geomorphBlockTargetForSize(sizeCategory, blockCols, blockRows) {
  const available = blockCols * blockRows;
  if (sizeCategory === "medium") return Math.min(available, Math.max(10, Math.floor(available * 0.7)));
  if (sizeCategory === "large") return Math.min(available, Math.max(44, Math.floor(available * 0.68)));
  return Math.min(available, Math.max(150, Math.floor(available * 0.56)));
}

function geomorphFootprintBlocks(blueprint, blockSize = 10) {
  return Math.max(1, Math.ceil((blueprint.size ?? blockSize) / blockSize));
}

function geomorphPlacementForRequiredSocket(targetBlockX, targetBlockY, footprintBlocks, requiredSocket, blockSize = 10) {
  const lane = Math.floor((requiredSocket.offset ?? 0) / blockSize);
  if (requiredSocket.side === "west") {
    return { blockX: targetBlockX, blockY: targetBlockY - lane };
  }
  if (requiredSocket.side === "east") {
    return { blockX: targetBlockX - footprintBlocks + 1, blockY: targetBlockY - lane };
  }
  if (requiredSocket.side === "north") {
    return { blockX: targetBlockX - lane, blockY: targetBlockY };
  }
  return { blockX: targetBlockX - lane, blockY: targetBlockY - footprintBlocks + 1 };
}

function chooseExitMatchedGeomorphBlueprint(rng, precinct, flowState = { connectorStreak: 0, normalRun: 0, recentKeys: [] }, requiredSocket = null, plan = null) {
  const candidates = STANDARD_GEOMORPH_LIBRARY
    .filter((blueprint) => blueprint.size === 10 || (blueprint.size === 20 && flowState.normalRun >= 2 && flowState.connectorStreak === 0))
    .filter((blueprint) => geomorphMatchesPrecinct(blueprint, precinct))
    .map((blueprint) => normalizeStandardGeomorphBlueprint(blueprint))
    .filter((blueprint) => !requiredSocket || exitMatchedTransforms(blueprint, requiredSocket).length);
  const connectorChance = flowState.connectorStreak >= 2
    ? 0
    : flowState.normalRun >= 4
      ? 0.38
      : 0.16;
  const wantsConnector = rng() < connectorChance;
  const preferred = candidates.filter((item) => item.tags?.includes("connector") === wantsConnector);
  const fallback = candidates.filter((item) => item.tags?.includes("connector") !== wantsConnector);
  const sourcePool = preferred.length ? preferred : fallback;
  const recentBlock = new Set((flowState.recentKeys ?? []).slice(0, 3));
  const variedPool = sourcePool.filter((blueprint) => !recentBlock.has(blueprint.key));
  const pool = (variedPool.length ? variedPool : sourcePool).map((blueprint) => ({
    ...blueprint,
    weight: (blueprint.weight ?? 5)
      * (blueprint.tags?.includes("connector") ? 0.65 : 1.7)
      * (flowState.recentKeys?.includes(blueprint.key) ? 0.08 : 1)
      * geomorphThemeWeight(blueprint, plan)
      * Math.max(1, transformedExitSides(blueprint, { rotation: 0, mirrored: false }).length / 2),
  }));
  return pool.length ? weightedChoice(rng, pool) : null;
}

function geomorphThemeWeight(blueprint, plan) {
  const families = plan?.themeInfluences?.geomorphFamilies ?? [];
  if (!families.length) return 1;
  const tokens = new Set([
    blueprint.category,
    ...(blueprint.tags ?? []),
    ...String(blueprint.key ?? "").split(/[_-]+/),
    ...String(blueprint.label ?? "").toLowerCase().split(/[^a-z0-9]+/),
  ].filter(Boolean).map((item) => String(item).toLowerCase()));
  const matches = families.filter((family) => tokens.has(String(family).toLowerCase())).length;
  if (matches >= 2) return 2.25;
  if (matches === 1) return 1.65;
  if (blueprint.tags?.includes("connector")) return 0.9;
  return 0.72;
}

function chooseExitMatchedTransform(rng, blueprint, requiredSocket = null) {
  const transforms = exitMatchedTransforms(blueprint, requiredSocket);
  return transforms.length ? choose(rng, transforms) : null;
}

function exitMatchedTransforms(blueprint, requiredSocket = null) {
  const transforms = [];
  for (const rotation of [0, 90, 180, 270]) {
    for (const mirrored of [false, true]) {
      const transform = { rotation, mirrored };
      const sockets = transformedExitSockets(blueprint, transform);
      if (!requiredSocket || sockets.some((socket) => socket.side === requiredSocket.side && socket.offset === requiredSocket.offset)) {
        transforms.push(transform);
      }
    }
  }
  return transforms;
}

function transformedExitSides(blueprint, transform) {
  return [...new Set(transformedExitSockets(blueprint, transform).map((socket) => socket.side))];
}

function transformedExitSockets(blueprint, transform) {
  return uniqueSockets(geomorphExitSockets(blueprint).map((socket) => transformSocket(socket, blueprint, transform)));
}

function geomorphExitSockets(blueprint) {
  if (blueprint.sockets?.length) {
    return blueprint.sockets.map((socket) => normalizeSocket(socket, blueprint.size));
  }
  const sockets = [];
  for (const side of blueprint.exits ?? []) {
    sockets.push({ side, offset: fallbackSocketOffset(side, blueprint.size), width: 2 });
  }
  return sockets;
}

function normalizeSocket(socket, size = 10) {
  const width = Math.max(1, Math.min(2, socket.width ?? 2));
  const offset = Math.max(0, Math.min(size - width, socket.offset ?? fallbackSocketOffset(socket.side, size)));
  return { side: socket.side, offset, width };
}

function fallbackSocketOffset(side, size = 10) {
  const allowed = GEOMORPH_SOCKET_OFFSETS[size] ?? GEOMORPH_SOCKET_OFFSETS[10];
  if (size === 20) return side === "north" || side === "west" ? allowed[1] : allowed[2];
  return side === "north" || side === "west" ? allowed[0] : allowed[1];
}

function transformSocket(socket, blueprint, transform) {
  const size = blueprint.size;
  let side = socket.side;
  let offset = socket.offset;
  if (transform.mirrored) {
    if (side === "east" || side === "west") {
      side = DIR_BY_NAME[side].opposite;
    } else {
      offset = size - socket.offset - socket.width;
    }
  }
  const turns = ((transform.rotation ?? 0) / 90) % 4;
  for (let i = 0; i < turns; i += 1) {
    if (side === "north") {
      side = "east";
    } else if (side === "east") {
      side = "south";
      offset = size - offset - socket.width;
    } else if (side === "south") {
      side = "west";
    } else {
      side = "north";
      offset = size - offset - socket.width;
    }
  }
  return { side, offset, width: socket.width };
}

function uniqueSockets(sockets) {
  const seen = new Set();
  return sockets.filter((socket) => {
    const key = `${socket.side}:${socket.offset}:${socket.width}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function addExitFrontier(frontier, occupied, geomorph, blueprint, transform, blockCols, blockRows, usedSide = null) {
  const blockSize = 10;
  for (const socket of transformedExitSockets(blueprint, transform)) {
    if (socket.side === usedSide?.side && socket.offset % blockSize === usedSide?.offset) continue;
    const dir = DIR_BY_NAME[socket.side];
    const lane = Math.floor(socket.offset / blockSize);
    const edgeBlockX = socket.side === "east"
      ? geomorph.blockX + geomorph.blockWidth - 1
      : socket.side === "west"
        ? geomorph.blockX
        : geomorph.blockX + lane;
    const edgeBlockY = socket.side === "south"
      ? geomorph.blockY + geomorph.blockHeight - 1
      : socket.side === "north"
        ? geomorph.blockY
        : geomorph.blockY + lane;
    const blockX = edgeBlockX + dir.dx;
    const blockY = edgeBlockY + dir.dy;
    if (blockX < 0 || blockY < 0 || blockX >= blockCols || blockY >= blockRows) continue;
    if (occupied.has(blockKey(blockX, blockY))) continue;
    frontier.push({
      geomorphId: geomorph.id,
      blockX: edgeBlockX,
      blockY: edgeBlockY,
      side: socket.side,
      offset: socket.offset % blockSize,
      width: socket.width,
    });
  }
}

function chooseExitFrontier(rng, frontier, occupied, blockCols, blockRows) {
  while (frontier.length) {
    const index = Math.floor(rng() * frontier.length);
    const item = frontier.splice(index, 1)[0];
    const dir = DIR_BY_NAME[item.side];
    const blockX = item.blockX + dir.dx;
    const blockY = item.blockY + dir.dy;
    if (blockX < 0 || blockY < 0 || blockX >= blockCols || blockY >= blockRows) continue;
    if (occupied.has(blockKey(blockX, blockY))) continue;
    return item;
  }
  return null;
}

function chooseGridAnchor(rng, frontier, occupied, blockCols, blockRows) {
  while (frontier.length) {
    const index = Math.floor(rng() * frontier.length);
    const candidate = frontier.splice(index, 1)[0];
    if (!occupied.has(blockKey(candidate.blockX, candidate.blockY))) return candidate;
  }
  const free = [];
  for (let y = 0; y < blockRows; y += 1) {
    for (let x = 0; x < blockCols; x += 1) {
      if (!occupied.has(blockKey(x, y)) && hasOccupiedNeighbor(occupied, x, y)) free.push({ blockX: x, blockY: y });
    }
  }
  return free.length ? choose(rng, free) : null;
}

function findGridPlacement(rng, anchor, footprintBlocks, occupied, blockCols, blockRows) {
  const offsets = footprintBlocks === 1
    ? [{ x: 0, y: 0 }]
    : shuffle(rng, [
      { x: 0, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: -1 },
      { x: -1, y: -1 },
    ]);
  for (const offset of offsets) {
    const blockX = anchor.blockX + offset.x;
    const blockY = anchor.blockY + offset.y;
    if (gridFootprintIsFree(occupied, blockX, blockY, footprintBlocks, footprintBlocks, blockCols, blockRows)) {
      return { blockX, blockY };
    }
  }
  return null;
}

function gridFootprintIsFree(occupied, blockX, blockY, width, height, blockCols, blockRows) {
  if (blockX < 0 || blockY < 0 || blockX + width > blockCols || blockY + height > blockRows) return false;
  for (let y = blockY; y < blockY + height; y += 1) {
    for (let x = blockX; x < blockX + width; x += 1) {
      if (occupied.has(blockKey(x, y))) return false;
    }
  }
  return true;
}

function markGeomorphBlocks(occupied, geomorph) {
  for (let y = geomorph.blockY; y < geomorph.blockY + geomorph.blockHeight; y += 1) {
    for (let x = geomorph.blockX; x < geomorph.blockX + geomorph.blockWidth; x += 1) {
      occupied.set(blockKey(x, y), geomorph);
    }
  }
}

function addGridFrontier(frontier, occupied, geomorph, blockCols, blockRows) {
  for (let y = geomorph.blockY - 1; y <= geomorph.blockY + geomorph.blockHeight; y += 1) {
    for (let x = geomorph.blockX - 1; x <= geomorph.blockX + geomorph.blockWidth; x += 1) {
      const onEdge = x === geomorph.blockX - 1 || x === geomorph.blockX + geomorph.blockWidth || y === geomorph.blockY - 1 || y === geomorph.blockY + geomorph.blockHeight;
      if (!onEdge || x < 0 || y < 0 || x >= blockCols || y >= blockRows) continue;
      if (!occupied.has(blockKey(x, y))) frontier.push({ blockX: x, blockY: y });
    }
  }
}

function findAdjacentGeomorphForPlacement(occupied, blockX, blockY, footprintBlocks) {
  const neighbors = [];
  for (let x = blockX; x < blockX + footprintBlocks; x += 1) {
    neighbors.push(occupied.get(blockKey(x, blockY - 1)));
    neighbors.push(occupied.get(blockKey(x, blockY + footprintBlocks)));
  }
  for (let y = blockY; y < blockY + footprintBlocks; y += 1) {
    neighbors.push(occupied.get(blockKey(blockX - 1, y)));
    neighbors.push(occupied.get(blockKey(blockX + footprintBlocks, y)));
  }
  return neighbors.find(Boolean) ?? null;
}

function hasOccupiedNeighbor(occupied, blockX, blockY) {
  return occupied.has(blockKey(blockX - 1, blockY))
    || occupied.has(blockKey(blockX + 1, blockY))
    || occupied.has(blockKey(blockX, blockY - 1))
    || occupied.has(blockKey(blockX, blockY + 1));
}

function precinctForGridBlock(precincts, blockX, blockY, blockSize) {
  const x = blockX * blockSize + Math.floor(blockSize / 2);
  const y = blockY * blockSize + Math.floor(blockSize / 2);
  return precincts.find((precinct) => x >= precinct.x && x < precinct.x + precinct.width && y >= precinct.y && y < precinct.y + precinct.height)
    ?? precincts[0];
}

function blockKey(x, y) {
  return `${x},${y}`;
}

function geomorphTargetForSize(sizeCategory, precinctCount, plan) {
  if (sizeCategory === "small") return 2;
  if (sizeCategory === "medium") return Math.max(6, Math.floor(plan.minimumRooms / 3));
  if (sizeCategory === "large") return Math.max(22, Math.floor(plan.minimumRooms / 2));
  return Math.max(54, Math.floor(plan.minimumRooms * 0.62));
}

function choosePrecinctForGeomorph(rng, precincts) {
  return weightedChoice(rng, precincts.map((precinct) => ({
    ...precinct,
    weight: Math.max(1, precinct.width * precinct.height * (precinct.blueprint?.roomDensity ?? 1)),
  })));
}

function chooseGeomorphBlueprint(rng, precinct, flowState = { connectorStreak: 0, normalRun: 0 }) {
  const candidates = STANDARD_GEOMORPH_LIBRARY
    .filter((blueprint) => geomorphMatchesPrecinct(blueprint, precinct))
    .map((blueprint) => normalizeStandardGeomorphBlueprint(blueprint));
  const connectorChance = flowState.connectorStreak >= 2
    ? 0
    : flowState.normalRun >= 3
      ? 0.45
      : 0.18;
  const wantsConnector = rng() < connectorChance;
  const preferred = candidates.filter((item) => item.tags?.includes("connector") === wantsConnector);
  const fallback = candidates.filter((item) => item.tags?.includes("connector") !== wantsConnector);
  if (flowState.connectorStreak >= 2 && !preferred.length) return null;
  const sourcePool = preferred.length ? preferred : fallback;
  const recentBlock = new Set((flowState.recentKeys ?? []).slice(0, 2));
  const variedPool = sourcePool.filter((blueprint) => !recentBlock.has(blueprint.key));
  const pool = (variedPool.length ? variedPool : sourcePool).map((blueprint) => ({
    ...blueprint,
    weight: (blueprint.weight ?? 5)
      * (blueprint.tags?.includes("connector") ? 0.45 : 1.8)
      * (flowState.recentKeys?.includes(blueprint.key) ? 0.05 : 1),
  }));
  if (!pool.length) return null;
  return weightedChoice(rng, pool);
}

function normalizeStandardGeomorphBlueprint(blueprint) {
  return {
    ...blueprint,
    width: blueprint.size,
    height: blueprint.size,
    weight: blueprint.kind === "connector"
      ? blueprint.size === 20 ? 2 : 4
      : blueprint.size === 20 ? 3 : 8,
    tags: [...new Set([...(blueprint.tags ?? []), blueprint.kind, "geomorph"])],
  };
}

function geomorphMatchesPrecinct(blueprint, precinct) {
  if (blueprint.kind === "connector") return true;
  const categories = GEOMORPH_CATEGORY_BY_PRECINCT[precinct.type] ?? GEOMORPH_CATEGORY_BY_PRECINCT.old_halls;
  return categories.includes(blueprint.category) || blueprint.tags?.some((tag) => categories.includes(tag));
}

const GEOMORPH_CATEGORY_BY_PRECINCT = {
  tomb_grid: ["tombs", "religious"],
  crypt_gallery: ["tombs", "religious"],
  shrine_complex: ["religious", "tombs", "architectural"],
  ritual_axis: ["religious", "arcane", "architectural"],
  pillared_hall: ["architectural", "religious", "trade"],
  barracks_block: ["living", "military", "prison"],
  living_quarters: ["living", "trade"],
  workshop_cluster: ["workshops", "infrastructure", "arcane"],
  transition_hall: ["architectural", "ruins", "cavern"],
  dead_end_vault: ["treasure", "tombs", "military", "arcane"],
  cavern_pockets: ["cavern", "ruins", "infrastructure"],
  ruined_quarter: ["ruins", "cavern", "architectural"],
  old_halls: ["architectural", "religious", "living", "workshops", "trade", "ruins"],
  guard_post: ["military", "prison", "living", "architectural"],
  barracks: ["living", "military"],
  armory: ["military", "workshops", "treasure"],
  library_archives: ["knowledge", "arcane", "architectural"],
  noble_quarters: ["living", "trade", "architectural"],
  storage: ["workshops", "trade", "treasure", "infrastructure"],
  shrine: ["religious", "tombs", "architectural"],
  tombs: ["tombs", "religious"],
  ossuary: ["tombs", "prison", "religious"],
  sealed_vaults: ["treasure", "tombs", "military", "arcane"],
  ruined_halls: ["ruins", "architectural", "cavern"],
  flooded_halls: ["infrastructure", "cavern", "living"],
  cistern: ["infrastructure", "cavern", "living"],
  occult_sanctum: ["arcane", "religious", "tombs"],
  summoning_halls: ["arcane", "religious", "hazard"],
  cavern_edge: ["cavern", "ruins", "infrastructure"],
};

function updateGeomorphFlowState(flowState, geomorph) {
  flowState.recentKeys = [geomorph.blueprintKey, ...(flowState.recentKeys ?? [])].slice(0, 5);
  if (geomorph.tags?.includes("connector")) {
    flowState.connectorStreak += 1;
    flowState.normalRun = 0;
    return;
  }
  flowState.connectorStreak = 0;
  flowState.normalRun += 1;
}

function tryPlaceGeomorph(dungeon, floorIndex, rng, rooms, precinct, blueprint) {
  for (let attempt = 0; attempt < 35; attempt += 1) {
    const transform = chooseGeomorphTransform(rng);
    const footprint = geomorphFootprint(blueprint, transform);
    if (footprint.width > precinct.width - 2 || footprint.height > precinct.height - 2) continue;
    const x = randInt(rng, precinct.x + 1, precinct.x + precinct.width - footprint.width - 1);
    const y = randInt(rng, precinct.y + 1, precinct.y + precinct.height - footprint.height - 1);
    const candidateRooms = blueprint.rooms.map((part) => geomorphRoomRect(part, blueprint, transform, x, y));
    const candidateCorridors = (blueprint.corridors ?? []).map((part) => geomorphRoomRect(part, blueprint, transform, x, y));
    const candidateAreas = [...candidateRooms, ...candidateCorridors];
    if (!candidateRooms.every((room) => roomFitsPrecinct(room, precinct))) continue;
    if (!candidateCorridors.every((corridor) => rectFitsPrecinct(corridor, precinct))) continue;
    if (!candidateRooms.every((room) => rooms.every((other) => !rectsOverlap(bufferRect(room, 1), bufferRect(other, 0))))) continue;
    if (!candidateAreas.every((area) => geomorphAreaIsClear(dungeon, floorIndex, area))) continue;

    const geomorphId = `geomorph_${floorIndex}_${dungeon.floors[floorIndex].geomorphs?.length ?? 0}_${rooms.length + 1}`;
    const createdRooms = candidateRooms.map((room, index) => createRoomFromGeomorph(dungeon, floorIndex, rooms, precinct, blueprint, room, index, geomorphId));
    const corridorIds = carveGeomorphCorridors(dungeon, floorIndex, blueprint, candidateCorridors, geomorphId, precinct);
    carveGeomorphSocketStubs(dungeon, floorIndex, blueprint, transform, x, y, geomorphId, corridorIds, precinct);
    for (const room of createdRooms) {
      rooms.push(room);
      carveRoom(dungeon, room);
    }
    addGeomorphInternalDoors(dungeon, createdRooms, blueprint, transform, corridorIds);
    ensureGeomorphRoomAccess(dungeon, createdRooms, corridorIds, precinct);
    connectRoomCluster(dungeon, createdRooms, rng);
    return {
      id: geomorphId,
      floorIndex,
      precinctId: precinct.id,
      precinctType: precinct.type,
      label: blueprint.label,
      blueprintKey: blueprint.key,
      x,
      y,
      width: footprint.width,
      height: footprint.height,
      rotation: transform.rotation,
      mirrored: transform.mirrored,
      roomIds: createdRooms.map((room) => room.id),
      corridorIds,
      tags: blueprint.tags ?? ["geomorph"],
    };
  }
  return null;
}

function tryPlaceGeomorphAt(dungeon, floorIndex, rooms, precinct, blueprint, transform, x, y, rng, blockInfo = {}) {
  const footprint = geomorphFootprint(blueprint, transform);
  if (x < 0 || y < 0 || x + footprint.width > dungeon.wallGridWidth || y + footprint.height > dungeon.wallGridHeight) return null;
  const candidateRooms = blueprint.rooms.map((part) => geomorphRoomRect(part, blueprint, transform, x, y));
  const candidateCorridors = (blueprint.corridors ?? []).map((part) => geomorphRoomRect(part, blueprint, transform, x, y));
  const candidateAreas = [...candidateRooms, ...candidateCorridors];
  if (!candidateAreas.every((area) => geomorphAreaIsClearExact(dungeon, floorIndex, area))) return null;
  if (!candidateRooms.every((room) => rooms.every((other) => !rectsOverlap(room, other)))) return null;

  const geomorphId = `geomorph_${floorIndex}_${rooms.length + 1}`;
  const createdRooms = candidateRooms.map((room, index) => createRoomFromGeomorph(dungeon, floorIndex, rooms, precinct, blueprint, room, index, geomorphId));
  const corridorIds = carveGeomorphCorridors(dungeon, floorIndex, blueprint, candidateCorridors, geomorphId, precinct);
  carveGeomorphSocketStubs(dungeon, floorIndex, blueprint, transform, x, y, geomorphId, corridorIds, precinct);
  for (const room of createdRooms) {
    rooms.push(room);
    carveRoom(dungeon, room);
  }
  addGeomorphInternalDoors(dungeon, createdRooms, blueprint, transform, corridorIds);
  ensureGeomorphRoomAccess(dungeon, createdRooms, corridorIds, precinct);
  connectRoomCluster(dungeon, createdRooms, rng);
  return {
    id: geomorphId,
    floorIndex,
    precinctId: precinct.id,
    precinctType: precinct.type,
    label: blueprint.label,
    blueprintKey: blueprint.key,
    x,
    y,
    width: footprint.width,
    height: footprint.height,
    rotation: transform.rotation,
    mirrored: transform.mirrored,
    roomIds: createdRooms.map((room) => room.id),
    corridorIds,
    tags: blueprint.tags ?? ["geomorph"],
    ...blockInfo,
  };
}

function geomorphAreaIsClearExact(dungeon, floorIndex, area) {
  const floor = dungeon.floors[floorIndex];
  for (let y = area.y; y < area.y + area.height; y += 1) {
    for (let x = area.x; x < area.x + area.width; x += 1) {
      const cell = floor.wallGrid[y]?.[x];
      if (!cell || cell.walkable) return false;
    }
  }
  return true;
}

function chooseGeomorphTransform(rng) {
  return {
    rotation: choose(rng, [0, 90, 180, 270]),
    mirrored: rng() < 0.5,
  };
}

function geomorphFootprint(blueprint, transform) {
  return transform.rotation === 90 || transform.rotation === 270
    ? { width: blueprint.height, height: blueprint.width }
    : { width: blueprint.width, height: blueprint.height };
}

function geomorphRoomRect(part, blueprint, transform, originX, originY) {
  let x = transform.mirrored
    ? blueprint.width - part.x - part.width
    : part.x;
  let y = part.y;
  let width = part.width;
  let height = part.height;
  const sourceW = blueprint.width;
  const sourceH = blueprint.height;

  if (transform.rotation === 90) {
    return {
      ...part,
      x: originX + y,
      y: originY + sourceW - x - width,
      width: height,
      height: width,
    };
  }
  if (transform.rotation === 180) {
    return {
      ...part,
      x: originX + sourceW - x - width,
      y: originY + sourceH - y - height,
      width,
      height,
    };
  }
  if (transform.rotation === 270) {
    return {
      ...part,
      x: originX + sourceH - y - height,
      y: originY + x,
      width: height,
      height: width,
    };
  }
  return { ...part, x: originX + x, y: originY + y, width, height };
}

function roomFitsPrecinct(room, precinct) {
  return room.x >= precinct.x + 1
    && room.y >= precinct.y + 1
    && room.x + room.width <= precinct.x + precinct.width - 1
    && room.y + room.height <= precinct.y + precinct.height - 1;
}

function rectFitsPrecinct(rect, precinct) {
  return rect.x >= precinct.x
    && rect.y >= precinct.y
    && rect.x + rect.width <= precinct.x + precinct.width
    && rect.y + rect.height <= precinct.y + precinct.height;
}

function geomorphAreaIsClear(dungeon, floorIndex, area) {
  const floor = dungeon.floors[floorIndex];
  for (let y = area.y - 1; y < area.y + area.height + 1; y += 1) {
    for (let x = area.x - 1; x < area.x + area.width + 1; x += 1) {
      const cell = floor.wallGrid[y]?.[x];
      if (!cell) return false;
      if (cell.walkable) return false;
    }
  }
  return true;
}

function carveGeomorphCorridors(dungeon, floorIndex, blueprint, corridorRects, geomorphId, precinct) {
  const corridorIds = [];
  corridorRects.forEach((corridor, index) => {
    const corridorId = `${geomorphId}_corridor_${index + 1}`;
    const cells = [];
    for (let y = corridor.y; y < corridor.y + corridor.height; y += 1) {
      for (let x = corridor.x; x < corridor.x + corridor.width; x += 1) {
        const cell = getCell(dungeon, floorIndex, x, y);
        if (!cell || cell.spaceType === "room") continue;
      cell.walkable = true;
      cell.spaceType = "corridor";
      cell.corridorId = corridorId;
      cell.geomorphId = geomorphId;
      cell.eventLink = precinct.profile.corridorEventLink ?? "standard_corridor";
        cell.revealed = false;
        cell.labels = [...new Set([...cell.labels, "geomorph_corridor", corridor.role ?? "passage"])];
        cells.push([x, y]);
      }
    }
    if (cells.length) {
      corridorIds.push(corridorId);
      dungeon.corridors.push({
        id: corridorId,
        floorIndex,
        cells,
        width: Math.min(corridor.width, corridor.height),
        kind: "geomorph_internal",
        eventLink: precinct.profile.corridorEventLink ?? "standard_corridor",
        geomorphId,
        blueprintKey: blueprint.key,
      });
    }
  });
  return corridorIds;
}

function carveGeomorphSocketStubs(dungeon, floorIndex, blueprint, transform, originX, originY, geomorphId, corridorIds, precinct) {
  const sockets = transformedExitSockets(blueprint, transform);
  for (const socket of sockets) {
    const corridorId = `${geomorphId}_socket_${socket.side}_${socket.offset}`;
    const cells = [];
    const line = socketStubLine(originX, originY, blueprint.size, socket);
    carveCorridorLine(dungeon, floorIndex, line.x1, line.y1, line.x2, line.y2, corridorId, cells, precinct.profile.corridorEventLink ?? "standard_corridor", {
      geomorphId,
      socket: true,
    });
    if (cells.length) {
      corridorIds.push(corridorId);
      dungeon.corridors.push({
        id: corridorId,
        floorIndex,
        cells,
        width: socket.width,
        kind: "geomorph_socket",
        eventLink: precinct.profile.corridorEventLink ?? "standard_corridor",
        geomorphId,
        socket,
      });
    }
  }
}

function socketStubLine(originX, originY, size, socket) {
  const inset = Math.min(4, Math.floor(size / 2));
  if (socket.side === "north") {
    const x = originX + socket.offset;
    return { x1: x, y1: originY, x2: x, y2: originY + inset };
  }
  if (socket.side === "south") {
    const x = originX + socket.offset;
    return { x1: x, y1: originY + size - socket.width, x2: x, y2: originY + size - inset - 1 };
  }
  if (socket.side === "west") {
    const y = originY + socket.offset;
    return { x1: originX, y1: y, x2: originX + inset, y2: y };
  }
  const y = originY + socket.offset;
  return { x1: originX + size - socket.width, y1: y, x2: originX + size - inset - 1, y2: y };
}

function addGeomorphInternalDoors(dungeon, createdRooms, blueprint, transform) {
  const roomByOriginalId = new Map(createdRooms.map((room) => [room.originalGeomorphRoomId, room]));
  for (const doorSpec of blueprint.doors ?? []) {
    const room = roomByOriginalId.get(doorSpec.from);
    if (!room) continue;
    const wall = transformSide(doorSpec.side, transform);
    const point = findGeomorphDoorPoint(dungeon, room, wall);
    if (!point) continue;
    const kind = doorSpec.kind === "secret" ? "secret" : doorSpec.kind === "open_chamber" ? "open_chamber" : "normal";
    const door = makeDoorRecord(dungeon, room, point, point.corridorId, kind);
    if (doorSpec.kind === "locked") {
      door.locked = true;
      door.lockType = "generic_key_or_pick";
      door.forcedLocked = true;
    }
    room.doors.push(door);
    if (kind === "open_chamber") room.tags = [...new Set([...room.tags, "open_chamber"])];
    dungeon.doors.push(door);
  }
}

function ensureGeomorphRoomAccess(dungeon, createdRooms, corridorIds, precinct) {
  for (const room of createdRooms) {
    if (room.doors.length) continue;
    let point = findAnyGeomorphDoorPoint(dungeon, room);
    if (!point) point = carveAccessToNearestGeomorphCorridor(dungeon, room, corridorIds, precinct);
    if (!point) continue;
    const door = makeDoorRecord(dungeon, room, point, point.corridorId, "normal");
    room.doors.push(door);
    dungeon.doors.push(door);
  }
}

function findAnyGeomorphDoorPoint(dungeon, room) {
  for (const side of ["north", "east", "south", "west"]) {
    const point = findGeomorphDoorPoint(dungeon, room, side);
    if (point) return point;
  }
  return null;
}

function carveAccessToNearestGeomorphCorridor(dungeon, room, corridorIds, precinct) {
  const floor = dungeon.floors[room.floorIndex];
  const roomCenter = center(room);
  let best = null;
  for (const row of floor.wallGrid) {
    for (const cell of row) {
      if (!cell.walkable || cell.spaceType !== "corridor" || !corridorIds.includes(cell.corridorId)) continue;
      const distance = Math.abs(cell.wallX - roomCenter.x) + Math.abs(cell.wallY - roomCenter.y);
      if (!best || distance < best.distance) best = { cell, distance };
    }
  }
  if (!best) return null;
  const point = doorwayPoint(room, { x: best.cell.wallX, y: best.cell.wallY });
  const corridorId = best.cell.corridorId ?? `${room.geomorphId}_access_${room.id}`;
  const cells = [];
  carveCorridorLine(dungeon, room.floorIndex, point.outside.x, point.outside.y, best.cell.wallX, best.cell.wallY, corridorId, cells, precinct.profile.corridorEventLink ?? "standard_corridor");
  return { ...point, corridorId };
}

function connectGeomorphBlockGraph(dungeon, rooms, geomorphs, rng) {
  if (geomorphs.length < 2) return;
  const connectedPairs = new Set();
  const byId = new Map(geomorphs.map((geomorph) => [geomorph.id, geomorph]));

  for (const geomorph of geomorphs) {
    const parent = byId.get(geomorph.parentId);
    if (!parent) continue;
    connectGeomorphPair(dungeon, rooms, parent, geomorph, rng, "geomorph_parent_link");
    connectedPairs.add(pairKey(parent.id, geomorph.id));
  }

  for (let i = 0; i < geomorphs.length; i += 1) {
    for (let j = i + 1; j < geomorphs.length; j += 1) {
      const a = geomorphs[i];
      const b = geomorphs[j];
      if (!geomorphBlocksTouch(a, b)) continue;
      const key = pairKey(a.id, b.id);
      if (connectedPairs.has(key) || rng() > 0.32) continue;
      connectGeomorphPair(dungeon, rooms, a, b, rng, "geomorph_adjacent_link");
      connectedPairs.add(key);
    }
  }

  const route = nearestRoute(geomorphs);
  for (let i = 1; i < route.length; i += 1) {
    const a = route[i - 1];
    const b = route[i];
    const key = pairKey(a.id, b.id);
    if (connectedPairs.has(key) || geomorphBlocksTouch(a, b)) continue;
    if (i % 4 !== 0) continue;
    connectGeomorphPair(dungeon, rooms, a, b, rng, "geomorph_cluster_link");
    connectedPairs.add(key);
  }
}

function connectGeomorphPair(dungeon, rooms, a, b, rng, kind) {
  if (geomorphBlocksTouch(a, b) && connectTouchingGeomorphs(dungeon, a, b, kind)) return;
  const aRooms = rooms.filter((room) => a.roomIds.includes(room.id));
  const bRooms = rooms.filter((room) => b.roomIds.includes(room.id));
  if (!aRooms.length || !bRooms.length) return;
  let best = null;
  for (const roomA of aRooms) {
    for (const roomB of bRooms) {
      const distance = manhattan(center(roomA), center(roomB));
      if (!best || distance < best.distance) best = { roomA, roomB, distance };
    }
  }
  if (best) connectRooms(dungeon, best.roomA, best.roomB, rng, kind);
}

function connectTouchingGeomorphs(dungeon, a, b, kind) {
  const floor = dungeon.floors[a.floorIndex];
  const aCells = geomorphConnectorCells(floor, a);
  const bCells = geomorphConnectorCells(floor, b);
  if (!aCells.length || !bCells.length) return false;
  let best = null;
  for (const cellA of aCells) {
    for (const cellB of bCells) {
      const distance = Math.abs(cellA.wallX - cellB.wallX) + Math.abs(cellA.wallY - cellB.wallY);
      if (!best || distance < best.distance) best = { cellA, cellB, distance };
    }
  }
  if (!best) return false;
  const corridorId = `corridor_${dungeon.corridors.length + 1}`;
  const cells = [];
  const horizontalFirst = Math.abs(best.cellA.wallX - best.cellB.wallX) >= Math.abs(best.cellA.wallY - best.cellB.wallY);
  if (horizontalFirst) {
    carveCorridorLine(dungeon, a.floorIndex, best.cellA.wallX, best.cellA.wallY, best.cellB.wallX, best.cellA.wallY, corridorId, cells, best.cellA.eventLink ?? "standard_corridor");
    carveCorridorLine(dungeon, a.floorIndex, best.cellB.wallX, best.cellA.wallY, best.cellB.wallX, best.cellB.wallY, corridorId, cells, best.cellA.eventLink ?? "standard_corridor");
  } else {
    carveCorridorLine(dungeon, a.floorIndex, best.cellA.wallX, best.cellA.wallY, best.cellA.wallX, best.cellB.wallY, corridorId, cells, best.cellA.eventLink ?? "standard_corridor");
    carveCorridorLine(dungeon, a.floorIndex, best.cellA.wallX, best.cellB.wallY, best.cellB.wallX, best.cellB.wallY, corridorId, cells, best.cellA.eventLink ?? "standard_corridor");
  }
  dungeon.corridors.push({ id: corridorId, floorIndex: a.floorIndex, cells, width: 2, kind, eventLink: best.cellA.eventLink ?? "standard_corridor" });
  return true;
}

function geomorphConnectorCells(floor, geomorph) {
  const cells = [];
  for (const row of floor.wallGrid) {
    for (const cell of row) {
      if (cell.geomorphId === geomorph.id && cell.spaceType === "corridor") cells.push(cell);
    }
  }
  return cells;
}

function geomorphBlocksTouch(a, b) {
  const horizontalTouch = (a.blockX + a.blockWidth === b.blockX || b.blockX + b.blockWidth === a.blockX)
    && rangesOverlap(a.blockY, a.blockY + a.blockHeight - 1, b.blockY, b.blockY + b.blockHeight - 1);
  const verticalTouch = (a.blockY + a.blockHeight === b.blockY || b.blockY + b.blockHeight === a.blockY)
    && rangesOverlap(a.blockX, a.blockX + a.blockWidth - 1, b.blockX, b.blockX + b.blockWidth - 1);
  return horizontalTouch || verticalTouch;
}

function pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function transformSide(side, transform) {
  const mirror = transform.mirrored && (side === "east" || side === "west")
    ? DIR_BY_NAME[side].opposite
    : side;
  const order = ["north", "east", "south", "west"];
  const turns = ((transform.rotation ?? 0) / 90) % 4;
  return order[(order.indexOf(mirror) + turns + 4) % 4];
}

function findGeomorphDoorPoint(dungeon, room, wall) {
  const dir = DIR_BY_NAME[wall];
  const span = wall === "north" || wall === "south" ? room.width : room.height;
  const start = Math.floor(span / 2);
  const offsets = [start];
  for (let step = 1; step < span; step += 1) {
    if (start - step >= 0) offsets.push(start - step);
    if (start + step < span) offsets.push(start + step);
  }
  for (const offset of offsets) {
    const inside = doorInsidePosition(room, wall, offset);
    const outside = { x: inside.x + dir.dx, y: inside.y + dir.dy };
    const outsideCell = getCell(dungeon, room.floorIndex, outside.x, outside.y);
    if (outsideCell?.spaceType !== "corridor") continue;
    return {
      wall,
      offset,
      dir,
      inside,
      outside,
      corridorAnchor: outside,
      corridorId: outsideCell.corridorId,
    };
  }
  return null;
}

function createRoomFromGeomorph(dungeon, floorIndex, rooms, precinct, blueprint, part, index, geomorphId) {
  const accessType = part.accessType ?? "door_room";
  return {
    id: `room_${floorIndex}_${rooms.length + index + 1}`,
    floorIndex,
    districtId: precinct.districtId,
    districtType: precinct.districtType,
    districtLabel: precinct.districtLabel,
    precinctId: precinct.id,
    precinctType: precinct.type,
    precinctLabel: precinct.label,
    geomorphId,
    geomorphLabel: blueprint.label,
    originalGeomorphRoomId: part.id,
    templateKey: part.key ?? part.role ?? "geomorph_room",
    templateLabel: part.label ?? part.role ?? blueprint.label,
    blueprintShape: "geomorph",
    blueprintDoorPlan: null,
    blueprintFeatures: [],
    x: part.x,
    y: part.y,
    width: part.width,
    height: part.height,
    doors: [],
    accessType,
    eventLink: part.eventLink ?? precinct.profile.eventLink ?? "standard_room",
    rolledEvent: null,
    tags: [...new Set([...(blueprint.tags ?? []), ...(part.tags ?? []), part.role ?? "geomorph_room", "geomorph_room"])],
  };
}

function tryPlaceRoomFromTemplate(dungeon, floorIndex, rng, rooms, district, template, options = {}) {
  const smallSiteCap = dungeon.sizeCategory === "small" && options.landmark ? 8 : Infinity;
  const maxW = Math.min(template.maxW, smallSiteCap, Math.max(template.minW, district.width - 2));
  const maxH = Math.min(template.maxH, smallSiteCap, Math.max(template.minH, district.height - 2));
  const minW = Math.min(template.minW, maxW);
  const minH = Math.min(template.minH, maxH);
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const width = randInt(rng, minW, maxW);
    const height = randInt(rng, minH, maxH);
    const xMax = Math.max(district.x + 1, district.x + district.width - width - 1);
    const yMax = Math.max(district.y + 1, district.y + district.height - height - 1);
    const x = randInt(rng, district.x + 1, xMax);
    const y = randInt(rng, district.y + 1, yMax);
    const isOpen = template.accessType === "open_chamber" || options.openChamberIndex < options.openChambers;
    const room = {
      id: `room_${floorIndex}_${rooms.length + 1}`,
      floorIndex,
      districtId: district.districtId ?? district.id,
      districtType: district.districtType ?? district.type,
      districtLabel: district.districtLabel ?? district.label,
      precinctId: district.precinctId ?? null,
      precinctType: district.precinctId ? district.type : null,
      precinctLabel: district.precinctId ? district.label : null,
      templateKey: template.key,
      templateLabel: template.label,
      blueprintShape: template.shape ?? "rectangle",
      blueprintDoorPlan: template.doorPlan ?? null,
      blueprintFeatures: template.features ?? [],
      x,
      y,
      width,
      height,
      doors: [],
      accessType: isOpen ? "open_chamber" : "door_room",
      eventLink: template.eventLink ?? district.profile.eventLink ?? "standard_room",
      rolledEvent: null,
      tags: [...new Set([...(template.tags ?? []), ...(options.landmark ? ["landmark"] : [])])],
    };
    const buffer = options.landmark && (dungeon.sizeCategory === "large" || dungeon.sizeCategory === "super") ? 2 : 1;
    if (rooms.every((other) => !rectsOverlap(bufferRect(room, buffer), bufferRect(other, 0)))) {
      rooms.push(room);
      carveRoom(dungeon, room);
      return room;
    }
  }
  return null;
}

function placeFallbackRooms(dungeon, floorIndex, rng, rooms, precincts, target) {
  const orderedPrecincts = nearestRoute([...precincts].sort((a, b) => (b.roomTarget ?? 0) - (a.roomTarget ?? 0)));
  for (const buffer of [1, 0]) {
    const step = buffer ? 3 : 2;
    for (const precinct of orderedPrecincts) {
      for (let y = precinct.y + 1; y < precinct.y + precinct.height - 2 && rooms.length < target; y += step) {
        for (let x = precinct.x + 1; x < precinct.x + precinct.width - 2 && rooms.length < target; x += step) {
          const width = Math.min(randInt(rng, 2, 4), precinct.x + precinct.width - x - 1);
          const height = Math.min(randInt(rng, 2, 4), precinct.y + precinct.height - y - 1);
          if (width < 2 || height < 2) continue;
          const room = {
            id: `room_${floorIndex}_${rooms.length + 1}`,
            floorIndex,
            districtId: precinct.districtId,
            districtType: precinct.districtType,
            districtLabel: precinct.districtLabel,
            precinctId: precinct.id,
            precinctType: precinct.type,
            precinctLabel: precinct.label,
            templateKey: "small_room",
            templateLabel: "Small Room",
            blueprintShape: "fallback_compact",
            blueprintDoorPlan: null,
            blueprintFeatures: [],
            x,
            y,
            width,
            height,
            doors: [],
            accessType: "door_room",
            eventLink: precinct.profile.eventLink ?? "standard_room",
            rolledEvent: null,
            tags: ["room", "fallback_room"],
          };
          if (rooms.every((other) => !rectsOverlap(bufferRect(room, buffer), bufferRect(other, 0)))) {
            rooms.push(room);
            carveRoom(dungeon, room);
          }
        }
      }
    }
    if (rooms.length >= target) return;
  }
}

function addGeomorphAnnexRooms(dungeon, floorIndex, rng, rooms, geomorphs, target) {
  if (!geomorphs.length || rooms.length >= target) return;
  let attempts = 0;
  const maxAttempts = Math.max(80, (target - rooms.length) * 30);
  while (rooms.length < target && attempts < maxAttempts) {
    attempts += 1;
    const geomorph = choose(rng, geomorphs);
    const baseRooms = rooms.filter((room) => geomorph.roomIds.includes(room.id));
    const base = choose(rng, baseRooms);
    if (!base) continue;
    const annex = tryBuildAnnexRoom(dungeon, floorIndex, rng, rooms, base, geomorph);
    if (!annex) continue;
    rooms.push(annex);
    carveRoom(dungeon, annex);
    geomorph.roomIds.push(annex.id);
    connectRooms(dungeon, base, annex, rng, "geomorph_annex");
  }
}

function tryBuildAnnexRoom(dungeon, floorIndex, rng, rooms, base, geomorph) {
  const dirs = shuffle(rng, DIRS);
  for (const dir of dirs) {
    const sizes = shuffle(rng, [
      { width: 3, height: 3 },
      { width: 4, height: 3 },
      { width: 3, height: 4 },
      { width: 5, height: 4 },
      { width: 4, height: 5 },
    ]);
    for (const size of sizes) {
      const offsets = dir.dx
        ? shuffle(rng, range(base.y - size.height + 1, base.y + base.height - 1))
        : shuffle(rng, range(base.x - size.width + 1, base.x + base.width - 1));
      for (const offset of offsets) {
        let x = offset;
        let y = offset;
        if (dir.name === "north") {
          y = base.y - size.height;
          x = offset;
        }
        if (dir.name === "south") {
          y = base.y + base.height;
          x = offset;
        }
        if (dir.name === "west") {
          x = base.x - size.width;
          y = offset;
        }
        if (dir.name === "east") {
          x = base.x + base.width;
          y = offset;
        }
        const room = buildAnnexRoom(floorIndex, rooms, base, geomorph, x, y, size.width, size.height);
        if (!inBounds(dungeon, room.x, room.y) || !inBounds(dungeon, room.x + room.width - 1, room.y + room.height - 1)) continue;
        if (!rooms.every((other) => other === base ? !rectsOverlap(room, other) : !rectsOverlap(bufferRect(room, 1), bufferRect(other, 0)))) continue;
        if (!roomTouchesOpenSpace(dungeon, room, base)) continue;
        return room;
      }
    }
  }
  return null;
}

function buildAnnexRoom(floorIndex, rooms, base, geomorph, x, y, width, height) {
  return {
    id: `room_${floorIndex}_${rooms.length + 1}`,
    floorIndex,
    districtId: base.districtId,
    districtType: base.districtType,
    districtLabel: base.districtLabel,
    precinctId: base.precinctId,
    precinctType: base.precinctType,
    precinctLabel: base.precinctLabel,
    geomorphId: geomorph.id,
    geomorphLabel: geomorph.label,
    templateKey: "annex_room",
    templateLabel: "Annex Room",
    blueprintShape: "geomorph_annex",
    blueprintDoorPlan: "attached_to_geomorph",
    blueprintFeatures: [],
    x,
    y,
    width,
    height,
    doors: [],
    accessType: "door_room",
    eventLink: base.eventLink ?? "standard_room",
    rolledEvent: null,
    tags: ["room", "geomorph_room", "annex_room"],
  };
}

function range(start, end) {
  const values = [];
  for (let value = start; value <= end; value += 1) values.push(value);
  return values;
}

function roomTouchesOpenSpace(dungeon, room, base) {
  const expanded = bufferRect(room, 1);
  return rectsOverlap(expanded, base);
}

function connectPrecinctRoomGraphs(dungeon, floorIndex, districts, precincts, rooms, rng) {
  const precinctAnchors = [];
  for (const precinct of precincts) {
    const precinctRooms = rooms.filter((room) => room.precinctId === precinct.id);
    if (!precinctRooms.length) continue;
    const sorted = sortRoomsForPrecinct(precinctRooms, precinct);
    precinctAnchors.push({ precinct, room: sorted[0] });
    connectRoomsInsidePrecinct(dungeon, sorted, precinct, rng);
  }

  const districtAnchors = [];
  for (const district of districts) {
    const anchors = precinctAnchors
      .filter((item) => item.precinct.districtId === district.id)
      .sort((a, b) => centerDistanceToDistrict(a.room, district) - centerDistanceToDistrict(b.room, district));
    if (!anchors.length) continue;
    districtAnchors.push(anchors[0].room);
    for (let i = 1; i < anchors.length; i += 1) {
      connectRooms(dungeon, anchors[i - 1].room, anchors[i].room, rng, "precinct_transition");
    }
  }
  const route = nearestRoute(districtAnchors);
  for (let i = 1; i < route.length; i += 1) {
    connectRooms(dungeon, route[i - 1], route[i], rng, "transition_route");
  }
  const type = dungeon.dungeonType ?? DUNGEON_TYPES.lost_civilization;
  if (route.length > 3 && rng() < (type.transitionRate ?? 0.35)) {
    for (let i = 0; i < Math.max(1, Math.floor(route.length / 5)); i += 1) {
      const a = choose(rng, route);
      const b = choose(rng, route);
      if (a && b && a !== b) connectRooms(dungeon, a, b, rng, "cross_route");
    }
  }
}

function sortRoomsForPrecinct(rooms, precinct) {
  if (precinct.connectionStyle === "linear_gallery") {
    const horizontal = precinct.width >= precinct.height;
    return [...rooms].sort((a, b) => horizontal ? center(a).x - center(b).x : center(a).y - center(b).y);
  }
  if (precinct.connectionStyle === "branch") {
    return [...rooms].sort((a, b) => centerDistanceToDistrict(b, precinct) - centerDistanceToDistrict(a, precinct));
  }
  return [...rooms].sort((a, b) => centerDistanceToDistrict(a, precinct) - centerDistanceToDistrict(b, precinct));
}

function connectRoomsInsidePrecinct(dungeon, rooms, precinct, rng) {
  if (rooms.length < 2) return;
  if (precinct.connectionStyle === "linear_gallery" || precinct.connectionStyle === "branch") {
    for (let i = 1; i < rooms.length; i += 1) {
      connectRooms(dungeon, rooms[i - 1], rooms[i], rng, precinct.connectionStyle);
    }
    return;
  }
  if (precinct.connectionStyle === "hub_spoke") {
    const hub = rooms[0];
    for (let i = 1; i < rooms.length; i += 1) {
      connectRooms(dungeon, hub, rooms[i], rng, "hub_spoke");
    }
    return;
  }
  connectRoomCluster(dungeon, rooms, rng);
}

function connectRoomCluster(dungeon, rooms, rng) {
  if (rooms.length < 2) return;
  const connected = [rooms[0]];
  const remaining = rooms.slice(1);
  while (remaining.length) {
    let best = { connectedIndex: 0, remainingIndex: 0, distance: Infinity };
    for (let i = 0; i < connected.length; i += 1) {
      for (let j = 0; j < remaining.length; j += 1) {
        const distance = roomDistance(connected[i], remaining[j]);
        if (distance < best.distance) best = { connectedIndex: i, remainingIndex: j, distance };
      }
    }
    const next = remaining.splice(best.remainingIndex, 1)[0];
    connectRooms(dungeon, connected[best.connectedIndex], next, rng, "district_route");
    connected.push(next);
  }
}

function nearestRoute(rooms) {
  if (rooms.length < 3) return [...rooms];
  const route = [rooms[0]];
  const remaining = rooms.slice(1);
  while (remaining.length) {
    let bestIndex = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < remaining.length; i += 1) {
      const distance = roomDistance(route[route.length - 1], remaining[i]);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }
    route.push(remaining.splice(bestIndex, 1)[0]);
  }
  return route;
}

function roomDistance(a, b) {
  const ac = center(a);
  const bc = center(b);
  return Math.abs(ac.x - bc.x) + Math.abs(ac.y - bc.y);
}

function centerDistanceToDistrict(room, district) {
  const c = center(room);
  const dx = c.x - (district.x + district.width / 2);
  const dy = c.y - (district.y + district.height / 2);
  return dx * dx + dy * dy;
}

function bufferRect(rect, buffer) {
  return {
    x: rect.x - buffer,
    y: rect.y - buffer,
    width: rect.width + buffer * 2,
    height: rect.height + buffer * 2,
  };
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function carveRoom(dungeon, room) {
  const floor = dungeon.floors[room.floorIndex];
  for (let y = room.y; y < room.y + room.height; y += 1) {
    for (let x = room.x; x < room.x + room.width; x += 1) {
      const cell = floor.wallGrid[y][x];
      cell.walkable = true;
      cell.spaceType = "room";
      cell.roomId = room.id;
      cell.geomorphId = room.geomorphId ?? null;
      cell.eventLink = room.eventLink;
      cell.revealed = false;
    }
  }
  dungeon.rooms.push(room);
}

function center(room) {
  return {
    x: Math.floor(room.x + room.width / 2),
    y: Math.floor(room.y + room.height / 2),
  };
}

function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart <= bEnd && bStart <= aEnd;
}

function connectRooms(dungeon, a, b, rng, kind = "connector") {
  const start = doorwayPoint(a, center(b));
  const end = doorwayPoint(b, center(a));
  const corridorId = `corridor_${dungeon.corridors.length + 1}`;
  const horizontalFirst = rng() > 0.5;
  const cells = [];
  const eventLink = corridorEventLinkForRooms(dungeon, a, b);

  if (horizontalFirst) {
    carveCorridorLine(dungeon, a.floorIndex, start.corridorAnchor.x, start.corridorAnchor.y, end.corridorAnchor.x, start.corridorAnchor.y, corridorId, cells, eventLink);
    carveCorridorLine(dungeon, a.floorIndex, end.corridorAnchor.x, start.corridorAnchor.y, end.corridorAnchor.x, end.corridorAnchor.y, corridorId, cells, eventLink);
  } else {
    carveCorridorLine(dungeon, a.floorIndex, start.corridorAnchor.x, start.corridorAnchor.y, start.corridorAnchor.x, end.corridorAnchor.y, corridorId, cells, eventLink);
    carveCorridorLine(dungeon, a.floorIndex, start.corridorAnchor.x, end.corridorAnchor.y, end.corridorAnchor.x, end.corridorAnchor.y, corridorId, cells, eventLink);
  }

  const forcedKind = kind.startsWith("geomorph_") ? "normal" : null;
  addRoomConnection(dungeon, a, start, corridorId, forcedKind ?? connectionKindForRoom(a, rng));
  addRoomConnection(dungeon, b, end, corridorId, forcedKind ?? connectionKindForRoom(b, rng));
  dungeon.corridors.push({ id: corridorId, floorIndex: a.floorIndex, cells, width: 2, kind, eventLink });
}

function corridorEventLinkForRooms(dungeon, a, b) {
  const floor = dungeon.floors[a.floorIndex];
  const aProfile = floor.districts?.find((district) => district.id === a.districtId)?.profile;
  const bProfile = floor.districts?.find((district) => district.id === b.districtId)?.profile;
  if (aProfile?.corridorEventLink && aProfile.corridorEventLink === bProfile?.corridorEventLink) return aProfile.corridorEventLink;
  return aProfile?.corridorEventLink ?? bProfile?.corridorEventLink ?? "standard_corridor";
}

function carveCorridorLine(dungeon, floorIndex, x1, y1, x2, y2, corridorId, cells, eventLink = "standard_corridor", options = {}) {
  const floor = dungeon.floors[floorIndex];
  const dx = Math.sign(x2 - x1);
  const dy = Math.sign(y2 - y1);
  let x = x1;
  let y = y1;
  while (x !== x2 || y !== y2) {
    carveCorridorBlock(floor, x, y, corridorId, cells, eventLink, options);
    if (x !== x2) x += dx;
    if (y !== y2) y += dy;
  }
  carveCorridorBlock(floor, x2, y2, corridorId, cells, eventLink, options);
}

function carveCorridorBlock(floor, x, y, corridorId, cells, eventLink = "standard_corridor", options = {}) {
  for (let oy = 0; oy < 2; oy += 1) {
    for (let ox = 0; ox < 2; ox += 1) {
      const cell = floor.wallGrid[y + oy]?.[x + ox];
      if (!cell) continue;
      if (cell.spaceType === "room") continue;
      cell.walkable = true;
      cell.spaceType = "corridor";
      cell.corridorId = corridorId;
      if (options.geomorphId) cell.geomorphId = options.geomorphId;
      cell.eventLink = eventLink;
      cells.push([x + ox, y + oy]);
    }
  }
}

function doorwayPoint(room, toward) {
  const from = center(room);
  const deltaX = toward.x - from.x;
  const deltaY = toward.y - from.y;
  const dx = Math.sign(deltaX);
  const dy = Math.sign(deltaY);
  let wall = "north";
  let offset = 0;
  let dir = DIR_BY_NAME.north;
  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    wall = dx > 0 ? "east" : "west";
    dir = dx > 0 ? DIR_BY_NAME.east : DIR_BY_NAME.west;
    offset = Math.max(0, Math.min(room.height - 1, from.y - room.y));
  } else {
    wall = dy > 0 ? "south" : "north";
    dir = dy > 0 ? DIR_BY_NAME.south : DIR_BY_NAME.north;
    offset = Math.max(0, Math.min(room.width - 1, from.x - room.x));
  }

  const inside = doorInsidePosition(room, wall, offset);
  const outside = { x: inside.x + dir.dx, y: inside.y + dir.dy };
  const corridorAnchor = corridorAnchorForDoor(room, wall, offset, outside);
  return { wall, offset, dir, inside, outside, corridorAnchor };
}

function doorInsidePosition(room, wall, offset) {
  if (wall === "north") return { x: room.x + offset, y: room.y };
  if (wall === "south") return { x: room.x + offset, y: room.y + room.height - 1 };
  if (wall === "east") return { x: room.x + room.width - 1, y: room.y + offset };
  return { x: room.x, y: room.y + offset };
}

function corridorAnchorForDoor(room, wall, offset, outside) {
  if (wall === "north") return { x: Math.max(room.x, Math.min(room.x + room.width - 2, room.x + offset)), y: room.y - 2 };
  if (wall === "south") return { x: Math.max(room.x, Math.min(room.x + room.width - 2, room.x + offset)), y: room.y + room.height };
  if (wall === "west") return { x: room.x - 2, y: Math.max(room.y, Math.min(room.y + room.height - 2, room.y + offset)) };
  return { x: room.x + room.width, y: Math.max(room.y, Math.min(room.y + room.height - 2, room.y + offset)) };
}

function connectionKindForRoom(room, rng) {
  if (room.accessType === "open_chamber") return "open_chamber";
  return rng() < SECRET_DOOR_CHANCE ? "secret" : "normal";
}

function addRoomConnection(dungeon, room, point, corridorId, kind) {
  const door = makeDoorRecord(dungeon, room, point, corridorId, kind);
  room.doors.push(door);
  if (kind === "open_chamber") room.tags = [...new Set([...room.tags, "open_chamber"])];
  dungeon.doors.push(door);
}

function makeDoorRecord(dungeon, room, point, corridorId, kind) {
  const doorType = kind === "open_chamber" ? "open_chamber" : kind;
  return {
    id: `door_${dungeon.doors.length + 1}`,
    roomId: room.id,
    corridorId,
    floorIndex: room.floorIndex,
    wall: point.wall,
    offset: point.offset,
    direction: point.dir.name,
    oppositeDirection: point.dir.opposite,
    inside: point.inside,
    outside: point.outside,
    width: kind === "open_chamber" ? 2 : 1,
    doorType,
    connectionKind: kind,
    revealed: kind !== "secret",
    open: kind === "open_chamber",
    locked: false,
    lockType: null,
    keyId: null,
    stuck: false,
  };
}

function addLoops(dungeon, rooms, rng, loopRate = 0.2) {
  const loopCount = Math.max(1, Math.floor(rooms.length * loopRate));
  for (let i = 0; i < loopCount; i += 1) {
    const a = choose(rng, rooms);
    const b = choose(rng, rooms);
    if (a && b && a !== b) connectRooms(dungeon, a, b, rng, "loop");
  }
}

function addDeadEnds(dungeon, floorIndex, rng, count) {
  const floor = dungeon.floors[floorIndex];
  const corridorCells = floor.wallGrid.flat().filter((cell) => cell.walkable && cell.spaceType === "corridor");
  for (let i = 0; i < count; i += 1) {
    const start = choose(rng, corridorCells);
    if (!start) continue;
    const dir = choose(rng, DIRS);
    const length = choose(rng, [4, 6, 8]);
    const corridorId = `dead_end_${dungeon.corridors.length + 1}`;
    const cells = [];
    let x = start.wallX;
    let y = start.wallY;
    for (let step = 0; step < length; step += 1) {
      x += dir.dx;
      y += dir.dy;
      if (!inBounds(dungeon, x + 1, y + 1)) break;
      carveCorridorBlock(floor, x, y, corridorId, cells);
    }
    dungeon.corridors.push({ id: corridorId, floorIndex, cells, width: 2, kind: "dead_end" });
  }
}

function addFloorConnections(dungeon, rng) {
  if (dungeon.floorCount < 2) return;
  for (let floorIndex = 0; floorIndex < dungeon.floorCount - 1; floorIndex += 1) {
    addFloorConnection(dungeon, floorIndex, floorIndex + 1, rng, "stairs");
  }
}

function addFloorConnection(dungeon, fromFloorIndex, toFloorIndex, rng, kind) {
  const fromCell = chooseConnectionCell(dungeon, fromFloorIndex, rng);
  const toCell = chooseConnectionCell(dungeon, toFloorIndex, rng);
  if (!fromCell || !toCell) return;

  const id = `floor_link_${dungeon.floorConnections.length + 1}`;
  const connection = {
    id,
    kind,
    connectionType: "vertical",
    bidirectional: true,
    skipFloors: Math.max(0, toFloorIndex - fromFloorIndex - 1),
    assetKey: "stairsThick2x2Transparent",
    from: {
      floorIndex: fromFloorIndex,
      wallX: fromCell.wallX,
      wallY: fromCell.wallY,
      marker: "stairs_down",
      targetFloorIndex: toFloorIndex,
    },
    to: {
      floorIndex: toFloorIndex,
      wallX: toCell.wallX,
      wallY: toCell.wallY,
      marker: "stairs_up",
      targetFloorIndex: fromFloorIndex,
    },
    revealed: false,
    notes: "Both endpoint cells store matching verticalConnection data.",
  };

  markConnectionCell(fromCell, connection, "from");
  markConnectionCell(toCell, connection, "to");
  dungeon.floorConnections.push(connection);
  dungeon.floors[fromFloorIndex].connectionsDown.push(id);
  dungeon.floors[toFloorIndex].connectionsUp.push(id);
}

function chooseConnectionCell(dungeon, floorIndex, rng) {
  const rooms = dungeon.rooms.filter((room) => room.floorIndex === floorIndex && !room.tags.includes("boss"));
  const room = choose(rng, rooms.length ? rooms : dungeon.rooms.filter((item) => item.floorIndex === floorIndex));
  if (!room) return null;
  const x = randInt(rng, room.x, room.x + room.width - 1);
  const y = randInt(rng, room.y, room.y + room.height - 1);
  return getCell(dungeon, floorIndex, x, y);
}

function markConnectionCell(cell, connection, endpoint) {
  const point = connection[endpoint];
  const target = endpoint === "from" ? connection.to : connection.from;
  cell.verticalConnection = {
    connectionId: connection.id,
    endpoint,
    kind: connection.kind,
    marker: point.marker,
    targetFloorIndex: target.floorIndex,
    targetWallX: target.wallX,
    targetWallY: target.wallY,
  };
  cell.eventLink = "floor_connection";
  cell.labels = [...new Set([...cell.labels, point.marker])];
}

function assignBossRoom(dungeon, floorIndex, rooms) {
  const start = rooms[0];
  const startCenter = center(start);
  let boss = start;
  let best = -1;
  for (const room of rooms) {
    const c = center(room);
    const distance = Math.abs(c.x - startCenter.x) + Math.abs(c.y - startCenter.y);
    if (distance > best) {
      best = distance;
      boss = room;
    }
  }
  boss.tags.push("boss");
  boss.eventLink = "boss_room";
  for (let y = boss.y; y < boss.y + boss.height; y += 1) {
    for (let x = boss.x; x < boss.x + boss.width; x += 1) {
      getCell(dungeon, floorIndex, x, y).eventLink = "boss_room";
    }
  }
}

function finalizeDoorStates(dungeon, floorIndex, rng) {
  const rooms = dungeon.rooms.filter((room) => room.floorIndex === floorIndex);
  for (const room of rooms) {
    const lockRoom = room.doors.some((door) => door.doorType !== "open_chamber") && rng() < LOCKED_ROOM_CHANCE;
    for (const door of room.doors) {
      if (door.doorType === "open_chamber") {
        door.open = true;
        continue;
      }
      if (door.forcedLocked) {
        door.locked = true;
        door.lockType = door.lockType ?? "generic_key_or_pick";
        door.open = false;
        continue;
      }
      door.locked = lockRoom;
      door.lockType = lockRoom ? "generic_key_or_pick" : null;
      door.open = !lockRoom && door.doorType !== "secret" && rng() < OPEN_DOOR_CHANCE;
    }
  }
}

export function interactWithDoor(dungeon, floorIndex, x, y, direction, options = {}) {
  const cell = getCell(dungeon, floorIndex, x, y);
  const door = cell?.edgeFeatures?.[direction];
  if (!door || door.doorType === "open_chamber" || (door.doorType === "secret" && !door.revealed)) return false;
  dungeon.turn += 1;
  if (door.locked) {
    const check = resolveLockedDoorCheck(dungeon, door, options);
    if (!check.success) {
      dungeon.eventLog.unshift({ turn: dungeon.turn, text: `Locked door at ${x}, ${y}. ${check.message}` });
      dungeon.eventLog = dungeon.eventLog.slice(0, 20);
      return false;
    }
    door.locked = false;
    door.lockType = null;
    dungeon.eventLog.unshift({ turn: dungeon.turn, text: `Lock bypassed at ${x}, ${y}. ${check.message}` });
  }
  door.open = true;
  door.revealed = true;
  dungeon.eventLog.unshift({ turn: dungeon.turn, text: `Opened door at ${x}, ${y}.` });
  dungeon.eventLog = dungeon.eventLog.slice(0, 20);
  return true;
}

export function searchWall(dungeon, floorIndex, x, y, direction, options = {}) {
  const cell = getCell(dungeon, floorIndex, x, y);
  const door = cell?.edgeFeatures?.[direction];
  dungeon.turn += 1;
  if (!door || door.doorType !== "secret" || door.revealed) {
    dungeon.eventLog.unshift({ turn: dungeon.turn, text: `Searched wall at ${x}, ${y}: nothing found.` });
    dungeon.eventLog = dungeon.eventLog.slice(0, 20);
    return false;
  }
  const check = resolveSecretDoorSearchCheck(dungeon, door, options);
  if (check.success) {
    door.revealed = true;
    door.open = false;
    dungeon.eventLog.unshift({ turn: dungeon.turn, text: `Secret door revealed at ${x}, ${y}. ${check.message}` });
    dungeon.eventLog = dungeon.eventLog.slice(0, 20);
    return true;
  }
  dungeon.eventLog.unshift({ turn: dungeon.turn, text: `Searched wall at ${x}, ${y}: ${check.message}` });
  dungeon.eventLog = dungeon.eventLog.slice(0, 20);
  return false;
}

function resolveLockedDoorCheck(dungeon, door, options = {}) {
  return {
    success: options.autoPass ?? true,
    dc: door.lockDc ?? 12,
    method: options.method ?? "lockpicking",
    message: "Check framework placeholder: automatic success until lockpicking rules are implemented.",
  };
}

function resolveSecretDoorSearchCheck(dungeon, door, options = {}) {
  return {
    success: options.autoPass ?? true,
    dc: door.searchDc ?? 12,
    method: options.elf ? "elf_search" : "search",
    message: options.elf
      ? "Elf search placeholder: automatic success."
      : "Search framework placeholder: automatic success until search rules are implemented.",
  };
}

export function revealElfSecretDoorsNearParty(dungeon, floorIndex, radius = 3) {
  const { wallX, wallY } = dungeon.player;
  let revealed = 0;
  for (const door of dungeon.doors.filter((item) => item.floorIndex === floorIndex && item.doorType === "secret" && !item.revealed)) {
    const nearInside = Math.abs(door.inside.x - wallX) + Math.abs(door.inside.y - wallY) <= radius;
    const nearOutside = Math.abs(door.outside.x - wallX) + Math.abs(door.outside.y - wallY) <= radius;
    if (!nearInside && !nearOutside) continue;
    door.revealed = true;
    door.open = false;
    revealed += 1;
  }
  if (revealed) {
    dungeon.eventLog.unshift({ turn: dungeon.turn, text: `Elf search revealed ${revealed} secret door${revealed === 1 ? "" : "s"} nearby.` });
    dungeon.eventLog = dungeon.eventLog.slice(0, 20);
  }
  return revealed;
}

function deriveEdges(dungeon, floorIndex) {
  const floor = dungeon.floors[floorIndex];
  for (let y = 0; y < dungeon.wallGridHeight; y += 1) {
    for (let x = 0; x < dungeon.wallGridWidth; x += 1) {
      const cell = floor.wallGrid[y][x];
      if (!cell.walkable) continue;
      for (const dir of DIRS) {
        const n = floor.wallGrid[y + dir.dy]?.[x + dir.dx];
        cell.edges[dir.name] = edgeTypeForAdjacency(cell, n);
        cell.edgeFeatures ??= { north: null, east: null, south: null, west: null };
        cell.edgeFeatures[dir.name] = null;
      }
    }
  }
  applyRoomConnectionEdges(dungeon, floorIndex);
}

function edgeTypeForAdjacency(cell, neighbor) {
  if (!neighbor?.walkable) return "wall";
  if (cell.spaceType === "room" && neighbor.spaceType === "room" && cell.roomId !== neighbor.roomId) return "wall";
  if (cell.spaceType === "corridor" && neighbor.spaceType === "corridor") return "open";
  if (
    (cell.spaceType === "room" && neighbor.spaceType === "corridor") ||
    (cell.spaceType === "corridor" && neighbor.spaceType === "room")
  ) {
    return "wall";
  }
  return "open";
}

function applyRoomConnectionEdges(dungeon, floorIndex) {
  for (const door of dungeon.doors.filter((item) => item.floorIndex === floorIndex)) {
    const inside = getCell(dungeon, floorIndex, door.inside.x, door.inside.y);
    const outside = getCell(dungeon, floorIndex, door.outside.x, door.outside.y);
    if (!inside || !outside || !inside.walkable || !outside.walkable) continue;
    const edgeType = door.doorType === "open_chamber" ? "open_chamber" : door.doorType === "secret" ? "secret_door" : "door";
    inside.edges[door.direction] = edgeType;
    outside.edges[door.oppositeDirection] = edgeType;
    inside.edgeFeatures[door.direction] = door;
    outside.edgeFeatures[door.oppositeDirection] = door;
    inside.labels = [...new Set([...inside.labels, door.doorType])];
    outside.labels = [...new Set([...outside.labels, door.doorType])];
  }
}

function revealAroundRooms(dungeon, floorIndex, rooms) {
  for (const room of rooms) {
    for (let y = room.y - 1; y <= room.y + room.height; y += 1) {
      for (let x = room.x - 1; x <= room.x + room.width; x += 1) {
        const cell = getCell(dungeon, floorIndex, x, y);
        if (cell) cell.revealed = true;
      }
    }
  }
}

export function movePlayer(dungeon, direction) {
  const dir = DIRS.find((item) => item.name === direction);
  if (!dir) return false;
  const { floorIndex, wallX, wallY } = dungeon.player;
  const current = getCell(dungeon, floorIndex, wallX, wallY);
  const nextX = wallX + dir.dx;
  const nextY = wallY + dir.dy;
  const next = getCell(dungeon, floorIndex, nextX, nextY);
  if (!current || !next || !next.walkable) return false;
  if (!canTraverseEdge(current, dir.name)) return false;
  dungeon.player.wallX = nextX;
  dungeon.player.wallY = nextY;
  dungeon.player.facing = direction;
  dungeon.turn += 1;
  markVisited(dungeon, floorIndex, nextX, nextY);
  return true;
}

function canTraverseEdge(cell, direction) {
  const edge = cell.edges?.[direction];
  if (edge === "open" || edge === "open_chamber") return true;
  if (edge === "door") return Boolean(cell.edgeFeatures?.[direction]?.open);
  if (edge === "secret_door") return Boolean(cell.edgeFeatures?.[direction]?.revealed && cell.edgeFeatures?.[direction]?.open);
  return false;
}

function markVisited(dungeon, floorIndex, x, y) {
  const cell = getCell(dungeon, floorIndex, x, y);
  if (!cell) return;
  cell.visited = true;
  cell.revealed = true;
  for (const dir of DIRS) {
    const adjacent = getCell(dungeon, floorIndex, x + dir.dx, y + dir.dy);
    if (adjacent) adjacent.revealed = true;
  }
  if (!cell.rolledEvent && cell.eventLink) {
    cell.rolledEvent = rollSimpleEvent(dungeon, cell);
    dungeon.eventLog.unshift({ turn: dungeon.turn, text: `${cell.rolledEvent.title} at ${x}, ${y}` });
    dungeon.eventLog = dungeon.eventLog.slice(0, 20);
  }
}

function rollSimpleEvent(dungeon, cell) {
  const roll = ((cell.wallX * 31 + cell.wallY * 17 + dungeon.turn * 13) % 100) + 1;
  if (cell.eventLink === "boss_room") return { rolled: true, roll, id: "boss_room", title: "Boss Room", resolved: false };
  if (roll <= 25) return { rolled: true, roll, id: "quiet", title: "Quiet Space", resolved: true };
  if (roll <= 45) return { rolled: true, roll, id: "dressing", title: "Dungeon Dressing", resolved: false };
  if (roll <= 70) return { rolled: true, roll, id: "encounter", title: "Encounter", resolved: false };
  if (roll <= 88) return { rolled: true, roll, id: "hazard", title: "Hazard", resolved: false };
  return { rolled: true, roll, id: "treasure", title: "Treasure Sign", resolved: false };
}
