# Dungeon Generator Website Prototype

Pure HTML/CSS/JS first pass for the dungeon generator main view.

## Run Locally

From the `4AD Dungeon Crawler Design` folder:

```powershell
python -m http.server 8787
```

Open:

```text
http://127.0.0.1:8787/website/
```

The prototype uses ES modules and sibling tile assets, so it should be served from the design folder over HTTP instead of opened directly from the file system or served from the `website` folder alone.

## Current Features

- Canvas-based main dungeon view.
- High-DPI canvas rendering for sharper tile display.
- Size presets: small, medium, large, super.
- Minimum room count is based on map pixels: use the smaller map dimension divided by 100, with a floor of 6 rooms.
- Maximum room count is about 2.5 times the minimum room count.
- Leaving the room-count field blank rolls a random room total between the size-based minimum and maximum.
- Typing a room count forces a specific target, clamped to the size-based minimum and maximum.
- Leaving the seed field blank generates a two-word fantasy seed from prefix and suffix lists, joined by a hyphen.
- Open chambers are generated at about one eighth of the minimum room count.
- Torch mode is the default map view unless the Reveal All developer option is enabled.
- Torch light fully illuminates cells within radius 4 and dimly illuminates cells within radius 8.
- Walls block torch light, so cells must have line of light through open, door, or open-chamber edges to be illuminated.
- Torch light checks are bounded to the torch radius instead of scanning the whole layer.
- Fog rendering uses one overlay pass and cuts out lit cells instead of drawing a darkness square over every cell.
- The static floor texture layer is cached per floor and zoom level to reduce redraw cost while moving.
- The static map layer renders once per floor/mode and is reused while movement, torch lighting, and the party token update from array state.
- Zoom uses CSS `transform: scale()` against a stable backing canvas instead of resizing the canvas and repainting the whole dungeon.
- Save text is generated only when the user clicks Copy Save or Update Save, avoiding full-dungeon JSON serialization during movement.
- If the local `Tiles` artwork folder is missing, image loading falls back to generated base floor textures, line walls, and simple door markers so the GitHub Pages build remains usable.
- The map viewport is fixed at about 900 x 900 pixels.
- Auto Follow keeps the party token fixed in the center of the viewport by moving the map underneath it.
- Disabling Auto Follow restores manual scrolling for scouting, familiar-spirit exploration, and free map inspection.
- Most doors start closed and block movement until clicked/opened. About 15 percent of normal doors start open.
- Some rooms start locked; if one door on a room is locked, all generated doors on that room are locked.
- Clicking a wall edge searches it for a secret door. A normal search reveals it on a 6 on 1d6; an Elf searcher reveals it automatically, but still must search.
- Unrevealed secret doors render and block movement like walls until discovered.
- Super dungeons support 2 to 10 floors.
- All standard dungeon sizes can generate multiple floors by recursive chance.
- Super dungeons are also called mega dungeons and always generate at least two floors.
- Generated layer connections are stored both in `floorConnections` and on the matching endpoint cells as `verticalConnection`.
- Dungeon themes now store object-palette and encounter-filter metadata for later object and monster generation.
- Generation shows a status/progress indicator while layers and links are built.
- Separate floor texture layer.
- 50px logical wall grid.
- Logical room and corridor generation.
- Rooms now keep explicit room/corridor boundaries instead of being carved through by connector corridors.
- Most room entrances are stored as door edges; some are marked as open-chamber connections.
- Two-cell-wide corridor carving.
- Extra loop connections.
- Dead-end branches.
- Boss room tagging.
- Player token layer.
- Movement buttons.
- Arrow key and WASD movement.
- Toggleable debug labels showing grid coordinates and cell codes.
- Toggleable first-pass art wall rendering.
- Wider zoom range for tile placement inspection.
- Display-only reveal-all toggle for temporary fog-of-war removal.
- Cell details panel.
- Event log.
- Copy/paste JSON save and load.
- Seeded generation.

## Current Limits

