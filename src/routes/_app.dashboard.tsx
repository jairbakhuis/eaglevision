import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  CheckSquare,
  CircleDot,
  Cpu,
  Database,
  HardDrive,
  MessageSquare,
  Radio,
  Signal,
  StickyNote,
  Terminal,
  Wifi,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
});

/* ──────────────────────────────────────────────────────────────────
   TERMINAL DASHBOARD
   Fallout Pip-Boy / Vault-Tec + Claude Code CLI inspired.
   All styles scoped via the .term root class so nothing leaks.
   ────────────────────────────────────────────────────────────── */

const BOOT_LINES = [
  "ROBCO INDUSTRIES (TM) TERMLINK PROTOCOL",
  "J.P.A. OS  v3.14.159  ── © 2287 VAULT-TEC",
  "INITIALIZING SUBSYSTEMS............. [OK]",
  "MOUNTING /home/operator............. [OK]",
  "LOADING PERSONAL ASSISTANT MATRIX... [OK]",
  "ESTABLISHING UPLINK ── claude-net.... [OK]",
  "WELCOME, OPERATOR.",
];

function useBootSequence() {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (shown >= BOOT_LINES.length) return;
    const t = setTimeout(() => setShown((s) => s + 1), 180);
    return () => clearTimeout(t);
  }, [shown]);
  return BOOT_LINES.slice(0, shown);
}

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function DashboardPage() {
  const boot = useBootSequence();
  const now = useClock();

  const stardate = useMemo(
    () =>
      now
        .toISOString()
        .replace("T", " ")
        .replace(/\.\d+Z$/, "Z"),
    [now],
  );

  return (
    <div className="term">
      <ScanlineOverlay />
      <div className="term-wrap">
        {/* Top status bar */}
        <header className="term-topbar">
          <div className="flex items-center gap-2">
            <span className="term-dot" />
            <span>VAULT-TEC // J.P.A. OS TERMINAL</span>
          </div>
          <div className="hidden md:flex items-center gap-4 text-[11px]">
            <span><Wifi className="inline h-3 w-3 mr-1" /> UPLINK 100%</span>
            <span><Signal className="inline h-3 w-3 mr-1" /> SIG 0.92</span>
            <span><Radio className="inline h-3 w-3 mr-1" /> CH 7</span>
            <span>{stardate}</span>
          </div>
          <div className="md:hidden text-[10px]">{stardate.slice(11, 19)}</div>
        </header>

        {/* ASCII banner */}
        <pre className="term-ascii">{`
 ▓█████  ▄▄▄        ▄████  ██▓    ▓█████ ██▒   █▓ ██▓  ██████  ██▓ ▒█████   ███▄    █
 ▓█   ▀ ▒████▄     ██▒ ▀█▒▓██▒    ▓█   ▀▓██░   █▒▓██▒▒██    ▒ ▓██▒▒██▒  ██▒ ██ ▀█   █
 ▒███   ▒██  ▀█▄  ▒██░▄▄▄░▒██░    ▒███   ▓██  █▒░▒██▒░ ▓██▄   ▒██▒▒██░  ██▒▓██  ▀█ ██▒
 ▒▓█  ▄ ░██▄▄▄▄██ ░▓█  ██▓▒██░    ▒▓█  ▄  ▒██ █░░░██░  ▒   ██▒░██░▒██   ██░▓██▒  ▐▌██▒
 ░▒████▒ ▓█   ▓██▒░▒▓███▀▒░██████▒░▒████▒  ▒▀█░  ░██░▒██████▒▒░██░░ ████▓▒░▒██░   ▓██░
`}</pre>

        {/* Boot sequence */}
        <section className="term-panel term-boot">
          {boot.map((l, i) => (
            <div key={i} className="term-line">
              <span className="term-prompt">»</span> {l}
            </div>
          ))}
          {boot.length >= BOOT_LINES.length && (
            <div className="term-line">
              <span className="term-prompt">operator@vault-3:~$</span>{" "}
              <span className="term-cmd">overview --all</span>
              <span className="term-cursor" />
            </div>
          )}
        </section>

        {/* Quick stats */}
        <section className="term-grid term-grid-4">
          <StatTile label="OPEN TASKS" value="12" delta="+3 today" icon={CheckSquare} />
          <StatTile label="UNREAD CHATS" value="04" delta="2 priority" icon={MessageSquare} />
          <StatTile label="NOTES" value="87" delta="+5 this wk" icon={StickyNote} />
          <StatTile label="CREDITS" value="1,240" delta="−40 today" icon={Zap} />
        </section>

        {/* Main dashboard grid */}
        <section className="term-grid term-grid-3">
          <Panel title="ENV / SYSTEM" icon={Cpu} className="md:col-span-2">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
              <Bar label="CPU"      value={42} />
              <Bar label="MEMORY"   value={68} />
              <Bar label="STORAGE"  value={31} />
              <Bar label="NET I/O"  value={77} />
              <Bar label="GPU"      value={18} />
              <Bar label="POWER"    value={91} />
            </div>
          </Panel>

          <Panel title="VITALS" icon={Activity}>
            <div className="space-y-2 text-xs">
              <Vital label="HP"   value={98} max={100} />
              <Vital label="AP"   value={72} max={100} />
              <Vital label="RAD"  value={12} max={100} danger />
              <Vital label="XP"   value={4720} max={5000} />
            </div>
          </Panel>

          <Panel title="ACTIVITY ── 24H" icon={Activity} className="md:col-span-2">
            <Sparkline />
            <div className="mt-2 flex justify-between text-[10px] term-muted">
              <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span>
            </div>
          </Panel>

          <Panel title="UPLINK" icon={Wifi}>
            <div className="text-xs space-y-1.5">
              <KV k="STATUS" v="● ONLINE" />
              <KV k="LATENCY" v="14 ms" />
              <KV k="INBOUND" v="174 kB/s" />
              <KV k="OUTBOUND" v="15 kB/s" />
              <KV k="PEERS" v="07" />
            </div>
          </Panel>

          <Panel title="TASK QUEUE" icon={CheckSquare} className="md:col-span-2">
            <ul className="text-xs divide-y divide-[color:var(--term-grid)]">
              {[
                ["[ ]", "Calibrate radio uplink to vault entrance", "P1"],
                ["[x]", "Sync notes archive ── 2287/03/14",        "OK"],
                ["[ ]", "Review credits ledger for anomalies",      "P2"],
                ["[ ]", "Schedule water pump inspection",           "P3"],
                ["[~]", "Draft weekly ops report",                  "WIP"],
              ].map(([s, t, p], i) => (
                <li key={i} className="flex items-center justify-between py-1.5">
                  <span><span className="term-prompt mr-2">{s}</span>{t}</span>
                  <span className="term-tag">{p}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="STORAGE" icon={HardDrive}>
            <Bar label="VAULT-DB" value={58} />
            <Bar label="ARCHIVES" value={24} />
            <Bar label="CACHE"    value={11} />
            <div className="mt-3 text-[11px] term-muted">3 partitions ── 2.4 TB total</div>
          </Panel>

          <Panel title="MESSAGE LOG" icon={MessageSquare} className="md:col-span-2">
            <div className="text-[11px] font-mono space-y-1">
              {[
                ["12:04", "claude",   "Daily briefing compiled. 3 items need attention."],
                ["11:47", "scheduler","Calendar sync complete ── 14 events."],
                ["10:22", "ops",      "Pump #2 cycling nominally."],
                ["09:01", "system",   "Backup window opens at 02:00."],
                ["08:30", "operator", "morning."],
              ].map(([t, who, msg], i) => (
                <div key={i}>
                  <span className="term-muted">[{t}]</span>{" "}
                  <span className="term-accent">{who}</span>
                  <span className="term-muted">:</span> {msg}
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="SECTOR MAP" icon={Database}>
            <SectorMap />
          </Panel>
        </section>

        {/* Prompt footer */}
        <footer className="term-prompt-bar">
          <span className="term-prompt">operator@vault-3:~$</span>
          <span className="ml-2 term-muted">type</span>
          <span className="mx-1 term-accent">help</span>
          <span className="term-muted">for command list</span>
          <span className="term-cursor" />
        </footer>
      </div>

      {/* Scoped styles */}
      <style>{TERMINAL_CSS}</style>
    </div>
  );
}

/* ── Components ─────────────────────────────────────────────── */

function ScanlineOverlay() {
  return (
    <>
      <div className="term-scanlines" aria-hidden />
      <div className="term-vignette" aria-hidden />
      <div className="term-flicker" aria-hidden />
    </>
  );
}

function Panel({
  title,
  icon: Icon,
  children,
  className = "",
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`term-panel ${className}`}>
      <div className="term-panel-header">
        <span className="flex items-center gap-2">
          {Icon ? <Icon className="h-3.5 w-3.5" /> : <CircleDot className="h-3.5 w-3.5" />}
          <span>{title}</span>
        </span>
        <span className="term-muted">▍▍▍</span>
      </div>
      <div className="term-panel-body">{children}</div>
    </div>
  );
}

function StatTile({
  label,
  value,
  delta,
  icon: Icon,
}: {
  label: string;
  value: string;
  delta: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="term-panel term-stat">
      <div className="flex items-center justify-between text-[10px] term-muted">
        <span>{label}</span>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="term-stat-value">{value}</div>
      <div className="text-[10px] term-muted">{delta}</div>
    </div>
  );
}

function Bar({ label, value }: { label: string; value: number }) {
  const filled = Math.round((value / 100) * 18);
  return (
    <div className="my-1">
      <div className="flex justify-between text-[11px]">
        <span>{label}</span>
        <span className="term-muted">{value}%</span>
      </div>
      <div className="font-mono text-[12px] tracking-tighter">
        <span className="term-accent">[</span>
        <span className="term-accent">{"█".repeat(filled)}</span>
        <span className="term-muted">{"░".repeat(18 - filled)}</span>
        <span className="term-accent">]</span>
      </div>
    </div>
  );
}

function Vital({
  label,
  value,
  max,
  danger,
}: {
  label: string;
  value: number;
  max: number;
  danger?: boolean;
}) {
  const pct = (value / max) * 100;
  return (
    <div>
      <div className="flex justify-between text-[11px]">
        <span>{label}</span>
        <span className={danger ? "term-danger" : "term-accent"}>
          {value}/{max}
        </span>
      </div>
      <div className="term-meter">
        <div
          className={`term-meter-fill ${danger ? "term-meter-danger" : ""}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-dashed border-[color:var(--term-grid)] pb-1">
      <span className="term-muted">{k}</span>
      <span>{v}</span>
    </div>
  );
}

function Sparkline() {
  // Deterministic placeholder data
  const pts = useMemo(() => {
    const arr: number[] = [];
    for (let i = 0; i < 48; i++) {
      const v =
        50 +
        Math.sin(i / 3) * 18 +
        Math.cos(i / 7) * 12 +
        ((i * 37) % 11) -
        5;
      arr.push(Math.max(4, Math.min(96, v)));
    }
    return arr;
  }, []);
  const w = 600;
  const h = 120;
  const step = w / (pts.length - 1);
  const path = pts
    .map((v, i) => `${i === 0 ? "M" : "L"} ${i * step} ${h - (v / 100) * h}`)
    .join(" ");
  const area = `${path} L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-28 block">
      <defs>
        <linearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--term-fg)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="var(--term-fg)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* grid */}
      {[0.25, 0.5, 0.75].map((g) => (
        <line
          key={g}
          x1="0"
          x2={w}
          y1={h * g}
          y2={h * g}
          stroke="var(--term-grid)"
          strokeDasharray="2 4"
        />
      ))}
      <path d={area} fill="url(#sparkfill)" />
      <path d={path} fill="none" stroke="var(--term-fg)" strokeWidth="1.6" />
    </svg>
  );
}

function SectorMap() {
  // 8x8 ASCII-ish sector grid
  const cells = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; i < 64; i++) {
      const r = (i * 73 + 11) % 7;
      out.push(r === 0 ? "▓" : r < 2 ? "▒" : r < 4 ? "░" : "·");
    }
    return out;
  }, []);
  return (
    <div className="font-mono text-[14px] leading-[1.05] term-accent select-none">
      {Array.from({ length: 8 }).map((_, row) => (
        <div key={row} className="tracking-[0.2em]">
          {cells.slice(row * 8, row * 8 + 8).join(" ")}
        </div>
      ))}
      <div className="mt-2 text-[10px] term-muted">SECTOR 7-G ── ALL CLEAR</div>
    </div>
  );
}

/* ── Scoped CSS ─────────────────────────────────────────────── */

const TERMINAL_CSS = `
.term {
  --term-bg: #04150a;
  --term-bg-2: #061d0d;
  --term-fg: #4ef58a;
  --term-fg-dim: #1f8a4a;
  --term-grid: rgba(78, 245, 138, 0.18);
  --term-danger: #ffb13b;
  position: relative;
  min-height: 100%;
  background:
    radial-gradient(ellipse at top, #06281a 0%, #03100a 60%, #010805 100%);
  color: var(--term-fg);
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  text-shadow: 0 0 1px rgba(78,245,138,0.45), 0 0 8px rgba(78,245,138,0.12);
  overflow: hidden;
}
.term * { font-variant-ligatures: none; }

.term-wrap {
  position: relative;
  z-index: 1;
  max-width: 1400px;
  margin: 0 auto;
  padding: 16px 18px 60px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.term-topbar {
  display: flex; align-items: center; justify-content: space-between;
  border: 1px solid var(--term-grid);
  background: linear-gradient(180deg, rgba(78,245,138,0.06), transparent);
  padding: 6px 10px;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.term-dot {
  display:inline-block; width:8px; height:8px; border-radius:50%;
  background: var(--term-fg);
  box-shadow: 0 0 8px var(--term-fg);
  animation: termPulse 1.6s ease-in-out infinite;
}
@keyframes termPulse { 50% { opacity: 0.35; } }

.term-ascii {
  font-size: 9px;
  line-height: 1.05;
  color: var(--term-fg);
  opacity: 0.8;
  white-space: pre;
  overflow: hidden;
  text-shadow: 0 0 6px rgba(78,245,138,0.5);
  margin: -4px 0 -4px;
}
@media (max-width: 768px) {
  .term-ascii { font-size: 6px; }
}

.term-panel {
  position: relative;
  border: 1px solid var(--term-grid);
  background: linear-gradient(180deg, rgba(78,245,138,0.04), rgba(0,0,0,0.25));
  padding: 0;
}
.term-panel::before, .term-panel::after {
  content: ""; position: absolute; width: 8px; height: 8px;
  border: 1px solid var(--term-fg);
}
.term-panel::before { top: -1px; left: -1px; border-right: 0; border-bottom: 0; }
.term-panel::after  { bottom: -1px; right: -1px; border-left: 0; border-top: 0; }

.term-panel-header {
  display:flex; align-items:center; justify-content:space-between;
  padding: 6px 10px;
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  border-bottom: 1px dashed var(--term-grid);
  background: rgba(78,245,138,0.05);
}
.term-panel-body { padding: 10px 12px 12px; }

.term-grid { display: grid; gap: 12px; }
.term-grid-4 { grid-template-columns: repeat(2, minmax(0,1fr)); }
.term-grid-3 { grid-template-columns: 1fr; }
@media (min-width: 768px) {
  .term-grid-4 { grid-template-columns: repeat(4, minmax(0,1fr)); }
  .term-grid-3 { grid-template-columns: repeat(3, minmax(0,1fr)); }
}

.term-stat-value {
  font-size: 32px;
  line-height: 1;
  margin: 6px 0 2px;
  letter-spacing: 0.04em;
  text-shadow: 0 0 10px rgba(78,245,138,0.6);
}

.term-boot { padding: 10px 12px; font-size: 12px; line-height: 1.55; }
.term-line { white-space: pre-wrap; }
.term-prompt { color: var(--term-fg-dim); }
.term-accent { color: var(--term-fg); }
.term-muted  { color: var(--term-fg-dim); opacity: 0.85; }
.term-danger { color: var(--term-danger); text-shadow: 0 0 6px rgba(255,177,59,0.5); }
.term-cmd    { color: var(--term-fg); }

.term-cursor {
  display:inline-block; width:7px; height:13px;
  background: var(--term-fg); margin-left: 4px;
  vertical-align: -2px;
  animation: termBlink 1s steps(2) infinite;
  box-shadow: 0 0 8px var(--term-fg);
}
@keyframes termBlink { 50% { opacity: 0; } }

.term-tag {
  border: 1px solid var(--term-grid);
  padding: 1px 6px;
  font-size: 10px;
  letter-spacing: 0.1em;
  color: var(--term-fg);
}

.term-meter {
  height: 8px;
  background: rgba(78,245,138,0.08);
  border: 1px solid var(--term-grid);
  position: relative;
  margin-top: 3px;
}
.term-meter-fill {
  height: 100%;
  background:
    repeating-linear-gradient(90deg,
      var(--term-fg) 0 4px, transparent 4px 6px);
  box-shadow: 0 0 8px var(--term-fg);
}
.term-meter-danger {
  background:
    repeating-linear-gradient(90deg,
      var(--term-danger) 0 4px, transparent 4px 6px);
  box-shadow: 0 0 8px var(--term-danger);
}

.term-prompt-bar {
  border-top: 1px solid var(--term-grid);
  padding: 8px 10px;
  font-size: 12px;
  background: rgba(78,245,138,0.04);
}

/* CRT effects */
.term-scanlines {
  pointer-events:none; position:absolute; inset:0; z-index:2;
  background: repeating-linear-gradient(
    to bottom,
    rgba(0,0,0,0.0) 0px,
    rgba(0,0,0,0.0) 2px,
    rgba(0,0,0,0.18) 3px,
    rgba(0,0,0,0.0) 4px
  );
  mix-blend-mode: multiply;
}
.term-vignette {
  pointer-events:none; position:absolute; inset:0; z-index:2;
  background: radial-gradient(ellipse at center,
    transparent 55%, rgba(0,0,0,0.55) 100%);
}
.term-flicker {
  pointer-events:none; position:absolute; inset:0; z-index:3;
  background: rgba(78,245,138,0.02);
  animation: termFlicker 4s infinite;
}
@keyframes termFlicker {
  0%,100% { opacity: 1; }
  47% { opacity: 0.92; }
  48% { opacity: 1; }
  72% { opacity: 0.85; }
  73% { opacity: 1; }
}
`;
