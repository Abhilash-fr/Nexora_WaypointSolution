import type { DriverBase, DriverVehicleType, SignupRole, StoreBrand, StoreLocation } from './types'
import { getAccessToken } from './authSession'

const API_BASE = '/api/v1'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (import.meta.env.DEV && import.meta.env.VITE_API_MODE !== 'backend' && !path.startsWith('/auth/')) {
    return browserDemoRequest<T>(path, init)
  }

  let res: Response
  try {
    const token = getAccessToken()
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers || {}),
      },
    })
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`Could not reach the API at ${API_BASE}. Check that the backend is running and the frontend proxy is configured. ${reason}`)
  }
  if (!res.ok) {
    const detail = await res.text()
    if (res.status === 500 && (/ECONNREFUSED|http proxy error/i.test(detail) || detail.trim() === 'Request failed')) {
      throw new Error('The backend API is not running at http://127.0.0.1:8000. Start the backend, then try again.')
    }
    let message = detail || 'Request failed'
    try {
      const body: unknown = JSON.parse(detail)
      if (body && typeof body === 'object' && 'detail' in body) {
        if (typeof body.detail === 'string') {
          message = body.detail
        } else if (Array.isArray(body.detail)) {
          message = body.detail
            .map(item => item && typeof item === 'object' && 'msg' in item ? String(item.msg) : '')
            .filter(Boolean)
            .join('; ') || message
        }
      }
    } catch {
      // Keep non-JSON API error responses readable.
    }
    throw new Error(`HTTP ${res.status}: ${message}`)
  }
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    throw new Error(`Expected JSON from ${path}, but received ${contentType || 'an unknown response type'}. Check the API server and frontend proxy.`)
  }
  return res.json()
}

export interface BackendOrder {
  delivery_id: string
  order_date: string
  dispatch_date?: string | null
  dispatch_status: string
  outlet_id: string
  brand: string
  district: string
  depot: string
  temp_requirement: string
  order_units: number
  order_weight_kg: number
  order_volume_m3: number
  items?: { product_id: string; name: string; qty: number; unit: string }[] | null
  vehicle_id?: string | null
  trip_id?: number | null
  seq_in_route?: number | null
  deferred_yesterday?: number
  days_since_last_served?: number
}

export interface BackendVehicle {
  vehicle_id: string
  type: string
  temp: string
  weight_cap_kg: number
  volume_cap_m3: number
  fuel_type: string
  km_per_l: number
  weekly_fuel_quota_l: number
  depot: string
}

export interface BackendOutlet {
  outlet_id: string
  brand: string
  district: string
  depot: string
  dock_type: string
  parking_constraint: string
  window_open_time: string
  window_close_time: string
  mall_window?: string | null
}

export interface LoaderFlag {
  id: string
  deliveryId: string
  outletId: string
  itemDescription: string
  categories: string[]
  note: string
  photo?: { name: string; dataUrl: string }
  createdAt: string
}

export type NewLoaderFlag = Omit<LoaderFlag, 'id' | 'createdAt'>

export interface StoreReceipt {
  receiptId: string
  orderId: string
  outletId: string
  outletName: string
  brand: string
  referenceNumber: string
  confirmedAt: string
  vehicleId: string
  vehiclePlate: string
  driverName: string
  items: { name: string; qty: number; unit: string }[]
  issues: string[]
  affectedItem: string
  note: string
  result: 'confirmed' | 'confirmed_with_issues'
  scanConfirmed: boolean
  scannedAt: string | null
}

export type NewStoreReceipt = Omit<StoreReceipt, 'receiptId' | 'scanConfirmed' | 'scannedAt'>

export interface CreateOrderPayload {
  delivery_id: string
  order_date: string
  outlet_id: string
  brand: string
  district: string
  depot: string
  temp_requirement: string
  order_units: number
  order_weight_kg: number
  order_volume_m3: number
  dispatch_status: string
  items: { product_id: string; name: string; qty: number; unit: string }[]
}

export interface SignupPayload {
  employee_id: string
  username: string
  password: string
  role: SignupRole
  brand?: StoreBrand
  vehicle_type?: DriverVehicleType
  location?: DriverBase | StoreLocation
}

export interface LoginResponse {
  access_token: string
  token_type: 'bearer'
  expires_in: number
  role: SignupRole
  brand: StoreBrand | null
  vehicle_type: DriverVehicleType | null
  location: DriverBase | StoreLocation | null
}

interface BrowserDemoState {
  orders: BackendOrder[]
  vehicles: BackendVehicle[]
  outlets: BackendOutlet[]
  flags: LoaderFlag[]
  receipts: StoreReceipt[]
}

