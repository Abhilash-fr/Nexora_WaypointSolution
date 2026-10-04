# Waypoint Logistics

React + TypeScript + Tailwind v4 (Vite). One file per interface:

| URL hash        | File                       | Target device        |
|-----------------|----------------------------|----------------------|
| `#/`            | `src/SignupPage.tsx`       | Responsive account setup |
| `#/login`       | `src/LoginPage.tsx`        | Responsive sign-in |
| `#/dispatcher`  | `src/DispatcherApp.tsx`    | Desktop → mobile drawer |
| `#/loader`      | `src/LoaderApp.tsx`        | Tablet / mobile      |
| `#/driver`      | `src/DriverApp.tsx`        | Mobile (phone frame on larger screens) |
| `#/store`       | `src/StoreApp.tsx`         | Desktop sidebar / mobile tab bar |
| `#/offline-demo`| `src/OfflineDemo.tsx`      | All                  |

`src/App.tsx` stores the light/dark choice and routes signed-in users to the workspace for their account role. Signup is the first screen; existing users can sign in at `#/login`. Authenticated role screens provide a device-sized sign-out control.

New signups must provide an unused, active employee ID that matches the selected role. Load the allowlist from `backend/seed/CSVs/employee_ids.csv` with columns `employee_id,role`; supported roles are `dispatcher`, `store_manager` (or `store`), `driver`, and `loader`. Run the backend seed command after updating the file. If the allowlist CSV is missing or empty, signup is denied; there are no default or demo employee IDs.

## Run
Start the backend before signing up or signing in. In a separate PowerShell terminal:

```powershell
cd backend
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m seed.seed_data
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Then start the frontend from the project root in another terminal:

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

The Vite development proxy forwards `/api` requests to `http://127.0.0.1:8000`.
For a different backend address, set `VITE_API_PROXY_TARGET` before starting Vite.

From `frontend/`, run `npm run build` for a production build or `npx tsc --noEmit`
for a TypeScript check.
