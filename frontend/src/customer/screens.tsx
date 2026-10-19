import { useState, type ReactNode } from 'react'
import type { PaymentMode, PublicSession, PublicTable } from '../api/client'
import { parseMoney } from '../lib/money'
import { Icon, type IconName } from '../ui/Icon'
import { Body, Footer, Head, Screen } from '../ui/layout'
import { CategoryDot, Initial, Money, Progress, Stepper } from '../ui/primitives'
import { fullName, remaining, tableProgress, type Selection } from './logic'
import type { MyPayment } from './storage'

type PayMethod = 'ONLINE' | 'CASH'

function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p
      role="alert"
      style={{
        margin: '14px 0 0',
        padding: '10px 14px',
        borderRadius: 'var(--r-md)',
        background: 'var(--clay-tint)',
        color: 'var(--clay-deep)',
        fontSize: 13.5,
        fontWeight: 600,
      }}
    >
      {message}
    </p>
  )
}

// ============ BENVENUTO ============

export function Welcome({
  restaurantName,
  tableNumber,
  onJoin,
}: {
  restaurantName: string
  tableNumber: number
  onJoin: (name: string) => void
}) {
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  return (
    <Screen>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 26px' }}>
        <div className="stagger">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 22 }}>
            <Icon name="pin" size={16} style={{ color: 'var(--accent)' }} />
            <span className="eyebrow">{restaurantName}</span>
          </div>
          <h1 className="serif" style={{ fontSize: 46, lineHeight: 0.98, marginBottom: 14 }}>
            Benvenuto
            <br />
            al Tavolo {tableNumber}.
          </h1>
          <p style={{ color: 'var(--ink-2)', fontSize: 16, lineHeight: 1.45, marginBottom: 30 }}>
            Hai scansionato il QR del tavolo. Inserisci il tuo nome per vedere gli ordini e pagare
            la tua parte.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="field-label" htmlFor="first">
                Nome
              </label>
              <input
                id="first"
                className="field"
                autoComplete="given-name"
                placeholder="Es. Anna"
                value={first}
                onChange={(e) => setFirst(e.target.value)}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="last">
                Cognome
              </label>
              <input
                id="last"
                className="field"
                autoComplete="family-name"
                placeholder="Es. Russo"
                value={last}
                onChange={(e) => setLast(e.target.value)}
              />
            </div>
          </div>
        </div>
      </main>
      <Footer>
        <button
          type="button"
          className="btn btn--block btn--lg"
          disabled={!first.trim() || !last.trim()}
          onClick={() => onJoin(fullName(first, last))}
        >
          Entra al tavolo <Icon name="arrow" size={18} />
        </button>
      </Footer>
    </Screen>
  )
}

// ============ SCELTA DELLA MODALITÀ (solo il primo) ============

type ModeCardProps = {
  title: string
  sub: string
  icon: IconName
  lines: string[]
  disabled: boolean
  onClick: () => void
}

