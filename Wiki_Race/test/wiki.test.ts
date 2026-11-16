import { describe, expect, test } from "bun:test";
import { canonicalFromHtml, canonicalFromUrl, classify, prepare } from "../src/wiki";

describe("canonicalFromUrl", () => {
  test("reads the rest_v1 shape", () => {
    expect(canonicalFromUrl("https://en.wikipedia.org/api/rest_v1/page/html/Earth")).toBe("Earth");
  });

  test("reads the rest.php shape the 301 lands on", () => {
    expect(canonicalFromUrl("https://en.wikipedia.org/w/rest.php/v1/page/Earth/html")).toBe("Earth");
  });

  test("decodes underscores and percent-escapes", () => {
    expect(canonicalFromUrl("https://en.wikipedia.org/w/rest.php/v1/page/United_States/html")).toBe(
      "United States",
    );
    expect(canonicalFromUrl("https://en.wikipedia.org/w/rest.php/v1/page/Caf%C3%A9/html")).toBe("Café");
  });

  test("returns null when the URL carries no page path", () => {
    expect(canonicalFromUrl("https://en.wikipedia.org/wiki/Earth")).toBeNull();
  });
});

describe("canonicalFromHtml", () => {
  test("reads the dc:isVersionOf link", () => {
    const html = `<base href="//en.wikipedia.org/wiki/"/><link rel="dc:isVersionOf" href="//en.wikipedia.org/wiki/Earth"/>`;
    expect(canonicalFromHtml(html)).toBe("Earth");
  });

  test("returns null without the link", () => {
    expect(canonicalFromHtml("<html><body></body></html>")).toBeNull();
  });
});

describe("classify", () => {
  test("takes all three article href shapes", () => {
    expect(classify("./Foo")).toEqual({ kind: "article", title: "Foo" });
    expect(classify("/wiki/Foo")).toEqual({ kind: "article", title: "Foo" });
    expect(classify("https://en.wikipedia.org/wiki/Foo")).toEqual({ kind: "article", title: "Foo" });
  });

  test("strips fragments and decodes underscores", () => {
    expect(classify("./Foo#Bar")).toEqual({ kind: "article", title: "Foo" });
    expect(classify("./United_States")).toEqual({ kind: "article", title: "United States" });
  });

  test("in-page anchors scroll; red links and off-wiki hrefs are dead", () => {
    expect(classify("#cite_note-1")).toEqual({ kind: "inPage" });
    expect(classify("#")).toEqual({ kind: "dead" });
    expect(classify("./Foo?action=edit&redlink=1")).toEqual({ kind: "dead" });
    expect(classify("/w/index.php?title=Foo")).toEqual({ kind: "dead" });
    expect(classify("https://example.com/")).toEqual({ kind: "dead" });
    expect(classify("mailto:x@example.com")).toEqual({ kind: "dead" });
    expect(classify("//en.wikipedia.org/wiki/Foo")).toEqual({ kind: "dead" });
  });
});

describe("prepare", () => {
  test("strips scripts, handlers, targets, and the base tag", () => {
    const html = `<head><base href="//en.wikipedia.org/wiki/"/><script>alert(1)</script></head>` +
      `<body><a href="./Earth" onclick="x()" target="_blank">Earth</a><img src="/x" onerror="y()"></body>`;
    const out = prepare(html);
    expect(out).not.toContain("<script");
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("target=");
    expect(out).not.toContain("<base");
    expect(out).toContain('href="./Earth"');
  });

  test("absolutizes root-relative and protocol-relative URLs", () => {
    const out = prepare(`<link rel="stylesheet" href="/w/load.php?x"/><img src="//upload.wikimedia.org/x.png"/>`);
    expect(out).toContain('href="https://en.wikipedia.org/w/load.php?x"');
    expect(out).toContain('src="https://upload.wikimedia.org/x.png"');
  });

  test("absolutizes srcset continuation URLs", () => {
    const out = prepare(`<img srcset="//upload.wikimedia.org/a.png 1x, //upload.wikimedia.org/a2.png 2x"/>`);
    expect(out).toContain("https://upload.wikimedia.org/a2.png");
  });
});
