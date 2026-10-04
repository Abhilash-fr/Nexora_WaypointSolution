const API_BASE = '/api/v1'

const DEMO_ORDERS: BackendOrder[] = [
  {
    delivery_id: 'ORD-1001',
    order_date: '2026-10-04',
    dispatch_status: 'pending',
    outlet_id: 'MGM-011',
    brand: 'Fresh',
    district: 'Colombo 07',
    depot: 'Peliyagoda',
    temp_requirement: 'Fresh Reefer',
    order_units: 14,
    order_weight_kg: 440,
    order_volume_m3: 8.2,
    items: [{ product_id: 'FRESH-002', name: 'Fresh Milk', qty: 14, unit: 'cases' }],
    deferred_yesterday: 0,
    days_since_last_served: 2,
  },
  {
    delivery_id: 'ORD-1002',
    order_date: '2026-10-04',
    dispatch_status: 'assigned',
    outlet_id: 'KCG-204',
    brand: 'Style',
    district: 'Kandy',
    depot: 'Kandy',
    temp_requirement: 'Ambient',
    order_units: 9,
    order_weight_kg: 320,
    order_volume_m3: 5.7,
    items: [{ product_id: 'STYLE-011', name: 'Apparel Bundle', qty: 9, unit: 'boxes' }],
    vehicle_id: 'VH-03',
    trip_id: 1,
    seq_in_route: 2,
    deferred_yesterday: 0,
    days_since_last_served: 1,
  },
  {
    delivery_id: 'ORD-1003',
    order_date: '2026-10-04',
    dispatch_status: 'deferred',
    outlet_id: 'NPG-118',
    brand: 'Tech',
    district: 'Negombo',
    depot: 'Peliyagoda',
    temp_requirement: 'Ambient',
    order_units: 6,
    order_weight_kg: 180,
    order_volume_m3: 2.9,
    items: [{ product_id: 'TECH-010', name: 'Wireless Earbuds', qty: 6, unit: 'packs' }],
    deferred_yesterday: 1,
    days_since_last_served: 4,
  },
  {
    delivery_id: 'ORD-1004',
    order_date: '2026-10-04',
    dispatch_status: 'pending',
    outlet_id: 'RPT-078',
    brand: 'Fresh',
    district: 'Ratnapura',
    depot: 'Peliyagoda',
    temp_requirement: 'Fresh Reefer',
    order_units: 11,
    order_weight_kg: 390,
    order_volume_m3: 6.8,
    items: [{ product_id: 'FRESH-018', name: 'Ready Meals', qty: 11, unit: 'crates' }],
    deferred_yesterday: 0,
    days_since_last_served: 3,
  },
  {
    delivery_id: 'ORD-1005',
    order_date: '2026-10-04',
    dispatch_status: 'dispatched',
    outlet_id: 'JAF-317',
    brand: 'Tech',
    district: 'Jaffna',
    depot: 'Kandy',
    temp_requirement: 'Ambient',
    order_units: 8,
    order_weight_kg: 240,
    order_volume_m3: 4.4,
    items: [{ product_id: 'TECH-033', name: 'Phone Cases', qty: 8, unit: 'boxes' }],
    vehicle_id: 'VH-07',
    trip_id: 2,
    seq_in_route: 1,
    deferred_yesterday: 0,
    days_since_last_served: 1,
  },
  {
    delivery_id: 'ORD-1006',
    order_date: '2026-10-04',
    dispatch_status: 'delivered',
    outlet_id: 'BAM-905',
    brand: 'Style',
    district: 'Badulla',
    depot: 'Kandy',
    temp_requirement: 'Ambient',
    order_units: 10,
    order_weight_kg: 310,
    order_volume_m3: 5.2,
    items: [{ product_id: 'STYLE-052', name: 'Stationery Kit', qty: 10, unit: 'boxes' }],
    vehicle_id: 'VH-02',
    trip_id: 2,
    seq_in_route: 3,
    deferred_yesterday: 0,
    days_since_last_served: 2,
  },
]

const DEMO_VEHICLES: BackendVehicle[] = [
  { vehicle_id: 'VH-01', type: 'Refrigerated Van', temp: 'Reefer', weight_cap_kg: 1800, volume_cap_m3: 16, fuel_type: 'Diesel', km_per_l: 6.5, weekly_fuel_quota_l: 220, depot: 'Peliyagoda' },
  { vehicle_id: 'VH-02', type: 'Dry-box Truck', temp: 'Ambient', weight_cap_kg: 2300, volume_cap_m3: 18, fuel_type: 'Diesel', km_per_l: 7.1, weekly_fuel_quota_l: 240, depot: 'Peliyagoda' },
  { vehicle_id: 'VH-03', type: 'Small Van', temp: 'Ambient', weight_cap_kg: 900, volume_cap_m3: 6, fuel_type: 'Petrol', km_per_l: 8.4, weekly_fuel_quota_l: 170, depot: 'Kandy' },
  { vehicle_id: 'VH-07', type: 'Refrigerated Van', temp: 'Reefer', weight_cap_kg: 1700, volume_cap_m3: 15, fuel_type: 'Diesel', km_per_l: 6.1, weekly_fuel_quota_l: 210, depot: 'Kandy' },
]

