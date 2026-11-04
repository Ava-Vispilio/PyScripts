# TUI App Guidelines

Distilled from the Dragon Link and Tic Tac Toe build sessions (Nov 2026). These rules apply to every
TUI game in this repo. The Dragon Link builds and Tic Tac Toe are the reference implementations
(`Dragon_Link/v1`, `Dragon_Link/v2`, `Tic_Tac_Toe`).

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

## Cross-game standards (the Tic Tac Toe lessons)

25. **One key map across every game.** Arrows move, Enter confirms, `r` restarts the
    round in place, Esc goes back one screen, `q` quits. When a game has no parent
    screen, Esc resets in place instead (Dragon Link); on a top screen it is a no-op
    (the mode select). Both shells bind the same map.
26. **Dense key hints on the screen.** `Esc = Back, R = Reset` style, within the board
    width. When two keys do the identical thing, join them: `Esc or R = Reset`.
    State messages ("Press Enter to spin") are prose and stay separate from key docs.
27. **Screens are engine states.** Mode select, play, and results are phases; back and
    restart are actions the engine validates. The shells never track navigation
    themselves, and the tests cover it.
28. **Restart keeps the choice, back forgets it.** `r` starts the same game over (mode
    kept, credits fresh); Esc climbs to the parent screen.
29. **The bottom bar carries the outcome.** Green = won, yellow = in progress,
    red = lost, gray = drawn. Result text ("Press Enter to reset board") lives inside
    the bar; key hints sit on their own dim line under it.
30. **Every player owns a color.** The turn line names the mover and wears their color
    ("Turn: You (X)"), left-aligned under the board while the rest centers. The
    cursor cell highlights in the mover's color.
31. **The algorithm is a player, not an effect.** Its reply is a separate action the
    engine withholds until the shell's timer fires (about a second), with the same
    turn-color transitions. Human input is refused during the wait, and a stale
    timer re-checks before firing.
32. **Parse stdin as presses, not chunks.** A terminal delivers arrow+Enter in one
    read; split the buffer (escape sequences first) before mapping keys.
33. **The browser binds keydown with guards.** Every terminal key works on the page,
    but skip `event.repeat` and modifier-held letters so Cmd+R still reloads.
    Clicks mirror the cursor.
34. **The page shows only what the game needs.** A self-explanatory game renders the
    terminal alone (Tic Tac Toe); a rules section is earned by complexity
    (Dragon Link).
35. **Ship both targets from one build.** Each game compiles a standalone binary
    (`dist/`) and a static bundle (`docs/`), rebuilt and committed together;
    GitHub Pages serves each game's folder from the same push.
36. **Drive the real binary before committing.** pty runs through `script`, keys
    spaced out, always ending with the quit key; then the web shell on localhost.
    Respawn any live instance after a rebuild — an old process keeps its old image.
