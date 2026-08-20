import {
  buildSearchHaystack,
  matchesSearch,
  parseSearchQuery,
} from "../src/lib/searchQuery.ts";

let pass = 0;
let fail = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    pass += 1;
  } else {
    fail += 1;
    console.log(`FAIL ${name}\n  expected ${JSON.stringify(expected)}\n  actual   ${JSON.stringify(actual)}`);
  }
}

// A stand-in task: title / notes / tags / project name.
const hay = buildSearchHaystack([
  "Quarterly report draft",
  "Ask Mira for the Q3 numbers",
  "finance",
  "urgent",
  "Acme Rebrand",
]);

function m(q: string): boolean {
  return matchesSearch(parseSearchQuery(q), hay);
}

// --- field coverage ---
check("title", m("quarterly"), true);
check("notes", m("mira"), true);
check("tag", m("finance"), true);
check("project name", m("rebrand"), true);
check("miss", m("zebra"), false);
check("case insensitive", m("QUARTERLY"), true);

// --- implicit AND ---
check("implicit and both", m("quarterly mira"), true);
check("implicit and one miss", m("quarterly zebra"), false);

// --- explicit AND / OR ---
check("explicit AND", m("quarterly AND finance"), true);
check("explicit AND miss", m("quarterly AND zebra"), false);
check("OR first hit", m("quarterly OR zebra"), true);
check("OR second hit", m("zebra OR finance"), true);
check("OR both miss", m("zebra OR llama"), false);

// --- precedence: AND binds tighter than OR ---
check("a AND b OR c -> (a AND b) OR c", m("zebra quarterly OR finance"), true);
check("precedence miss", m("zebra AND quarterly OR llama"), false);

// --- phrases ---
check("phrase hit", m('"quarterly report"'), true);
check("phrase miss (word order)", m('"report quarterly"'), false);
check("loose words match either order", m("report quarterly"), true);
check("phrase does not span fields", m('"draft ask"'), false);
check("phrase plus term", m('"quarterly report" finance'), true);

// --- matching is substring, not whole-word ---
check("substring of a word", m("repo"), true);

// --- lowercase or/and are literal words, not operators ---
// This haystack deliberately contains no incidental "and"/"or" substrings
// (unlike "rebrand", which contains "and").
const hay2 = buildSearchHaystack(["Ship the widget", "Milk eggs", "kitchen", "Home"]);
const m2 = (q: string) => matchesSearch(parseSearchQuery(q), hay2);

check("control: hay2 has no 'and'", m2("and"), false);
check("control: hay2 has no 'or'", m2("or"), false);
check("lowercase and is a term", m2("widget and kitchen"), false);
check("lowercase or is a term", m2("widget or zebra"), false);
check("uppercase OR is an operator", m2("widget OR zebra"), true);
check("uppercase AND is an operator", m2("widget AND kitchen"), true);
check("quoted AND is a term", m2('"AND"'), false);

// --- parentheses ---
check("paren group", m("(zebra OR quarterly) finance"), true);
check("paren group miss", m("(zebra OR llama) finance"), false);
check("nested", m("((quarterly OR zebra) AND (finance OR llama))"), true);

// --- forgiving parsing ---
check("unclosed paren", m("(quarterly OR zebra"), true);
check("unclosed quote", m('"quarterly report'), true);
check("stray close paren", m("quarterly)"), true);
check("empty query matches", m(""), true);
check("whitespace only matches", m("   "), true);
check("operators alone match", m("AND OR"), true);
check("empty query parses to null", parseSearchQuery(""), null);
check("operators alone parse to null", parseSearchQuery("OR"), null);

// --- tree shape spot checks ---
check("single term tree", parseSearchQuery("foo"), { kind: "term", value: "foo" });
check("and tree", parseSearchQuery("foo bar"), {
  kind: "and",
  children: [
    { kind: "term", value: "foo" },
    { kind: "term", value: "bar" },
  ],
});
check("or tree", parseSearchQuery("foo OR bar"), {
  kind: "or",
  children: [
    { kind: "term", value: "foo" },
    { kind: "term", value: "bar" },
  ],
});
check("precedence tree", parseSearchQuery("a b OR c"), {
  kind: "or",
  children: [
    { kind: "and", children: [{ kind: "term", value: "a" }, { kind: "term", value: "b" }] },
    { kind: "term", value: "c" },
  ],
});

// --- haystack ---
check("haystack skips nulls", buildSearchHaystack(["A", null, undefined, "", "B"]), "a\nb");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
