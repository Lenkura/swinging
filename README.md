# Rat Smash

A browser-based physics game. Swing a rat on a string into targets to smash them. Chain hits to build a combo multiplier and beat the par score.

## How to run

ES6 modules require HTTP — you can't open `index.html` directly via `file://`. Serve the project root with any static file server:

```bash
# Python (built-in, no install needed)
python3 -m http.server 8080

# Node (if you have npx)
npx serve .

# Caddy, nginx, or any other static server also works
```

Then open **http://localhost:8080** in your browser.

## Gameplay

- **Move the mouse** to swing the rat. The pivot follows your cursor.
- **Chain hits** within one second to build a combo multiplier (up to 3×).
- The rat has HP — each hit drains it. When HP hits zero the rat shatters and the round ends.
- **Fewer hits = higher score.** A one-hit smash scores 3000; each extra hit costs 500.

### Acts and mechanics

| Act | Setting | New mechanic |
|-----|---------|--------------|
| 1 — The Sewer | Dark, grimy | None — learn the swing |
| 2 — The Warehouse | Industrial | **Shields** — hit fast enough to break through |
| 3 — The Lab | Clinical | **Bumpers** — deflect the rat around obstacles |

## Running tests

```bash
npx vitest run        # single pass
npx vitest            # watch mode
```

## Tech

Vanilla JS · ES6 modules · Canvas 2D · [Matter.js 0.19.0](https://brm.io/matter-js/) · Web Audio API · [Vitest](https://vitest.dev/)
