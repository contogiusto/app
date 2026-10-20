import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { StaffLayout } from '../staff/StaffLayout'
import './admin.css'
import { AdminIcon } from './icons'
import { MenuScreen } from './MenuScreen'
import { TablesScreen } from './TablesScreen'

/** Pannello del ristoratore: menù e tavoli/QR, montato su `/admin/*` (solo ADMIN). */
export default function AdminApp() {
  return (
    <StaffLayout
      title="Gestione"
      actions={
        <nav aria-label="Sezioni" className="admin-nav" style={{ display: 'flex', gap: 6, marginRight: 8 }}>
          <NavLink to="/admin/menu">
            <AdminIcon name="book" /> Menù
          </NavLink>
          <NavLink to="/admin/tables">
            <Icon name="qr" size={18} /> Tavoli &amp; QR
          </NavLink>
        </nav>
      }
    >
      <Routes>
        <Route path="menu" element={<MenuScreen />} />
        <Route path="tables" element={<TablesScreen />} />
        <Route path="*" element={<Navigate to="/admin/menu" replace />} />
      </Routes>
    </StaffLayout>
  )
}
