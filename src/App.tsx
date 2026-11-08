import { useEffect, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { JournalProvider, useJournal } from './context/JournalContext'
import { UpdateProvider } from './context/UpdateContext'
import { Shell } from './components/Shell'
import { Home } from './pages/Home'
import { Detail } from './pages/Detail'
import { Edit } from './pages/Edit'
import { Share } from './pages/Share'
import { Categories } from './pages/Categories'
import { Profile } from './pages/Profile'
import { installAndroidBackHandler } from './lib/backButton'

function JournalGate({ children }: { children: ReactNode }) {
  const { ready } = useJournal()
  if (!ready) {
    return (
      <div className="canvas">
        <div className="phone">
          <div className="boot">正在打开手帐…</div>
        </div>
      </div>
    )
  }
  return children
}

function BackButtonBridge() {
  useEffect(() => installAndroidBackHandler(), [])
  return null
}

function AppRoutes() {
  return (
    <>
      <BackButtonBridge />
      <Routes>
        <Route element={<Shell />}>
          <Route path="/" element={<Home />} />
          <Route path="/recipe/:id" element={<Detail />} />
          <Route path="/new" element={<Edit />} />
          <Route path="/edit/:id" element={<Edit />} />
          <Route path="/share" element={<Share />} />
          <Route path="/share/:id" element={<Share />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <JournalProvider>
      <JournalGate>
        <UpdateProvider>
          <AppRoutes />
        </UpdateProvider>
      </JournalGate>
    </JournalProvider>
  )
}
