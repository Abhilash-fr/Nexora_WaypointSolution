import os

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.config import load_environment

router = APIRouter()
load_environment()

ROUTES_API_URL = "https://routes.googleapis.com/directions/v2:computeRoutes"


class LatLng(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class RouteRequest(BaseModel):
    waypoints: list[LatLng]


@router.post("/route-polyline")
async def get_route_polyline(request: RouteRequest):
    api_key = os.getenv("GOOGLE_MAPS_API_KEY", "")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="GOOGLE_MAPS_API_KEY is not configured for the backend.",
        )
    if len(request.waypoints) < 2:
        raise HTTPException(status_code=400, detail="At least 2 waypoints are required.")

    origin = request.waypoints[0]
    destination = request.waypoints[-1]
    body = {
        "origin": {
            "location": {
                "latLng": {
                    "latitude": origin.latitude,
                    "longitude": origin.longitude,
                }
            }
        },
        "destination": {
            "location": {
                "latLng": {
                    "latitude": destination.latitude,
                    "longitude": destination.longitude,
                }
            }
        },
        "travelMode": "DRIVE",
        "routingPreference": "TRAFFIC_AWARE",
        "intermediates": [
            {
                "location": {
                    "latLng": {
                        "latitude": point.latitude,
                        "longitude": point.longitude,
                    }
                }
            }
            for point in request.waypoints[1:-1]
        ],
    }
    headers = {
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": "routes.polyline.encodedPolyline,routes.distanceMeters,routes.duration",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(ROUTES_API_URL, json=body, headers=headers)
    except httpx.HTTPError as error:
        raise HTTPException(
            status_code=502,
            detail=f"Could not reach Google Routes API: {error}",
        ) from error

    if response.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Google Routes API returned HTTP {response.status_code}: {response.text}",
        )

    routes = response.json().get("routes", [])
    if not routes:
        raise HTTPException(status_code=404, detail="Google Routes API found no route.")

    route = routes[0]
    return {
        "encodedPolyline": route.get("polyline", {}).get("encodedPolyline", ""),
        "distanceMeters": route.get("distanceMeters", 0),
        "duration": route.get("duration", ""),
    }
