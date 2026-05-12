const sources = {
  arden: "Arden Vul style: dense architectural precincts, set-piece rooms, strong axes, and ruins/caves intruding into built space.",
  barrowmaze: "Barrowmaze style: compact tomb neighborhoods, repeated burial cells, short connectors, and dense keyed-room flow.",
  geomorph: "Dungeon geomorph tile style: standardized edge exits and reusable 10x10 or 20x20 blocks."
};

const r = (id, x, y, width, height, role, tags = []) => ({ id, x, y, width, height, role, tags });
const c = (x, y, width, height, role = "passage") => ({ x, y, width, height, role });
const d = (from, side, to = "corridor", kind = "door") => ({ from, side, to, kind });
const s = (side, offset, width = 2) => ({ side, offset, width });

const geomorph = (spec) => {
  const merged = {
    size: 10,
    kind: "normal",
    exits: [],
    sourceNotes: [sources.geomorph],
    tags: [],
    rooms: [],
    corridors: [],
    doors: [],
    ...spec
  };
  const sockets = merged.sockets?.length ? merged.sockets : inferSocketsFromCorridors(merged);
  return {
    ...merged,
    sockets,
    exits: merged.exits?.length ? merged.exits : [...new Set(sockets.map((socket) => socket.side))],
  };
};

function inferSocketsFromCorridors(geomorphSpec) {
  const size = geomorphSpec.size ?? 10;
  const exits = geomorphSpec.exits ?? [];
  const sockets = [];
  for (const side of exits) {
    const matches = [];
    for (const corridor of geomorphSpec.corridors ?? []) {
      const socket = socketForCorridorAtSide(corridor, side, size);
      if (socket) matches.push(socket);
    }
    if (matches.length) {
      sockets.push(...matches);
    } else {
      sockets.push(s(side, preferredFallbackSocketOffset(side, size), 2));
    }
  }
  return uniqueSocketList(sockets);
}

function socketForCorridorAtSide(corridor, side, size) {
  if (side === "north" && corridor.y === 0) return s(side, clampSocketOffset(corridor.x, corridor.width, size), Math.min(2, corridor.width));
  if (side === "south" && corridor.y + corridor.height >= size) return s(side, clampSocketOffset(corridor.x, corridor.width, size), Math.min(2, corridor.width));
  if (side === "west" && corridor.x === 0) return s(side, clampSocketOffset(corridor.y, corridor.height, size), Math.min(2, corridor.height));
  if (side === "east" && corridor.x + corridor.width >= size) return s(side, clampSocketOffset(corridor.y, corridor.height, size), Math.min(2, corridor.height));
  return null;
}

function clampSocketOffset(offset, width, size) {
  const centered = offset + Math.max(0, Math.floor((width - 2) / 2));
  return Math.max(0, Math.min(size - 2, centered));
}

function preferredFallbackSocketOffset(side, size) {
  if (size === 20) return side === "north" || side === "west" ? 7 : 12;
  return side === "north" || side === "west" ? 2 : 7;
}