- Wall art is only first-pass aligned and still needs per-piece placement tuning.
- Reveal all does not change the saved dungeon state; it only changes the current view.
- SVG art walls are enabled by default. The old logical line-wall renderer is still available by turning off `Art walls`.
- Debug labels are for alignment testing and are not intended as final UI.
- Movement now checks cell edge types, so walls block travel even when both adjacent cells are walkable.
- Door/open-chamber edge data exists, but normal doors do not yet require interaction to pass through.
- Secret doors exist in room state but do not yet drive hidden/revealed movement.
- Event tables are placeholder rolls.
- Monster, treasure, and dressing layers are not implemented yet.
- Layer sizes are still uniform; variable layer sizes are planned for later mega-dungeon generation.
- Skip-floor connections are represented in the data model but are not generated yet.

## Multi-Layer Generation Notes

- Dungeons are generated one layer at a time.
- Medium and large dungeons may become multi-layer dungeons by random chance.
- Small dungeons start with a 10% chance of another floor, then reduce that chance by 3% for each generated floor.
- Medium dungeons start with a 20% chance of another floor, then reduce that chance by 3% for each generated floor.
- Large dungeons start with a 30% chance of another floor, then reduce that chance by 2% for each generated floor.
- Mega dungeons always have at least two floors, then start with a 40% chance of another floor and reduce that chance by 2% for each generated floor after the first.
- Super dungeons are mega dungeons and are always multi-layer.
- A stair, passage down, shaft, or similar feature should create a paired connection: one endpoint on the source layer and one endpoint on the target layer.
- Each endpoint cell stores `verticalConnection` data with the connection id, endpoint type, marker, target floor, and target grid position.
- The dungeon-level `floorConnections` array stores the full connection pair for save/load, future validation, and cross-floor navigation.
- Future mega dungeons may include variable-sized layers and connections that skip one or more intermediate floors.
- Dungeon themes should influence placeable object palettes, dressing tables, encounter filters, and eventually available monster families.

## Room And Door Notes

- Rooms should generally be entered through doors.
- Room/corridor adjacency defaults to a wall unless an explicit `door`, `secret_door`, or `open_chamber` edge is generated.
- A smaller number of chambers may connect openly to corridors; these are stored as `open_chamber` connections.
- Door connections are stored in the dungeon-level `doors` array and on both endpoint cells through `edgeFeatures`.
- Door edges use `door`, `secret_door`, or `open_chamber` edge types instead of plain `open`.
- Normal doors render with the mapped stone-connector wooden door art.
- Open-chamber thresholds render with the no-connector wooden door art at reduced opacity, keeping them visually distinct without using the old dashed marker.

## Tile Notes