function ModeCard({ title, sub, icon, lines, disabled, onClick }: ModeCardProps) {
  return (
    <button
      type="button"
      className="card"
      disabled={disabled}
      onClick={onClick}
      style={{
        textAlign: 'left',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        cursor: 'pointer',
        border: '1.5px solid var(--line)',
        background: 'var(--paper-3)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 14,
            background: 'var(--accent-tint)',
            color: 'var(--accent-deep)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={icon} size={24} />
        </div>
        <div>
          <h3 style={{ fontSize: 18 }}>{title}</h3>
          <p style={{ fontSize: 13, color: 'var(--ink-3)' }}>{sub}</p>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {lines.map((line) => (
          <div key={line} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--ink-2)' }}>
            <Icon name="check" size={14} style={{ color: 'var(--olive)' }} /> {line}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent)', fontWeight: 700, fontSize: 14, marginTop: 2 }}>
        Scegli <Icon name="arrow" size={16} />
      </div>
    </button>
  )
}

export function ChooseMode({
  coperti,
  pending,
  error,
  onChoose,
}: {
  coperti: number
  pending: boolean
  error: string | null
  onChoose: (mode: PaymentMode) => void
}) {
  return (
    <Screen>
      <Head title="Come dividiamo?" sub="Sei il primo del tavolo: scegli per tutti come dividere il conto." />
      <Body>
        <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <ModeCard
            title="Alla romana"
            sub="Conto diviso in parti uguali"
            icon="split"
            lines={[`Totale ÷ ${coperti} coperti`, 'Veloce e senza pensieri', 'Ognuno paga la stessa quota']}
            disabled={pending}
            onClick={() => onChoose('ROMANA')}
          />
          <ModeCard
            title="Il proprio conto"
            sub="Ognuno paga ciò che ha consumato"
            icon="receipt"
            lines={['Selezioni i tuoi piatti', 'Pago solo il mio', 'Ideale se avete ordinato diverso']}
            disabled={pending}
            onClick={() => onChoose('OWN')}
          />
        </div>
        <ErrorNote message={error} />
        <p style={{ fontSize: 12.5, color: 'var(--ink-3)', textAlign: 'center', marginTop: 20, lineHeight: 1.5 }}>
          La modalità vale per tutto il tavolo. Il <b>metodo</b> (online o alla cassa) lo sceglie
          ognuno.
        </p>
      </Body>
    </Screen>
  )
}

// ============ TAVOLO (schermata principale) ============

export function Hub({
  table,
  session,
  me,
  mine,
  onPay,
  onChooseOwn,
}: {
  table: PublicTable
  session: PublicSession
  me: string
  mine: Pick<MyPayment, 'amount' | 'method'> | null
  onPay: () => void
  onChooseOwn: () => void
}) {
  const mode = session.payment_mode
  const progress = tableProgress(session)
  const total = parseMoney(session.total)
  const share = session.next_share === null ? null : parseMoney(session.next_share)
  const hasFreeItems = session.items.some((item) => remaining(item) > 0)
  const dishes = session.items.reduce((sum, item) => sum + item.quantity, 0)

  const paidLabel =
    mode === 'OWN' ? (
      <>
        <Money cents={parseMoney(session.paid_total)} /> di <Money cents={total} />
      </>
    ) : (
      `${session.payments.length} di ${session.coperti} quote saldate`
    )

  return (
    <Screen>
      <Head
        title={`Tavolo ${table.table_number}`}
        sub={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <span className="live-dot" /> Aggiornamenti automatici
          </span>
        }
        right={<Initial name={me} size={38} />}
      />
      <Body>
        <section className="card pop" style={{ padding: 18, marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <span className="eyebrow">Pagamento del tavolo</span>
            <span className="chip chip--olive" style={{ fontSize: 11 }}>
              {Math.round(progress * 100)}%
            </span>
          </div>
          <Progress value={progress} label="Avanzamento del pagamento del tavolo" />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 13 }}>
            <span style={{ color: 'var(--ink-2)' }}>{paidLabel}</span>
            <span style={{ color: 'var(--ink-3)' }}>{mode === 'ROMANA' ? 'Alla romana' : 'Proprio conto'}</span>
          </div>
          {session.payments.length > 0 && (
            <ul style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap', listStyle: 'none', padding: 0, marginBottom: 0 }}>
              {session.payments.map((payment, index) => (
                <li
                  key={`${payment.customer_nickname}-${index}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '5px 11px 5px 5px',
                    background: 'var(--paper-3)',
                    border: '1px solid var(--line)',
                    borderRadius: 99,
                  }}
                >
                  <Initial name={payment.customer_nickname} size={24} />
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>{payment.customer_nickname.split(' ')[0]}</span>
                  <Icon
                    name={payment.status === 'COMPLETED' ? 'check' : 'clock'}
                    size={13}
                    style={{ color: payment.status === 'COMPLETED' ? 'var(--olive)' : 'var(--amber)' }}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        {mine ? (
          <section
            className="card pop"
            style={{ padding: 20, marginBottom: 16, background: 'var(--olive-tint)', border: '1.5px solid #C7D0B4' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: 'var(--olive)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="check" size={18} stroke={2.4} />
              </div>
              <h3 style={{ fontSize: 17, color: 'var(--olive-deep)' }}>
                {mine.method === 'ONLINE' ? 'Quota saldata online' : 'Pagherai alla cassa'}
              </h3>
            </div>
            <p style={{ fontSize: 13.5, color: 'var(--olive-deep)' }}>
              {mine.method === 'ONLINE' ? (
                <>
                  Hai pagato <Money cents={parseMoney(mine.amount)} />. Grazie!
                </>
              ) : (
                <>
                  <Money cents={parseMoney(mine.amount)} /> da saldare alla cassa. Il cameriere
                  confermerà l’incasso.
                </>
              )}
            </p>
          </section>
        ) : (
          <section
            className="card pop"
            style={{
              padding: 22,
              marginBottom: 16,
              background: 'linear-gradient(150deg, var(--paper-3), var(--accent-tint))',
              border: '1.5px solid var(--line-2)',
            }}
          >
            <span className="eyebrow">La tua quota</span>
            <div className="serif tnum" style={{ fontSize: 50, lineHeight: 1, margin: '6px 0 4px', color: 'var(--accent-deep)' }}>
              {mode === 'ROMANA' && share !== null ? <Money cents={share} /> : null}
              {mode === 'OWN' && <span style={{ fontSize: 18 }}>da definire</span>}
              {mode === 'ROMANA' && share === null && <span style={{ fontSize: 18 }}>—</span>}
            </div>
            <QuotaAction
              mode={mode}
              total={total}
              coperti={session.coperti}
              canPayShare={share !== null}
              hasFreeItems={hasFreeItems}
              onPay={onPay}
              onChooseOwn={onChooseOwn}
            />
          </section>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 2px 10px' }}>
          <h2 className="eyebrow">Ordini al tavolo</h2>
          <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }} className="tnum">
            {dishes} piatti · <Money cents={total} />
          </span>
        </div>
        <ul className="card" style={{ overflow: 'hidden', listStyle: 'none', padding: 0, margin: 0 }}>
          {session.items.map((item, index) => (
            <li
              key={item.id}
              className="pop"
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: index ? '1px solid var(--line)' : 'none' }}
            >
              <span className="tnum" style={{ fontWeight: 700, fontSize: 14, color: 'var(--accent)', minWidth: 22 }}>
                {item.quantity}×
              </span>
              <CategoryDot category={item.category} />
              <span style={{ flex: 1, fontSize: 14.5 }}>{item.name}</span>
              <Money cents={parseMoney(item.line_total)} style={{ fontSize: 13.5, color: 'var(--ink-2)' }} />
            </li>
          ))}
        </ul>
        <div style={{ height: 8 }} />
      </Body>
    </Screen>
  )
}

function QuotaAction({
  mode,
  total,
  coperti,
  canPayShare,
  hasFreeItems,
  onPay,
  onChooseOwn,
}: {
  mode: PaymentMode | null
  total: number
  coperti: number
  canPayShare: boolean
  hasFreeItems: boolean
  onPay: () => void
  onChooseOwn: () => void
}): ReactNode {
  const note = (text: ReactNode) => (
    <p style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 18 }}>{text}</p>
  )
  const button = (label: string, onClick: () => void) => (
    <button type="button" className="btn btn--block btn--lg" onClick={onClick}>
      {label} <Icon name="arrow" size={18} />
    </button>
  )

  if (total === 0) {
    return note('Ancora nessun ordine: il conto comparirà quando il cameriere inserirà i piatti.')
  }
  if (mode === 'OWN') {
    return hasFreeItems ? (
      <>
        {note('Seleziona i piatti che hai consumato')}
        {button('Scegli i tuoi piatti', onChooseOwn)}
      </>
    ) : (
      note('Tutti i piatti sono già stati pagati.')
    )
  }
  if (!canPayShare) return note('Tutte le quote del tavolo sono già state assegnate.')
  return (
    <>
      {note(
        <>
          Totale <Money cents={total} /> ÷ {coperti} coperti
        </>,
      )}
      {button('Paga la tua quota', onPay)}
    </>
  )
}

// ============ PROPRIO CONTO: SCELTA DEI PIATTI ============

export function OwnSelect({
  items,
  selection,
  totalCents,
  onChange,
  onBack,
  onContinue,
}: {
  items: PublicSession['items']
  selection: Selection
  totalCents: number
  onChange: (itemId: number, quantity: number) => void
  onBack: () => void
  onContinue: () => void
}) {
  const free = items.filter((item) => remaining(item) > 0)
  return (
    <Screen>
      <Head
        title="I tuoi piatti"
        sub="Seleziona cosa hai consumato. Le quantità già coperte da altri sono escluse."
        onBack={onBack}
      />
      <Body>
        <ul className="card" style={{ overflow: 'hidden', listStyle: 'none', padding: 0, margin: 0 }}>
          {free.map((item, index) => (
            <li
              key={item.id}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: index ? '1px solid var(--line)' : 'none' }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600 }}>{item.name}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }} className="tnum">
                  <Money cents={parseMoney(item.unit_price)} /> · {remaining(item)} disp.
                </div>
              </div>
              <Stepper
                label={item.name}
                value={selection[item.id] ?? 0}
                min={0}
                max={remaining(item)}
                onChange={(value) => onChange(item.id, value)}
              />
            </li>
          ))}
        </ul>
      </Body>
      <Footer>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 15 }}>
          <span style={{ color: 'var(--ink-2)' }}>Il tuo totale</span>
          <Money cents={totalCents} style={{ fontWeight: 700, fontSize: 18 }} />
        </div>
        <button type="button" className="btn btn--block btn--lg" disabled={totalCents <= 0} onClick={onContinue}>
          Continua <Icon name="arrow" size={18} />
        </button>
      </Footer>
    </Screen>
  )
}

// ============ METODO DI PAGAMENTO ============

function MethodCard({
  method,
  title,
  sub,
  icon,
  disabled,
  onClick,
}: {
  method: PayMethod
  title: string
  sub: string
  icon: IconName
  disabled: boolean
  onClick: () => void
}) {
  const online = method === 'ONLINE'
  return (
    <button
      type="button"
      className="card"
      disabled={disabled}
      onClick={onClick}
      style={{ textAlign: 'left', padding: 18, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', background: 'var(--paper-3)' }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          background: online ? 'var(--accent-tint)' : 'var(--amber-tint)',
          color: online ? 'var(--accent-deep)' : '#7a5908',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={24} />
      </div>
      <div style={{ flex: 1 }}>
        <h3 style={{ fontSize: 16.5 }}>{title}</h3>
        <p style={{ fontSize: 13, color: 'var(--ink-3)' }}>{sub}</p>
      </div>
      <Icon name="arrow" size={18} style={{ color: 'var(--ink-3)' }} />
    </button>
  )
}

export function Method({
  amountCents,
  pending,
  error,
  onBack,
  onPay,
}: {
  amountCents: number
  pending: boolean
  error: string | null
  onBack: () => void
  onPay: (method: PayMethod) => void
}) {
  return (
    <Screen>
      <Head title="Come paghi?" sub={<>La tua quota è <Money cents={amountCents} /></>} onBack={onBack} />
      <Body>
        <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <MethodCard method="ONLINE" title="Paga online" sub="Pagamento immediato" icon="card" disabled={pending} onClick={() => onPay('ONLINE')} />
          <MethodCard method="CASH" title="Pago alla cassa" sub="Lo confermerà il cameriere" icon="cash" disabled={pending} onClick={() => onPay('CASH')} />
        </div>
        <ErrorNote message={error} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginTop: 22, color: 'var(--ink-3)', fontSize: 12 }}>
          <Icon name="lock" size={13} /> Pagamento simulato · nessun addebito reale
        </div>
      </Body>
    </Screen>
  )
}

// ============ ELABORAZIONE E TAVOLO SALDATO ============

export function Processing() {
  return (
    <Screen>
      <main
        role="status"
        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            border: '3px solid var(--accent-tint)',
            borderTopColor: 'var(--accent)',
            animation: 'coin-spin .9s linear infinite',
          }}
        />
        <div style={{ textAlign: 'center' }}>
          <h2 className="serif" style={{ fontSize: 24 }}>
            Elaborazione…
          </h2>
          <p style={{ color: 'var(--ink-3)', fontSize: 14, marginTop: 4 }}>Stiamo confermando il pagamento</p>
        </div>
      </main>
    </Screen>
  )
}

export function Settled({ restaurantName, mine }: { restaurantName: string; mine: Pick<MyPayment, 'amount' | 'method'> }) {
  return (
    <Screen>
      <main
        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: '0 30px', textAlign: 'center' }}
      >
        <div
          style={{
            width: 76,
            height: 76,
            borderRadius: '50%',
            background: 'var(--olive)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'pop-in .5s var(--ease)',
          }}
        >
          <Icon name="check" size={42} stroke={2.6} />
        </div>
        <h1 className="serif" style={{ fontSize: 38, lineHeight: 1 }}>
          Tavolo saldato
        </h1>
        <p style={{ color: 'var(--ink-2)', fontSize: 15.5, lineHeight: 1.5 }}>
          Il conto è chiuso. Grazie per aver cenato da {restaurantName}!
        </p>
        <div className="chip chip--olive" style={{ marginTop: 4 }}>
          La tua quota: <Money cents={parseMoney(mine.amount)} /> · {mine.method === 'ONLINE' ? 'Online' : 'Cassa'}
        </div>
      </main>
    </Screen>
  )
}

