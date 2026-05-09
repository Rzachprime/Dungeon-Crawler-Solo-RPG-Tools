import { generateDungeonAsync, interactWithDoor, movePlayer, searchWall } from "./dungeon-generator.js";
import { parseDungeon, serializeDungeon, SIZE_PRESETS } from "./dungeon-state.js";
import { describeCell, DungeonRenderer } from "./dungeon-renderer.js";

const els = {
  size: document.getElementById("sizeSelect"),
  floors: document.getElementById("floorCountInput"),
  rooms: document.getElementById("roomCountInput"),
  seed: document.getElementById("seedInput"),
  floorTexture: document.getElementById("floorTextureSelect"),
  theme: document.getElementById("themeSelect"),
  zoom: document.getElementById("zoomInput"),
  debugLabels: document.getElementById("debugLabelsInput"),
  artWalls: document.getElementById("artWallsInput"),
  revealAll: document.getElementById("revealAllInput"),
  autoFollow: document.getElementById("autoFollowInput"),
  elfSearcher: document.getElementById("elfSearcherInput"),
  generate: document.getElementById("generateBtn"),
  copy: document.getElementById("copyBtn"),
  updateSave: document.getElementById("updateSaveBtn"),
  load: document.getElementById("loadBtn"),
  saveText: document.getElementById("saveText"),
  mapFrame: document.getElementById("mapFrame"),
  mapStage: document.getElementById("mapStage"),
  canvas: document.getElementById("dungeonCanvas"),
  dungeonName: document.getElementById("dungeonName"),
  dungeonMeta: document.getElementById("dungeonMeta"),
  floorTabs: document.getElementById("floorTabs"),
  cellDetails: document.getElementById("cellDetails"),
  eventLog: document.getElementById("eventLog"),
  generationStatus: document.getElementById("generationStatus"),
  generationStatusText: document.getElementById("generationStatusText"),
  generationProgress: document.getElementById("generationProgress"),
};

const renderer = new DungeonRenderer(els.canvas);
let dungeon = null;

const SEED_PREFIXES = [
  "ashen",
  "black",
  "bloodied",
  "broken",
  "buried",
  "crimson",
  "cursed",
  "dusken",
  "elder",
  "fallen",
  "forgotten",
  "frosted",
  "ghostly",
  "gilded",
  "hollow",
  "iron",
  "moonlit",
  "mournful",
  "obsidian",
  "ruined",
  "shadowed",
  "shattered",
  "silver",
  "sunken",
  "thorned",
  "veiled",
  "whispering",
];

const SEED_SUFFIXES = [
  "barrows",
  "catacombs",
  "chambers",
  "citadel",
  "crypts",
  "deep",
  "gate",
  "grottos",
  "halls",
  "hold",
  "labyrinth",
  "maw",
  "monastery",
  "ossuary",
  "passages",
  "reliquary",
  "ruins",
  "sanctum",
  "sepulcher",
  "spire",
  "temple",
  "tombs",
  "vaults",
  "warrens",
];

els.generate.addEventListener("click", async () => {
  const size = els.size.value;
  const floorCount = size === "super" ? Number(els.floors.value) : undefined;
  if (floorCount) els.floors.value = floorCount;
  setGenerating(true, "Preparing dungeon...", 0);
  try {
    dungeon = await generateDungeonAsync({
      size,
      floorCount,
      roomCount: Number(els.rooms.value),
      seed: ensureSeed(),
      floorTile: els.floorTexture.value,
      themeId: els.theme.value,
    }, updateGenerationStatus);
    await refresh();
    centerOnParty();
  } finally {
    setGenerating(false);
  }
});

els.copy.addEventListener("click", async () => {
  if (!dungeon) return;
  els.saveText.value = serializeDungeon(dungeon);
  await navigator.clipboard.writeText(els.saveText.value);
});

els.updateSave.addEventListener("click", () => {
  if (!dungeon) return;
  els.saveText.value = serializeDungeon(dungeon);
});

