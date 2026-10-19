/* ============================================================
   store.jsx — Simulated backend for the restaurant payment app.
   One shared state tree -> all three role apps read it, so a
   change in one device ripples to the others (real-time feel).
   Exports to window: StoreProvider, useStore, fmt, sel
   ============================================================ */

const { createContext, useContext, useState, useCallback, useRef, useEffect } = React;

// ---------- helpers ----------
const fmt = (cents) =>
  "€ " + (cents / 100).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

let _id = 100;
const uid = (p) => `${p}_${++_id}`;
const token = () => Math.random().toString(36).slice(2, 8).toUpperCase();
const now = () => Date.now();

// ---------- seed ----------
function seed(scenario = "active") {
  const menu = [
    { id: "m1",  name: "Tagliere del Borgo",       category: "Antipasti", price: 1400, available: true },
    { id: "m2",  name: "Burrata e pomodorini",     category: "Antipasti", price: 1100, available: true },
    { id: "m3",  name: "Vitello tonnato",          category: "Antipasti", price: 1300, available: true },
    { id: "m4",  name: "Tagliatelle al ragù",      category: "Primi",     price: 1500, available: true },
    { id: "m5",  name: "Cacio e pepe",             category: "Primi",     price: 1400, available: true },
    { id: "m6",  name: "Risotto allo zafferano",   category: "Primi",     price: 1600, available: true },
    { id: "m7",  name: "Tagliata di manzo",        category: "Secondi",   price: 2400, available: true },
    { id: "m8",  name: "Branzino al forno",        category: "Secondi",   price: 2200, available: true },
    { id: "m9",  name: "Cotoletta alla milanese",  category: "Secondi",   price: 1900, available: false },
    { id: "m10", name: "Patate al rosmarino",      category: "Contorni",  price: 600,  available: true },
    { id: "m11", name: "Insalata mista",           category: "Contorni",  price: 500,  available: true },
    { id: "m12", name: "Tiramisù della casa",      category: "Dolci",     price: 700,  available: true },
    { id: "m13", name: "Panna cotta",              category: "Dolci",     price: 650,  available: true },
    { id: "m14", name: "Acqua naturale 75cl",      category: "Bevande",   price: 300,  available: true },
    { id: "m15", name: "Vino rosso della casa",    category: "Bevande",   price: 600,  available: true },
    { id: "m16", name: "Birra artigianale",        category: "Bevande",   price: 600,  available: true },
    { id: "m17", name: "Caffè",                    category: "Bevande",   price: 200,  available: true },
  ];

  const tables = [];
  for (let n = 1; n <= 10; n++) {
    tables.push({ id: `t${n}`, number: n, qrToken: token(), sessionId: null });
  }

  // Featured live scenario: Tavolo 7, 4 coperti, ROMANA, one diner already paid
  const sid = "s_demo";
  const featured = tables.find((t) => t.number === 7);
  featured.sessionId = sid;

  const sessions = {
    [sid]: {
      id: sid, tableId: featured.id, coperti: 4,
      paymentMode: scenario === "fresh" ? null : "ROMANA", status: "OPEN",
      openedAt: now() - 1000 * 60 * 42, closedAt: null,
    },
  };

  const O = (menuItemId, quantity) => ({
    id: uid("o"), sessionId: sid, menuItemId, quantity, addedBy: "Cameriere", at: now() - 1000 * 60 * 35,
  });
  const orders = [
    O("m1", 1), O("m2", 1),
    O("m4", 2), O("m5", 1), O("m6", 1),
    O("m7", 1), O("m8", 1),
    O("m10", 1), O("m11", 1),
    O("m14", 2), O("m15", 2),
  ];

  // quota for ROMANA scenarios (total/4). Computed lazily below for almost scenario.
  const allDiners = [
    { id: "d1", sessionId: sid, nickname: "Marco Bianchi",   joinedAt: now() - 1000 * 60 * 30, isFirst: true },
    { id: "d2", sessionId: sid, nickname: "Giulia Ferrari",  joinedAt: now() - 1000 * 60 * 28, isFirst: false },
    { id: "d3", sessionId: sid, nickname: "Luca Conti",      joinedAt: now() - 1000 * 60 * 25, isFirst: false },
    { id: "d4", sessionId: sid, nickname: "Sara De Luca",    joinedAt: now() - 1000 * 60 * 22, isFirst: false },
  ];

  let diners, payments, events;
  const baseEvents = [
    { id: uid("e"), ts: now() - 1000 * 60 * 42, sessionId: sid, type: "SESSION_OPEN", actor: "Cameriere", label: `Sessione aperta · 4 coperti` },
  ];

  if (scenario === "fresh") {
    // nobody has joined yet, mode not chosen — first diner will decide
    diners = [];
    payments = [];
    events = baseEvents;
  } else if (scenario === "almost") {
    // 3 of 4 quotas already settled — one share remains
    diners = allDiners.slice(0, 3);
    const q = 4000;
    payments = [
      { id: "p1", sessionId: sid, amount: q, mode: "ROMANA", paymentMethod: "ONLINE", status: "CONFIRMED", customerNickname: "Giulia Ferrari", items: [], at: now() - 1000 * 60 * 6 },
      { id: "p2", sessionId: sid, amount: q, mode: "ROMANA", paymentMethod: "ONLINE", status: "CONFIRMED", customerNickname: "Marco Bianchi", items: [], at: now() - 1000 * 60 * 4 },
      { id: "p3", sessionId: sid, amount: q, mode: "ROMANA", paymentMethod: "CASH", status: "PENDING", customerNickname: "Luca Conti", items: [], at: now() - 1000 * 60 * 2 },
    ];
    events = [
      ...baseEvents,
      { id: uid("e"), ts: now() - 1000 * 60 * 30, sessionId: sid, type: "SESSION_MODE_SET", actor: "Marco Bianchi", label: "Modalità impostata · Alla romana" },
      { id: uid("e"), ts: now() - 1000 * 60 * 6, sessionId: sid, type: "PAYMENT_UPDATED", actor: "Giulia Ferrari", label: "Ha pagato online" },
      { id: uid("e"), ts: now() - 1000 * 60 * 4, sessionId: sid, type: "PAYMENT_UPDATED", actor: "Marco Bianchi", label: "Ha pagato online" },
      { id: uid("e"), ts: now() - 1000 * 60 * 2, sessionId: sid, type: "PAYMENT_UPDATED", actor: "Luca Conti", label: "Pagherà alla cassa" },
    ];
  } else {
    // active (default): 2 joined, Giulia paid
    diners = allDiners.slice(0, 2);
    payments = [
      { id: "p1", sessionId: sid, amount: 4000, mode: "ROMANA", paymentMethod: "ONLINE", status: "CONFIRMED", customerNickname: "Giulia Ferrari", items: [], at: now() - 1000 * 60 * 4 },
    ];
    events = [
      ...baseEvents,
      { id: uid("e"), ts: now() - 1000 * 60 * 30, sessionId: sid, type: "SESSION_MODE_SET", actor: "Marco Bianchi", label: "Modalità impostata · Alla romana" },
      { id: uid("e"), ts: now() - 1000 * 60 * 4, sessionId: sid, type: "PAYMENT_UPDATED", actor: "Giulia Ferrari", label: "Ha pagato la sua quota online" },
    ];
  }

  return { restaurant: { name: "Trattoria del Borgo", city: "Bergamo" }, menu, tables, sessions, orders, diners, payments, events };
}

