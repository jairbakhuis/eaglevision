import { isToday, isPast, startOfDay, addDays } from "date-fns";

export type FilterTask = {
  id: string;
  title: string;
  status: string;
  priority: number;
  due_date: string | null;
  project_id: string | null;
  parent_task_id: string | null;
  tags?: string[] | null;
};
export type FilterProject = { id: string; name: string };

type Node =
  | { kind: "and"; left: Node; right: Node }
  | { kind: "or"; left: Node; right: Node }
  | { kind: "not"; child: Node }
  | { kind: "atom"; type: AtomType; value?: string | number };

type AtomType =
  | "today" | "overdue" | "upcoming" | "no-date" | "inbox" | "done" | "open"
  | "priority" | "project" | "label" | "days" | "text";

// ─── Tokenizer ───────────────────────────────────────────────────────────
type Tok =
  | { t: "lparen" } | { t: "rparen" }
  | { t: "and" } | { t: "or" } | { t: "not" }
  | { t: "word"; v: string };

function tokenize(input: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (c === " " || c === "\t" || c === "\n") { i++; continue; }
    if (c === "(") { toks.push({ t: "lparen" }); i++; continue; }
    if (c === ")") { toks.push({ t: "rparen" }); i++; continue; }
    if (c === "&") { toks.push({ t: "and" }); i++; continue; }
    if (c === "|") { toks.push({ t: "or" }); i++; continue; }
    if (c === "!") { toks.push({ t: "not" }); i++; continue; }
    // word: keep #, @, digits, letters, dashes
    let j = i;
    while (j < input.length && !" \t\n()&|!".includes(input[j])) j++;
    const w = input.slice(i, j).toLowerCase();
    if (w === "and") toks.push({ t: "and" });
    else if (w === "or") toks.push({ t: "or" });
    else if (w === "not") toks.push({ t: "not" });
    else toks.push({ t: "word", v: w });
    i = j;
  }
  return toks;
}

// ─── Parser (recursive descent) ──────────────────────────────────────────
// expr   := or
// or     := and ('|' and)*
// and    := unary ('&' unary)*    (whitespace also implies AND)
// unary  := '!' unary | '(' expr ')' | atom
function parse(input: string): Node | null {
  const toks = tokenize(input);
  if (toks.length === 0) return null;
  let pos = 0;
  const peek = () => toks[pos];
  const eat = () => toks[pos++];

  function parseAtom(): Node {
    const t = eat();
    if (!t || t.t !== "word") throw new Error("Expected term");
    return wordToAtom(t.v);
  }
  function parseUnary(): Node {
    const t = peek();
    if (!t) throw new Error("Unexpected end");
    if (t.t === "not") { eat(); return { kind: "not", child: parseUnary() }; }
    if (t.t === "lparen") {
      eat();
      const e = parseOr();
      if (peek()?.t !== "rparen") throw new Error("Missing )");
      eat();
      return e;
    }
    return parseAtom();
  }
  function parseAnd(): Node {
    let left = parseUnary();
    while (true) {
      const t = peek();
      if (!t) break;
      if (t.t === "and") { eat(); left = { kind: "and", left, right: parseUnary() }; }
      else if (t.t === "word" || t.t === "not" || t.t === "lparen") {
        // implicit AND
        left = { kind: "and", left, right: parseUnary() };
      } else break;
    }
    return left;
  }
  function parseOr(): Node {
    let left = parseAnd();
    while (peek()?.t === "or") { eat(); left = { kind: "or", left, right: parseAnd() }; }
    return left;
  }
  return parseOr();
}

