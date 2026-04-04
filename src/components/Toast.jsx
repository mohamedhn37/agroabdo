export default function Toast({ msg, type, show }) {
  return (
    <div className={`toast-agro ${show ? 'show' : ''} ${type === 'error' ? 'error' : ''}`}>
      <i className={`bi ${type === 'error' ? 'bi-exclamation-triangle-fill' : 'bi-check-circle-fill'}`}
         style={{ color: type === 'error' ? 'var(--accent-danger)' : 'var(--accent-green)', fontSize: 16 }}>
      </i>
      {msg}
    </div>
  )
}