// ---------- selectors ----------
const sel = {
  table: (s, tableId) => s.tables.find((t) => t.id === tableId),
  tableByNumber: (s, n) => s.tables.find((t) => t.number === n),
  session: (s, sid) => s.sessions[sid] || null,
  sessionOfTable: (s, tableId) => {
    const t = sel.table(s, tableId);
    return t && t.sessionId ? s.sessions[t.sessionId] : null;
  },
  menuItem: (s, id) => s.menu.find((m) => m.id === id),
  orders: (s, sid) => s.orders.filter((o) => o.sessionId === sid),
  diners: (s, sid) => s.diners.filter((d) => d.sessionId === sid),
  payments: (s, sid) => s.payments.filter((p) => p.sessionId === sid),
  events: (s, sid) => s.events.filter((e) => e.sessionId === sid).sort((a, b) => b.ts - a.ts),
  total: (s, sid) =>
    sel.orders(s, sid).reduce((sum, o) => {
      const mi = sel.menuItem(s, o.menuItemId);
      return sum + (mi ? mi.price * o.quantity : 0);
    }, 0),
  // ROMANA quota per head
  quota: (s, sid) => {
    const ses = s.sessions[sid];
    if (!ses || !ses.coperti) return 0;
    return Math.round(sel.total(s, sid) / ses.coperti);
  },
  committedAmount: (s, sid) => sel.payments(s, sid).reduce((a, p) => a + p.amount, 0),
  // ROMANA: commitments toward coperti
  commitments: (s, sid) => sel.payments(s, sid).length,
  // OWN: orderItem coverage map -> qty covered
  coveredQty: (s, sid, orderItemId) =>
    sel.payments(s, sid).reduce((a, p) => {
      const it = (p.items || []).find((x) => x.orderItemId === orderItemId);
      return a + (it ? it.quantity : 0);
    }, 0),
  ownFullyCovered: (s, sid) =>
    sel.orders(s, sid).every((o) => sel.coveredQty(s, sid, o.id) >= o.quantity),
  // progress 0..1
  progress: (s, sid) => {
    const ses = s.sessions[sid];
    if (!ses) return 0;
    if (ses.paymentMode === "OWN") {
      const tot = sel.total(s, sid);
      return tot ? Math.min(1, sel.committedAmount(s, sid) / tot) : 0;
    }
    return ses.coperti ? Math.min(1, sel.commitments(s, sid) / ses.coperti) : 0;
  },
};

