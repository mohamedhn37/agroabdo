import { useState } from 'react'
import { getAll, COLS, getTotal } from '../firebase'

function toCSV(headers, rows) {
  const escape = v => {
    const s = String(v ?? '').replace(/"/g, '""')
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s
  }
  return [
    headers.join(','),
    ...rows.map(r => headers.map(h => escape(r[h])).join(','))
  ].join('\n')
}

function downloadCSV(filename, csvContent) {
  const BOM = '\uFEFF' // UTF-8 BOM pour Excel
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function ExportCSV({ showToast }) {
  const [loading, setLoading] = useState(false)
  const [modal, setModal]     = useState(false)

  async function exportAll() {
    setLoading(true)
    setModal(false)
    try {
      const [produits, clients, commandes, paiements, arrivages] = await Promise.all([
        getAll(COLS.produits), getAll(COLS.clients),
        getAll(COLS.commandes), getAll(COLS.paiements), getAll(COLS.arrivages),
      ])

      const date = new Date().toISOString().split('T')[0]

      // ── Produits ──
      downloadCSV(`produits_${date}.csv`, toCSV(
        ['id','nom','categorie','unite','prixBase','stock','stockMin','fournisseur'],
        produits
      ))

      // ── Clients ──
      await new Promise(r => setTimeout(r, 300))
      downloadCSV(`clients_${date}.csv`, toCSV(
        ['id','nom','zone','ville','adresse','tel','ice'],
        clients
      ))

      // ── Commandes enrichies ──
      await new Promise(r => setTimeout(r, 300))
      const rows_cmd = commandes.map(c => {
        const client = clients.find(cl => cl.id === c.clientId)
        return {
          id:          c.id,
          date:        c.date,
          clientId:    c.clientId,
          clientNom:   client?.nom || '',
          zone:        client?.zone || '',
          total:       getTotal(c),
          paiementRecu: c.paiementRecu || 0,
          restant:     getTotal(c) - (c.paiementRecu || 0),
          statut:      c.statut,
          nbLignes:    (c.lignes || []).length,
        }
      })
      downloadCSV(`commandes_${date}.csv`, toCSV(
        ['id','date','clientId','clientNom','zone','total','paiementRecu','restant','statut','nbLignes'],
        rows_cmd
      ))

      // ── Lignes de commande (détail) ──
      await new Promise(r => setTimeout(r, 300))
      const rows_lignes = []
      commandes.forEach(c => {
        const client = clients.find(cl => cl.id === c.clientId)
        ;(c.lignes || []).forEach(l => {
          const prod = produits.find(p => p.id === l.produitId)
          rows_lignes.push({
            commandeId:  c.id,
            date:        c.date,
            clientNom:   client?.nom || '',
            zone:        client?.zone || '',
            produitId:   l.produitId,
            produitNom:  prod?.nom || '',
            categorie:   prod?.categorie || '',
            qte:         l.qte,
            prixUnit:    l.prixUnit,
            total:       l.qte * l.prixUnit,
          })
        })
      })
      downloadCSV(`lignes_commandes_${date}.csv`, toCSV(
        ['commandeId','date','clientNom','zone','produitNom','categorie','qte','prixUnit','total'],
        rows_lignes
      ))

      // ── Paiements ──
      await new Promise(r => setTimeout(r, 300))
      const rows_pay = paiements.map(p => {
        const client = clients.find(cl => cl.id === p.clientId)
        return { ...p, clientNom: client?.nom || '', zone: client?.zone || '' }
      })
      downloadCSV(`paiements_${date}.csv`, toCSV(
        ['id','date','clientId','clientNom','zone','montant','mode','ref','commandeId'],
        rows_pay
      ))

      // ── Arrivages ──
      await new Promise(r => setTimeout(r, 300))
      const rows_arr = arrivages.map(a => {
        const prod = produits.find(p => p.id === a.produitId)
        return { ...a, produitNom: prod?.nom || '', categorie: prod?.categorie || '' }
      })
      downloadCSV(`arrivages_${date}.csv`, toCSV(
        ['id','date','produitId','produitNom','categorie','qte','prixAchat','fournisseur'],
        rows_arr
      ))

      showToast('6 fichiers CSV exportés ✓ — Prêt pour Power BI !')
    } catch(e) {
      showToast('Erreur export : ' + e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function exportSingle(col) {
    setLoading(true)
    setModal(false)
    try {
      const data = await getAll(col)
      if (!data.length) return showToast('Aucune donnée à exporter', 'error')
      const headers = Object.keys(data[0]).filter(k => k !== 'lignes')
      const date    = new Date().toISOString().split('T')[0]
      downloadCSV(`${col}_${date}.csv`, toCSV(headers, data))
      showToast(`${col}.csv exporté ✓`)
    } catch(e) {
      showToast('Erreur : ' + e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Bouton topbar */}
      <button
        className="menu-toggle"
        onClick={() => setModal(true)}
        title="Exporter les données CSV"
        disabled={loading}
      >
        {loading
          ? <span className="spinner-border spinner-border-sm" style={{ width:14, height:14 }}></span>
          : <i className="bi bi-download" style={{ fontSize: 16, color: 'var(--text-soft)' }}></i>
        }
      </button>

      {/* Modal export */}
      {modal && (
        <div className="modal-overlay-agro" onClick={e => e.target===e.currentTarget && setModal(false)}>
          <div className="modal-agro" style={{ maxWidth:440 }}>
            <div className="modal-title-agro">
              <i className="bi bi-download" style={{ color:'var(--primary)' }}></i>
              Export Données CSV
            </div>

            <p style={{ fontSize:13, color:'var(--text-soft)', marginBottom:16 }}>
              Téléchargez vos données pour analyse dans <strong>Power BI</strong>, Excel ou tout autre outil.
            </p>

            {/* Export tout */}
            <button className="btn-primary-agro w-100 mb-3" onClick={exportAll} style={{ justifyContent:'center', padding:'12px' }}>
              <i className="bi bi-file-earmark-zip-fill"></i>
              Exporter TOUT (6 fichiers CSV)
            </button>

            <div style={{ fontSize:11, color:'var(--text-soft)', textTransform:'uppercase', letterSpacing:1, marginBottom:10, fontWeight:600 }}>
              Ou exporter par collection
            </div>

            {/* Export individuel */}
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {[
                { col: COLS.clients,   label: 'Clients',              icon: 'bi-people-fill' },
                { col: COLS.produits,  label: 'Produits',             icon: 'bi-box-seam-fill' },
                { col: COLS.commandes, label: 'Commandes',            icon: 'bi-receipt' },
                { col: COLS.paiements, label: 'Paiements',            icon: 'bi-cash-coin' },
                { col: COLS.arrivages, label: 'Arrivages Stock',      icon: 'bi-truck' },
              ].map(item => (
                <button key={item.col} className="btn-outline-agro d-flex align-items-center gap-2"
                  onClick={() => exportSingle(item.col)}
                  style={{ justifyContent:'flex-start', padding:'9px 14px' }}>
                  <i className={`bi ${item.icon}`} style={{ color:'var(--primary)', fontSize:14 }}></i>
                  {item.label}
                  <i className="bi bi-arrow-down-circle ms-auto" style={{ fontSize:13, color:'var(--text-soft)' }}></i>
                </button>
              ))}
            </div>

            <div style={{ marginTop:16, padding:'10px 14px', background:'rgba(61,153,112,0.08)', borderRadius:8, fontSize:12, color:'#2e7d32' }}>
              <i className="bi bi-info-circle me-2"></i>
              Les fichiers CSV incluent le BOM UTF-8 pour un affichage correct des caractères arabes/français dans Excel.
            </div>

            <div className="modal-footer-agro">
              <button className="btn-outline-agro" onClick={() => setModal(false)}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}