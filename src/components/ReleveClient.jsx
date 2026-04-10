import { useMemo, useRef } from 'react'
import { getTotal, MAD, fmtDate } from '../firebase'

export default function ReleveClient({ client, commandes, paiements, produits, periode, onClose }) {
  const printRef = useRef(null)

  // ── Construire les lignes du relevé ───────────────────────────────────────
  const lignes = useMemo(() => {
    const rows = []

    // 1. Lignes DÉBIT = commandes du client
    commandes
      .filter(c => c.clientId === client.id)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .forEach(cmd => {
        const total = getTotal(cmd)
        // Libellé = noms des produits
        const libelle = (cmd.lignes || []).map(l => {
          const prod = produits.find(p => p.id === l.produitId)
          return prod ? `${prod.nom} (${l.qte} ${prod.unite || 'u'})` : l.produitId
        }).join(' + ')

        rows.push({
          id:      cmd.id,
          date:    cmd.date,
          libelle: libelle || `Facture ${cmd.id.substring(0,8)}`,
          debit:   total,
          credit:  0,
          vnvMontant: 0,
          vnvDate: null,
          mode:    '—',
          type:    'commande',
        })
      })

    // 2. Lignes CRÉDIT = paiements du client
    paiements
      .filter(p => p.clientId === client.id)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .forEach(pay => {
        if (pay.statut === 'vnv') {
          // VNV : chèque reçu mais pas encore versé
          rows.push({
            id:         pay.id,
            date:       pay.date,
            libelle:    `Encaissement Chèque${pay.ref ? ' N°' + pay.ref : ''}`,
            debit:      0,
            credit:     0,
            vnvMontant: pay.montant,
            vnvDate:    pay.dateEcheance,
            mode:       pay.mode || 'Chèque',
            type:       'vnv',
          })
        } else {
          // Encaissé
          rows.push({
            id:         pay.id,
            date:       pay.date,
            libelle:    `Encaissement${pay.mode ? ' ' + pay.mode : ''}${pay.ref ? ' N°' + pay.ref : ''}`,
            debit:      0,
            credit:     pay.montant,
            vnvMontant: 0,
            vnvDate:    null,
            mode:       pay.mode || '—',
            type:       'encaissement',
          })
        }
      })

    // Trier par date
    return rows.sort((a, b) => new Date(a.date) - new Date(b.date))
  }, [client, commandes, paiements, produits])

  // ── Totaux ────────────────────────────────────────────────────────────────
  const totalDebit  = lignes.reduce((s, l) => s + l.debit, 0)
  const totalCredit = lignes.reduce((s, l) => s + l.credit, 0)
  const totalVNV    = lignes.reduce((s, l) => s + l.vnvMontant, 0)
  const solde       = totalDebit - totalCredit - totalVNV

  // ── Export PDF ────────────────────────────────────────────────────────────
  function exportPDF() {
    const today = new Date().toLocaleDateString('fr-MA', { day:'2-digit', month:'2-digit', year:'numeric' })
    const periodeLabel = periode === 'mois' ? 'Ce mois' : periode === 'trim' ? 'Ce trimestre' : periode === 'annee' ? 'Cette année' : 'Toute période'

    const rowsHTML = lignes.map(l => `
      <tr>
        <td>${fmtDate(l.date)}</td>
        <td class="libelle">${l.libelle}</td>
        <td class="num">${l.debit > 0 ? l.debit.toLocaleString('fr-MA') + ' MAD' : ''}</td>
        <td class="num">${l.credit > 0 ? l.credit.toLocaleString('fr-MA') + ' MAD' : ''}</td>
        <td class="center">${l.mode !== '—' ? l.mode : ''}</td>
        <td class="num vnv">${l.vnvMontant > 0 ? l.vnvMontant.toLocaleString('fr-MA') + ' MAD' : ''}</td>
        <td class="center">${l.vnvDate ? fmtDate(l.vnvDate) : ''}</td>
      </tr>
    `).join('')

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Relevé — ${client.nom}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; padding: 30px; }
  .header { text-align: right; margin-bottom: 20px; font-size: 11px; color: #555; }
  .company { text-align: center; margin-bottom: 24px; }
  .company h1 { font-size: 18px; font-weight: bold; color: #7B0D1E; letter-spacing: 1px; }
  .company p { font-size: 11px; color: #555; margin-top: 4px; }
  .client-info { margin-bottom: 20px; }
  .client-info h2 { font-size: 14px; font-weight: bold; text-transform: uppercase; margin-bottom: 6px; }
  .client-info p { font-size: 11px; color: #444; line-height: 1.6; }
  .intro { margin-bottom: 16px; font-size: 11.5px; line-height: 1.7; }
  .intro strong { color: #7B0D1E; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
  th { background: #7B0D1E; color: white; padding: 8px 6px; font-size: 11px; text-align: left; }
  td { padding: 6px 6px; font-size: 11px; border-bottom: 1px solid #eee; vertical-align: top; }
  tr:nth-child(even) td { background: #fdf8f8; }
  .num { text-align: right; font-weight: 600; white-space: nowrap; }
  .center { text-align: center; }
  .libelle { max-width: 220px; line-height: 1.4; }
  .vnv { color: #E8A020; }
  .total-row td { background: #f5f0f0 !important; font-weight: bold; border-top: 2px solid #7B0D1E; padding: 8px 6px; }
  .solde-row td { background: #7B0D1E !important; color: white !important; font-weight: bold; font-size: 12px; padding: 10px 6px; }
  .footer { margin-top: 30px; font-size: 11px; color: #555; line-height: 1.8; }
  @media print {
    body { padding: 15px; }
    .no-print { display: none; }
  }
</style>
</head>
<body>

<div class="header">Casablanca, le ${today}</div>

<div class="company">
  <h1>🌿 AGROABDO</h1>
  <p>Système de Gestion Agrofournitures — Maroc</p>
</div>

<div class="client-info">
  <h2>${client.nom}</h2>
  <p>
    ${client.adresse ? client.adresse + '<br>' : ''}
    ${client.ville ? client.ville : ''} ${client.zone ? '— ' + client.zone : ''}<br>
    ${client.tel ? 'Tél : ' + client.tel : ''}
    ${client.ice ? ' | ICE : ' + client.ice : ''}
  </p>
</div>

<p class="intro">
  Messieurs,<br><br>
  Nous avons l'honneur de vous communiquer, ci-dessous, le relevé de votre compte dans nos livres
  arrêté à la date du <strong>${today}</strong> — Période : <strong>${periodeLabel}</strong>
  et qui accuse un solde de <strong>${solde.toLocaleString('fr-MA')} MAD</strong>.
</p>

<table>
  <thead>
    <tr>
      <th>DATE</th>
      <th>LIBELLÉ</th>
      <th>DÉBIT</th>
      <th>CRÉDIT</th>
      <th>MODE</th>
      <th>VNV (Montant)</th>
      <th>VNV (Échéance)</th>
    </tr>
  </thead>
  <tbody>
    ${rowsHTML}
    <tr class="total-row">
      <td colspan="2">TOTAL</td>
      <td class="num">${totalDebit.toLocaleString('fr-MA')} MAD</td>
      <td class="num">${totalCredit.toLocaleString('fr-MA')} MAD</td>
      <td></td>
      <td class="num vnv">${totalVNV > 0 ? totalVNV.toLocaleString('fr-MA') + ' MAD' : '—'}</td>
      <td></td>
    </tr>
    <tr class="solde-row">
      <td colspan="2">SOLDE</td>
      <td class="num" colspan="5">${solde.toLocaleString('fr-MA')} MAD</td>
    </tr>
  </tbody>
</table>

<div class="footer">
  <br>
  En vous souhaitant bonne réception.<br>
  Veuillez agréer, Messieurs, nos salutations distinguées.<br><br>
  <strong>AgroAbdo</strong>
</div>

</body>
</html>`

    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
    setTimeout(() => { win.print() }, 500)
  }

  return (
    <div className="modal-overlay-agro" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-agro" style={{ maxWidth:900, width:'95vw', maxHeight:'90vh', overflowY:'auto' }}>

        {/* Header modal */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
          <div>
            <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:18, color:'var(--primary)' }}>
              {client.nom}
            </div>
            <div style={{ fontSize:12, color:'var(--text-soft)', marginTop:3 }}>
              {client.ville} {client.zone ? '— '+client.zone : ''} {client.ice ? '| ICE: '+client.ice : ''}
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn-primary-agro" onClick={exportPDF}>
              <i className="bi bi-file-earmark-pdf-fill"></i> Exporter PDF
            </button>
            <button className="btn-outline-agro" onClick={onClose}>
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
        </div>

        {/* Résumé solde */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:18 }}>
          {[
            { label:'Total Débit',  val: MAD(totalDebit),  color:'var(--accent-danger)' },
            { label:'Total Crédit', val: MAD(totalCredit), color:'var(--accent-green)'  },
            { label:'VNV Total',    val: MAD(totalVNV),    color:'#E8A020'              },
            { label:'SOLDE',        val: MAD(solde),       color: solde>0?'var(--accent-danger)':'var(--accent-green)', big:true },
          ].map(s => (
            <div key={s.label} style={{ background:'var(--bg)', borderRadius:8, padding:'10px 12px', border:`1px solid ${s.big?s.color:'var(--border)'}` }}>
              <div style={{ fontSize:10, color:'var(--text-soft)', textTransform:'uppercase', letterSpacing:1, marginBottom:3 }}>{s.label}</div>
              <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize: s.big?18:14, color:s.color }}>{s.val}</div>
            </div>
          ))}
        </div>

        {/* Tableau relevé */}
        <div ref={printRef} style={{ overflowX:'auto' }}>
          <table className="table-agro" style={{ fontSize:12 }}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Libellé</th>
                <th style={{ textAlign:'right', color:'var(--accent-danger)' }}>Débit</th>
                <th style={{ textAlign:'right', color:'var(--accent-green)' }}>Crédit</th>
                <th>Mode</th>
                <th style={{ textAlign:'right', color:'#E8A020' }}>VNV Montant</th>
                <th style={{ color:'#E8A020' }}>VNV Échéance</th>
              </tr>
            </thead>
            <tbody>
              {lignes.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign:'center', padding:30, color:'var(--text-soft)' }}>Aucune opération sur cette période</td></tr>
              ) : (
                lignes.map((l, i) => (
                  <tr key={l.id + i} style={{
                    background: l.type==='commande' ? 'rgba(192,57,43,0.03)'
                      : l.type==='vnv' ? 'rgba(232,160,32,0.05)'
                      : 'rgba(61,153,112,0.03)'
                  }}>
                    <td style={{ whiteSpace:'nowrap', color:'var(--text-soft)', fontSize:11 }}>{fmtDate(l.date)}</td>
                    <td style={{ maxWidth:280, lineHeight:1.4, fontSize:11.5 }}>
                      {l.type === 'commande' && <i className="bi bi-receipt me-1" style={{ color:'var(--accent-danger)', fontSize:10 }}></i>}
                      {l.type === 'encaissement' && <i className="bi bi-check-circle me-1" style={{ color:'var(--accent-green)', fontSize:10 }}></i>}
                      {l.type === 'vnv' && <i className="bi bi-clock me-1" style={{ color:'#E8A020', fontSize:10 }}></i>}
                      {l.libelle}
                    </td>
                    <td style={{ textAlign:'right', fontWeight:600, color:'var(--accent-danger)', whiteSpace:'nowrap' }}>
                      {l.debit > 0 ? l.debit.toLocaleString('fr-MA') + ' MAD' : ''}
                    </td>
                    <td style={{ textAlign:'right', fontWeight:600, color:'var(--accent-green)', whiteSpace:'nowrap' }}>
                      {l.credit > 0 ? l.credit.toLocaleString('fr-MA') + ' MAD' : ''}
                    </td>
                    <td style={{ fontSize:11 }}>
                      {l.mode !== '—' ? (
                        <span style={{ background:'var(--primary-ultra)', color:'var(--primary)', fontSize:10.5, fontWeight:600, padding:'2px 7px', borderRadius:4 }}>
                          {l.mode}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ textAlign:'right', fontWeight:700, color:'#E8A020', whiteSpace:'nowrap' }}>
                      {l.vnvMontant > 0 ? l.vnvMontant.toLocaleString('fr-MA') + ' MAD' : '—'}
                    </td>
                    <td style={{ fontSize:11, color:'#E8A020', whiteSpace:'nowrap' }}>
                      {l.vnvDate ? fmtDate(l.vnvDate) : '—'}
                    </td>
                  </tr>
                ))
              )}

              {/* Ligne TOTAL */}
              <tr style={{ background:'var(--bg)', fontWeight:700, borderTop:'2px solid var(--primary)' }}>
                <td colSpan={2} style={{ fontWeight:700, color:'var(--text-main)', padding:'10px 16px' }}>TOTAL</td>
                <td style={{ textAlign:'right', color:'var(--accent-danger)', fontWeight:800, whiteSpace:'nowrap' }}>
                  {totalDebit.toLocaleString('fr-MA')} MAD
                </td>
                <td style={{ textAlign:'right', color:'var(--accent-green)', fontWeight:800, whiteSpace:'nowrap' }}>
                  {totalCredit.toLocaleString('fr-MA')} MAD
                </td>
                <td></td>
                <td style={{ textAlign:'right', color:'#E8A020', fontWeight:800, whiteSpace:'nowrap' }}>
                  {totalVNV > 0 ? totalVNV.toLocaleString('fr-MA') + ' MAD' : '—'}
                </td>
                <td></td>
              </tr>

              {/* Ligne SOLDE */}
              <tr style={{ background:'var(--primary)', fontWeight:800 }}>
                <td colSpan={2} style={{ color:'white', fontWeight:800, fontSize:14, padding:'12px 16px' }}>SOLDE</td>
                <td colSpan={5} style={{ textAlign:'right', color:'white', fontWeight:800, fontSize:16, whiteSpace:'nowrap', paddingRight:16 }}>
                  {solde.toLocaleString('fr-MA')} MAD
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>
    </div>
  )
}