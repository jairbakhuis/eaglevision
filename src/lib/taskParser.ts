import * as chrono from "chrono-node";
import pkg from "rrule";
const { RRule, Frequency } = pkg;
type RRuleInstance = InstanceType<typeof RRule>;

export type ParsedTask = {
  title: string;
  dueDate: Date | null;
  hasTime: boolean;
  priority: number;
  projectName: string | null;
  labels: string[];
  rrule: string | null;
  // Highlighted segments for chip display
  chips: { type: "date" | "priority" | "project" | "label" | "recur"; text: string }[];
};

const PRIORITY_RE = /(?:^|\s)(p[1-4]|!{1,3})(?=\s|$)/i;
const PROJECT_RE = /(?:^|\s)#([\w-]+)/;
const LABEL_RE = /(?:^|\s)@([\w-]+)/g;

// Common natural-language recurrence phrases
const RECUR_PATTERNS: { re: RegExp; build: (m: RegExpMatchArray) => RRuleInstance }[] = [
  {
    re: /\bevery\s+day\b|\bdaily\b/i,
    build: () => new RRule({ freq: Frequency.DAILY }),
  },
  {
    re: /\bevery\s+weekday\b/i,
    build: () =>
      new RRule({
        freq: Frequency.WEEKLY,
        byweekday: [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR],
      }),
  },
  {
    re: /\bevery\s+(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b/i,
    build: (m) => {
      const map: Record<string, any> = {
        mon: RRule.MO, tue: RRule.TU, wed: RRule.WE, thu: RRule.TH,
        fri: RRule.FR, sat: RRule.SA, sun: RRule.SU,
      };
      return new RRule({ freq: Frequency.WEEKLY, byweekday: [map[m[1].toLowerCase()]] });
    },
  },
  {
    re: /\bevery\s+week\b|\bweekly\b/i,
    build: () => new RRule({ freq: Frequency.WEEKLY }),
  },
  {
    re: /\bevery\s+month\b|\bmonthly\b/i,
    build: () => new RRule({ freq: Frequency.MONTHLY }),
  },
  {
    re: /\bevery\s+year\b|\byearly\b|\bannually\b/i,
    build: () => new RRule({ freq: Frequency.YEARLY }),
  },
  {
    re: /\bevery\s+(\d+)\s+days?\b/i,
    build: (m) => new RRule({ freq: Frequency.DAILY, interval: parseInt(m[1], 10) }),
  },
  {
    re: /\bevery\s+(\d+)\s+weeks?\b/i,
    build: (m) => new RRule({ freq: Frequency.WEEKLY, interval: parseInt(m[1], 10) }),
  },
  {
    re: /\bevery\s+(\d+)\s+months?\b/i,
    build: (m) => new RRule({ freq: Frequency.MONTHLY, interval: parseInt(m[1], 10) }),
  },
];

export function parseTask(input: string, ref: Date = new Date()): ParsedTask {
  let text = input;
  const chips: ParsedTask["chips"] = [];

  // Recurrence
  let rruleStr: string | null = null;
  for (const p of RECUR_PATTERNS) {
    const m = text.match(p.re);
    if (m) {
      const rule = p.build(m);
      rruleStr = rule.toString();
      chips.push({ type: "recur", text: m[0].trim() });
      text = text.replace(m[0], " ").trim();
      break;
    }
  }

  // Priority
  let priority = 4;
  const pMatch = text.match(PRIORITY_RE);
  if (pMatch) {
    const tok = pMatch[1].toLowerCase();
    if (tok.startsWith("p")) priority = parseInt(tok.slice(1), 10);
    else priority = Math.max(1, 5 - tok.length); // !!! = p2, !! = p3, ! = p4
    chips.push({ type: "priority", text: `P${priority}` });
    text = text.replace(pMatch[0], " ").trim();
  }

  // Project
  let projectName: string | null = null;
  const projMatch = text.match(PROJECT_RE);
  if (projMatch) {
    projectName = projMatch[1];
    chips.push({ type: "project", text: `#${projectName}` });
    text = text.replace(projMatch[0], " ").trim();
  }

  // Labels (multiple)
  const labels: string[] = [];
  text = text.replace(LABEL_RE, (full, name) => {
    labels.push(name);
    chips.push({ type: "label", text: `@${name}` });
    return " ";
  }).trim();

  // Date / time via chrono
  let dueDate: Date | null = null;
  let hasTime = false;
  const results = chrono.parse(text, ref, { forwardDate: true });
  if (results.length > 0) {
    const r = results[0];
    dueDate = r.start.date();
    hasTime = r.start.isCertain("hour");
    chips.push({ type: "date", text: r.text });
    text = (text.slice(0, r.index) + " " + text.slice(r.index + r.text.length))
      .replace(/\s+/g, " ")
      .trim();
  }

  // If recurring with no explicit date, default to today (so DTSTART works)
  if (rruleStr && !dueDate) {
    dueDate = ref;
  }

  // Clean leftover filler words like "at", "on", trailing prepositions
  const title = text
    .replace(/\s+(at|on|by|for)\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return {
    title: title || input.trim(),
    dueDate,
    hasTime,
    priority,
    projectName,
    labels,
    rrule: rruleStr,
    chips,
  };
}

/** Compute the next due date for a recurring task after completion. */
export function nextOccurrence(rruleStr: string, lastDue: Date): Date | null {
  try {
    const rule = RRule.fromString(rruleStr);
    const next = rule.after(lastDue, false);
    return next ?? null;
  } catch {
    return null;
  }
}