import { Route, Routes } from 'react-router-dom'
import { StaffLayout } from '../staff/StaffLayout'
import { Floor } from './Floor'
import './waiter.css'

/** Entrata del cameriere: `/waiter` è la sala, `/waiter/table/:tableId` un tavolo. */
export default function WaiterApp() {
  return (
    <StaffLayout title="Sala">
      <Routes>
        {/* Una sola rotta, così passando da un tavolo all'altro la sala non si smonta. */}
        <Route path="*" element={<Floor />} />
      </Routes>
    </StaffLayout>
  )
}
