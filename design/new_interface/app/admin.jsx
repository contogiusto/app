/* ============================================================
   admin.jsx — Ristoratore (desktop)
   Menu CRUD (name, price, category, availability) +
   table management (create, view QR, regenerate).
   Export to window: AdminApp
   ============================================================ */
const { useState: aUseState } = React;

function AdminApp() {
  const store = useStore();
  const { state } = store;
  const [nav, setNav] = aUseState("menu");

  return (
    <div style={{ height: "100%", display: "flex", background: "var(--paper)" }} className="paper-grain">
      {/* sidebar */}
      <div style={{ width: 226, background: "var(--ink)", color: "var(--paper-2)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "22px 22px 18px", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
          <div className="serif" style={{ fontSize: 21, lineHeight: 1.05 }}>{state.restaurant.name}</div>
          <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.45)", marginTop: 3, letterSpacing: ".04em" }}>PANNELLO RISTORATORE</div>
        </div>
        <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 4 }}>
          {[["menu", "book", "Menù"], ["tables", "qr", "Tavoli & QR"]].map(([id, ic, label]) => (
            <button key={id} onClick={() => setNav(id)} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 11, border: "none",
              background: nav === id ? "rgba(255,255,255,.1)" : "transparent",
              color: nav === id ? "#fff" : "rgba(255,255,255,.62)", fontSize: 14.5, fontWeight: 600, textAlign: "left",
            }}><Icon name={ic} size={19} /> {label}</button>
          ))}
        </div>
        <div style={{ marginTop: "auto", padding: 16, borderTop: "1px solid rgba(255,255,255,.08)", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}>AR</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>admin</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,.45)" }}>Amministratore</div>
          </div>
          <Icon name="logout" size={17} style={{ color: "rgba(255,255,255,.45)" }} />
        </div>
      </div>

      {/* content */}
      <div className="scroll" style={{ flex: 1, overflow: "auto" }}>
        {nav === "menu" ? <MenuAdmin store={store} state={state} /> : <TablesAdmin store={store} state={state} />}
      </div>
    </div>
  );
}

const EMPTY_ITEM = { name: "", category: "Antipasti", price: "", available: true };
const CATS = ["Antipasti", "Primi", "Secondi", "Contorni", "Dolci", "Bevande"];

