/**
 * Location utilities for geolocation and reverse geocoding
 */

export interface LocationCoords {
  latitude: number;
  longitude: number;
}

export interface LocationResult {
  name: string;
  latitude: number;
  longitude: number;
  display_name?: string;
}

/**
 * Request geolocation permission and get current position
 */
export async function getCurrentLocation(): Promise<LocationCoords | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.error('Geolocation not supported');
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        console.error('Geolocation error:', error);
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
}

/**
 * Reverse geocode coordinates to get location name using Nominatim
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<LocationResult | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
      {
        headers: {
          'User-Agent': 'Sharable-App',
        },
      }
    );
    const data = await res.json();
    
    if (data.address) {
      const { city, town, village, county, state, country } = data.address;
      const locationName = city || town || village || county || state || country || 'Unknown Location';
      
      return {
        name: locationName,
        latitude,
        longitude,
        display_name: data.display_name,
      };
    }
    
    return null;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}

/**
 * Search for locations using Nominatim
 */
export async function searchLocations(query: string, limit: number = 10): Promise<LocationResult[]> {
  if (!query.trim()) return [];

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=${limit}`,
      {
        headers: {
          'User-Agent': 'Sharable-App',
        },
      }
    );
    const data = await res.json();
    
    return data.map((result: any) => ({
      name: result.name || result.display_name,
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      display_name: result.display_name,
    }));
  } catch (error) {
    console.error('Location search error:', error);
    return [];
  }
}

/**
 * Format coordinates for display
 */
export function formatCoordinates(latitude: number, longitude: number): string {
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
}

/**
 * Calculate distance between two coordinates in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
