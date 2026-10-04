import type { ReactNode } from 'react'

export default function AuthPageShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-[100dvh] bg-slate-950 text-slate-100">
      <div className="lg:grid lg:min-h-[100dvh] lg:grid-cols-2">
      <section className="relative hidden overflow-hidden border-r border-white/10 bg-slate-900 px-10 py-12 lg:flex lg:flex-col lg:justify-between xl:px-16">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-teal-500/15 blur-3xl" />
        <div className="absolute -bottom-44 -right-32 h-[28rem] w-[28rem] rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="relative max-w-xl py-12">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-teal-400">One connected operation</p>
          <h1 className="mt-5 text-4xl font-semibold leading-tight text-white xl:text-5xl">
            The right view for every part of the journey.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-slate-400">
            Coordinate dispatch, prepare orders, and keep deliveries moving from a screen built for your role and device.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-3">
            {[
              ['▦', 'Dispatch', 'TV & desktop'],
              ['⌂', 'Store', 'Desktop'],
              ['➤', 'Driver', 'Mobile'],
              ['▣', 'Loader', 'Tablet'],
            ].map(([icon, role, device]) => (
              <div key={role} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/10 text-teal-300">{icon}</span>
                <div>
                  <p className="text-sm font-medium text-slate-100">{role}</p>
                  <p className="font-mono text-[10px] text-slate-500">{device}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative font-mono text-[10px] uppercase tracking-widest text-slate-600">
          Waypoint Logistics · Secure workspace
        </p>
      </section>

      <section className="flex min-h-[100dvh] items-center justify-center px-4 py-8 sm:px-8 lg:px-10">
        <div className="w-full max-w-md">
          {children}
        </div>
      </section>
      </div>
    </main>
  )
}
