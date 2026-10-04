import { useCallback, useEffect, useState, type ReactNode } from 'react'
import DispatcherApp from './DispatcherApp'
import LoaderApp from './LoaderApp'
import DriverApp from './DriverApp'
import StoreApp from './StoreApp'
import SignupPage from './SignupPage'
import LoginPage from './LoginPage'
import { clearAuthSession, readAuthSession, roleForSession, saveAuthSession, type AuthSession } from './authSession'
import { ROLE_IDS, type Role } from './types'

const THEME_KEY = 'waypoint-theme'
type AppRoute = Role | 'login'

function readRole(): AppRoute | null {
  const hash = window.location.hash.replace(/^#\/?/, '')
  if (hash === 'login') return hash
  return (ROLE_IDS as string[]).includes(hash) ? hash as Role : null
}

function readTheme(): boolean {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved) return saved === 'dark'
  } catch { /* storage unavailable */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

export default function App() {
  const [role, setRole] = useState<AppRoute | null>(readRole)
  const [session, setSession] = useState<AuthSession | null>(readAuthSession)
  const [isDark, setIsDark] = useState<boolean>(readTheme)
  const [welcomeMessage, setWelcomeMessage] = useState('')

 
  useEffect(() => {
    const onHash = () => { setRole(readRole()); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    try { localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light') } catch { /* ignore */ }
  }, [isDark])

  useEffect(() => {
    if (!welcomeMessage) return
    const timeout = window.setTimeout(() => setWelcomeMessage(''), 5000)
    return () => window.clearTimeout(timeout)
  }, [welcomeMessage])

  const toggleDark = useCallback(() => setIsDark(d => !d), [])
  const login = useCallback((nextSession: AuthSession) => {
    saveAuthSession(nextSession)
    setSession(nextSession)
    setWelcomeMessage(`Welcome back, ${nextSession.username}!`)
    window.location.hash = `/${roleForSession(nextSession.role)}`
  }, [])
  const registerComplete = useCallback(() => { window.location.hash = '/login' }, [])
  const signOut = useCallback(() => {
    try {
      clearAuthSession()
    } catch (error) {
      console.error(error)
    }
    setSession(null)
    setWelcomeMessage('')
    window.location.hash = '/login'
  }, [])

  useEffect(() => {
    if (!session) return
    const remaining = session.expiresAt - Date.now()
    if (remaining <= 0) {
      signOut()
      return
    }
    const timeout = window.setTimeout(signOut, remaining)
    return () => window.clearTimeout(timeout)
  }, [session, signOut])

  if (!session) {
    if (role === null) return <SignupPage onRegistered={registerComplete} />
    return <LoginPage onLogin={login} />
  }

  const activeRole = roleForSession(session.role)
  const shared = {
    isDark,
    onToggleDark: toggleDark,
    onSwitchView: signOut,
    username: session.username,
    userRole: session.role,
  }

  let workspace: ReactNode
  switch (activeRole) {
    case 'dispatcher': workspace = <DispatcherApp {...shared} />; break
    case 'loader': workspace = <LoaderApp {...shared} />; break
    case 'driver': workspace = <DriverApp {...shared} vehicleType={session.vehicleType} startingLocation={session.location} />; break
    case 'store': workspace = <StoreApp {...shared} storeBrand={session.brand} storeLocation={session.location} />; break
  }

  return (
    <>
      {workspace}
      {welcomeMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-1/2 top-4 z-[100] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-xl border border-emerald-500/30 bg-slate-900 px-5 py-3 text-center text-sm font-medium text-emerald-300 shadow-xl sm:top-6"
        >
          {welcomeMessage}
        </div>
      )}
    </>
  )
}
