import { FLOOR_TILES, getCell } from "./dungeon-state.js";

const WALL_COLOR = "#1f1d19";
const ROOM_COLOR = "rgba(116, 93, 64, 0.44)";
const CORRIDOR_COLOR = "rgba(79, 104, 98, 0.44)";
const VISITED_COLOR = "rgba(227, 210, 162, 0.34)";
const EVENT_COLOR = "#b88a3b";
const BOSS_COLOR = "#8d4e3d";
const TORCH_FULL_RADIUS = 4;
const TORCH_DIM_RADIUS = 8;
const DIM_LIGHT_OVERLAY = "rgba(2, 2, 3, 0.42)";
const DARKNESS_OVERLAY = "rgba(0, 0, 0, 0.92)";
const MAX_FLOOR_CACHE_ITEMS = 4;
const MAX_STATIC_MAP_CACHE_ITEMS = 4;
const RENDER_CELL_SIZE = 18;
const WALL_ASSETS = {
  straight1x1: "../Tiles/Dungeon_Wall_Straight_1x1.png",
  straight2x2: "../Tiles/Dungeon_Wall_Straight_2x2.png",
  straight3x2: "../Tiles/Dungeon_Wall_Straight_3x2.png",
  straight4x2: "../Tiles/Dungeon_Wall_Straight_4x2.png",
  straightVariant1x2A: "../Tiles/Dungeon_Straight_1x2_A.png",
  straightVariant1x2B: "../Tiles/Dungeon_Straight_1x2_B.png",
  straightVariant2x2A: "../Tiles/Dungeon_Straight_2x2_A.png",
  straightVariant2x2B: "../Tiles/Dungeon_Straight_2x2_B.png",
  straightVariant3x2A: "../Tiles/Dungeon_Straight_3x2_A.png",
  straightVariant3x2B: "../Tiles/Dungeon_Straight_3x2_B.png",
  straightVariant4x2A: "../Tiles/Dungeon_Straight_4x2_A.png",
  straightVariant4x2B: "../Tiles/Dungeon_Straight_4x2_B.png",
  offsetTransitionCurved2x3: "../Tiles/Dungeon_Straight_2x3_A.png",
  offsetTransitionSquared2x3: "../Tiles/Dungeon_Straight_2x3_B.png",
  offsetTransitionCurved3x3: "../Tiles/Dungeon_Straight_3x3_A.png",
  offsetTransitionCurved4x4: "../Tiles/Dungeon_Straight_4x4_A.png",
  cornerOutTrue2x2: "../Tiles/Dungeon_Corner_Out_2x2_A.png",
  cornerOutDiagonal2x2: "../Tiles/Dungeon_Corner_Out_2x2_B.png",
  cornerOutRounded2x2: "../Tiles/Dungeon_Corner_Out_2x2_C.png",
  cornerInTrue2x2: "../Tiles/Dungeon_Corner_In_2x2_A.png",
  cornerInDiagonal2x2: "../Tiles/Dungeon_Corner_In_2x2_B.png",
  cornerInRounded2x2: "../Tiles/Dungeon_Corner_In_2x2_C.png",
  wallCornerTrue2x2: "../Tiles/Dungeon_Wall_Corner_2x2.png",
  wallCornerDiagonal2x2: "../Tiles/Dungeon_Wall_Corner_2x2_B.png",
  wallCornerRounded2x2: "../Tiles/Dungeon_Wall_Corner_2x2_C.png",
  deadEndSquared3x2: "../Tiles/Dungeon_Dead_End_3x2_A.png",
  deadEndInvertedU3x2: "../Tiles/Dungeon_Dead_End_3x2_B.png",
  deadEndOutSquared3x2: "../Tiles/Dungeon_Dead_End_Out_3x2_A.png",
  deadEndOutInvertedU3x2: "../Tiles/Dungeon_Dead_End_Out_3x2_B.png",
  wallEndLeft: "../Tiles/Dungeon_End_Left.png",
  wallEndRight: "../Tiles/Dungeon_End_Right.png",
  wallEndLargeRight1x2: "../Tiles/Dungeon_Wall_End_Piece_1x2_A.png",
  wallEndLargeLeft1x2: "../Tiles/Dungeon_Wall_End_Piece_1x2_B.png",
  wallFix1: "../Tiles/Dungeon_Wall_Fix_1.png",
  wallFix2: "../Tiles/Dungeon_Wall_Fix_2.png",
  wallFix3: "../Tiles/Dungeon_Wall_Fix_3.png",
  wallFix4: "../Tiles/Dungeon_Wall_Fix_4.png",
  wallFix5: "../Tiles/Dungeon_Wall_Fix_5.png",
  wallFix6: "../Tiles/Dungeon_Wall_Fix_6.png",
  pillar1x1A: "../Tiles/Dungeon_Pillar_1x1_A.png",
  pillar1x1B: "../Tiles/Dungeon_Pillar_1x1_B.png",
  pillar2x2A: "../Tiles/Dungeon_Pillar_2x2_A.png",
  pillar2x2B: "../Tiles/Dungeon_Pillar_2x2_B.png",
  pillar2x2C: "../Tiles/Dungeon_Pillar_2x2_C.png",
  pillar2x2D: "../Tiles/Dungeon_Pillar_2x2_D.png",
  blackPatchPit: "../Tiles/Black_Patch.png",
  stairsThick2x2: "../Tiles/Dungeon_Stairs_Thick_2x2.png",
  stairsThick2x2Transparent: "../Tiles/Dungeon_Stairs_Thick_2x2_Transparent.png",
  stairsThick3x2: "../Tiles/Dungeon_Stairs_Thick_3x2.png",
  stairsThick3x2Transparent: "../Tiles/Dungeon_Stairs_Thick_3x2_Transparent.png",
  stairsThin2x1: "../Tiles/Dungeon_Stairs_Thin_2x1.png",
  stairsThin2x1Transparent: "../Tiles/Dungeon_Stairs_Thin_2x1_Transparent.png",
  stairsThin3x1: "../Tiles/Dungeon_Stairs_Thin_3x1.png",
  stairsThin3x1Transparent: "../Tiles/Dungeon_Stairs_Thin_3x1_Transparent.png",
  crossroadPlus2x2: "../Tiles/Dungeon_Wall_Crossroad_2x2_A.png",
  crossroadT2x2: "../Tiles/Dungeon_Wall_Crossroad_2x2_B.png",
  woodenDoorStoneA1x2: "../Tiles/Dungeon_Wooden_Door_1x2_A.png",
  woodenDoorStoneB1x2: "../Tiles/Dungeon_Wooden_Door_1x2_B.png",
  woodenDoorNoConnector1x2: "../Tiles/Dungeon_Wooden_Door_1x2_C.png",
  woodenDoorWoodConnector1x2: "../Tiles/Dungeon_Wooden_Door_1x2_D.png",
  woodenDoubleDoorStoneA2x2: "../Tiles/Dungeon_Wooden_Double_Door_2x2_A.png",
  woodenDoubleDoorStoneB2x2: "../Tiles/Dungeon_Wooden_Double_Door_2x2_B.png",
  woodenDoubleDoorNoConnector2x2: "../Tiles/Dungeon_Wooden_Double_Door_2x2_C.png",
  woodenDoubleDoorWoodConnector2x2: "../Tiles/Dungeon_Wooden_Double_Door_2x2_D.png",
};

