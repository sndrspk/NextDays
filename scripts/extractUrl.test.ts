import { extractUrl, normaliseUrl, safeHref, titleFromUrl } from "../src/lib/extractUrl.ts";

let pass = 0;
let fail = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    pass += 1;
  } else {
    fail += 1;
    console.log(
      `FAIL ${name}\n  expected ${JSON.stringify(expected)}\n  actual   ${JSON.stringify(actual)}`,
    );
  }
}

// --- extractUrl ------------------------------------------------------------

check("title with no URL is left alone", extractUrl("buy milk"), {
  title: "buy milk",
  url: null,
});

check("https URL is pulled out of the title", extractUrl("read https://example.com/post later"), {
  title: "read later",
  url: "https://example.com/post",
});

check("URL at the start of the title", extractUrl("https://example.com book flights"), {
  title: "book flights",
  url: "https://example.com/",
});

check("URL as the whole title leaves an empty title", extractUrl("https://example.com"), {
  title: "",
  url: "https://example.com/",
});

check("bare www. gets an https scheme", extractUrl("check www.example.com tomorrow"), {
  title: "check tomorrow",
  url: "https://www.example.com/",
});

check("http is preserved", extractUrl("legacy http://example.com/x"), {
  title: "legacy",
  url: "http://example.com/x",
});

check("only the first URL is taken", extractUrl("a https://one.example b https://two.example"), {
  title: "a b https://two.example",
  url: "https://one.example/",
});

check("trailing sentence punctuation is dropped", extractUrl("see https://example.com/page."), {
  title: "see",
  url: "https://example.com/page",
});

check("trailing comma is dropped", extractUrl("https://example.com/a, then rest"), {
  title: "then rest",
  url: "https://example.com/a",
});

check(
  "balanced parens stay part of the URL",
  extractUrl("https://en.wikipedia.org/wiki/Foo_(bar) read it"),
  { title: "read it", url: "https://en.wikipedia.org/wiki/Foo_(bar)" },
);

check(
  "unbalanced closing paren is dropped",
  extractUrl("look (https://example.com/a) here"),
  { title: "look ( here", url: "https://example.com/a" },
);

check("query strings survive", extractUrl("https://example.com/s?q=1&r=2 buy"), {
  title: "buy",
  url: "https://example.com/s?q=1&r=2",
});

check("fragments survive and are not read as tags", extractUrl("https://example.com/a#b docs"), {
  title: "docs",
  url: "https://example.com/a#b",
});

check("an email address is not a URL", extractUrl("mail a@b.com about it"), {
  title: "mail a@b.com about it",
  url: null,
});

check("a mid-word www is not a URL", extractUrl("askwww.example.com"), {
  title: "askwww.example.com",
  url: null,
});

check("javascript: scheme is not extracted", extractUrl("javascript:alert(1) hmm"), {
  title: "javascript:alert(1) hmm",
  url: null,
});

check("whitespace around the removed URL is collapsed", extractUrl("a   https://x.example   b"), {
  title: "a b",
  url: "https://x.example/",
});

check("inline tokens are left for parseTaskTitle", extractUrl("ticket https://x.example @Work #now"), {
  title: "ticket @Work #now",
  url: "https://x.example/",
});

// --- normaliseUrl ----------------------------------------------------------

check("empty input is null", normaliseUrl("   "), null);
check("scheme is added when missing", normaliseUrl("example.com/a"), "https://example.com/a");
check("https is kept", normaliseUrl("https://example.com/a"), "https://example.com/a");
check("javascript: is rejected", normaliseUrl("javascript:alert(1)"), null);
check("data: is rejected", normaliseUrl("data:text/html,<h1>x</h1>"), null);
check("mailto: is rejected", normaliseUrl("mailto:a@b.com"), null);
check("surrounding whitespace is trimmed", normaliseUrl("  example.com  "), "https://example.com/");

// --- titleFromUrl ----------------------------------------------------------

check("hostname becomes the fallback title", titleFromUrl("https://example.com/a/b"), "example.com");
check("www. is stripped from the fallback title", titleFromUrl("https://www.example.com/"), "example.com");

// --- safeHref --------------------------------------------------------------

check("null passes through", safeHref(null), null);
check("empty string is null", safeHref(""), null);
check("stored http(s) URL passes", safeHref("https://example.com/a"), "https://example.com/a");
check("stored hostile URL is blocked", safeHref("javascript:alert(1)"), null);

console.log(`${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
