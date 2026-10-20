import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAccount } from '../account/account'
import { loginUrl } from '../account/redirect'
import { ApiError, api, type PaymentIn, type PaymentMode } from '../api/client'
import { parseMoney } from '../lib/money'
import { CenterMessage } from '../ui/layout'
import './customer.css'
import { fullName, ownTotalCents, toPaymentItems, type Selection } from './logic'
import { ChooseMode, EntryChoice, Hub, Method, OwnSelect, Processing, Settled, Welcome } from './screens'
import {
  clearIdentity,
  loadGuest,
  loadIdentity,
  loadMyPayment,
  loadToken,
  saveGuest,
  saveIdentity,
  saveMyPayment,
  saveToken,
  type MyPayment,
} from './storage'

type Step = 'choice' | 'welcome' | 'mode' | 'table' | 'own' | 'method'

const POLL_MS = 3000

/** Con un 4xx il problema non passa da solo (token sbagliato…): inutile continuare a chiedere. */
const isClientError = (error: unknown) =>
  error instanceof ApiError && error.status >= 400 && error.status < 500

export function CustomerApp() {
  const { tableId: tableParam } = useParams()
  const tableId = Number(tableParam)
  const [search] = useSearchParams()
  const urlToken = search.get('token')
  const token = urlToken ?? loadToken(tableId)
  const valid = Number.isInteger(tableId) && tableId > 0 && Boolean(token)

  useEffect(() => {
    if (urlToken && Number.isInteger(tableId)) saveToken(tableId, urlToken)
  }, [tableId, urlToken])

  const queryClient = useQueryClient()
  const queryKey = ['table', tableId, token]
  const view = useQuery({
    queryKey,
    queryFn: ({ signal }) => api.table.view(tableId, token as string, signal),
    enabled: valid,
    refetchInterval: (query) => (isClientError(query.state.error) ? false : POLL_MS),
  })

  const navigate = useNavigate()
  const { session: account, logout } = useAccount()
  // Il backend vuole un nome per il pagamento: per chi è collegato è quello dell'account.
  const accountName = account ? fullName(account.customer.first_name, account.customer.last_name) : null

  const [identity, setIdentity] = useState(() => loadIdentity(tableId))
  const [guest, setGuest] = useState(() => loadGuest(tableId))
  const [myPayment, setMyPayment] = useState<MyPayment | null>(() => loadMyPayment(tableId))
  const [step, setStep] = useState<Step | null>(null)
  const [selection, setSelection] = useState<Selection>({})
  const [paying, setPaying] = useState<PaymentIn['method'] | null>(null)

  // Ricorda l'identità dell'account come si fa con "join": al ricaricamento è già a posto.
  const sessionId = view.data?.session?.id
  useEffect(() => {
    if (!accountName || sessionId === undefined) return
    saveIdentity(tableId, { sessionId, name: accountName, account: true })
  }, [tableId, sessionId, accountName])

  const setMode = useMutation({
    mutationFn: (mode: PaymentMode) => api.table.setMode(tableId, token as string, mode),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data)
      setStep('table')
    },
  })

  const pay = useMutation({
    mutationFn: (payment: PaymentIn) => api.table.pay(tableId, token as string, payment),
    onSuccess: (payment, request) => {
      const record: MyPayment = {
        sessionId: view.data?.session?.id ?? 0,
        amount: payment.amount,
        method: request.method,
        paidAt: Date.now(),
      }
      saveMyPayment(tableId, record)
      setMyPayment(record)
      setSelection({})
      setStep('table')
    },
    onSettled: () => {
      setPaying(null)
      void queryClient.invalidateQueries({ queryKey })
    },
  })

  if (!valid) {
    return (
      <Shell>
        <CenterMessage
          icon="qr"
          title="QR non valido"
          body="Scansiona di nuovo il QR del tavolo per entrare."
        />
      </Shell>
    )
  }
  if (view.isPending) {
    return (
      <Shell>
        <CenterMessage icon="clock" title="Caricamento…" role="status" />
      </Shell>
    )
  }
  if (!view.data) {
    const notFound = view.error instanceof ApiError && view.error.status === 404
    return (
      <Shell>
        <CenterMessage
          role="alert"
          icon="lock"
          title={notFound ? 'Tavolo non trovato' : 'Qualcosa non va'}
          body={
            notFound
              ? 'Il codice non è valido o è stato sostituito. Scansiona di nuovo il QR del tavolo.'
              : (view.error?.message ?? 'Riprova tra poco.')
          }
        />
      </Shell>
    )
  }

  const table = view.data
  const session = table.session

  if (!session) {
    return (
      <Shell>
        {myPayment ? (
          <Settled restaurantName={table.restaurant_name} mine={myPayment} signedIn={account !== null} />
        ) : (
          <CenterMessage
            icon="table"
            title="Tavolo libero"
            body={`Il tavolo ${table.table_number} non ha una sessione aperta. Chiedi al cameriere di aprirne una.`}
          />
        )}
      </Shell>
    )
  }

  // L'identità vale solo per la sessione in cui è stata data: al tavolo successivo si riparte.
  // Un nome preso da un account vale solo finché l'account è collegato.
  const typedMe = identity?.sessionId === session.id && !identity.account ? identity.name : null
  const me = accountName ?? typedMe
  const chosenGuest = guest?.sessionId === session.id
  const mine =
    myPayment?.sessionId === session.id
      ? myPayment
      : (() => {
          const found = session.payments.find((p) => p.customer_nickname === me)
          return found ? { amount: found.amount, method: found.method } : null
        })()

  const current: Step =
    step ?? (me ? (session.payment_mode ? 'table' : 'mode') : chosenGuest ? 'welcome' : 'choice')
  const ownCents = ownTotalCents(session.items, selection)
  const amountCents =
    session.payment_mode === 'OWN'
      ? ownCents
      : session.next_share === null
        ? 0
        : parseMoney(session.next_share)

  const join = (name: string) => {
    const next = { sessionId: session.id, name }
    saveIdentity(tableId, next)
    setIdentity(next)
    setStep(session.payment_mode ? 'table' : 'mode')
  }

  // Il percorso di ritorno è sempre quello completo del tavolo, token compreso.
  const tablePath = `/table/${tableId}?token=${encodeURIComponent(token as string)}`
  const continueAsGuest = () => {
    const choice = { sessionId: session.id }
    saveGuest(tableId, choice)
    setGuest(choice)
  }
  const leaveAccount = () => {
    clearIdentity(tableId)
    setIdentity(null)
    setStep(null)
    logout()
  }

  const submit = (method: PaymentIn['method']) => {
    if (!me) return
    setPaying(method)
    pay.mutate({
      method,
      customer_nickname: me,
      ...(session.payment_mode === 'OWN' ? { items: toPaymentItems(selection) } : {}),
    })
  }

  const error = (mutation: { error: Error | null }) => mutation.error?.message ?? null

  return (
    <Shell>
      {current === 'choice' && (
        <EntryChoice
          restaurantName={table.restaurant_name}
          tableNumber={table.table_number}
          onLogin={() => navigate(loginUrl(tablePath, 'login'))}
          onRegister={() => navigate(loginUrl(tablePath, 'register'))}
          onGuest={continueAsGuest}
        />
      )}
      {current === 'welcome' && (
        <Welcome restaurantName={table.restaurant_name} tableNumber={table.table_number} onJoin={join} />
      )}
      {current === 'mode' && (
        <ChooseMode
          coperti={session.coperti}
          pending={setMode.isPending}
          error={error(setMode)}
          onChoose={(mode) => setMode.mutate(mode)}
        />
      )}
      {current === 'table' && me && (
        <Hub
          table={table}
          session={session}
          me={me}
          mine={mine}
          account={accountName !== null}
          onLogout={leaveAccount}
          onPay={() => setStep('method')}
          onChooseOwn={() => setStep('own')}
        />
      )}
      {current === 'own' && (
        <OwnSelect
          items={session.items}
          selection={selection}
          totalCents={ownCents}
          onChange={(id, quantity) => setSelection((prev) => ({ ...prev, [id]: quantity }))}
          onBack={() => setStep('table')}
          onContinue={() => setStep('method')}
        />
      )}
      {current === 'method' &&
        (paying === 'ONLINE' && pay.isPending ? (
          <Processing />
        ) : (
          <Method
            amountCents={amountCents}
            pending={pay.isPending}
            error={error(pay)}
            onBack={() => {
              pay.reset()
              setStep(session.payment_mode === 'OWN' ? 'own' : 'table')
            }}
            onPay={submit}
          />
        ))}
    </Shell>
  )
}

/** Su telefono occupa tutto lo schermo; su schermi grandi diventa una colonna centrata. */
function Shell({ children }: { children: React.ReactNode }) {
  return <div className="customer-shell">{children}</div>
}