function MenuAdmin({ store, state }) {
  const [editing, setEditing] = aUseState(null); // id | 'new' | null
  const [draft, setDraft] = aUseState(EMPTY_ITEM);

  const startNew = () => { setDraft(EMPTY_ITEM); setEditing("new"); };
  const startEdit = (m) => { setDraft({ ...m, price: (m.price / 100).toFixed(2) }); setEditing(m.id); };
  const save = () => {
    const payload = { name: draft.name.trim(), category: draft.category, price: Math.round(parseFloat(draft.price || 0) * 100), available: draft.available };
    if (!payload.name || !payload.price) return;
    if (editing === "new") store.addMenuItem(payload);
    else store.updateMenuItem(editing, payload);
    setEditing(null);
  };

  const byCat = CATS.map((c) => [c, state.menu.filter((m) => m.category === c)]).filter(([, l]) => l.length);

  return (
    <div style={{ padding: "30px 38px", maxWidth: 880, margin: "0 auto" }}>
      <Header title="Menù" sub={`${state.menu.length} piatti · ${state.menu.filter((m) => !m.available).length} non disponibili`}
        action={<button className="btn" onClick={startNew}><Icon name="plus" size={17} /> Nuovo piatto</button>} />

      {byCat.map(([cat, items]) => (
        <div key={cat} style={{ marginBottom: 26 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, margin: "0 2px 10px" }}>
            <CategoryDot category={cat} size={9} />
            <span className="eyebrow">{cat}</span>
            <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
          </div>
          <div className="card" style={{ overflow: "hidden" }}>
            {items.map((m, i) => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 18px", borderTop: i ? "1px solid var(--line)" : "none", opacity: m.available ? 1 : .55 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{m.name}</div>
                  {!m.available && <span style={{ fontSize: 11.5, color: "var(--clay-deep)", fontWeight: 600 }}>Non disponibile</span>}
                </div>
                <Money cents={m.price} style={{ fontWeight: 700, fontSize: 15, minWidth: 80, textAlign: "right" }} />
                <Toggle on={m.available} onClick={() => store.toggleAvailable(m.id)} />
                <button onClick={() => startEdit(m)} className="iconbtn"><Icon name="edit" size={16} /></button>
                <button onClick={() => store.deleteMenuItem(m.id)} className="iconbtn" style={{ color: "var(--clay-deep)" }}><Icon name="trash" size={16} /></button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {editing && (
        <Modal title={editing === "new" ? "Nuovo piatto" : "Modifica piatto"} onClose={() => setEditing(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label className="field-label">Nome</label>
              <input className="field" autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Es. Tagliolini al tartufo" />
            </div>
            <div style={{ display: "flex", gap: 14 }}>
              <div style={{ flex: 1 }}>
                <label className="field-label">Categoria</label>
                <select className="field" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                  {CATS.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ width: 140 }}>
                <label className="field-label">Prezzo €</label>
                <input className="field tnum" inputMode="decimal" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value.replace(/[^\d.,]/g, "").replace(",", ".") })} placeholder="0.00" />
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", fontSize: 14.5 }}>
              <Toggle on={draft.available} onClick={() => setDraft({ ...draft, available: !draft.available })} /> Disponibile
            </label>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 26, justifyContent: "flex-end" }}>
            <button className="btn btn--ghost" onClick={() => setEditing(null)}>Annulla</button>
            <button className="btn" onClick={save} disabled={!draft.name.trim() || !draft.price}>Salva piatto</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function TablesAdmin({ store, state }) {
  const [qrTable, setQrTable] = aUseState(null);
  return (
    <div style={{ padding: "30px 38px", maxWidth: 880, margin: "0 auto" }}>
      <Header title="Tavoli & QR" sub={`${state.tables.length} tavoli · ${state.tables.filter((t) => t.sessionId).length} occupati`}
        action={<button className="btn" onClick={store.addTable}><Icon name="plus" size={17} /> Nuovo tavolo</button>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(196px, 1fr))", gap: 16 }}>
        {state.tables.map((t) => {
          const occupied = !!t.sessionId;
          return (
            <div key={t.id} className="card" style={{ padding: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700, fontSize: 15 }} className="tnum">Tavolo {t.number}</span>
                <span className={`chip ${occupied ? "chip--amber" : "chip--olive"}`} style={{ fontSize: 10.5, padding: "3px 9px" }}>{occupied ? "Occupato" : "Libero"}</span>
              </div>
              <div style={{ padding: 10, background: "var(--paper-3)", borderRadius: 12, border: "1px solid var(--line)" }}>
                <QR value={t.qrToken} size={120} />
              </div>
              <code style={{ fontSize: 11, color: "var(--ink-3)", letterSpacing: ".1em" }}>{t.qrToken}</code>
              <button className="btn btn--ghost" style={{ width: "100%", padding: "9px 12px", fontSize: 13 }} onClick={() => store.regenerateQr(t.id)}>
                <Icon name="refresh" size={15} /> Rigenera QR
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- helpers ----
function Header({ title, sub, action }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 26, gap: 16 }}>
      <div>
        <h1 className="serif" style={{ fontSize: 38, lineHeight: 1 }}>{title}</h1>
        {sub && <p style={{ color: "var(--ink-3)", fontSize: 13.5, marginTop: 7 }}>{sub}</p>}
      </div>
      {action}
    </div>
  );
}
function Toggle({ on, onClick }) {
  return (
    <button onClick={onClick} style={{ width: 42, height: 25, borderRadius: 99, border: "none", padding: 3, background: on ? "var(--olive)" : "var(--line-2)", transition: "background .2s", flexShrink: 0 }}>
      <span style={{ display: "block", width: 19, height: 19, borderRadius: "50%", background: "#fff", boxShadow: "var(--shadow-sm)", transform: on ? "translateX(17px)" : "none", transition: "transform .2s var(--ease)" }} />
    </button>
  );
}
function Modal({ title, children, onClose }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(34,28,21,.42)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: "flash-in .2s" }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: 460, maxWidth: "100%", padding: 28, animation: "pop-in .3s var(--ease)", boxShadow: "var(--shadow-lg)" }}>
        <h2 className="serif" style={{ fontSize: 26, marginBottom: 20 }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

Object.assign(window, { AdminApp });