const BROWSER_DEMO_KEY = 'waypoint-browser-demo-v1'
let browserDemoState: BrowserDemoState | undefined

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function saveBrowserDemoState(state: BrowserDemoState) {
  browserDemoState = state
  try {
    window.localStorage.setItem(BROWSER_DEMO_KEY, JSON.stringify(state))
  } catch {
    // Keep the demo usable when browser storage is unavailable.
  }
}

function getBrowserDemoState(): BrowserDemoState {
  if (browserDemoState) return browserDemoState
  try {
    const saved = window.localStorage.getItem(BROWSER_DEMO_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<BrowserDemoState>
      if (Array.isArray(parsed.orders) && Array.isArray(parsed.vehicles) && Array.isArray(parsed.outlets)) {
        browserDemoState = {
          ...parsed,
          flags: Array.isArray(parsed.flags) ? parsed.flags : [],
          receipts: Array.isArray(parsed.receipts) ? parsed.receipts : [],
        } as BrowserDemoState
        return browserDemoState
      }
    }
  } catch {
    
  }

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const orderDate = tomorrow.toISOString().slice(0, 10)
  const state: BrowserDemoState = {
    flags: [],
    receipts: [],
    outlets: [
      { outlet_id: 'OUT001', brand: 'Fresh', district: 'Colombo', depot: 'Peliyagoda', dock_type: 'street', parking_constraint: 'van_only', window_open_time: '05:00', window_close_time: '07:30' },
      { outlet_id: 'OUT002', brand: 'Fresh', district: 'Colombo', depot: 'Peliyagoda', dock_type: 'rear_dock', parking_constraint: 'normal', window_open_time: '05:30', window_close_time: '08:00' },
      { outlet_id: 'OUT003', brand: 'Style', district: 'Kandy', depot: 'Kandy', dock_type: 'street', parking_constraint: 'normal', window_open_time: '06:00', window_close_time: '09:00' },
      { outlet_id: 'OUT004', brand: 'Tech', district: 'Gampaha', depot: 'Peliyagoda', dock_type: 'rear_dock', parking_constraint: 'normal', window_open_time: '06:00', window_close_time: '09:00' },
    ],
    vehicles: [
      { vehicle_id: 'VEH001', type: 'truck', temp: 'reefer', weight_cap_kg: 5510, volume_cap_m3: 26.4, fuel_type: 'diesel', km_per_l: 4.7, weekly_fuel_quota_l: 340, depot: 'Peliyagoda' },
      { vehicle_id: 'VEH002', type: 'truck', temp: 'reefer', weight_cap_kg: 3990, volume_cap_m3: 21.1, fuel_type: 'diesel', km_per_l: 6.1, weekly_fuel_quota_l: 610, depot: 'Peliyagoda' },
      { vehicle_id: 'VEH003', type: 'truck', temp: 'ambient', weight_cap_kg: 6840, volume_cap_m3: 33.4, fuel_type: 'diesel', km_per_l: 4.4, weekly_fuel_quota_l: 430, depot: 'Kandy' },
    ],
    orders: [
      { delivery_id: 'DLV-26001', order_date: orderDate, dispatch_status: 'assigned', outlet_id: 'OUT001', brand: 'Fresh', district: 'Colombo', depot: 'Peliyagoda', temp_requirement: 'reefer', order_units: 120, order_weight_kg: 840, order_volume_m3: 4.2, items: [{ product_id: 'F-01', name: 'Fresh produce', qty: 120, unit: 'crates' }], vehicle_id: 'VEH001', trip_id: 1, seq_in_route: 1 },
      { delivery_id: 'DLV-26002', order_date: orderDate, dispatch_status: 'assigned', outlet_id: 'OUT002', brand: 'Fresh', district: 'Colombo', depot: 'Peliyagoda', temp_requirement: 'reefer', order_units: 85, order_weight_kg: 610, order_volume_m3: 3.1, items: [{ product_id: 'F-02', name: 'Chilled goods', qty: 85, unit: 'crates' }], vehicle_id: 'VEH001', trip_id: 1, seq_in_route: 2 },
      { delivery_id: 'DLV-26003', order_date: orderDate, dispatch_status: 'pending', outlet_id: 'OUT003', brand: 'Style', district: 'Kandy', depot: 'Kandy', temp_requirement: 'ambient', order_units: 64, order_weight_kg: 420, order_volume_m3: 2.8, items: [{ product_id: 'S-01', name: 'Apparel cartons', qty: 64, unit: 'cartons' }] },
      { delivery_id: 'DLV-26004', order_date: orderDate, dispatch_status: 'pending', outlet_id: 'OUT004', brand: 'Tech', district: 'Gampaha', depot: 'Peliyagoda', temp_requirement: 'ambient', order_units: 42, order_weight_kg: 530, order_volume_m3: 3.6, items: [{ product_id: 'T-01', name: 'Electronics cartons', qty: 42, unit: 'cartons' }] },
    ],
  }
  saveBrowserDemoState(state)
  return state
}

