import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { useStaffBase } from '../staff/paths'
import { Icon } from '../ui/Icon'
import { StaffLayout } from '../staff/StaffLayout'
import './admin.css'
import { AdminIcon } from './icons'
import { MenuScreen } from './MenuScreen'
import { TablesScreen } from './TablesScreen'
import { UsersScreen } from './UsersScreen'

/** Pannello del ristoratore: menù e tavoli/QR, montato su `/admin/*` (solo ADMIN). */
export default function AdminApp() {
  const base = `${useStaffBase()}/admin`
  return (
    <StaffLayout
      title="Gestione"
      actions={
        <nav aria-label="Sezioni" className="admin-nav" style={{ display: 'flex', gap: 6, marginRight: 8 }}>
          <NavLink to={`${base}/menu`}>
            <AdminIcon name="book" /> Menù
          </NavLink>
          <NavLink to={`${base}/tables`}>
            <Icon name="qr" size={18} /> Tavoli &amp; QR
          </NavLink>
          <NavLink to={`${base}/users`}>
            <Icon name="users" size={18} /> Utenti
          </NavLink>
        </nav>
      }
    >
      <Routes>
        <Route path="menu" element={<MenuScreen />} />
        <Route path="tables" element={<TablesScreen />} />
        <Route path="users" element={<UsersScreen />} />
        <Route path="*" element={<Navigate to={`${base}/menu`} replace />} />
      </Routes>
    </StaffLayout>
  )
}
