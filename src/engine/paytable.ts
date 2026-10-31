import { LINES, PAYING, REELS, ROWS, type Paying } from "./symbols";

declare const coinsBrand: unique symbol;
/** A count of coins. Credits = coins x coin. Fractional only inside meters. */
export type Coins = number & { readonly [coinsBrand]: true };
declare const coinBrand: unique symbol;
/** Credits per coin, the denomination. One of PAYTABLE.coins. */
export type Coin = number & { readonly [coinBrand]: true };
declare const creditsBrand: unique symbol;
export type Credits = number & { readonly [creditsBrand]: true };

export const coins = (n: number) => n as Coins;
const coin = (n: number) => n as Coin;
export const credits = (n: number) => n as Credits;
export const toCredits = (c: Coins, per: Coin) => credits(Math.floor(c * per));

export const BET_COINS = coins(LINES.length);
const timesBet = (n: number) => coins(n * BET_COINS);

export type OrbFace =
  | { readonly kind: "credit"; readonly coins: Coins }
  | { readonly kind: "MINI" }
  | { readonly kind: "MINOR" }
  | { readonly kind: "MAJOR" };

type Pays = Readonly<Record<3 | 4 | 5, Coins>>;
const pays = (three: number, four: number, five: number): Pays => ({
  3: coins(three),
  4: coins(four),
  5: coins(five),
});

export const PAYTABLE = {
  startCredits: credits(50_000),
  coins: [coin(1), coin(2), coin(5), coin(10)] as const,
  /** Coins per line for a run from reel 0. WILD substitutes. */
  lines: {
    "9": pays(5, 15, 80),
    "10": pays(5, 15, 90),
    J: pays(5, 20, 100),
    Q: pays(10, 25, 120),
    K: pays(10, 30, 150),
    FAN: pays(15, 50, 200),
    KOI: pays(20, 60, 250),
    LOTUS: pays(25, 80, 300),
    DRGN: pays(40, 150, 800),
  } satisfies Record<Paying, Pays>,
  moons: { 3: timesBet(3), 4: timesBet(20), 5: timesBet(250) },
  freeGames: 6,
  holdTrigger: 6,
  respins: 3,
  mini: coins(1000),
  minor: coins(5000),
  /** Meters live in coins and grow by the bet in coins times perBet on every paid spin. */
  major: { seed: coins(25_000), perBet: 0.01 },
  grand: { seed: coins(250_000), perBet: 0.004 },
  /** Orb faces with their weights. Values and weights live together so neither list can drift. */
  orbs: [
    { face: { kind: "credit", coins: timesBet(1) }, weight: 30 },
    { face: { kind: "credit", coins: timesBet(2) }, weight: 24 },
    { face: { kind: "credit", coins: timesBet(3) }, weight: 14 },
    { face: { kind: "credit", coins: timesBet(5) }, weight: 9 },
    { face: { kind: "credit", coins: timesBet(8) }, weight: 5 },
    { face: { kind: "credit", coins: timesBet(15) }, weight: 2 },
    { face: { kind: "MINI" }, weight: 5 },
    { face: { kind: "MINOR" }, weight: 1.5 },
    { face: { kind: "MAJOR" }, weight: 0.3 },
  ] satisfies readonly [{ face: OrbFace; weight: number }, ...{ face: OrbFace; weight: number }[]],
} as const;

const PARODY = [
  "This is an unofficial parody of Aristocrat's Dragon Link Autumn Moon. Aristocrat did not make it and does not endorse it.",
  "It grew out of the Alberta Tech reel \"Vibe Coding is Gambling\" and Dave Eddy's YSAP Link stitch of that reel.",
  "Nothing here is real wagering. Credits are pretend, cost nothing, and cannot be cashed out.",
  "A text screen has no cabinet art, no sound, and no linked jackpot. The Major and Grand meters grow only from your own spins in this session.",
] as const;

/** PAYTABLE in credits for one coin size. The rules page formats this and types no number of its own. */
export function rules(per: Coin) {
  const cr = (c: Coins) => toCredits(c, per);
  return {
    parody: PARODY,
    odds: "Reel strips, weights, and odds are original to this parody and are not Aristocrat's math.",
    coin: per,
    reels: REELS.length,
    rows: ROWS.length,
    lines: LINES.length,
    bet: cr(BET_COINS),
    startCredits: PAYTABLE.startCredits,
    pays: PAYING.map((symbol) => {
      const p = PAYTABLE.lines[symbol];
      return { symbol, pays: [cr(p[3]), cr(p[4]), cr(p[5])] as const };
    }),
    moons: { 3: cr(PAYTABLE.moons[3]), 4: cr(PAYTABLE.moons[4]), 5: cr(PAYTABLE.moons[5]) },
    fiveMoonsTimesBet: PAYTABLE.moons[5] / BET_COINS,
    freeGames: PAYTABLE.freeGames,
    holdTrigger: PAYTABLE.holdTrigger,
    respins: PAYTABLE.respins,
    cells: REELS.length * ROWS.length,
    orbCredits: PAYTABLE.orbs.flatMap(({ face }) => (face.kind === "credit" ? [cr(face.coins)] : [])),
    mini: cr(PAYTABLE.mini),
    minor: cr(PAYTABLE.minor),
    majorSeed: cr(PAYTABLE.major.seed),
    grandSeed: cr(PAYTABLE.grand.seed),
  };
}
