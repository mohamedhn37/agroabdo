import { initializeApp } from "firebase/app"
import {
  getFirestore, collection, doc,
  getDocs, addDoc, updateDoc, deleteDoc, setDoc, getDoc, runTransaction,
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
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

const app = initializeApp(firebaseConfig)
export const db   = getFirestore(app)
export const auth = getAuth(app)

// ── Collections ─────────────────────────────────────────────────────────────
export const COLS = {
  produits:   "produits",
  clients:    "clients",
  commandes:  "commandes",
  paiements:  "paiements",
  arrivages:  "arrivages",
  users:      "users",
  categories: "categories",   // catégories produits dynamiques
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

// ── Numérotation séquentielle ────────────────────────────────────────────────
// Utilise un document compteur par collection dans "counters/{colName}"
// Garantit l'incrémentation atomique même si deux utilisateurs créent en même temps
export const getNextNumero = async (colName) => {
  const counterRef = doc(db, 'counters', colName)
  return await runTransaction(db, async (transaction) => {
    const counterDoc = await transaction.get(counterRef)
    const next = (counterDoc.exists() ? counterDoc.data().value : 0) + 1
    transaction.set(counterRef, { value: next })
    return next
  })
}

// Crée un document avec numéro séquentiel automatique
export const addItemWithNumero = async (colName, data) => {
  const numero = await getNextNumero(colName)
  const r = await addDoc(collection(db, colName), { numero, ...data })
  return { id: r.id, numero }
}

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

// Disable user profile — marks as deleted so they can no longer log in.
// Note: the Firebase Auth account itself can only be deleted via the
// Firebase Admin SDK (server-side) or the Firebase Console.
export const deleteUserProfile = (uid) =>
  updateItem(COLS.users, uid, { actif: false, deleted: true, deletedAt: new Date().toISOString() })

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