import { useState } from 'react'

/**
 * SortableTable — tableau avec tri par colonne
 *
 * Props:
 *   columns: [{ key, label, sortable?, render?(row) }]
 *   data: array of objects
 *   emptyMsg?: string
 */
export default function SortableTable({ columns, data, emptyMsg = 'Aucune donnée' }) {
  const [sortKey, setSortKey]   = useState(null)
  const [sortDir, setSortDir]   = useState('asc') // 'asc' | 'desc'

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sorted = [...data].sort((a, b) => {
    if (!sortKey) return 0
    let va = a[sortKey], vb = b[sortKey]
    // Numérique
    if (typeof va === 'number' && typeof vb === 'number') {
      return sortDir === 'asc' ? va - vb : vb - va
    }
    // Chaîne
    va = String(va ?? '').toLowerCase()
    vb = String(vb ?? '').toLowerCase()
    if (va < vb) return sortDir === 'asc' ? -1 : 1
    if (va > vb) return sortDir === 'asc' ?  1 : -1
    return 0
  })

  return (
    <div className="table-responsive">
      <table className="table-agro">
        <thead>
          <tr>
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
          {sorted.length === 0
            ? <tr><td colSpan={columns.length} style={{ textAlign: 'center', padding: 30, color: 'var(--text-soft)' }}>{emptyMsg}</td></tr>
            : sorted.map((row, i) => (
              <tr key={row.id ?? i}>
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
  )
}

function SortIcon({ active, dir }) {
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 1, opacity: active ? 1 : 0.3 }}>
      <i
        className="bi bi-caret-up-fill"
        style={{ fontSize: 8, color: active && dir === 'asc' ? 'var(--primary)' : 'var(--text-soft)', lineHeight: 1 }}
      ></i>
      <i
        className="bi bi-caret-down-fill"
        style={{ fontSize: 8, color: active && dir === 'desc' ? 'var(--primary)' : 'var(--text-soft)', lineHeight: 1 }}
      ></i>
    </span>
  )
}