const DEMO_OUTLETS: BackendOutlet[] = [
  { outlet_id: 'MGM-011', brand: 'Fresh', district: 'Colombo 07', depot: 'Peliyagoda', dock_type: 'Back Dock', parking_constraint: 'Limited loading bay', window_open_time: '07:00', window_close_time: '19:00', mall_window: '12:00-13:00' },
  { outlet_id: 'KCG-204', brand: 'Style', district: 'Kandy', depot: 'Kandy', dock_type: 'Front Dock', parking_constraint: 'No pallet jack', window_open_time: '08:00', window_close_time: '18:00', mall_window: '12:00-13:00' },
  { outlet_id: 'JAF-317', brand: 'Tech', district: 'Jaffna', depot: 'Kandy', dock_type: 'Back Dock', parking_constraint: 'Tight turn', window_open_time: '09:00', window_close_time: '17:00', mall_window: '13:00-14:00' },
]

const DEMO_ROUTE = {
  tripId: 'TRIP-17',
  vehicleId: 'VH-03',
  vehiclePlate: 'ABC-2043',
  driverName: 'Nimal Silva',
  status: 'IN_TRANSIT',
  stops: [
    { stopNumber: 1, deliveryId: 'ORD-1002', storeId: 'KCG-204', storeName: 'Waypoint Style - Kandy', district: 'Kandy', deliveryStatus: 'PENDING', windowStart: '08:00', windowEnd: '18:00' },
    { stopNumber: 2, deliveryId: 'ORD-1006', storeId: 'BAM-905', storeName: 'Waypoint Style - Badulla', district: 'Badulla', deliveryStatus: 'COMPLETED', windowStart: '09:00', windowEnd: '17:00' },
  ],
}

const DEMO_LOADING_MANIFESTS = [{
  tripId: '1',
  vehicleId: 'VH-03',
  vehiclePlate: 'VH-03',
  driverName: 'Nimal Silva',
  status: 'LOADING',
  items: [
    { id: 'ORD-1002', description: 'Waypoint Style order', qty: 9, weightKg: 320, loaded: false },
  ],
  totalCrateCount: 9,
  loadedCrateCount: 0,
}]

function getDemoFallback<T>(path: string): T | null {
  if (path === '/orders/') return DEMO_ORDERS as T
  if (path === '/fleet/vehicles') return DEMO_VEHICLES as T
  if (path === '/planning/outlets') return DEMO_OUTLETS as T
  if (path === '/delivery/active-route') return DEMO_ROUTE as T
  if (path === '/loading/manifests') return DEMO_LOADING_MANIFESTS as T
  return null
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    })
  } catch (error) {
    const fallback = getDemoFallback<T>(path)
    if (fallback) return fallback
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`Could not reach the API at ${API_BASE}. Check that the backend is running and the frontend proxy is configured. ${reason}`)
  }
  if (!res.ok) {
    const fallback = getDemoFallback<T>(path)
    if (fallback) return fallback
    const detail = await res.text()
    throw new Error(`HTTP ${res.status}: ${detail || 'Request failed'}`)
  }
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    const fallback = getDemoFallback<T>(path)
    if (fallback) return fallback
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

export const api = {
  getOrders: () => request<BackendOrder[]>('/orders/'),
  createOrder: (data: CreateOrderPayload) => request<BackendOrder>('/orders/', { method: 'POST', body: JSON.stringify(data) }),
  updateOrder: (id: string, data: Partial<Pick<BackendOrder, 'dispatch_status' | 'vehicle_id' | 'trip_id' | 'seq_in_route'>>) =>
    request<BackendOrder>(`/orders/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }),
  getVehicles: () => request<BackendVehicle[]>('/fleet/vehicles'),
  getOutlets: () => request<BackendOutlet[]>('/planning/outlets'),
  getActiveRoute: () => request<any>('/delivery/active-route'),
  completeStop: (deliveryId: string) =>
    request<any>('/delivery/complete-stop', { method: 'POST', body: JSON.stringify({ delivery_id: deliveryId }) }),
  getLoadingManifests: () => request<any[]>('/loading/manifests'),
  dispatchTrip: (tripId: string) =>
    request<any>(`/loading/dispatch/${encodeURIComponent(tripId)}`, { method: 'POST' }),
}