async function browserDemoRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const state = getBrowserDemoState()
  const method = (init?.method || 'GET').toUpperCase()
  const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {}

  if (path === '/orders/' && method === 'GET') return clone(state.orders) as T
  if (path === '/orders/' && method === 'POST') {
    const colomboTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Colombo',
      hour: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date())
    const hour = Number(colomboTime.find(part => part.type === 'hour')?.value)
    const order = {
      ...body,
      dispatch_status: hour >= 16 ? 'deferred' : 'pending',
    } as unknown as BackendOrder
    state.orders.unshift(order)
    saveBrowserDemoState(state)
    return clone(order) as T
  }
  if (path.startsWith('/orders/') && method === 'PATCH') {
    const deliveryId = decodeURIComponent(path.slice('/orders/'.length))
    const order = state.orders.find(item => item.delivery_id === deliveryId)
    if (!order) throw new Error('Order not found')
    Object.assign(order, body)
    saveBrowserDemoState(state)
    return clone(order) as T
  }
  if (path === '/fleet/vehicles' && method === 'GET') return clone(state.vehicles) as T
  if (path === '/planning/outlets' && method === 'GET') return clone(state.outlets) as T
  if (path === '/loading/flags' && method === 'GET') return clone(state.flags) as T
  if (path === '/loading/flags' && method === 'POST') {
    const flag = { ...body, id: `FLAG-${Date.now()}`, createdAt: new Date().toISOString() } as unknown as LoaderFlag
    state.flags.unshift(flag)
    saveBrowserDemoState(state)
    return clone(flag) as T
  }
  if (path === '/store/receipts' && method === 'GET') {
    return clone(state.receipts.filter(receipt => receipt.scanConfirmed)) as T
  }
  if (path === '/store/receipts' && method === 'POST') {
    const receipt = {
      ...body,
      receiptId: `RCPT-${Date.now()}`,
      scanConfirmed: false,
      scannedAt: null,
    } as unknown as StoreReceipt
    state.receipts.unshift(receipt)
    saveBrowserDemoState(state)
    return clone(receipt) as T
  }
  if (path.startsWith('/store/receipts/') && path.endsWith('/scan') && method === 'POST') {
    const reference = decodeURIComponent(path.slice('/store/receipts/'.length, -'/scan'.length))
    const receipt = state.receipts.find(item => item.referenceNumber === reference.toUpperCase())
    if (!receipt) throw new Error('No store receipt matches this QR reference')
    if (!receipt.scanConfirmed) {
      receipt.scanConfirmed = true
      receipt.scannedAt = new Date().toISOString()
      receipt.driverName = String(body.driver_name || '')
      const order = state.orders.find(item => item.delivery_id === receipt.orderId)
      if (order) order.dispatch_status = 'delivered'
      saveBrowserDemoState(state)
    }
    return clone(receipt) as T
  }
  if (path === '/delivery/active-route' && method === 'GET') {
    const activeOrders = state.orders.filter(order => order.vehicle_id && ['assigned', 'dispatched', 'in_transit', 'delivered'].includes(order.dispatch_status))
    const firstOrder = activeOrders[0]
    const assigned = firstOrder
      ? activeOrders.filter(order => order.vehicle_id === firstOrder.vehicle_id && order.trip_id === firstOrder.trip_id)
      : []
    return {
      tripId: assigned[0]?.trip_id ? String(assigned[0].trip_id) : null,
      vehicleId: assigned[0]?.vehicle_id || null,
      vehiclePlate: assigned[0]?.vehicle_id || null,
      depot: state.vehicles.find(vehicle => vehicle.vehicle_id === assigned[0]?.vehicle_id)?.depot || null,
      driverName: 'Demo Driver',
      status: assigned.length ? 'IN_TRANSIT' : 'NO_ACTIVE_ROUTE',
      stops: assigned.map((order, index) => {
        const outlet = state.outlets.find(item => item.outlet_id === order.outlet_id)
        return {
          stopNumber: order.seq_in_route || index + 1,
          deliveryId: order.delivery_id,
          storeId: order.outlet_id,
          storeName: outlet?.brand || order.outlet_id,
          district: order.district,
          deliveryStatus: order.dispatch_status === 'delivered' ? 'COMPLETED' : 'PENDING',
          windowStart: outlet?.window_open_time,
          windowEnd: outlet?.window_close_time,
        }
      }),
    } as T
  }
  if (path === '/delivery/complete-stop' && method === 'POST') {
    const order = state.orders.find(item => item.delivery_id === body.delivery_id)
    if (!order) throw new Error('Delivery not found')
    order.dispatch_status = 'delivered'
    saveBrowserDemoState(state)
    return { status: 'completed', delivery: clone(order) } as T
  }
  if (path === '/loading/manifests' && method === 'GET') {
    const assigned = state.orders.filter(order => order.vehicle_id)
    const groups = new Map<string, BackendOrder[]>()
    for (const order of assigned) {
      const key = String(order.trip_id || order.vehicle_id)
      groups.set(key, [...(groups.get(key) || []), order])
    }
    return [...groups.entries()].map(([tripId, orders]) => ({
      tripId,
      vehicleId: orders[0].vehicle_id,
      vehiclePlate: orders[0].vehicle_id,
      driverName: 'Demo Driver',
      status: orders.every(order => order.dispatch_status === 'dispatched') ? 'DISPATCHED' : 'LOADING',
      items: orders.map(order => ({
        id: order.delivery_id,
        outletId: order.outlet_id,
        description: `${order.brand} order · ${order.outlet_id}`,
        qty: order.order_units,
        weightKg: order.order_weight_kg,
        loaded: ['loaded', 'dispatched', 'in_transit', 'delivered'].includes(order.dispatch_status),
      })),
      totalCrateCount: orders.reduce((sum, order) => sum + order.order_units, 0),
      loadedCrateCount: orders.filter(order => ['loaded', 'dispatched', 'in_transit', 'delivered'].includes(order.dispatch_status)).reduce((sum, order) => sum + order.order_units, 0),
    })) as T
  }
  if (path.startsWith('/loading/dispatch/') && method === 'POST') {
    const tripId = decodeURIComponent(path.slice('/loading/dispatch/'.length))
    const orders = state.orders.filter(order => String(order.trip_id) === tripId)
    orders.forEach(order => { order.dispatch_status = 'dispatched' })
    saveBrowserDemoState(state)
    return { status: 'dispatched', trip_id: tripId, count: orders.length } as T
  }
  throw new Error(`No browser demo handler for ${method} ${path}`)
}