els.load.addEventListener("click", () => {
  try {
    dungeon = parseDungeon(els.saveText.value);
    refresh();
  } catch (error) {
    alert(error.message);
  }
});

els.zoom.addEventListener("input", () => {
  if (dungeon) refreshAndMaybeFollow();
});

els.debugLabels.addEventListener("change", () => {
  if (dungeon) renderOnly();
});

els.artWalls.addEventListener("change", () => {
  if (dungeon) renderOnly();
});

els.revealAll.addEventListener("change", () => {
  if (dungeon) renderOnly();
});

els.autoFollow.addEventListener("change", () => {
  centerOnParty();
});

els.canvas.addEventListener("click", async (event) => {
  if (!dungeon) return;
  const target = canvasInteractionTarget(event);
  if (!target) return;
  const cell = dungeon.floors[dungeon.currentFloor]?.wallGrid[target.y]?.[target.x];
  const feature = cell?.edgeFeatures?.[target.edge];
  let changed = false;
  if (feature && feature.doorType !== "secret") {
    changed = interactWithDoor(dungeon, dungeon.currentFloor, target.x, target.y, target.edge);
  } else {
    changed = searchWall(dungeon, dungeon.currentFloor, target.x, target.y, target.edge, {
      elf: els.elfSearcher.checked,
    });
  }
  await refresh();
  if (changed) centerOnParty();
});

document.querySelectorAll("[data-move]").forEach((button) => {
  button.addEventListener("click", () => {
    if (!dungeon) return;
    if (movePlayer(dungeon, button.dataset.move)) refreshAndMaybeFollow();
  });
});

document.addEventListener("keydown", (event) => {
  const direction = keyToDirection(event.key);
  if (!direction || isTypingTarget(event.target) || !dungeon) return;
  event.preventDefault();
  if (movePlayer(dungeon, direction)) refreshAndMaybeFollow();
});

els.size.addEventListener("change", () => {
  const isSuper = els.size.value === "super";
  els.floors.disabled = false;
  els.floors.min = isSuper ? 2 : 1;
  if (!els.floors.value) els.floors.value = isSuper ? 10 : 4;
  if (isSuper && Number(els.floors.value) < 10) els.floors.value = 10;
  if (isSuper && Number(els.floors.value) < 2) els.floors.value = 2;
  els.floors.title = "Maximum floors the random floor generator may create.";
  syncRoomCountHelp();
});

els.rooms.addEventListener("input", syncRoomCountHelp);

async function refresh() {
  await renderOnly();
  updatePanels();
}

async function refreshAndMaybeFollow() {
  await refresh();
  centerOnParty();
}

async function renderOnly() {
  await renderer.render(dungeon, Number(els.zoom.value), {
    debugLabels: els.debugLabels.checked,
    artWalls: els.artWalls.checked,
    revealAll: els.revealAll.checked,
  });
}

function updatePanels() {
  els.dungeonName.textContent = dungeon.name;
  const theme = dungeon.theme?.label ?? dungeon.themeId ?? "Theme";
  els.dungeonMeta.textContent = `${dungeon.sizeCategory} | ${theme} | ${dungeon.floorCount} layer(s) | ${dungeon.wallGridWidth} x ${dungeon.wallGridHeight} wall grid | turn ${dungeon.turn}`;
  updateFloorTabs();
  updateCellDetails();
  updateEventLog();
}

function updateFloorTabs() {
  els.floorTabs.innerHTML = "";
  for (let i = 0; i < dungeon.floorCount; i += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `F${i + 1}`;
    if (i === dungeon.currentFloor) button.classList.add("active");
    button.addEventListener("click", () => {
      dungeon.currentFloor = i;
      refresh();
    });
    els.floorTabs.append(button);
  }
}

function updateCellDetails() {
  els.cellDetails.innerHTML = "";
  for (const [key, value] of describeCell(dungeon)) {
    const dt = document.createElement("dt");
    dt.textContent = key;
    const dd = document.createElement("dd");
    dd.textContent = value;
    els.cellDetails.append(dt, dd);
  }
}

