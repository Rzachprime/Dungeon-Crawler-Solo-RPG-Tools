import { createDungeonState, getCell, inBounds } from "./dungeon-state.js";

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
const MAX_FLOORS = 10;
const FLOOR_CHANCE = {
  small: { start: 0.1, decay: 0.03, min: 1 },
  medium: { start: 0.2, decay: 0.03, min: 1 },
  large: { start: 0.3, decay: 0.02, min: 1 },
  super: { start: 0.4, decay: 0.02, min: 2 },
};

const DUNGEON_THEMES = {
  standard_dungeon: {
    label: "Standard Dungeon",
    objectPalette: ["stone_walls", "wooden_doors", "pillars", "pits", "stairs"],
    encounterFilters: ["dungeon", "any"],
    dressingTables: ["standard_room", "standard_corridor"],
  },
  crypt: {
    label: "Crypt",
    objectPalette: ["stone_walls", "pillars", "pits", "stairs", "sealed_doors"],
    encounterFilters: ["undead", "cult", "vermin"],
    dressingTables: ["crypt_room", "crypt_corridor"],
  },
  ruined_stronghold: {
    label: "Ruined Stronghold",
    objectPalette: ["stone_walls", "wooden_doors", "wall_fixes", "pillars", "rubble"],
    encounterFilters: ["humanoid", "beast", "vermin"],
    dressingTables: ["ruin_room", "ruin_corridor"],
  },
  flooded_halls: {
    label: "Flooded Halls",
    objectPalette: ["stone_walls", "pits", "stairs", "water_hazards", "alcoves"],
    encounterFilters: ["aquatic", "ooze", "vermin"],
    dressingTables: ["flooded_room", "flooded_corridor"],
  },
  occult_depths: {
    label: "Occult Depths",
    objectPalette: ["stone_walls", "black_patch_pits", "pillars", "occult_events", "stairs"],
    encounterFilters: ["occult", "demon", "undead"],
    dressingTables: ["occult_room", "occult_corridor"],
  },
};

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

