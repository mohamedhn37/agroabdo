import { useEffect, useRef, useMemo, useState } from 'react'
import * as d3 from 'd3'
import { getTotal } from '../firebase'

export const REGIONS = [
  'Tanger-Tétouan-Al Hoceïma',
  "L'Oriental",
  'Fès-Meknès',
  'Rabat-Salé-Kénitra',
  'Béni Mellal-Khénifra',
  'Casablanca-Settat',
  'Marrakech-Safi',
  'Drâa-Tafilalet',
  'Souss-Massa',
  'Guelmim-Oued Noun',
  'Laâyoune-Sakia El Hamra',
  'Dakhla-Oued Ed-Dahab',
]

// Correspondance noms GeoJSON → noms app
// Basé sur les vrais noms du fichier maroc.geojson
function matchRegion(raw = '') {
  const n = raw.toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const MAP = {
    // Tanger
    'tanger-tetouan-al hoceima':    'Tanger-Tétouan-Al Hoceïma',
    'tanger-tetouan-hoceima':       'Tanger-Tétouan-Al Hoceïma',
    'tanger tetouan al hoceima':    'Tanger-Tétouan-Al Hoceïma',
    'tanger tetouan hoceima':       'Tanger-Tétouan-Al Hoceïma',
    'tangier-tetouan-al hoceima':   'Tanger-Tétouan-Al Hoceïma',

    // Oriental
    "l'oriental":                   "L'Oriental",
    'oriental':                     "L'Oriental",
    'l oriental':                   "L'Oriental",

    // Fès-Meknès
    'fes-meknes':                   'Fès-Meknès',
    'fes meknes':                   'Fès-Meknès',

    // Rabat
    'rabat-sale-kenitra':           'Rabat-Salé-Kénitra',
    'rabat sale kenitra':           'Rabat-Salé-Kénitra',

    // Béni Mellal
    'beni mellal-khenifra':         'Béni Mellal-Khénifra',
    'beni mellal khenifra':         'Béni Mellal-Khénifra',

    // Casablanca
    'casablanca-settat':            'Casablanca-Settat',
    'casablanca settat':            'Casablanca-Settat',

    // Marrakech
    'marrakech-safi':               'Marrakech-Safi',
    'marrakech safi':               'Marrakech-Safi',

    // Drâa — IMPORTANT : le GeoJSON utilise "Daraa-Tafilelt"
    'draa-tafilalet':               'Drâa-Tafilalet',
    'draa tafilalet':               'Drâa-Tafilalet',
    'daraa-tafilelt':               'Drâa-Tafilalet',
    'daraa tafilelt':               'Drâa-Tafilalet',
    'daraa-tafilalet':              'Drâa-Tafilalet',

    // Souss — IMPORTANT : le GeoJSON utilise "Souss Massa" (sans tiret)
    'souss-massa':                  'Souss-Massa',
    'souss massa':                  'Souss-Massa',

    // Guelmim
    'guelmim-oued noun':            'Guelmim-Oued Noun',
    'guelmim oued noun':            'Guelmim-Oued Noun',

    // Laâyoune — IMPORTANT : le GeoJSON utilise "Laayoune-Saguia Hamra"
    'laayoune-sakia el hamra':      'Laâyoune-Sakia El Hamra',
    'laayoune sakia el hamra':      'Laâyoune-Sakia El Hamra',
    'laayoune-saguia hamra':        'Laâyoune-Sakia El Hamra',
    'laayoune saguia hamra':        'Laâyoune-Sakia El Hamra',
    'laayoune-es-semara':           'Laâyoune-Sakia El Hamra',

    // Dakhla — IMPORTANT : le GeoJSON utilise "Dakhla-Oued Eddahab"
    'dakhla-oued ed-dahab':         'Dakhla-Oued Ed-Dahab',
    'dakhla oued ed dahab':         'Dakhla-Oued Ed-Dahab',
    'dakhla-oued eddahab':          'Dakhla-Oued Ed-Dahab',
    'dakhla oued eddahab':          'Dakhla-Oued Ed-Dahab',
    'oued ed-dahab-lagouira':       'Dakhla-Oued Ed-Dahab',
  }
  return MAP[n] || null
}