- Reference target: solid wall lines should line up continuously along the dungeon boundary, with the black/solid side reading as the exterior or void side and the stone faces reading into playable space.
- Treat decorative stone variation as secondary to wall-line continuity. If a tile looks attractive but breaks the solid boundary line, reserve it for dressing, alcoves, transitions, or hand-authored special rooms.
- `Dungeon_Wall_Straight_*` pieces are the clean straight wall-run pieces currently used by the first-pass renderer.
- `Dungeon_Straight_1x2_*`, `Dungeon_Straight_2x2_*`, `Dungeon_Straight_3x2_*`, and `Dungeon_Straight_4x2_*` have A/B variants that can be alternated or randomly placed so repeated walls look more natural.
- `Dungeon_Straight_2x3_A.png` and `Dungeon_Straight_2x3_B.png` are not normal straight-wall run pieces despite the filename.
- `Dungeon_Straight_2x3_A.png` is a curved 2x3 wall transition that shifts a wall line across its footprint.
- `Dungeon_Straight_2x3_B.png` is a squared 2x3 wall transition that shifts a wall line across its footprint.
- `Dungeon_Straight_3x3_A.png` and `Dungeon_Straight_4x4_A.png` are larger curved wall-transition pieces in the same family.
- `Dungeon_Wall_Crossroad_2x2_A.png` is a plus-shaped four-way wall junction.
- `Dungeon_Wall_Crossroad_2x2_B.png` is an upside-down T-shaped three-way wall junction.
- `Dungeon_Corner_Out_*_A` pieces are true outside corners.
- `Dungeon_Corner_Out_*_B` pieces are diagonal outside corners where horizontal and vertical walls join with a diagonal wall line.
- `Dungeon_Corner_Out_*_C` pieces are rounded outside corners.
- `Dungeon_Corner_In_*` pieces use the same A/B/C label scheme, but represent inward-facing corners.
- `Dungeon_Wall_Corner_2x2*` pieces show wall lines on both sides of the corner.
- `Dungeon_Wall_Corner_2x2.png` is the true-corner variant and matches the A label type used by the Corner In/Out sets.
- `Dungeon_Wall_Corner_2x2_B.png` and `Dungeon_Wall_Corner_2x2_C.png` follow the same diagonal and rounded label meanings.
- `Dungeon_Dead_End_3x2_A.png` is a squared 3x2 dead-end shape.
- `Dungeon_Dead_End_3x2_B.png` is an inverted-U 3x2 dead-end shape.
- `Dungeon_Dead_End_Out_3x2_A.png` and `Dungeon_Dead_End_Out_3x2_B.png` use the same squared and inverted-U shapes, but place the solid line on the outside of the shape.
- The `Dungeon_Dead_End_Out_*` series should be treated as strong alcove candidates for niches, shrines, side storage, small dressing spaces, and similar recessed features.
- `Dungeon_End_Left.png` and `Dungeon_End_Right.png` are rounded end caps for freestanding interior divider walls.
- Use Dungeon End pieces when a wall divides a room or space but does not touch another wall at one or both ends.
- `Dungeon_Wall_End_Piece_1x2_A.png` and `Dungeon_Wall_End_Piece_1x2_B.png` are larger 1x2 wall end caps.
- Large wall end pieces can narrow hallway entrances, frame doorway sides, or give door assets something substantial to connect to.
- `Dungeon_Wall_Fix_1.png` through `Dungeon_Wall_Fix_6.png` are individual solid-brick utility pieces.
- Wall Fix pieces can fill small gaps in wall art, or connect along their long sides as structural reinforcement/abutment details.
- `Dungeon_Pillar_1x1_*` and `Dungeon_Pillar_2x2_*` pieces are pillar assets for obstacle, dressing, support, and line-of-sight features.
- Pillar variants differ by size, center opening size, and whether the middle reads as stone/open space or a black solid center.
- Pillars with black centers can represent more solidly constructed pillars; the open or stone-center variants can be used for variety or specific room needs.
- `Black_Patch.png` can represent deep pits, voids, shafts, or other lower-depth features.
- Black Patch/pit art should render on a lower terrain/depth layer, underneath rock rims, wall edges, rubble, pillars, or other assets that frame the pit.
- `Dungeon_Wooden_Door_1x2_*` and `Dungeon_Wooden_Double_Door_2x2_*` pieces are oriented horizontally by default.
- Wooden door labels `A` and `B` have stone connectors on each side.
- Wooden door label `C` has no side connectors.
- Wooden door label `D` has wooden side connectors.
- All `Dungeon_Stairs_*` pieces are oriented left-to-right ascending by default.
- Stair pieces include transparent variants for placement over the current floor texture.
- Wall pieces generally use the solid line as the dungeon exterior boundary; the rock parts face inward into the dungeon so the walls look built and primitive.
- For the 3x2 dead-end pieces, place the asset so the solid line marks the outside of the dead-end boundary and the rockwork faces the playable space.

## Tile Placement Refinement Targets

- Add a void/outside layer option so non-playable space can render dark or black instead of repeating floor texture.
- Add vertical door placement checks to generated dungeons and keep the door art rotated on east/west room entrances.
- Use wall end caps and wall fix bricks to frame door gaps where the straight wall art leaves small visual breaks.
- Add inward-corner, rounded-corner, and alcove rules after the straight-wall layout is stable.
- Add room dressing and theme objects only after wall, door, floor, and void layers consistently line up.
