import { Route, Routes, useParams } from 'react-router-dom'

function Message({ title, children }: { title: string; children?: string }) {
  return (
    <main
      className="paper-grain"
      style={{
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: '0 32px',
        textAlign: 'center',
      }}
    >
      <h1 className="serif" style={{ fontSize: 44 }}>
        {title}
      </h1>
      {children && <p style={{ color: 'var(--ink-2)', maxWidth: 360 }}>{children}</p>}
    </main>
  )
}

function TablePage() {
  const { tableId } = useParams()
  // Segnaposto: il percorso cliente (vista tavolo, modalità, pagamento) arriva nella PR successiva.
  return <Message title={`Tavolo ${tableId}`}>Il pagamento al tavolo sarà presto disponibile.</Message>
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={<Message title="Conto Giusto">Ordini e pagamenti al tavolo, senza stress.</Message>}
      />
      <Route path="/table/:tableId" element={<TablePage />} />
      <Route path="*" element={<Message title="Pagina non trovata" />} />
    </Routes>
  )
}
