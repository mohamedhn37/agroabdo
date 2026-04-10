import { useMemo, useState } from 'react'
import { getTotal, getSoldeClient, MAD } from '../firebase'

export default function ZonageVille({ clients, commandes, paiements }) {
  const [selected, setSelected] = useState(null) // ville sélectionnée pour voir ses clients
  const [viewMode, setViewMode] = useState('ville') // 'ville' | 'zone'

  // ── Stats par ville ─────────────────────────────────────────────────────
  const statsByVille = useMemo(() => {
    const map = {}
    clients.forEach(c => {
      const key = (c.ville || 'Non renseigné').trim()
      if (!map[key]) map[key] = { ville: key, zone: c.zone, nbClients: 0, totalVentes: 0, totalPaye: 0, clients: [] }
      const cCmds = commandes.filter(cmd => cmd.clientId === c.id)
      const tv    = cCmds.reduce((s, cmd) => s + getTotal(cmd), 0)
      const tp    = paiements.filter(p => p.clientId === c.id).reduce((s, p) => s + p.montant, 0)
      map[key].nbClients++
      map[key].totalVentes += tv
      map[key].totalPaye   += tp
      map[key].clients.push({ ...c, solde: tv - tp, totalVentes: tv })
    })
    return Object.values(map).sort((a, b) => b.totalVentes - a.totalVentes)
  }, [clients, commandes, paiements])

  // ── Stats par zone ───────────────────────────────────────────────────────
  const statsByZone = useMemo(() => {
    const map = {}
    clients.forEach(c => {
      const key = (c.zone || 'Non renseigné').trim()
      if (!map[key]) map[key] = { zone: key, nbClients: 0, totalVentes: 0, totalPaye: 0, clients: [] }
      const cCmds = commandes.filter(cmd => cmd.clientId === c.id)
      const tv    = cCmds.reduce((s, cmd) => s + getTotal(cmd), 0)
      const tp    = paiements.filter(p => p.clientId === c.id).reduce((s, p) => s + p.montant, 0)
      map[key].nbClients++
      map[key].totalVentes += tv
      map[key].totalPaye   += tp
      map[key].clients.push({ ...c, solde: tv - tp, totalVentes: tv })
    })
    return Object.values(map).sort((a, b) => b.totalVentes - a.totalVentes)
  }, [clients, commandes, paiements])

  const stats    = viewMode === 'ville' ? statsByVille : statsByZone
  const maxVentes = Math.max(...stats.map(s => s.totalVentes), 1)
  const totalVentesGlobal = stats.reduce((s, v) => s + v.totalVentes, 0)

  const selectedData = selected ? stats.find(s => (viewMode === 'ville' ? s.ville : s.zone) === selected) : null

  return (
    <div>
      {/* Toggle ville / zone */}
      <div style={{ display:'flex', gap:6, marginBottom:14 }}>
        {['ville','zone'].map(mode => (
          <button key={mode} onClick={() => { setViewMode(mode); setSelected(null) }}
            style={{
              padding:'5px 14px', borderRadius:6, border:'1px solid var(--border)',
              background: viewMode===mode ? 'var(--primary)' : 'none',
              color: viewMode===mode ? 'white' : 'var(--text-soft)',
              fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'var(--font-body)',
              transition:'all 0.2s',
            }}>
            <i className={`bi ${mode==='ville'?'bi-building':'bi-map'} me-1`}></i>
            Par {mode === 'ville' ? 'Ville' : 'Région'}
          </button>
        ))}
      </div>

      {stats.length === 0 ? (
        <div style={{ textAlign:'center', padding:30, color:'var(--text-soft)', fontSize:13 }}>
          Aucun client enregistré
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {stats.map(s => {
            const key     = viewMode === 'ville' ? s.ville : s.zone
            const pct     = Math.round(s.totalVentes / maxVentes * 100)
            const pctCA   = totalVentesGlobal > 0 ? Math.round(s.totalVentes / totalVentesGlobal * 100) : 0
            const taux    = s.totalVentes > 0 ? Math.round(s.totalPaye / s.totalVentes * 100) : 0
            const isSelected = selected === key

            return (
              <div key={key}
                onClick={() => setSelected(isSelected ? null : key)}
                style={{
                  background: isSelected ? 'var(--primary-ultra)' : 'var(--bg)',
                  border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: 10,
                  padding: '12px 14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {/* Header ligne */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <i className={`bi ${viewMode==='ville'?'bi-building':'bi-map-fill'}`}
                       style={{ color:'var(--primary)', fontSize:13 }}></i>
                    <span style={{ fontWeight:600, fontSize:13 }}>{key}</span>
                    <span style={{ background:'var(--primary-ultra)', color:'var(--primary)', fontSize:10, fontWeight:700, padding:'1px 7px', borderRadius:4 }}>
                      {s.nbClients} client{s.nbClients>1?'s':''}
                    </span>
                    {viewMode === 'ville' && s.zone && (
                      <span style={{ fontSize:10, color:'var(--text-soft)' }}>{s.zone}</span>
                    )}
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div className="amount-pos" style={{ fontSize:13, fontWeight:700 }}>{MAD(s.totalVentes)}</div>
                    <div style={{ fontSize:10, color:'var(--text-soft)' }}>{pctCA}% du CA</div>
                  </div>
                </div>

                {/* Barre CA */}
                <div style={{ height:5, background:'var(--border)', borderRadius:3, marginBottom:5 }}>
                  <div style={{ width:`${pct}%`, height:'100%', background:'var(--primary)', borderRadius:3, transition:'width 0.6s ease' }}></div>
                </div>

                {/* Taux recouvrement */}
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text-soft)' }}>
                  <span>Recouvrement : <strong style={{ color: taux>=70?'var(--accent-green)':taux>=40?'#E8C547':'var(--accent-danger)' }}>{taux}%</strong></span>
                  <span style={{ color:'var(--accent-danger)' }}>
                    Crédit : {MAD(s.totalVentes - s.totalPaye)}
                  </span>
                </div>

                {/* Détail clients si sélectionné */}
                {isSelected && (
                  <div style={{ marginTop:10, borderTop:'1px solid var(--border)', paddingTop:10 }}>
                    <div style={{ fontSize:11, color:'var(--text-soft)', marginBottom:6, fontWeight:600, textTransform:'uppercase', letterSpacing:0.5 }}>
                      Clients dans cette {viewMode === 'ville' ? 'ville' : 'région'}
                    </div>
                    {s.clients.sort((a,b) => b.totalVentes - a.totalVentes).map(cl => (
                      <div key={cl.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:'1px solid var(--border)', fontSize:12 }}>
                        <div>
                          <span style={{ fontWeight:600 }}>{cl.nom}</span>
                          {viewMode === 'ville' && <span style={{ fontSize:10, color:'var(--text-soft)', marginLeft:6 }}>{cl.zone}</span>}
                        </div>
                        <div style={{ textAlign:'right' }}>
                          <div className="amount-pos" style={{ fontSize:12 }}>{MAD(cl.totalVentes)}</div>
                          {cl.solde > 0 && <div className="amount-neg" style={{ fontSize:10 }}>Crédit: {MAD(cl.solde)}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}