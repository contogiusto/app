/* ============================================================
   customer.jsx — Cliente (mobile, QR access)
   Priority flow: join table -> (choose mode if first) -> pay
   your share "alla romana" online or "alla cassa".
   Export to window: CustomerApp
   ============================================================ */
const { useState: cUseState, useMemo: cUseMemo, useEffect: cUseEffect, useRef: cUseRef } = React;

function CustomerApp({ tableNumber = 7 }) {
  const store = useStore();
  const { state } = store;
  const table = sel.tableByNumber(state, tableNumber);
  const session = table && table.sessionId ? sel.session(state, table.sessionId) : null;
  const sid = session ? session.id : null;

  const [screen, setScreen] = cUseState("welcome");
  const [first, setFirst] = cUseState("");
  const [last, setLast] = cUseState("");
  const [meId, setMeId] = cUseState(null);
  const meName = meId ? (sel.diners(state, sid).find((d) => d.id === meId)?.nickname || `${first} ${last}`) : `${first} ${last}`;

  const orders = sid ? sel.orders(state, sid) : [];
  const diners = sid ? sel.diners(state, sid) : [];
  const payments = sid ? sel.payments(state, sid) : [];
  const total = sid ? sel.total(state, sid) : 0;
  const quota = sid ? sel.quota(state, sid) : 0;
  const myPayment = payments.find((p) => p.customerNickname === meName);

  // OWN selection
  const [own, setOwn] = cUseState({});
  const ownTotal = cUseMemo(() =>
    Object.entries(own).reduce((a, [oid, q]) => {
      const o = orders.find((x) => x.id === oid); const mi = o && sel.menuItem(state, o.menuItemId);
      return a + (mi ? mi.price * q : 0);
    }, 0), [own, orders, state]);

  // card form
  const [card, setCard] = cUseState({ num: "", exp: "", cvc: "" });
  const payAmount = session?.paymentMode === "OWN" ? ownTotal : quota;

  // auto-advance when session closes
  cUseEffect(() => {
    if (session && session.status === "CLOSED" && (screen === "table")) setScreen("settled");
  }, [session?.status]);

  // ---- screens ----
  if (!session) {
    return <CenterMsg icon="table" title="Tavolo libero" body={`Il tavolo ${tableNumber} non ha una sessione aperta. Chiedi al cameriere di aprirne una.`} />;
  }

  const join = () => {
    const name = `${first.trim()} ${last.trim()}`.trim();
    const id = store.joinDiner(sid, name);
    setMeId(id);
    const amFirst = sel.diners(state, sid).length === 0;
    if (!session.paymentMode) setScreen("mode");
    else setScreen("table");
  };

  // ============ WELCOME ============
  if (screen === "welcome") {
    return (
      <Screen>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 26px" }}>
          <div className="stagger">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 22 }}>
              <Icon name="pin" size={16} style={{ color: "var(--accent)" }} />
              <span className="eyebrow">{state.restaurant.name} · {state.restaurant.city}</span>
            </div>
            <h1 className="serif" style={{ fontSize: 46, lineHeight: .98, marginBottom: 14 }}>
              Benvenuto<br />al Tavolo {tableNumber}.
            </h1>
            <p style={{ color: "var(--ink-2)", fontSize: 16, lineHeight: 1.45, marginBottom: 30 }}>
              Hai scansionato il QR del tavolo. Inserisci il tuo nome per vedere gli ordini in tempo reale e pagare la tua parte.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="field-label">Nome</label>
                <input className="field" placeholder="Es. Anna" value={first} onChange={(e) => setFirst(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Cognome</label>
                <input className="field" placeholder="Es. Russo" value={last} onChange={(e) => setLast(e.target.value)} />
              </div>
            </div>
          </div>
        </div>
        <Footer>
          <button className="btn btn--block btn--lg" disabled={!first.trim() || !last.trim()} onClick={join}>
            Entra al tavolo <Icon name="arrow" size={18} />
          </button>
        </Footer>
      </Screen>
    );
  }

  // ============ CHOOSE MODE (first person) ============
  if (screen === "mode") {
    const ModeCard = ({ mode, title, sub, icon, lines }) => (
      <button onClick={() => { store.setMode(sid, mode, meName); setScreen("table"); }} className="card" style={{
        textAlign: "left", padding: 20, display: "flex", flexDirection: "column", gap: 12, cursor: "pointer",
        border: "1.5px solid var(--line)", background: "var(--paper-3)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 46, height: 46, borderRadius: 14, background: "var(--accent-tint)", color: "var(--accent-deep)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name={icon} size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: 18 }}>{title}</h3>
            <p style={{ fontSize: 13, color: "var(--ink-3)" }}>{sub}</p>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {lines.map((l, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "var(--ink-2)" }}>
              <Icon name="check" size={14} style={{ color: "var(--olive)" }} /> {l}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--accent)", fontWeight: 700, fontSize: 14, marginTop: 2 }}>
          Scegli <Icon name="arrow" size={16} />
        </div>
      </button>
    );
    return (
      <Screen>
        <Head title="Come dividiamo?" sub="Sei il primo del tavolo: scegli per tutti come dividere il conto." />
        <Body>
          <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <ModeCard mode="ROMANA" title="Alla romana" sub="Conto diviso in parti uguali" icon="split"
              lines={[`Totale ÷ ${session.coperti} coperti`, "Veloce e senza pensieri", "Ognuno paga la stessa quota"]} />
            <ModeCard mode="OWN" title="Il proprio conto" sub="Ognuno paga ciò che ha consumato" icon="receipt"
              lines={["Selezioni i tuoi piatti", "Pago solo il mio", "Ideale se avete ordinato diverso"]} />
          </div>
          <p style={{ fontSize: 12.5, color: "var(--ink-3)", textAlign: "center", marginTop: 20, lineHeight: 1.5 }}>
            La modalità vale per tutto il tavolo. Il <b>metodo</b> (online o alla cassa) lo sceglie ognuno.
          </p>
        </Body>
      </Screen>
    );
  }

  // ============ TABLE HUB ============
  if (screen === "table") {
    const mode = session.paymentMode;
    const progress = sel.progress(state, sid);
    const paidLabel = mode === "OWN"
      ? `${fmt(sel.committedAmount(state, sid))} di ${fmt(total)}`
      : `${sel.commitments(state, sid)} di ${session.coperti} quote saldate`;
    return (
      <Screen>
        <Head
          title={`Tavolo ${tableNumber}`}
          sub={<span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><span className="live-dot" /> Aggiornamenti in tempo reale</span>}
          right={<Initial name={meName} size={38} />}
        />
        <Body>
          {/* table progress */}
          <div className="card pop" style={{ padding: 18, marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
              <span className="eyebrow">Pagamento del tavolo</span>
              <span className="chip chip--olive" style={{ fontSize: 11 }}>{Math.round(progress * 100)}%</span>
            </div>
            <Progress value={progress} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 13 }}>
              <span style={{ color: "var(--ink-2)" }}>{paidLabel}</span>
              <span style={{ color: "var(--ink-3)" }}>{mode === "ROMANA" ? "Alla romana" : "Proprio conto"}</span>
            </div>
            {/* diners */}
            <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
              {diners.map((d) => {
                const paid = payments.find((p) => p.customerNickname === d.nickname);
                return (
                  <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 11px 5px 5px", background: "var(--paper-3)", border: "1px solid var(--line)", borderRadius: 99 }}>
                    <Initial name={d.nickname} size={24} />
                    <span style={{ fontSize: 12.5, fontWeight: 600 }}>{d.nickname.split(" ")[0]}</span>
                    {paid && <Icon name={paid.status === "CONFIRMED" ? "check" : "clock"} size={13} style={{ color: paid.status === "CONFIRMED" ? "var(--olive)" : "var(--amber)" }} />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* my share / paid state */}
          {myPayment ? (
            <div className="card pop" style={{ padding: 20, marginBottom: 16, background: "var(--olive-tint)", border: "1.5px solid #C7D0B4" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--olive)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name="check" size={18} stroke={2.4} />
                </div>
                <h3 style={{ fontSize: 17, color: "var(--olive-deep)" }}>
                  {myPayment.paymentMethod === "ONLINE" ? "Quota saldata online" : "Pagherai alla cassa"}
                </h3>
              </div>
              <p style={{ fontSize: 13.5, color: "var(--olive-deep)" }}>
                {myPayment.paymentMethod === "ONLINE"
                  ? `Hai pagato ${fmt(myPayment.amount)}. Grazie!`
                  : `${fmt(myPayment.amount)} da saldare alla cassa. Il cameriere confermerà l'incasso.`}
              </p>
            </div>
          ) : (
            <div className="card pop" style={{ padding: 22, marginBottom: 16, background: "linear-gradient(150deg, var(--paper-3), var(--accent-tint))", border: "1.5px solid var(--line-2)" }}>
              <span className="eyebrow">La tua quota</span>
              <div className="serif tnum" style={{ fontSize: 50, lineHeight: 1, margin: "6px 0 4px", color: "var(--accent-deep)" }}>
                {fmt(mode === "ROMANA" ? quota : 0)}
                {mode === "OWN" && <span style={{ fontSize: 18 }}> da definire</span>}
              </div>
              <p style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 18 }}>
                {mode === "ROMANA"
                  ? `Totale ${fmt(total)} ÷ ${session.coperti} coperti`
                  : "Seleziona i piatti che hai consumato"}
              </p>
              <button className="btn btn--block btn--lg" onClick={() => setScreen(mode === "OWN" ? "own" : "method")}>
                {mode === "OWN" ? "Scegli i tuoi piatti" : "Paga la tua quota"} <Icon name="arrow" size={18} />
              </button>
            </div>
          )}

          {/* orders */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "4px 2px 10px" }}>
            <span className="eyebrow">Ordini al tavolo</span>
            <span style={{ fontSize: 12.5, color: "var(--ink-3)" }} className="tnum">{orders.reduce((a, o) => a + o.quantity, 0)} piatti · {fmt(total)}</span>
          </div>
          <div className="card" style={{ overflow: "hidden" }}>
            {orders.map((o, i) => {
              const mi = sel.menuItem(state, o.menuItemId);
              return (
                <div key={o.id} className="pop" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderTop: i ? "1px solid var(--line)" : "none" }}>
                  <span className="tnum" style={{ fontWeight: 700, fontSize: 14, color: "var(--accent)", minWidth: 22 }}>{o.quantity}×</span>
                  <CategoryDot category={mi?.category} />
                  <span style={{ flex: 1, fontSize: 14.5 }}>{mi?.name}</span>
                  <Money cents={(mi?.price || 0) * o.quantity} style={{ fontSize: 13.5, color: "var(--ink-2)" }} />
                </div>
              );
            })}
          </div>
          <div style={{ height: 8 }} />
        </Body>
      </Screen>
    );
  }

  // ============ OWN: select dishes ============
  if (screen === "own") {
    return (
      <Screen>
        <Head title="I tuoi piatti" sub="Seleziona cosa hai consumato. Le quantità già coperte da altri sono escluse." back={() => setScreen("table")} />
        <Body>
          <div className="card" style={{ overflow: "hidden" }}>
            {orders.map((o, i) => {
              const mi = sel.menuItem(state, o.menuItemId);
              const covered = sel.coveredQty(state, sid, o.id);
              const remaining = o.quantity - covered;
              const claimed = own[o.id] || 0;
              if (remaining <= 0) return null;
              return (
                <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderTop: i ? "1px solid var(--line)" : "none" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 600 }}>{mi?.name}</div>
                    <div style={{ fontSize: 12.5, color: "var(--ink-3)" }} className="tnum">{fmt(mi?.price)} · {remaining} disp.</div>
                  </div>
                  <Stepper value={claimed} min={0} max={remaining} onChange={(v) => setOwn({ ...own, [o.id]: v })} />
                </div>
              );
            })}
          </div>
        </Body>
        <Footer>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, fontSize: 15 }}>
            <span style={{ color: "var(--ink-2)" }}>Il tuo totale</span>
            <Money cents={ownTotal} style={{ fontWeight: 700, fontSize: 18 }} />
          </div>
          <button className="btn btn--block btn--lg" disabled={ownTotal <= 0} onClick={() => setScreen("method")}>
            Continua <Icon name="arrow" size={18} />
          </button>
        </Footer>
      </Screen>
    );
  }

  // ============ PAYMENT METHOD ============
  if (screen === "method") {
    const MethodCard = ({ method, title, sub, icon, onClick }) => (
      <button onClick={onClick} className="card" style={{ textAlign: "left", padding: 18, display: "flex", alignItems: "center", gap: 14, cursor: "pointer", background: "var(--paper-3)" }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: method === "ONLINE" ? "var(--accent-tint)" : "var(--amber-tint)", color: method === "ONLINE" ? "var(--accent-deep)" : "#7a5908", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name={icon} size={24} />
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: 16.5 }}>{title}</h3>
          <p style={{ fontSize: 13, color: "var(--ink-3)" }}>{sub}</p>
        </div>
        <Icon name="arrow" size={18} style={{ color: "var(--ink-3)" }} />
      </button>
    );
    return (
      <Screen>
        <Head title="Come paghi?" sub={`La tua quota è ${fmt(payAmount)}`} back={() => setScreen(session.paymentMode === "OWN" ? "own" : "table")} />
        <Body>
          <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <MethodCard method="ONLINE" title="Paga online" sub="Carta · pagamento immediato" icon="card" onClick={() => setScreen("card")} />
            <MethodCard method="CASH" title="Pago alla cassa" sub="Lo confermerà il cameriere" icon="cash"
              onClick={() => { store.createPayment({ sessionId: sid, amount: payAmount, mode: session.paymentMode, paymentMethod: "CASH", customerNickname: meName, items: ownItems(own) }); setScreen("table"); }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", marginTop: 22, color: "var(--ink-3)", fontSize: 12 }}>
            <Icon name="lock" size={13} /> Pagamento simulato · nessun addebito reale
          </div>
        </Body>
      </Screen>
    );
  }

  // ============ CARD FORM ============
  if (screen === "card") {
    const valid = card.num.replace(/\s/g, "").length >= 16 && card.exp.length >= 4 && card.cvc.length >= 3;
    const fmtNum = (v) => v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
    const fmtExp = (v) => v.replace(/\D/g, "").slice(0, 4).replace(/(.{2})(.+)/, "$1/$2");
    return (
      <Screen>
        <Head title="Pagamento" sub={`Importo: ${fmt(payAmount)}`} back={() => setScreen("method")} />
        <Body>
          <div className="card" style={{ padding: 18, marginBottom: 18, background: "var(--ink)", color: "var(--paper-2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
              <Icon name="card" size={26} />
              <span className="eyebrow" style={{ color: "rgba(255,255,255,.5)" }}>Carta</span>
            </div>
            <div className="tnum" style={{ fontSize: 19, letterSpacing: ".12em", marginBottom: 16 }}>
              {card.num || "•••• •••• •••• ••••"}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "rgba(255,255,255,.7)" }}>
              <span>{meName.toUpperCase()}</span>
              <span className="tnum">{card.exp || "MM/AA"}</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label className="field-label">Numero carta</label>
              <input className="field tnum" inputMode="numeric" placeholder="4242 4242 4242 4242" value={card.num} onChange={(e) => setCard({ ...card, num: fmtNum(e.target.value) })} />
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label className="field-label">Scadenza</label>
                <input className="field tnum" inputMode="numeric" placeholder="12/27" value={card.exp} onChange={(e) => setCard({ ...card, exp: fmtExp(e.target.value) })} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="field-label">CVC</label>
                <input className="field tnum" inputMode="numeric" placeholder="123" value={card.cvc} maxLength={4} onChange={(e) => setCard({ ...card, cvc: e.target.value.replace(/\D/g, "") })} />
              </div>
            </div>
          </div>
        </Body>
        <Footer>
          <button className="btn btn--block btn--lg" disabled={!valid} onClick={() => { setScreen("processing"); setTimeout(() => {
            store.createPayment({ sessionId: sid, amount: payAmount, mode: session.paymentMode, paymentMethod: "ONLINE", customerNickname: meName, items: ownItems(own) });
            setScreen("table");
          }, 1700); }}>
            <Icon name="lock" size={16} /> Paga {fmt(payAmount)}
          </button>
        </Footer>
      </Screen>
    );
  }

  // ============ PROCESSING ============
  if (screen === "processing") {
    return (
      <Screen>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24 }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", border: "3px solid var(--accent-tint)", borderTopColor: "var(--accent)", animation: "coin-spin .9s linear infinite" }} />
          <div style={{ textAlign: "center" }}>
            <h3 className="serif" style={{ fontSize: 24 }}>Elaborazione…</h3>
            <p style={{ color: "var(--ink-3)", fontSize: 14, marginTop: 4 }}>Stiamo confermando il pagamento</p>
          </div>
        </div>
      </Screen>
    );
  }

  // ============ SETTLED (session closed) ============
  if (screen === "settled") {
    return (
      <Screen>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, padding: "0 30px", textAlign: "center" }}>
          <div style={{ width: 76, height: 76, borderRadius: "50%", background: "var(--olive)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", animation: "pop-in .5s var(--ease)" }}>
            <Icon name="check" size={42} stroke={2.6} />
          </div>
          <h1 className="serif" style={{ fontSize: 38, lineHeight: 1 }}>Tavolo saldato</h1>
          <p style={{ color: "var(--ink-2)", fontSize: 15.5, lineHeight: 1.5 }}>
            Tutti hanno pagato la propria parte. Grazie per aver cenato da {state.restaurant.name}!
          </p>
          {myPayment && (
            <div className="chip chip--olive" style={{ marginTop: 4 }}>
              La tua quota: {fmt(myPayment.amount)} · {myPayment.paymentMethod === "ONLINE" ? "Online" : "Cassa"}
            </div>
          )}
        </div>
      </Screen>
    );
  }

  return null;
}

