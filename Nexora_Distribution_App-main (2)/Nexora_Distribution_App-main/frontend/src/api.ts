const API_BASE = '/api/v1'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    })
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`Could not reach the API at ${API_BASE}. Check that the backend is running and the frontend proxy is configured. ${reason}`)
  }
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`HTTP ${res.status}: ${detail || 'Request failed'}`)
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
  latitude?: number | null
  longitude?: number | null
}

export interface ActiveRouteStop {
  stopNumber: number
  deliveryId: string
  storeId: string
  storeName: string
  district: string
  deliveryStatus: string
  windowStart?: string | null
  windowEnd?: string | null
  latitude?: number | null
  longitude?: number | null
}

export interface ActiveRoute {
  tripId: string | null
  vehicleId: string | null
  vehiclePlate: string | null
  driverName: string | null
  status: string
  stops: ActiveRouteStop[]
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
  updateOutletLocation: (outletId: string, latitude: number, longitude: number) =>
    request<BackendOutlet>(`/planning/outlets/${encodeURIComponent(outletId)}/location`, {
      method: 'PATCH',
      body: JSON.stringify({ latitude, longitude }),
    }),
  getActiveRoute: () => request<ActiveRoute>('/delivery/active-route'),
  completeStop: (deliveryId: string) =>
    request<any>('/delivery/complete-stop', { method: 'POST', body: JSON.stringify({ delivery_id: deliveryId }) }),
  getLoadingManifests: () => request<any[]>('/loading/manifests'),
  dispatchTrip: (tripId: string) =>
    request<any>(`/loading/dispatch/${encodeURIComponent(tripId)}`, { method: 'POST' }),
}
