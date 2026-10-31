import { rules, type Game } from "../engine";

const fmt = (n: number) => n.toLocaleString("en-US");
const esc = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The rules article for one coin size. Every number on it comes from rules(coin). */
export function rulesHtml(coin: Game["coin"]): string {
  const r = rules(coin);
  const paragraphs = r.parody.map((sentence) => `<p>${esc(sentence)}</p>`).join("\n");
  const pays = r.pays
    .map(({ symbol, pays: [three, four, five] }) => `<tr><th>${symbol}</th><td>${fmt(three)}</td><td>${fmt(four)}</td><td>${fmt(five)}</td></tr>`)
    .join("\n");
  return `
<h2>What this is</h2>
${paragraphs}
<h2>Rules of this version</h2>
<p>Coin ${fmt(r.coin)}. Every credit amount below is for this coin and changes when you change the coin.</p>
<ul>
  <li>${r.reels} reels, ${r.rows} rows, ${r.lines} fixed lines. Lines pay left to right, starting on the first reel. The bet is ${fmt(r.bet)} credits: ${r.lines} lines times the coin. You start with ${fmt(r.startCredits)} credits.</li>
  <li>WILD lands on every reel except the first. It stands in for every paying symbol. It does not stand in for MOON or ORB, and ORB never pays on a line.</li>
  <li>MOON pays anywhere on the screen. Three moons pay ${fmt(r.moons[3])}, four pay ${fmt(r.moons[4])}, and five pay ${fmt(r.moons[5])}, which is ${r.fiveMoonsTimesBet} times the bet. Three or more moons also start ${r.freeGames} free games. Three more moons during free games add ${r.freeGames} more.</li>
  <li>Free spins can land DOOR stacks. Every door on one spin opens onto the same symbol. That symbol can be ORB, but never WILD or MOON.</li>
  <li>${r.holdTrigger} or more ORB start Hold and Spin with ${r.respins} respins. Each new orb locks and resets the count to ${r.respins}. Orbs show credits (${r.orbCredits.map(fmt).join(", ")}) or a jackpot name. Only one MAJOR can show at a time.</li>
  <li>MINI pays ${fmt(r.mini)}. MINOR pays ${fmt(r.minor)}. MAJOR pays its meter, which starts at ${fmt(r.majorSeed)}. Filling all ${r.cells} cells pays the GRAND meter, which starts at ${fmt(r.grandSeed)}. Both meters grow a little with every paid spin and reset after they pay.</li>
  <li>A Major or Grand win pauses the game until you collect it. Spin does nothing during that pause.</li>
  <li>Hold and Spin started during free games returns to those free games.</li>
  <li>The coin changes only in the base game.</li>
  <li>${esc(r.odds)}</li>
</ul>
<table>
  <thead><tr><th>Line pays</th><th>Three</th><th>Four</th><th>Five</th></tr></thead>
  <tbody>
${pays}
  </tbody>
</table>`;
}
