export type Role = 'dispatcher' | 'loader' | 'driver' | 'store'
export type SignupRole = 'dispatcher' | 'loader' | 'driver' | 'store_manager'
export type StoreBrand = 'Waypoint-Tech' | 'Waypoint-Style' | 'Fresh'
export type DriverVehicleType = 'Ambient' | 'Refrigerated' | 'Van'
export type DriverBase = 'Kandy' | 'Peliyagoda'
export type StoreLocation = 'Colombo' | 'Gampaha' | 'Kalutara' | 'Galle' | 'Kandy' | 'Matale'

export const STORE_BRANDS: { value: StoreBrand; label: string }[] = [
	{ value: 'Waypoint-Tech', label: 'Waypoint-Tech' },
	{ value: 'Waypoint-Style', label: 'Waypoint-Style' },
	{ value: 'Fresh', label: 'Fresh' },
]

export const DRIVER_VEHICLE_TYPES: DriverVehicleType[] = ['Ambient', 'Refrigerated', 'Van']
export const DRIVER_BASES: DriverBase[] = ['Kandy', 'Peliyagoda']
export const STORE_LOCATIONS: StoreLocation[] = ['Colombo', 'Gampaha', 'Kalutara', 'Galle', 'Kandy', 'Matale']

export const ROLE_IDS: Role[] = ['dispatcher', 'loader', 'driver', 'store']

export const ROLE_TITLES: Record<Role, string> = {
	dispatcher: 'Dispatcher Portal',
	store: 'Store App',
	driver: 'Driver Mobile',
	loader: 'Loader Terminal',
}
