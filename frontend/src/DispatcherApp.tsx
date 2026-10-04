import { useState, useEffect } from 'react'
import { Flag, LogOut } from 'lucide-react'
import { api, type BackendOrder, type BackendVehicle, type LoaderFlag, type StoreReceipt } from './api'
import ProfileMenu from './components/ProfileMenu'
import type { SignupRole } from './types'
import ThemeToggle from './components/ThemeToggle'
import {
  NAV_ITEMS,
  REASON_CODES,
  type BrandTab,
  type CompletedTrip,
  type DeferralEntry,
  type NavItem,
  type Order,
  type OrderStatus,
  type TempReq,
  type Vehicle,
  type VehicleType,
} from './data/dispatcherData'

function pct(val: number, max: number) { return Math.min(100, Math.round((val / max) * 100)) }

function calcLoad(v: Vehicle, orders: Order[], trip: 1 | 2) {
  const ids = trip === 1 ? v.trip1Orders : v.trip2Orders
  const matched = orders.filter(o => ids.includes(o.id))
  return { weight: matched.reduce((s, o) => s + o.weight, 0), volume: matched.reduce((s, o) => s + o.volume, 0) }
}

function fmtDate() {
  return new Date().toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
}

function StatusBadge({ status, onAssign }: { status: OrderStatus; onAssign?: () => void }) {
  const cfg = {
    Unassigned: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600',
    Assigned: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/40 dark:text-teal-300 dark:border-teal-700',
    Deferred: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700',
    Delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700',
  }[status]
  if (status === 'Deferred' && onAssign) {
    return (
      <button
        type="button"
        onClick={onAssign}
        title="Assign this deferred order to a vehicle"
        aria-label="Open vehicle assignment for deferred order"
        className={`inline-flex items-center gap-1 font-mono text-[10px] tracking-wide px-2 py-0.5 rounded border transition-colors hover:border-teal-400 hover:bg-teal-50 hover:text-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-400 dark:hover:bg-teal-900/40 dark:hover:text-teal-300 ${cfg}`}
      >
        {status}<span aria-hidden="true">↻</span>
      </button>
    )
  }
  return <span className={`inline-flex items-center font-mono text-[10px] tracking-wide px-2 py-0.5 rounded border ${cfg}`}>{status}</span>
}

function TempBadge({ temp }: { temp: TempReq }) {
  return temp === 'Reefer'
    ? <span className="inline-flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded border bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700">❄ Reefer</span>
    : <span className="inline-flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700">◉ Ambient</span>
}