const MAD = n => 'MAD ' + Math.round(n).toLocaleString('fr-MA')

export default function MoroccoMap({ clients, commandes, paiements }) {
  const svgRef = useRef(null)
  const [geoData, setGeoData]     = useState(null)
  const [tooltip, setTooltip]     = useState(null)
  const [pos, setPos]             = useState({ x: 0, y: 0 })
  const [loading, setLoading]     = useState(true)

  // Charger le GeoJSON local depuis /public
  useEffect(() => {
    fetch('/maroc.geojson')
      .then(r => r.json())
      .then(data => { setGeoData(data); setLoading(false) })
      .catch(e => { console.error('GeoJSON load error:', e); setLoading(false) })
  }, [])

  // Normalise la zone d'un client vers une des 12 régions officielles
  function normalizeZone(zone = '') {
    const z = zone.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const ZONE_MAP = {
      // Zones officielles (déjà correctes)
      'tanger-tetouan-al hoceima':  'Tanger-Tétouan-Al Hoceïma',
      "l'oriental":                 "L'Oriental",
      'oriental':                   "L'Oriental",
      'fes-meknes':                 'Fès-Meknès',
      'rabat-sale-kenitra':         'Rabat-Salé-Kénitra',
      'beni mellal-khenifra':       'Béni Mellal-Khénifra',
      'casablanca-settat':          'Casablanca-Settat',
      'marrakech-safi':             'Marrakech-Safi',
      'draa-tafilalet':             'Drâa-Tafilalet',
      'souss-massa':                'Souss-Massa',
      'guelmim-oued noun':          'Guelmim-Oued Noun',
      'laayoune-sakia el hamra':    'Laâyoune-Sakia El Hamra',
      'dakhla-oued ed-dahab':       'Dakhla-Oued Ed-Dahab',
      // Anciens noms → nouvelles régions
      'gharb-chrarda':              'Rabat-Salé-Kénitra',
      'gharb chrarda':              'Rabat-Salé-Kénitra',
      'gharb':                      'Rabat-Salé-Kénitra',
      'tadla-azilal':               'Béni Mellal-Khénifra',
      'tadla azilal':               'Béni Mellal-Khénifra',
      'marrakech':                  'Marrakech-Safi',
      'doukkala-abda':              'Casablanca-Settat',
      'doukkala abda':              'Casablanca-Settat',
      'meknes-tafilalet':           'Fès-Meknès',
      'meknes tafilalet':           'Fès-Meknès',
      'chaouia-ouardigha':          'Casablanca-Settat',
      'souss':                      'Souss-Massa',
      'agadir':                     'Souss-Massa',
      'laayoune':                   'Laâyoune-Sakia El Hamra',
      'laayoune-saguia hamra':      'Laâyoune-Sakia El Hamra',
      'dakhla':                     'Dakhla-Oued Ed-Dahab',
      'tanger':                     'Tanger-Tétouan-Al Hoceïma',
      'kenitra':                    'Rabat-Salé-Kénitra',
      'rabat':                      'Rabat-Salé-Kénitra',
    }
    return ZONE_MAP[z] || zone // retourne la zone originale si pas trouvée
  }

  // Stats par région
  const regionStats = useMemo(() => {
    const stats = {}
    REGIONS.forEach(r => {
      // Normalise la zone de chaque client avant comparaison
      const rc    = clients.filter(c => normalizeZone(c.zone) === r)
      const rCmds = commandes.filter(c => rc.some(cl => cl.id === c.clientId))
      const tv    = rCmds.reduce((s, c) => s + getTotal(c), 0)
      const tp    = paiements.filter(p => rc.some(cl => cl.id === p.clientId)).reduce((s, p) => s + p.montant, 0)
      stats[r] = {
        nbClients:   rc.length,
        nbCommandes: rCmds.length,
        totalVentes: tv,
        totalPaye:   tp,
        totalCredit: tv - tp,
        taux:        tv > 0 ? Math.round(tp / tv * 100) : 0,
        clients:     rc.map(c => c.nom),
      }
    })
    return stats
  }, [clients, commandes, paiements])

  const maxClients = Math.max(...Object.values(regionStats).map(s => s.nbClients), 1)

  function getColor(appName) {
    const n = regionStats[appName]?.nbClients || 0
    if (!n) return '#EDE8E8'
    const t = n / maxClients
    return `rgb(${Math.round(237-(237-123)*t)},${Math.round(232-(232-13)*t)},${Math.round(232-(232-30)*t)})`
  }

  // Extraire le nom depuis les propriétés GeoJSON (essaie toutes les clés possibles)
  function getRegionName(props) {
    const val =
      props.region    || props.Region    ||
      props.name      || props.Name      || props.NAME      ||
      props.nom       || props.Nom       || props.NOM       ||
      props.NAME_1    || props.name_1    ||
      props.region_n  || props.REGION    ||
      props.libelle   || props.LIBELLE   ||
      ''
    return String(val).trim()
  }

  // Dessiner avec D3 quand GeoJSON chargé
  useEffect(() => {
    if (!geoData || !svgRef.current) return

    const W = 400, H = 640
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    // Fond océan
    svg.append('rect')
      .attr('width', W).attr('height', H)
      .attr('fill', '#E8EFF5').attr('rx', 8)

    // Projection — fitSize ajuste automatiquement pour tout le Maroc
    const projection = d3.geoMercator().fitSize([W, H], geoData)
    const pathGen    = d3.geoPath().projection(projection)

    // Régions
    svg.selectAll('path')
      .data(geoData.features)
      .enter().append('path')
      .attr('d', pathGen)
      .attr('fill', d => {
        const raw     = getRegionName(d.properties)
        const appName = matchRegion(raw) || raw
        return getColor(appName)
      })
      .attr('stroke', 'white')
      .attr('stroke-width', 0.8)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        d3.select(this)
          .attr('stroke', '#7B0D1E')
          .attr('stroke-width', 2)
          .style('filter', 'brightness(0.83)')
        const raw     = getRegionName(d.properties)
        const appName = matchRegion(raw) || raw
        const rect    = svgRef.current.getBoundingClientRect()
        setPos({ x: event.clientX - rect.left, y: event.clientY - rect.top })
        setTooltip({ name: appName, stats: regionStats[appName] || null })
      })
      .on('mousemove', function(event) {
        const rect = svgRef.current.getBoundingClientRect()
        setPos({ x: event.clientX - rect.left, y: event.clientY - rect.top })
      })
      .on('mouseout', function() {
        d3.select(this).attr('stroke', 'white').attr('stroke-width', 0.8).style('filter', 'none')
        setTooltip(null)
      })

    // Badges nombre de clients (cercle rouge + chiffre)
    geoData.features.forEach(feature => {
      const raw     = getRegionName(feature.properties)
      const appName = matchRegion(raw) || raw
      const n       = regionStats[appName]?.nbClients || 0
      if (!n) return

      const centroid = pathGen.centroid(feature)
      if (!centroid || isNaN(centroid[0])) return

      svg.append('circle')
        .attr('cx', centroid[0]).attr('cy', centroid[1])
        .attr('r', 12)
        .attr('fill', '#7B0D1E')
        .attr('opacity', 0.9)
        .style('pointer-events', 'none')

      svg.append('text')
        .attr('x', centroid[0]).attr('y', centroid[1])
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .style('font-size', '10px')
        .style('font-family', 'DM Sans, sans-serif')
        .style('font-weight', '800')
        .style('fill', 'white')
        .style('pointer-events', 'none')
        .text(n)
    })

  }, [geoData, regionStats])

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 50, color: 'var(--text-soft)' }}>
      <div className="spinner-agro"></div>
      <p style={{ fontSize: 12 }}>Chargement de la carte...</p>
    </div>
  )

  if (!geoData) return (
    <div style={{ textAlign: 'center', padding: 20, color: 'var(--accent-danger)', fontSize: 13 }}>
      ❌ Erreur : fichier <code>public/maroc.geojson</code> introuvable
    </div>
  )

  return (
    <div style={{ position: 'relative' }}>
      {/* Légende */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, fontSize:11, color:'var(--text-soft)' }}>
        <span>0</span>
        <div style={{ display:'flex', height:8, width:90, borderRadius:4, overflow:'hidden' }}>
          {[0, .25, .5, .75, 1].map((t, i) => {
            const r = Math.round(237-(237-123)*t)
            const g = Math.round(232-(232-13)*t)
            const b = Math.round(232-(232-30)*t)
            return <div key={i} style={{ flex:1, background:`rgb(${r},${g},${b})` }}></div>
          })}
        </div>
        <span>{maxClients} clients</span>
        <span style={{ marginLeft:'auto', fontSize:10, fontStyle:'italic' }}>Survole une région</span>
      </div>

      {/* SVG */}
      <div style={{ position: 'relative' }}>
        <svg
          ref={svgRef}
          viewBox="0 0 400 640"
          style={{ width: '100%', display: 'block', borderRadius: 8 }}
        />

        {/* Tooltip */}
        {tooltip && (
          <div style={{
            position: 'absolute',
            left:  pos.x > 200 ? pos.x - 225 : pos.x + 12,
            top:   Math.max(pos.y - 160, 0),
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderLeft: '3px solid #7B0D1E',
            borderRadius: 10,
            padding: '12px 15px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            zIndex: 300,
            minWidth: 215,
            pointerEvents: 'none',
          }}>
            <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:12, color:'#7B0D1E', marginBottom:8, lineHeight:1.3 }}>
              {tooltip.name}
            </div>

            {tooltip.stats ? (
              <div style={{ display:'flex', flexDirection:'column', gap:5, fontSize:12 }}>
                <Row label="Clients"   val={tooltip.stats.nbClients} />
                <Row label="Commandes" val={tooltip.stats.nbCommandes} />
                <div style={{ height:1, background:'var(--border)', margin:'2px 0' }}></div>
                <Row label="Ventes"    val={MAD(tooltip.stats.totalVentes)}  cls="amount-pos" />
                <Row label="Recouvré"  val={MAD(tooltip.stats.totalPaye)}    cls="amount-pos" />
                <Row label="Crédit"    val={MAD(tooltip.stats.totalCredit)}  cls="amount-neg" />
                <div style={{ marginTop:4 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3, fontSize:11 }}>
                    <span style={{ color:'var(--text-soft)' }}>Recouvrement</span>
                    <strong style={{ color: tooltip.stats.taux>=70?'#3D9970':tooltip.stats.taux>=40?'#E8C547':'#C0392B' }}>
                      {tooltip.stats.taux}%
                    </strong>
                  </div>
                  <div style={{ height:5, background:'var(--border)', borderRadius:3 }}>
                    <div style={{
                      width: `${tooltip.stats.taux}%`, height:'100%', borderRadius:3,
                      background: tooltip.stats.taux>=70?'#3D9970':tooltip.stats.taux>=40?'#E8C547':'#C0392B'
                    }}></div>
                  </div>
                </div>
                {tooltip.stats.clients.length > 0 && (
                  <div style={{ marginTop:4, fontSize:10.5, color:'var(--text-soft)', lineHeight:1.4 }}>
                    {tooltip.stats.clients.slice(0,3).join(', ')}
                    {tooltip.stats.clients.length > 3 && ` +${tooltip.stats.clients.length-3}`}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize:12, color:'var(--text-soft)' }}>
                Aucun client dans cette région
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, val, cls }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between' }}>
      <span style={{ color:'var(--text-soft)' }}>{label}</span>
      <strong className={cls||''} style={{ fontSize:12 }}>{val}</strong>
    </div>
  )
}