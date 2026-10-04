import type { DriverBase, DriverVehicleType, Role, SignupRole, StoreBrand, StoreLocation } from './types'

const SESSION_KEY = 'waypoint-auth-session'

export interface AuthSession {
  accessToken: string
  username: string
  role: SignupRole
  brand?: StoreBrand | null
  vehicleType?: DriverVehicleType | null
  location?: DriverBase | StoreLocation | null
  expiresAt: number
}

export function roleForSession(role: SignupRole): Role {
  return role === 'store_manager' ? 'store' : role
}

export function readAuthSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session: unknown = JSON.parse(raw)
    if (
      !session ||
      typeof session !== 'object' ||
      !('accessToken' in session) ||
      typeof session.accessToken !== 'string' ||
      !('username' in session) ||
      typeof session.username !== 'string' ||
      !('role' in session) ||
      !['dispatcher', 'loader', 'driver', 'store_manager'].includes(String(session.role)) ||
      !('expiresAt' in session) ||
      typeof session.expiresAt !== 'number' ||
      session.expiresAt <= Date.now()
    ) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return session as AuthSession
  } catch {
    return null
  }
}

export function saveAuthSession(session: AuthSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    throw new Error('Could not save your sign-in. Please allow browser storage and try again.')
  }
}

export function clearAuthSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    throw new Error('Could not clear your saved sign-in. Please allow browser storage and try again.')
  }
}

export function getAccessToken(): string | null {
  return readAuthSession()?.accessToken ?? null
}
