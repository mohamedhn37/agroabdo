// categories.js — Configuration centralisée des catégories produits
// Modifie ici pour changer les catégories dans toute l'app

export const CAT_CONFIG = {
  // ── Phytosanitaires ────────────────────────────────────────────────────────
  'Insecticide':    { color: '#E74C3C', bg: 'rgba(231,76,60,0.12)',   icon: 'bi-bug-fill',        groupe: 'Phytosanitaire' },
  'Acaricide':      { color: '#E74C3C', bg: 'rgba(231,76,60,0.12)',   icon: 'bi-bug',             groupe: 'Phytosanitaire' },
  'Fongicide':      { color: '#E74C3C', bg: 'rgba(231,76,60,0.12)',  icon: 'bi-capsule',         groupe: 'Phytosanitaire' },
  'Nématicide':     { color: '#E74C3C', bg: 'rgba(231,76,60,0.12)',  icon: 'bi-capsule-pill',    groupe: 'Phytosanitaire' },
  // ── Biostimulant ───────────────────────────────────────────────────────────
  'Biostimulant':   { color: '#2980B9', bg: 'rgba(41,128,185,0.12)',  icon: 'bi-lightning-fill',  groupe: 'Biostimulant'   },
  // ── Engrais ────────────────────────────────────────────────────────────────
  'Engrais':        { color: '#E8C547', bg: 'rgba(232,197,71,0.12)',  icon: 'bi-droplet-fill',    groupe: 'Engrais'        },
  // ── Semences ───────────────────────────────────────────────────────────────
  'Semences':       { color: '#27AE60', bg: 'rgba(39,174,96,0.12)',   icon: 'bi-flower1',         groupe: 'Semences'       },
}

export const CATS = Object.keys(CAT_CONFIG)

// Couleurs pour les graphiques (Chart.js)
export const CAT_CHART_COLORS = Object.values(CAT_CONFIG).map(c => c.color)

// Helper — retourne config d'une catégorie avec fallback
export function getCatConfig(cat) {
  return CAT_CONFIG[cat] || { color: '#6B7280', bg: 'rgba(107,114,128,0.12)', icon: 'bi-box', groupe: 'Autre' }
}