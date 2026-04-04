import { initializeApp } from "firebase/app"
import {
  getFirestore, collection, doc,
  getDocs, addDoc, updateDoc, deleteDoc, setDoc, getDoc,
} from "firebase/firestore"
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  updatePassword,
  deleteUser as firebaseDeleteUser,
  onAuthStateChanged,
} from "firebase/auth"

const firebaseConfig = {
  apiKey: "AIzaSyD0BHqoZm8CasxiAdpyPYb1F9JsOx6S3mI",
  authDomain: "abdoagrodatabase.firebaseapp.com",
  projectId: "abdoagrodatabase",
  storageBucket: "abdoagrodatabase.firebasestorage.app",
  messagingSenderId: "1083766542743",
  appId: "1:1083766542743:web:b24cdf3bf3a2e292e9b4d2",
  measurementId: "G-7QMC2HVN6N",
}

const app = initializeApp(firebaseConfig)
export const db   = getFirestore(app)
export const auth = getAuth(app)

// ── Collections ─────────────────────────────────────────────────────────────
export const COLS = {
  produits:  "produits",
  clients:   "clients",
  commandes: "commandes",
  paiements: "paiements",
  arrivages: "arrivages",
  users:     "users",        // profils utilisateurs (rôle, nom, etc.)
}

// ── CRUD Firestore ───────────────────────────────────────────────────────────
export const getAll = async (colName) => {
  const snap = await getDocs(collection(db, colName))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}
export const getOne = async (colName, id) => {
  const snap = await getDoc(doc(db, colName, id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}
export const addItem    = async (colName, data) => { const r = await addDoc(collection(db, colName), data); return r.id }
export const setItem    = async (colName, id, data) => setDoc(doc(db, colName, id), data)
export const updateItem = async (colName, id, data) => updateDoc(doc(db, colName, id), data)
export const deleteItem = async (colName, id) => deleteDoc(doc(db, colName, id))

// ── Auth functions ───────────────────────────────────────────────────────────
export const loginUser  = (email, password) => signInWithEmailAndPassword(auth, email, password)
export const logoutUser = () => signOut(auth)
export const onAuthChange = (cb) => onAuthStateChanged(auth, cb)

// Créer un compte + profil Firestore
export const createUser = async ({ email, password, nom, role }) => {
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  await setItem(COLS.users, cred.user.uid, {
    uid:   cred.user.uid,
    email,
    nom,
    role,  // 'admin' | 'technicien' | 'analyste'
    createdAt: new Date().toISOString(),
    actif: true,
  })
  return cred.user
}

// Supprimer profil Firestore (l'auth user se gère côté Admin SDK en prod)
export const deleteUserProfile = (uid) => deleteItem(COLS.users, uid)

// ── Calculs métier ───────────────────────────────────────────────────────────
export const getTotal = (commande) =>
  (commande.lignes || []).reduce((s, l) => s + l.qte * l.prixUnit, 0)

export const getSoldeClient = (clientId, commandes, paiements) => {
  const cmds     = commandes.filter(c => c.clientId === clientId)
  const totalDu  = cmds.reduce((s, c) => s + getTotal(c), 0)
  const totalPaye = paiements.filter(p => p.clientId === clientId).reduce((s, p) => s + p.montant, 0)
  return { totalDu, totalPaye, solde: totalDu - totalPaye }
}

export const getVentesParMois = (commandes) => {
  const ventes = Array(12).fill(0), encaissements = Array(12).fill(0)
  commandes.forEach(c => {
    const m = new Date(c.date).getMonth()
    ventes[m]        += getTotal(c)
    encaissements[m] += c.paiementRecu || 0
  })
  return { ventes, encaissements }
}

export const getVentesParCategorie = (commandes, produits) => {
  const cats = {}
  commandes.forEach(cmd =>
    (cmd.lignes || []).forEach(l => {
      const prod = produits.find(p => p.id === l.produitId)
      if (prod) cats[prod.categorie] = (cats[prod.categorie] || 0) + l.qte * l.prixUnit
    })
  )
  return cats
}

export const getVentesParZone = (commandes, clients) => {
  const zones = {}
  commandes.forEach(cmd => {
    const client = clients.find(c => c.id === cmd.clientId)
    if (client) zones[client.zone] = (zones[client.zone] || 0) + getTotal(cmd)
  })
  return zones
}

export const getStockAlertes  = (produits) => produits.filter(p => p.stock <= p.stockMin)

export const getTopDebiteurs  = (clients, commandes, paiements, n = 5) =>
  clients.map(c => {
    const { solde } = getSoldeClient(c.id, commandes, paiements)
    const lastCmd   = commandes.filter(cmd => cmd.clientId === c.id).sort((a,b) => new Date(b.date)-new Date(a.date))[0]
    const lastPay   = paiements.filter(p => p.clientId === c.id).sort((a,b) => new Date(b.date)-new Date(a.date))[0]
    return { ...c, solde, joursRetard: lastCmd ? Math.floor((new Date()-new Date(lastCmd.date))/86400000) : 0, dernierPaiement: lastPay ? lastPay.date : '—' }
  }).filter(c => c.solde > 0).sort((a,b) => b.solde-a.solde).slice(0, n)

// ── Helpers format ───────────────────────────────────────────────────────────
export const MAD     = (n) => "MAD " + Math.round(n).toLocaleString("fr-MA")
export const fmtDate = (d) => new Date(d).toLocaleDateString("fr-MA")