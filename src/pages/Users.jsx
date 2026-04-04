import { useEffect, useState } from 'react'
import { initializeApp } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth'
import { getAll, updateItem, deleteUserProfile, setItem, COLS } from '../firebase'
import { useAuth } from '../context/AuthContext'
import SortableTable from '../components/SortableTable'

// ── Instance Firebase secondaire pour créer des comptes SANS déconnecter l'admin
const secondaryApp = initializeApp({
  apiKey: "AIzaSyD0BHqoZm8CasxiAdpyPYb1F9JsOx6S3mI",
  authDomain: "abdoagrodatabase.firebaseapp.com",
  projectId: "abdoagrodatabase",
  storageBucket: "abdoagrodatabase.firebasestorage.app",
  messagingSenderId: "1083766542743",
  appId: "1:1083766542743:web:b24cdf3bf3a2e292e9b4d2",
}, 'secondary')
const secondaryAuth = getAuth(secondaryApp)

const ROLES = ['admin', 'technicien', 'analyste']
const ROLE_CONFIG = {
  admin:      { label:'Admin',      color:'#7B0D1E', icon:'bi-shield-fill' },
  technicien: { label:'Technicien', color:'#E8C547', icon:'bi-tools' },
  analyste:   { label:'Analyste',   color:'#3D9970', icon:'bi-graph-up-arrow' },
}
const EMPTY = { nom:'', email:'', password:'', role:'technicien' }

