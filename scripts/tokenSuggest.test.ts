import {
  acceptCsv,
  acceptInline,
  csvOtherValues,
  csvTokenAt,
  filterSuggestions,
  inlineTokenAt,
} from "../src/lib/tokenSuggest.ts";

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

// --- inlineTokenAt --------------------------------------------------------

check("inline: no sigil, no token", inlineTokenAt("buy milk", 8), null);
check("inline: bare tag at the caret", inlineTokenAt("buy #tra", 8), {
  kind: "tag",
  query: "tra",
  start: 4,
  end: 8,
});
check("inline: just typed the hash", inlineTokenAt("buy #", 5), {
  kind: "tag",
  query: "",
  start: 4,
  end: 5,
});
check("inline: project sigil", inlineTokenAt("@Ho", 3), {
  kind: "project",
  query: "Ho",
  start: 0,
  end: 3,
});
check("inline: caret mid-token keeps the tail in range", inlineTokenAt("buy #trav milk", 7), {
  kind: "tag",
  query: "tr",
  start: 4,
  end: 9,
});
check("inline: sigil must follow whitespace (email)", inlineTokenAt("a@b", 3), null);
check("inline: caret after the token's trailing space", inlineTokenAt("#travel ", 8), null);
check("inline: caret before the sigil", inlineTokenAt("buy #travel", 4), null);

// --- csvTokenAt -----------------------------------------------------------

check("csv: single segment", csvTokenAt("tra", 3), { kind: "tag", query: "tra", start: 0, end: 3 });
check("csv: second segment skips the space", csvTokenAt("home, tra", 9), {
  kind: "tag",
  query: "tra",
  start: 6,
  end: 9,
});
check("csv: caret mid-segment with a following segment", csvTokenAt("tr, home", 2), {
  kind: "tag",
  query: "tr",
  start: 0,
  end: 2,
});
check("csv: trailing whitespace is not part of the token", csvTokenAt("home, tra  ", 9), {
  kind: "tag",
  query: "tra",
  start: 6,
  end: 9,
});
check("csv: other values exclude the active segment", csvOtherValues("home, tra, work", {
  kind: "tag",
  query: "tra",
  start: 6,
  end: 9,
}), ["home", "work"]);

// --- filterSuggestions ----------------------------------------------------

const TAGS = ["admin", "travel", "Travel-eu", "work"];

check("filter: prefix match, case-insensitive", filterSuggestions(TAGS, "tra"), [
  "travel",
  "Travel-eu",
]);
check("filter: empty query offers everything", filterSuggestions(TAGS, ""), TAGS);
check("filter: no match", filterSuggestions(TAGS, "zz"), []);
check("filter: sole exact match is dropped", filterSuggestions(TAGS, "admin"), []);
check("filter: exact match kept when others still extend it", filterSuggestions(TAGS, "travel"), [
  "travel",
  "Travel-eu",
]);
check("filter: exclusions drop already-used tags", filterSuggestions(TAGS, "", { exclude: ["Admin", "work"] }), [
  "travel",
  "Travel-eu",
]);
check("filter: limit", filterSuggestions(TAGS, "", { limit: 2 }), ["admin", "travel"]);

// --- accept ---------------------------------------------------------------

check("accept inline: completes and leaves one trailing space", acceptInline("buy #tra", inlineTokenAt("buy #tra", 8)!, "travel"), {
  value: "buy #travel ",
  caret: 12,
});
check(
  "accept inline: rewrites the whole token when the caret is mid-word",
  acceptInline("buy #trav milk", inlineTokenAt("buy #trav milk", 7)!, "travel"),
  { value: "buy #travel milk", caret: 12 },
);
check(
  "accept inline: project name with a space",
  acceptInline("call @Ho", inlineTokenAt("call @Ho", 8)!, "Home Admin"),
  { value: "call @Home Admin ", caret: 17 },
);
check("accept csv: first segment", acceptCsv("tra", csvTokenAt("tra", 3)!, "travel"), {
  value: "travel, ",
  caret: 8,
});
check(
  "accept csv: keeps the following segments",
  acceptCsv("tr, home", csvTokenAt("tr, home", 2)!, "travel"),
  { value: "travel, home", caret: 8 },
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