// ---------- provider ----------
const StoreCtx = createContext(null);

function StoreProvider({ children }) {
  const [state, setState] = useState(seed);
  const [lastEvent, setLastEvent] = useState(null);

  const pushEvent = (st, sid, type, actor, label) => {
    const ev = { id: uid("e"), ts: now(), sessionId: sid, type, actor, label };
    setLastEvent(ev);
    return { ...st, events: [...st.events, ev] };
  };

  const actions = {
    // --- admin: menu ---
    addMenuItem: (item) =>
      setState((s) => ({ ...s, menu: [...s.menu, { id: uid("m"), available: true, ...item }] })),
    updateMenuItem: (id, patch) =>
      setState((s) => ({ ...s, menu: s.menu.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
    deleteMenuItem: (id) =>
      setState((s) => ({ ...s, menu: s.menu.filter((m) => m.id !== id) })),
    toggleAvailable: (id) =>
      setState((s) => ({ ...s, menu: s.menu.map((m) => (m.id === id ? { ...m, available: !m.available } : m)) })),

    // --- admin: tables ---
    addTable: () =>
      setState((s) => {
        const num = Math.max(0, ...s.tables.map((t) => t.number)) + 1;
        return { ...s, tables: [...s.tables, { id: uid("t"), number: num, qrToken: token(), sessionId: null }] };
      }),
    regenerateQr: (tableId) =>
      setState((s) => ({ ...s, tables: s.tables.map((t) => (t.id === tableId ? { ...t, qrToken: token() } : t)) })),

    // --- waiter: sessions ---
    openSession: (tableId, coperti) =>
      setState((s) => {
        const sid = uid("s");
        const session = { id: sid, tableId, coperti, paymentMode: null, status: "OPEN", openedAt: now(), closedAt: null };
        let st = {
          ...s,
          sessions: { ...s.sessions, [sid]: session },
          tables: s.tables.map((t) => (t.id === tableId ? { ...t, sessionId: sid } : t)),
        };
        st = pushEvent(st, sid, "SESSION_OPEN", "Cameriere", `Sessione aperta · ${coperti} coperti`);
        return st;
      }),
    addOrder: (sid, menuItemId, quantity, addedBy = "Cameriere") =>
      setState((s) => {
        const mi = sel.menuItem(s, menuItemId);
        // merge into existing identical line
        const existing = s.orders.find((o) => o.sessionId === sid && o.menuItemId === menuItemId);
        let orders;
        if (existing) {
          orders = s.orders.map((o) => (o.id === existing.id ? { ...o, quantity: o.quantity + quantity } : o));
        } else {
          orders = [...s.orders, { id: uid("o"), sessionId: sid, menuItemId, quantity, addedBy, at: now() }];
        }
        let st = { ...s, orders };
        st = pushEvent(st, sid, "ORDER_UPDATED", addedBy, `+${quantity} ${mi ? mi.name : "piatto"}`);
        return st;
      }),
    removeOrder: (sid, orderId) =>
      setState((s) => ({ ...s, orders: s.orders.filter((o) => o.id !== orderId) })),

    setMode: (sid, mode, actor = "Cliente") =>
      setState((s) => {
        let st = { ...s, sessions: { ...s.sessions, [sid]: { ...s.sessions[sid], paymentMode: mode } } };
        st = pushEvent(st, sid, "SESSION_MODE_SET", actor, `Modalità impostata · ${mode === "ROMANA" ? "Alla romana" : "Proprio conto"}`);
        return st;
      }),

    joinDiner: (sid, nickname) => {
      let newId;
      setState((s) => {
        const existing = s.diners.find((d) => d.sessionId === sid && d.nickname === nickname);
        if (existing) { newId = existing.id; return s; }
        newId = uid("d");
        const isFirst = sel.diners(s, sid).length === 0;
        let st = { ...s, diners: [...s.diners, { id: newId, sessionId: sid, nickname, joinedAt: now(), isFirst }] };
        st = pushEvent(st, sid, "DINER_JOINED", nickname, "Si è unito al tavolo");
        return st;
      });
      return newId;
    },

    // --- payments ---
    createPayment: ({ sessionId, amount, mode, paymentMethod, customerNickname, items = [] }) =>
      setState((s) => {
        const pay = {
          id: uid("p"), sessionId, amount, mode, paymentMethod,
          status: paymentMethod === "ONLINE" ? "CONFIRMED" : "PENDING",
          customerNickname, items, at: now(),
        };
        let st = { ...s, payments: [...s.payments, pay] };
        const verb = paymentMethod === "ONLINE" ? "Ha pagato online" : "Pagherà alla cassa";
        st = pushEvent(st, sessionId, "PAYMENT_UPDATED", customerNickname, `${verb} · ${fmt(amount)}`);
        st = maybeClose(st, sessionId);
        return st;
      }),
    confirmPayment: (paymentId) =>
      setState((s) => {
        const pay = s.payments.find((p) => p.id === paymentId);
        if (!pay) return s;
        let st = { ...s, payments: s.payments.map((p) => (p.id === paymentId ? { ...p, status: "CONFIRMED" } : p)) };
        st = pushEvent(st, pay.sessionId, "PAYMENT_UPDATED", "Cameriere", `Incasso confermato · ${pay.customerNickname}`);
        st = maybeClose(st, pay.sessionId);
        return st;
      }),

    closeSession: (sid, actor = "Cameriere") =>
      setState((s) => {
        const t = Object.values(s.tables).find((x) => x.sessionId === sid);
        let st = {
          ...s,
          sessions: { ...s.sessions, [sid]: { ...s.sessions[sid], status: "CLOSED", closedAt: now() } },
          tables: s.tables.map((x) => (x.sessionId === sid ? { ...x, sessionId: null } : x)),
        };
        st = pushEvent(st, sid, "SESSION_CLOSED", actor, "Sessione chiusa");
        return st;
      }),

    reset: () => { setState(seed()); setLastEvent(null); },
    loadScenario: (name) => { setState(seed(name)); setLastEvent(null); },
  };

  // auto-close rule
  function maybeClose(st, sid) {
    const ses = st.sessions[sid];
    if (!ses || ses.status !== "OPEN") return st;
    let done = false;
    if (ses.paymentMode === "ROMANA") {
      done = sel.commitments(st, sid) >= ses.coperti;
    } else if (ses.paymentMode === "OWN") {
      done = sel.ownFullyCovered(st, sid);
    }
    if (done) {
      st = { ...st, sessions: { ...st.sessions, [sid]: { ...ses, status: "CLOSED", closedAt: now() } } };
      st = pushEvent(st, sid, "SESSION_CLOSED", "Sistema", "Tutti hanno pagato · sessione chiusa");
      st = { ...st, tables: st.tables.map((x) => (x.sessionId === sid ? { ...x, sessionId: null } : x)) };
    }
    return st;
  }

  return (
    <StoreCtx.Provider value={{ state, ...actions, lastEvent }}>
      {children}
    </StoreCtx.Provider>
  );
}

const useStore = () => useContext(StoreCtx);

Object.assign(window, { StoreProvider, useStore, fmt, sel });
