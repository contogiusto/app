import { Navigate, Route, Routes } from 'react-router-dom'
import ScanPage from '../scanner/ScanPage'
import AccountHome from './AccountHome'
import AccountLayout from './AccountLayout'
import HistoryPage from './HistoryPage'
import ProfilePage from './ProfilePage'

/**
 * Area del cliente registrato (`/customer/*`, già protetta da `RequireCustomer` in `App.tsx`):
 * home, storico, profilo e scanner del QR. Ogni pagina ha il suo file e il suo proprietario:
 * le pagine dell'account stanno in `src/account/`, lo scanner in `src/scanner/`.
 */
export default function AccountArea() {
  return (
    <AccountLayout>
      <Routes>
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={<AccountHome />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="scan" element={<ScanPage />} />
        <Route path="*" element={<Navigate to="home" replace />} />
      </Routes>
    </AccountLayout>
  )
}
