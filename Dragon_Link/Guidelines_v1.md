# TUI App Guidelines

Distilled from the Dragon Link build sessions (Nov 2026). These rules apply to every
TUI game in this repo. The Dragon Link builds are the reference implementation
(`Dragon_Link/v1`, `Dragon_Link/v2`).

## Engine

1. **One TypeScript engine per game.** A pure state machine: `step(state, action, rng)`
   returns the next state; a separate render function turns state into text. The engine
   never prints, touches the DOM, or emits ANSI codes.
2. **Actions carry no data where possible.** A small union of plain actions (`spin`,
   `confirm`, `coinUp`) so a shell cannot construct an invalid value. If the game needs
   a target (e.g. a board cell), validate it inside `step` and return the same state
   for illegal moves.
3. **Make illegal states unrepresentable.** Model phases as a union (`base | hold |
   jackpot`-style), not a pile of booleans.
4. **Inject randomness.** The RNG is an interface passed in from outside. Seeded RNG
   makes a game replayable; tests script outcomes in game terms ("five moons land"),
   never raw draw order.
5. **Tests are behavior tests.** `bun test` must pass before work is done.
   `tsc --noEmit` must be clean. Helpers for scripted outcomes live in `testing.ts`.
6. **Named states for manual testing.** The page accepts `?state=<name>` and the
   console exposes a helper (e.g. `gameState("win")`) to jump to a finished state.

## Shells

7. **The terminal and the web page are thin adapters** that paint the same text screen.
8. **The web page is a static bundle** (GitHub Pages compatible): the same text on a
   black background, monospace. The rules and a short explanation of the game sit
   under the board.
9. **Toolchain:** bun for test and build; no native dependencies.

## Screen style (the v2 lessons)

10. **Plaintext look.** Bracket cells `[ X ]`, monospace grid, no boxes, tiles, or
    buttons. The reference is what a plain terminal shows.
11. **Fixed screen height.** Animated or temporary messages reuse a reserved row.
    No line may appear or disappear mid-game and push the rest of the screen around.
12. **Everything is board-width.** Headers, status bars, and tips are centered on and
    limited to the width of the board columns. The page width equals the board width.
13. **Center values under labels.** Split leftover columns evenly; one column must not
    lean the opposite way from the rest.
14. **Deliberate palette.** Each meaningful element gets its own color; never paint
    one color over every line. Highlights must contrast with their neighbors (white
    text next to white highlight cells is invisible — use a highlight with dark text).
15. **The prompt bar changes color with game state**, and the top bar matches it
    (win = one color, feature = another, idle = another).
16. **Short TIP lines.** On-board help text is a short `TIP:` that fits within the
    board width. No full stops in on-board text; full sentences are fine in the rules
    section under the board.
17. **Capitalized labels** (Credits, Bet, Win — or their equivalents).
18. **One keypress = one action.** No hold gestures; a press must not trigger twice.
    Enter confirms, `q` quits the TUI.
19. **Animate after the result is known.** Outcomes are decided first; the animation
    plays out with easing (and per-column variable speed where reels/columns exist).

## Repo layout and process

20. **One folder per game** (`Dragon_Link/`, `Tic_Tac_Toe/`, ...). If a style rework
    happens, keep the old build in `v1/`, `v2/` subfolders instead of discarding it.
21. **Keep the plan with the build** (`PLAN.md` inside the game folder).
22. **Granular commits.** One logical change per commit, imperative subject lines
    ("Paint winning cells white again"). Commit as work lands; push when the session's
    work is done — do not leave local-only commits.
23. **Serve pages only for verification** (127.0.0.1) and stop the server after.
24. **Gambling parodies only:** original reel math and probabilities (never copy a
    manufacturer's numbers), and the page states this version's rules and its parody
    origin.