function ownItems(own) {
  return Object.entries(own).filter(([, q]) => q > 0).map(([orderItemId, quantity]) => ({ orderItemId, quantity }));
}

// ---- layout shells (mobile) ----
function Screen({ children }) {
  return <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--paper)" }} className="paper-grain">{children}</div>;
}
function Head({ title, sub, right, back }) {
  return (
    <div style={{ padding: "8px 22px 14px", borderBottom: "1px solid var(--line)", background: "var(--paper-2)" }}>
      {back && (
        <button onClick={back} style={{ border: "none", background: "transparent", color: "var(--ink-2)", display: "flex", alignItems: "center", gap: 4, fontSize: 14, fontWeight: 600, padding: "0 0 8px", marginLeft: -4 }}>
          <Icon name="arrow" size={16} style={{ transform: "rotate(180deg)" }} /> Indietro
        </button>
      )}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 className="serif" style={{ fontSize: 32, lineHeight: 1 }}>{title}</h1>
          {sub && <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 5 }}>{sub}</div>}
        </div>
        {right}
      </div>
    </div>
  );
}
function Body({ children }) {
  return <div className="scroll" style={{ flex: 1, overflow: "auto", padding: "16px 18px 20px" }}>{children}</div>;
}
function Footer({ children }) {
  return <div style={{ padding: "14px 18px calc(14px + env(safe-area-inset-bottom))", borderTop: "1px solid var(--line)", background: "var(--paper-2)" }}>{children}</div>;
}
function CenterMsg({ icon, title, body }) {
  return (
    <Screen>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: "0 36px", textAlign: "center" }}>
        <div style={{ width: 60, height: 60, borderRadius: 18, background: "var(--paper-3)", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-3)" }}>
          <Icon name={icon} size={28} />
        </div>
        <h2 className="serif" style={{ fontSize: 26 }}>{title}</h2>
        <p style={{ color: "var(--ink-2)", fontSize: 14.5, lineHeight: 1.5 }}>{body}</p>
      </div>
    </Screen>
  );
}

Object.assign(window, { CustomerApp });
