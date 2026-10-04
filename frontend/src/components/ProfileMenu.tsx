import { LogOut } from 'lucide-react'
import type { SignupRole } from '../types'

const ROLE_LABELS: Record<SignupRole, string> = {
  dispatcher: 'Dispatcher',
  loader: 'Loader',
  driver: 'Driver',
  store_manager: 'Store Manager',
}

export default function ProfileMenu({ username, role, onSignOut, dark = false }: {
  username: string
  role: SignupRole
  onSignOut: () => void
  dark?: boolean
}) {
  const initials = username.trim().slice(0, 2).toUpperCase() || 'U'

  return (
    <details className="relative shrink-0">
      <summary
        aria-label="Open profile menu"
        className={`flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-xl border px-2.5 py-1.5 transition-colors [&::-webkit-details-marker]:hidden ${
          dark
            ? 'border-white/15 bg-white/5 text-white hover:bg-white/10'
            : 'border-slate-200 bg-white text-slate-700 hover:border-teal-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100'
        }`}
      >
        <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${
          dark ? 'bg-white/15 text-white' : 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200'
        }`}>
          {initials}
        </span>
        <span className="hidden max-w-32 text-left sm:block">
          <span className="block truncate text-xs font-semibold">{username}</span>
          <span className={`block text-[10px] ${dark ? 'text-white/60' : 'text-slate-500 dark:text-slate-400'}`}>{ROLE_LABELS[role]}</span>
        </span>
        <span aria-hidden="true" className="text-xs opacity-60">⌄</span>
      </summary>
      <div className="absolute right-0 top-full z-[60] mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-800 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
        <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <p className="truncate text-sm font-semibold">{username}</p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{ROLE_LABELS[role]} workspace</p>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          className="flex min-h-11 w-full items-center gap-2 px-4 text-left text-sm text-slate-600 transition-colors hover:bg-red-50 hover:text-red-700 dark:text-slate-300 dark:hover:bg-red-950/40 dark:hover:text-red-300"
        >
          <LogOut size={16} aria-hidden="true" />
          Sign out
        </button>
      </div>
    </details>
  )
}