function updateEventLog() {
  els.eventLog.innerHTML = "";
  for (const entry of dungeon.eventLog.slice(0, 12)) {
    const li = document.createElement("li");
    li.textContent = `Turn ${entry.turn}: ${entry.text}`;
    els.eventLog.append(li);
  }
}

function centerOnParty() {
  els.mapFrame.classList.toggle("camera-follow", Boolean(els.autoFollow.checked));
  if (!els.autoFollow.checked) {
    els.mapStage.style.transform = "";
    return;
  }
  if (!dungeon || dungeon.player.floorIndex !== dungeon.currentFloor) return;
  const cellSize = Number(els.zoom.value);
  const targetX = (dungeon.player.wallX + 0.5) * cellSize;
  const targetY = (dungeon.player.wallY + 0.5) * cellSize;
  const tx = els.mapFrame.clientWidth / 2 - targetX;
  const ty = els.mapFrame.clientHeight / 2 - targetY;
  els.mapStage.style.transform = `translate(${tx}px, ${ty}px)`;
}

function canvasInteractionTarget(event) {
  const rect = els.canvas.getBoundingClientRect();
  const cellSize = Number(els.zoom.value);
  const x = Math.floor((event.clientX - rect.left) / cellSize);
  const y = Math.floor((event.clientY - rect.top) / cellSize);
  if (x < 0 || y < 0 || x >= dungeon.wallGridWidth || y >= dungeon.wallGridHeight) return null;
  const localX = ((event.clientX - rect.left) / cellSize) - x;
  const localY = ((event.clientY - rect.top) / cellSize) - y;
  const distances = [
    ["north", localY],
    ["south", 1 - localY],
    ["west", localX],
    ["east", 1 - localX],
  ].sort((a, b) => a[1] - b[1]);
  return { x, y, edge: distances[0][0] };
}

function setGenerating(isGenerating, message = "", value = 0) {
  els.generate.disabled = isGenerating;
  els.generationStatus.hidden = !isGenerating;
  els.generationStatusText.textContent = message;
  els.generationProgress.value = value;
}

function updateGenerationStatus(step) {
  const completed = Math.max(0, step.floorIndex + 1);
  const extraPhase = step.phase === "connections" ? 0.5 : step.phase === "complete" ? 1 : 0;
  const total = Math.max(1, step.floorCount + 1);
  els.generationStatus.hidden = false;
  els.generationStatusText.textContent = step.message;
  els.generationProgress.value = Math.min(1, (completed + extraPhase) / total);
}

function syncRoomCountHelp() {
  const preset = SIZE_PRESETS[els.size.value] ?? SIZE_PRESETS.medium;
  const minimum = Math.max(6, Math.floor(Math.min(preset.pixelWidth, preset.pixelHeight) / 100));
  const maximum = Math.floor(minimum * 2.5);
  els.rooms.placeholder = `random ${minimum}-${maximum}`;
  els.rooms.title = els.rooms.value
    ? `Specific room count. Values clamp to ${minimum}-${maximum} for this size.`
    : `Blank rolls a random room count from ${minimum} to ${maximum}.`;
}

function ensureSeed() {
  if (!els.seed.value.trim()) {
    els.seed.value = fantasySeed();
  }
  return els.seed.value.trim();
}

function fantasySeed() {
  const prefix = chooseSeedWord(SEED_PREFIXES);
  const suffix = chooseSeedWord(SEED_SUFFIXES);
  return `${prefix}-${suffix}`;
}

function chooseSeedWord(words) {
  return words[Math.floor(Math.random() * words.length)];
}

els.size.dispatchEvent(new Event("change"));
ensureSeed();
els.generate.click();

function keyToDirection(key) {
  const normalized = key.toLowerCase();
  if (normalized === "arrowup" || normalized === "w") return "north";
  if (normalized === "arrowright" || normalized === "d") return "east";
  if (normalized === "arrowdown" || normalized === "s") return "south";
  if (normalized === "arrowleft" || normalized === "a") return "west";
  return null;
}

function isTypingTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
}
