# Pick 3 Slop

A roguelite wheel-spinning game where you collect boons to keep all your lose tiles flipped to win.

## How to play

1. Spin the wheel — land on WIN to survive and pick a boon; land on LOSE to get eliminated (unless a rescue boon saves you).
2. Boons modify your wheel: flip lose tiles to win, add rescue chances, grow tiles, create dead zones, and more.
3. Once all tiles are win, the wheel **grows** — tripling in size with a harder win/lose ratio.

## Development

```bash
npm install
npm run dev      # Start dev server at localhost:5173
npm run build    # Production build into dist/
npm run preview  # Preview the production build
```

## Tech stack

- [Vite](https://vite.dev) + [React](https://react.dev) + TypeScript
- Deployed to GitHub Pages via GitHub Actions
- Custom domain: [pick3slop.com](https://pick3slop.com)

## Project structure

```
src/
  types.ts            — TypeScript interfaces
  constants.ts        — Game constants
  utils.ts            — Pure utility functions
  boons/
    templates.ts      — All boon definitions
  wheel.ts            — Wheel geometry & spin logic
  rescue.ts           — Rescue boon logic
  shop.ts             — Boon shop / draw logic
  applyBoon.ts        — Boon application effects
  components/
    BoonTag.tsx       — Tooltip boon tag
    WheelView.tsx     — SVG wheel renderer
    TileReveal.tsx    — Tile reveal animation
    BoonShop.tsx      — Boon selection overlay
    GameOver.tsx      — Game over panel
    WheelGrows.tsx    — Wheel growth overlay
  App.tsx             — Main game state
  main.tsx            — Entry point
  styles.css          — Global styles & animations
```
