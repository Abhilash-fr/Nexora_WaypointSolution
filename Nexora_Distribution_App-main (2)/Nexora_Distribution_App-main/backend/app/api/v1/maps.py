import os
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from app.core.config import load_environment

router = APIRouter()
load_environment()

ROUTES_API_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes'


class LatLng(BaseModel):
    latitude: float
    longitude: float


class RouteRequest(BaseModel):
    waypoints: List[LatLng]  # first = origin, last = destination, middle = intermediates


@router.post('/route-polyline')
async def get_route_polyline(req: RouteRequest):
    api_key = os.getenv('GOOGLE_MAPS_API_KEY', '')
    if not api_key:
        raise HTTPException(status_code=500, detail='GOOGLE_MAPS_API_KEY not configured on server')

    if len(req.waypoints) < 2:
        raise HTTPException(status_code=400, detail='At least 2 waypoints required')

    origin = req.waypoints[0]
    destination = req.waypoints[-1]
    intermediates = req.waypoints[1:-1]

    body = {
        'origin': {'location': {'latLng': {'latitude': origin.latitude, 'longitude': origin.longitude}}},
        'destination': {'location': {'latLng': {'latitude': destination.latitude, 'longitude': destination.longitude}}},
        'travelMode': 'DRIVE',
        'routingPreference': 'TRAFFIC_AWARE',
        'languageCode': 'en-US',
        'units': 'METRIC',
        'internalUsageAttributionIds': ['gmp_git_agentskills_v1'],
    }

    if intermediates:
        body['intermediates'] = [
            {'location': {'latLng': {'latitude': wp.latitude, 'longitude': wp.longitude}}}
            for wp in intermediates
        ]

    headers = {
        'X-Goog-Api-Key': api_key,
        'X-Goog-FieldMask': 'routes.polyline.encodedPolyline,routes.distanceMeters,routes.duration',
        'Content-Type': 'application/json',
        'X-Goog-Maps-Solution-ID': 'gmp_git_agentskills_v1',
    }

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(ROUTES_API_URL, json=body, headers=headers)

    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail=f'Routes API error: {resp.text}')

    data = resp.json()
    routes = data.get('routes', [])
    if not routes:
        raise HTTPException(status_code=404, detail='No route found')

    route = routes[0]
    return {
        'encodedPolyline': route.get('polyline', {}).get('encodedPolyline', ''),
        'distanceMeters': route.get('distanceMeters', 0),
        'duration': route.get('duration', ''),
    }