export default function Users({ showToast }) {
  const { profile: currentUser } = useAuth()
  const [users, setUsers]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [form, setForm]         = useState(EMPTY)
  const [editForm, setEditForm] = useState(null)
  const [saving, setSaving]     = useState(false)
  const [showPwd, setShowPwd]   = useState(false)

  useEffect(() => {
    loadUsers()
  }, [])

  async function loadUsers() {
    setLoading(true)
    try {
      const data = await getAll(COLS.users)
      setUsers(data)
    } catch(e) { showToast(e.message, 'error') }
    finally { setLoading(false) }
  }

  // ── Créer compte avec instance secondaire ──────────────────────────────────
  async function handleCreate() {
    if (!form.nom || !form.email || !form.password)
      return showToast('Tous les champs sont obligatoires', 'error')
    if (form.password.length < 6)
      return showToast('Mot de passe : 6 caractères minimum', 'error')
    setSaving(true)
    try {
      // Utilise l'instance secondaire → ne change PAS la session admin
      const cred = await createUserWithEmailAndPassword(secondaryAuth, form.email, form.password)
      // Déconnecte immédiatement l'instance secondaire
      await secondaryAuth.signOut()

      // Sauvegarde le profil dans Firestore avec l'UID comme ID document
      await setItem(COLS.users, cred.user.uid, {
        uid:       cred.user.uid,
        email:     form.email,
        nom:       form.nom,
        role:      form.role,
        createdAt: new Date().toISOString(),
        actif:     true,
      })

      await loadUsers() // Refresh la liste
      setModal(false)
      setForm(EMPTY)
      showToast(`Compte "${form.nom}" créé ✓`)
    } catch(e) {
      const msgs = {
        'auth/email-already-in-use': 'Cet email est déjà utilisé',
        'auth/invalid-email':        'Format email invalide',
        'auth/weak-password':        'Mot de passe trop faible (6 cars min)',
      }
      showToast(msgs[e.code] || e.message, 'error')
    } finally { setSaving(false) }
  }

  // ── Modifier profil (nom + rôle uniquement) ────────────────────────────────
  async function handleEdit() {
    if (!editForm.nom) return showToast('Le nom est obligatoire', 'error')
    setSaving(true)
    try {
      await updateItem(COLS.users, editForm.id, {
        nom:  editForm.nom,
        role: editForm.role,
      })
      setUsers(us => us.map(u => u.id === editForm.id ? { ...u, nom: editForm.nom, role: editForm.role } : u))
      setEditModal(false)
      showToast('Compte mis à jour ✓')
    } catch(e) { showToast(e.message, 'error') }
    finally { setSaving(false) }
  }

  // ── Activer / Désactiver ───────────────────────────────────────────────────
  async function handleToggleActif(user) {
    await updateItem(COLS.users, user.id, { actif: !user.actif })
    setUsers(us => us.map(u => u.id === user.id ? { ...u, actif: !u.actif } : u))
    showToast(`Compte ${user.actif ? 'désactivé' : 'réactivé'}`)
  }

  // ── Supprimer ──────────────────────────────────────────────────────────────
  async function handleDelete(user) {
    if (!confirm(`Supprimer le compte de "${user.nom}" ?\nCette action est irréversible.`)) return
    await deleteUserProfile(user.id)
    setUsers(us => us.filter(u => u.id !== user.id))
    showToast('Compte supprimé')
  }

  const columns = [
    { key:'nom', label:'Nom', render: r => (
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ width:34, height:34, borderRadius:'50%', background:ROLE_CONFIG[r.role]?.color||'#7B0D1E', display:'grid', placeItems:'center', color:'white', fontWeight:700, fontSize:13, flexShrink:0 }}>
          {r.nom?.charAt(0).toUpperCase()}
        </div>
        <div>
          <div style={{ fontWeight:600, fontSize:13 }}>{r.nom}</div>
          <div style={{ fontSize:11, color:'var(--text-soft)' }}>{r.email}</div>
        </div>
      </div>
    )},
    { key:'role', label:'Rôle', render: r => {
      const cfg = ROLE_CONFIG[r.role] || {}
      return (
        <span style={{ background:`${cfg.color}18`, color:cfg.color, fontSize:11.5, fontWeight:600, padding:'3px 10px', borderRadius:5, display:'inline-flex', alignItems:'center', gap:5 }}>
          <i className={`bi ${cfg.icon}`} style={{ fontSize:11 }}></i>
          {cfg.label || r.role}
        </span>
      )
    }},
    { key:'createdAt', label:'Créé le', render: r => (
      <span style={{ fontSize:12, color:'var(--text-soft)' }}>
        {r.createdAt ? new Date(r.createdAt).toLocaleDateString('fr-MA') : '—'}
      </span>
    )},
    { key:'actif', label:'Statut', render: r => (
      r.actif !== false
        ? <span className="badge-ok">✓ Actif</span>
        : <span className="badge-retard">✗ Inactif</span>
    )},
    { key:'actions', label:'', sortable:false, render: r => (
      <div className="d-flex gap-1">
        {/* Modifier */}
        <button className="btn-icon" title="Modifier" onClick={() => { setEditForm({ id:r.id, nom:r.nom, role:r.role, email:r.email }); setEditModal(true) }}>
          <i className="bi bi-pencil"></i>
        </button>
        {/* Activer / Désactiver */}
        <button className="btn-icon" title={r.actif!==false?'Désactiver':'Réactiver'} onClick={() => handleToggleActif(r)}>
          <i className={`bi ${r.actif!==false?'bi-pause-circle':'bi-play-circle'}`}></i>
        </button>
        {/* Supprimer — pas sur son propre compte */}
        {currentUser?.role==='admin' && r.uid !== currentUser?.uid && r.email !== currentUser?.email && (
          <button className="btn-icon btn-danger" title="Supprimer" onClick={() => handleDelete(r)}>
            <i className="bi bi-trash"></i>
          </button>
        )}
      </div>
    )},
  ]

  if (loading) return <div className="loading-box"><div className="spinner-agro"></div><p>Chargement utilisateurs...</p></div>

  return (
    <div>
      {/* Stats */}
      <div className="row g-3 mb-3">
        {[
          { label:'Total Comptes',  val: users.length,                                  cls:'' },
          { label:'Actifs',         val: users.filter(u=>u.actif!==false).length,       cls:'amount-pos' },
          { label:'Admins',         val: users.filter(u=>u.role==='admin').length,       cls:'' },
          { label:'Techniciens',    val: users.filter(u=>u.role==='technicien').length,  cls:'' },
        ].map(s => (
          <div className="col-6 col-lg-3" key={s.label}>
            <div className="stat-box">
              <span className={`stat-val ${s.cls}`}>{s.val}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="page-header-agro">
        <div style={{ fontSize:13, color:'var(--text-soft)' }}>
          <i className="bi bi-info-circle me-1"></i>
          Seul l'admin peut créer et supprimer des comptes
        </div>
        {currentUser?.role === 'admin' && (
          <button className="btn-primary-agro" onClick={() => { setForm(EMPTY); setShowPwd(false); setModal(true) }}>
            <i className="bi bi-person-plus-fill"></i> Nouveau Compte
          </button>
        )}
      </div>

      <div className="card-agro">
        <SortableTable columns={columns} data={users} emptyMsg="Aucun utilisateur" />
      </div>

      {/* ── Modal Création ──────────────────────────────────────────────────── */}
      {modal && (
        <div className="modal-overlay-agro" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="modal-agro">
            <div className="modal-title-agro">
              <i className="bi bi-person-plus-fill" style={{ color:'var(--primary)' }}></i>
              Nouveau Compte
            </div>
            <div className="row g-3">
              <div className="col-12">
                <label className="form-label-agro">Nom Complet *</label>
                <input className="form-control-agro" value={form.nom} onChange={e=>setForm(f=>({...f,nom:e.target.value}))} placeholder="Ahmed Bennani" />
              </div>
              <div className="col-12">
                <label className="form-label-agro">Email *</label>
                <input className="form-control-agro" type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="ahmed@agroabdo.ma" />
              </div>
              <div className="col-12">
                <label className="form-label-agro">Mot de Passe * (min. 6 caractères)</label>
                <div style={{ position:'relative' }}>
                  <input className="form-control-agro" type={showPwd?'text':'password'} value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} placeholder="••••••••" style={{ paddingRight:40 }} />
                  <button type="button" onClick={()=>setShowPwd(s=>!s)} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text-soft)', fontSize:15 }}>
                    <i className={`bi ${showPwd?'bi-eye-slash':'bi-eye'}`}></i>
                  </button>
                </div>
              </div>
              <div className="col-12">
                <label className="form-label-agro">Rôle *</label>
                <select className="form-control-agro" value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>
                  {ROLES.map(r => (
                    <option key={r} value={r}>
                      {ROLE_CONFIG[r]?.label} — {r==='admin'?'Accès total':r==='technicien'?'Saisie terrain':'Lecture + Export CSV'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-12">
                <div style={{ background:'var(--bg)', borderRadius:8, padding:'10px 14px', fontSize:12 }}>
                  <i className={`bi ${ROLE_CONFIG[form.role]?.icon} me-2`} style={{ color:ROLE_CONFIG[form.role]?.color }}></i>
                  <strong>{ROLE_CONFIG[form.role]?.label}</strong> :&nbsp;
                  {form.role==='admin' && 'Accès complet à toutes les fonctionnalités'}
                  {form.role==='technicien' && 'Peut ajouter/modifier clients, commandes, arrivages'}
                  {form.role==='analyste' && 'Accès lecture + export CSV pour Power BI'}
                </div>
              </div>
            </div>
            <div className="modal-footer-agro">
              <button className="btn-outline-agro" onClick={()=>setModal(false)}>Annuler</button>
              <button className="btn-primary-agro" onClick={handleCreate} disabled={saving}>
                {saving?<><span className="spinner-border spinner-border-sm me-2"></span>Création en cours...</>:'Créer le compte'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Modification ──────────────────────────────────────────────── */}
      {editModal && editForm && (
        <div className="modal-overlay-agro" onClick={e=>e.target===e.currentTarget&&setEditModal(false)}>
          <div className="modal-agro" style={{ maxWidth:420 }}>
            <div className="modal-title-agro">
              <i className="bi bi-pencil-square" style={{ color:'var(--primary)' }}></i>
              Modifier le Compte
            </div>
            <div style={{ background:'var(--bg)', borderRadius:8, padding:'8px 14px', marginBottom:16, fontSize:12, color:'var(--text-soft)' }}>
              <i className="bi bi-envelope me-2"></i>{editForm.email}
              <span style={{ fontSize:10, marginLeft:8 }}>(email non modifiable)</span>
            </div>
            <div className="row g-3">
              <div className="col-12">
                <label className="form-label-agro">Nom Complet *</label>
                <input className="form-control-agro" value={editForm.nom} onChange={e=>setEditForm(f=>({...f,nom:e.target.value}))} placeholder="Nom complet" />
              </div>
              <div className="col-12">
                <label className="form-label-agro">Rôle *</label>
                <select className="form-control-agro" value={editForm.role} onChange={e=>setEditForm(f=>({...f,role:e.target.value}))}>
                  {ROLES.map(r => (
                    <option key={r} value={r}>{ROLE_CONFIG[r]?.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-12">
                <div style={{ background:'rgba(232,197,71,0.1)', border:'1px solid rgba(232,197,71,0.3)', borderRadius:8, padding:'8px 14px', fontSize:12, color:'#92710A' }}>
                  <i className="bi bi-info-circle me-2"></i>
                  Pour changer le mot de passe, utilisez la console Firebase Authentication.
                </div>
              </div>
            </div>
            <div className="modal-footer-agro">
              <button className="btn-outline-agro" onClick={()=>setEditModal(false)}>Annuler</button>
              <button className="btn-primary-agro" onClick={handleEdit} disabled={saving}>
                {saving?<><span className="spinner-border spinner-border-sm me-2"></span>Enregistrement...</>:'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}