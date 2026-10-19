/* ============================================================
   app.jsx — Stage: role switcher, device frames, connected
   "Tavolo live" view + event feed, and the Tweaks panel.
   ============================================================ */
const { useState: sUseState, useEffect: sUseEffect, useRef: sUseRef } = React;

const ACCENTS = {
  Terracotta: ["#C0492F", "#9C3A22", "#F3DDD3"],
  Oliva:      ["#5E6B47", "#475234", "#E2E6D7"],
  Prugna:     ["#6B3B57", "#502941", "#EBDBE4"],
  Blu:        ["#2E6081", "#214862", "#D7E6F0"],
};

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "Terracotta",
  "displayFont": "Instrument Serif",
  "scenario": "active"
}/*EDITMODE-END*/;

// ---------------- scaling wrapper ----------------
function Fit({ w, h, max = 1, padding = 44, children }) {
  const ref = sUseRef(null);
  const [scale, setScale] = sUseState(0.6);
  sUseEffect(() => {
    const el = ref.current; if (!el) return;
    const measure = () => {
      const aw = el.clientWidth - padding * 2;
      const ah = el.clientHeight - padding * 2;
      setScale(Math.max(0.2, Math.min(max, aw / w, ah / h)));
    };
    const ro = new ResizeObserver(measure); ro.observe(el); measure();
    return () => ro.disconnect();
  }, [w, h, padding, max]);
  return (
    <div ref={ref} style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <div style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: "center", flexShrink: 0 }}>{children}</div>
    </div>
  );
}

// ---------------- tablet frame ----------------
function TabletFrame({ width = 1000, height = 680, children }) {
  return (
    <div style={{ width, height, borderRadius: 30, background: "#211d18", padding: 13, boxShadow: "var(--shadow-lg)", position: "relative" }}>
      <div style={{ position: "absolute", top: "50%", left: 6, transform: "translateY(-50%)", width: 6, height: 7, borderRadius: 4, background: "#3a352d" }} />
      <div style={{ width: "100%", height: "100%", borderRadius: 19, overflow: "hidden", background: "var(--paper)", position: "relative" }}>{children}</div>
    </div>
  );
}

// ---------------- live toast (real-time signal) ----------------
function LiveToast({ event }) {
  const [show, setShow] = sUseState(false);
  const last = sUseRef(null);
  sUseEffect(() => {
    if (event && event.id !== last.current) {
      last.current = event.id; setShow(true);
      const t = setTimeout(() => setShow(false), 2600);
      return () => clearTimeout(t);
    }
  }, [event]);
  if (!show || !event) return null;
  return (
    <div style={{
      position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)", zIndex: 80,
      display: "flex", alignItems: "center", gap: 9, padding: "9px 15px",
      background: "var(--ink)", color: "var(--paper-2)", borderRadius: 99,
      boxShadow: "var(--shadow-lg)", fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap",
      animation: "slide-up .3s var(--ease)", maxWidth: "92%",
    }}>
      <span className="live-dot" style={{ background: "var(--q-teal, #1ab197)" }} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{event.actor} · {event.label}</span>
    </div>
  );
}

