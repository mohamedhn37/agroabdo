import { useState } from 'react'
import { loginUser } from '../firebase'

export default function Login() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [showPwd, setShowPwd]   = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    if (!email || !password) return setError('Email et mot de passe obligatoires')
    setLoading(true)
    setError('')
    try {
      await loginUser(email, password)
      // AuthContext détecte automatiquement → redirect via App.jsx
    } catch (err) {
      const msgs = {
        'auth/invalid-credential':    'Email ou mot de passe incorrect',
        'auth/user-not-found':        'Aucun compte avec cet email',
        'auth/wrong-password':        'Mot de passe incorrect',
        'auth/too-many-requests':     'Trop de tentatives, réessayez plus tard',
        'auth/invalid-email':         'Format email invalide',
      }
      setError(msgs[err.code] || 'Erreur de connexion : ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-body)',
    }}>
      {/* Décoration gauche */}
      <div style={{
        position: 'fixed', left: 0, top: 0, bottom: 0, width: '42%',
        background: '#7B0D1E',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 24,
      }} className="login-deco">
        <div style={{ fontSize: 64 }}>🌿</div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 36, color: 'white', textAlign: 'center', lineHeight: 1.2 }}>
          AgroAbdo
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', letterSpacing: 3, textTransform: 'uppercase' }}>
          Maroc
        </div>
        <div style={{ marginTop: 24, padding: '16px 28px', background: 'rgba(255,255,255,0.1)', borderRadius: 12, maxWidth: 280, textAlign: 'center' }}>
          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 1.7 }}>
            Système de gestion des ventes, stock et recouvrement pour les agrofournitures au Maroc
          </p>
        </div>

        {/* Stats déco */}
        <div style={{ display: 'flex', gap: 20, marginTop: 16 }}>
          {[['12', 'Régions'], ['100+', 'Clients'], ['24/7', 'Accès']].map(([val, label]) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: 'white' }}>{val}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Formulaire droite */}
      <div style={{
        marginLeft: '42%',
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
      }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ marginBottom: 32 }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, color: 'var(--text-main)', marginBottom: 6 }}>
              Connexion
            </h1>
            <p style={{ color: 'var(--text-soft)', fontSize: 14 }}>
              Entrez vos identifiants pour accéder au tableau de bord
            </p>
          </div>

          <form onSubmit={handleLogin}>
            {/* Email */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-soft)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                Adresse Email
              </label>
              <div style={{ position: 'relative' }}>
                <i className="bi bi-envelope" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-soft)', fontSize: 15 }}></i>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@agroabdo.ma"
                  style={{
                    width: '100%', padding: '11px 12px 11px 38px',
                    background: 'var(--bg-card)', border: '1.5px solid var(--border)',
                    borderRadius: 10, fontFamily: 'var(--font-body)', fontSize: 14,
                    color: 'var(--text-main)', outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={e => e.target.style.borderColor = '#7B0D1E'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-soft)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                Mot de Passe
              </label>
              <div style={{ position: 'relative' }}>
                <i className="bi bi-lock" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-soft)', fontSize: 15 }}></i>
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%', padding: '11px 40px 11px 38px',
                    background: 'var(--bg-card)', border: '1.5px solid var(--border)',
                    borderRadius: 10, fontFamily: 'var(--font-body)', fontSize: 14,
                    color: 'var(--text-main)', outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={e => e.target.style.borderColor = '#7B0D1E'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
                <button type="button" onClick={() => setShowPwd(s => !s)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-soft)', fontSize: 15, padding: 0 }}>
                  <i className={`bi ${showPwd ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                </button>
              </div>
            </div>

            {/* Erreur */}
            {error && (
              <div style={{ background: 'rgba(192,57,43,0.1)', border: '1px solid rgba(192,57,43,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: 13, color: '#C0392B', display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="bi bi-exclamation-triangle-fill"></i>
                {error}
              </div>
            )}

            {/* Bouton */}
            <button type="submit" disabled={loading}
              style={{
                width: '100%', padding: '13px', background: '#7B0D1E',
                color: 'white', border: 'none', borderRadius: 10,
                fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.75 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'opacity 0.2s, transform 0.1s',
              }}
              onMouseOver={e => !loading && (e.target.style.opacity = '0.88')}
              onMouseOut={e => !loading && (e.target.style.opacity = '1')}
            >
              {loading
                ? <><span className="spinner-border spinner-border-sm"></span> Connexion...</>
                : <><i className="bi bi-box-arrow-in-right"></i> Se connecter</>
              }
            </button>
          </form>

          {/* Info rôles */}
          <div style={{ marginTop: 32, padding: '14px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--text-soft)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
              Niveaux d'accès
            </div>
            {[
              { role: 'Admin',      icon: 'bi-shield-fill',         color: '#7B0D1E', desc: 'Accès total + gestion utilisateurs' },
              { role: 'Technicien', icon: 'bi-tools',               color: '#E8C547', desc: 'Saisie terrain (clients, commandes)' },
              { role: 'Analyste',   icon: 'bi-graph-up-arrow',      color: '#3D9970', desc: 'Lecture + export CSV pour Power BI' },
            ].map(r => (
              <div key={r.role} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <i className={`bi ${r.icon}`} style={{ color: r.color, fontSize: 14, width: 18 }}></i>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-main)' }}>{r.role}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-soft)', marginLeft: 6 }}>{r.desc}</span>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* Responsive */}
      <style>{`
        @media (max-width: 768px) {
          .login-deco { display: none !important; }
          div[style*="marginLeft: '42%'"] { margin-left: 0 !important; }
        }
      `}</style>
    </div>
  )
}