function wordToAtom(w: string): Node {
  // priority p1..p4
  const pm = w.match(/^p([1-4])$/);
  if (pm) return { kind: "atom", type: "priority", value: parseInt(pm[1], 10) };
  // N days   (e.g. 7days, 7d)
  const dm = w.match(/^(\d+)d(ays?)?$/);
  if (dm) return { kind: "atom", type: "days", value: parseInt(dm[1], 10) };
  // project   #name
  if (w.startsWith("#")) return { kind: "atom", type: "project", value: w.slice(1) };
  // label     @name
  if (w.startsWith("@")) return { kind: "atom", type: "label", value: w.slice(1) };

  switch (w) {
    case "today": return { kind: "atom", type: "today" };
    case "overdue": return { kind: "atom", type: "overdue" };
    case "upcoming": case "next7": return { kind: "atom", type: "upcoming" };
    case "no-date": case "nodate": return { kind: "atom", type: "no-date" };
    case "inbox": return { kind: "atom", type: "inbox" };
    case "done": case "completed": return { kind: "atom", type: "done" };
    case "open": case "todo": return { kind: "atom", type: "open" };
  }
  return { kind: "atom", type: "text", value: w };
}

// ─── Evaluator ───────────────────────────────────────────────────────────
function evalNode(
  node: Node,
  task: FilterTask,
  projects: FilterProject[],
  now: Date,
): boolean {
  switch (node.kind) {
    case "and": return evalNode(node.left, task, projects, now) && evalNode(node.right, task, projects, now);
    case "or": return evalNode(node.left, task, projects, now) || evalNode(node.right, task, projects, now);
    case "not": return !evalNode(node.child, task, projects, now);
    case "atom": {
      switch (node.type) {
        case "today":
          return !!task.due_date && (
            isToday(new Date(task.due_date)) ||
            (isPast(new Date(task.due_date)) && task.status !== "done")
          );
        case "overdue":
          return !!task.due_date && isPast(new Date(task.due_date)) &&
            !isToday(new Date(task.due_date)) && task.status !== "done";
        case "upcoming":
          return !!task.due_date && new Date(task.due_date) >= startOfDay(now) &&
            new Date(task.due_date) <= addDays(startOfDay(now), 7);
        case "no-date": return !task.due_date;
        case "inbox": return !task.project_id;
        case "done": return task.status === "done";
        case "open": return task.status !== "done";
        case "priority": return task.priority === node.value;
        case "project": {
          const p = projects.find(
            (x) => x.name.toLowerCase() === String(node.value).toLowerCase(),
          );
          return !!p && task.project_id === p.id;
        }
        case "label":
          return !!task.tags?.some(
            (t) => t.toLowerCase() === String(node.value).toLowerCase(),
          );
        case "days":
          return !!task.due_date &&
            new Date(task.due_date) >= startOfDay(now) &&
            new Date(task.due_date) <= addDays(startOfDay(now), Number(node.value));
        case "text":
          return task.title.toLowerCase().includes(String(node.value));
      }
    }
  }
}

/** Compile a query string into a predicate. Invalid → matches nothing. */
export function compileFilter(
  query: string,
): (task: FilterTask, projects: FilterProject[]) => boolean {
  if (!query.trim()) return () => true;
  let node: Node | null = null;
  try { node = parse(query); } catch { return () => false; }
  if (!node) return () => true;
  return (task, projects) => evalNode(node!, task, projects, new Date());
}

export function validateQuery(query: string): { ok: true } | { ok: false; error: string } {
  if (!query.trim()) return { ok: true };
  try { parse(query); return { ok: true }; }
  catch (e: any) { return { ok: false, error: e.message ?? "Invalid query" }; }
}

/** Return colored chips for a query, for live preview. */
export function describeQuery(query: string): { text: string; type: string }[] {
  return tokenize(query).map((t) => {
    if (t.t === "word") {
      const v = t.v;
      if (/^p[1-4]$/.test(v)) return { text: v.toUpperCase(), type: "priority" };
      if (v.startsWith("#")) return { text: v, type: "project" };
      if (v.startsWith("@")) return { text: v, type: "label" };
      if (["today", "overdue", "upcoming", "no-date", "nodate", "inbox", "done", "open"].includes(v))
        return { text: v, type: "keyword" };
      if (/^\d+d(ays?)?$/.test(v)) return { text: v, type: "keyword" };
      return { text: v, type: "text" };
    }
    if (t.t === "and") return { text: "AND", type: "op" };
    if (t.t === "or") return { text: "OR", type: "op" };
    if (t.t === "not") return { text: "NOT", type: "op" };
    if (t.t === "lparen") return { text: "(", type: "op" };
    return { text: ")", type: "op" };
  });
}