function FuelBar({ used, quota }: { used: number; quota: number }) {
  const p = pct(used, quota)
  const color = p >= 90 ? 'bg-red-500' : p >= 70 ? 'bg-amber-400' : 'bg-teal-500'
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${p}%` }} />
      </div>
      <span className={`font-mono text-[10px] w-8 text-right shrink-0 ${p >= 90 ? 'text-red-500' : p >= 70 ? 'text-amber-600' : 'text-slate-400'}`}>{p}%</span>
    </div>
  )
}

function Sidebar({ active, onNavigate, collapsed, onToggle, onSwitchView, pendingConfirmations, mobileOpen, pendingOrders, deferredOrders, loaderFlagCount, storeReceiptCount }: {
  active: NavItem; onNavigate: (id: NavItem) => void; collapsed: boolean; onToggle: () => void
  onSwitchView?: () => void; pendingConfirmations: number; mobileOpen: boolean; pendingOrders: number; deferredOrders: number; loaderFlagCount: number; storeReceiptCount: number
}) {
  const pendingCount = pendingOrders
  const deferredCount = deferredOrders
  const badges: Partial<Record<NavItem, number>> = {
    'order-queue': pendingCount, 'deferrals': deferredCount,
    'delivery-confirmation': pendingConfirmations, 'loader-flags': loaderFlagCount,
    'store-receipts': storeReceiptCount,
  }

  return (
    <aside className={`flex flex-col bg-slate-800 dark:bg-slate-900 shrink-0 fixed inset-y-0 left-0 z-50 transition-transform duration-200 lg:static lg:translate-x-0 lg:transition-all ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} ${collapsed ? 'w-14' : 'w-52'}`}>
      <div className={`flex items-center gap-3 px-4 py-4 border-b border-slate-700/60 ${collapsed ? 'justify-center px-0' : ''}`}>
        <div className="w-7 h-7 rounded bg-teal-500 flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-sm leading-none">W</span>
        </div>
        {!collapsed && (
          <div>
            <div className="text-white font-semibold text-sm leading-tight">Waypoint</div>
            <div className="font-mono text-[9px] text-slate-400 tracking-widest uppercase">Dispatch</div>
          </div>
        )}
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto py-3 space-y-0.5 px-2">
        {NAV_ITEMS.map(item => {
          const isActive = active === item.id
          const badge = badges[item.id]
          const hasNotificationDot = ['order-queue', 'deferrals', 'loader-flags', 'store-receipts', 'delivery-confirmation'].includes(item.id)
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-left transition-colors group relative ${
                isActive ? 'bg-teal-500/20 text-teal-300' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/60'
              } ${collapsed ? 'justify-center' : ''}`}
            >
              <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center text-base leading-none ${isActive ? 'text-teal-400' : 'text-slate-500 group-hover:text-slate-300'}`}>
                {item.id === 'loader-flags' ? <Flag size={16} aria-hidden="true" /> : item.icon}
              </span>
              {!collapsed && <span className="text-xs font-medium">{item.label}</span>}
              {!collapsed && badge !== undefined && badge > 0 && (
                hasNotificationDot ? (
                  <span className="ml-auto h-2 w-2 rounded-full bg-red-500" role="img" aria-label={`${badge} notifications`} title={`${badge} notifications`} />
                ) : (
                <span className={`ml-auto font-mono text-[10px] ${item.id === 'loader-flags'
                  ? isActive ? 'text-teal-200' : 'text-slate-400'
                  : `px-1.5 py-0.5 rounded-full ${item.id === 'deferrals' ? 'bg-red-900/60 text-red-400' : item.id === 'delivery-confirmation' || item.id === 'store-receipts' ? 'bg-teal-900/60 text-teal-300' : 'bg-amber-900/60 text-amber-400'}`
                }`}>{badge}</span>
                )
              )}
              {collapsed && badge !== undefined && badge > 0 && (
                <span className={`absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full ${hasNotificationDot ? 'bg-red-500' : 'bg-amber-400'}`} />
              )}
            </button>
          )
        })}
      </nav>

      {onSwitchView && (
        <button onClick={onSwitchView} title="Sign out" aria-label="Sign out"
          className={`flex items-center gap-2 px-4 py-2.5 text-slate-500 hover:text-teal-400 transition-colors text-xs font-mono ${collapsed ? 'justify-center px-0' : ''}`}>
          <LogOut size={16} aria-hidden="true" />
          {!collapsed && <span>Sign out</span>}
        </button>
      )}
      <button onClick={onToggle}
        className={`flex items-center gap-2 px-4 py-3 border-t border-slate-700/60 text-slate-500 hover:text-slate-300 transition-colors text-xs font-mono ${collapsed ? 'justify-center px-0' : ''}`}>
        <span className="text-base">{mobileOpen ? '✕' : collapsed ? '›' : '‹'}</span>
        {!collapsed && <span>{mobileOpen ? 'Close' : 'Collapse'}</span>}
      </button>
    </aside>
  )
}

function Header({ search, onSearch, isDark, onToggleDark, onMenu, username, userRole, onSignOut }: {
  search: string; onSearch: (v: string) => void; isDark: boolean; onToggleDark: () => void; onMenu: () => void
  username: string; userRole: SignupRole; onSignOut: () => void
}) {
  const [time, setTime] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t) }, [])
  const timeStr = time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  return (
    <header className="h-14 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2 sm:gap-4 px-3 sm:px-5 shrink-0">
      <button onClick={onMenu} aria-label="Open navigation" className="lg:hidden w-9 h-9 shrink-0 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300 flex items-center justify-center text-lg">☰</button>
      <div className="relative flex-1 max-w-sm">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">⌕</span>
        <input value={search} onChange={e => onSearch(e.target.value)}
          placeholder="Search orders, outlets, districts…"
          className="w-full pl-8 pr-4 py-1.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-lg placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400/40 focus:border-teal-400" />
      </div>
      <div className="hidden md:block flex-1" />
      <div className="hidden sm:block text-right">
        <div className="font-mono text-xs text-slate-700 dark:text-slate-200 font-medium">{timeStr}</div>
        <div className="font-mono text-[10px] text-slate-400 dark:text-slate-500">{fmtDate()}</div>
      </div>
      <ThemeToggle isDark={isDark} onToggle={onToggleDark} />
      <div className="hidden sm:block h-8 w-px bg-slate-200 dark:bg-slate-700" />
      <ProfileMenu username={username} role={userRole} onSignOut={onSignOut} />
    </header>
  )
}

function OrderQueuePanel({ orders, search, onAllocate, onDefer }: {
  orders: Order[]; search: string; onAllocate: (orderId: string) => void
  onDefer: (orderId: string) => void
}) {
  const [brandTab, setBrandTab] = useState<BrandTab>('All')
  const [statusFilter, setStatusFilter] = useState<'All' | OrderStatus>('All')
  const [sortKey, setSortKey] = useState<'id' | 'weight' | 'district'>('id')

  const brandTabs: BrandTab[] = ['All', 'Waypoint Fresh', 'Waypoint Style', 'Waypoint Tech']
  const filtered = orders
    .filter(o => brandTab === 'All' || o.brand === brandTab)
    .filter(o => statusFilter === 'All' || o.status === statusFilter)
    .filter(o => !search || o.id.toLowerCase().includes(search.toLowerCase()) || o.outletId.toLowerCase().includes(search.toLowerCase()) || o.district.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sortKey === 'weight' ? b.weight - a.weight : sortKey === 'district' ? a.district.localeCompare(b.district) : a.id.localeCompare(b.id))

  const counts = { All: orders.length, Unassigned: orders.filter(o => o.status === 'Unassigned').length, Assigned: orders.filter(o => o.status === 'Assigned').length, Deferred: orders.filter(o => o.status === 'Deferred').length, Delivered: orders.filter(o => o.status === 'Delivered').length }
  const brandCounts: Record<BrandTab, number> = { All: orders.length, 'Waypoint Fresh': orders.filter(o => o.brand === 'Waypoint Fresh').length, 'Waypoint Style': orders.filter(o => o.brand === 'Waypoint Style').length, 'Waypoint Tech': orders.filter(o => o.brand === 'Waypoint Tech').length }
  const brandColor: Record<BrandTab, string> = { All: 'border-teal-500 text-teal-700 dark:text-teal-300', 'Waypoint Fresh': 'border-emerald-500 text-emerald-700 dark:text-emerald-300', 'Waypoint Style': 'border-violet-500 text-violet-700 dark:text-violet-300', 'Waypoint Tech': 'border-blue-500 text-blue-700 dark:text-blue-300' }

  return (
    <div className="flex flex-col h-full min-w-0">
      <div className="flex border-b border-slate-200 dark:border-slate-700 shrink-0">
        {brandTabs.map(tab => (
          <button key={tab} onClick={() => setBrandTab(tab)}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${brandTab === tab ? `${brandColor[tab]} bg-white dark:bg-slate-800` : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
            {tab === 'All' ? 'All Orders' : tab}
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">{brandCounts[tab]}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 shrink-0">
        <div className="flex gap-1">
          {(['All', 'Unassigned', 'Assigned', 'Deferred'] as const).map(f => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={`font-mono text-[10px] px-2.5 py-1 rounded border transition-colors ${statusFilter === f ? 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 shadow-sm' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
              {f} <span className="opacity-60">{counts[f as keyof typeof counts] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <select value={sortKey} onChange={e => setSortKey(e.target.value as typeof sortKey)}
          className="font-mono text-[10px] bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-slate-500 dark:text-slate-300 focus:outline-none">
          <option value="id">Sort: Order ID</option>
          <option value="weight">Sort: Weight ↓</option>
          <option value="district">Sort: District</option>
        </select>
        <button onClick={() => { const first = filtered.find(o => o.status === 'Unassigned'); if (first) onAllocate(first.id) }}
          className="bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:border-teal-400 text-slate-600 dark:text-slate-300 hover:text-teal-700 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
          + Manual Assign
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full min-w-[1120px] text-sm border-collapse">
          <thead className="sticky top-0 bg-white dark:bg-slate-800 z-10">
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="w-36 py-2.5 pl-4 pr-4 text-left font-mono text-[10px] text-slate-400 uppercase tracking-widest whitespace-nowrap">Order ID</th>
              <th className="w-64 py-2.5 pr-4 text-left font-mono text-[10px] text-slate-400 uppercase tracking-widest whitespace-nowrap">Items</th>
              <th className="w-24 py-2.5 pr-4 text-left font-mono text-[10px] text-slate-400 uppercase tracking-widest whitespace-nowrap">Outlet ID</th>
              <th className="w-24 py-2.5 pr-4 text-left font-mono text-[10px] text-slate-400 uppercase tracking-widest whitespace-nowrap">District</th>
              <th className="w-24 py-2.5 pr-4 text-left font-mono text-[10px] text-slate-400 uppercase tracking-widest whitespace-nowrap">Brand</th>
              <th className="w-28 py-2.5 pr-4 text-left font-mono text-[10px] text-slate-400 uppercase tracking-widest whitespace-nowrap">Temp Req</th>
              <th className="w-24 py-2.5 pr-4 text-right font-mono text-[10px] text-slate-400 uppercase tracking-widest whitespace-nowrap">Volume (m³)</th>
              <th className="w-24 py-2.5 pr-4 text-right font-mono text-[10px] text-slate-400 uppercase tracking-widest whitespace-nowrap">Weight (kg)</th>
              <th className="w-24 py-2.5 pr-4 text-left font-mono text-[10px] text-slate-400 uppercase tracking-widest whitespace-nowrap">Status</th>
              <th className="w-28 py-2.5 pr-4" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((o, i) => (
              <tr key={o.id}
                className={`border-b border-slate-100 dark:border-slate-700/60 transition-colors ${i % 2 === 0 ? 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50' : 'bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
                <td className="py-3 pl-4 pr-4 align-top">
                  <span className="font-mono text-xs font-semibold tracking-wide text-teal-700 dark:text-teal-400">{o.id}</span>
                  {o.deferredYesterday && <span className="ml-1 font-mono text-[9px] px-1 py-0.5 bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-300 rounded">D-YEST</span>}
                </td>
                <td className="py-2.5 pr-4 align-top">
                  {o.items?.length ? (
                    <ul className="space-y-1.5">
                      {o.items.map((item, itemIndex) => (
                        <li key={`${item.name}-${itemIndex}`} className="flex items-baseline justify-between gap-3">
                          <span className="min-w-0 text-xs font-medium leading-5 text-slate-700 dark:text-slate-200">{item.name}</span>
                          <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10px] tabular-nums text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                            {item.qty.toLocaleString()} {item.unit}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : <span className="text-xs text-slate-400 dark:text-slate-500">No line items recorded</span>}
                </td>
                <td className="py-3 pr-4 align-top font-mono text-[11px] text-slate-500 dark:text-slate-400">{o.outletId}</td>
                <td className="py-3 pr-4 align-top text-xs text-slate-600 dark:text-slate-300">{o.district}</td>
                <td className="py-3 pr-4 align-top text-xs text-slate-500 dark:text-slate-400">{o.brand.replace('Waypoint ', 'WP ')}</td>
                <td className="py-3 pr-4 align-top"><TempBadge temp={o.tempReq} /></td>
                <td className="py-3 pr-4 align-top text-right font-mono text-xs tabular-nums text-slate-600 dark:text-slate-300">{o.volume.toFixed(1)}</td>
                <td className="py-3 pr-4 align-top text-right font-mono text-xs font-medium tabular-nums text-slate-700 dark:text-slate-200">{o.weight.toLocaleString()}</td>
                <td className="py-3 pr-4 align-top">
                  <StatusBadge status={o.status} onAssign={o.status === 'Deferred' ? () => onAllocate(o.id) : undefined} />
                </td>
                <td className="py-3 pr-4 align-top">
                  {(o.status === 'Unassigned' || (o.status === 'Assigned' && !o.vehicleId)) && (
                    <div className="flex gap-1">
                      <button onClick={e => { e.stopPropagation(); onAllocate(o.id) }} className="text-[10px] font-mono px-2 py-1 bg-teal-50 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-700 rounded hover:bg-teal-100 transition-colors">Assign</button>
                      {o.status === 'Unassigned' && <button onClick={e => { e.stopPropagation(); onDefer(o.id) }} className="text-[10px] font-mono px-2 py-1 bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-700 rounded hover:bg-red-100 transition-colors">Defer</button>}
                    </div>
                  )}
                  {o.status === 'Assigned' && <span className="font-mono text-[10px] text-slate-400">{o.vehicleId} · T{o.tripNo}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="py-16 text-center font-mono text-sm text-slate-400">No orders match filter</div>}
      </div>

      <div className="shrink-0 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-2 flex items-center gap-6 font-mono text-[10px] text-slate-400">
        <span>Total: <span className="text-slate-600 dark:text-slate-300">{filtered.length} orders</span></span>
        <span>Weight: <span className="text-slate-600 dark:text-slate-300">{filtered.reduce((s, o) => s + o.weight, 0).toLocaleString()} kg</span></span>
        <span>Volume: <span className="text-slate-600 dark:text-slate-300">{filtered.reduce((s, o) => s + o.volume, 0).toFixed(1)} m³</span></span>
        <span className="ml-auto text-amber-600 dark:text-amber-400 font-medium">Fresh 8AM cutoff · Allocation closes 16:00</span>
      </div>
    </div>
  )
}

function FleetStatusPanel({ vehicles, orders }: { vehicles: Vehicle[]; orders: Order[] }) {
  const depots: ('Peliyagoda' | 'Kandy')[] = ['Peliyagoda', 'Kandy']
  const types: VehicleType[] = ['Dry-box', 'Refrigerated', 'Small Van']
  const fleetWeight = orders.filter(o => o.status === 'Assigned').reduce((s, o) => s + o.weight, 0)
  const maxFleetWeight = vehicles.reduce((s, v) => s + v.maxWeight, 0)
  const reeferOrders = orders.filter(o => o.tempReq === 'Reefer' && o.status !== 'Assigned')
  const reeferCap = vehicles.filter(v => v.tempType === 'Reefer' && v.availability === 'Available').reduce((s, v) => s + v.maxWeight, 0)
  const reeferDemand = reeferOrders.reduce((s, o) => s + o.weight, 0)
  const reeferGap = reeferDemand - reeferCap
  const fuelAtLimit = vehicles.filter(v => pct(v.fuelUsed, v.fuelQuota) >= 90)

  const alerts: { level: 'critical' | 'warn' | 'info'; msg: string }[] = []
  if (reeferGap > 0) alerts.push({ level: 'critical', msg: `Fresh/Reefer orders exceed available reefer capacity by ${Math.round((reeferGap / (reeferCap || 1)) * 100)}% — ${reeferOrders.length} orders at risk` })
  if (pct(fleetWeight, maxFleetWeight) >= 85) alerts.push({ level: 'warn', msg: 'Fleet weight utilization above 85% — risk of overflow on amendments' })
  if (fuelAtLimit.length > 0) alerts.push({ level: 'warn', msg: `${fuelAtLimit.map(v => v.id).join(', ')} at weekly fuel quota limit` })
  if (orders.some(o => o.deferredYesterday)) alerts.push({ level: 'info', msg: `${orders.filter(o => o.deferredYesterday).length} deferred-yesterday orders in queue — requires priority review` })

  return (
    <div className="flex flex-col h-full min-w-0 gap-3">
      {alerts.length > 0 && (
        <div className="space-y-2 shrink-0">
          {alerts.map((a, i) => (
            <div key={i} className={`flex items-start gap-2.5 p-3 rounded-lg border text-xs leading-relaxed ${
              a.level === 'critical' ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300'
              : a.level === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300'
              : 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300'
            }`}>
              <span className="shrink-0 font-bold mt-0.5">{a.level === 'critical' ? '⚠' : a.level === 'warn' ? '△' : 'ℹ'}</span>
              <span>{a.msg}</span>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shrink-0">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Fleet Availability</span>
          <span className="font-mono text-[10px] text-slate-400">{vehicles.filter(v => v.availability === 'Available').length}/{vehicles.length} Available</span>
        </div>
        <div className="p-4 overflow-x-auto">
          <table className="w-full min-w-[420px]">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700">
                <th className="text-left font-mono text-[10px] text-slate-400 uppercase pb-2">Type</th>
                {depots.map(d => <th key={d} className="text-center font-mono text-[10px] text-slate-400 uppercase pb-2 px-2">{d}</th>)}
                <th className="text-right font-mono text-[10px] text-slate-400 uppercase pb-2">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/60">
              {types.map(type => {
                const byDepot = depots.map(depot => {
                  const veh = vehicles.filter(v => v.type === type && v.depot === depot)
                  return { avail: veh.filter(v => v.availability === 'Available').length, workshop: veh.filter(v => v.availability === 'In Workshop').length, total: veh.length }
                })
                const totAvail = byDepot.reduce((s, d) => s + d.avail, 0)
                const totAll = byDepot.reduce((s, d) => s + d.total, 0)
                return (
                  <tr key={type}>
                    <td className="py-2.5 text-xs font-medium text-slate-700 dark:text-slate-200">{type === 'Small Van' ? 'Small Vans' : `${type} trucks`}</td>
                    {byDepot.map((d, i) => (
                      <td key={i} className="py-2.5 px-2 text-center">
                        <div className="font-mono text-sm font-semibold text-slate-800 dark:text-white">{d.avail}<span className="text-slate-300 dark:text-slate-600 font-normal">/{d.total}</span></div>
                        {d.workshop > 0 && <div className="font-mono text-[9px] text-amber-600">{d.workshop} workshop</div>}
                      </td>
                    ))}
                    <td className="py-2.5 text-right">
                      <span className={`font-mono text-sm font-bold ${totAvail === 0 ? 'text-red-500' : 'text-teal-600 dark:text-teal-400'}`}>{totAvail}</span>
                      <span className="font-mono text-xs text-slate-300 dark:text-slate-600">/{totAll}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden flex flex-col min-h-0">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 shrink-0">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Weekly Fuel Quota</span>
        </div>
        <div className="overflow-auto flex-1">
          <div className="divide-y divide-slate-50 dark:divide-slate-700/60">
            {vehicles.map(v => (
              <div key={v.id} className="px-4 py-2.5 flex items-center gap-3">
                <div className="w-20 shrink-0">
                  <div className="font-mono text-[11px] text-slate-700 dark:text-slate-200 font-medium">{v.id}</div>
                  <div className="font-mono text-[9px] text-slate-400">{v.type === 'Small Van' ? 'Van' : v.type}</div>
                </div>
                <div className="w-16 shrink-0"><div className="font-mono text-[10px] text-slate-400">{v.depot}</div></div>
                <div className="flex-1 min-w-0"><FuelBar used={v.fuelUsed} quota={v.fuelQuota} /></div>
                <div className="font-mono text-[10px] text-slate-400 w-24 text-right shrink-0">{v.fuelUsed}<span className="text-slate-300 dark:text-slate-600">/{v.fuelQuota} L</span></div>
                <span className={`font-mono text-[9px] px-1.5 py-0.5 rounded border shrink-0 ${
                  v.availability === 'Available' ? 'bg-teal-50 text-teal-600 border-teal-200 dark:bg-teal-900/40 dark:text-teal-300 dark:border-teal-700'
                  : v.availability === 'In Workshop' ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700'
                  : 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600'
                }`}>{v.availability}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function DeliveryConfirmationPanel({ trips, onConfirm }: { trips: CompletedTrip[]; onConfirm: (idx: number) => void }) {
  const [confirmingIdx, setConfirmingIdx] = useState<number | null>(null)

  return (
    <div className="h-full overflow-auto space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="font-semibold text-slate-800 dark:text-white">Delivery Confirmation</h2>
          <p className="font-mono text-[11px] text-slate-400 mt-0.5">Review completed trips and provide dispatcher sign-off</p>
        </div>
        <span className={`font-mono text-xs px-3 py-1.5 rounded-full border ${trips.filter(t => !t.confirmedByDispatcher).length > 0 ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700' : 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-700'}`}>
          {trips.filter(t => !t.confirmedByDispatcher).length} pending · {trips.filter(t => t.confirmedByDispatcher).length} confirmed
        </span>
      </div>

      {trips.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-4">
            <span className="text-slate-400 text-2xl">✦</span>
          </div>
          <p className="font-semibold text-slate-600 dark:text-slate-300">No trips awaiting confirmation</p>
          <p className="font-mono text-[11px] text-slate-400 mt-1">Completed trip receipts will appear here</p>
        </div>
      )}

      {trips.map((trip, idx) => (
        <div key={`${trip.vehicleId}-${idx}`} className={`bg-white dark:bg-slate-800 border-2 rounded-2xl overflow-hidden ${trip.confirmedByDispatcher ? 'border-teal-300 dark:border-teal-700' : 'border-amber-300 dark:border-amber-700'}`}>
          <div className={`px-5 py-4 border-b ${trip.confirmedByDispatcher ? 'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-700' : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white ${trip.confirmedByDispatcher ? 'bg-teal-500' : 'bg-amber-500'}`}>
                  {trip.confirmedByDispatcher ? '✓' : '⟳'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-800 dark:text-white">{trip.vehicleId}</span>
                    <span className="font-mono text-[10px] text-slate-400">{trip.plate}</span>
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-300">{trip.driver} · {trip.depot} Depot</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-[10px] text-slate-400 uppercase">Route Completed</div>
                <div className="font-mono font-bold text-slate-800 dark:text-white text-lg">{trip.completedAt}</div>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <div className="space-y-2">
              <p className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">Stop Sign-offs ({trip.stops.length} stops)</p>
              {trip.stops.map((stop, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700">
                  <span className="w-6 h-6 rounded-full bg-teal-500 text-white text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                  <div className="flex-1">
                    <span className="font-mono text-sm font-bold text-slate-700 dark:text-slate-200">{stop.outletId}</span>
                    {stop.signedBy && <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">Signed: {stop.signedBy}</span>}
                  </div>
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-700">{stop.status}</span>
                </div>
              ))}
            </div>

            {trip.confirmedByDispatcher ? (
              <div className="flex items-center gap-3 px-4 py-3 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-700 rounded-xl">
                <span className="text-teal-600 dark:text-teal-400 text-xl">✓</span>
                <div>
                  <p className="font-semibold text-teal-800 dark:text-teal-300 text-sm">Confirmed by Dispatcher</p>
                  <p className="font-mono text-[10px] text-teal-600 dark:text-teal-400">Priya Jayawardena · {trip.confirmedAt}</p>
                </div>
              </div>
            ) : confirmingIdx === idx ? (
              <div className="space-y-3">
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                  <strong>Confirm:</strong> All stops on this trip have been delivered and signed off. This action is logged against your dispatcher account.
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setConfirmingIdx(null)} className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancel</button>
                  <button onClick={() => { onConfirm(idx); setConfirmingIdx(null) }} className="flex-[2] py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm transition-colors">
                    ✓ Confirm & Sign Off
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmingIdx(idx)}
                className="w-full py-3.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold text-sm transition-colors active:scale-[0.99]">
                Review & Confirm Delivery
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function LiveTrackingPanel({ vehicles, orders }: { vehicles: Vehicle[]; orders: Order[] }) {
  const [time, setTime] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t) }, [])
  const statusColor: Record<string, string> = {
    'In Transit': 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/40 dark:text-teal-300 dark:border-teal-700',
    'Loading': 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700',
    'In Workshop': 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700',
    'Available': 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600',
  }

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
        {[
          { label: 'Vehicles Active', value: vehicles.filter(v => v.availability === 'In Transit' || v.availability === 'Loading').length, color: 'text-teal-600 dark:text-teal-400' },
          { label: 'Orders Assigned', value: orders.filter(o => o.status === 'Assigned').length, color: 'text-teal-600 dark:text-teal-400' },
          { label: 'Orders Unassigned', value: orders.filter(o => o.status === 'Unassigned').length, color: 'text-amber-600 dark:text-amber-400' },
          { label: 'Live Time', value: time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), color: 'text-slate-700 dark:text-slate-200' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <div className={`font-mono text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="font-mono text-[10px] text-slate-400 uppercase tracking-wide mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden flex-1 flex flex-col">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 shrink-0">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Vehicle Tracker — Live</span>
        </div>
        <div className="overflow-auto flex-1">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="sticky top-0 bg-white dark:bg-slate-800">
              <tr className="border-b border-slate-200 dark:border-slate-700">
                {['Vehicle', 'Driver', 'Type', 'Depot', 'Status', 'Route Progress', 'Orders', 'ETA'].map(h => (
                  <th key={h} className="text-left py-2.5 px-4 font-mono text-[10px] text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v, i) => {
                const vOrders = orders.filter(o => o.vehicleId === v.id)
                return (
                  <tr key={v.id} className={`border-b border-slate-100 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors ${i % 2 === 1 ? 'bg-slate-50/50 dark:bg-slate-800/50' : 'bg-white dark:bg-slate-800'}`}>
                    <td className="py-3 px-4">
                      <div className="font-mono text-xs text-teal-700 dark:text-teal-400 font-medium">{v.id}</div>
                      <div className="font-mono text-[10px] text-slate-400">{v.plate}</div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">{v.driver}</td>
                    <td className="py-3 px-4 text-xs text-slate-500 dark:text-slate-400">{v.type}</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-400">{v.depot}</td>
                    <td className="py-3 px-4"><span className={`font-mono text-[10px] px-2 py-0.5 rounded border ${statusColor[v.availability] || 'bg-slate-50 text-slate-400 border-slate-200'}`}>{v.availability}</span></td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 min-w-[100px]">
                        <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${v.routeProgress === 100 ? 'bg-emerald-500' : 'bg-teal-500'}`} style={{ width: `${v.routeProgress}%` }} />
                        </div>
                        <span className="font-mono text-[10px] text-slate-400 w-7 text-right">{v.routeProgress}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-500 dark:text-slate-400">{vOrders.length} orders</td>
                    <td className="py-3 px-4 font-mono text-xs text-amber-600 dark:text-amber-400">{v.eta}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function DeferralsPanel({ orders, deferrals, onAddDeferral }: { orders: Order[]; deferrals: DeferralEntry[]; onAddDeferral: (orderId: string) => void }) {
  const [selectedId, setSelectedId] = useState('')
  const [reasonCode, setReasonCode] = useState('')
  const [note, setNote] = useState('')
  const pendingOrders = orders.filter(o => o.status === 'Unassigned')

  function submit() {
    if (!selectedId || !reasonCode) return
    onAddDeferral(selectedId); setSelectedId(''); setReasonCode(''); setNote('')
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:h-full">
      <div className="lg:col-span-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700"><span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Record Deferral</span></div>
        <div className="p-4 flex-1 overflow-auto space-y-4">
          <div>
            <label className="font-mono text-[10px] text-slate-400 uppercase block mb-1.5">Unserved Order</label>
            <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400/40 focus:border-teal-400">
              <option value="">Select pending order…</option>
              {pendingOrders.map(o => <option key={o.id} value={o.id}>{o.id} — {o.outletId} ({o.weight} kg)</option>)}
            </select>
          </div>
          {selectedId && (() => {
            const o = orders.find(x => x.id === selectedId)!
            return <div className="bg-slate-50 dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 p-3 font-mono text-xs space-y-1"><div className="text-teal-700 dark:text-teal-300 font-medium">{o.id}</div><div className="text-slate-500 dark:text-slate-400">{o.brand} · {o.outletId}</div><div className="text-slate-400">{o.district} · {o.weight} kg</div></div>
          })()}
          <div>
            <label className="font-mono text-[10px] text-slate-400 uppercase block mb-1.5">Reason Code <span className="text-red-500">*</span></label>
            <select value={reasonCode} onChange={e => setReasonCode(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400/40">
              <option value="">Select reason code…</option>
              {REASON_CODES.map(r => <option key={r.code} value={r.code}>{r.code} — {r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="font-mono text-[10px] text-slate-400 uppercase block mb-1.5">Dispatcher Note</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="Context, rescheduling intention…"
              className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-200 rounded-lg px-3 py-2 resize-none placeholder-slate-300 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400/40" />
          </div>
          <button onClick={submit} disabled={!selectedId || !reasonCode}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm py-2.5 rounded-lg transition-colors">
            Log Deferral
          </button>
        </div>
      </div>
      <div className="lg:col-span-3 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Deferral Log</span>
          <span className="font-mono text-[10px] text-slate-400">{deferrals.length} entries · {deferrals.reduce((s, d) => s + d.weight, 0).toLocaleString()} kg deferred</span>
        </div>
        <div className="flex-1 overflow-auto space-y-2">
          {deferrals.map((d, i) => (
            <div key={i} className="bg-white dark:bg-slate-800 border border-red-100 dark:border-red-900/60 rounded-xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-red-600 dark:text-red-400 font-medium">{d.orderId}</span>
                  <span className="font-mono text-[10px] text-slate-400">{d.brand}</span>
                  {d.deferredYesterday && <span className="font-mono text-[9px] px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-300 rounded border border-orange-200 dark:border-orange-700">DEFERRED YESTERDAY</span>}
                </div>
                <span className="font-mono text-[10px] text-slate-400">{d.timestamp}</span>
              </div>
              <div className="text-sm text-slate-700 dark:text-slate-200 font-medium mb-1">{d.outletId} · {d.district}</div>
              <div className="font-mono text-xs text-slate-400 mb-2">{d.weight.toLocaleString()} kg</div>
              <div className="inline-flex items-center gap-1.5 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded px-2 py-1 font-mono text-[10px] text-red-600 dark:text-red-400 mb-2">{d.reasonCode}</div>
              {d.note && <div className="text-xs text-slate-500 dark:text-slate-400 italic">{d.note}</div>}
            </div>
          ))}
          {deferrals.length === 0 && <div className="text-center font-mono text-sm text-slate-400 py-16">No deferrals recorded</div>}
        </div>
      </div>
    </div>
  )
}

function LoaderFlagsPanel({ flags }: { flags: LoaderFlag[] }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Loader Flags</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Issues reported during loading, with notes and photo evidence.</p>
        </div>
        <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 font-mono text-xs text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">{flags.length} reports</span>
      </div>
      {flags.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">No loader flags have been reported.</div>
      ) : (
        <div className="space-y-3">
          {flags.map(flag => (
            <article key={flag.id} className="grid gap-4 rounded-xl border border-amber-200 bg-white p-4 dark:border-amber-900/60 dark:bg-slate-800 md:grid-cols-[minmax(0,1fr)_220px]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-amber-700 dark:text-amber-300">{flag.deliveryId}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">Outlet {flag.outletId}</span>
                  <time className="ml-auto text-[10px] text-slate-400" dateTime={flag.createdAt}>{new Date(flag.createdAt).toLocaleString()}</time>
                </div>
                <h3 className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">{flag.itemDescription}</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {flag.categories.map(category => <span key={category} className="rounded border border-red-200 bg-red-50 px-2 py-1 font-mono text-[10px] text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">{category}</span>)}
                </div>
                <div className="mt-3">
                  <p className="font-mono text-[10px] uppercase text-slate-400">Loader note</p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-600 dark:text-slate-300">{flag.note || 'No note provided.'}</p>
                </div>
              </div>
              {flag.photo ? (
                <a href={flag.photo.dataUrl} target="_blank" rel="noreferrer" className="group block self-start overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                  <img src={flag.photo.dataUrl} alt={`Photo evidence for ${flag.itemDescription}`} className="h-40 w-full object-cover transition-transform group-hover:scale-[1.02]" />
                  <span className="block truncate bg-slate-50 px-3 py-2 text-xs text-slate-600 group-hover:text-teal-700 dark:bg-slate-900 dark:text-slate-300 dark:group-hover:text-teal-300">View evidence · {flag.photo.name}</span>
                </a>
              ) : (
                <div className="flex min-h-24 items-center justify-center rounded-lg border border-dashed border-slate-200 text-xs text-slate-400 dark:border-slate-700">No photo attached</div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function AllocationModal({ orderId, orders, vehicles, onClose, onConfirm }: { orderId: string; orders: Order[]; vehicles: Vehicle[]; onClose: () => void; onConfirm: (vehicleId: string, trip: 1 | 2) => void }) {
  const order = orders.find(o => o.id === orderId)
  const [selectedVehicle, setSelectedVehicle] = useState('')
  const [selectedTrip, setSelectedTrip] = useState<1 | 2>(1)
  if (!order) return null

  const compatibleVehicles = vehicles.filter(v => v.tempType === order.tempReq && v.availability !== 'In Workshop')
  const selectedVehicleObj = vehicles.find(v => v.id === selectedVehicle)
  let warnings: string[] = []
  if (selectedVehicleObj) {
    const tripLoad = calcLoad(selectedVehicleObj, orders, selectedTrip)
    if (tripLoad.weight + order.weight > selectedVehicleObj.maxWeight) warnings.push(`Weight exceeds limit: ${(tripLoad.weight + order.weight).toLocaleString()} / ${selectedVehicleObj.maxWeight.toLocaleString()} kg`)
    if (tripLoad.volume + order.volume > selectedVehicleObj.maxVolume) warnings.push(`Volume exceeds limit: ${(tripLoad.volume + order.volume).toFixed(1)} / ${selectedVehicleObj.maxVolume} m³`)
    if (order.brand === 'Waypoint Fresh' && selectedVehicleObj.tempType !== 'Reefer') warnings.push('Fresh orders require Reefer temperature control')
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div><h2 className="font-semibold text-slate-800 dark:text-white">Manual Assignment</h2><p className="font-mono text-xs text-slate-400 mt-0.5">Assign order to vehicle and trip</p></div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-lg leading-none">✕</button>
        </div>
        <div className="p-6 space-y-5">
          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600 p-4 space-y-2">
            <div className="flex items-center gap-2"><span className="font-mono text-sm text-teal-700 dark:text-teal-400 font-semibold">{order.id}</span><TempBadge temp={order.tempReq} /></div>
            <div className="grid grid-cols-3 gap-3 font-mono text-xs text-slate-500 dark:text-slate-400">
              <div><div className="text-[10px] uppercase text-slate-400 mb-0.5">Outlet</div>{order.outletId}</div>
              <div><div className="text-[10px] uppercase text-slate-400 mb-0.5">District</div>{order.district}</div>
              <div><div className="text-[10px] uppercase text-slate-400 mb-0.5">Weight</div>{order.weight.toLocaleString()} kg</div>
            </div>
          </div>
          <div>
            <label className="font-mono text-[10px] text-slate-400 uppercase block mb-1.5">Select Vehicle</label>
            <select value={selectedVehicle} onChange={e => setSelectedVehicle(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400/40 focus:border-teal-400">
              <option value="">Choose compatible vehicle…</option>
              {compatibleVehicles.map(v => <option key={v.id} value={v.id}>{v.id} · {v.plate} · {v.depot} · {pct(calcLoad(v, orders, selectedTrip).weight, v.maxWeight)}% loaded</option>)}
            </select>
          </div>
          <div>
            <label className="font-mono text-[10px] text-slate-400 uppercase block mb-1.5">Trip Number</label>
            <div className="grid grid-cols-2 gap-2">
              {([1, 2] as const).map(t => (
                <button key={t} onClick={() => setSelectedTrip(t)}
                  className={`py-2.5 rounded-lg border text-sm font-medium transition-colors ${selectedTrip === t ? 'bg-teal-50 dark:bg-teal-900/40 border-teal-400 text-teal-700 dark:text-teal-300' : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300'}`}>
                  Trip {t}
                  {selectedVehicleObj && <span className="font-mono text-[10px] ml-1 opacity-60">{pct(calcLoad(selectedVehicleObj, orders, t).weight, selectedVehicleObj.maxWeight)}%</span>}
                </button>
              ))}
            </div>
          </div>
          {warnings.length > 0 && warnings.map((w, i) => (
            <div key={i} className="flex items-center gap-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg px-3 py-2 text-xs text-red-700 dark:text-red-300"><span>⚠</span> {w}</div>
          ))}
          {selectedVehicle && warnings.length === 0 && (
            <div className="flex items-center gap-2 bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-700 rounded-lg px-3 py-2 text-xs text-teal-700 dark:text-teal-300"><span>✓</span> All constraints satisfied — ready to assign</div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white font-medium transition-colors">Cancel</button>
          <button onClick={() => { if (selectedVehicle && warnings.length === 0) { onConfirm(selectedVehicle, selectedTrip); onClose() } }} disabled={!selectedVehicle || warnings.length > 0}
            className="px-5 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-lg transition-colors">
            Confirm Assignment
          </button>
        </div>
      </div>
    </div>
  )
}

function DeferralModal({ orderId, orders, onClose, onConfirm }: { orderId: string; orders: Order[]; onClose: () => void; onConfirm: (reasonCode: string, note: string) => void }) {
  const order = orders.find(o => o.id === orderId)
  const [reasonCode, setReasonCode] = useState('')
  const [note, setNote] = useState('')
  if (!order) return null

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div><h2 className="font-semibold text-slate-800 dark:text-white">Mark as Deferred</h2><p className="font-mono text-xs text-red-500 mt-0.5">This order will be flagged for the next planning run</p></div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-lg leading-none">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-700 p-4 font-mono text-xs space-y-1.5">
            <div className="text-red-600 dark:text-red-400 font-semibold">{order.id}</div>
            <div className="text-slate-500 dark:text-slate-400">{order.brand} · {order.outletId} · {order.district}</div>
            <div className="text-slate-400">{order.weight.toLocaleString()} kg · {order.volume.toFixed(1)} m³</div>
          </div>
          <div>
            <label className="font-mono text-[10px] text-slate-400 uppercase block mb-1.5">Reason Code <span className="text-red-500">*</span></label>
            <select value={reasonCode} onChange={e => setReasonCode(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-300">
              <option value="">Select mandatory reason code…</option>
              {REASON_CODES.map(r => <option key={r.code} value={r.code}>{r.code} — {r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="font-mono text-[10px] text-slate-400 uppercase block mb-1.5">Dispatcher Note</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="Rescheduling intention, context for next run…"
              className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-200 rounded-lg px-3 py-2 resize-none placeholder-slate-300 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-300" />
          </div>
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg p-3 font-mono text-[10px] text-orange-700 dark:text-orange-300">
            ⚠ Order will be auto-tagged <span className="font-bold">deferred_yesterday</span> in tomorrow's planning cycle
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white font-medium transition-colors">Cancel</button>
          <button onClick={() => { if (reasonCode) { onConfirm(reasonCode, note); onClose() } }} disabled={!reasonCode}
            className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-lg transition-colors">
            Confirm Deferral
          </button>
        </div>
      </div>
    </div>
  )
}

function DashboardOverview({ orders, vehicles }: { orders: Order[]; vehicles: Vehicle[] }) {
  const unassignedReefer = orders.filter(o => o.tempReq === 'Reefer' && o.status === 'Unassigned').length
  const fuelAtLimit = vehicles.filter(v => pct(v.fuelUsed, v.fuelQuota) >= 90)
  const deferredYesterdayOrders = orders.filter(o => o.deferredYesterday)

  const constraintAlerts: { level: 'critical' | 'warn' | 'info'; msg: string; time: string }[] = []
  if (unassignedReefer > 0) {
    constraintAlerts.push({
      level: 'critical',
      msg: `Fresh orders exceed available reefer capacity — ${unassignedReefer} unassigned Reefer order${unassignedReefer > 1 ? 's' : ''} outstanding`,
      time: '14:32',
    })
  }
  if (fuelAtLimit.length > 0) {
    constraintAlerts.push({
      level: 'warn',
      msg: `${fuelAtLimit.map(v => v.id).join(', ')} fuel quota at 90%+ — route continuation requires depot refuel authorization`,
      time: '13:55',
    })
  }
  if (deferredYesterdayOrders.length > 0) {
    constraintAlerts.push({
      level: 'info',
      msg: `${deferredYesterdayOrders.length} order${deferredYesterdayOrders.length > 1 ? 's' : ''} flagged deferred_yesterday (${deferredYesterdayOrders.map(o => o.id).join(', ')}) — priority review required`,
      time: '09:00',
    })
  }

  return (
    <div className="h-full overflow-auto space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { label: 'Total Orders', value: orders.length, color: 'text-slate-700 dark:text-slate-200', sub: 'Tomorrow\'s run' },
          { label: 'Assigned', value: orders.filter(o => o.status === 'Assigned').length, color: 'text-teal-600 dark:text-teal-400', sub: `${orders.length ? Math.round(orders.filter(o => o.status === 'Assigned').length / orders.length * 100) : 0}% complete` },
          { label: 'Unassigned', value: orders.filter(o => o.status === 'Unassigned').length, color: 'text-amber-600 dark:text-amber-400', sub: 'Needs action' },
          { label: 'Deferred', value: orders.filter(o => o.status === 'Deferred').length, color: 'text-red-500', sub: 'Logged reason' },
          { label: 'Fleet Available', value: vehicles.filter(v => v.availability === 'Available').length, color: 'text-teal-600 dark:text-teal-400', sub: `of ${vehicles.length} total` },
          { label: 'In Workshop', value: vehicles.filter(v => v.availability === 'In Workshop').length, color: 'text-amber-600 dark:text-amber-400', sub: 'Unavailable' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <div className={`font-mono text-3xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-1">{s.label}</div>
            <div className="font-mono text-[10px] text-slate-400 mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(['Waypoint Fresh', 'Waypoint Style', 'Waypoint Tech'] as BrandTab[]).map(brand => {
          const bOrders = orders.filter(o => o.brand === brand)
          const assigned = bOrders.filter(o => o.status === 'Assigned').length
          const total = bOrders.length
          const p = total > 0 ? Math.round(assigned / total * 100) : 0
          const colors: Record<string, string> = { 'Waypoint Fresh': 'bg-emerald-500', 'Waypoint Style': 'bg-violet-500', 'Waypoint Tech': 'bg-blue-500' }
          return (
            <div key={brand} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{brand}</span>
                <span className={`font-mono text-[10px] px-2 py-0.5 rounded-full text-white ${colors[brand]}`}>{brand === 'Waypoint Fresh' ? 'Reefer' : 'Ambient'}</span>
              </div>
              <div className="flex items-end gap-2 mb-3">
                <span className="font-mono text-2xl font-bold text-slate-800 dark:text-white">{assigned}</span>
                <span className="font-mono text-sm text-slate-400 mb-0.5">/ {total} assigned</span>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${colors[brand]}`} style={{ width: `${p}%` }} />
              </div>
              <div className="font-mono text-[10px] text-slate-400 mt-1.5 text-right">{p}%</div>
            </div>
          )
        })}
      </div>
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700"><span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Constraint Alerts</span></div>
        <div className="divide-y divide-slate-50 dark:divide-slate-700/60">
          {constraintAlerts.map((a, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3">
              <span className={`shrink-0 text-sm mt-0.5 ${a.level === 'critical' ? 'text-red-500' : a.level === 'warn' ? 'text-amber-500' : 'text-blue-400'}`}>{a.level === 'critical' ? '⚠' : a.level === 'warn' ? '△' : 'ℹ'}</span>
              <span className="text-xs text-slate-600 dark:text-slate-300 flex-1">{a.msg}</span>
              <span className="font-mono text-[10px] text-slate-400 shrink-0">{a.time}</span>
            </div>
          ))}
          {constraintAlerts.length === 0 && <div className="px-4 py-4 text-xs font-mono text-slate-400">All constraint checks clear</div>}
        </div>
      </div>
    </div>
  )
}

function ReportsPanel({ orders, vehicles }: { orders: Order[]; vehicles: Vehicle[] }) {
  return (
    <div className="h-full overflow-auto space-y-4">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Daily Allocation Summary — {fmtDate()}</span>
          <button className="text-xs text-teal-600 dark:text-teal-400 font-medium hover:text-teal-700 transition-colors">Export CSV</button>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="font-mono text-[10px] text-slate-400 uppercase mb-3">Order Summary</div>
            <div className="space-y-2">
              {[
                { label: 'Total Orders', value: orders.length },
                { label: 'Assigned', value: orders.filter(o => o.status === 'Assigned').length },
                { label: 'Unassigned', value: orders.filter(o => o.status === 'Unassigned').length },
                { label: 'Deferred', value: orders.filter(o => o.status === 'Deferred').length },
                { label: 'Total Weight', value: `${orders.reduce((s, o) => s + o.weight, 0).toLocaleString()} kg` },
              ].map(r => (
                <div key={r.label} className="flex justify-between py-1.5 border-b border-slate-50 dark:border-slate-700/60">
                  <span className="text-xs text-slate-500 dark:text-slate-400">{r.label}</span>
                  <span className="font-mono text-xs font-medium text-slate-700 dark:text-slate-200">{r.value}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] text-slate-400 uppercase mb-3">Fleet Utilization</div>
            <div className="space-y-2">
              {vehicles.map(v => {
                const totalWeight = calcLoad(v, orders, 1).weight + calcLoad(v, orders, 2).weight
                const p = pct(totalWeight, v.maxWeight)
                return (
                  <div key={v.id} className="flex items-center gap-3 py-1.5 border-b border-slate-50 dark:border-slate-700/60">
                    <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300 w-12">{v.id}</span>
                    <div className="flex-1"><FuelBar used={totalWeight} quota={v.maxWeight} /></div>
                    <span className="font-mono text-[10px] text-slate-400 w-8 text-right">{p}%</span>
                  </div>
                )
              })}
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] text-slate-400 uppercase mb-3">Deferral Reasons</div>
            <div className="space-y-2">
              {REASON_CODES.slice(0, 4).map(r => (
                <div key={r.code} className="flex items-center gap-2 py-1.5 border-b border-slate-50 dark:border-slate-700/60">
                  <span className="font-mono text-[10px] text-slate-400 w-24">{r.code}</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 flex-1">{r.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StoreReceiptsPanel({ receipts }: { receipts: StoreReceipt[] }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Store Receipts</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Receipts are delivered here when a driver scans the store QR.</p>
        </div>
        <span className="shrink-0 rounded-full bg-teal-100 px-2.5 py-1 font-mono text-xs text-teal-800 dark:bg-teal-900/40 dark:text-teal-300">{receipts.length} receipts</span>
      </div>
      {receipts.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">Waiting for a driver to scan a store delivery QR code.</div>
      ) : receipts.map(receipt => (
        <article key={receipt.receiptId} className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/70">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-mono text-sm font-semibold text-slate-800 dark:text-white">{receipt.outletName} · {receipt.outletId}</h3>
                <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${receipt.result === 'confirmed' ? 'border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-800 dark:bg-teal-900/30 dark:text-teal-300' : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300'}`}>
                  {receipt.result === 'confirmed' ? 'QR scan confirmed' : 'QR scanned · issues reported'}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{receipt.brand} · Order {receipt.orderId || '—'} · Ref {receipt.referenceNumber}</p>
            </div>
            <time className="font-mono text-[10px] text-slate-400" dateTime={receipt.scannedAt || receipt.confirmedAt}>{new Date(receipt.scannedAt || receipt.confirmedAt).toLocaleString()}</time>
          </header>
          <div role="status" className="flex items-center gap-2 border-b border-teal-100 bg-teal-50 px-4 py-2.5 text-xs font-medium text-teal-800 dark:border-teal-900 dark:bg-teal-900/20 dark:text-teal-300">
            <span aria-hidden="true">✓</span>
            Delivery confirmed by {receipt.driverName || 'the driver'} scanning reference {receipt.referenceNumber}. Receipt sent to dispatcher.
          </div>
          <div className="grid gap-4 p-4 md:grid-cols-2">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400">Delivery</p>
              <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-200">{receipt.vehicleId || receipt.vehiclePlate || 'Vehicle not recorded'}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{receipt.driverName || 'Driver not recorded'}</p>
              <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-slate-400">Received Items</p>
              <div className="mt-1 divide-y divide-slate-100 dark:divide-slate-700">
                {receipt.items.map((item, index) => (
                  <div key={`${item.name}-${index}`} className="flex justify-between gap-3 py-2 text-sm">
                    <span className="text-slate-600 dark:text-slate-300">{item.name}</span>
                    <span className="shrink-0 font-mono text-xs text-slate-500 dark:text-slate-400">{item.qty} {item.unit}</span>
                  </div>
                ))}
                {receipt.items.length === 0 && <p className="py-2 text-xs text-slate-400">No item details recorded.</p>}
              </div>
            </div>
            <div className="rounded-lg border border-slate-100 p-3 dark:border-slate-700">
              <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400">Receipt Notes</p>
              {receipt.issues.length ? (
                <>
                  <div className="mt-2 flex flex-wrap gap-2">{receipt.issues.map(issue => <span key={issue} className="rounded border border-amber-200 bg-amber-50 px-2 py-1 font-mono text-[10px] text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">{issue}</span>)}</div>
                  {receipt.affectedItem && <p className="mt-3 text-sm text-slate-600 dark:text-slate-300"><span className="font-medium">Affected:</span> {receipt.affectedItem}</p>}
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600 dark:text-slate-300">{receipt.note || 'No additional note.'}</p>
                </>
              ) : <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No delivery issues reported.</p>}
            </div>
          </div>
        </article>
      ))}
    </section>
  )
}

export default function DispatcherApp({ onSwitchView, isDark = false, onToggleDark, username, userRole }: {
  onSwitchView?: () => void; isDark?: boolean; onToggleDark?: () => void
  username: string; userRole: SignupRole
}) {
  const [nav, setNav] = useState<NavItem>('dashboard')
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [orders, setOrders] = useState<Order[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [deferrals, setDeferrals] = useState<DeferralEntry[]>([])
  const [loaderFlags, setLoaderFlags] = useState<LoaderFlag[]>([])
  const [storeReceipts, setStoreReceipts] = useState<StoreReceipt[]>([])
  const [completedTrips, setCompletedTrips] = useState<CompletedTrip[]>([])
  const [seenNotificationIds, setSeenNotificationIds] = useState<Partial<Record<NavItem, string[]>>>({})
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let loading = false
    const refreshData = () => {
      if (loading) return
      loading = true
      Promise.all([api.getOrders(), api.getVehicles(), api.getLoaderFlags(), api.getStoreReceipts()])
        .then(([dbOrders, dbVehicles, dbFlags, dbReceipts]) => {
          if (cancelled) return
          const mappedOrders: Order[] = dbOrders.map((o: BackendOrder) => ({
            id: o.delivery_id,
            outletId: o.outlet_id,
            items: o.items?.map(item => ({ name: item.name, qty: item.qty, unit: item.unit })),
            district: o.district,
            brand: (o.brand === 'Fresh' ? 'Waypoint Fresh' : o.brand === 'Style' ? 'Waypoint Style' : o.brand === 'Tech' ? 'Waypoint Tech' : o.brand) as BrandTab,
            tempReq: String(o.temp_requirement).toLowerCase().includes('reefer') || String(o.temp_requirement).toLowerCase().includes('fresh') ? 'Reefer' : 'Ambient',
            volume: o.order_volume_m3,
            weight: o.order_weight_kg,
            status: ({ pending: 'Unassigned', assigned: 'Assigned', deferred: 'Deferred', delivered: 'Delivered', dispatched: 'Assigned', in_transit: 'Assigned' } as Record<string, OrderStatus>)[o.dispatch_status] || 'Unassigned',
            vehicleId: o.vehicle_id || undefined,
            tripNo: o.trip_id ? ((o.trip_id % 2 ? 1 : 2) as 1 | 2) : undefined,
            deferredYesterday: Boolean(o.deferred_yesterday),
          }))
          const mappedVehicles: Vehicle[] = dbVehicles.map((v: BackendVehicle) => ({
            id: v.vehicle_id, plate: v.vehicle_id, driver: 'Unassigned', type: v.type.toLowerCase().includes('van') ? 'Small Van' : v.temp.toLowerCase().includes('reefer') ? 'Refrigerated' : 'Dry-box',
            tempType: v.temp.toLowerCase().includes('reefer') ? 'Reefer' : 'Ambient',
            depot: v.depot as Vehicle['depot'], maxWeight: v.weight_cap_kg, maxVolume: v.volume_cap_m3,
            availability: 'Available', fuelUsed: 0, fuelQuota: v.weekly_fuel_quota_l, routeProgress: 0, trip1Orders: [], trip2Orders: [], eta: '—',
          }))
          setOrders(mappedOrders)
          setVehicles(mappedVehicles)
          setLoaderFlags(dbFlags)
          setStoreReceipts(dbReceipts)
          setDeferrals(mappedOrders.filter(o => o.status === 'Deferred').map(o => ({
            orderId: o.id, outletId: o.outletId, brand: o.brand, district: o.district, weight: o.weight,
            reasonCode: 'DB_DEFERRED', note: 'Deferred status from database', timestamp: '', deferredYesterday: Boolean(o.deferredYesterday),
          })))
          setLoadError(null)
        })
        .catch(err => !cancelled && setLoadError(err instanceof Error ? err.message : 'Failed to load backend data'))
        .finally(() => { loading = false })
    }
    refreshData()
    const interval = setInterval(refreshData, 5000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])
  const [allocationModalId, setAllocationModalId] = useState<string | null>(null)
  const [deferralModalId, setDeferralModalId] = useState<string | null>(null)

  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 1024) setMobileOpen(false) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  function handleAllocate(orderId: string) { setAllocationModalId(orderId) }
  function handleDefer(orderId: string) { setDeferralModalId(orderId) }

  function confirmAllocation(vehicleId: string, trip: 1 | 2) {
    if (!allocationModalId) return
    setOrders(prev => prev.map(o => o.id === allocationModalId ? { ...o, status: 'Assigned' as OrderStatus, vehicleId, tripNo: trip } : o))
    void api.updateOrder(allocationModalId, { dispatch_status: 'assigned', vehicle_id: vehicleId, trip_id: trip })
      .catch(err => setLoadError(err instanceof Error ? err.message : 'Allocation failed'))
  }

  function confirmDeferral(reasonCode: string, note: string) {
    if (!deferralModalId) return
    const order = orders.find(o => o.id === deferralModalId)
    if (!order) return
    const now = new Date()
    setOrders(prev => prev.map(o => o.id === deferralModalId ? { ...o, status: 'Deferred' as OrderStatus } : o))
    void api.updateOrder(deferralModalId, { dispatch_status: 'deferred' })
      .catch(err => setLoadError(err instanceof Error ? err.message : 'Deferral failed'))
    setDeferrals(prev => [{ orderId: order.id, outletId: order.outletId, brand: order.brand, district: order.district, weight: order.weight, reasonCode, note, timestamp: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`, deferredYesterday: false }, ...prev])
  }

  function confirmTrip(idx: number) {
    const now = new Date()
    setCompletedTrips(prev => prev.map((t, i) => i === idx ? { ...t, confirmedByDispatcher: true, confirmedAt: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) } : t))
  }

  const notificationIds: Partial<Record<NavItem, string[]>> = {
    'order-queue': orders.filter(order => order.status === 'Unassigned').map(order => order.id),
    deferrals: orders.filter(order => order.status === 'Deferred').map(order => order.id),
    'loader-flags': loaderFlags.map(flag => flag.id),
    'store-receipts': storeReceipts.map(receipt => receipt.receiptId),
    'delivery-confirmation': completedTrips
      .filter(trip => !trip.confirmedByDispatcher)
      .map(trip => `${trip.vehicleId}:${trip.completedAt}`),
  }
  const unreadCount = (item: NavItem) =>
    (notificationIds[item] || []).filter(id => !seenNotificationIds[item]?.includes(id)).length
  const isSplitView = nav === 'order-queue' || nav === 'fleet-allocation'

  const renderPanel = () => {
    if (nav === 'dashboard') return <DashboardOverview orders={orders} vehicles={vehicles} />
    if (nav === 'live-tracking') return <LiveTrackingPanel vehicles={vehicles} orders={orders} />
    if (nav === 'deferrals') return <DeferralsPanel orders={orders} deferrals={deferrals} onAddDeferral={handleDefer} />
    if (nav === 'loader-flags') return <LoaderFlagsPanel flags={loaderFlags} />
    if (nav === 'store-receipts') return <StoreReceiptsPanel receipts={storeReceipts} />
    if (nav === 'reports') return <ReportsPanel orders={orders} vehicles={vehicles} />
    if (nav === 'delivery-confirmation') return <DeliveryConfirmationPanel trips={completedTrips} onConfirm={confirmTrip} />
    return null
  }

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className="h-[100dvh] flex overflow-hidden bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-200" style={{ fontFamily: "'Inter', sans-serif" }}>
        {mobileOpen && <div className="fixed inset-0 z-40 bg-slate-900/60 lg:hidden" onClick={() => setMobileOpen(false)} aria-hidden />}
        <Sidebar active={nav} onNavigate={id => {
          setSeenNotificationIds(previous => ({
            ...previous,
            [id]: [...new Set([...(previous[id] || []), ...(notificationIds[id] || [])])],
          }))
          setNav(id)
          setMobileOpen(false)
        }} collapsed={collapsed && !mobileOpen}
          onToggle={() => { if (mobileOpen) setMobileOpen(false); else setCollapsed(c => !c) }}
          onSwitchView={onSwitchView} pendingConfirmations={unreadCount('delivery-confirmation')} mobileOpen={mobileOpen} pendingOrders={unreadCount('order-queue')} deferredOrders={unreadCount('deferrals')} loaderFlagCount={unreadCount('loader-flags')} storeReceiptCount={unreadCount('store-receipts')} />

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header search={search} onSearch={setSearch} isDark={isDark} onToggleDark={onToggleDark ?? (() => {})} onMenu={() => setMobileOpen(true)} username={username} userRole={userRole} onSignOut={onSwitchView ?? (() => {})} />

          <main className="flex-1 overflow-auto lg:overflow-hidden p-3 sm:p-4">
            {loadError && <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">{loadError}</div>}
            {isSplitView ? (
              <div className="flex flex-col lg:flex-row gap-4 lg:h-full min-w-0">
                <div className="w-full lg:w-[60%] h-[70dvh] min-h-[420px] lg:h-auto lg:min-h-0 shrink-0 lg:shrink bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
                  <OrderQueuePanel orders={orders} search={search} onAllocate={handleAllocate} onDefer={handleDefer} />
                </div>
                <div className="w-full lg:w-[40%] lg:overflow-auto flex flex-col gap-3">
                  <FleetStatusPanel vehicles={vehicles} orders={orders} />
                </div>
              </div>
            ) : (
              <div className="h-full overflow-auto">{renderPanel()}</div>
            )}
          </main>
        </div>

        {allocationModalId && <AllocationModal orderId={allocationModalId} orders={orders} vehicles={vehicles} onClose={() => setAllocationModalId(null)} onConfirm={confirmAllocation} />}
        {deferralModalId && <DeferralModal orderId={deferralModalId} orders={orders} onClose={() => setDeferralModalId(null)} onConfirm={confirmDeferral} />}
      </div>
    </div>
  )
}