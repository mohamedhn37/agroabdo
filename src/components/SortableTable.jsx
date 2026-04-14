import { useState, useEffect } from 'react'

/**
 * SortableTable — tableau avec tri par colonne, pagination et numérotation
 *
 * Props:
 *   columns:      [{ key, label, sortable?, render?(row) }]
 *   data:         array of objects
 *   emptyMsg?:    string
 *   pageSize?:    number (default 20) — lignes par page
 */
export default function SortableTable({ columns, data, emptyMsg = 'Aucune donnée', pageSize = 20 }) {
  const [sortKey, setSortKey]     = useState(null)
  const [sortDir, setSortDir]     = useState('asc')
  const [currentPage, setCurrentPage] = useState(1)

  // Reset page to 1 whenever data or sort changes
  useEffect(() => { setCurrentPage(1) }, [data])

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
    setCurrentPage(1)
  }

  const sorted = [...data].sort((a, b) => {
    if (!sortKey) return 0
    let va = a[sortKey], vb = b[sortKey]
    if (typeof va === 'number' && typeof vb === 'number') {
      return sortDir === 'asc' ? va - vb : vb - va
    }
    va = String(va ?? '').toLowerCase()
    vb = String(vb ?? '').toLowerCase()
    if (va < vb) return sortDir === 'asc' ? -1 : 1
    if (va > vb) return sortDir === 'asc' ?  1 : -1
    return 0
  })

  const totalPages  = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage    = Math.min(currentPage, totalPages)
  const startIndex  = (safePage - 1) * pageSize
  const paginated   = sorted.slice(startIndex, startIndex + pageSize)

  return (
    <div>
      <div className="table-responsive">
        <table className="table-agro">
          <thead>
            <tr>
              {/* Colonne numéro */}
              <th style={{ width: 48, textAlign: 'center', color: 'var(--text-soft)', fontWeight: 600, fontSize: 12 }}>#</th>

              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                  style={{
                    cursor: col.sortable !== false ? 'pointer' : 'default',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    {col.label}
                    {col.sortable !== false && (
                      <SortIcon active={sortKey === col.key} dir={sortDir} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0
              ? (
                <tr>
                  <td colSpan={columns.length + 1} style={{ textAlign: 'center', padding: 30, color: 'var(--text-soft)' }}>
                    {emptyMsg}
                  </td>
                </tr>
              )
              : paginated.map((row, i) => (
                <tr key={row.id ?? i}>
                  {/* Numéro séquentiel absolu sur toute la liste */}
                  <td style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-soft)', fontWeight: 600 }}>
                    {startIndex + i + 1}
                  </td>
                  {columns.map(col => (
                    <td key={col.key}>
                      {col.render ? col.render(row) : row[col.key] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

      {/* ── Pagination ──────────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <Pagination
          currentPage={safePage}
          totalPages={totalPages}
          totalItems={sorted.length}
          pageSize={pageSize}
          startIndex={startIndex}
          onPage={setCurrentPage}
        />
      )}

      {/* Compteur en bas même sans pagination */}
      {totalPages === 1 && sorted.length > 0 && (
        <div style={{ padding: '8px 4px', fontSize: 12, color: 'var(--text-soft)', textAlign: 'right' }}>
          {sorted.length} résultat{sorted.length > 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}

function Pagination({ currentPage, totalPages, totalItems, pageSize, startIndex, onPage }) {
  const endIndex = Math.min(startIndex + pageSize, totalItems)

  // Build page number buttons — show max 5 around current
  const pages = []
  const delta = 2
  const left  = Math.max(1, currentPage - delta)
  const right = Math.min(totalPages, currentPage + delta)

  if (left > 1) { pages.push(1); if (left > 2) pages.push('...') }
  for (let i = left; i <= right; i++) pages.push(i)
  if (right < totalPages) { if (right < totalPages - 1) pages.push('...'); pages.push(totalPages) }

  const btnBase = {
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '4px 10px',
    fontSize: 12,
    fontFamily: 'var(--font-body)',
    cursor: 'pointer',
    background: 'none',
    color: 'var(--text-main)',
    transition: 'all 0.15s',
  }
  const btnActive = {
    ...btnBase,
    background: 'var(--primary)',
    borderColor: 'var(--primary)',
    color: 'white',
    fontWeight: 700,
    cursor: 'default',
  }
  const btnDisabled = { ...btnBase, opacity: 0.35, cursor: 'not-allowed' }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 4px', flexWrap: 'wrap', gap: 8 }}>
      {/* Info */}
      <span style={{ fontSize: 12, color: 'var(--text-soft)' }}>
        Affichage <strong>{startIndex + 1}–{endIndex}</strong> sur <strong>{totalItems}</strong> résultats
      </span>

      {/* Boutons */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {/* Précédent */}
        <button
          style={currentPage === 1 ? btnDisabled : btnBase}
          disabled={currentPage === 1}
          onClick={() => onPage(p => p - 1)}
        >
          <i className="bi bi-chevron-left"></i>
        </button>

        {pages.map((p, i) =>
          p === '...'
            ? <span key={`dots-${i}`} style={{ padding: '4px 6px', fontSize: 12, color: 'var(--text-soft)' }}>…</span>
            : (
              <button
                key={p}
                style={p === currentPage ? btnActive : btnBase}
                onClick={() => onPage(p)}
              >
                {p}
              </button>
            )
        )}

        {/* Suivant */}
        <button
          style={currentPage === totalPages ? btnDisabled : btnBase}
          disabled={currentPage === totalPages}
          onClick={() => onPage(p => p + 1)}
        >
          <i className="bi bi-chevron-right"></i>
        </button>
      </div>
    </div>
  )
}

function SortIcon({ active, dir }) {
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 1, opacity: active ? 1 : 0.3 }}>
      <i className="bi bi-caret-up-fill"   style={{ fontSize: 8, color: active && dir === 'asc'  ? 'var(--primary)' : 'var(--text-soft)', lineHeight: 1 }}></i>
      <i className="bi bi-caret-down-fill" style={{ fontSize: 8, color: active && dir === 'desc' ? 'var(--primary)' : 'var(--text-soft)', lineHeight: 1 }}></i>
    </span>
  )
}
