// Geocoding and Distance Utilities

export class GeocodingService {
  constructor() {
    // Using OpenStreetMap Nominatim - free, no API key required
    this.nominatimBaseUrl = 'https://nominatim.openstreetmap.org';
    this.debounceTimer = null;
  }

  /**
   * Search for address suggestions (autocomplete) prioritized by proximity
   * @param {string} query - The search query
   * @param {Object} userLocation - User's current location {lat, lng}
   * @param {number} limit - Maximum number of results (default 10)
   * @returns {Promise<Array>} - Array of location suggestions sorted by distance
   */
  async searchAddresses(query, userLocation = null, limit = 10) {
    if (!query || query.trim().length < 3) {
      return [];
    }

    try {
      // Fetch more results initially for better filtering (max 50)
      let searchUrl = `${this.nominatimBaseUrl}/search?` +
        `q=${encodeURIComponent(query)}&` +
        `format=json&` +
        `limit=50&` +
        `addressdetails=1`;
      
      // Add proximity-based sorting if user location is available
      if (userLocation && userLocation.lat && userLocation.lng) {
        // Add viewbox (area within ~100km radius for initial search)
        const viewboxSize = 1.0; // approximately 100km
        searchUrl += `&viewbox=${userLocation.lng - viewboxSize},${userLocation.lat + viewboxSize},${userLocation.lng + viewboxSize},${userLocation.lat - viewboxSize}&bounded=1`;
      }

      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'RapidRide-App/1.0'
        }
      });

      if (!response.ok) {
        throw new Error('Search request failed');
      }

      const data = await response.json();

      let results = data.map(result => ({
        displayName: result.display_name,
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        address: result.address,
        type: result.type,
        category: result.category,
        placeId: result.place_id,
        importance: result.importance || 0,
        // Extract place name (first part before comma)
        placeName: result.display_name.split(',')[0].trim()
      }));

      // If user location is provided, calculate distance and create relevance score
      if (userLocation && userLocation.lat && userLocation.lng) {
        results = results.map(result => {
          const distance = this.calculateDistance(
            userLocation.lat, userLocation.lng,
            result.lat, result.lng
          );

          // Calculate relevance score (lower is better)
          // Priority: metro stations, landmarks, then distance
          let relevanceScore = distance; // Base on distance
          
          // Boost important place types (make them appear first)
          const importantTypes = [
            'station', 'railway', 'subway', 'metro',
            'bus_station', 'bus_stop', 'airport',
            'mall', 'shopping_centre', 'hospital',
            'university', 'school', 'stadium',
            'park', 'monument', 'museum', 'cinema'
          ];
          
          const importantCategories = [
            'railway', 'aeroway', 'amenity', 'tourism',
            'leisure', 'building'
          ];

          // Check if it's an important place type
          const isImportantType = importantTypes.some(t => 
            result.type?.toLowerCase().includes(t) ||
            result.placeName?.toLowerCase().includes(t)
          );
          
          const isImportantCategory = importantCategories.includes(result.category);
          
          if (isImportantType || isImportantCategory) {
            relevanceScore = distance * 0.3; // High boost for important places
          } else if (result.importance > 0.5) {
            relevanceScore = distance * 0.6; // Medium boost for important results
          }

          return {
            ...result,
            distance,
            relevanceScore
          };
        });

        // Filter out results that are too far (> 50km unless very important)
        results = results.filter(result => 
          result.distance <= 50 || result.relevanceScore < 5
        );

        // Sort by relevance score (nearest important places first)
        results.sort((a, b) => a.relevanceScore - b.relevanceScore);
        
        // Take only the requested limit
        results = results.slice(0, limit);
      } else {
        // No user location - sort by importance
        results.sort((a, b) => b.importance - a.importance);
        results = results.slice(0, limit);
      }

      return results;
    } catch (error) {
      console.error('Address search error:', error);
      return [];
    }
  }

  /**
   * Debounced search for better performance
   * @param {string} query - Search query
   * @param {Function} callback - Callback with results
   * @param {Object} userLocation - User's current location {lat, lng}
   * @param {number} delay - Debounce delay in ms (default 300)
   */
  debouncedSearch(query, callback, userLocation = null, delay = 300) {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(async () => {
      const results = await this.searchAddresses(query, userLocation);
      callback(results);
    }, delay);
  }

  /**
   * Geocode an address to lat/lng coordinates
   * @param {string} address - The address to geocode
   * @returns {Promise<{lat: number, lng: number, displayName: string}>}
   */
  async geocodeAddress(address) {
    if (!address || address.trim() === '') {
      throw new Error('Address is required');
    }

    try {
      const response = await fetch(
        `${this.nominatimBaseUrl}/search?` +
        `q=${encodeURIComponent(address)}&` +
        `format=json&` +
        `limit=1&` +
        `addressdetails=1`,
        {
          headers: {
            'User-Agent': 'RapidRide-App/1.0'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Geocoding request failed');
      }

      const data = await response.json();

      if (!data || data.length === 0) {
        throw new Error('Location not found. Please enter a more specific address.');
      }

      const result = data[0];
      return {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        displayName: result.display_name,
        address: result.address
      };
    } catch (error) {
      console.error('Geocoding error:', error);
      throw new Error(`Failed to find location: ${error.message}`);
    }
  }

  /**
   * Reverse geocode coordinates to an address
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @returns {Promise<string>} - Address string
   */
  async reverseGeocode(lat, lng) {
    try {
      const response = await fetch(
        `${this.nominatimBaseUrl}/reverse?` +
        `lat=${lat}&` +
        `lon=${lng}&` +
        `format=json&` +
        `addressdetails=1`,
        {
          headers: {
            'User-Agent': 'RapidRide-App/1.0'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Reverse geocoding request failed');
      }

      const data = await response.json();

      if (!data || !data.display_name) {
        throw new Error('Address not found for these coordinates');
      }

      return data.display_name;
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  }

  /**
   * Calculate distance between two points using Haversine formula
   * @param {number} lat1 - Latitude of point 1
   * @param {number} lng1 - Longitude of point 1
   * @param {number} lat2 - Latitude of point 2
   * @param {number} lng2 - Longitude of point 2
   * @returns {number} - Distance in kilometers
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
      Math.cos(this.toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance; // in kilometers
  }

  /**
   * Convert degrees to radians
   * @param {number} degrees
   * @returns {number}
   */
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Calculate fare based on distance and ride type
   * @param {number} distance - Distance in kilometers
   * @param {string} rideType - Type of ride (economy, comfort, premium, shared)
   * @returns {Object} - Fare details
   */
  calculateFare(distance, rideType = 'economy') {
    // Base fare + per km rate
    const fareRates = {
      economy: {
        baseFare: 50,
        perKm: 12,
        minFare: 80
      },
      comfort: {
        baseFare: 80,
        perKm: 18,
        minFare: 120
      },
      premium: {
        baseFare: 120,
        perKm: 25,
        minFare: 180
      },
      shared: {
        baseFare: 30,
        perKm: 8,
        minFare: 60
      }
    };

    const rates = fareRates[rideType] || fareRates.economy;
    const calculatedFare = rates.baseFare + (distance * rates.perKm);
    const finalFare = Math.max(calculatedFare, rates.minFare);

    // Add some variability (±10%) for realistic estimates
    const minFare = Math.round(finalFare * 0.9);
    const maxFare = Math.round(finalFare * 1.1);

    return {
      distance: distance.toFixed(2),
      minFare,
      maxFare,
      estimatedFare: Math.round(finalFare),
      rideType
    };
  }

  /**
   * Get real road-based route using OSRM (Open Source Routing Machine)
   * @param {number} startLat - Starting latitude
   * @param {number} startLng - Starting longitude
   * @param {number} endLat - Ending latitude
   * @param {number} endLng - Ending longitude
   * @returns {Promise<Object>} - Route details with distance, duration, and waypoints
   */
  async getRoadRoute(startLat, startLng, endLat, endLng) {
    try {
      // Using OSRM demo server (free, no API key needed)
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;

      const response = await fetch(osrmUrl);
      
      if (!response.ok) {
        throw new Error('Routing request failed');
      }

      const data = await response.json();

      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        throw new Error('No route found');
      }

      const route = data.routes[0];
      
      return {
        distance: (route.distance / 1000).toFixed(2), // Convert meters to km
        duration: Math.round(route.duration / 60), // Convert seconds to minutes
        geometry: route.geometry, // GeoJSON geometry for drawing on map
        coordinates: route.geometry.coordinates, // Array of [lng, lat] points
        legs: route.legs
      };
    } catch (error) {
      console.error('Road routing error:', error);
      // Fallback to straight-line distance
      const straightLineDistance = this.calculateDistance(startLat, startLng, endLat, endLng);
      return {
        distance: straightLineDistance.toFixed(2),
        duration: Math.round((straightLineDistance / 40) * 60), // Estimate: 40 km/h average
        geometry: null,
        coordinates: [[startLng, startLat], [endLng, endLat]],
        isFallback: true
      };
    }
  }

  /**
   * Format fare for display
   * @param {Object} fareDetails - Fare details object
   * @returns {string}
   */
  formatFare(fareDetails) {
    return `₹${fareDetails.minFare} - ₹${fareDetails.maxFare}`;
  }

  /**
   * Get user's current location
   * @returns {Promise<{lat: number, lng: number}>}
   */
  async getCurrentLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          reject(new Error(`Location error: ${error.message}`));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  }
}
