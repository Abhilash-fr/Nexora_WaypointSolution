import { useState, type FormEvent } from 'react'
import AuthPageShell from './AuthPageShell'
import { api } from './api'
import type { AuthSession } from './authSession'

export default function LoginPage({ onLogin }: { onLogin: (session: AuthSession) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const response = await api.login(username.trim(), password)
      onLogin({
        accessToken: response.access_token,
        username: username.trim(),
        role: response.role,
        brand: response.brand,
        vehicleType: response.vehicle_type,
        location: response.location,
        expiresAt: Date.now() + response.expires_in * 1000,
      })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not sign in. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthPageShell>
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-2xl shadow-black/20 sm:p-8">
        <div className="mb-7">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-teal-400">Welcome back</p>
          <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Sign in to Waypoint</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">Use your account details to open your role workspace.</p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="login-username" className="mb-2 block text-sm font-medium text-slate-200">Username</label>
            <input
              id="login-username"
              name="username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={event => setUsername(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-teal-400 focus:ring-4 focus:ring-teal-400/10"
              placeholder="Your username"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="mb-2 block text-sm font-medium text-slate-200">Password</label>
            <div className="relative">
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={event => setPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 pr-20 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-teal-400 focus:ring-4 focus:ring-teal-400/10"
                placeholder="Your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(show => !show)}
                className="absolute inset-y-0 right-3 my-auto min-h-10 px-2 text-xs font-medium text-slate-400 hover:text-teal-300"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {error && <p role="alert" className="rounded-xl border border-red-900 bg-red-950/50 px-4 py-3 text-sm leading-5 text-red-300">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="min-h-12 w-full rounded-xl bg-teal-400 px-4 py-3 text-base font-semibold text-slate-950 transition hover:bg-teal-300 focus:outline-none focus:ring-4 focus:ring-teal-300/20 disabled:cursor-wait disabled:opacity-60"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 border-t border-slate-800 pt-5 text-center text-sm text-slate-400">
          Still haven&apos;t registered yet?{' '}
          <a href="#/" className="font-semibold text-teal-300 hover:text-teal-200 focus:outline-none focus:underline">Register now</a>
        </p>
      </div>
    </AuthPageShell>
  )
}
