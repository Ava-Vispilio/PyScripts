const API = "https://en.wikipedia.org/api/rest_v1/page/html/";

export type Article = { html: string; canonical: string };

export type Link = { kind: "article"; title: string } | { kind: "inPage" } | { kind: "dead" };

function decodeTitle(raw: string): string {
  try {
    return decodeURIComponent(raw).replaceAll("_", " ");
  } catch {
    return raw.replaceAll("_", " ");
  }
}

/** The final URL after the API's 301 to the canonical spelling, in either shape. */
export function canonicalFromUrl(url: string): string | null {
  const m = url.match(/\/page\/html\/([^/?#]+)/) ?? url.match(/\/page\/([^/]+)\/html/);
  return m && m[1] ? decodeTitle(m[1]) : null;
}

/** Fallback: the dc:isVersionOf link in the article head. */
export function canonicalFromHtml(html: string): string | null {
  const m = html.match(/rel="dc:isVersionOf"\s+href="([^"]*)"/);
  if (!m || !m[1]) return null;
  const i = m[1].lastIndexOf("/wiki/");
  if (i === -1) return null;
  return decodeTitle(m[1].slice(i + "/wiki/".length));
}

export async function fetchArticle(title: string): Promise<Article> {
  const res = await fetch(API + encodeURIComponent(title.replaceAll(" ", "_")));
  if (!res.ok) throw new Error(`Wikipedia said ${res.status} for "${title}"`);
  const html = await res.text();
  const canonical = canonicalFromUrl(res.url) ?? canonicalFromHtml(html) ?? title;
  return { html, canonical };
}

/**
 * Runs on hrefs as they appear after prepare(): ./Foo, /wiki/Foo, or the
 * absolutized https://en.wikipedia.org/wiki/Foo. Red links carry a query
 * string; everything else that is not an article or a fragment is dead.
 */
export function classify(href: string): Link {
  if (href.startsWith("#") && href.length > 1) return { kind: "inPage" };
  if (href.includes("?")) return { kind: "dead" };
  const m = href.match(/^(?:\.\/|\/wiki\/|https:\/\/en\.wikipedia\.org\/wiki\/)([^#]+)/);
  if (m && m[1]) return { kind: "article", title: decodeTitle(m[1]) };
  return { kind: "dead" };
}

/** Strip everything that could execute or navigate, and absolutize asset URLs. */
export function prepare(html: string): string {
  return html
    .replaceAll(/<script[\s\S]*?<\/script\s*>/gi, "")
    .replaceAll(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*')/gi, "")
    .replaceAll(/\starget\s*=\s*(?:"[^"]*"|'[^']*')/gi, "")
    .replaceAll(/<base\b[^>]*>/gi, "")
    .replaceAll('="//', '="https://')
    .replaceAll('="/', '="https://en.wikipedia.org/')
    .replaceAll(", //", ", https://");
}
