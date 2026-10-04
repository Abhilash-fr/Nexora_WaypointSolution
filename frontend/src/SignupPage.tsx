import { useState, type FormEvent } from 'react'
import AuthPageShell from './AuthPageShell'
import { api } from './api'
import {
  DRIVER_BASES,
  DRIVER_VEHICLE_TYPES,
  STORE_BRANDS,
  STORE_LOCATIONS,
  type DriverBase,
  type DriverVehicleType,
  type SignupRole,
  type StoreBrand,
  type StoreLocation,
} from './types'

const SIGNUP_ROLES: { value: SignupRole; label: string; description: string }[] = [
  { value: 'dispatcher', label: 'Dispatcher', description: 'Plan orders and fleet operations' },
  { value: 'store_manager', label: 'Store Manager', description: 'Manage outlet inventory and orders' },
  { value: 'driver', label: 'Driver', description: 'Complete stops and delivery sign-offs' },
  { value: 'loader', label: 'Loader', description: 'Prepare and verify vehicle loads' },
]

export default function SignupPage({ onRegistered }: { onRegistered: () => void }) {
  const [employeeId, setEmployeeId] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState<SignupRole>('dispatcher')
  const [storeBrand, setStoreBrand] = useState<StoreBrand>('Fresh')
  const [driverVehicleType, setDriverVehicleType] = useState<DriverVehicleType | ''>('')
  const [driverBase, setDriverBase] = useState<DriverBase | ''>('')
  const [storeLocation, setStoreLocation] = useState<StoreLocation | ''>('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError('The passwords do not match.')
      return
    }
    if (role === 'driver' && (!driverVehicleType || !driverBase)) {
      setError('Choose a vehicle type and starting location.')
      return
    }
    if (role === 'store_manager' && !storeLocation) {
      setError('Choose a store location.')
      return
    }

    setSubmitting(true)
    try {
      const profile = role === 'store_manager'
        ? { brand: storeBrand, location: storeLocation || undefined }
        : role === 'driver'
          ? { vehicle_type: driverVehicleType || undefined, location: driverBase || undefined }
          : {}
      await api.register({
        employee_id: employeeId.trim(),
        username: username.trim(),
        password,
        role,
        ...profile,
      })
      onRegistered()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not create your account.')
    } finally {
      setSubmitting(false)
    }
  }

  const passwordStrength = password.length >= 12 ? 'Strong' : password.length >= 8 ? 'Good' : 'Use at least 8 characters'
  const strengthColor = password.length >= 12 ? 'bg-emerald-400' : password.length >= 8 ? 'bg-teal-400' : 'bg-slate-700'

  return (
    <AuthPageShell>
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-2xl shadow-black/20 sm:p-8">
        <div className="mb-7">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-teal-400">Create a workspace account</p>
          <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Join Waypoint</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">Employee ID verification is required to create an account.</p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="signup-employee-id" className="mb-2 block text-sm font-medium text-slate-200">Employee ID</label>
            <input
              id="signup-employee-id"
              name="employee_id"
              type="text"
              autoComplete="off"
              required
              maxLength={64}
              value={employeeId}
              onChange={event => setEmployeeId(event.target.value.toUpperCase())}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-base uppercase text-white outline-none transition placeholder:normal-case placeholder:text-slate-600 focus:border-teal-400 focus:ring-4 focus:ring-teal-400/10"
              placeholder="Enter your issued employee ID"
            />
            <p className="mt-1.5 text-xs text-slate-500">Your ID must be active and match your selected role.</p>
          </div>

          <div>
            <label htmlFor="signup-username" className="mb-2 block text-sm font-medium text-slate-200">Username</label>
            <input
              id="signup-username"
              name="username"
              type="text"
              autoComplete="username"
              required
              minLength={3}
              maxLength={64}
              value={username}
              onChange={event => setUsername(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-teal-400 focus:ring-4 focus:ring-teal-400/10"
              placeholder="e.g. alex.perera"
            />
            <p className="mt-1.5 text-xs text-slate-500">Use 3–64 characters. You’ll use this to sign in.</p>
          </div>

          <div>
            <label htmlFor="signup-password" className="mb-2 block text-sm font-medium text-slate-200">Password</label>
            <div className="relative">
              <input
                id="signup-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
                value={password}
                onChange={event => setPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 pr-20 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-teal-400 focus:ring-4 focus:ring-teal-400/10"
                placeholder="Create a password"
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
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                <div className={`h-full transition-all ${strengthColor}`} style={{ width: `${Math.min(100, password.length * 8)}%` }} />
              </div>
              <span className="min-w-28 text-right text-xs text-slate-500">{password ? passwordStrength : '8 characters minimum'}</span>
            </div>
          </div>

          <div>
            <label htmlFor="signup-confirm-password" className="mb-2 block text-sm font-medium text-slate-200">Confirm password</label>
            <input
              id="signup-confirm-password"
              name="confirm-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
              value={confirmPassword}
              onChange={event => setConfirmPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-teal-400 focus:ring-4 focus:ring-teal-400/10"
              placeholder="Enter your password again"
            />
          </div>

          <div>
            <label htmlFor="signup-role" className="mb-2 block text-sm font-medium text-slate-200">Your role</label>
            <select
              id="signup-role"
              name="role"
              value={role}
              onChange={event => setRole(event.target.value as SignupRole)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-base text-white outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-400/10"
            >
              {SIGNUP_ROLES.map(option => <option key={option.value} value={option.value}>{option.label} — {option.description}</option>)}
            </select>
            <p className="mt-1.5 text-xs text-slate-500">{SIGNUP_ROLES.find(option => option.value === role)?.description}</p>
          </div>

          {role === 'store_manager' && (
            <>
              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-medium text-slate-200">Store brand</legend>
                {STORE_BRANDS.map((brand, index) => (
                  <label
                    key={brand.value}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                      storeBrand === brand.value
                        ? 'border-teal-400 bg-teal-400/10 text-white'
                        : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <input
                      type="radio"
                      name="store-brand"
                      value={brand.value}
                      checked={storeBrand === brand.value}
                      onChange={() => setStoreBrand(brand.value)}
                      required={index === 0}
                      className="h-4 w-4 accent-teal-400"
                    />
                    <span>{brand.label}</span>
                  </label>
                ))}
              </fieldset>
              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-medium text-slate-200">Store location</legend>
                {STORE_LOCATIONS.map((location, index) => (
                  <label
                    key={location}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                      storeLocation === location
                        ? 'border-teal-400 bg-teal-400/10 text-white'
                        : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <input
                      type="radio"
                      name="store-location"
                      value={location}
                      checked={storeLocation === location}
                      onChange={() => setStoreLocation(location)}
                      required={index === 0}
                      className="h-4 w-4 accent-teal-400"
                    />
                    <span>{location}</span>
                  </label>
                ))}
                <label className="flex cursor-not-allowed items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-slate-600 opacity-50">
                  <input type="radio" disabled className="h-4 w-4 accent-teal-400" />
                  <span>Coming soon</span>
                </label>
              </fieldset>
            </>
          )}

          {role === 'driver' && (
            <>
              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-medium text-slate-200">Vehicle type</legend>
                {DRIVER_VEHICLE_TYPES.map((vehicleType, index) => (
                  <label
                    key={vehicleType}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                      driverVehicleType === vehicleType
                        ? 'border-teal-400 bg-teal-400/10 text-white'
                        : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <input
                      type="radio"
                      name="driver-vehicle-type"
                      value={vehicleType}
                      checked={driverVehicleType === vehicleType}
                      onChange={() => setDriverVehicleType(vehicleType)}
                      required={index === 0}
                      className="h-4 w-4 accent-teal-400"
                    />
                    <span>{vehicleType}</span>
                  </label>
                ))}
              </fieldset>
              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-medium text-slate-200">Starting location</legend>
                {DRIVER_BASES.map((base, index) => (
                  <label
                    key={base}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                      driverBase === base
                        ? 'border-teal-400 bg-teal-400/10 text-white'
                        : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <input
                      type="radio"
                      name="driver-starting-location"
                      value={base}
                      checked={driverBase === base}
                      onChange={() => setDriverBase(base)}
                      required={index === 0}
                      className="h-4 w-4 accent-teal-400"
                    />
                    <span>{base}</span>
                  </label>
                ))}
              </fieldset>
            </>
          )}

          {error && <p role="alert" className="rounded-xl border border-red-900 bg-red-950/50 px-4 py-3 text-sm leading-5 text-red-300">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="min-h-12 w-full rounded-xl bg-teal-400 px-4 py-3 text-base font-semibold text-slate-950 transition hover:bg-teal-300 focus:outline-none focus:ring-4 focus:ring-teal-300/20 disabled:cursor-wait disabled:opacity-60"
          >
            {submitting ? 'Creating your account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 border-t border-slate-800 pt-5 text-center text-sm text-slate-400">
          Already registered?{' '}
          <a href="#/login" className="font-semibold text-teal-300 hover:text-teal-200 focus:outline-none focus:underline">Sign in</a>
        </p>
      </div>
    </AuthPageShell>
  )
}
