export const SIZE_PRESETS = {
  small: { label: "Small", pixelWidth: 1200, pixelHeight: 1200, floorGridWidth: 2, floorGridHeight: 2, wallGridWidth: 24, wallGridHeight: 24 },
  medium: { label: "Medium", pixelWidth: 2400, pixelHeight: 2400, floorGridWidth: 4, floorGridHeight: 4, wallGridWidth: 48, wallGridHeight: 48 },
  large: { label: "Large", pixelWidth: 4800, pixelHeight: 4800, floorGridWidth: 8, floorGridHeight: 8, wallGridWidth: 96, wallGridHeight: 96 },
  super: { label: "Super", pixelWidth: 9600, pixelHeight: 9600, floorGridWidth: 16, floorGridHeight: 16, wallGridWidth: 192, wallGridHeight: 192 },
};

export const FLOOR_TILES = {
  stone_dark_square: "../Tiles/Floor/Stone - Dark/Rock_Tiles_B_05.jpg",
  stone_rough_square: "../Tiles/Floor/Stone - Rough/Rock_Tiles_B_01.jpg",
  stone_sandstone_square: "../Tiles/Floor/Stone - Sandstone/Rock_Tiles_B_03.jpg",
  stone_standard_square: "../Tiles/Floor/Stone - Standard/Rock_Tiles_B_02.jpg",
  stone_taiga_square: "../Tiles/Floor/Stone - Taiga/Rock_Tiles_B_04.jpg",
  stone_standard_hex: "../Tiles/Floor/Stone - Standard/Stone_Hexagonal_Tiles_02_C.jpg",
};

export function makeEmptyWallCell(x, y) {
  return {
    wallX: x,
    wallY: y,
    walkable: false,
    spaceType: "void",
    roomId: null,
    corridorId: null,
    edges: { north: "void", east: "void", south: "void", west: "void" },
    edgeFeatures: { north: null, east: null, south: null, west: null },
    door: null,
    secretDoor: null,
    eventLink: null,
    rolledEvent: null,
    verticalConnection: null,
    visited: false,
    revealed: false,
    labels: [],
  };
}

export function makeFloorCell(x, y, tile) {
  return {
    floorX: x,
    floorY: y,
    tile,
    rotation: 0,
    flipped: false,
    variant: null,
    notes: "",
  };
}

export function createDungeonState(options) {
  const preset = SIZE_PRESETS[options.size] ?? SIZE_PRESETS.medium;
  const requestedFloorCount = options.floorCount ?? (options.size === "super" ? 2 : 1);
  const maxFloorCount = 10;
  const minFloorCount = options.size === "super" ? 2 : 1;
  const floorCount = Math.max(minFloorCount, Math.min(requestedFloorCount, maxFloorCount));
  const themeId = options.themeId ?? "standard_dungeon";
  const dungeon = {
    schemaVersion: 1,
    generatorVersion: "0.1",
    dungeonId: `dng_${Date.now().toString(36)}`,
    name: options.name ?? "Generated Dungeon",
    siteType: "standard_dungeon",
    themeId,
    theme: options.theme ?? null,
    themeInfluences: options.themeInfluences ?? {
      objectPalette: [],
      encounterFilters: [],
      dressingTables: [],
    },
    threatLevel: options.threatLevel ?? 1,
    tileSetId: "current_tiles_folder",
    sizeCategory: options.size,
    pixelWidth: preset.pixelWidth,
    pixelHeight: preset.pixelHeight,
    floorMode: "square-texture",
    floorTileSize: 600,
    floorGridWidth: preset.floorGridWidth,
    floorGridHeight: preset.floorGridHeight,
    wallCellSize: 50,
    wallGridWidth: preset.wallGridWidth,
    wallGridHeight: preset.wallGridHeight,
    currentFloor: 0,
    floorCount,
    seed: options.seed,
    createdAt: new Date().toISOString(),
    turn: 1,
    lightTurnsRemaining: 6,
    player: {
      floorIndex: 0,
      wallX: 1,
      wallY: 1,
      token: "party",
      facing: "north",
    },
    eventTables: {
      standard_room: "tables/events/standard-room.json",
      standard_corridor: "tables/events/standard-corridor.json",
      boss_room: "tables/events/boss-room.json",
      floor_connection: "tables/events/floor-connection.json",
    },
    generationPlan: options.generationPlan ?? null,
    rooms: [],
    corridors: [],
    doors: [],
    floorConnections: [],
    assetPlacements: [],
    eventLog: [],
    floors: [],
  };

  for (let f = 0; f < floorCount; f += 1) {
    const floorGrid = Array.from({ length: preset.floorGridHeight }, (_, y) =>
      Array.from({ length: preset.floorGridWidth }, (_, x) => makeFloorCell(x, y, options.floorTile))
    );
    const wallGrid = Array.from({ length: preset.wallGridHeight }, (_, y) =>
      Array.from({ length: preset.wallGridWidth }, (_, x) => makeEmptyWallCell(x, y))
    );
    dungeon.floors.push({
      floorIndex: f,
      name: `Floor ${f + 1}`,
      layerDepth: f,
      layerSizeCategory: options.size,
      floorGrid,
      wallGrid,
      connectionsUp: [],
      connectionsDown: [],
    });
  }

  return dungeon;
}

export function getCurrentFloor(dungeon) {
  return dungeon.floors[dungeon.currentFloor];
}

export function getCell(dungeon, floorIndex, x, y) {
  const floor = dungeon.floors[floorIndex];
  if (!floor || y < 0 || x < 0 || y >= dungeon.wallGridHeight || x >= dungeon.wallGridWidth) return null;
  return floor.wallGrid[y][x];
}

export function inBounds(dungeon, x, y) {
  return x >= 0 && y >= 0 && x < dungeon.wallGridWidth && y < dungeon.wallGridHeight;
}

export function serializeDungeon(dungeon) {
  return JSON.stringify(dungeon, null, 2);
}

export function parseDungeon(text) {
  const parsed = JSON.parse(text);
  validateDungeon(parsed);
  return parsed;
}

export function validateDungeon(dungeon) {
  if (!dungeon || dungeon.schemaVersion !== 1) throw new Error("Unsupported or missing schemaVersion.");
  if (!Array.isArray(dungeon.floors) || dungeon.floors.length !== dungeon.floorCount) {
    throw new Error("Floor array does not match floorCount.");
  }
  for (const floor of dungeon.floors) {
    if (!Array.isArray(floor.floorGrid) || floor.floorGrid.length !== dungeon.floorGridHeight) {
      throw new Error(`Invalid floorGrid on floor ${floor.floorIndex}.`);
    }
    if (!Array.isArray(floor.wallGrid) || floor.wallGrid.length !== dungeon.wallGridHeight) {
      throw new Error(`Invalid wallGrid on floor ${floor.floorIndex}.`);
    }
  }
  if (!inBounds(dungeon, dungeon.player.wallX, dungeon.player.wallY)) {
    throw new Error("Player position is outside the dungeon.");
  }
}
