import { Route, Routes } from 'react-router-dom'
import AccountArea from './account/AccountArea'
import { AccountProvider } from './account/AccountProvider'
import HomePage from './account/HomePage'
import PrivacyPage from './account/PrivacyPage'
import { RequireCustomer } from './account/RequireCustomer'
import AdminApp from './admin/AdminApp'
import { CustomerApp } from './customer/CustomerApp'
import { AuthProvider } from './staff/AuthProvider'
import LoginScreen from './staff/LoginScreen'
import { RequireRole } from './staff/RequireRole'
import WaiterApp from './waiter/WaiterApp'

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

export default function App() {
  return (
    <AuthProvider>
      <AccountProvider>
        <AppRoutes />
      </AccountProvider>
    </AuthProvider>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      {/* Area del cliente registrato: le sotto-rotte le definisce AccountArea. */}
      <Route
        path="/customer/*"
        element={
          <RequireCustomer>
            <AccountArea />
          </RequireCustomer>
        }
      />
      <Route path="/table/:tableId" element={<CustomerApp />} />
      <Route path="/staff/login" element={<LoginScreen />} />
      {/* Le sotto-rotte di /waiter e /admin le definiscono WaiterApp e AdminApp (path relativi). */}
      <Route
        path="/waiter/*"
        element={
          <RequireRole roles={['WAITER', 'ADMIN']}>
            <WaiterApp />
          </RequireRole>
        }
      />
      <Route
        path="/admin/*"
        element={
          <RequireRole roles={['ADMIN']}>
            <AdminApp />
          </RequireRole>
        }
      />
      <Route path="*" element={<Message title="Pagina non trovata" />} />
    </Routes>
  )
}
