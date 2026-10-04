import { useState, useEffect, useRef } from 'react'
import { BrowserQRCodeReader } from '@zxing/browser'
import { api } from './api'
import ProfileMenu from './components/ProfileMenu'
import type { DriverBase, DriverVehicleType, SignupRole, StoreLocation } from './types'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'


delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

type StopStatus = 'upcoming' | 'active' | 'arrived' | 'unloading' | 'pod' | 'completed'
type ConnectionState = 'online' | 'offline' | 'syncing'

interface StopTag { type: 'van_only' | 'rear_dock' | 'mall_bay' | 'fresh_cutoff' | 'no_park'; label: string }
interface DeliveryItem { id: string; description: string; cases: number; weightKg: number }

interface DeliveryStop {
  id: string; stopNo: number; outletId: string; outletName: string
  district: string; address: string; windowStart: string; windowEnd: string
  location?: [number, number]
  brand: 'Waypoint Fresh' | 'Waypoint Style' | 'Waypoint Tech'
  tags: StopTag[]; items: DeliveryItem[]; status: StopStatus
  arrivedAt?: string; completedAt?: string; podName?: string; podRef?: string
}

interface OfflineAction { id: string; type: string; timestamp: string; stopId: string }

type MapPoint = [number, number]

const DISTRICT_CENTERS: Record<string, MapPoint> = {
  Colombo: [6.9271, 79.8612],
  Gampaha: [7.084, 80.0098],
  Kalutara: [6.5854, 79.9607],
  Galle: [6.0535, 80.221],
  Matara: [5.9485, 80.5353],
  Kurunegala: [7.4863, 80.3623],
  Puttalam: [8.0362, 79.8283],
  Kandy: [7.2906, 80.6337],
  Matale: [7.4675, 80.6234],
  'Nuwara Eliya': [6.9497, 80.7891],
  Badulla: [6.9934, 81.055],
  Kegalle: [7.2513, 80.3464],
}

const DEPOT_LOCATIONS: Record<string, MapPoint> = {
  Peliyagoda: [6.9553, 79.918],
  Kandy: [7.2906, 80.6337],
}

const depotIcon = L.divIcon({
  className: '',
  html: '<div style="width:32px;height:32px;border:3px solid white;border-radius:50%;background:#0f172a;color:white;display:flex;align-items:center;justify-content:center;font:bold 12px sans-serif;box-shadow:0 2px 8px #0006">D</div>',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
})

const driverIcon = L.divIcon({
  className: '',
  html: '<div style="width:22px;height:22px;border:4px solid white;border-radius:50%;background:#2563eb;box-shadow:0 1px 8px #0007"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
})

function destinationIcon(stopNumber: number, completed: boolean, count: number) {
  const color = completed ? '#0f766e' : '#ea580c'
  const label = count > 1 ? `${stopNumber}+${count - 1}` : String(stopNumber)
  return L.divIcon({
    className: '',
    html: `<div style="min-width:30px;height:30px;padding:0 5px;border:3px solid white;border-radius:18px;background:${color};color:white;display:flex;align-items:center;justify-content:center;font:bold 11px sans-serif;box-shadow:0 2px 8px #0006">${label}</div>`,
    iconSize: [Math.max(30, label.length * 9 + 14), 30],
    iconAnchor: [15, 15],
  })
}