// ---------------- event feed ----------------
const relTime = (ts) => {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s fa`;
  const m = Math.round(s / 60); if (m < 60) return `${m} min fa`;
  return `${Math.round(m / 60)}h fa`;
};
const EVENT_ICON = {
  SESSION_OPEN: "table", SESSION_MODE_SET: "split", ORDER_UPDATED: "book",
  PAYMENT_UPDATED: "euro", DINER_JOINED: "users", SESSION_CLOSED: "check",
};
function EventFeed({ store }) {
  const { state } = store;
  const table = sel.tableByNumber(state, 7);
  // find any session on table 7, even closed
  let sid = table && table.sessionId;
  if (!sid) { const closed = Object.values(state.sessions).find((s) => s.tableId === (table && table.id)); sid = closed && closed.id; }
  const events = sid ? sel.events(state, sid) : [];
  return (
    <div style={{ width: 300, height: 680, background: "var(--paper-2)", border: "1px solid var(--line)", borderRadius: 20, display: "flex", flexDirection: "column", boxShadow: "var(--shadow-md)", overflow: "hidden" }}>
      <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 9 }}>
        <span className="live-dot" />
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Eventi in tempo reale</div>
          <div style={{ fontSize: 11, color: "var(--ink-3)" }}>WebSocket · /topic/session</div>
        </div>
      </div>
      <div className="scroll" style={{ flex: 1, overflow: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {events.map((e, i) => (
          <div key={e.id} className={i === 0 ? "pop" : ""} style={{ display: "flex", gap: 11 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: e.type === "PAYMENT_UPDATED" ? "var(--olive-tint)" : "var(--accent-tint)", color: e.type === "PAYMENT_UPDATED" ? "var(--olive-deep)" : "var(--accent-deep)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name={EVENT_ICON[e.type] || "bell"} size={15} />
              </div>
              {i < events.length - 1 && <div style={{ flex: 1, width: 1.5, background: "var(--line)", marginTop: 4, minHeight: 12 }} />}
            </div>
            <div style={{ paddingBottom: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.25 }}>{e.label}</div>
              <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 }}>{e.actor} · {relTime(e.ts)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------- top bar ----------------
const ROLES = [
  { id: "customer", label: "Cliente", icon: "users" },
  { id: "waiter", label: "Cameriere", icon: "chef" },
  { id: "admin", label: "Ristoratore", icon: "settings" },
  { id: "live", label: "Tavolo live", icon: "split" },
];
function TopBar({ role, setRole, store }) {
  return (
    <div style={{ height: 62, flexShrink: 0, background: "var(--paper-2)", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 16, padding: "0 20px", position: "relative", zIndex: 30 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="euro" size={19} stroke={2} />
        </div>
        <div style={{ lineHeight: 1.1 }}>
          <div className="serif" style={{ fontSize: 17, whiteSpace: "nowrap" }}>Trattoria del Borgo</div>
          <div style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: ".1em", textTransform: "uppercase", whiteSpace: "nowrap" }}>Pagamenti al tavolo</div>
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
        <div style={{ display: "flex", gap: 4, padding: 4, background: "rgba(34,28,21,.05)", borderRadius: 99 }}>
          {ROLES.map((r) => (
            <button key={r.id} onClick={() => setRole(r.id)} style={{
              border: "none", display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 99,
              background: role === r.id ? "var(--paper-2)" : "transparent", color: role === r.id ? "var(--ink)" : "var(--ink-2)",
              fontWeight: role === r.id ? 700 : 600, fontSize: 13.5, boxShadow: role === r.id ? "var(--shadow-sm)" : "none",
              transition: "all .18s var(--ease)",
            }}><Icon name={r.icon} size={16} /> {r.label}</button>
          ))}
        </div>
      </div>
      <button className="btn btn--ghost" style={{ padding: "9px 15px", fontSize: 13 }} onClick={store.reset}>
        <Icon name="refresh" size={15} /> Reset
      </button>
    </div>
  );
}

// ---------------- stage ----------------
function Stage({ role, store, event }) {
  if (role === "customer") {
    return (
      <Fit w={384} h={812} max={1.05}>
        <div style={{ position: "relative" }}>
          <IOSDevice width={384} height={812}><CustomerApp tableNumber={7} /></IOSDevice>
          <LiveToast event={event} />
        </div>
      </Fit>
    );
  }
  if (role === "waiter") {
    return (
      <Fit w={1000} h={680} max={1}>
        <div style={{ position: "relative" }}>
          <TabletFrame width={1000} height={680}><WaiterApp /></TabletFrame>
          <LiveToast event={event} />
        </div>
      </Fit>
    );
  }
  if (role === "admin") {
    return (
      <Fit w={1180} h={720} max={1}>
        <ChromeWindow width={1180} height={720} url="borgo.app/admin" tabs={[{ title: "Trattoria del Borgo · Admin" }]}>
          <AdminApp />
        </ChromeWindow>
      </Fit>
    );
  }
  // live: phone + tablet + feed
  return (
    <Fit w={1748} h={812} max={0.92} padding={36}>
      <div style={{ display: "flex", alignItems: "center", gap: 28, height: "100%" }}>
        <div style={{ position: "relative" }}>
          <span className="pill-label">Cliente · mobile</span>
          <IOSDevice width={384} height={812}><CustomerApp tableNumber={7} /></IOSDevice>
          <LiveToast event={event} />
        </div>
        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 16 }}>
          <span className="pill-label">Cameriere · tablet</span>
          <TabletFrame width={1000} height={680}><WaiterApp /></TabletFrame>
        </div>
        <div style={{ position: "relative" }}>
          <span className="pill-label">Backend</span>
          <EventFeed store={store} />
        </div>
      </div>
    </Fit>
  );
}

// ---------------- root ----------------
function Root() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  return (
    <StoreProvider>
      <AppInner t={t} setTweak={setTweak} />
    </StoreProvider>
  );
}

function AppInner({ t, setTweak }) {
  const store = useStore();
  const [role, setRole] = sUseState("live");
  const prevScenario = sUseRef(t.scenario);

  // apply scenario tweak
  sUseEffect(() => {
    if (t.scenario !== prevScenario.current) {
      prevScenario.current = t.scenario;
      store.loadScenario(t.scenario);
    }
  }, [t.scenario]);

  const accent = ACCENTS[t.accent] || ACCENTS.Terracotta;
  const rootStyle = {
    "--accent": accent[0], "--accent-deep": accent[1], "--accent-tint": accent[2],
    "--serif": t.displayFont === "Hanken Grotesque" ? "'Hanken Grotesque', sans-serif" : "'Instrument Serif', Georgia, serif",
    height: "100vh", display: "flex", flexDirection: "column",
  };

  return (
    <div style={rootStyle}>
      <TopBar role={role} setRole={setRole} store={store} />
      <div className="paper-grain" style={{ flex: 1, position: "relative", minHeight: 0 }}>
        <Stage role={role} store={store} event={store.lastEvent} />
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Aspetto" />
        <TweakColor label="Accento" value={t.accent ? ACCENTS[t.accent] : ACCENTS.Terracotta}
          options={Object.values(ACCENTS)}
          onChange={(v) => { const name = Object.keys(ACCENTS).find((k) => ACCENTS[k][0] === v[0]) || "Terracotta"; setTweak("accent", name); }} />
        <TweakRadio label="Carattere titoli" value={t.displayFont}
          options={["Instrument Serif", "Hanken Grotesque"]}
          onChange={(v) => setTweak("displayFont", v)} />
        <TweakSection label="Scenario del tavolo" />
        <TweakSelect label="Stato Tavolo 7" value={t.scenario}
          options={[
            { value: "active", label: "Attivo · alla romana (1/4 pagato)" },
            { value: "fresh", label: "Nuovo · scegli modalità" },
            { value: "almost", label: "Quasi saldato (3/4 pagato)" },
          ]}
          onChange={(v) => setTweak("scenario", v)} />
        <p style={{ fontSize: 11.5, color: "var(--ink-3)", padding: "4px 2px 0", lineHeight: 1.5 }}>
          Suggerimento: apri “Tavolo live”, aggiungi un piatto dal tablet del cameriere e guardalo comparire sul telefono del cliente in tempo reale.
        </p>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Root />);