export class DungeonRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.imageCache = new Map();
    this.floorCache = new Map();
    this.staticMapCache = new Map();
    this.fogCanvas = document.createElement("canvas");
    this.fogCtx = this.fogCanvas.getContext("2d");
  }

  async render(dungeon, zoom, options = {}) {
    this.revealAll = Boolean(options.revealAll);
    this.playerLight = {
      floorIndex: dungeon.player.floorIndex,
      wallX: dungeon.player.wallX,
      wallY: dungeon.player.wallY,
    };
    this.currentFloor = dungeon.currentFloor;
    this.lightMap = this.buildLightMap(dungeon);
    const cellSize = RENDER_CELL_SIZE;
    const displayScale = Math.max(0.25, Number(zoom) / RENDER_CELL_SIZE);
    const width = dungeon.wallGridWidth * cellSize;
    const height = dungeon.wallGridHeight * cellSize;
    const ratio = window.devicePixelRatio || 1;
    const pixelWidth = Math.ceil(width * ratio);
    const pixelHeight = Math.ceil(height * ratio);
    if (this.canvas.width !== pixelWidth) this.canvas.width = pixelWidth;
    if (this.canvas.height !== pixelHeight) this.canvas.height = pixelHeight;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.canvas.style.transform = `scale(${displayScale})`;
    const stage = this.canvas.parentElement;
    if (stage) {
      stage.style.width = `${width * displayScale}px`;
      stage.style.height = `${height * displayScale}px`;
    }
    const ctx = this.ctx;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.clearRect(0, 0, width, height);
    const staticMap = await this.getStaticMap(dungeon, cellSize, options);
    ctx.drawImage(staticMap, 0, 0);
    this.drawVisited(dungeon, cellSize);
    this.drawFogOfWar(dungeon, cellSize);
    this.drawPlayer(dungeon, cellSize);
    if (options.debugLabels) this.drawDebugLabels(dungeon, cellSize);
  }

  async getStaticMap(dungeon, cellSize, options) {
    const cacheKey = staticMapCacheKey(dungeon, cellSize, options);
    const cached = this.staticMapCache.get(cacheKey);
    if (cached) return cached;

    const previousCtx = this.ctx;
    const previousStaticRender = this.staticRender;
    const canvas = document.createElement("canvas");
    canvas.width = dungeon.wallGridWidth * cellSize;
    canvas.height = dungeon.wallGridHeight * cellSize;
    this.ctx = canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = "high";
    this.staticRender = true;

    await this.drawFloor(dungeon, cellSize);
    this.drawWalkable(dungeon, cellSize);
    if (options.artWalls) {
      await this.drawWallArt(dungeon, cellSize);
      this.drawWallDebugEdges(dungeon, cellSize);
    } else {
      this.drawWalls(dungeon, cellSize);
    }
    await this.drawDoors(dungeon, cellSize);
    this.drawEvents(dungeon, cellSize);
    this.drawFloorConnections(dungeon, cellSize);

    this.ctx = previousCtx;
    this.staticRender = previousStaticRender;
    this.staticMapCache.set(cacheKey, canvas);
    pruneCanvasCache(this.staticMapCache, MAX_STATIC_MAP_CACHE_ITEMS);
    return canvas;
  }

  async drawFloor(dungeon, cellSize) {
    const ctx = this.ctx;
    const floor = dungeon.floors[dungeon.currentFloor];
    const cacheKey = floorCacheKey(dungeon, cellSize);
    const cached = this.floorCache.get(cacheKey);
    if (cached) {
      ctx.drawImage(cached, 0, 0);
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = dungeon.wallGridWidth * cellSize;
    canvas.height = dungeon.wallGridHeight * cellSize;
    const floorCtx = canvas.getContext("2d");
    const tilePixelSize = dungeon.floorTileSize;
    const scaledFloorSize = (tilePixelSize / dungeon.wallCellSize) * cellSize;
    for (const row of floor.floorGrid) {
      for (const floorCell of row) {
        const src = FLOOR_TILES[floorCell.tile] ?? FLOOR_TILES.stone_standard_square;
        const img = await this.loadImage(src);
        const x = floorCell.floorX * scaledFloorSize;
        const y = floorCell.floorY * scaledFloorSize;
        if (img) {
          floorCtx.drawImage(img, x, y, scaledFloorSize, scaledFloorSize);
        } else {
          drawFallbackFloorTile(floorCtx, x, y, scaledFloorSize, floorCell.tile);
        }
      }
    }
    floorCtx.fillStyle = "rgba(12, 10, 8, 0.24)";
    floorCtx.fillRect(0, 0, dungeon.wallGridWidth * cellSize, dungeon.wallGridHeight * cellSize);
    this.floorCache.set(cacheKey, canvas);
    pruneCanvasCache(this.floorCache, MAX_FLOOR_CACHE_ITEMS);
    ctx.drawImage(canvas, 0, 0);
  }

  loadImage(src) {
    if (this.imageCache.has(src)) return this.imageCache.get(src);
    const promise = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
    this.imageCache.set(src, promise);
    return promise;
  }

  drawWalkable(dungeon, cellSize) {
    const ctx = this.ctx;
    const floor = dungeon.floors[dungeon.currentFloor];
    for (const row of floor.wallGrid) {
      for (const cell of row) {
        if (!cell.walkable || !this.isVisible(cell)) continue;
        ctx.fillStyle = cell.spaceType === "room" ? ROOM_COLOR : CORRIDOR_COLOR;
        ctx.fillRect(cell.wallX * cellSize, cell.wallY * cellSize, cellSize, cellSize);
        if (!this.staticRender && cell.visited) {
          ctx.fillStyle = VISITED_COLOR;
          ctx.fillRect(cell.wallX * cellSize, cell.wallY * cellSize, cellSize, cellSize);
        }
      }
    }
  }

  drawVisited(dungeon, cellSize) {
    const ctx = this.ctx;
    const floor = dungeon.floors[dungeon.currentFloor];
    ctx.save();
    ctx.fillStyle = VISITED_COLOR;
    for (const row of floor.wallGrid) {
      for (const cell of row) {
        if (!cell.walkable || !cell.visited) continue;
        ctx.fillRect(cell.wallX * cellSize, cell.wallY * cellSize, cellSize, cellSize);
      }
    }
    ctx.restore();
  }

  drawWalls(dungeon, cellSize) {
    const ctx = this.ctx;
    const floor = dungeon.floors[dungeon.currentFloor];
    ctx.strokeStyle = WALL_COLOR;
    ctx.lineWidth = Math.max(2, cellSize * 0.22);
    ctx.lineCap = "round";
    for (const row of floor.wallGrid) {
      for (const cell of row) {
        if (!cell.walkable || !this.isVisible(cell)) continue;
        const x = cell.wallX * cellSize;
        const y = cell.wallY * cellSize;
        if (edgeLooksLikeWall(cell, "north")) line(ctx, x, y, x + cellSize, y);
        if (edgeLooksLikeWall(cell, "east")) line(ctx, x + cellSize, y, x + cellSize, y + cellSize);
        if (edgeLooksLikeWall(cell, "south")) line(ctx, x, y + cellSize, x + cellSize, y + cellSize);
        if (edgeLooksLikeWall(cell, "west")) line(ctx, x, y, x, y + cellSize);
      }
    }
  }

  async drawWallArt(dungeon, cellSize) {
    const wallImages = {
      1: await this.loadImage(WALL_ASSETS.straight1x1),
      2: await this.loadImage(WALL_ASSETS.straight2x2),
      3: await this.loadImage(WALL_ASSETS.straight3x2),
      4: await this.loadImage(WALL_ASSETS.straight4x2),
    };
    const corner = await this.loadImage(WALL_ASSETS.cornerOutTrue2x2);
    const floor = dungeon.floors[dungeon.currentFloor];
    if (!wallImages[1] || !wallImages[2] || !wallImages[3] || !wallImages[4] || !corner) {
      this.drawWalls(dungeon, cellSize);
      return;
    }

    this.drawHorizontalWallRuns(floor, "north", wallImages, cellSize);
    this.drawHorizontalWallRuns(floor, "south", wallImages, cellSize);
    this.drawVerticalWallRuns(floor, "west", wallImages, cellSize);
    this.drawVerticalWallRuns(floor, "east", wallImages, cellSize);
    this.drawCornerArt(floor, corner, cellSize);
  }

  drawHorizontalWallRuns(floor, edge, wallImages, cellSize) {
    for (const row of floor.wallGrid) {
      let x = 0;
      while (x < row.length) {
        const cell = row[x];
        if (!isDrawableWallEdge(cell, edge, (target) => this.isVisible(target))) {
          x += 1;
          continue;
        }
        const startX = x;
        const y = cell.wallY;
        while (x < row.length && isDrawableWallEdge(row[x], edge, (target) => this.isVisible(target))) x += 1;
        this.drawWallRun(startX, y, x - startX, edge, wallImages, cellSize);
      }
    }
  }

  drawVerticalWallRuns(floor, edge, wallImages, cellSize) {
    const height = floor.wallGrid.length;
    const width = floor.wallGrid[0]?.length ?? 0;
    for (let x = 0; x < width; x += 1) {
      let y = 0;
      while (y < height) {
        const cell = floor.wallGrid[y][x];
        if (!isDrawableWallEdge(cell, edge, (target) => this.isVisible(target))) {
          y += 1;
          continue;
        }
        const startY = y;
        while (y < height && isDrawableWallEdge(floor.wallGrid[y][x], edge, (target) => this.isVisible(target))) y += 1;
        this.drawVerticalWallRun(x, startY, y - startY, edge, wallImages, cellSize);
      }
    }
  }

  drawWallRun(gridX, gridY, length, edge, wallImages, cellSize) {
    let offset = 0;
    while (offset < length) {
      const remaining = length - offset;
      const chunk = remaining >= 4 ? 4 : remaining >= 3 ? 3 : remaining >= 2 ? 2 : 1;
      const img = wallImages[chunk];
      const x = (gridX + (edge === "north" || edge === "south" ? offset : 0)) * cellSize;
      const y = (gridY + (edge === "west" || edge === "east" ? offset : 0)) * cellSize;
      const width = chunk * cellSize;
      const height = 2 * cellSize;

      if (edge === "north") drawAsset(this.ctx, img, x, y - cellSize, width, height, 0);
      if (edge === "south") drawAsset(this.ctx, img, x, y, width, height, Math.PI);
      if (edge === "west") drawAsset(this.ctx, img, x - cellSize, y, width, height, -Math.PI / 2);
      if (edge === "east") drawAsset(this.ctx, img, x, y, width, height, Math.PI / 2);

      offset += chunk;
    }
  }

  drawVerticalWallRun(gridX, gridY, length, edge, wallImages, cellSize) {
    let offset = 0;
    while (offset < length) {
      const remaining = length - offset;
      const chunk = remaining >= 4 ? 4 : remaining >= 3 ? 3 : remaining >= 2 ? 2 : 1;
      const img = wallImages[chunk];
      const x = gridX * cellSize;
      const y = (gridY + offset) * cellSize;
      const width = 2 * cellSize;
      const height = chunk * cellSize;

      if (edge === "west") drawRotatedAsset(this.ctx, img, x - cellSize, y, width, height, -Math.PI / 2);
      if (edge === "east") drawRotatedAsset(this.ctx, img, x, y, width, height, Math.PI / 2);

      offset += chunk;
    }
  }

  drawCornerArt(floor, corner, cellSize) {
    const usedCorners = new Set();
    for (const row of floor.wallGrid) {
      for (const cell of row) {
        if (!cell.walkable || !this.isVisible(cell)) continue;
        const x = cell.wallX * cellSize;
        const y = cell.wallY * cellSize;
        const cornerKey = `${cell.wallX},${cell.wallY}`;
        if (!usedCorners.has(cornerKey)) {
          const cornerType = getCornerType(cell);
          if (cornerType) {
            usedCorners.add(cornerKey);
            const rotation = cornerRotation(cornerType);
            const offset = cornerOffset(cornerType, cellSize);
            drawAsset(this.ctx, corner, x + offset.x, y + offset.y, cellSize * 2, cellSize * 2, rotation);
          }
        }
      }
    }
  }

  drawWallDebugEdges(dungeon, cellSize) {
    const ctx = this.ctx;
    const floor = dungeon.floors[dungeon.currentFloor];
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
    ctx.lineWidth = 1;
    for (const row of floor.wallGrid) {
      for (const cell of row) {
        if (!cell.walkable || !this.isVisible(cell)) continue;
        const x = cell.wallX * cellSize;
        const y = cell.wallY * cellSize;
        if (edgeLooksLikeWall(cell, "north")) line(ctx, x, y, x + cellSize, y);
        if (edgeLooksLikeWall(cell, "east")) line(ctx, x + cellSize, y, x + cellSize, y + cellSize);
        if (edgeLooksLikeWall(cell, "south")) line(ctx, x, y + cellSize, x + cellSize, y + cellSize);
        if (edgeLooksLikeWall(cell, "west")) line(ctx, x, y, x, y + cellSize);
      }
    }
    ctx.restore();
  }

  async drawDoors(dungeon, cellSize) {
    const ctx = this.ctx;
    const doors = (dungeon.doors ?? dungeon.rooms.flatMap((room) => room.doors ?? []))
      .filter((door) => door.floorIndex === undefined || door.floorIndex === dungeon.currentFloor);
    const doorImages = {
      single: await this.loadImage(WALL_ASSETS.woodenDoorStoneA1x2),
      double: await this.loadImage(WALL_ASSETS.woodenDoubleDoorStoneA2x2),
      open: await this.loadImage(WALL_ASSETS.woodenDoorNoConnector1x2),
    };
    for (const door of doors) {
      if (door.doorType === "secret" && !door.revealed) continue;
      const pos = door.inside ?? doorPosition(dungeon.rooms.find((room) => room.id === door.roomId), door);
      if (!pos) continue;
      const doorCell = getCell(dungeon, dungeon.currentFloor, pos.x, pos.y);
      if (!this.isVisible(doorCell)) continue;
      const x = pos.x * cellSize;
      const y = pos.y * cellSize;
      if (door.doorType === "open_chamber") {
        ctx.save();
        ctx.globalAlpha = 0.82;
        if (doorImages.open) {
          drawDoorAsset(ctx, doorImages.open, x, y, cellSize, { ...door, width: 1 });
        } else {
          drawFallbackDoor(ctx, x, y, cellSize, { ...door, width: 1 });
        }
        ctx.restore();
      } else {
        const img = door.width > 1 ? doorImages.double : doorImages.single;
        ctx.save();
        if (door.open) ctx.globalAlpha = 0.52;
        if (img) {
          drawDoorAsset(ctx, img, x, y, cellSize, door);
        } else {
          drawFallbackDoor(ctx, x, y, cellSize, door);
        }
        ctx.restore();
        if (door.locked && door.revealed) drawLockMarker(ctx, x, y, cellSize, door.wall);
      }
    }
  }

  drawEvents(dungeon, cellSize) {
    const ctx = this.ctx;
    const floor = dungeon.floors[dungeon.currentFloor];
    for (const row of floor.wallGrid) {
      for (const cell of row) {
        if (!cell.walkable || !this.isVisible(cell) || !cell.rolledEvent || cell.rolledEvent.resolved) continue;
        ctx.fillStyle = cell.rolledEvent.id === "boss_room" ? BOSS_COLOR : EVENT_COLOR;
        ctx.beginPath();
        ctx.arc(cell.wallX * cellSize + cellSize / 2, cell.wallY * cellSize + cellSize / 2, Math.max(3, cellSize * 0.28), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawFloorConnections(dungeon, cellSize) {
    const ctx = this.ctx;
    const floor = dungeon.floors[dungeon.currentFloor];
    ctx.save();
    for (const row of floor.wallGrid) {
      for (const cell of row) {
        if (!cell.walkable || !this.isVisible(cell) || !cell.verticalConnection) continue;
        const x = cell.wallX * cellSize + cellSize / 2;
        const y = cell.wallY * cellSize + cellSize / 2;
        const radius = Math.max(4, cellSize * 0.36);
        ctx.fillStyle = cell.verticalConnection.marker === "stairs_down" ? "#314f68" : "#715c9a";
        ctx.strokeStyle = "#f7f0d2";
        ctx.lineWidth = Math.max(1, cellSize * 0.08);
        ctx.beginPath();
        if (cell.verticalConnection.marker === "stairs_down") {
          ctx.moveTo(x - radius, y - radius * 0.55);
          ctx.lineTo(x + radius, y - radius * 0.55);
          ctx.lineTo(x, y + radius);
        } else {
          ctx.moveTo(x, y - radius);
          ctx.lineTo(x + radius, y + radius * 0.55);
          ctx.lineTo(x - radius, y + radius * 0.55);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawFogOfWar(dungeon, cellSize) {
    if (this.revealAll) return;
    const width = dungeon.wallGridWidth * cellSize;
    const height = dungeon.wallGridHeight * cellSize;
    const overlay = this.fogCanvas;
    const fog = this.fogCtx;
    if (overlay.width !== width || overlay.height !== height) {
      overlay.width = width;
      overlay.height = height;
    }
    fog.setTransform(1, 0, 0, 1, 0, 0);
    fog.clearRect(0, 0, width, height);
    fog.globalCompositeOperation = "source-over";
    fog.fillStyle = DARKNESS_OVERLAY;
    fog.fillRect(0, 0, width, height);
    fog.globalCompositeOperation = "destination-out";
    for (const [key, light] of this.lightMap) {
      const [x, y] = key.split(",").map(Number);
      fog.fillStyle = light === "full" ? "rgba(0, 0, 0, 1)" : "rgba(0, 0, 0, 0.54)";
      fog.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
    }
    fog.globalCompositeOperation = "source-over";
    this.ctx.drawImage(overlay, 0, 0);
  }

  drawPlayer(dungeon, cellSize) {
    const ctx = this.ctx;
    if (dungeon.player.floorIndex !== dungeon.currentFloor) return;
    const x = dungeon.player.wallX * cellSize + cellSize / 2;
    const y = dungeon.player.wallY * cellSize + cellSize / 2;
    ctx.fillStyle = "#f7f0d2";
    ctx.strokeStyle = "#24211c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(5, cellSize * 0.48), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  drawDebugLabels(dungeon, cellSize) {
    const ctx = this.ctx;
    const floor = dungeon.floors[dungeon.currentFloor];
    const fontSize = Math.max(6, Math.floor(cellSize * 0.42));
    ctx.save();
    ctx.font = `${fontSize}px Consolas, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const row of floor.wallGrid) {
      for (const cell of row) {
        if (!this.isVisible(cell)) continue;
        const x = cell.wallX * cellSize;
        const y = cell.wallY * cellSize;
        ctx.fillStyle = "rgba(255, 255, 255, 0.42)";
        ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
        ctx.fillStyle = labelColor(cell);
        const label = makeCellLabel(cell);
        if (cellSize >= 16) {
          const parts = label.split(" ");
          ctx.fillText(parts[0], x + cellSize / 2, y + cellSize * 0.36);
          ctx.fillText(parts[1] ?? "", x + cellSize / 2, y + cellSize * 0.7);
        } else {
          ctx.fillText(label.charAt(0), x + cellSize / 2, y + cellSize / 2);
        }
      }
    }
    ctx.restore();
  }

  isVisible(cell) {
    return Boolean(cell && (this.staticRender || this.revealAll || this.lightLevel(cell) !== "dark"));
  }

  lightLevel(cell) {
    if (this.revealAll) return "full";
    if (!cell || !this.lightMap) return "dark";
    return this.lightMap.get(lightKey(cell.wallX, cell.wallY)) ?? "dark";
  }

  buildLightMap(dungeon) {
    const lightMap = new Map();
    if (this.revealAll || dungeon.player.floorIndex !== dungeon.currentFloor) return lightMap;
    const floor = dungeon.floors[dungeon.currentFloor];
    const origin = getCell(dungeon, dungeon.currentFloor, dungeon.player.wallX, dungeon.player.wallY);
    if (!origin) return lightMap;
    const minX = Math.max(0, origin.wallX - TORCH_DIM_RADIUS);
    const maxX = Math.min(dungeon.wallGridWidth - 1, origin.wallX + TORCH_DIM_RADIUS);
    const minY = Math.max(0, origin.wallY - TORCH_DIM_RADIUS);
    const maxY = Math.min(dungeon.wallGridHeight - 1, origin.wallY + TORCH_DIM_RADIUS);
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const cell = floor.wallGrid[y]?.[x];
        if (!cell) continue;
        const distance = Math.hypot(x - origin.wallX, y - origin.wallY);
        if (distance > TORCH_DIM_RADIUS) continue;
        if (!hasLineOfLight(floor, origin, cell)) continue;
        lightMap.set(lightKey(x, y), distance <= TORCH_FULL_RADIUS ? "full" : "dim");
      }
    }
    return lightMap;
  }
}

function line(ctx, x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawFallbackFloorTile(ctx, x, y, size, tileKey = "") {
  const palette = tileKey.includes("dark")
    ? ["#2f3232", "#3b3f3f"]
    : tileKey.includes("sandstone")
      ? ["#665b45", "#766b52"]
      : ["#4b4e4a", "#5a5d58"];
  ctx.fillStyle = palette[0];
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
  ctx.lineWidth = Math.max(1, size * 0.006);
  const step = Math.max(18, size / 8);
  for (let py = y; py <= y + size; py += step) {
    ctx.beginPath();
    ctx.moveTo(x, py);
    ctx.lineTo(x + size, py + Math.sin(py * 0.03) * step * 0.28);
    ctx.stroke();
  }
  for (let px = x; px <= x + size; px += step) {
    ctx.beginPath();
    ctx.moveTo(px, y);
    ctx.lineTo(px + Math.cos(px * 0.03) * step * 0.28, y + size);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
  ctx.fillRect(x, y, size, size);
}

function drawAsset(ctx, img, x, y, width, height, rotation) {
  if (!img) return;
  ctx.save();
  ctx.translate(x + width / 2, y + height / 2);
  ctx.rotate(rotation);
  ctx.drawImage(img, -width / 2, -height / 2, width, height);
  ctx.restore();
}

function drawRotatedAsset(ctx, img, x, y, width, height, rotation) {
  if (!img) return;
  ctx.save();
  ctx.translate(x + width / 2, y + height / 2);
  ctx.rotate(rotation);
  ctx.drawImage(img, -height / 2, -width / 2, height, width);
  ctx.restore();
}

function isDrawableWallEdge(cell, edge, isVisible) {
  return Boolean(cell?.walkable && isVisible(cell) && edgeLooksLikeWall(cell, edge));
}

function edgeLooksLikeWall(cell, edge) {
  const edgeType = cell?.edges?.[edge];
  if (edgeType === "wall") return true;
  if (edgeType !== "secret_door") return false;
  return !cell.edgeFeatures?.[edge]?.revealed;
}

function hasLineOfLight(floor, origin, target) {
  if (origin === target) return true;
  const cells = lineCells(origin, target)
    .map((point) => floor.wallGrid[point.y]?.[point.x])
    .filter(Boolean);
  let current = cells[0];
  for (const next of cells.slice(1)) {
    if (!lightCanPass(floor, current, next)) return false;
    current = next;
  }
  return true;
}

function lineCells(origin, target) {
  const cells = [];
  let x = origin.wallX;
  let y = origin.wallY;
  const endX = target.wallX;
  const endY = target.wallY;
  const dx = Math.abs(endX - x);
  const dy = Math.abs(endY - y);
  const sx = x < endX ? 1 : -1;
  const sy = y < endY ? 1 : -1;
  let err = dx - dy;

  while (true) {
    cells.push({ x, y });
    if (x === endX && y === endY) break;
    const e2 = err * 2;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
  return cells;
}

function lightCanPass(floor, current, next) {
  if (!current || !next) return false;
  const dx = next.wallX - current.wallX;
  const dy = next.wallY - current.wallY;
  if (Math.abs(dx) + Math.abs(dy) === 1) return cardinalLightPass(current, next);
  if (Math.abs(dx) === 1 && Math.abs(dy) === 1) {
    const horizontal = floor.wallGrid[current.wallY]?.[current.wallX + dx];
    const vertical = floor.wallGrid[current.wallY + dy]?.[current.wallX];
    return Boolean(
      (horizontal && cardinalLightPass(current, horizontal) && cardinalLightPass(horizontal, next)) ||
      (vertical && cardinalLightPass(current, vertical) && cardinalLightPass(vertical, next))
    );
  }
  return false;
}

function cardinalLightPass(current, next) {
  const direction = directionBetween(current, next);
  if (!direction) return false;
  return edgeAllowsLight(current, direction.name) && edgeAllowsLight(next, direction.opposite);
}

function directionBetween(current, next) {
  const dx = next.wallX - current.wallX;
  const dy = next.wallY - current.wallY;
  if (dx === 1 && dy === 0) return { name: "east", opposite: "west" };
  if (dx === -1 && dy === 0) return { name: "west", opposite: "east" };
  if (dx === 0 && dy === 1) return { name: "south", opposite: "north" };
  if (dx === 0 && dy === -1) return { name: "north", opposite: "south" };
  return null;
}

function edgeAllowsLight(cell, direction) {
  const edge = cell.edges?.[direction];
  if (edge === "open" || edge === "open_chamber") return true;
  if (edge === "door") return Boolean(cell.edgeFeatures?.[direction]?.open);
  if (edge === "secret_door") return Boolean(cell.edgeFeatures?.[direction]?.revealed && cell.edgeFeatures?.[direction]?.open);
  return false;
}

function lightKey(x, y) {
  return `${x},${y}`;
}

function floorCacheKey(dungeon, cellSize) {
  const floor = dungeon.floors[dungeon.currentFloor];
  const tileIds = floor.floorGrid.flat().map((cell) => cell.tile).join("|");
  return `${dungeon.dungeonId}:${dungeon.currentFloor}:${cellSize}:${dungeon.wallGridWidth}x${dungeon.wallGridHeight}:${tileIds}`;
}

function staticMapCacheKey(dungeon, cellSize, options) {
  const artMode = options.artWalls ? "art" : "line";
  const doorState = (dungeon.doors ?? [])
    .filter((door) => door.floorIndex === dungeon.currentFloor)
    .map((door) => `${door.id}:${door.revealed ? 1 : 0}:${door.open ? 1 : 0}:${door.locked ? 1 : 0}`)
    .join("|");
  return `${dungeon.dungeonId}:${dungeon.currentFloor}:${cellSize}:${artMode}:${doorState}`;
}

function pruneCanvasCache(cache, maxItems) {
  while (cache.size > maxItems) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
}

function getCornerType(cell) {
  const n = edgeLooksLikeWall(cell, "north");
  const e = edgeLooksLikeWall(cell, "east");
  const s = edgeLooksLikeWall(cell, "south");
  const w = edgeLooksLikeWall(cell, "west");
  if (n && w) return "north-west";
  if (n && e) return "north-east";
  if (s && e) return "south-east";
  if (s && w) return "south-west";
  return null;
}

function cornerRotation(type) {
  // The base corner art's visual turn is opposite the logical corner
  // reported by the cell edge test, so rotate by 180 degrees.
  if (type === "north-west") return Math.PI;
  if (type === "north-east") return -Math.PI / 2;
  if (type === "south-east") return 0;
  return Math.PI / 2;
}

function cornerOffset(type, cellSize) {
  // Anchor the 2x2 corner art outside the walkable cell so the curve hugs
  // the outer wall edges instead of sitting one wall width inside the room.
  if (type === "north-west") return { x: -cellSize, y: -cellSize };
  if (type === "north-east") return { x: 0, y: -cellSize };
  if (type === "south-east") return { x: 0, y: 0 };
  return { x: -cellSize, y: 0 };
}

function doorPosition(room, door) {
  if (!room) return null;
  if (door.wall === "north") return { x: room.x + door.offset, y: room.y };
  if (door.wall === "south") return { x: room.x + door.offset, y: room.y + room.height - 1 };
  if (door.wall === "east") return { x: room.x + room.width - 1, y: room.y + door.offset };
  return { x: room.x, y: room.y + door.offset };
}

function drawDoorAsset(ctx, img, x, y, cellSize, door) {
  const widthCells = door.width > 1 ? 2 : 1;
  const assetWidth = cellSize * widthCells * 1.28;
  const assetHeight = cellSize * 2.18;
  const centerX = x + (cellSize * widthCells) / 2;
  const centerY = y + (cellSize * widthCells) / 2;
  if (door.wall === "north") {
    drawAsset(ctx, img, centerX - assetWidth / 2, y - assetHeight / 2, assetWidth, assetHeight, 0);
  } else if (door.wall === "south") {
    drawAsset(ctx, img, centerX - assetWidth / 2, y + cellSize - assetHeight / 2, assetWidth, assetHeight, Math.PI);
  } else if (door.wall === "east") {
    drawAsset(ctx, img, x + cellSize - assetWidth / 2, centerY - assetHeight / 2, assetWidth, assetHeight, Math.PI / 2);
  } else {
    drawAsset(ctx, img, x - assetWidth / 2, centerY - assetHeight / 2, assetWidth, assetHeight, -Math.PI / 2);
  }
}

function drawFallbackDoor(ctx, x, y, cellSize, door) {
  const widthCells = door.width > 1 ? 2 : 1;
  const long = cellSize * widthCells * 0.72;
  const thick = Math.max(3, cellSize * 0.16);
  const centerX = x + (cellSize * widthCells) / 2;
  const centerY = y + (cellSize * widthCells) / 2;
  let rect;
  if (door.wall === "north") {
    rect = { x: centerX - long / 2, y: y - thick / 2, width: long, height: thick };
  } else if (door.wall === "south") {
    rect = { x: centerX - long / 2, y: y + cellSize - thick / 2, width: long, height: thick };
  } else if (door.wall === "east") {
    rect = { x: x + cellSize - thick / 2, y: centerY - long / 2, width: thick, height: long };
  } else {
    rect = { x: x - thick / 2, y: centerY - long / 2, width: thick, height: long };
  }
  ctx.save();
  ctx.fillStyle = door.open ? "#b58a54" : "#7b4d2a";
  ctx.strokeStyle = "#2b2018";
  ctx.lineWidth = Math.max(1, cellSize * 0.05);
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
  ctx.restore();
}

function drawLockMarker(ctx, x, y, cellSize, wall) {
  const marker = Math.max(3, cellSize * 0.22);
  let px = x + cellSize / 2;
  let py = y + cellSize / 2;
  if (wall === "north") py = y;
  if (wall === "south") py = y + cellSize;
  if (wall === "west") px = x;
  if (wall === "east") px = x + cellSize;
  ctx.save();
  ctx.fillStyle = "#9b2f2f";
  ctx.strokeStyle = "#2a1614";
  ctx.lineWidth = Math.max(1, cellSize * 0.05);
  ctx.beginPath();
  ctx.arc(px, py, marker, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function describeCell(dungeon) {
  const cell = getCell(dungeon, dungeon.player.floorIndex, dungeon.player.wallX, dungeon.player.wallY);
  if (!cell) return [];
  return [
    ["Floor", String(dungeon.player.floorIndex + 1)],
    ["Position", `${cell.wallX}, ${cell.wallY}`],
    ["Type", cell.spaceType],
    ["Room", cell.roomId ?? "-"],
    ["Corridor", cell.corridorId ?? "-"],
    ["Edges", edgeSummary(cell)],
    ["Passage", passageSummary(cell)],
    ["Event", cell.rolledEvent?.title ?? "Not rolled"],
    ["Layer Link", describeVerticalConnection(cell)],
    ["Visited", cell.visited ? "Yes" : "No"],
  ];
}

function describeVerticalConnection(cell) {
  if (!cell.verticalConnection) return "-";
  const target = cell.verticalConnection.targetFloorIndex + 1;
  const marker = cell.verticalConnection.marker === "stairs_down" ? "Down" : "Up";
  return `${marker} to F${target} at ${cell.verticalConnection.targetWallX}, ${cell.verticalConnection.targetWallY}`;
}

function edgeSummary(cell) {
  return `N:${cell.edges.north[0]} E:${cell.edges.east[0]} S:${cell.edges.south[0]} W:${cell.edges.west[0]}`;
}

function passageSummary(cell) {
  const features = Object.entries(cell.edgeFeatures ?? {}).filter(([, feature]) => feature);
  if (!features.length) return "-";
  return features.map(([edge, feature]) => `${edge}:${feature.doorType}`).join(", ");
}

function makeCellLabel(cell) {
  const type = cell.walkable ? (cell.spaceType === "room" ? "R" : "C") : "V";
  const link = cell.verticalConnection?.marker === "stairs_down" ? "D" : cell.verticalConnection ? "U" : "";
  const event = cell.rolledEvent && !cell.rolledEvent.resolved ? "!" : "";
  const boss = cell.eventLink === "boss_room" ? "B" : "";
  return `${cell.wallX},${cell.wallY} ${type}${boss}${link}${event}`;
}

function labelColor(cell) {
  if (cell.eventLink === "boss_room") return "#8d4e3d";
  if (cell.spaceType === "room") return "#4f3f2f";
  if (cell.spaceType === "corridor") return "#324d49";
  return "#6d665b";
}
