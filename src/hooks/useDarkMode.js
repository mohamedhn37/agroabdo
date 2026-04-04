import { useState, useEffect } from 'react'

export default function useDarkMode() {
  const [dark, setDark] = useState(() => localStorage.getItem('agroabdo-dark') === 'true')

  useEffect(() => {
    document.body.classList.toggle('dark-mode', dark)
    localStorage.setItem('agroabdo-dark', dark)
  }, [dark])

  return [dark, () => setDark(d => !d)]
}