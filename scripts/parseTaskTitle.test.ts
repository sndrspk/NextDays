import { parseTaskTitle } from "../src/lib/parseTaskTitle.ts";
import type { Project } from "../src/types/index.ts";

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

function project(id: string, name: string): Project {
  return { id, name, colour: "#000000", is_personal: false, created_at: "2026-01-01T00:00:00Z" };
}

const PROJECTS = [
  project("p-home", "Home"),
  project("p-home-admin", "Home Admin"),
  project("p-work", "Work"),
];

const parse = (raw: string) => parseTaskTitle(raw, PROJECTS);

check("plain title is untouched", parse("buy milk"), {
  title: "buy milk",
  project_id: null,
  tags: [],
});

check("known project is assigned and stripped", parse("buy milk @Home"), {
  title: "buy milk",
  project_id: "p-home",
  tags: [],
});

check("project match is case-insensitive", parse("@work file taxes"), {
  title: "file taxes",
  project_id: "p-work",
  tags: [],
});

check("unknown project stays in the title", parse("ping @Alice about it"), {
  title: "ping @Alice about it",
  project_id: null,
  tags: [],
});

check("longest project name wins", parse("file taxes @Home Admin"), {
  title: "file taxes",
  project_id: "p-home-admin",
  tags: [],
});

check("multi-word match needs a word boundary", parse("@Home Adminstuff here"), {
  title: "Adminstuff here",
  project_id: "p-home",
  tags: [],
});

check("only the first matching project is used", parse("@Home and @Work"), {
  title: "and @Work",
  project_id: "p-home",
  tags: [],
});

check("tags are taken verbatim and stripped", parse("buy milk #groceries #Errands"), {
  title: "buy milk",
  project_id: null,
  tags: ["groceries", "Errands"],
});

check("tags dedupe case-insensitively, first spelling wins", parse("x #Travel #travel"), {
  title: "x",
  project_id: null,
  tags: ["Travel"],
});

check("tags and a project together", parse("#urgent call the plumber @Home"), {
  title: "call the plumber",
  project_id: "p-home",
  tags: ["urgent"],
});

check("mid-word sigils are left alone", parse("mail a@b.com about C#"), {
  title: "mail a@b.com about C#",
  project_id: null,
  tags: [],
});

check("a lone hash is not a tag", parse("count # of items"), {
  title: "count # of items",
  project_id: null,
  tags: [],
});

check("whitespace is collapsed after stripping", parse("do  @Home   the   thing"), {
  title: "do the thing",
  project_id: "p-home",
  tags: [],
});

check("no projects configured leaves @tokens alone", parseTaskTitle("hi @Home #t", []), {
  title: "hi @Home",
  project_id: null,
  tags: ["t"],
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
