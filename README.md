# Nexora Distribution App

## Run with Docker Compose

1. Copy `.env.example` to `backend/.env`.
2. Add a Google Maps Routes API key to `GOOGLE_MAPS_API_KEY` in `backend/.env`.
3. Run `docker compose up --build` from the repository root.
4. Open `http://localhost:5173`.

The backend stores outlet coordinates in the database. In the Store app, open
**Settings → Delivery Map Locations**, select an outlet, enter its real latitude
and longitude, and save. Assigned delivery stops with saved coordinates appear
on the driver's map; the backend requests their road route from Google Routes API.

Keep `backend/.env` private. Do not commit API keys or other credentials.