/* ============================================================
   waiter.jsx — Cameriere (tablet)
   Table rail -> open session (coperti) -> take orders ->
   see payment status, confirm cash, force-close.
   Export to window: WaiterApp
   ============================================================ */
const { useState: wUseState, useMemo: wUseMemo } = React;

function WaiterApp() {
  const store = useStore();
  const { state } = store;
  const [selId, setSelId] = wUseState("t7");
  const [menuOpen, setMenuOpen] = wUseState(false);
  const [coperti, setCoperti] = wUseState(2);

  const table = sel.table(state, selId);
  const session = table && table.sessionId ? sel.session(state, table.sessionId) : null;
  const sid = session ? session.id : null;

  return (
    <div style={{ height: "100%", display: "flex", background: "var(--paper)", position: "relative" }} className="paper-grain">
      {/* ---- table rail ---- */}
      <div style={{ width: 232, borderRight: "1px solid var(--line)", background: "var(--paper-2)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "20px 20px 14px", borderBottom: "1px solid var(--line)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="chef" size={18} />
            </div>
            <div>
              <div className="serif" style={{ fontSize: 17, lineHeight: 1 }}>Sala</div>
              <div style={{ fontSize: 11, color: "var(--ink-3)" }}>Cameriere · Luca</div>
            </div>
          </div>
        </div>
        <div className="scroll" style={{ flex: 1, overflow: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 7 }}>
          {state.tables.map((t) => {
            const s = t.sessionId ? sel.session(state, t.sessionId) : null;
            const open = s && s.status === "OPEN";
            const prog = open ? sel.progress(state, s.id) : 0;
            const active = t.id === selId;
            return (
              <button key={t.id} onClick={() => setSelId(t.id)} style={{
                display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 12,
                border: active ? "1.5px solid var(--accent)" : "1.5px solid transparent",
                background: active ? "var(--paper-3)" : "transparent", textAlign: "left", width: "100%",
                boxShadow: active ? "var(--shadow-sm)" : "none",
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                  background: open ? "var(--accent-tint)" : "rgba(34,28,21,.05)",
                  color: open ? "var(--accent-deep)" : "var(--ink-3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 700, fontSize: 15,
                }} className="tnum">{t.number}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>Tavolo {t.number}</div>
                  <div style={{ fontSize: 11.5, color: open ? "var(--olive-deep)" : "var(--ink-3)" }}>
                    {open ? `${s.coperti} coperti · ${Math.round(prog * 100)}%` : "Libero"}
                  </div>
                </div>
                {open && <span style={{ width: 8, height: 8, borderRadius: "50%", background: prog >= 1 ? "var(--olive)" : "var(--amber)" }} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ---- detail ---- */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {!session ? (
          <OpenSessionPane table={table} coperti={coperti} setCoperti={setCoperti}
            onOpen={() => { store.openSession(table.id, coperti); }} />
        ) : (
          <SessionDetail store={store} state={state} session={session} sid={sid} table={table}
            onAddOrder={() => setMenuOpen(true)} />
        )}
      </div>

      {/* ---- add-order sheet ---- */}
      {menuOpen && sid && (
        <MenuPicker state={state} onClose={() => setMenuOpen(false)}
          onPick={(mi) => store.addOrder(sid, mi.id, 1, "Cameriere")} />
      )}
    </div>
  );
}

function OpenSessionPane({ table, coperti, setCoperti, onOpen }) {
  if (!table) return null;
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
      <div className="card pop" style={{ padding: 36, maxWidth: 420, width: "100%", textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: 18, background: "var(--accent-tint)", color: "var(--accent-deep)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
          <Icon name="table" size={30} />
        </div>
        <span className="eyebrow">Tavolo {table.number} · Libero</span>
        <h2 className="serif" style={{ fontSize: 30, margin: "6px 0 8px" }}>Apri una sessione</h2>
        <p style={{ color: "var(--ink-2)", fontSize: 14.5, marginBottom: 26 }}>Quanti coperti a questo tavolo? Serve per dividere il conto alla romana.</p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, marginBottom: 28 }}>
          <span style={{ fontSize: 14, color: "var(--ink-3)", fontWeight: 600 }}>Coperti</span>
          <Stepper value={coperti} min={1} max={20} onChange={setCoperti} />
        </div>
        <button className="btn btn--block btn--lg" onClick={onOpen}>
          <Icon name="plus" size={18} /> Apri sessione · {coperti} coperti
        </button>
      </div>
    </div>
  );
}

function SessionDetail({ store, state, session, sid, table, onAddOrder }) {
  const orders = sel.orders(state, sid);
  const payments = sel.payments(state, sid);
  const diners = sel.diners(state, sid);
  const total = sel.total(state, sid);
  const progress = sel.progress(state, sid);
  const closed = session.status === "CLOSED";
  const mins = Math.round((Date.now() - session.openedAt) / 60000);

  return (
    <React.Fragment>
      {/* header */}
      <div style={{ padding: "18px 26px", borderBottom: "1px solid var(--line)", background: "var(--paper-2)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 className="serif" style={{ fontSize: 30 }}>Tavolo {table.number}</h1>
            <span className={`chip ${closed ? "chip--ink" : "chip--olive"}`}>
              <span className="dot" />{closed ? "Chiusa" : "Aperta"}
            </span>
            <span className="chip">{session.paymentMode === "ROMANA" ? "Alla romana" : session.paymentMode === "OWN" ? "Proprio conto" : "Modalità da scegliere"}</span>
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 7, fontSize: 13, color: "var(--ink-3)" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="users" size={14} /> {session.coperti} coperti</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="clock" size={14} /> da {mins} min</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="euro" size={14} /> {fmt(total)}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {!closed && <button className="btn btn--ghost" onClick={() => store.closeSession(sid)}>Chiudi sessione</button>}
          {!closed && <button className="btn" onClick={onAddOrder}><Icon name="plus" size={17} /> Aggiungi ordine</button>}
        </div>
      </div>

      {/* progress strip */}
      <div style={{ padding: "14px 26px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 18 }}>
        <div style={{ flex: 1 }}>
          <Progress value={progress} color={progress >= 1 ? "var(--olive)" : "var(--amber)"} />
        </div>
        <span style={{ fontSize: 13, color: "var(--ink-2)", fontWeight: 600 }} className="tnum">
          {session.paymentMode === "OWN"
            ? `${fmt(sel.committedAmount(state, sid))} / ${fmt(total)}`
            : `${sel.commitments(state, sid)} / ${session.coperti} quote`}
        </span>
      </div>

      <div className="scroll" style={{ flex: 1, overflow: "auto", padding: 26, display: "grid", gridTemplateColumns: "1.1fr .9fr", gap: 22, alignItems: "start" }}>
        {/* orders */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}><Icon name="book" size={17} style={{ color: "var(--accent)" }} /> Comanda</h3>
            <span style={{ fontSize: 12.5, color: "var(--ink-3)" }} className="tnum">{orders.reduce((a, o) => a + o.quantity, 0)} piatti</span>
          </div>
          <div className="card" style={{ overflow: "hidden" }}>
            {orders.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "var(--ink-3)", fontSize: 13.5 }}>Nessun piatto. Aggiungi dalla comanda.</div>}
            {orders.map((o, i) => {
              const mi = sel.menuItem(state, o.menuItemId);
              return (
                <div key={o.id} className="pop" style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderTop: i ? "1px solid var(--line)" : "none" }}>
                  <span className="tnum" style={{ fontWeight: 700, color: "var(--accent)", minWidth: 26 }}>{o.quantity}×</span>
                  <CategoryDot category={mi?.category} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14 }}>{mi?.name}</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{o.addedBy}</div>
                  </div>
                  <Money cents={(mi?.price || 0) * o.quantity} style={{ fontSize: 13.5, color: "var(--ink-2)" }} />
                  {!closed && <button onClick={() => store.removeOrder(sid, o.id)} style={{ border: "none", background: "transparent", color: "var(--ink-3)", padding: 4, display: "flex" }}><Icon name="close" size={16} /></button>}
                </div>
              );
            })}
            {orders.length > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 14px", borderTop: "1.5px solid var(--line-2)", background: "var(--paper-3)", fontWeight: 700 }}>
                <span>Totale</span><Money cents={total} />
              </div>
            )}
          </div>
        </div>

        {/* payments */}
        <div>
          <h3 style={{ fontSize: 15, display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}><Icon name="receipt" size={17} style={{ color: "var(--accent)" }} /> Pagamenti</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {payments.length === 0 && <div className="card" style={{ padding: 22, textAlign: "center", color: "var(--ink-3)", fontSize: 13.5 }}>Ancora nessun pagamento.</div>}
            {payments.map((p) => (
              <div key={p.id} className="card pop" style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                <Initial name={p.customerNickname} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{p.customerNickname}</div>
                  <div style={{ fontSize: 11.5, color: "var(--ink-3)", display: "flex", alignItems: "center", gap: 5 }}>
                    <Icon name={p.paymentMethod === "ONLINE" ? "card" : "cash"} size={12} />
                    {p.paymentMethod === "ONLINE" ? "Online" : "Alla cassa"}
                  </div>
                </div>
                <Money cents={p.amount} style={{ fontWeight: 700, fontSize: 14 }} />
                {p.status === "CONFIRMED"
                  ? <span className="chip chip--olive" style={{ fontSize: 11 }}><Icon name="check" size={12} /> Incassato</span>
                  : <button className="btn btn--olive" style={{ padding: "8px 13px", fontSize: 13 }} onClick={() => store.confirmPayment(p.id)}>Conferma</button>}
              </div>
            ))}
          </div>

          {/* diners awaiting */}
          {diners.length > 0 && (
            <React.Fragment>
              <h3 style={{ fontSize: 13, color: "var(--ink-3)", margin: "18px 0 10px", textTransform: "uppercase", letterSpacing: ".08em" }}>Al tavolo</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {diners.map((d) => {
                  const paid = payments.find((p) => p.customerNickname === d.nickname);
                  return (
                    <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 10px 5px 5px", background: "var(--paper-2)", border: "1px solid var(--line)", borderRadius: 99 }}>
                      <Initial name={d.nickname} size={22} />
                      <span style={{ fontSize: 12 }}>{d.nickname.split(" ")[0]}</span>
                      {paid && <Icon name={paid.status === "CONFIRMED" ? "check" : "clock"} size={12} style={{ color: paid.status === "CONFIRMED" ? "var(--olive)" : "var(--amber)" }} />}
                    </div>
                  );
                })}
              </div>
            </React.Fragment>
          )}
        </div>
      </div>
    </React.Fragment>
  );
}

function MenuPicker({ state, onClose, onPick }) {
  const [cat, setCat] = wUseState("Tutti");
  const cats = ["Tutti", ...Array.from(new Set(state.menu.map((m) => m.category)))];
  const items = state.menu.filter((m) => m.available && (cat === "Tutti" || m.category === cat));
  return (
    <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(34,28,21,.4)", zIndex: 60, display: "flex", justifyContent: "flex-end", animation: "flash-in .2s" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 420, maxWidth: "90%", height: "100%", background: "var(--paper-2)", boxShadow: "var(--shadow-lg)", display: "flex", flexDirection: "column", animation: "slide-up .3s var(--ease)" }}>
        <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 className="serif" style={{ fontSize: 22 }}>Aggiungi alla comanda</h3>
          <button onClick={onClose} style={{ border: "none", background: "rgba(34,28,21,.06)", width: 34, height: 34, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="close" size={18} /></button>
        </div>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", display: "flex", gap: 7, overflowX: "auto" }} className="scroll">
          {cats.map((c) => (
            <button key={c} onClick={() => setCat(c)} className="chip" style={{ cursor: "pointer", whiteSpace: "nowrap", background: cat === c ? "var(--ink)" : "rgba(34,28,21,.05)", color: cat === c ? "var(--paper-2)" : "var(--ink-2)" }}>{c}</button>
          ))}
        </div>
        <div className="scroll" style={{ flex: 1, overflow: "auto", padding: 12 }}>
          {items.map((mi) => (
            <button key={mi.id} onClick={() => onPick(mi)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", border: "none", background: "transparent", borderRadius: 12, textAlign: "left" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--paper-3)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
              <CategoryDot category={mi.category} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600 }}>{mi.name}</div>
                <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{mi.category}</div>
              </div>
              <Money cents={mi.price} style={{ fontSize: 13.5, color: "var(--ink-2)" }} />
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--accent-tint)", color: "var(--accent-deep)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="plus" size={16} stroke={2.4} /></div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { WaiterApp });