function RouteMapViewport({ points }: { points: MapPoint[] }) {
  const map = useMap()
  const pointsKey = points.map(point => point.join(',')).join(';')

  useEffect(() => {
    const timer = window.setTimeout(() => {
      map.invalidateSize()
      if (points.length > 1) {
        map.fitBounds(L.latLngBounds(points), { padding: [28, 28], maxZoom: 12 })
      } else if (points.length === 1) {
        map.setView(points[0], 11)
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [map, pointsKey])

  return null
}

function LocateMeControl({ onLocation, onError }: {
  onLocation: (location: MapPoint) => void
  onError: (message: string) => void
}) {
  const map = useMap()

  function locateUser() {
    onError('')
    if (!navigator.geolocation) {
      onError('Location is not available in this browser.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      position => {
        const current: MapPoint = [position.coords.latitude, position.coords.longitude]
        onLocation(current)
        map.flyTo(current, 15, { duration: 0.8 })
      },
      error => onError(
        error.code === error.PERMISSION_DENIED
          ? 'Allow location access in your browser to find your position.'
          : 'Could not get your location. Check GPS and try again.',
      ),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    )
  }

  return (
    <button
      type="button"
      onClick={locateUser}
      className="absolute right-3 top-3 z-[1000] flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-lg transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
      aria-label="Locate me on the map"
    >
      <span aria-hidden="true">◎</span>
      Locate me
    </button>
  )
}

function DriverRouteMap({ stops, depot }: {
  stops: DeliveryStop[]
  depot: string
}) {
  const [userLocation, setUserLocation] = useState<MapPoint | null>(null)
  const [locationMessage, setLocationMessage] = useState('')
  const [routeLine, setRouteLine] = useState<MapPoint[]>([])
  const [routeStatus, setRouteStatus] = useState<'loading' | 'road' | 'direct' | 'empty'>('empty')
  const depotPosition = DEPOT_LOCATIONS[depot] || DEPOT_LOCATIONS.Peliyagoda
  const locatedStops = stops.filter(stop => stop.location)
  const mapStops = locatedStops.filter(stop =>
    stop.location && (stop.location[0] !== depotPosition[0] || stop.location[1] !== depotPosition[1]),
  )
  const points: MapPoint[] = [depotPosition, ...mapStops.map(stop => stop.location!)]
  const districts = new Map<string, DeliveryStop[]>()
  for (const stop of mapStops) {
    const key = stop.district || stop.outletId
    districts.set(key, [...(districts.get(key) || []), stop])
  }
  const routeWaypoints = points.filter((point, index) =>
    index === 0 || point[0] !== points[index - 1][0] || point[1] !== points[index - 1][1],
  )

  useEffect(() => {
    if (routeWaypoints.length < 2) {
      setRouteLine([])
      setRouteStatus('empty')
      return
    }
    const controller = new AbortController()
    setRouteStatus('loading')
    const coordinates = routeWaypoints.map(([lat, lon]) => `${lon},${lat}`).join(';')

    fetch(`https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error(`Routing service returned ${response.status}`)
        const data = await response.json() as { code?: string; routes?: { geometry?: { coordinates?: [number, number][] } }[] }
        const routeCoordinates = data.routes?.[0]?.geometry?.coordinates
        if (data.code !== 'Ok' || !routeCoordinates?.length) throw new Error('Road route is unavailable')
        setRouteLine(routeCoordinates.map(([lon, lat]) => [lat, lon]))
        setRouteStatus('road')
      })
      .catch(error => {
        if (controller.signal.aborted) return
        setRouteLine(routeWaypoints)
        setRouteStatus('direct')
        setLocationMessage(error instanceof Error ? 'Showing a direct line; road routing is temporarily unavailable.' : '')
      })

    return () => controller.abort()
  }, [routeWaypoints.map(point => point.join(',')).join(';')])

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={depotPosition}
        zoom={10}
        scrollWheelZoom
        className="h-full w-full"
        zoomControl={false}
        attributionControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocateMeControl onLocation={setUserLocation} onError={setLocationMessage} />
        <RouteMapViewport points={points} />
        {routeLine.length > 1 && (
          <Polyline
            positions={routeLine}
            pathOptions={{
              color: routeStatus === 'road' ? '#0d9488' : '#64748b',
              weight: 5,
              opacity: 0.85,
              dashArray: routeStatus === 'direct' ? '8 9' : undefined,
            }}
          />
        )}
        <Marker position={depotPosition} icon={depotIcon}>
          <Popup>Trip starts here · {depot} Depot</Popup>
        </Marker>
        {[...districts.entries()].map(([district, districtStops]) => {
          const first = districtStops[0]
          return (
            <Marker
              key={district}
              position={first.location!}
              icon={destinationIcon(first.stopNo, districtStops.every(stop => stop.status === 'completed'), districtStops.length)}
            >
              <Popup>
                <strong>{districtStops.length > 1 ? `${districtStops.length} delivery stops` : `Stop ${first.stopNo}`} · {district}</strong>
                <ul>{districtStops.map(stop => <li key={stop.id}>{stop.stopNo}. {stop.outletId} · {stop.status}</li>)}</ul>
              </Popup>
            </Marker>
          )
        })}
        {userLocation && (
          <Marker position={userLocation} icon={driverIcon}>
            <Popup>Your current location</Popup>
          </Marker>
        )}
      </MapContainer>
      <div className="absolute bottom-2 left-2 z-[1000] max-w-[calc(100%-1rem)] rounded-lg bg-white/95 px-2.5 py-2 text-[10px] text-slate-700 shadow-md dark:bg-slate-900/95 dark:text-slate-200">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span><b className="text-slate-900 dark:text-white">D</b> Depot</span>
          <span><b className="text-orange-600">1</b> Delivery stop</span>
          <span><b className="text-blue-600">●</b> Your location</span>
          <span>{routeStatus === 'loading' ? 'Finding road route…' : routeStatus === 'road' ? 'Road route' : routeStatus === 'direct' ? 'Direct line' : 'No route'}</span>
        </div>
      </div>
      {(locationMessage || stops.some(stop => !stop.location)) && (
        <div className="absolute left-2 right-2 top-14 z-[1000] rounded-lg bg-white/95 px-3 py-2 text-[10px] text-slate-600 shadow dark:bg-slate-900/95 dark:text-slate-300">
          {locationMessage || 'Some stops have no district location and are not shown on the map.'}
          {stops.some(stop => !stop.location) && locationMessage && ' Some stops have no district location.'}
        </div>
      )}
    </div>
  )
}

const VEHICLE_ID = '—'
const PLATE = '—'
const DRIVER = '—'

function nowTime() { return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) }

function tagStyle(type: StopTag['type']) {
  switch (type) {
    case 'fresh_cutoff': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700'
    case 'rear_dock': return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700'
    case 'mall_bay': return 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/40 dark:text-violet-300 dark:border-violet-700'
    case 'van_only': return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700'
    case 'no_park': return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-700'
  }
}

function tagIcon(type: StopTag['type']) {
  switch (type) {
    case 'fresh_cutoff': return '⏱'
    case 'rear_dock': return '↩'
    case 'mall_bay': return '🅿'
    case 'van_only': return '🚐'
    case 'no_park': return '⛔'
  }
}

function QRReferenceInput({ onRefReceived, receivedRef }: {
  onRefReceived: (ref: string) => Promise<void>; receivedRef: string | null
}) {
  const [manualRef, setManualRef] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [scanError, setScanError] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const verifyRef = useRef(onRefReceived)
  verifyRef.current = onRefReceived

  async function submitReference(value: string) {
    const reference = value.trim().toUpperCase()
    if (!/^REF-\d{8}-\d{5}$/.test(reference)) {
      setScanError('This is not a valid Waypoint delivery reference.')
      return
    }
    setScanError('')
    setIsVerifying(true)
    try {
      await verifyRef.current(reference)
      setManualRef(reference)
      setIsScanning(false)
    } catch (error) {
      setScanError(error instanceof Error ? error.message : 'Could not verify this delivery reference.')
    } finally {
      setIsVerifying(false)
    }
  }

  useEffect(() => {
    if (!isScanning || receivedRef || !videoRef.current) return
    let cancelled = false
    let stopScanner: (() => void) | undefined
    const reader = new BrowserQRCodeReader()

    reader.decodeFromVideoDevice(undefined, videoRef.current, (result, _error, controls) => {
      if (!result || cancelled) return
      controls.stop()
      stopScanner = undefined
      setIsScanning(false)
      void submitReference(result.getText())
    }).then(controls => {
      if (cancelled) controls.stop()
      else stopScanner = () => controls.stop()
    }).catch(error => {
      if (cancelled) return
      setIsScanning(false)
      setScanError(error instanceof Error ? error.message : 'Could not access the camera. Check camera permissions.')
    })

    return () => {
      cancelled = true
      stopScanner?.()
    }
  }, [isScanning, receivedRef])

  if (receivedRef) {
    return (
      <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-300 dark:border-teal-700 rounded-2xl px-4 py-4 flex items-center gap-3">
        <span className="text-teal-500 text-2xl shrink-0">✓</span>
        <div>
          <p className="font-semibold text-teal-800 dark:text-teal-300 text-sm">Reference Confirmed</p>
          <p className="font-mono text-xs text-teal-600 dark:text-teal-400 mt-0.5">{receivedRef}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {isScanning && (
        <div className="overflow-hidden rounded-xl border border-slate-300 bg-black dark:border-slate-600">
          <video ref={videoRef} className="max-h-64 w-full object-cover" muted playsInline aria-label="Camera view for scanning delivery QR" />
          <button type="button" onClick={() => setIsScanning(false)} className="w-full bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            Cancel camera scan
          </button>
        </div>
      )}
      {!isScanning && (
        <button type="button" onClick={() => { setScanError(''); setIsScanning(true) }} disabled={isVerifying}
          className="w-full rounded-xl border border-teal-300 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-800 transition-colors hover:bg-teal-100 disabled:opacity-50 dark:border-teal-800 dark:bg-teal-900/20 dark:text-teal-300 dark:hover:bg-teal-900/40">
          {isVerifying ? 'Verifying delivery reference…' : 'Scan store QR code'}
        </button>
      )}
      <div className="flex items-center gap-2 my-1">
        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
        <span className="font-mono text-[10px] text-slate-400 px-2">or enter manually</span>
        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
      </div>

      <div className="flex gap-2">
        <input value={manualRef} onChange={e => setManualRef(e.target.value.toUpperCase())}
          placeholder="REF-20261003-00441"
          className="flex-1 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-200 rounded-xl px-4 py-3 text-sm font-mono placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20" />
        <button onClick={() => void submitReference(manualRef)}
          disabled={isVerifying || !manualRef.trim().startsWith('REF-')}
          className="px-4 py-3 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl transition-colors">
          {isVerifying ? '…' : 'Verify'}
        </button>
      </div>
      <p className="font-mono text-[10px] text-slate-400 text-center">Format: REF-YYYYMMDD-XXXXX</p>
      {scanError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">{scanError}</p>}
    </div>
  )
}

function StopCard({ stop, onTap }: { stop: DeliveryStop; isDark: boolean; onTap: () => void }) {
  const isActive = stop.status === 'active' || stop.status === 'arrived' || stop.status === 'unloading' || stop.status === 'pod'
  const isDone = stop.status === 'completed'
  const totalWeight = stop.items.reduce((s, i) => s + i.weightKg, 0)

  return (
    <button onClick={isDone ? undefined : onTap} disabled={stop.status === 'upcoming' || isDone}
      className={`w-full text-left rounded-2xl border-2 overflow-hidden transition-all active:scale-[0.98] ${
        isDone ? 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 opacity-60'
        : isActive ? 'border-teal-500 bg-white dark:bg-slate-800 shadow-lg shadow-teal-100 dark:shadow-teal-900/30'
        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
      }`}>
      {isActive && <div className="h-1 bg-teal-500" />}
      {isDone && <div className="h-1 bg-emerald-400" />}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-11 h-11 rounded-xl shrink-0 flex items-center justify-center font-bold text-lg ${
            isDone ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300'
            : isActive ? 'bg-teal-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
          }`}>
            {isDone ? '✓' : stop.stopNo}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-0.5">
              <div>
                <span className="font-bold text-slate-900 dark:text-white text-base leading-tight">{stop.outletId}</span>
                <span className="text-slate-500 dark:text-slate-400 text-sm ml-2">{stop.district}</span>
              </div>
              {isActive && <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-700 shrink-0">Active</span>}
              {isDone && <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700 shrink-0">Done {stop.completedAt}</span>}
            </div>
            <p className="text-slate-600 dark:text-slate-300 text-sm font-medium truncate mb-2">{stop.outletName}</p>
            <div className="flex items-center gap-2 mb-2.5 font-mono text-xs">
              <span className={`font-semibold ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-slate-500 dark:text-slate-400'}`}>{stop.windowStart} – {stop.windowEnd}</span>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span className="text-slate-400">{totalWeight} kg · {stop.items.length} lines</span>
            </div>
            {stop.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {stop.tags.map(tag => (
                  <span key={tag.type} className={`inline-flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded-full border ${tagStyle(tag.type)}`}>
                    <span>{tagIcon(tag.type)}</span>{tag.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

function ActiveStopScreen({ stop, offlineActions, driverUsername, onBack, onStatusUpdate }: {
  stop: DeliveryStop; isDark: boolean; offlineActions: OfflineAction[]
  driverUsername: string
  onBack: () => void
  onStatusUpdate: (stopId: string, status: StopStatus, extra?: Partial<DeliveryStop>) => void
}) {
  const [podName, setPodName] = useState('')
  const [podRef, setPodRef] = useState<string | null>(null)

  const totalWeight = stop.items.reduce((s, i) => s + i.weightKg, 0)
  const totalCases = stop.items.reduce((s, i) => s + i.cases, 0)

  function handlePrimary() {
    if (stop.status === 'active') onStatusUpdate(stop.id, 'arrived', { arrivedAt: nowTime() })
    else if (stop.status === 'arrived') onStatusUpdate(stop.id, 'unloading')
    else if (stop.status === 'unloading') onStatusUpdate(stop.id, 'pod')
    else if (stop.status === 'pod') {
      if (!podName.trim() || !podRef) return
      onStatusUpdate(stop.id, 'completed', { completedAt: nowTime(), podName: podName.trim(), podRef })
      onBack()
    }
  }

  const btnLabel = { active: 'Mark Arrived', arrived: 'Start Unloading', unloading: 'Complete Delivery', pod: 'Submit & Complete' }[stop.status as string] ?? ''
  const btnEnabled = stop.status !== 'pod' || (!!podName.trim() && !!podRef)

  const progressSteps = [
    { key: 'active', label: 'En Route' }, { key: 'arrived', label: 'Arrived' },
    { key: 'unloading', label: 'Unloading' }, { key: 'pod', label: 'Sign-off' }, { key: 'completed', label: 'Done' },
  ]
  const stepIndex = progressSteps.findIndex(s => s.key === stop.status)

  return (
    <div className="flex flex-col h-full max-h-full overflow-hidden">
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center gap-3 shrink-0">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 active:bg-slate-200 transition-colors">←</button>
        <div className="flex-1">
          <div className="font-bold text-slate-900 dark:text-white text-base">{stop.outletId} · Stop {stop.stopNo}</div>
          <div className="font-mono text-xs text-slate-500 dark:text-slate-400">{stop.outletName}</div>
        </div>
        <div className={`font-mono text-[10px] px-2 py-1 rounded-lg border ${
          stop.status === 'unloading' ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/40 dark:border-amber-700 dark:text-amber-300'
          : stop.status === 'arrived' ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/40 dark:border-blue-700 dark:text-blue-300'
          : stop.status === 'pod' ? 'bg-violet-50 border-violet-200 text-violet-700 dark:bg-violet-900/40 dark:border-violet-700 dark:text-violet-300'
          : 'bg-teal-50 border-teal-200 text-teal-700 dark:bg-teal-900/40 dark:border-teal-700 dark:text-teal-300'
        }`}>
          {stop.status === 'active' ? 'En Route' : stop.status === 'arrived' ? 'Arrived' : stop.status === 'unloading' ? 'Unloading' : 'Sign-off'}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-4 py-3 shrink-0">
        <div className="flex items-center gap-0">
          {progressSteps.map((step, i) => (
            <div key={step.key} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  i < stepIndex ? 'bg-teal-500 border-teal-500 text-white'
                  : i === stepIndex ? 'bg-white dark:bg-slate-800 border-teal-500 text-teal-600 dark:text-teal-400'
                  : 'bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-300 dark:text-slate-600'
                }`}>
                  {i < stepIndex ? '✓' : i + 1}
                </div>
                <span className={`font-mono text-[9px] mt-0.5 whitespace-nowrap ${i === stepIndex ? 'text-teal-600 dark:text-teal-400 font-bold' : 'text-slate-400'}`}>{step.label}</span>
              </div>
              {i < progressSteps.length - 1 && <div className={`flex-1 h-0.5 mx-1 mb-3 ${i < stepIndex ? 'bg-teal-400' : 'bg-slate-200 dark:bg-slate-700'}`} />}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900 pb-20">
        <div className="bg-white dark:bg-slate-800 mx-4 mt-4 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">Delivery Window</span>
              <span className="font-mono text-sm font-bold text-teal-700 dark:text-teal-400">{stop.windowStart} – {stop.windowEnd}</span>
            </div>
          </div>
          <div className="px-4 py-3">
            <p className="font-mono text-[10px] text-slate-400 uppercase mb-1">Address & Instructions</p>
            <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{stop.address}</p>
          </div>
          {stop.arrivedAt && <div className="px-4 py-2.5 bg-teal-50 dark:bg-teal-900/20 border-t border-teal-100 dark:border-teal-800"><span className="font-mono text-xs text-teal-700 dark:text-teal-400">✓ Arrived at {stop.arrivedAt}</span></div>}
        </div>

        {stop.tags.length > 0 && (
          <div className="mx-4 mt-3 space-y-2">
            {stop.tags.map(tag => (
              <div key={tag.type} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${tagStyle(tag.type)}`}>
                <span className="text-lg shrink-0">{tagIcon(tag.type)}</span>
                <span className="font-semibold text-sm">{tag.label}</span>
              </div>
            ))}
          </div>
        )}

        {stop.status !== 'pod' && (
          <div className="bg-white dark:bg-slate-800 mx-4 mt-3 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden mb-4">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">Order Lines</span>
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{totalCases} cases · {totalWeight} kg</span>
            </div>
            <div className="divide-y divide-slate-50 dark:divide-slate-700/60">
              {stop.items.map(item => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-mono text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0">{item.cases}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 dark:text-slate-200 font-medium leading-tight">{item.description}</p>
                    <p className="font-mono text-[11px] text-slate-400">{item.weightKg} kg</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {stop.status === 'pod' && (
          <div className="mx-4 mt-3 mb-4 space-y-3">
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl px-4 py-3 flex items-center gap-3">
              <span className="text-amber-500 text-xl">📋</span>
              <div>
                <p className="font-semibold text-amber-800 dark:text-amber-300 text-sm">Proof of Delivery Required</p>
                <p className="font-mono text-[10px] text-amber-600 dark:text-amber-400">Scan the store's QR code or enter the reference number</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="px-4 pt-4 pb-2">
                <label className="font-mono text-[10px] text-slate-400 uppercase tracking-widest block mb-2">Received By <span className="text-red-500">*</span></label>
                <input type="text" value={podName} onChange={e => setPodName(e.target.value)} placeholder="Customer / store manager name"
                  className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3.5 text-base text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-4">
              <label className="font-mono text-[10px] text-slate-400 uppercase tracking-widest block mb-3">
                Delivery Reference <span className="text-red-500">*</span>
              </label>
              <QRReferenceInput
                receivedRef={podRef}
                onRefReceived={async reference => {
                  const receipt = await api.scanStoreReceipt(reference, driverUsername)
                  setPodRef(receipt.referenceNumber)
                }}
              />
            </div>

            {(!podName.trim() || !podRef) && (
              <div className="flex items-center gap-2 px-4 py-3 bg-slate-100 dark:bg-slate-700/60 rounded-xl">
                <span className="text-slate-400 text-sm">ℹ</span>
                <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  {!podName.trim() ? 'Enter customer name' : 'Scan or enter reference number'} to complete
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 px-4 py-4">
        {offlineActions.length > 0 && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <span className="font-mono text-[10px] text-amber-700 dark:text-amber-300">{offlineActions.length} action{offlineActions.length > 1 ? 's' : ''} pending sync</span>
          </div>
        )}
        <button onClick={handlePrimary} disabled={!btnEnabled}
          className={`w-full py-5 rounded-2xl font-bold text-lg transition-all active:scale-[0.98] ${
            btnEnabled
              ? stop.status === 'pod' ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-100 dark:shadow-emerald-900/30' : 'bg-teal-600 hover:bg-teal-500 text-white shadow-lg shadow-teal-100 dark:shadow-teal-900/30'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
          }`}>
          {btnLabel}
        </button>
      </div>
    </div>
  )
}

export default function DriverApp({ onSwitchView, isDark = false, onToggleDark, username, userRole, vehicleType, startingLocation }: {
  onSwitchView: () => void; isDark?: boolean; onToggleDark?: () => void
  username: string; userRole: SignupRole
  vehicleType?: DriverVehicleType | null
  startingLocation?: DriverBase | StoreLocation | null
}) {
  const [stops, setStops] = useState<DeliveryStop[]>([])
  const [depotName, setDepotName] = useState(startingLocation === 'Kandy' ? 'Kandy' : 'Peliyagoda')
  const [activeStopId, setActiveStopId] = useState<string | null>(null)
  const [connection, setConnection] = useState<ConnectionState>('online')
  const [offlineActions, setOfflineActions] = useState<OfflineAction[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api.getActiveRoute().then(route => {
      if (cancelled) return
      const mapped: DeliveryStop[] = (route.stops || []).map((s: any, i: number) => ({
        id: s.deliveryId || `${s.storeId}-${i}`, stopNo: Number(s.stopNumber || i + 1), outletId: s.storeId,
        outletName: s.storeName, district: s.district || '', address: 'Address not available in database',
        location: DISTRICT_CENTERS[s.district],
        windowStart: s.windowStart || '—', windowEnd: s.windowEnd || '—',
        brand: 'Waypoint Fresh', tags: [], items: [], status: s.deliveryStatus === 'COMPLETED' ? 'completed' : i === 0 ? 'active' : 'upcoming',
      }))
      setStops(mapped)
      setDepotName(route.depot || startingLocation || 'Peliyagoda')
      setConnection('online')
      setLoadError(null)
    }).catch(err => !cancelled && setLoadError(err instanceof Error ? err.message : 'Failed to load route'))
    return () => { cancelled = true }
  }, [startingLocation])

  function handleStatusUpdate(stopId: string, status: StopStatus, extra?: Partial<DeliveryStop>) {
    setStops(prev => prev.map(s => s.id === stopId ? { ...s, status, ...extra } : s))
    if (status === 'completed') {
      void api.completeStop(stopId).catch(err => setLoadError(err instanceof Error ? err.message : 'Failed to complete delivery'))
    } else if (connection !== 'online') {
      setOfflineActions(prev => [...prev, { id: crypto.randomUUID(), type: `status:${status}`, timestamp: nowTime(), stopId }])
    }
  }

  const activeStop = stops.find(s => s.id === activeStopId)
  const completedCount = stops.filter(s => s.status === 'completed').length

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className="min-h-[100dvh] bg-slate-200 dark:bg-slate-950 sm:flex sm:items-center sm:justify-center sm:p-6">
        <div className="h-[100dvh] sm:h-[min(844px,calc(100dvh-3rem))] w-full sm:max-w-[400px] flex flex-col bg-slate-50 dark:bg-slate-900 overflow-hidden sm:rounded-[2rem] sm:border-[6px] sm:border-slate-900 dark:sm:border-slate-700 sm:shadow-2xl" style={{ fontFamily: "'Inter', sans-serif" }}>

          {loadError && <div className="mx-4 mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{loadError}</div>}
          <div className="relative z-50 bg-slate-900 dark:bg-slate-950 text-white px-4 pb-2.5 shrink-0" style={{ paddingTop: 'max(env(safe-area-inset-top), 24px)' }}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className={`flex items-center gap-1.5 text-xs font-mono font-medium rounded-full px-2.5 py-1 ${
                connection === 'online' ? 'bg-emerald-900/60 text-emerald-400'
                : connection === 'syncing' ? 'bg-amber-900/60 text-amber-400'
                : 'bg-red-900/60 text-red-400'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${connection === 'online' ? 'bg-emerald-500' : connection === 'syncing' ? 'bg-amber-400 animate-pulse' : 'bg-red-500 animate-pulse'}`} />
                {connection === 'online' ? 'Online' : connection === 'syncing' ? 'Syncing…' : 'Offline'}
              </div>
              <div className="flex items-center gap-2">
                {onToggleDark && (
                  <button onClick={onToggleDark} aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'} className="h-10 w-10 rounded-xl border border-white/15 bg-white/5 font-mono text-sm text-slate-300 hover:bg-white/10 hover:text-white transition-colors">
                    {isDark ? '☀' : '☾'}
                  </button>
                )}
                <ProfileMenu username={username} role={userRole} onSignOut={onSwitchView} dark />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-slate-400">Vehicle</span>
                <span className="font-mono text-xs font-bold text-teal-400 bg-teal-900/50 px-2 py-0.5 rounded-md">{vehicleType || VEHICLE_ID}</span>
                <span className="font-mono text-[10px] text-slate-500">{startingLocation || PLATE}</span>
              </div>
              {offlineActions.length > 0 && (
                <div className="flex items-center gap-1.5 bg-amber-900/50 rounded-full px-2.5 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span className="font-mono text-[10px] text-amber-300">{offlineActions.length} pending</span>
                </div>
              )}
            </div>
          </div>

          {activeStop && activeStop.status !== 'completed' ? (
            <ActiveStopScreen stop={activeStop} isDark={isDark} offlineActions={offlineActions} driverUsername={username} onBack={() => setActiveStopId(null)} onStatusUpdate={handleStatusUpdate} />
          ) : (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3.5 shrink-0">
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="font-bold text-slate-900 dark:text-white text-lg leading-tight">Today's Route</h1>
                    <p className="font-mono text-xs text-slate-500 dark:text-slate-400 mt-0.5">{DRIVER} · Trip 1</p>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-xs text-slate-400">{completedCount}/{stops.length} stops</div>
                    <div className="font-mono text-[10px] text-slate-400">Waypoint Fresh</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500 rounded-full transition-all duration-700" style={{ width: `${(completedCount / stops.length) * 100}%` }} />
                  </div>
                  <span className="font-mono text-xs text-slate-500 dark:text-slate-400 shrink-0">{Math.round((completedCount / stops.length) * 100)}%</span>
                </div>
              </div>

              <div className="mx-4 mt-3 shrink-0 overflow-hidden rounded-xl border border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
                <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800">
                  <div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Trip map</p>
                    <p className="font-mono text-[10px] text-slate-500 dark:text-slate-400">{depotName} depot · {stops.length} delivery {stops.length === 1 ? 'stop' : 'stops'}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-teal-50 px-2 py-1 font-mono text-[9px] text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
                    {stops.length > 1 ? 'MULTI-STOP ROUTE' : 'DELIVERY ROUTE'}
                  </span>
                </div>
                <div className="h-[260px] w-full">
                  <DriverRouteMap stops={stops} depot={depotName} />
                </div>
                <p className="border-t border-slate-200 bg-white px-3 py-2 text-[10px] leading-relaxed text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                  Stop pins show district-level locations because precise outlet coordinates are not available.
                </p>
              </div>

              {offlineActions.length > 0 && (
                <div className="mx-4 mt-3 flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-3 shrink-0">
                  <span className="text-amber-500 text-lg shrink-0">{connection === 'syncing' ? '↻' : '⟳'}</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">{connection === 'offline' ? 'Offline — Working Locally' : 'Syncing…'}</p>
                    <p className="font-mono text-[10px] text-amber-600 dark:text-amber-400">{offlineActions.length} recorded action{offlineActions.length > 1 ? 's' : ''} waiting to sync · local storage active</p>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center font-mono text-sm font-bold text-amber-700 dark:text-amber-300 shrink-0">{offlineActions.length}</div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 pb-6">
                {stops.map(stop => (
                  <StopCard key={stop.id} stop={stop} isDark={isDark} onTap={() => setActiveStopId(stop.id)} />
                ))}
                <div className="text-center py-6">
                  <div className="inline-flex flex-col items-center gap-1.5">
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                      <span className="text-slate-400 text-lg">⚑</span>
                    </div>
                    <span className="font-mono text-xs text-slate-400">Return to depot after Stop {stops.length}</span>
                    <span className="font-mono text-[10px] text-slate-300 dark:text-slate-600">{depotName} · {VEHICLE_ID}</span>
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  )
}