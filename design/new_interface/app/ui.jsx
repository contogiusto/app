/* ============================================================
   ui.jsx — Shared primitives for all three role apps.
   Exports to window: Icon, QR, Progress, Money, Avatar, Segmented,
   Stepper, Sheet, LiveDot, Initial, CategoryDot
   ============================================================ */

// ---------------- Icons (1.6 stroke, currentColor) ----------------
const ICON_PATHS = {
  arrow:    <path d="M5 12h14M13 6l6 6-6 6" />,
  plus:     <path d="M12 5v14M5 12h14" />,
  minus:    <path d="M5 12h14" />,
  check:    <path d="M20 6L9 17l-5-5" />,
  close:    <path d="M18 6L6 18M6 6l12 12" />,
  card:     <g><rect x="2" y="5" width="20" height="14" rx="2.5" /><path d="M2 10h20" /></g>,
  cash:     <g><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.6" /><path d="M6 9.5v.01M18 14.5v.01" /></g>,
  table:    <g><path d="M3 9h18M5 9l1.5 11M19 9l-1.5 11M4 5h16v4H4z" /></g>,
  book:     <g><path d="M4 5a2 2 0 012-2h12v18H6a2 2 0 01-2-2z" /><path d="M9 7h6M9 11h6" /></g>,
  users:    <g><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19a5.5 5.5 0 0111 0" /><path d="M16 6.2a3 3 0 010 5.6M16.5 19a5.5 5.5 0 00-3-4.9" /></g>,
  clock:    <g><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></g>,
  edit:     <path d="M16 3.5l4.5 4.5L8 20.5 3 22l1.5-5L16 3.5z" />,
  trash:    <g><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14" /></g>,
  refresh:  <g><path d="M20 11a8 8 0 10-1.8 6" /><path d="M20 4v6h-6" /></g>,
  lock:     <g><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></g>,
  qr:       <g><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3M21 14v.01M17 21h4v-4M14 21h.01" /></g>,
  receipt:  <g><path d="M5 3h14v18l-2.5-1.5L14 21l-2-1.5L10 21l-2.5-1.5L5 21z" /><path d="M9 8h6M9 12h6" /></g>,
  split:    <g><path d="M12 3v18" strokeDasharray="2 3" /><path d="M5 8l-2 4 2 4M19 8l2 4-2 4" /></g>,
  settings: <g><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></g>,
  logout:   <g><path d="M9 4H6a2 2 0 00-2 2v12a2 2 0 002 2h3M16 17l5-5-5-5M21 12H9" /></g>,
  bell:     <g><path d="M6 9a6 6 0 0112 0c0 5 2 7 2 7H4s2-2 2-7zM10 20a2 2 0 004 0" /></g>,
  euro:     <g><path d="M17 6.5A6 6 0 008 9m0 6a6 6 0 009 2.5M5 10.5h7M5 13.5h7" /></g>,
  sparkle:  <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />,
  chef:     <g><path d="M7 14a4 4 0 01-1-7.9A4 4 0 0112 4a4 4 0 016 2.1A4 4 0 0117 14M7 14v5a1 1 0 001 1h8a1 1 0 001-1v-5" /></g>,
  pin:      <g><path d="M12 21s7-6.3 7-11a7 7 0 10-14 0c0 4.7 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></g>,
};

function Icon({ name, size = 20, stroke = 1.6, fill = false, style = {}, className = "" }) {
  const p = ICON_PATHS[name];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      style={{ display: "block", flexShrink: 0, ...style }} className={className}>
      {p}
    </svg>
  );
}

// ---------------- Faux QR (deterministic from token) ----------------
function QR({ value = "", size = 150, fg = "#221C15", bg = "#FFFDF8" }) {
  const N = 21;
  // hash
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) { h ^= value.charCodeAt(i); h = Math.imul(h, 16777619); }
  const rng = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1000) / 1000; };
  const cells = [];
  const isFinder = (r, c) => {
    const inBox = (br, bc) => r >= br && r < br + 7 && c >= bc && c < bc + 7;
    return inBox(0, 0) || inBox(0, N - 7) || inBox(N - 7, 0);
  };
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      if (isFinder(r, c)) continue;
      if (rng() > 0.52) cells.push([r, c]);
    }
  const cs = size / N;
  const finder = (br, bc) => (
    <g key={`f${br}${bc}`}>
      <rect x={bc * cs} y={br * cs} width={7 * cs} height={7 * cs} rx={cs} fill={fg} />
      <rect x={(bc + 1) * cs} y={(br + 1) * cs} width={5 * cs} height={5 * cs} rx={cs * .7} fill={bg} />
      <rect x={(bc + 2) * cs} y={(br + 2) * cs} width={3 * cs} height={3 * cs} rx={cs * .5} fill={fg} />
    </g>
  );
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block", borderRadius: 4 }}>
      <rect width={size} height={size} fill={bg} />
      {cells.map(([r, c], i) => (
        <rect key={i} x={c * cs} y={r * cs} width={cs} height={cs} rx={cs * .28} fill={fg} />
      ))}
      {finder(0, 0)}{finder(0, N - 7)}{finder(N - 7, 0)}
    </svg>
  );
}