export function generateDungeon(options) {
  const rng = makeRng(options.seed || "dungeon");
  const floorCount = determineFloorCount(options, rng);
  const theme = DUNGEON_THEMES[options.themeId] ?? DUNGEON_THEMES.standard_dungeon;
  const dungeon = createDungeonState({
    size: options.size,
    floorCount,
    seed: options.seed,
    floorTile: options.floorTile,
    themeId: options.themeId ?? "standard_dungeon",
    theme,
    themeInfluences: {
      objectPalette: theme.objectPalette,
      encounterFilters: theme.encounterFilters,
      dressingTables: theme.dressingTables,
    },
    generationPlan: makeGenerationPlan(options, floorCount, theme),
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
  const theme = DUNGEON_THEMES[options.themeId] ?? DUNGEON_THEMES.standard_dungeon;
  const dungeon = createDungeonState({
    size: options.size,
    floorCount,
    seed: options.seed,
    floorTile: options.floorTile,
    themeId: options.themeId ?? "standard_dungeon",
    theme,
    themeInfluences: {
      objectPalette: theme.objectPalette,
      encounterFilters: theme.encounterFilters,
      dressingTables: theme.dressingTables,
    },
    generationPlan: makeGenerationPlan(options, floorCount, theme),
    name: `Dungeon ${String(options.seed || "seed").slice(0, 18)}`,
  });

  onProgress?.({ phase: "start", floorIndex: -1, floorCount, message: `Preparing ${theme.label}.` });

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

function makeGenerationPlan(options, floorCount, theme) {
  return {
    sizeCategory: options.size,
    floorCount,
    floorConnectionPolicy: "size_based_recursive_chance",
    floorChanceRule: FLOOR_CHANCE[options.size] ?? FLOOR_CHANCE.medium,
    layerBuildMode: "one_layer_at_a_time",
    variableLayerSizes: "planned",
    skipFloorConnections: "planned",
    theme: theme.label,
    themeInfluences: {
      objectPalette: theme.objectPalette,
      encounterFilters: theme.encounterFilters,
      dressingTables: theme.dressingTables,
    },
  };
}

function generateFloor(dungeon, floorIndex, rng, options) {
  const plan = roomPlanForDungeon(dungeon, options, rng);
  const roomTarget = plan.totalRooms;
  const rooms = [];
  let attempts = 0;

  while (rooms.length < roomTarget && attempts < roomTarget * 80) {
    attempts += 1;
    const width = randInt(rng, 2, Math.min(10, Math.floor(dungeon.wallGridWidth / 4)));
    const height = randInt(rng, 2, Math.min(10, Math.floor(dungeon.wallGridHeight / 4)));
    const x = randInt(rng, 2, dungeon.wallGridWidth - width - 3);
    const y = randInt(rng, 2, dungeon.wallGridHeight - height - 3);
    const room = {
      id: `room_${floorIndex}_${rooms.length + 1}`,
      floorIndex,
      x,
      y,
      width,
      height,
      doors: [],
      accessType: rooms.length < plan.openChambers ? "open_chamber" : "door_room",
      eventLink: "standard_room",
      rolledEvent: null,
      tags: [],
    };
    if (rooms.every((other) => !rectsOverlap(bufferRect(room, 2), bufferRect(other, 0)))) {
      rooms.push(room);
      carveRoom(dungeon, room);
    }
  }

  if (!rooms.length) return;

  const sorted = [...rooms].sort((a, b) => a.x - b.x || a.y - b.y);
  for (let i = 1; i < sorted.length; i += 1) {
    connectRooms(dungeon, sorted[i - 1], sorted[i], rng);
  }

  addLoops(dungeon, sorted, rng);
  addDeadEnds(dungeon, floorIndex, rng, Math.max(2, Math.floor(rooms.length / 4)));
  assignBossRoom(dungeon, floorIndex, rooms);
  finalizeDoorStates(dungeon, floorIndex, rng);
  deriveEdges(dungeon, floorIndex);
  revealAroundRooms(dungeon, floorIndex, rooms);
}

function roomPlanForDungeon(dungeon, options, rng) {
  const minimumRooms = Math.max(6, Math.floor(Math.min(dungeon.pixelWidth, dungeon.pixelHeight) / 100));
  const maximumRooms = Math.floor(minimumRooms * 2.5);
  const requestedRooms = Number(options.roomCount) || 0;
  const totalRooms = requestedRooms > 0
    ? Math.max(minimumRooms, Math.min(requestedRooms, maximumRooms))
    : randInt(rng, minimumRooms, maximumRooms);
  const openChambers = Math.max(1, Math.floor(minimumRooms / 8));
  return { minimumRooms, maximumRooms, requestedRooms, totalRooms, openChambers };
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

function connectRooms(dungeon, a, b, rng) {
  const start = doorwayPoint(a, center(b));
  const end = doorwayPoint(b, center(a));
  const corridorId = `corridor_${dungeon.corridors.length + 1}`;
  const horizontalFirst = rng() > 0.5;
  const cells = [];

  if (horizontalFirst) {
    carveCorridorLine(dungeon, a.floorIndex, start.corridorAnchor.x, start.corridorAnchor.y, end.corridorAnchor.x, start.corridorAnchor.y, corridorId, cells);
    carveCorridorLine(dungeon, a.floorIndex, end.corridorAnchor.x, start.corridorAnchor.y, end.corridorAnchor.x, end.corridorAnchor.y, corridorId, cells);
  } else {
    carveCorridorLine(dungeon, a.floorIndex, start.corridorAnchor.x, start.corridorAnchor.y, start.corridorAnchor.x, end.corridorAnchor.y, corridorId, cells);
    carveCorridorLine(dungeon, a.floorIndex, start.corridorAnchor.x, end.corridorAnchor.y, end.corridorAnchor.x, end.corridorAnchor.y, corridorId, cells);
  }

  addRoomConnection(dungeon, a, start, corridorId, connectionKindForRoom(a, rng));
  addRoomConnection(dungeon, b, end, corridorId, connectionKindForRoom(b, rng));
  dungeon.corridors.push({ id: corridorId, floorIndex: a.floorIndex, cells, width: 2, kind: "connector" });
}

function carveCorridorLine(dungeon, floorIndex, x1, y1, x2, y2, corridorId, cells) {
  const floor = dungeon.floors[floorIndex];
  const dx = Math.sign(x2 - x1);
  const dy = Math.sign(y2 - y1);
  let x = x1;
  let y = y1;
  while (x !== x2 || y !== y2) {
    carveCorridorBlock(floor, x, y, corridorId, cells);
    if (x !== x2) x += dx;
    if (y !== y2) y += dy;
  }
  carveCorridorBlock(floor, x2, y2, corridorId, cells);
}

function carveCorridorBlock(floor, x, y, corridorId, cells) {
  for (let oy = 0; oy < 2; oy += 1) {
    for (let ox = 0; ox < 2; ox += 1) {
      const cell = floor.wallGrid[y + oy]?.[x + ox];
      if (!cell) continue;
      if (cell.spaceType === "room") continue;
      cell.walkable = true;
      cell.spaceType = "corridor";
      cell.corridorId = corridorId;
      cell.eventLink = "standard_corridor";
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
  const doorType = kind === "open_chamber" ? "open_chamber" : kind;
  const door = {
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
  room.doors.push(door);
  if (kind === "open_chamber") room.tags = [...new Set([...room.tags, "open_chamber"])];
  dungeon.doors.push(door);
}

function addLoops(dungeon, rooms, rng) {
  const loopCount = Math.max(1, Math.floor(rooms.length / 6));
  for (let i = 0; i < loopCount; i += 1) {
    const a = choose(rng, rooms);
    const b = choose(rng, rooms);
    if (a && b && a !== b) connectRooms(dungeon, a, b, rng);
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
      door.locked = lockRoom;
      door.lockType = lockRoom ? "generic_key_or_pick" : null;
      door.open = !lockRoom && door.doorType !== "secret" && rng() < OPEN_DOOR_CHANCE;
    }
  }
}

export function interactWithDoor(dungeon, floorIndex, x, y, direction) {
  const cell = getCell(dungeon, floorIndex, x, y);
  const door = cell?.edgeFeatures?.[direction];
  if (!door || door.doorType === "open_chamber" || (door.doorType === "secret" && !door.revealed)) return false;
  dungeon.turn += 1;
  if (door.locked) {
    dungeon.eventLog.unshift({ turn: dungeon.turn, text: `Locked door at ${x}, ${y}. Needs a key or lockpicking.` });
    dungeon.eventLog = dungeon.eventLog.slice(0, 20);
    return false;
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
  const roll = options.elf ? 6 : randInt(makeRng(`${dungeon.seed}:${dungeon.turn}:${x}:${y}:${direction}`), 1, 6);
  if (roll === 6) {
    door.revealed = true;
    door.open = false;
    dungeon.eventLog.unshift({ turn: dungeon.turn, text: `Secret door revealed at ${x}, ${y}.` });
    dungeon.eventLog = dungeon.eventLog.slice(0, 20);
    return true;
  }
  dungeon.eventLog.unshift({ turn: dungeon.turn, text: `Searched wall at ${x}, ${y}: rolled ${roll}, no secret door found.` });
  dungeon.eventLog = dungeon.eventLog.slice(0, 20);
  return false;
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