function uniqueSocketList(sockets) {
  const seen = new Set();
  return sockets.filter((socket) => {
    const key = `${socket.side}:${socket.offset}:${socket.width}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const NORMAL_GEOMORPHS = [
  geomorph({
    key: "crypt_cells_10_a", label: "Crypt Cells A", category: "tombs", exits: ["north", "east", "south"], tags: ["crypt", "dense", "barrowmaze"],
    sourceNotes: [sources.barrowmaze, sources.geomorph],
    rooms: [r("west_cells", 1, 1, 3, 3, "burial_cells"), r("east_cells", 6, 1, 3, 3, "burial_cells"), r("ossuary", 1, 6, 3, 3, "ossuary"), r("sealed_tomb", 6, 6, 3, 3, "sealed_tomb")],
    corridors: [c(4, 0, 2, 10, "central_spine"), c(0, 4, 10, 2, "cross_passage")],
    doors: [d("west_cells", "east"), d("east_cells", "west"), d("ossuary", "east"), d("sealed_tomb", "west")]
  }),
  geomorph({
    key: "crypt_cells_10_b", label: "Crypt Cells B", category: "tombs", exits: ["west", "east"], tags: ["crypt", "compact", "loop"],
    sourceNotes: [sources.barrowmaze, sources.geomorph],
    rooms: [r("north_tomb", 1, 1, 8, 2, "tomb_row"), r("south_tomb", 1, 7, 8, 2, "tomb_row"), r("center_shrine", 3, 4, 4, 2, "small_shrine")],
    corridors: [c(0, 4, 10, 2, "main_hall"), c(1, 3, 2, 4, "west_link"), c(7, 3, 2, 4, "east_link")],
    doors: [d("north_tomb", "south"), d("south_tomb", "north"), d("center_shrine", "north")]
  }),
  geomorph({
    key: "barrow_cross_10_a", label: "Barrow Cross A", category: "tombs", exits: ["north", "east", "south", "west"], tags: ["cross", "tomb", "hub"],
    sourceNotes: [sources.barrowmaze, sources.geomorph],
    rooms: [r("north_chamber", 3, 1, 4, 2, "sarcophagus_room"), r("east_chamber", 7, 3, 2, 4, "burial_room"), r("south_chamber", 3, 7, 4, 2, "ossuary"), r("west_chamber", 1, 3, 2, 4, "burial_room")],
    corridors: [c(4, 0, 2, 10, "north_south_axis"), c(0, 4, 10, 2, "east_west_axis")],
    doors: [d("north_chamber", "south"), d("east_chamber", "west"), d("south_chamber", "north"), d("west_chamber", "east")]
  }),
  geomorph({
    key: "reliquary_suite_10_a", label: "Reliquary Suite A", category: "tombs", exits: ["south", "east"], tags: ["reliquary", "locked", "barrowmaze"],
    sourceNotes: [sources.barrowmaze],
    rooms: [r("antechamber", 2, 6, 4, 3, "antechamber"), r("reliquary", 2, 2, 5, 3, "reliquary"), r("side_vault", 7, 5, 2, 3, "side_vault")],
    corridors: [c(4, 5, 2, 5, "entry_passage"), c(5, 5, 5, 2, "east_link")],
    doors: [d("antechamber", "north"), d("reliquary", "south"), d("side_vault", "west", "corridor", "locked")]
  }),
  geomorph({
    key: "mortuary_chapel_10_a", label: "Mortuary Chapel A", category: "tombs", exits: ["north", "west"], tags: ["chapel", "crypt", "processional"],
    sourceNotes: [sources.barrowmaze, sources.arden],
    rooms: [r("chapel", 2, 1, 6, 5, "mortuary_chapel"), r("vestry", 1, 7, 3, 2, "vestry"), r("burial_niche", 6, 7, 3, 2, "burial_niche")],
    corridors: [c(4, 0, 2, 10, "processional_axis"), c(0, 7, 10, 2, "service_crosshall")],
    doors: [d("chapel", "south"), d("vestry", "east"), d("burial_niche", "west")]
  }),
  geomorph({
    key: "ossuary_grid_10_a", label: "Ossuary Grid A", category: "tombs", exits: ["north", "south"], tags: ["ossuary", "grid", "dense"],
    sourceNotes: [sources.barrowmaze],
    rooms: [r("bone_room_a", 1, 1, 3, 2, "ossuary"), r("bone_room_b", 6, 1, 3, 2, "ossuary"), r("bone_room_c", 1, 7, 3, 2, "ossuary"), r("bone_room_d", 6, 7, 3, 2, "ossuary"), r("bone_pit", 3, 4, 4, 2, "bone_pit")],
    corridors: [c(4, 0, 2, 10, "main_spine"), c(0, 4, 10, 2, "cross_passage")],
    doors: [d("bone_room_a", "east"), d("bone_room_b", "west"), d("bone_room_c", "east"), d("bone_room_d", "west"), d("bone_pit", "north")]
  }),
  geomorph({
    key: "sealed_family_tomb_10_a", label: "Sealed Family Tomb A", category: "tombs", exits: ["west", "south"], tags: ["family_tomb", "secret", "compact"],
    sourceNotes: [sources.barrowmaze],
    rooms: [r("family_crypt", 2, 2, 5, 5, "family_crypt"), r("hidden_vault", 7, 2, 2, 3, "hidden_vault"), r("mourning_room", 2, 7, 4, 2, "mourning_room")],
    corridors: [c(0, 4, 4, 2, "entry_hall"), c(4, 5, 2, 5, "south_link")],
    doors: [d("family_crypt", "west"), d("hidden_vault", "west", "family_crypt", "secret"), d("mourning_room", "north")]
  }),
  geomorph({
    key: "sunken_crypt_10_a", label: "Sunken Crypt A", category: "tombs", exits: ["north", "east"], tags: ["sunken", "flooded", "crypt"],
    sourceNotes: [sources.arden, sources.barrowmaze],
    rooms: [r("sunken_room", 2, 2, 5, 5, "sunken_crypt", ["flooded"]), r("dry_landing", 7, 1, 2, 3, "landing"), r("low_vault", 1, 7, 5, 2, "low_vault")],
    corridors: [c(4, 0, 2, 3, "north_stair"), c(6, 3, 4, 2, "east_outlet"), c(4, 5, 2, 5, "low_passage")],
    doors: [d("sunken_room", "north"), d("dry_landing", "west"), d("low_vault", "east")]
  }),
  geomorph({
    key: "processional_shrine_10_a", label: "Processional Shrine A", category: "religious", exits: ["north", "south"], tags: ["shrine", "axis", "arden"],
    sourceNotes: [sources.arden, sources.geomorph],
    rooms: [r("entry_narthex", 2, 1, 6, 2, "narthex"), r("shrine_hall", 2, 4, 6, 4, "shrine_hall"), r("sanctum", 3, 8, 4, 1, "sanctum")],
    corridors: [c(4, 0, 2, 10, "ceremonial_axis")],
    doors: [d("entry_narthex", "south"), d("shrine_hall", "north"), d("sanctum", "north")]
  }),
  geomorph({
    key: "idol_chamber_10_a", label: "Idol Chamber A", category: "religious", exits: ["west", "east", "south"], tags: ["idol", "side_chapels", "hub"],
    sourceNotes: [sources.arden],
    rooms: [r("idol_hall", 3, 2, 4, 5, "idol_hall"), r("west_chapel", 1, 3, 2, 3, "side_chapel"), r("east_chapel", 7, 3, 2, 3, "side_chapel"), r("crypt_under_idol", 3, 7, 4, 2, "crypt")],
    corridors: [c(0, 4, 10, 2, "cross_axis"), c(4, 5, 2, 5, "south_descent")],
    doors: [d("idol_hall", "west"), d("west_chapel", "east"), d("east_chapel", "west"), d("crypt_under_idol", "north")]
  }),
  geomorph({
    key: "oracle_suite_10_a", label: "Oracle Suite A", category: "religious", exits: ["east", "south"], tags: ["oracle", "secret", "religious"],
    sourceNotes: [sources.arden],
    rooms: [r("waiting_room", 1, 6, 4, 3, "waiting_room"), r("oracle_cell", 5, 4, 3, 3, "oracle_cell"), r("hidden_listener", 7, 1, 2, 2, "hidden_listener")],
    corridors: [c(4, 7, 6, 2, "public_hall"), c(6, 3, 2, 6, "inner_passage")],
    doors: [d("waiting_room", "east"), d("oracle_cell", "south"), d("hidden_listener", "south", "corridor", "secret")]
  }),
  geomorph({
    key: "cult_vestry_10_a", label: "Cult Vestry A", category: "religious", exits: ["north", "west"], tags: ["cult", "storage", "backstage"],
    sourceNotes: [sources.arden],
    rooms: [r("vestment_room", 2, 1, 3, 3, "vestment_room"), r("offering_store", 6, 1, 3, 3, "offering_store"), r("ritual_prep", 2, 5, 6, 3, "ritual_prep")],
    corridors: [c(4, 0, 2, 5, "north_entry"), c(0, 5, 10, 2, "service_hall")],
    doors: [d("vestment_room", "south"), d("offering_store", "south"), d("ritual_prep", "north")]
  }),
  geomorph({
    key: "moon_sun_shrine_10_a", label: "Moon Sun Shrine A", category: "religious", exits: ["west", "east"], tags: ["paired_rooms", "shrine", "ritual"],
    sourceNotes: [sources.arden],
    rooms: [r("moon_room", 1, 2, 3, 5, "moon_shrine"), r("sun_room", 6, 2, 3, 5, "sun_shrine"), r("middle_altar", 3, 4, 4, 2, "shared_altar")],
    corridors: [c(0, 4, 10, 2, "east_west_axis")],
    doors: [d("moon_room", "east"), d("sun_room", "west"), d("middle_altar", "north")]
  }),
  geomorph({
    key: "ritual_octagon_20_a", label: "Ritual Octagon A", size: 20, category: "religious", exits: ["north", "east", "south", "west"], tags: ["set_piece", "ritual", "arden"],
    sourceNotes: [sources.arden],
    rooms: [r("ritual_hall", 6, 6, 8, 8, "ritual_octagon"), r("north_vestry", 8, 2, 4, 3, "vestry"), r("east_font", 15, 8, 3, 4, "font_room"), r("south_reliquary", 8, 15, 4, 3, "reliquary"), r("west_cells", 2, 8, 3, 4, "penitent_cells")],
    corridors: [c(9, 0, 2, 20, "north_south_axis"), c(0, 9, 20, 2, "east_west_axis")],
    doors: [d("ritual_hall", "north"), d("ritual_hall", "east"), d("ritual_hall", "south"), d("ritual_hall", "west"), d("north_vestry", "south"), d("east_font", "west"), d("south_reliquary", "north"), d("west_cells", "east")]
  }),
  geomorph({
    key: "columned_hall_20_a", label: "Columned Hall A", size: 20, category: "architectural", exits: ["north", "east", "south", "west"], tags: ["set_piece", "columns", "arden"],
    sourceNotes: [sources.arden],
    rooms: [r("column_hall", 3, 4, 14, 10, "columned_hall"), r("north_balcony", 6, 1, 8, 2, "balcony"), r("south_annex", 6, 15, 8, 3, "annex")],
    corridors: [c(9, 0, 2, 20, "central_axis"), c(0, 8, 20, 3, "transverse_hall")],
    doors: [d("column_hall", "north"), d("column_hall", "south"), d("north_balcony", "south"), d("south_annex", "north")]
  }),
  geomorph({
    key: "audience_hall_20_a", label: "Audience Hall A", size: 20, category: "architectural", exits: ["west", "east", "south"], tags: ["set_piece", "throne", "arden"],
    sourceNotes: [sources.arden],
    rooms: [r("audience_hall", 3, 5, 12, 8, "audience_hall"), r("dais", 15, 7, 3, 4, "dais"), r("guardroom", 2, 14, 5, 4, "guardroom"), r("records", 9, 14, 5, 4, "records_room")],
    corridors: [c(0, 8, 20, 2, "processional_hall"), c(5, 12, 2, 8, "south_service"), c(11, 12, 2, 8, "south_service")],
    doors: [d("audience_hall", "east"), d("dais", "west"), d("guardroom", "north"), d("records", "north")]
  }),
  geomorph({
    key: "forum_segment_20_a", label: "Forum Segment A", size: 20, category: "architectural", exits: ["north", "east", "west"], tags: ["open_hall", "market", "arden"],
    sourceNotes: [sources.arden],
    rooms: [r("forum_floor", 4, 4, 10, 8, "forum"), r("stall_row_north", 3, 1, 12, 2, "market_stalls"), r("office_west", 1, 6, 2, 4, "office"), r("office_east", 15, 6, 3, 4, "office"), r("counting_room", 7, 13, 4, 3, "counting_room")],
    corridors: [c(0, 8, 20, 2, "east_west_street"), c(9, 0, 2, 12, "north_entry")],
    doors: [d("forum_floor", "north"), d("forum_floor", "west"), d("forum_floor", "east"), d("counting_room", "north")]
  }),
  geomorph({
    key: "barracks_block_10_a", label: "Barracks Block A", category: "living", exits: ["west", "east"], tags: ["barracks", "dense", "living"],
    sourceNotes: [sources.arden, sources.barrowmaze],
    rooms: [r("north_bunks", 1, 1, 8, 2, "bunks"), r("south_bunks", 1, 7, 8, 2, "bunks"), r("armory_niche", 4, 4, 2, 2, "armory_niche")],
    corridors: [c(0, 4, 10, 2, "central_hall"), c(2, 3, 2, 4, "west_bunk_link"), c(6, 3, 2, 4, "east_bunk_link")],
    doors: [d("north_bunks", "south"), d("south_bunks", "north"), d("armory_niche", "west")]
  }),
  geomorph({
    key: "guard_post_10_a", label: "Guard Post A", category: "military", exits: ["north", "south", "east"], tags: ["guard", "checkpoint", "living"],
    sourceNotes: [sources.arden],
    rooms: [r("watch_room", 1, 2, 3, 4, "watch_room"), r("ready_room", 5, 1, 4, 3, "ready_room"), r("cells", 5, 6, 4, 3, "holding_cells")],
    corridors: [c(4, 0, 2, 10, "guarded_passage"), c(4, 4, 6, 2, "east_sally")],
    doors: [d("watch_room", "east"), d("ready_room", "south"), d("cells", "north", "corridor", "locked")]
  }),
  geomorph({
    key: "mess_hall_10_a", label: "Mess Hall A", category: "living", exits: ["west", "south"], tags: ["mess", "service", "living"],
    sourceNotes: [sources.arden],
    rooms: [r("mess", 1, 1, 7, 4, "mess_hall"), r("kitchen", 1, 6, 4, 3, "kitchen"), r("pantry", 6, 6, 2, 3, "pantry")],
    corridors: [c(0, 4, 9, 2, "entry_hall"), c(4, 5, 2, 5, "service_hall")],
    doors: [d("mess", "south"), d("kitchen", "north"), d("pantry", "west")]
  }),
  geomorph({
    key: "bedroom_suite_10_a", label: "Bedroom Suite A", category: "living", exits: ["north", "east"], tags: ["bedrooms", "suite", "living"],
    sourceNotes: [sources.arden],
    rooms: [r("main_room", 2, 2, 4, 4, "bedroom"), r("closet", 6, 2, 2, 2, "closet"), r("study", 2, 6, 3, 3, "study"), r("privy", 6, 6, 2, 2, "privy")],
    corridors: [c(4, 0, 2, 3, "north_entry"), c(5, 4, 5, 2, "east_hall"), c(4, 4, 2, 5, "inner_hall")],
    doors: [d("main_room", "north"), d("closet", "west"), d("study", "east"), d("privy", "west")]
  }),
  geomorph({
    key: "library_stacks_10_a", label: "Library Stacks A", category: "knowledge", exits: ["west", "east"], tags: ["library", "stacks", "arden"],
    sourceNotes: [sources.arden],
    rooms: [r("reading_room", 1, 2, 4, 5, "reading_room"), r("stack_room", 6, 1, 3, 7, "stacks"), r("scribe_cell", 2, 7, 3, 2, "scribe_cell")],
    corridors: [c(0, 4, 10, 2, "library_hall"), c(5, 1, 1, 8, "stack_aisle")],
    doors: [d("reading_room", "east"), d("stack_room", "west"), d("scribe_cell", "north")]
  }),
  geomorph({
    key: "scriptorium_10_a", label: "Scriptorium A", category: "knowledge", exits: ["north", "south"], tags: ["scribe", "records", "quiet"],
    sourceNotes: [sources.arden],
    rooms: [r("scribe_hall", 2, 2, 6, 4, "scriptorium"), r("ink_room", 1, 7, 3, 2, "ink_room"), r("record_cell", 6, 7, 3, 2, "record_cell")],
    corridors: [c(4, 0, 2, 10, "quiet_axis"), c(0, 7, 10, 2, "archive_link")],
    doors: [d("scribe_hall", "south"), d("ink_room", "east"), d("record_cell", "west")]
  }),
  geomorph({
    key: "forge_workshop_10_a", label: "Forge Workshop A", category: "workshops", exits: ["west", "south"], tags: ["forge", "workshop", "service"],
    sourceNotes: [sources.arden],
    rooms: [r("forge", 1, 1, 4, 4, "forge"), r("workshop", 5, 1, 4, 5, "workshop"), r("coal_room", 1, 6, 3, 3, "coal_room"), r("tool_room", 5, 7, 3, 2, "tool_room")],
    corridors: [c(0, 5, 10, 2, "service_hall"), c(4, 5, 2, 5, "south_service")],
    doors: [d("forge", "south"), d("workshop", "south"), d("coal_room", "east"), d("tool_room", "north")]
  }),
  geomorph({
    key: "armory_vault_10_a", label: "Armory Vault A", category: "military", exits: ["north", "west"], tags: ["armory", "locked", "storage"],
    sourceNotes: [sources.arden],
    rooms: [r("outer_armory", 2, 1, 5, 4, "armory"), r("locked_vault", 2, 6, 5, 3, "weapon_vault"), r("guard_niche", 7, 3, 2, 3, "guard_niche")],
    corridors: [c(4, 0, 2, 10, "secure_axis"), c(0, 4, 8, 2, "west_checkpoint")],
    doors: [d("outer_armory", "south"), d("locked_vault", "north", "corridor", "locked"), d("guard_niche", "west")]
  }),
  geomorph({
    key: "storehouse_10_a", label: "Storehouse A", category: "workshops", exits: ["east", "south"], tags: ["storage", "crates", "service"],
    sourceNotes: [sources.arden],
    rooms: [r("bulk_store", 1, 1, 6, 4, "bulk_store"), r("dry_store", 1, 6, 4, 3, "dry_store"), r("locked_store", 6, 6, 3, 3, "locked_store")],
    corridors: [c(6, 4, 4, 2, "east_hall"), c(4, 5, 2, 5, "south_hall")],
    doors: [d("bulk_store", "east"), d("dry_store", "east"), d("locked_store", "west", "corridor", "locked")]
  }),
  geomorph({
    key: "cistern_service_20_a", label: "Cistern Service A", size: 20, category: "infrastructure", exits: ["north", "south", "east"], tags: ["water", "service", "arden"],
    sourceNotes: [sources.arden],
    rooms: [r("cistern", 5, 5, 8, 8, "cistern", ["water"]), r("pump_room", 14, 6, 4, 4, "pump_room"), r("sluice_room", 5, 14, 5, 3, "sluice_room"), r("maintenance", 1, 7, 3, 4, "maintenance")],
    corridors: [c(9, 0, 2, 20, "service_axis"), c(10, 8, 10, 2, "east_channel")],
    doors: [d("cistern", "east"), d("pump_room", "west"), d("sluice_room", "north"), d("maintenance", "east")]
  }),
  geomorph({
    key: "kitchen_service_20_a", label: "Kitchen Service A", size: 20, category: "living", exits: ["west", "east", "south"], tags: ["kitchen", "servants", "arden"],
    sourceNotes: [sources.arden],
    rooms: [r("great_kitchen", 3, 4, 7, 6, "great_kitchen"), r("servants_hall", 11, 4, 6, 5, "servants_hall"), r("larder", 3, 12, 5, 4, "larder"), r("scullery", 10, 12, 4, 4, "scullery"), r("rear_store", 15, 12, 3, 4, "rear_store")],
    corridors: [c(0, 8, 20, 2, "service_street"), c(8, 9, 2, 11, "south_service")],
    doors: [d("great_kitchen", "east"), d("servants_hall", "west"), d("larder", "north"), d("scullery", "north"), d("rear_store", "north")]
  }),
  geomorph({
    key: "ruined_court_20_a", label: "Ruined Court A", size: 20, category: "ruins", exits: ["north", "east", "south", "west"], tags: ["ruined", "open", "arden"],
    sourceNotes: [sources.arden],
    rooms: [r("broken_court", 4, 4, 10, 9, "ruined_court"), r("fallen_gallery", 2, 1, 5, 2, "fallen_gallery"), r("intact_room", 15, 5, 3, 5, "intact_room"), r("sinkhole", 7, 14, 4, 3, "sinkhole")],
    corridors: [c(0, 8, 20, 2, "broken_axis"), c(9, 0, 2, 20, "cracked_axis")],
    doors: [d("broken_court", "north"), d("broken_court", "east"), d("broken_court", "south"), d("intact_room", "west")]
  }),
  geomorph({
    key: "cave_intrusion_20_a", label: "Cave Intrusion A", size: 20, category: "cavern", exits: ["west", "east", "south"], tags: ["cave", "built_edge", "transition"],
    sourceNotes: [sources.arden],
    rooms: [r("rough_cave", 2, 4, 8, 9, "rough_cave"), r("masonry_room", 12, 3, 5, 5, "masonry_room"), r("collapsed_room", 12, 10, 5, 5, "collapsed_room"), r("pool", 5, 14, 4, 3, "pool", ["water"])],
    corridors: [c(0, 8, 20, 2, "cave_hall"), c(9, 8, 2, 12, "rough_south_path")],
    doors: [d("rough_cave", "east"), d("masonry_room", "west"), d("collapsed_room", "west"), d("pool", "north")]
  }),
  geomorph({
    key: "flooded_vault_10_a", label: "Flooded Vault A", category: "cavern", exits: ["north", "east"], tags: ["water", "vault", "hazard"],
    sourceNotes: [sources.arden],
    rooms: [r("flooded_room", 2, 2, 5, 5, "flooded_vault", ["water"]), r("dry_ledge", 7, 2, 2, 3, "dry_ledge"), r("blocked_store", 2, 7, 3, 2, "blocked_store")],
    corridors: [c(4, 0, 2, 10, "north_channel"), c(6, 4, 4, 2, "east_channel")],
    doors: [d("flooded_room", "north"), d("dry_ledge", "west"), d("blocked_store", "north")]
  }),
  geomorph({
    key: "stair_court_10_a", label: "Stair Court A", category: "vertical", exits: ["north", "east", "south"], tags: ["stairs", "vertical", "arden"],
    sourceNotes: [sources.arden],
    rooms: [r("stair_court", 2, 2, 5, 5, "stair_court"), r("guard_room", 7, 3, 2, 3, "guard_room"), r("landing_room", 2, 7, 4, 2, "landing_room")],
    corridors: [c(4, 0, 2, 10, "stair_axis"), c(6, 4, 4, 2, "east_exit")],
    doors: [d("stair_court", "east"), d("guard_room", "west"), d("landing_room", "north")]
  }),
  geomorph({
    key: "lift_lobby_10_a", label: "Lift Lobby A", category: "vertical", exits: ["west", "east"], tags: ["lift", "vertical", "checkpoint"],
    sourceNotes: [sources.arden],
    rooms: [r("lift_room", 3, 2, 4, 4, "lift_room"), r("machine_room", 1, 7, 3, 2, "machine_room"), r("operator_cell", 6, 7, 3, 2, "operator_cell")],
    corridors: [c(0, 4, 10, 2, "lobby_hall"), c(4, 5, 2, 5, "service_drop")],
    doors: [d("lift_room", "south"), d("machine_room", "east"), d("operator_cell", "west")]
  }),
  geomorph({
    key: "ziggurat_approach_20_a", label: "Ziggurat Approach A", size: 20, category: "religious", exits: ["south", "east", "west"], tags: ["processional", "stairs", "set_piece"],
    sourceNotes: [sources.arden],
    rooms: [r("lower_hall", 2, 13, 16, 4, "lower_hall"), r("stairway", 7, 7, 6, 6, "wide_stairs"), r("upper_landing", 5, 3, 10, 3, "upper_landing"), r("side_chamber_w", 1, 7, 4, 3, "side_chamber"), r("side_chamber_e", 15, 7, 4, 3, "side_chamber")],
    corridors: [c(0, 14, 20, 2, "lower_processional"), c(9, 0, 2, 20, "center_axis")],
    doors: [d("lower_hall", "north"), d("stairway", "north"), d("upper_landing", "south"), d("side_chamber_w", "east"), d("side_chamber_e", "west")]
  }),
  geomorph({
    key: "bridge_chasm_hall_20_a", label: "Bridge Chasm Hall A", size: 20, category: "hazard", exits: ["west", "east"], tags: ["chasm", "bridge", "arden"],
    sourceNotes: [sources.arden],
    rooms: [r("west_landing", 1, 6, 5, 6, "landing"), r("east_landing", 14, 6, 5, 6, "landing"), r("lower_watch", 8, 13, 4, 3, "lower_watch")],
    corridors: [c(0, 8, 20, 2, "bridge"), c(9, 9, 2, 8, "drop_stairs")],
    doors: [d("west_landing", "east"), d("east_landing", "west"), d("lower_watch", "north")]
  }),
  geomorph({
    key: "vault_branch_10_a", label: "Vault Branch A", category: "treasure", exits: ["north", "west"], tags: ["vaults", "locked", "branch"],
    sourceNotes: [sources.barrowmaze, sources.arden],
    rooms: [r("outer_vault", 2, 1, 5, 3, "outer_vault"), r("treasure_room", 2, 5, 4, 4, "treasure_room"), r("secret_cache", 7, 6, 2, 2, "secret_cache")],
    corridors: [c(4, 0, 2, 10, "secure_spine"), c(0, 4, 6, 2, "west_access")],
    doors: [d("outer_vault", "south", "corridor", "locked"), d("treasure_room", "north", "corridor", "locked"), d("secret_cache", "west", "treasure_room", "secret")]
  }),
  geomorph({
    key: "prison_cells_10_a", label: "Prison Cells A", category: "prison", exits: ["west", "east"], tags: ["cells", "dense", "barrowmaze"],
    sourceNotes: [sources.arden, sources.barrowmaze],
    rooms: [r("cell_a", 1, 1, 2, 2, "cell"), r("cell_b", 1, 4, 2, 2, "cell"), r("cell_c", 1, 7, 2, 2, "cell"), r("cell_d", 7, 1, 2, 2, "cell"), r("cell_e", 7, 4, 2, 2, "cell"), r("cell_f", 7, 7, 2, 2, "cell")],
    corridors: [c(3, 0, 4, 10, "cellblock_hall"), c(0, 4, 10, 2, "cross_access")],
    doors: [d("cell_a", "east", "corridor", "locked"), d("cell_b", "east", "corridor", "locked"), d("cell_c", "east", "corridor", "locked"), d("cell_d", "west", "corridor", "locked"), d("cell_e", "west", "corridor", "locked"), d("cell_f", "west", "corridor", "locked")]
  }),
  geomorph({
    key: "laboratory_10_a", label: "Laboratory A", category: "arcane", exits: ["north", "south", "east"], tags: ["laboratory", "hazard", "arden"],
    sourceNotes: [sources.arden],
    rooms: [r("lab", 2, 1, 5, 5, "laboratory"), r("specimen_room", 7, 2, 2, 3, "specimen_room"), r("storage", 2, 7, 4, 2, "storage")],
    corridors: [c(4, 0, 2, 10, "lab_axis"), c(6, 4, 4, 2, "east_access")],
    doors: [d("lab", "south"), d("specimen_room", "west", "corridor", "locked"), d("storage", "north")]
  }),
  geomorph({
    key: "summoning_ring_10_a", label: "Summoning Ring A", category: "arcane", exits: ["west", "south"], tags: ["summoning", "circle", "danger"],
    sourceNotes: [sources.arden],
    rooms: [r("ring_room", 2, 2, 6, 6, "summoning_ring"), r("candle_store", 1, 7, 2, 2, "candle_store"), r("chalk_room", 7, 7, 2, 2, "chalk_room")],
    corridors: [c(0, 4, 10, 2, "ritual_access"), c(4, 5, 2, 5, "south_exit")],
    doors: [d("ring_room", "west"), d("candle_store", "east"), d("chalk_room", "west")]
  }),
  geomorph({
    key: "alchemical_suite_20_a", label: "Alchemical Suite A", size: 20, category: "arcane", exits: ["north", "east", "south"], tags: ["alchemy", "workshop", "arden"],
    sourceNotes: [sources.arden],
    rooms: [r("main_lab", 4, 4, 7, 6, "main_lab"), r("fume_room", 12, 4, 5, 4, "fume_room"), r("cold_room", 4, 12, 5, 4, "cold_room"), r("ingredient_store", 10, 12, 4, 4, "ingredient_store"), r("sealed_vault", 15, 11, 3, 5, "sealed_vault")],
    corridors: [c(9, 0, 2, 20, "lab_axis"), c(8, 8, 12, 2, "east_service")],
    doors: [d("main_lab", "east"), d("fume_room", "west"), d("cold_room", "north"), d("ingredient_store", "north"), d("sealed_vault", "west", "corridor", "locked")]
  }),
  geomorph({
    key: "banquet_hall_20_a", label: "Banquet Hall A", size: 20, category: "living", exits: ["west", "east", "south"], tags: ["banquet", "social", "arden"],
    sourceNotes: [sources.arden],
    rooms: [r("banquet_hall", 3, 4, 12, 7, "banquet_hall"), r("dais", 15, 5, 3, 4, "dais"), r("kitchen_access", 4, 13, 5, 4, "kitchen_access"), r("serving_room", 10, 13, 5, 4, "serving_room")],
    corridors: [c(0, 7, 20, 2, "feast_axis"), c(8, 10, 2, 10, "south_service")],
    doors: [d("banquet_hall", "south"), d("dais", "west"), d("kitchen_access", "north"), d("serving_room", "north")]
  }),
  geomorph({
    key: "bathing_halls_20_a", label: "Bathing Halls A", size: 20, category: "living", exits: ["north", "west"], tags: ["baths", "water", "luxury"],
    sourceNotes: [sources.arden],
    rooms: [r("warm_pool", 4, 4, 5, 5, "warm_pool", ["water"]), r("cold_pool", 11, 4, 5, 5, "cold_pool", ["water"]), r("changing_room", 3, 11, 6, 4, "changing_room"), r("steam_room", 11, 11, 5, 4, "steam_room")],
    corridors: [c(9, 0, 2, 16, "bath_axis"), c(0, 9, 20, 2, "service_walk")],
    doors: [d("warm_pool", "east"), d("cold_pool", "west"), d("changing_room", "north"), d("steam_room", "north")]
  }),
  geomorph({
    key: "noble_apartments_20_a", label: "Noble Apartments A", size: 20, category: "living", exits: ["west", "south"], tags: ["apartments", "suite", "arden"],
    sourceNotes: [sources.arden],
    rooms: [r("salon", 3, 4, 6, 5, "salon"), r("bedroom", 10, 3, 5, 5, "bedroom"), r("study", 3, 11, 5, 4, "study"), r("wardrobe", 10, 10, 3, 3, "wardrobe"), r("private_shrine", 14, 10, 3, 4, "private_shrine")],
    corridors: [c(0, 8, 16, 2, "apartment_hall"), c(8, 8, 2, 12, "south_escape")],
    doors: [d("salon", "east"), d("bedroom", "west"), d("study", "north"), d("wardrobe", "west"), d("private_shrine", "west")]
  }),
  geomorph({
    key: "market_vaults_20_a", label: "Market Vaults A", size: 20, category: "trade", exits: ["north", "east", "west"], tags: ["trade", "vaults", "market"],
    sourceNotes: [sources.arden],
    rooms: [r("market_hall", 3, 5, 10, 5, "market_hall"), r("vault_a", 2, 12, 3, 4, "vault"), r("vault_b", 6, 12, 3, 4, "vault"), r("vault_c", 10, 12, 3, 4, "vault"), r("counting_house", 14, 5, 4, 4, "counting_house")],
    corridors: [c(0, 7, 20, 2, "market_street"), c(8, 0, 2, 17, "north_south_aisle")],
    doors: [d("market_hall", "south"), d("vault_a", "north", "corridor", "locked"), d("vault_b", "north", "corridor", "locked"), d("vault_c", "north", "corridor", "locked"), d("counting_house", "west")]
  }),
  geomorph({
    key: "chapel_ring_20_a", label: "Chapel Ring A", size: 20, category: "religious", exits: ["north", "east", "south", "west"], tags: ["chapels", "ring", "barrowmaze"],
    sourceNotes: [sources.barrowmaze, sources.arden],
    rooms: [r("central_chapel", 7, 7, 6, 6, "central_chapel"), r("north_chapel", 7, 2, 6, 3, "side_chapel"), r("east_chapel", 15, 7, 3, 6, "side_chapel"), r("south_chapel", 7, 15, 6, 3, "side_chapel"), r("west_chapel", 2, 7, 3, 6, "side_chapel")],
    corridors: [c(9, 0, 2, 20, "north_south_axis"), c(0, 9, 20, 2, "east_west_axis"), c(5, 5, 10, 10, "ring_walk")],
    doors: [d("central_chapel", "north"), d("central_chapel", "east"), d("central_chapel", "south"), d("central_chapel", "west")]
  }),
  geomorph({
    key: "undercrypt_neighborhood_20_a", label: "Undercrypt Neighborhood A", size: 20, category: "tombs", exits: ["north", "south", "east", "west"], tags: ["crypt", "neighborhood", "dense"],
    sourceNotes: [sources.barrowmaze],
    rooms: [r("crypt_a", 1, 1, 4, 3, "crypt"), r("crypt_b", 6, 1, 4, 3, "crypt"), r("crypt_c", 12, 1, 4, 3, "crypt"), r("ossuary", 2, 7, 5, 5, "ossuary"), r("shrine", 9, 7, 4, 4, "shrine"), r("sealed_tomb", 14, 8, 4, 4, "sealed_tomb"), r("crypt_d", 3, 14, 5, 3, "crypt"), r("crypt_e", 11, 14, 5, 3, "crypt")],
    corridors: [c(0, 5, 20, 2, "upper_hall"), c(0, 12, 20, 2, "lower_hall"), c(9, 0, 2, 20, "cross_spine")],
    doors: [d("crypt_a", "south"), d("crypt_b", "south"), d("crypt_c", "south"), d("ossuary", "east"), d("shrine", "north"), d("sealed_tomb", "west", "corridor", "locked"), d("crypt_d", "north"), d("crypt_e", "north")]
  }),
  geomorph({
    key: "dwarven_work_yard_20_a", label: "Dwarven Work Yard A", size: 20, category: "workshops", exits: ["north", "east", "west"], tags: ["work_yard", "forge", "ordered"],
    sourceNotes: [sources.arden],
    rooms: [r("work_yard", 4, 5, 9, 7, "work_yard"), r("forge_bay", 1, 3, 3, 5, "forge_bay"), r("stone_shop", 14, 3, 4, 5, "stone_shop"), r("tool_vault", 4, 13, 4, 3, "tool_vault"), r("crew_room", 10, 13, 5, 3, "crew_room")],
    corridors: [c(0, 8, 20, 2, "work_street"), c(8, 0, 2, 16, "cart_aisle")],
    doors: [d("work_yard", "west"), d("work_yard", "east"), d("tool_vault", "north", "corridor", "locked"), d("crew_room", "north")]
  }),
  geomorph({
    key: "collapsed_gallery_20_a", label: "Collapsed Gallery A", size: 20, category: "ruins", exits: ["west", "east", "south"], tags: ["collapsed", "gallery", "hazard"],
    sourceNotes: [sources.arden],
    rooms: [r("intact_gallery", 2, 4, 8, 4, "gallery"), r("collapse_zone", 10, 5, 5, 5, "collapse_zone"), r("side_room", 4, 11, 4, 4, "side_room"), r("crawlspace", 14, 12, 3, 3, "crawlspace")],
    corridors: [c(0, 6, 20, 2, "damaged_hall"), c(8, 7, 2, 13, "south_detour")],
    doors: [d("intact_gallery", "south"), d("side_room", "north"), d("crawlspace", "west", "corridor", "secret")]
  }),
  geomorph({
    key: "subterranean_garden_20_a", label: "Subterranean Garden A", size: 20, category: "cavern", exits: ["north", "east", "south"], tags: ["garden", "cavern", "open"],
    sourceNotes: [sources.arden],
    rooms: [r("garden_cave", 3, 3, 10, 10, "garden_cave"), r("tool_shed", 14, 4, 3, 3, "tool_shed"), r("well_room", 5, 14, 4, 3, "well_room"), r("root_tunnel", 14, 12, 4, 3, "root_tunnel")],
    corridors: [c(8, 0, 2, 20, "north_south_path"), c(9, 8, 11, 2, "east_path")],
    doors: [d("garden_cave", "east"), d("tool_shed", "west"), d("well_room", "north"), d("root_tunnel", "west")]
  }),
  geomorph({
    key: "mosaic_crossing_20_a", label: "Mosaic Crossing A", size: 20, category: "architectural", exits: ["north", "east", "south", "west"], tags: ["crossing", "formal", "arden"],
    sourceNotes: [sources.arden],
    rooms: [r("mosaic_hall", 5, 5, 10, 10, "mosaic_hall"), r("north_guard", 7, 2, 6, 2, "guard_room"), r("east_store", 16, 7, 2, 6, "store"), r("south_guard", 7, 16, 6, 2, "guard_room"), r("west_store", 2, 7, 2, 6, "store")],
    corridors: [c(9, 0, 2, 20, "north_south_axis"), c(0, 9, 20, 2, "east_west_axis")],
    doors: [d("mosaic_hall", "north"), d("mosaic_hall", "east"), d("mosaic_hall", "south"), d("mosaic_hall", "west")]
  }),
  geomorph({
    key: "lost_throne_block_20_a", label: "Lost Throne Block A", size: 20, category: "architectural", exits: ["north", "east", "south", "west"], sockets: [s("north", 4), s("east", 4), s("south", 14), s("west", 14)], tags: ["landmark", "throne", "lost_civilization", "formal"],
    sourceNotes: [sources.arden, sources.geomorph],
    rooms: [r("throne_hall", 4, 4, 10, 8, "throne_hall"), r("antechamber", 5, 14, 8, 3, "antechamber"), r("west_guard", 1, 10, 3, 4, "guard_room"), r("east_gallery", 15, 3, 3, 6, "gallery")],
    corridors: [c(4, 0, 2, 6, "north_procession"), c(5, 12, 2, 8, "south_procession"), c(0, 14, 6, 2, "west_entry"), c(14, 4, 6, 2, "east_gallery_link")],
    doors: [d("throne_hall", "north"), d("throne_hall", "south"), d("antechamber", "north"), d("west_guard", "east"), d("east_gallery", "west")]
  }),
  geomorph({
    key: "barrow_king_complex_20_a", label: "Barrow King Complex A", size: 20, category: "tombs", exits: ["north", "east", "south"], sockets: [s("north", 4), s("east", 14), s("south", 4)], tags: ["landmark", "barrow", "tomb", "sealed"],
    sourceNotes: [sources.barrowmaze, sources.geomorph],
    rooms: [r("king_tomb", 5, 5, 7, 7, "royal_tomb"), r("offering_room", 3, 14, 5, 3, "offering_room"), r("east_crypts", 13, 11, 4, 6, "burial_cells"), r("north_approach", 3, 1, 5, 3, "antechamber")],
    corridors: [c(4, 0, 2, 7, "north_entry"), c(4, 11, 2, 9, "south_axis"), c(11, 14, 9, 2, "east_crypt_link")],
    doors: [d("king_tomb", "north", "corridor", "locked"), d("king_tomb", "south"), d("offering_room", "north"), d("east_crypts", "west"), d("north_approach", "south")]
  }),
  geomorph({
    key: "temple_nave_block_20_a", label: "Temple Nave Block A", size: 20, category: "religious", exits: ["north", "east", "south", "west"], sockets: [s("north", 14), s("east", 4), s("south", 14), s("west", 4)], tags: ["landmark", "temple", "processional", "chapels"],
    sourceNotes: [sources.arden, sources.geomorph],
    rooms: [r("nave", 5, 3, 10, 10, "temple_nave"), r("left_chapel", 1, 5, 3, 4, "side_chapel"), r("right_chapel", 16, 5, 3, 4, "side_chapel"), r("reliquary", 7, 14, 6, 3, "reliquary")],
    corridors: [c(14, 0, 2, 20, "temple_axis"), c(0, 4, 20, 2, "cross_aisle")],
    doors: [d("nave", "north"), d("nave", "south"), d("left_chapel", "east"), d("right_chapel", "west"), d("reliquary", "north", "corridor", "locked")]
  }),
  geomorph({
    key: "great_cistern_20_a", label: "Great Cistern A", size: 20, category: "infrastructure", exits: ["west", "east", "south"], sockets: [s("west", 4), s("east", 14), s("south", 14)], tags: ["landmark", "water", "cistern", "flooded"],
    sourceNotes: [sources.arden, sources.geomorph],
    rooms: [r("cistern_pool", 5, 5, 9, 8, "cistern_pool", ["flooded"]), r("pump_room", 2, 14, 4, 3, "pump_room"), r("sluice_room", 15, 11, 3, 5, "sluice_room"), r("north_walkway", 6, 2, 8, 2, "walkway")],
    corridors: [c(0, 4, 20, 2, "west_east_walkway"), c(14, 4, 2, 16, "sluice_axis")],
    doors: [d("cistern_pool", "north"), d("pump_room", "east"), d("sluice_room", "west"), d("north_walkway", "south")]
  }),
  geomorph({
    key: "barracks_yard_20_a", label: "Barracks Yard A", size: 20, category: "military", exits: ["north", "east", "south", "west"], sockets: [s("north", 4), s("east", 4), s("south", 14), s("west", 14)], tags: ["landmark", "barracks", "military", "yard"],
    sourceNotes: [sources.arden, sources.geomorph],
    rooms: [r("drill_yard", 5, 5, 8, 7, "drill_yard"), r("north_bunks", 2, 1, 8, 3, "barracks"), r("armory", 14, 3, 4, 4, "armory"), r("mess", 2, 14, 7, 3, "mess"), r("watch_office", 14, 13, 4, 4, "office")],
    corridors: [c(4, 0, 2, 20, "north_south_route"), c(0, 14, 20, 2, "yard_crossroute"), c(12, 4, 8, 2, "east_gate")],
    doors: [d("north_bunks", "south"), d("armory", "west", "corridor", "locked"), d("mess", "north"), d("watch_office", "west")]
  }),
  geomorph({
    key: "archive_stack_block_20_a", label: "Archive Stack Block A", size: 20, category: "knowledge", exits: ["north", "east", "west"], sockets: [s("north", 14), s("east", 14), s("west", 4)], tags: ["landmark", "library", "archives", "secret"],
    sourceNotes: [sources.arden, sources.geomorph],
    rooms: [r("reading_room", 5, 5, 7, 5, "reading_room"), r("west_stacks", 1, 2, 3, 10, "stacks"), r("east_stacks", 14, 8, 4, 8, "stacks"), r("sealed_records", 6, 13, 5, 3, "sealed_records")],
    corridors: [c(14, 0, 2, 16, "stack_spine"), c(0, 4, 16, 2, "west_gallery"), c(11, 14, 9, 2, "east_gallery")],
    doors: [d("reading_room", "north"), d("west_stacks", "east"), d("east_stacks", "west"), d("sealed_records", "north", "corridor", "secret")]
  }),
  geomorph({
    key: "forge_hall_20_a", label: "Forge Hall A", size: 20, category: "workshops", exits: ["east", "south", "west"], sockets: [s("east", 4), s("south", 14), s("west", 14)], tags: ["landmark", "forge", "workshop", "ordered"],
    sourceNotes: [sources.arden, sources.geomorph],
    rooms: [r("forge_floor", 5, 5, 8, 6, "forge_floor"), r("coal_room", 1, 13, 4, 4, "coal_room"), r("tool_cage", 14, 2, 4, 4, "tool_cage"), r("master_shop", 10, 13, 6, 4, "master_shop")],
    corridors: [c(0, 14, 20, 2, "cart_lane"), c(14, 4, 6, 2, "east_loading"), c(14, 4, 2, 12, "shop_axis")],
    doors: [d("forge_floor", "south"), d("coal_room", "east"), d("tool_cage", "west", "corridor", "locked"), d("master_shop", "north")]
  }),
  geomorph({
    key: "flooded_shrine_20_a", label: "Flooded Shrine A", size: 20, category: "religious", exits: ["north", "east", "south"], sockets: [s("north", 4), s("east", 14), s("south", 14)], tags: ["landmark", "flooded", "shrine", "water"],
    sourceNotes: [sources.arden, sources.geomorph],
    rooms: [r("sunken_shrine", 5, 5, 8, 8, "sunken_shrine", ["flooded"]), r("dry_narthex", 2, 2, 5, 3, "narthex"), r("east_pool", 14, 11, 4, 5, "pool"), r("lower_vestry", 7, 15, 5, 3, "vestry")],
    corridors: [c(4, 0, 2, 8, "north_steps"), c(12, 14, 8, 2, "east_causeway"), c(14, 12, 2, 8, "south_causeway")],
    doors: [d("sunken_shrine", "north"), d("sunken_shrine", "east"), d("dry_narthex", "south"), d("east_pool", "west"), d("lower_vestry", "north")]
  }),
  geomorph({
    key: "cavern_lake_landmark_20_a", label: "Cavern Lake Landmark A", size: 20, category: "cavern", exits: ["north", "east", "west"], sockets: [s("north", 14), s("east", 4), s("west", 14)], tags: ["landmark", "cavern", "lake", "organic"],
    sourceNotes: [sources.arden, sources.geomorph],
    rooms: [r("lake_cavern", 5, 5, 9, 8, "lake_cavern", ["flooded"]), r("west_landing", 1, 11, 4, 4, "rough_landing"), r("east_landing", 14, 2, 4, 5, "rough_landing"), r("upper_cave", 10, 1, 4, 3, "upper_cave")],
    corridors: [c(14, 0, 2, 8, "north_path"), c(12, 4, 8, 2, "east_path"), c(0, 14, 8, 2, "west_path")],
    doors: [d("lake_cavern", "north"), d("lake_cavern", "west"), d("west_landing", "east"), d("east_landing", "west"), d("upper_cave", "south")]
  }),
  geomorph({
    key: "summoning_court_20_a", label: "Summoning Court A", size: 20, category: "arcane", exits: ["north", "east", "south", "west"], sockets: [s("north", 4), s("east", 14), s("south", 14), s("west", 4)], tags: ["landmark", "summoning", "ritual", "hazard"],
    sourceNotes: [sources.arden, sources.geomorph],
    rooms: [r("summoning_court", 5, 5, 9, 9, "summoning_court"), r("preparation_room", 2, 2, 4, 3, "preparation_room"), r("bound_cell", 15, 12, 3, 4, "bound_cell"), r("ritual_store", 7, 15, 5, 3, "ritual_store")],
    corridors: [c(4, 0, 2, 9, "north_rite"), c(0, 4, 9, 2, "west_rite"), c(13, 14, 7, 2, "east_rite"), c(14, 11, 2, 9, "south_rite")],
    doors: [d("summoning_court", "north"), d("summoning_court", "west"), d("preparation_room", "south"), d("bound_cell", "west", "corridor", "locked"), d("ritual_store", "north")]
  }),
  geomorph({
    key: "treasure_vault_landmark_20_a", label: "Treasure Vault Landmark A", size: 20, category: "treasure", exits: ["north", "south", "west"], sockets: [s("north", 4), s("south", 14), s("west", 4)], tags: ["landmark", "vault", "locked", "treasure"],
    sourceNotes: [sources.barrowmaze, sources.geomorph],
    rooms: [r("counting_room", 5, 2, 7, 4, "counting_room"), r("main_vault", 5, 8, 8, 6, "main_vault"), r("side_vault_a", 1, 4, 3, 4, "side_vault"), r("side_vault_b", 14, 10, 4, 4, "side_vault"), r("escape_cache", 6, 16, 4, 2, "hidden_cache")],
    corridors: [c(4, 0, 2, 12, "vault_entry"), c(0, 4, 8, 2, "west_access"), c(14, 12, 2, 8, "south_access")],
    doors: [d("counting_room", "south"), d("main_vault", "north", "corridor", "locked"), d("side_vault_a", "east", "corridor", "locked"), d("side_vault_b", "west", "corridor", "locked"), d("escape_cache", "north", "corridor", "secret")]
  }),
  geomorph({
    key: "living_suite_landmark_20_a", label: "Living Suite Landmark A", size: 20, category: "living", exits: ["east", "south", "west"], sockets: [s("east", 4), s("south", 14), s("west", 14)], tags: ["landmark", "living", "suite", "service"],
    sourceNotes: [sources.arden, sources.geomorph],
    rooms: [r("common_room", 5, 5, 7, 5, "common_room"), r("bedroom_a", 2, 2, 4, 3, "bedroom"), r("bedroom_b", 13, 2, 4, 3, "bedroom"), r("kitchen", 2, 13, 5, 4, "kitchen"), r("private_room", 12, 13, 5, 4, "private_room")],
    corridors: [c(0, 14, 20, 2, "service_hall"), c(14, 4, 6, 2, "east_entry"), c(14, 4, 2, 12, "east_service")],
    doors: [d("common_room", "south"), d("bedroom_a", "south"), d("bedroom_b", "south"), d("kitchen", "north"), d("private_room", "north")]
  })
];

const THEME_GEOMORPHS = [
  geomorph({
    key: "generic_crosshall_chambers_10_a", label: "Generic Crosshall Chambers A", category: "architectural", exits: ["north", "east", "south", "west"], tags: ["generic", "crossroads", "side_rooms", "classic"],
    rooms: [r("north_room", 3, 1, 4, 2, "side_room"), r("east_room", 7, 4, 2, 3, "side_room"), r("south_room", 3, 7, 4, 2, "side_room"), r("west_room", 1, 4, 2, 3, "side_room")],
    corridors: [c(4, 0, 2, 10, "north_south"), c(0, 4, 10, 2, "east_west")],
    doors: [d("north_room", "south"), d("east_room", "west"), d("south_room", "north"), d("west_room", "east")]
  }),
  geomorph({
    key: "generic_bent_gallery_10_a", label: "Generic Bent Gallery A", category: "architectural", exits: ["west", "south"], tags: ["generic", "gallery", "corner", "classic"],
    rooms: [r("gallery_room", 2, 2, 5, 3, "gallery_room"), r("corner_store", 6, 6, 3, 3, "store")],
    corridors: [c(0, 4, 8, 2, "west_gallery"), c(6, 4, 2, 6, "south_turn")],
    doors: [d("gallery_room", "south"), d("corner_store", "west")]
  }),
  geomorph({
    key: "generic_two_room_spur_10_a", label: "Generic Two Room Spur A", category: "architectural", exits: ["north", "south"], tags: ["generic", "side_rooms", "vertical"],
    rooms: [r("west_room", 1, 2, 3, 3, "side_room"), r("east_room", 6, 5, 3, 3, "side_room")],
    corridors: [c(4, 0, 2, 10, "spine")],
    doors: [d("west_room", "east"), d("east_room", "west")]
  }),
  geomorph({
    key: "generic_hidden_store_10_a", label: "Generic Hidden Store A", category: "treasure", exits: ["west", "east"], tags: ["generic", "secret", "storage"],
    rooms: [r("public_store", 2, 2, 4, 3, "store"), r("hidden_store", 6, 6, 3, 3, "hidden_store")],
    corridors: [c(0, 5, 10, 2, "main_hall"), c(5, 4, 2, 3, "store_link")],
    doors: [d("public_store", "south"), d("hidden_store", "west", "corridor", "secret")]
  }),
  geomorph({
    key: "generic_small_hub_10_a", label: "Generic Small Hub A", category: "architectural", exits: ["north", "east", "west"], tags: ["generic", "hub", "classic"],
    rooms: [r("central_room", 3, 3, 4, 4, "hub_room"), r("north_niche", 3, 1, 4, 2, "niche")],
    corridors: [c(4, 0, 2, 5, "north_entry"), c(0, 5, 10, 2, "crosshall")],
    doors: [d("central_room", "north"), d("central_room", "south"), d("north_niche", "south")]
  }),
  geomorph({
    key: "generic_deadend_vault_10_a", label: "Generic Dead-End Vault A", category: "treasure", exits: ["south"], tags: ["generic", "dead_end", "vault", "locked"],
    rooms: [r("antechamber", 3, 5, 4, 3, "antechamber"), r("vault", 3, 1, 4, 3, "vault")],
    corridors: [c(4, 7, 2, 3, "entry")],
    doors: [d("antechamber", "south"), d("vault", "south", "corridor", "locked")]
  }),

  geomorph({
    key: "barrow_niche_gallery_10_a", label: "Barrow Niche Gallery A", category: "tombs", exits: ["west", "east"], tags: ["barrow", "tombs", "alcoves", "crypt"],
    rooms: [r("niche_a", 1, 1, 2, 2, "burial_niche"), r("niche_b", 4, 1, 2, 2, "burial_niche"), r("niche_c", 7, 1, 2, 2, "burial_niche"), r("niche_d", 2, 7, 2, 2, "burial_niche"), r("niche_e", 6, 7, 2, 2, "burial_niche")],
    corridors: [c(0, 4, 10, 2, "burial_gallery")],
    doors: [d("niche_a", "south"), d("niche_b", "south"), d("niche_c", "south"), d("niche_d", "north"), d("niche_e", "north")]
  }),
  geomorph({
    key: "barrow_false_tomb_10_a", label: "Barrow False Tomb A", category: "tombs", exits: ["north", "east"], tags: ["barrow", "tomb", "secret", "sealed"],
    rooms: [r("false_tomb", 2, 2, 5, 4, "false_tomb"), r("true_tomb", 6, 6, 3, 3, "true_tomb")],
    corridors: [c(4, 0, 2, 5, "entry_axis"), c(5, 4, 5, 2, "east_passage")],
    doors: [d("false_tomb", "north"), d("false_tomb", "east"), d("true_tomb", "west", "corridor", "secret")]
  }),
  geomorph({
    key: "barrow_ossuary_turn_10_a", label: "Barrow Ossuary Turn A", category: "tombs", exits: ["south", "east"], tags: ["barrow", "ossuary", "corner"],
    rooms: [r("bone_room", 1, 3, 4, 4, "ossuary"), r("sealed_niche", 6, 1, 3, 3, "sealed_niche")],
    corridors: [c(4, 5, 6, 2, "east_turn"), c(4, 5, 2, 5, "south_turn")],
    doors: [d("bone_room", "east"), d("sealed_niche", "south", "corridor", "locked")]
  }),
  geomorph({
    key: "barrow_processional_cells_10_a", label: "Barrow Processional Cells A", category: "tombs", exits: ["north", "south"], tags: ["barrow", "processional", "cells"],
    rooms: [r("west_cell_a", 1, 1, 2, 3, "burial_cell"), r("west_cell_b", 1, 6, 2, 3, "burial_cell"), r("east_cell_a", 7, 1, 2, 3, "burial_cell"), r("east_cell_b", 7, 6, 2, 3, "burial_cell")],
    corridors: [c(4, 0, 2, 10, "processional_axis")],
    doors: [d("west_cell_a", "east"), d("west_cell_b", "east"), d("east_cell_a", "west"), d("east_cell_b", "west")]
  }),
  geomorph({
    key: "barrow_reliquary_branch_10_a", label: "Barrow Reliquary Branch A", category: "tombs", exits: ["west", "south"], tags: ["barrow", "reliquary", "dead_end", "locked"],
    rooms: [r("reliquary", 2, 2, 5, 4, "reliquary"), r("watch_niche", 7, 6, 2, 3, "watch_niche")],
    corridors: [c(0, 5, 7, 2, "west_hall"), c(5, 5, 2, 5, "south_spur")],
    doors: [d("reliquary", "south", "corridor", "locked"), d("watch_niche", "west")]
  }),
  geomorph({
    key: "barrow_sunken_burial_10_a", label: "Barrow Sunken Burial A", category: "tombs", exits: ["north", "west"], tags: ["barrow", "sunken", "flooded"],
    rooms: [r("sunken_burial", 3, 3, 5, 5, "sunken_burial", ["flooded"]), r("dry_landing", 1, 5, 2, 3, "landing")],
    corridors: [c(4, 0, 2, 5, "north_steps"), c(0, 5, 5, 2, "west_landing")],
    doors: [d("sunken_burial", "north"), d("dry_landing", "east")]
  }),

  geomorph({
    key: "stronghold_guard_choke_10_a", label: "Stronghold Guard Choke A", category: "military", exits: ["west", "east"], tags: ["stronghold", "fortified", "guarded", "checkpoint"],
    rooms: [r("guard_room", 3, 1, 4, 3, "guard_room"), r("armory_closet", 6, 7, 3, 2, "armory")],
    corridors: [c(0, 5, 10, 2, "choke_hall"), c(5, 4, 2, 4, "service_link")],
    doors: [d("guard_room", "south"), d("armory_closet", "north", "corridor", "locked")]
  }),
  geomorph({
    key: "stronghold_barracks_pair_10_a", label: "Stronghold Barracks Pair A", category: "living", exits: ["north", "south"], tags: ["stronghold", "barracks", "living", "military"],
    rooms: [r("bunks_a", 1, 1, 3, 4, "barracks"), r("bunks_b", 6, 5, 3, 4, "barracks")],
    corridors: [c(4, 0, 2, 10, "barracks_spine")],
    doors: [d("bunks_a", "east"), d("bunks_b", "west")]
  }),
  geomorph({
    key: "stronghold_gate_switch_10_a", label: "Stronghold Gate Switch A", category: "military", exits: ["north", "east", "west"], tags: ["stronghold", "fortified", "gate", "locked"],
    rooms: [r("gate_room", 3, 3, 4, 3, "gate_room"), r("switch_room", 7, 6, 2, 3, "switch_room")],
    corridors: [c(0, 4, 10, 2, "gate_hall"), c(4, 0, 2, 5, "north_entry")],
    doors: [d("gate_room", "north"), d("switch_room", "west", "corridor", "locked")]
  }),
  geomorph({
    key: "stronghold_supply_square_10_a", label: "Stronghold Supply Square A", category: "workshops", exits: ["east", "south"], tags: ["stronghold", "storage", "crates", "service"],
    rooms: [r("supply_a", 1, 1, 4, 3, "supply_room"), r("supply_b", 5, 6, 4, 3, "supply_room")],
    corridors: [c(4, 3, 2, 7, "service_drop"), c(4, 4, 6, 2, "east_loading")],
    doors: [d("supply_a", "south"), d("supply_b", "north")]
  }),
  geomorph({
    key: "stronghold_training_room_10_a", label: "Stronghold Training Room A", category: "military", exits: ["north", "west"], tags: ["stronghold", "military", "training"],
    rooms: [r("training_room", 2, 2, 6, 5, "training_room"), r("weapon_rack", 2, 7, 3, 2, "weapon_rack")],
    corridors: [c(4, 0, 2, 4, "north_entry"), c(0, 5, 4, 2, "west_entry")],
    doors: [d("training_room", "north"), d("training_room", "west"), d("weapon_rack", "north")]
  }),
  geomorph({
    key: "stronghold_prison_watch_10_a", label: "Stronghold Prison Watch A", category: "prison", exits: ["west", "south"], tags: ["stronghold", "prison", "cells", "guarded"],
    rooms: [r("cell_a", 1, 1, 2, 3, "cell"), r("cell_b", 4, 1, 2, 3, "cell"), r("watch_room", 5, 6, 4, 3, "watch_room")],
    corridors: [c(0, 4, 7, 2, "cell_hall"), c(5, 4, 2, 6, "watch_spur")],
    doors: [d("cell_a", "south", "corridor", "locked"), d("cell_b", "south", "corridor", "locked"), d("watch_room", "north")]
  }),

  geomorph({
    key: "cavern_pool_pockets_10_a", label: "Cavern Pool Pockets A", category: "cavern", exits: ["west", "east"], tags: ["cavern", "water", "organic", "shadowfen"],
    rooms: [r("pool", 3, 3, 4, 4, "pool", ["flooded"]), r("west_pocket", 1, 6, 2, 3, "rough_pocket"), r("east_pocket", 7, 1, 2, 3, "rough_pocket")],
    corridors: [c(0, 5, 10, 2, "rough_hall")],
    doors: [d("pool", "south"), d("west_pocket", "east"), d("east_pocket", "west")]
  }),
  geomorph({
    key: "cavern_split_passage_10_a", label: "Cavern Split Passage A", category: "cavern", exits: ["north", "east", "south"], tags: ["cavern", "split", "organic"],
    rooms: [r("rough_chamber", 2, 3, 4, 4, "rough_chamber"), r("side_pocket", 7, 6, 2, 3, "side_pocket")],
    corridors: [c(4, 0, 2, 10, "rough_spine"), c(4, 4, 6, 2, "east_branch")],
    doors: [d("rough_chamber", "east"), d("side_pocket", "west")]
  }),
  geomorph({
    key: "flooded_sluice_10_a", label: "Flooded Sluice A", category: "infrastructure", exits: ["north", "south"], tags: ["flooded", "water", "sluice", "shadowfen"],
    rooms: [r("sluice_room", 2, 3, 6, 4, "sluice_room", ["flooded"]), r("control_niche", 7, 1, 2, 2, "control_niche")],
    corridors: [c(4, 0, 2, 10, "water_channel")],
    doors: [d("sluice_room", "north"), d("sluice_room", "south"), d("control_niche", "south")]
  }),
  geomorph({
    key: "mine_side_cut_10_a", label: "Mine Side Cut A", category: "cavern", exits: ["west", "east"], tags: ["mine", "cavern", "worksite", "branches"],
    rooms: [r("tool_cut", 1, 1, 3, 3, "tool_cut"), r("ore_pocket", 6, 6, 3, 3, "ore_pocket")],
    corridors: [c(0, 5, 10, 2, "mine_drift"), c(2, 3, 2, 3, "north_cut"), c(7, 5, 2, 3, "south_cut")],
    doors: [d("tool_cut", "south"), d("ore_pocket", "north")]
  }),
  geomorph({
    key: "wild_root_chamber_10_a", label: "Wild Root Chamber A", category: "ruins", exits: ["north", "west"], tags: ["wild", "tanglewood", "overgrown", "plants"],
    rooms: [r("root_room", 2, 2, 5, 5, "root_room"), r("old_niche", 7, 7, 2, 2, "old_niche")],
    corridors: [c(4, 0, 2, 5, "root_path"), c(0, 5, 5, 2, "west_path")],
    doors: [d("root_room", "north"), d("root_room", "west"), d("old_niche", "west")]
  }),
  geomorph({
    key: "sea_cave_landing_10_a", label: "Sea Cave Landing A", category: "infrastructure", exits: ["east", "south"], tags: ["sea_cave", "water", "landing", "docks"],
    rooms: [r("wet_landing", 3, 3, 5, 4, "wet_landing", ["flooded"]), r("cargo_nook", 1, 6, 2, 3, "cargo_nook")],
    corridors: [c(6, 5, 4, 2, "east_tideway"), c(6, 5, 2, 5, "south_tideway")],
    doors: [d("wet_landing", "east"), d("cargo_nook", "east")]
  }),

  geomorph({
    key: "occult_binding_cells_10_a", label: "Occult Binding Cells A", category: "arcane", exits: ["west", "east"], tags: ["occult", "evil_magic", "ritual", "cells"],
    rooms: [r("binding_cell_a", 1, 1, 3, 3, "binding_cell"), r("binding_cell_b", 6, 1, 3, 3, "binding_cell"), r("ritual_niche", 3, 7, 4, 2, "ritual_niche")],
    corridors: [c(0, 5, 10, 2, "binding_hall")],
    doors: [d("binding_cell_a", "south", "corridor", "locked"), d("binding_cell_b", "south", "corridor", "locked"), d("ritual_niche", "north")]
  }),
  geomorph({
    key: "occult_star_junction_10_a", label: "Occult Star Junction A", category: "arcane", exits: ["north", "east", "south", "west"], tags: ["occult", "evil_magic", "summoning", "hub"],
    rooms: [r("star_room", 3, 3, 4, 4, "star_room")],
    corridors: [c(4, 0, 2, 10, "north_south"), c(0, 4, 10, 2, "east_west")],
    doors: [d("star_room", "north"), d("star_room", "east"), d("star_room", "south"), d("star_room", "west")]
  }),
  geomorph({
    key: "occult_hidden_altar_10_a", label: "Occult Hidden Altar A", category: "religious", exits: ["north", "west"], tags: ["occult", "cult", "secret", "altar"],
    rooms: [r("public_chapel", 2, 2, 4, 4, "chapel"), r("hidden_altar", 6, 6, 3, 3, "hidden_altar")],
    corridors: [c(4, 0, 2, 5, "public_entry"), c(0, 4, 5, 2, "west_hall")],
    doors: [d("public_chapel", "north"), d("public_chapel", "west"), d("hidden_altar", "west", "corridor", "secret")]
  }),
  geomorph({
    key: "occult_laboratory_spur_10_a", label: "Occult Laboratory Spur A", category: "arcane", exits: ["south", "east"], tags: ["occult", "laboratory", "alchemy", "hazard"],
    rooms: [r("lab", 2, 2, 5, 4, "laboratory"), r("specimen_room", 7, 6, 2, 3, "specimen_room")],
    corridors: [c(4, 5, 2, 5, "south_spur"), c(5, 5, 5, 2, "east_spur")],
    doors: [d("lab", "south"), d("specimen_room", "west", "corridor", "locked")]
  }),
  geomorph({
    key: "temple_oracle_cells_10_a", label: "Temple Oracle Cells A", category: "religious", exits: ["north", "south"], tags: ["temple", "oracle", "moon", "hallowed"],
    rooms: [r("oracle_cell", 3, 1, 4, 3, "oracle_cell"), r("waiting_room", 2, 6, 6, 3, "waiting_room")],
    corridors: [c(4, 0, 2, 10, "temple_axis")],
    doors: [d("oracle_cell", "south"), d("waiting_room", "north")]
  }),
  geomorph({
    key: "temple_sun_chapel_10_a", label: "Temple Sun Chapel A", category: "religious", exits: ["east", "west"], tags: ["temple", "sun", "hallowed", "chapel"],
    rooms: [r("sun_chapel", 3, 2, 5, 5, "sun_chapel"), r("vestry", 1, 7, 3, 2, "vestry")],
    corridors: [c(0, 4, 10, 2, "chapel_crosshall")],
    doors: [d("sun_chapel", "south"), d("vestry", "east")]
  }),

  geomorph({
    key: "living_kitchen_suite_10_a", label: "Living Kitchen Suite A", category: "living", exits: ["west", "south"], tags: ["living", "kitchen", "service", "suite"],
    rooms: [r("kitchen", 2, 2, 5, 4, "kitchen"), r("pantry", 7, 6, 2, 3, "pantry")],
    corridors: [c(0, 5, 6, 2, "service_hall"), c(4, 5, 2, 5, "south_service")],
    doors: [d("kitchen", "south"), d("pantry", "west")]
  }),
  geomorph({
    key: "living_bedroom_cluster_10_a", label: "Living Bedroom Cluster A", category: "living", exits: ["north", "east"], tags: ["living", "bedrooms", "suite"],
    rooms: [r("bedroom_a", 1, 1, 3, 3, "bedroom"), r("bedroom_b", 6, 1, 3, 3, "bedroom"), r("common_nook", 3, 6, 4, 3, "common_nook")],
    corridors: [c(4, 0, 2, 8, "north_spine"), c(4, 5, 6, 2, "east_hall")],
    doors: [d("bedroom_a", "east"), d("bedroom_b", "west"), d("common_nook", "north")]
  }),
  geomorph({
    key: "living_bath_suite_10_a", label: "Living Bath Suite A", category: "living", exits: ["west", "east"], tags: ["living", "bath", "water", "luxury"],
    rooms: [r("bath", 3, 2, 4, 4, "bath", ["flooded"]), r("changing_room", 2, 7, 5, 2, "changing_room")],
    corridors: [c(0, 5, 10, 2, "bath_hall")],
    doors: [d("bath", "south"), d("changing_room", "north")]
  }),
  geomorph({
    key: "market_stall_corner_10_a", label: "Market Stall Corner A", category: "trade", exits: ["north", "east"], tags: ["market", "trade", "storage", "living"],
    rooms: [r("stall_a", 1, 1, 3, 3, "stall"), r("stall_b", 6, 6, 3, 3, "stall"), r("lockbox", 6, 1, 2, 2, "lockbox")],
    corridors: [c(4, 0, 2, 7, "north_lane"), c(4, 5, 6, 2, "east_lane")],
    doors: [d("stall_a", "east"), d("stall_b", "north"), d("lockbox", "south", "corridor", "locked")]
  }),
  geomorph({
    key: "thieves_secret_den_10_a", label: "Thieves Secret Den A", category: "trade", exits: ["south", "west"], tags: ["secret", "storage", "living", "hideout"],
    rooms: [r("front_room", 2, 5, 4, 3, "front_room"), r("hidden_den", 6, 2, 3, 3, "hidden_den")],
    corridors: [c(0, 6, 5, 2, "front_hall"), c(4, 6, 2, 4, "south_exit")],
    doors: [d("front_room", "west"), d("hidden_den", "west", "corridor", "secret")]
  }),
  geomorph({
    key: "living_servant_crossing_10_a", label: "Living Servant Crossing A", category: "living", exits: ["north", "east", "south", "west"], tags: ["living", "service", "connector", "underkeep"],
    rooms: [r("servant_nook_a", 1, 1, 2, 2, "servant_nook"), r("servant_nook_b", 7, 7, 2, 2, "servant_nook")],
    corridors: [c(4, 0, 2, 10, "service_axis"), c(0, 4, 10, 2, "service_crosshall")],
    doors: [d("servant_nook_a", "south"), d("servant_nook_b", "north")]
  })
];

const CONNECTOR_GEOMORPHS = [
  geomorph({ key: "straight_side_room_10_a", label: "Straight Side Room A", kind: "connector", category: "connector", exits: ["west", "east"], tags: ["side_room", "short"], rooms: [r("side_room", 4, 1, 3, 3, "side_room")], corridors: [c(0, 5, 10, 2, "main_connector"), c(5, 3, 2, 3, "side_access")], doors: [d("side_room", "south")] }),
  geomorph({ key: "straight_side_room_10_b", label: "Straight Side Room B", kind: "connector", category: "connector", exits: ["west", "east"], tags: ["side_room", "offset"], rooms: [r("guard_room", 1, 1, 3, 3, "guard_room"), r("store", 6, 7, 3, 2, "store")], corridors: [c(0, 5, 10, 2, "main_connector"), c(2, 3, 2, 3, "north_access"), c(7, 5, 2, 4, "south_access")], doors: [d("guard_room", "south"), d("store", "north")] }),
  geomorph({ key: "dogleg_connector_10_a", label: "Dogleg Connector A", kind: "connector", category: "connector", exits: ["north", "east"], tags: ["dogleg"], rooms: [r("alcove", 1, 6, 3, 2, "alcove")], corridors: [c(4, 0, 2, 6, "north_leg"), c(4, 4, 6, 2, "east_leg"), c(2, 5, 3, 2, "side_link")], doors: [d("alcove", "east")] }),
  geomorph({ key: "dogleg_connector_10_b", label: "Dogleg Connector B", kind: "connector", category: "connector", exits: ["south", "east"], tags: ["dogleg", "guarded"], rooms: [r("guard_niche", 6, 1, 3, 3, "guard_niche")], corridors: [c(4, 4, 2, 6, "south_leg"), c(4, 4, 6, 2, "east_leg"), c(6, 3, 2, 2, "niche_link")], doors: [d("guard_niche", "south")] }),
  geomorph({ key: "tee_connector_10_a", label: "T Connector A", kind: "connector", category: "connector", exits: ["north", "east", "west"], tags: ["tee", "junction"], rooms: [r("checkpoint", 4, 6, 3, 3, "checkpoint")], corridors: [c(0, 4, 10, 2, "crosshall"), c(4, 0, 2, 6, "north_spur")], doors: [d("checkpoint", "north")] }),
  geomorph({ key: "tee_connector_10_b", label: "T Connector B", kind: "connector", category: "connector", exits: ["south", "east", "west"], tags: ["tee", "storage"], rooms: [r("store_a", 1, 1, 2, 2, "store"), r("store_b", 7, 1, 2, 2, "store")], corridors: [c(0, 4, 10, 2, "crosshall"), c(4, 4, 2, 6, "south_spur")], doors: [d("store_a", "south"), d("store_b", "south")] }),
  geomorph({ key: "cross_connector_10_a", label: "Cross Connector A", kind: "connector", category: "connector", exits: ["north", "east", "south", "west"], tags: ["cross", "junction"], rooms: [r("corner_store", 1, 1, 2, 2, "store"), r("corner_shrine", 7, 7, 2, 2, "small_shrine")], corridors: [c(4, 0, 2, 10, "north_south"), c(0, 4, 10, 2, "east_west")], doors: [d("corner_store", "east"), d("corner_shrine", "west")] }),
  geomorph({ key: "cross_connector_10_b", label: "Cross Connector B", kind: "connector", category: "connector", exits: ["north", "east", "south", "west"], tags: ["cross", "checkpoint"], rooms: [r("watch_a", 1, 6, 2, 3, "watch_room"), r("watch_b", 7, 1, 2, 3, "watch_room")], corridors: [c(4, 0, 2, 10, "north_south"), c(0, 4, 10, 2, "east_west")], doors: [d("watch_a", "east"), d("watch_b", "west")] }),
  geomorph({ key: "alcove_gallery_10_a", label: "Alcove Gallery A", kind: "connector", category: "connector", exits: ["west", "east"], tags: ["alcoves", "barrowmaze"], rooms: [r("alcove_a", 2, 1, 2, 2, "alcove"), r("alcove_b", 6, 1, 2, 2, "alcove"), r("alcove_c", 2, 7, 2, 2, "alcove"), r("alcove_d", 6, 7, 2, 2, "alcove")], corridors: [c(0, 4, 10, 2, "gallery")], doors: [d("alcove_a", "south"), d("alcove_b", "south"), d("alcove_c", "north"), d("alcove_d", "north")] }),
  geomorph({ key: "secret_bypass_10_a", label: "Secret Bypass A", kind: "connector", category: "connector", exits: ["west", "east"], tags: ["secret", "bypass"], rooms: [r("hidden_room", 4, 1, 3, 3, "hidden_room")], corridors: [c(0, 6, 10, 2, "main_hall"), c(5, 3, 2, 4, "secret_link")], doors: [d("hidden_room", "south", "corridor", "secret")] }),
  geomorph({ key: "locked_gate_10_a", label: "Locked Gate A", kind: "connector", category: "connector", exits: ["west", "east"], tags: ["gate", "locked"], rooms: [r("gatehouse", 3, 2, 4, 3, "gatehouse"), r("guard_store", 3, 7, 4, 2, "guard_store")], corridors: [c(0, 5, 10, 2, "gated_hall")], doors: [d("gatehouse", "south", "corridor", "locked"), d("guard_store", "north")] }),
  geomorph({ key: "stair_connector_10_a", label: "Stair Connector A", kind: "connector", category: "connector", exits: ["north", "south"], tags: ["stairs", "vertical"], rooms: [r("stair_landing", 2, 3, 6, 4, "stair_landing")], corridors: [c(4, 0, 2, 10, "stair_axis")], doors: [d("stair_landing", "north"), d("stair_landing", "south")] }),
  geomorph({ key: "bridge_connector_10_a", label: "Bridge Connector A", kind: "connector", category: "connector", exits: ["west", "east"], tags: ["bridge", "hazard"], rooms: [r("west_landing", 1, 3, 2, 4, "landing"), r("east_landing", 7, 3, 2, 4, "landing")], corridors: [c(0, 4, 10, 2, "bridge")], doors: [d("west_landing", "east"), d("east_landing", "west")] }),
  geomorph({ key: "water_channel_10_a", label: "Water Channel A", kind: "connector", category: "connector", exits: ["north", "south"], tags: ["water", "channel"], rooms: [r("sluice", 6, 3, 3, 4, "sluice_room")], corridors: [c(4, 0, 2, 10, "water_channel"), c(5, 4, 5, 2, "sluice_access")], doors: [d("sluice", "west")] }),
  geomorph({ key: "cave_transition_10_a", label: "Cave Transition A", kind: "connector", category: "connector", exits: ["west", "east"], tags: ["cave", "transition"], rooms: [r("rough_pocket", 3, 1, 4, 3, "rough_pocket"), r("masonry_niche", 6, 7, 3, 2, "masonry_niche")], corridors: [c(0, 5, 10, 2, "rough_hall"), c(4, 3, 2, 3, "north_pocket_link")], doors: [d("rough_pocket", "south"), d("masonry_niche", "north")] }),
  geomorph({ key: "double_corridor_10_a", label: "Double Corridor A", kind: "connector", category: "connector", exits: ["west", "east"], tags: ["parallel", "dense"], rooms: [r("divider_room", 4, 4, 2, 2, "divider_room")], corridors: [c(0, 2, 10, 2, "north_lane"), c(0, 6, 10, 2, "south_lane"), c(4, 2, 2, 6, "middle_link")], doors: [d("divider_room", "north"), d("divider_room", "south")] }),
  geomorph({ key: "loop_connector_10_a", label: "Loop Connector A", kind: "connector", category: "connector", exits: ["west", "east"], tags: ["loop", "patrol"], rooms: [r("loop_room", 4, 3, 2, 4, "loop_room")], corridors: [c(0, 4, 10, 2, "main_hall"), c(2, 2, 6, 2, "upper_loop"), c(2, 6, 6, 2, "lower_loop")], doors: [d("loop_room", "west"), d("loop_room", "east")] }),
  geomorph({ key: "short_plaza_connector_20_a", label: "Short Plaza Connector A", size: 20, kind: "connector", category: "connector", exits: ["west", "east", "north"], tags: ["plaza", "junction"], rooms: [r("small_plaza", 6, 6, 8, 6, "small_plaza"), r("north_room", 7, 2, 6, 3, "north_room"), r("south_store", 8, 14, 4, 3, "south_store")], corridors: [c(0, 8, 20, 2, "east_west"), c(9, 0, 2, 12, "north_axis")], doors: [d("small_plaza", "north"), d("north_room", "south"), d("south_store", "north")] }),
  geomorph({ key: "long_gallery_connector_20_a", label: "Long Gallery Connector A", size: 20, kind: "connector", category: "connector", exits: ["west", "east"], tags: ["gallery", "side_rooms"], rooms: [r("north_room_a", 3, 2, 4, 3, "side_room"), r("north_room_b", 12, 2, 4, 3, "side_room"), r("south_room_a", 5, 12, 4, 4, "side_room"), r("south_room_b", 13, 12, 4, 4, "side_room")], corridors: [c(0, 8, 20, 3, "gallery")], doors: [d("north_room_a", "south"), d("north_room_b", "south"), d("south_room_a", "north"), d("south_room_b", "north")] }),
  geomorph({ key: "offset_hall_connector_20_a", label: "Offset Hall Connector A", size: 20, kind: "connector", category: "connector", exits: ["north", "east", "south"], tags: ["offset", "bend"], rooms: [r("watch_room", 3, 5, 4, 4, "watch_room"), r("store", 13, 12, 4, 3, "store")], corridors: [c(8, 0, 2, 9, "north_leg"), c(8, 7, 8, 2, "middle_leg"), c(14, 7, 2, 13, "south_leg"), c(14, 7, 6, 2, "east_exit")], doors: [d("watch_room", "east"), d("store", "north")] }),
  geomorph({ key: "checkpoint_connector_20_a", label: "Checkpoint Connector A", size: 20, kind: "connector", category: "connector", exits: ["west", "east", "south"], tags: ["checkpoint", "guarded"], rooms: [r("gate_hall", 6, 6, 8, 5, "gate_hall"), r("barracks", 2, 12, 5, 4, "barracks"), r("office", 12, 12, 4, 4, "office")], corridors: [c(0, 8, 20, 2, "gated_route"), c(9, 9, 2, 11, "south_route")], doors: [d("gate_hall", "west", "corridor", "locked"), d("barracks", "north"), d("office", "north")] }),
  geomorph({ key: "cavern_bridge_connector_20_a", label: "Cavern Bridge Connector A", size: 20, kind: "connector", category: "connector", exits: ["west", "east", "north"], tags: ["cavern", "bridge"], rooms: [r("rough_landing_w", 1, 6, 5, 5, "rough_landing"), r("rough_landing_e", 14, 6, 5, 5, "rough_landing"), r("upper_cave", 8, 1, 4, 4, "upper_cave")], corridors: [c(0, 8, 20, 2, "cave_bridge"), c(9, 0, 2, 9, "north_cave_path")], doors: [d("rough_landing_w", "east"), d("rough_landing_e", "west"), d("upper_cave", "south")] }),
  geomorph({ key: "service_spur_connector_20_a", label: "Service Spur Connector A", size: 20, kind: "connector", category: "connector", exits: ["north", "south"], tags: ["service", "spurs"], rooms: [r("store_a", 2, 3, 4, 3, "store"), r("store_b", 14, 3, 4, 3, "store"), r("workroom", 5, 12, 10, 4, "workroom")], corridors: [c(9, 0, 2, 20, "service_axis"), c(5, 5, 10, 2, "upper_spur"), c(5, 11, 10, 2, "lower_spur")], doors: [d("store_a", "east"), d("store_b", "west"), d("workroom", "north")] }),
  geomorph({ key: "secret_loop_connector_20_a", label: "Secret Loop Connector A", size: 20, kind: "connector", category: "connector", exits: ["west", "east"], tags: ["secret", "loop"], rooms: [r("public_room", 3, 6, 5, 4, "public_room"), r("hidden_cache", 11, 3, 4, 3, "hidden_cache"), r("ambush_room", 12, 12, 4, 4, "ambush_room")], corridors: [c(0, 8, 20, 2, "public_hall"), c(8, 4, 6, 2, "secret_upper"), c(13, 5, 2, 9, "secret_drop"), c(8, 13, 6, 2, "secret_lower")], doors: [d("public_room", "east"), d("hidden_cache", "south", "corridor", "secret"), d("ambush_room", "west", "corridor", "secret")] })
];

export const STANDARD_GEOMORPH_LIBRARY = [...NORMAL_GEOMORPHS, ...THEME_GEOMORPHS, ...CONNECTOR_GEOMORPHS];

export const STANDARD_GEOMORPH_COUNTS = Object.freeze({
  total: STANDARD_GEOMORPH_LIBRARY.length,
  normal: NORMAL_GEOMORPHS.length,
  themed: THEME_GEOMORPHS.length,
  connector: CONNECTOR_GEOMORPHS.length,
  size10: STANDARD_GEOMORPH_LIBRARY.filter((geomorph) => geomorph.size === 10).length,
  size20: STANDARD_GEOMORPH_LIBRARY.filter((geomorph) => geomorph.size === 20).length
});

export function getStandardGeomorphs({ kind, category, size, tags = [] } = {}) {
  return STANDARD_GEOMORPH_LIBRARY.filter((geomorph) => {
    if (kind && geomorph.kind !== kind) return false;
    if (category && geomorph.category !== category) return false;
    if (size && geomorph.size !== size) return false;
    return tags.every((tag) => geomorph.tags.includes(tag));
  });
}

export function validateStandardGeomorphLibrary() {
  const errors = [];
  const keys = new Set();

  for (const geomorph of STANDARD_GEOMORPH_LIBRARY) {
    if (keys.has(geomorph.key)) errors.push(`Duplicate key: ${geomorph.key}`);
    keys.add(geomorph.key);

    if (![10, 20].includes(geomorph.size)) errors.push(`${geomorph.key} has invalid size ${geomorph.size}`);
    if (!["normal", "connector"].includes(geomorph.kind)) errors.push(`${geomorph.key} has invalid kind ${geomorph.kind}`);

    for (const area of [...geomorph.rooms, ...geomorph.corridors]) {
      const right = area.x + area.width;
      const bottom = area.y + area.height;
      if (area.x < 0 || area.y < 0 || right > geomorph.size || bottom > geomorph.size) {
        errors.push(`${geomorph.key} area ${area.id || area.role} exceeds ${geomorph.size}x${geomorph.size}`);
      }
      if (area.width <= 0 || area.height <= 0) {
        errors.push(`${geomorph.key} area ${area.id || area.role} has non-positive dimensions`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
