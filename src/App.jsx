import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import Toast from './components/Toast'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Clients from './pages/Clients'
import Produits from './pages/Produits'
import Commandes from './pages/Commandes'
import Stock from './pages/Stock'
import Recouvrement from './pages/Recouvrement'
import Users from './pages/Users'

// Layout protégé — accessible seulement si connecté
function ProtectedLayout({ showToast }) {
  const { user, profile, loading } = useAuth()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [search, setSearch] = useState('')

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'grid', placeItems:'center', background:'var(--bg)' }}>
      <div style={{ textAlign:'center' }}>
        <div className="spinner-agro"></div>
        <p style={{ color:'var(--text-soft)', marginTop:8 }}>Chargement...</p>
      </div>
    </div>
  )

  if (!user) return <Navigate to="/login" replace />

  const role = profile?.role || 'admin'

  return (
    <div className="app-layout">
      <Sidebar collapsed={sidebarCollapsed} />

      <div className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Topbar
          onToggleSidebar={() => setSidebarCollapsed(c => !c)}
          collapsed={sidebarCollapsed}
          onSearch={setSearch}
          showToast={showToast}
        />

        <div className="page-body">
          <Routes>
            <Route path="/"             element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard"    element={<Dashboard    showToast={showToast} search={search} />} />
            <Route path="/produits"     element={<Produits     showToast={showToast} search={search} />} />
            <Route path="/clients"      element={<Clients      showToast={showToast} search={search} />} />
            <Route path="/commandes"    element={<Commandes    showToast={showToast} search={search} />} />
            <Route path="/stock"        element={<Stock        showToast={showToast} search={search} />} />
            {/* Recouvrement — admin + analyste seulement */}
            {(role==='admin' || role==='analyste') && (
              <Route path="/recouvrement" element={<Recouvrement showToast={showToast} search={search} />} />
            )}
            {/* Users — admin seulement */}
            {role==='admin' && (
              <Route path="/users" element={<Users showToast={showToast} />} />
            )}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}

function AppRouter() {
  const [toast, setToast] = useState({ msg:'', type:'success', show:false })

  const showToast = (msg, type='success') => {
    setToast({ msg, type, show:true })
    setTimeout(() => setToast(t => ({ ...t, show:false })), 3200)
  }

  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginGuard />} />
        <Route path="/*"     element={<ProtectedLayout showToast={showToast} />} />
      </Routes>
      <Toast msg={toast.msg} type={toast.type} show={toast.show} />
    </>
  )
}

// Redirige vers dashboard si déjà connecté
function LoginGuard() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/dashboard" replace />
  return <Login />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </BrowserRouter>
  )
}