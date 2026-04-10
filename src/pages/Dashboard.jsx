import { useEffect, useState, useMemo } from 'react'
import { Line, Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler } from 'chart.js'
import { useNavigate } from 'react-router-dom'
import SortableTable from '../components/SortableTable'
import ZonageVille from '../components/ZonageVille'
import { getAll, COLS, MAD, fmtDate, getTotal, getVentesParMois, getVentesParCategorie, getStockAlertes, getTopDebiteurs } from '../firebase'
import { getCatConfig } from '../config/categories'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler)

const MOIS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']

export default function Dashboard({ showToast, search }) {
  const navigate = useNavigate()
  const [loading, setLoading]       = useState(true)
  const [data, setData]             = useState(null)
  const [filtreMois, setFiltreMois] = useState('all')

  useEffect(() => {
    async function load() {
      try {
        const [produits, clients, commandes, paiements] = await Promise.all([
          getAll(COLS.produits), getAll(COLS.clients),
          getAll(COLS.commandes), getAll(COLS.paiements),
        ])
        setData({ produits, clients, commandes, paiements })
      } catch(e) { showToast('Erreur : ' + e.message, 'error') }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const debiteurs = useMemo(() => {
    if (!data) return []
    return getTopDebiteurs(data.clients, data.commandes, data.paiements, 10)
  }, [data])

  const filteredDebiteurs = useMemo(() => {
    if (!search || !search.trim()) return debiteurs
    const q = search.toLowerCase()
    return debiteurs.filter(d =>
      d.nom.toLowerCase().includes(q) ||
      d.zone.toLowerCase().includes(q) ||
      (d.ice||'').includes(q)
    )
  }, [search, debiteurs])

  if (loading) return (
    <div className="loading-box">
      <div className="spinner-agro"></div>
      <p>Connexion à Firestore...</p>
    </div>
  )

  const { produits, clients, commandes, paiements } = data
  const totalVentes   = commandes.reduce((s,c) => s + getTotal(c), 0)
  const totalPaye     = paiements.reduce((s,p) => s + p.montant, 0)
  const totalCredit   = totalVentes - totalPaye
  const alertes       = getStockAlertes(produits)
  const cats          = getVentesParCategorie(commandes, produits)
  const ventesParMois = getVentesParMois(commandes)
  const catLabels     = Object.keys(cats)
  const catVals       = Object.values(cats)
  const catColors     = catLabels.map(l => getCatConfig(l).color)

  const idxMap = { all:[0,1,2,3,4,5,6,7,8,9,10,11], q1:[0,1,2], q2:[3,4,5], q3:[6,7,8], q4:[9,10,11] }
  const idxs   = idxMap[filtreMois]

  const lineData = {
    labels: idxs.map(i => MOIS[i]),
    datasets: [
      { label:'Ventes', data:idxs.map(i=>ventesParMois.ventes[i]), borderColor:'#7B0D1E', backgroundColor:'rgba(123,13,30,0.07)', tension:0.4, fill:true, pointRadius:4, pointBackgroundColor:'#7B0D1E' },
      { label:'Encaissements', data:idxs.map(i=>ventesParMois.encaissements[i]), borderColor:'#3D9970', backgroundColor:'rgba(61,153,112,0.06)', tension:0.4, fill:true, pointRadius:4, pointBackgroundColor:'#3D9970' },
    ],
  }

  const lineOptions = {
    responsive: true,
    interaction: { mode:'index', intersect:false },
    plugins: {
      legend: { labels: { color:'#6B7280', font:{ family:'DM Sans', size:12 } } },
      tooltip: {
        backgroundColor:'var(--bg-card)', borderColor:'var(--border)', borderWidth:1,
        titleColor:'var(--text-main)', bodyColor:'var(--text-soft)',
        callbacks: { label: c => ` ${c.dataset.label}: ${MAD(c.raw)}` }
      }
    },
    scales: {
      x: { ticks:{ color:'#6B7280', font:{ family:'DM Sans' } }, grid:{ color:'var(--border)' } },
      y: { ticks:{ color:'#6B7280', font:{ family:'DM Sans' }, callback: v => 'MAD '+(v/1000).toFixed(0)+'k' }, grid:{ color:'var(--border)' } }
    }
  }

  const donutCatData = {
    labels: catLabels,
    datasets: [{ data:catVals, backgroundColor:catColors, borderWidth:0, hoverOffset:4 }]
  }
  const donutRecData = {
    labels: ['Recouvré','En Attente'],
    datasets: [{ data:[totalPaye, totalCredit], backgroundColor:['#3D9970','#C0392B'], borderWidth:0 }]
  }
  const donutOpts = {
    responsive: false,
    plugins: { legend:{ display:false }, tooltip:{ callbacks:{ label: c => ` ${c.label}: ${MAD(c.raw)}` } } }
  }

  const debiteursColumns = [
    { key:'nom',             label:'Client',           render: r => <strong>{r.nom}</strong> },
    { key:'zone',            label:'Zone',             render: r => <span className="badge-zone">{r.zone}</span> },
    { key:'solde',           label:'Solde Dû',         render: r => <span className="amount-neg">{MAD(r.solde)}</span> },
    { key:'dernierPaiement', label:'Dernier Paiement', render: r => <span style={{fontSize:12,color:'var(--text-soft)'}}>{r.dernierPaiement !== '—' ? fmtDate(r.dernierPaiement) : '—'}</span> },
    { key:'joursRetard',     label:'Retard',           render: r => <span className="badge-retard">{r.joursRetard}j</span> },
  ]

  return (
    <div>
      {/* ── KPI ─────────────────────────────────────────────────────────────── */}
      <div className="kpi-grid">
        <div className="kpi-card kpi-primary">
          <div className="kpi-label">Ventes Globales</div>
          <div className="kpi-trend trend-up"><i className="bi bi-arrow-up-right"></i> CA Total</div>
          <div className="kpi-value">{MAD(totalVentes)}</div>
        </div>

        <div className="kpi-card kpi-danger">
          <div className="kpi-label">Crédit en Attente</div>
          <div className="kpi-trend trend-down"><i className="bi bi-clock"></i> À recouvrer</div>
          <div className="kpi-value">{MAD(totalCredit)}</div>
          <button className="btn-primary-agro mt-2" style={{fontSize:12,padding:'5px 12px'}}
            onClick={() => navigate('/recouvrement')}>
            Relancer
          </button>
        </div>

        <div className="kpi-card kpi-gold">
          <div className="kpi-label">Ventes par Catégorie</div>
          <div style={{display:'flex',gap:14,alignItems:'center',marginTop:8}}>
            <Doughnut data={donutCatData} options={donutOpts} width={90} height={90} />
            <div style={{display:'flex',flexDirection:'column',gap:4}}>
              {catLabels.map((l,i) => (
                <span key={l} style={{fontSize:11,color:'var(--text-soft)',display:'flex',alignItems:'center',gap:5}}>
                  <span style={{width:8,height:8,borderRadius:2,background:catColors[i],display:'inline-block'}}></span>
                  {l}: {totalVentes ? Math.round(catVals[i]/totalVentes*100) : 0}%
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="kpi-card kpi-green">
          <div className="kpi-label">Stock & Alertes</div>
          <div style={{marginTop:10,display:'flex',flexDirection:'column',gap:8}}>
            {alertes.length === 0
              ? <span style={{color:'var(--accent-green)',fontSize:13}}><i className="bi bi-check-circle"></i> Tous les stocks OK</span>
              : alertes.slice(0,3).map(p => (
                <div key={p.id} style={{display:'flex',alignItems:'center',gap:8,fontSize:12.5}}>
                  <span style={{width:8,height:8,borderRadius:'50%',background:'var(--accent-danger)',flexShrink:0}}></span>
                  {p.nom} — <strong>{p.stock}</strong> {p.unite}
                </div>
              ))
            }
            {alertes.length > 0 && (
              <button className="btn-outline-agro" style={{fontSize:11,padding:'4px 10px',marginTop:4}}
                onClick={() => navigate('/stock')}>
                Voir Stock <i className="bi bi-arrow-right"></i>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── ZONAGE PAR VILLE + DÉBITEURS ─────────────────────────────────────── */}
      <div className="row g-3 mb-3">

        {/* Zonage par ville */}
        <div className="col-lg-4">
          <div className="card-agro h-100">
            <div className="card-header-agro">
              <span className="card-title-agro">Zonage par Ville</span>
              <span style={{fontSize:11,color:'var(--text-soft)'}}>{clients.length} clients</span>
            </div>
            <div className="p-3" style={{maxHeight:480, overflowY:'auto'}}>
              <ZonageVille
                clients={clients}
                commandes={commandes}
                paiements={paiements}
              />
            </div>
          </div>
        </div>

        {/* Top Débiteurs */}
        <div className="col-lg-8">
          <div className="card-agro h-100">
            <div className="card-header-agro">
              <span className="card-title-agro">
                Top Débiteurs
                {search && <span style={{fontSize:11,color:'var(--text-soft)',marginLeft:8,fontWeight:400}}>"{search}"</span>}
              </span>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <Doughnut data={donutRecData} options={donutOpts} width={70} height={70} />
                <div style={{fontSize:11.5,color:'var(--text-soft)'}}>
                  <div><span style={{width:8,height:8,background:'#3D9970',borderRadius:2,display:'inline-block',marginRight:5}}></span>Recouvré: {MAD(totalPaye)}</div>
                  <div><span style={{width:8,height:8,background:'#C0392B',borderRadius:2,display:'inline-block',marginRight:5}}></span>En attente: {MAD(totalCredit)}</div>
                </div>
              </div>
            </div>
            <SortableTable
              columns={debiteursColumns}
              data={filteredDebiteurs}
              emptyMsg={search ? `Aucun résultat pour "${search}"` : 'Aucun débiteur'}
            />
          </div>
        </div>
      </div>

      {/* ── CHART ────────────────────────────────────────────────────────────── */}
      <div className="card-agro">
        <div className="card-header-agro">
          <span className="card-title-agro">Évolution Mensuelle — Ventes & Encaissements</span>
          <select className="form-control-agro" style={{width:'auto',fontSize:12,padding:'5px 10px'}}
            value={filtreMois} onChange={e => setFiltreMois(e.target.value)}>
            <option value="all">Toute l'année</option>
            <option value="q1">Q1 (Jan–Mar)</option>
            <option value="q2">Q2 (Avr–Jun)</option>
            <option value="q3">Q3 (Jul–Sep)</option>
            <option value="q4">Q4 (Oct–Déc)</option>
          </select>
        </div>
        <div style={{padding:'16px 18px 18px'}}>
          <Line data={lineData} options={lineOptions} />
        </div>
      </div>
    </div>
  )
}