# connect-four-ai

A browser-based Connect Four game where you play against an AI powered by the Minimax algorithm with Alpha-Beta pruning. Built as a Decision Support Systems project at TOBB ETÜ Computer Engineering.

---

## How it works

The AI explores the game tree using **Minimax with Alpha-Beta pruning**. Minimax assumes both players always make their best possible move — the AI maximizes its own score while expecting the human to minimize it. Alpha-Beta cuts off branches that can't possibly affect the final decision, which makes the search fast enough to run in the browser.

When the search can't reach a terminal state (win/draw) within the depth limit, a **heuristic scoring function** evaluates the board instead. It scores every possible 4-cell window on the board and adds a bonus for center column control, which Connect Four theory (James Allis, 1988) identifies as the most strategically valuable column.

### Transposition Table + Zobrist Hashing

The same board position can be reached via different move sequences. Without caching, the AI wastes time re-evaluating positions it has already scored. The transposition table stores results keyed by a Zobrist hash — a 32-bit value computed by XOR-ing pre-generated random numbers for each occupied cell. Updating the hash when a piece is placed is O(1) instead of O(rows × cols).

### Iterative Deepening Search

Instead of jumping straight to the target depth, the search runs from depth 1 up to the configured maximum. Each shallow pass warms up the transposition table, so by the time the deeper search runs, it hits the cache far more often and prunes more branches. If the 3-second time budget runs out mid-iteration, the result from the last completed pass is used.

### Difficulty-based mistakes

At the two lowest difficulty settings the AI intentionally plays a random valid move some of the time (45% at depth 2, 20% at depth 3). This makes easier settings actually beatable without reducing the search depth to something trivially weak.

---

## Tech stack

| Tool | Purpose |
|---|---|
| React 19 | UI and game state |
| TypeScript | Type safety |
| Tailwind CSS v4 | Styling |
| Framer Motion | Animations |
| Vite | Dev server and build |

---

## Running locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

---

## Project structure

```
src/
  types.ts          — Player enum, BoardState type, GameResult interface
  gameLogic.ts      — board creation, move validation, win checking
  ai.ts             — Minimax, Alpha-Beta, Zobrist hashing, transposition table, IDS
  App.tsx           — game state, turn management, UI layout
  components/
    Board.tsx       — renders the 6x7 grid
```

---

**Developer:** Aylin BARUTÇU — 211101031
**Department:** TOBB ETÜ Computer Engineering
**Course:** YAP 441 / BİL 541 — Decision Support Systems, Spring 2025–26