export const api = {
  register: (data: SignupPayload) =>
    request<{ username: string; role: SignupRole; employee_id: string }>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (username: string, password: string) => {
    const form = new URLSearchParams({ username, password })
    return request<LoginResponse>('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    })
  },
  getOrders: () => request<BackendOrder[]>('/orders/'),
  createOrder: (data: CreateOrderPayload) => request<BackendOrder>('/orders/', { method: 'POST', body: JSON.stringify(data) }),
  updateOrder: (id: string, data: Partial<Pick<BackendOrder, 'dispatch_status' | 'vehicle_id' | 'trip_id' | 'seq_in_route'>>) =>
    request<BackendOrder>(`/orders/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }),
  getVehicles: () => request<BackendVehicle[]>('/fleet/vehicles'),
  getOutlets: () => request<BackendOutlet[]>('/planning/outlets'),
  getLoaderFlags: () => request<LoaderFlag[]>('/loading/flags'),
  createLoaderFlag: (flag: NewLoaderFlag) => request<LoaderFlag>('/loading/flags', { method: 'POST', body: JSON.stringify(flag) }),
  getStoreReceipts: () => request<StoreReceipt[]>('/store/receipts'),
  createStoreReceipt: (receipt: NewStoreReceipt) => request<StoreReceipt>('/store/receipts', { method: 'POST', body: JSON.stringify(receipt) }),
  scanStoreReceipt: (referenceNumber: string, driverName: string) =>
    request<StoreReceipt>(`/store/receipts/${encodeURIComponent(referenceNumber)}/scan`, {
      method: 'POST',
      body: JSON.stringify({ driver_name: driverName }),
    }),
  getActiveRoute: () => request<any>('/delivery/active-route'),
  completeStop: (deliveryId: string) =>
    request<any>('/delivery/complete-stop', { method: 'POST', body: JSON.stringify({ delivery_id: deliveryId }) }),
  getLoadingManifests: () => request<any[]>('/loading/manifests'),
  dispatchTrip: (tripId: string) =>
    request<any>(`/loading/dispatch/${encodeURIComponent(tripId)}`, { method: 'POST' }),
}