// ---------------- Progress bar ----------------
function Progress({ value = 0, color = "var(--olive)", height = 8, track = "rgba(34,28,21,.08)" }) {
  return (
    <div style={{ height, borderRadius: 99, background: track, overflow: "hidden" }}>
      <div style={{
        height: "100%", width: `${Math.round(value * 100)}%`,
        background: color, borderRadius: 99,
        transition: "width .6s var(--ease)",
      }} />
    </div>
  );
}

// ---------------- Money ----------------
function Money({ cents, className = "", style = {} }) {
  return <span className={`tnum ${className}`} style={style}>{fmt(cents)}</span>;
}

// ---------------- Avatar / initials ----------------
const AV_COLORS = [
  ["#C0492F", "#F3DDD3"], ["#5E6B47", "#E2E6D7"], ["#6B3B57", "#EBDBE4"],
  ["#2E6081", "#D7E6F0"], ["#9C6311", "#F6E9CC"], ["#4A5240", "#E1E4DC"],
];
function colorFor(name = "") {
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 997;
  return AV_COLORS[h % AV_COLORS.length];
}
function Initial({ name = "?", size = 36, ring = false }) {
  const [fg, bg] = colorFor(name);
  const parts = name.trim().split(/\s+/);
  const initials = (parts[0]?.[0] || "?") + (parts[1]?.[0] || "");
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: bg, color: fg,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      fontWeight: 700, fontSize: size * 0.38, letterSpacing: ".02em",
      boxShadow: ring ? "0 0 0 2px var(--paper-2), 0 0 0 3.5px " + bg : "none",
    }}>{initials.toUpperCase()}</div>
  );
}

// ---------------- Segmented control ----------------
function Segmented({ options, value, onChange, full = false, size = "md" }) {
  const pad = size === "sm" ? "7px 12px" : "10px 16px";
  const fs = size === "sm" ? 13 : 14;
  return (
    <div style={{
      display: full ? "grid" : "inline-grid",
      gridTemplateColumns: `repeat(${options.length}, 1fr)`,
      gap: 4, padding: 4, background: "rgba(34,28,21,.06)", borderRadius: "var(--r-pill)",
      width: full ? "100%" : "auto",
    }}>
      {options.map((o) => {
        const v = o.value ?? o;
        const label = o.label ?? o;
        const active = v === value;
        return (
          <button key={v} onClick={() => onChange(v)} style={{
            border: "none", background: active ? "var(--paper-2)" : "transparent",
            color: active ? "var(--ink)" : "var(--ink-2)",
            fontWeight: active ? 700 : 600, fontSize: fs, padding: pad,
            borderRadius: "var(--r-pill)", transition: "all .18s var(--ease)",
            boxShadow: active ? "var(--shadow-sm)" : "none", whiteSpace: "nowrap",
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
          }}>{label}</button>
        );
      })}
    </div>
  );
}

// ---------------- Stepper ----------------
function Stepper({ value, onChange, min = 0, max = 99 }) {
  const btn = (dir, dis, ic) => (
    <button onClick={() => !dis && onChange(value + dir)} disabled={dis} style={{
      width: 34, height: 34, borderRadius: "50%", border: "1.5px solid var(--line-2)",
      background: "var(--paper-3)", color: dis ? "var(--ink-3)" : "var(--ink)",
      display: "flex", alignItems: "center", justifyContent: "center",
      opacity: dis ? .5 : 1, transition: "all .15s",
    }}><Icon name={ic} size={16} stroke={2.2} /></button>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      {btn(-1, value <= min, "minus")}
      <span className="tnum" style={{ minWidth: 22, textAlign: "center", fontWeight: 700, fontSize: 17 }}>{value}</span>
      {btn(1, value >= max, "plus")}
    </div>
  );
}

// ---------------- Bottom sheet (mobile modal) ----------------
function Sheet({ open, onClose, children, title }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: "absolute", inset: 0, zIndex: 100,
      background: "rgba(34,28,21,.42)", display: "flex", alignItems: "flex-end",
      animation: "flash-in .25s",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", background: "var(--paper-2)",
        borderRadius: "26px 26px 0 0", padding: "10px 20px 28px",
        boxShadow: "0 -20px 50px rgba(34,28,21,.25)",
        animation: "slide-up .34s var(--ease)", maxHeight: "88%", overflow: "auto",
      }} className="scroll">
        <div style={{ width: 40, height: 4, borderRadius: 9, background: "var(--line-2)", margin: "0 auto 16px" }} />
        {title && <h3 className="serif" style={{ fontSize: 26, marginBottom: 16 }}>{title}</h3>}
        {children}
      </div>
    </div>
  );
}

const CAT_COLOR = {
  Antipasti: "var(--clay)", Primi: "var(--amber)", Secondi: "var(--plum)",
  Contorni: "var(--olive)", Dolci: "#C77DA0", Bevande: "var(--clay-deep)",
};
function CategoryDot({ category, size = 8 }) {
  return <span style={{ width: size, height: size, borderRadius: "50%", background: CAT_COLOR[category] || "var(--ink-3)", flexShrink: 0 }} />;
}

Object.assign(window, { Icon, QR, Progress, Money, Avatar: Initial, Initial, Segmented, Stepper, Sheet, CategoryDot, CAT_COLOR, colorFor });
