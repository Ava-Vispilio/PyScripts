export type Race = { start: string; end: string };

export function encode(race: Race): string {
  return `#s=${encodeURIComponent(race.start)}&e=${encodeURIComponent(race.end)}`;
}

export function decode(hash: string): Race | null {
  if (!hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  const start = params.get("s");
  const end = params.get("e");
  if (!start || !end || start === end) return null;
  return { start, end };
}
