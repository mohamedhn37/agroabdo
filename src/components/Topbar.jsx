import { useLocation } from 'react-router-dom'
import useDarkMode from '../hooks/useDarkMode'
import ExportCSV from './ExportCSV'
import { useAuth } from '../context/AuthContext'

const pageTitles = {
  '/dashboard':    'Tableau de Bord',
  '/produits':     'Produits (Agro)',
  '/clients':      'Clients',
  '/commandes':    'Bons de Commande',
  '/stock':        'Stock & Semaison',
  '/recouvrement': 'Recouvrement (Crédit)',
  '/users':        'Gestion Utilisateurs',
}

export default function Topbar({ onToggleSidebar, collapsed, onSearch, showToast }) {
  const { pathname }    = useLocation()
  const { profile }     = useAuth()
  const title           = pageTitles[pathname] || 'AgroAbdo'
  const [dark, toggleDark] = useDarkMode()
  const date = new Date().toLocaleDateString('fr-MA', {
    weekday:'long', year:'numeric', month:'long', day:'numeric'
  })

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="menu-toggle" onClick={onToggleSidebar} title="Menu">
          <i className={`bi ${collapsed ? 'bi-layout-sidebar' : 'bi-layout-sidebar-inset'}`}></i>
        </button>
        <div>
          <div className="topbar-title">{title}</div>
          <div className="topbar-date">{date}</div>
        </div>
      </div>

      <div className="topbar-right">
        {/* Recherche */}
        <div className="search-wrap">
          <i className="bi bi-search"></i>
          <input placeholder="Rechercher..." onChange={e => onSearch && onSearch(e.target.value)} />
        </div>

        {/* Export CSV — visible pour admin et analyste */}
        {(profile?.role === 'admin' || profile?.role === 'analyste') && (
          <ExportCSV showToast={showToast} />
        )}

        {/* Dark mode */}
        <button className="menu-toggle" onClick={toggleDark} title={dark ? 'Mode Clair' : 'Mode Sombre'}>
          <i className={`bi ${dark ? 'bi-sun-fill' : 'bi-moon-fill'}`}
             style={{ color: dark ? '#E8C547' : '#6B7280', fontSize:16 }}></i>
        </button>
      </div>
    </header>
  )
}