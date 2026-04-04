import { NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { logoutUser } from '../firebase'
import { useAuth } from '../context/AuthContext'

const ROLE_CONFIG = {
  admin:      { label:'Admin',      color:'#7B0D1E', icon:'bi-shield-fill' },
  technicien: { label:'Technicien', color:'#E8C547', icon:'bi-tools' },
  analyste:   { label:'Analyste',   color:'#3D9970', icon:'bi-graph-up-arrow' },
}

const allNavItems = [
  { to:'/dashboard',    icon:'bi-grid-1x2-fill',   label:'Tableau de Bord',       roles:['admin','technicien','analyste'] },
  { to:'/produits',     icon:'bi-box-seam-fill',    label:'Produits (Agro)',        roles:['admin','technicien','analyste'] },
  { to:'/clients',      icon:'bi-people-fill',      label:'Clients',               roles:['admin','technicien','analyste'] },
  { to:'/commandes',    icon:'bi-receipt',           label:'Bons de Commande',      roles:['admin','technicien','analyste'] },
  { to:'/stock',        icon:'bi-archive-fill',      label:'Stock & Semaison',      roles:['admin','technicien','analyste'] },
  { to:'/recouvrement', icon:'bi-cash-coin',         label:'Recouvrement (Crédit)', roles:['admin','analyste'] },
  { to:'/users',        icon:'bi-person-gear',       label:'Utilisateurs',          roles:['admin'] },
]

export default function Sidebar({ collapsed }) {
  const { profile }  = useAuth()
  const navigate     = useNavigate()
  const [showMenu, setShowMenu] = useState(false)
  const role         = profile?.role || 'admin'
  const cfg          = ROLE_CONFIG[role] || ROLE_CONFIG.admin
  const navItems     = allNavItems.filter(i => i.roles.includes(role))

  async function handleLogout() {
    await logoutUser()
    navigate('/login')
  }

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>

      {/* Brand */}
      <div className="sidebar-brand">
        <div className="brand-icon">🌿</div>
        <div>
          <span className="brand-name">AgroAbdo</span>
          <span className="brand-sub">Maroc</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `nav-link-item ${isActive ? 'active' : ''}`}
          >
            <i className={`bi ${item.icon}`}></i>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer — profil cliquable */}
      <div className="sidebar-footer" style={{ position:'relative' }}>
        <div
          className="user-card"
          onClick={() => setShowMenu(s => !s)}
          style={{ cursor:'pointer', padding:'6px 8px', borderRadius:8, transition:'background 0.2s' }}
          onMouseOver={e => e.currentTarget.style.background='rgba(255,255,255,0.06)'}
          onMouseOut={e => e.currentTarget.style.background='transparent'}
        >
          <div className="user-avatar" style={{ background: cfg.color }}>
            {profile?.nom?.charAt(0).toUpperCase() || 'A'}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <span className="user-name" style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'block' }}>
              {profile?.nom || 'Admin'}
            </span>
            <span className="user-role" style={{ display:'flex', alignItems:'center', gap:4 }}>
              <i className={`bi ${cfg.icon}`} style={{ fontSize:10, color:cfg.color }}></i>
              {cfg.label}
            </span>
          </div>
          <i className="bi bi-three-dots-vertical" style={{ color:'#6B7280', fontSize:13 }}></i>
        </div>

        {/* Menu popup */}
        {showMenu && (
          <div style={{
            position:'absolute', bottom:'100%', left:8, right:8,
            background:'var(--bg-sidebar2)',
            border:'1px solid var(--border-dark)',
            borderRadius:10, overflow:'hidden',
            boxShadow:'0 -4px 20px rgba(0,0,0,0.3)',
            zIndex:300,
          }}>
            {/* Infos compte */}
            <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--border-dark)' }}>
              <div style={{ fontSize:12, fontWeight:600, color:'white', marginBottom:2 }}>{profile?.nom}</div>
              <div style={{ fontSize:11, color:'#9CA3AF' }}>{profile?.email}</div>
              <span style={{ display:'inline-flex', alignItems:'center', gap:4, marginTop:5, fontSize:11, background:`${cfg.color}20`, color:cfg.color, padding:'2px 8px', borderRadius:4, fontWeight:600 }}>
                <i className={`bi ${cfg.icon}`} style={{ fontSize:10 }}></i>
                {cfg.label}
              </span>
            </div>

            {/* Actions */}
            {role === 'admin' && (
              <button
                style={{ width:'100%', padding:'10px 14px', background:'none', border:'none', cursor:'pointer', color:'#9CA3AF', fontSize:13, display:'flex', alignItems:'center', gap:8, transition:'background 0.15s' }}
                onMouseOver={e=>e.currentTarget.style.background='rgba(255,255,255,0.05)'}
                onMouseOut={e=>e.currentTarget.style.background='none'}
                onClick={() => { setShowMenu(false); navigate('/users') }}
              >
                <i className="bi bi-person-gear" style={{ color:'#7B0D1E', fontSize:14 }}></i>
                Gérer les utilisateurs
              </button>
            )}

            <button
              style={{ width:'100%', padding:'10px 14px', background:'none', border:'none', cursor:'pointer', color:'#f85149', fontSize:13, display:'flex', alignItems:'center', gap:8, transition:'background 0.15s', borderTop:'1px solid var(--border-dark)' }}
              onMouseOver={e=>e.currentTarget.style.background='rgba(248,81,73,0.08)'}
              onMouseOut={e=>e.currentTarget.style.background='none'}
              onClick={handleLogout}
            >
              <i className="bi bi-box-arrow-right" style={{ fontSize:14 }}></i>
              Se déconnecter
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}