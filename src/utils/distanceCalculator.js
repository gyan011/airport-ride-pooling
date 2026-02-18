const geolib = require('geolib');

class DistanceCalculator {
  /**
   * Calculate distance between two points using Haversine formula
   * @param {Object} point1 - {coordinates: [lng, lat]}
   * @param {Object} point2 - {coordinates: [lng, lat]}
   * @returns {number} Distance in kilometers
   */
  static calculateDistance(point1, point2) {
    const [lng1, lat1] = point1.coordinates;
    const [lng2, lat2] = point2.coordinates;

    const distanceInMeters = geolib.getDistance(
      { latitude: lat1, longitude: lng1 },
      { latitude: lat2, longitude: lng2 }
    );

    return distanceInMeters / 1000; // Convert to km
  }

  /**
   * Calculate total route distance
   * @param {Array} stops - Array of stop locations
   * @returns {number} Total distance in kilometers
   */
  static calculateRouteDistance(stops) {
    let totalDistance = 0;

    for (let i = 0; i < stops.length - 1; i++) {
      totalDistance += this.calculateDistance(
        stops[i].location,
        stops[i + 1].location
      );
    }

    return totalDistance;
  }

  /**
   * Estimate duration based on distance (simple model)
   * @param {number} distanceKm - Distance in kilometers
   * @returns {number} Duration in minutes
   */
  static estimateDuration(distanceKm) {
    const avgSpeedKmh = 40; // Average city speed
    const durationHours = distanceKm / avgSpeedKmh;
    return Math.ceil(durationHours * 60); // Convert to minutes
  }

  /**
   * Calculate detour percentage for a new point insertion
   * @param {Array} originalRoute - Original stops
   * @param {Object} newPickup - New pickup location
   * @param {Object} newDropoff - New dropoff location
   * @returns {Object} { detourPercentage, bestRoute }
   */
  static calculateDetour(originalRoute, newPickup, newDropoff) {
    if (originalRoute.length === 0) {
      return {
        detourPercentage: 0,
        bestRoute: [
          { type: 'pickup', location: newPickup, sequence: 0 },
          { type: 'dropoff', location: newDropoff, sequence: 1 }
        ],
        newDistance: this.calculateDistance(newPickup, newDropoff)
      };
    }

    const originalDistance = this.calculateRouteDistance(originalRoute);
    let minDetour = Infinity;
    let bestRoute = null;
    let bestDistance = 0;

    // Try all possible insertion positions
    for (let pickupPos = 0; pickupPos <= originalRoute.length; pickupPos++) {
      for (let dropoffPos = pickupPos; dropoffPos <= originalRoute.length; dropoffPos++) {
        const newRoute = [...originalRoute];
        
        // Insert dropoff first (at higher index) to maintain correct indices
        newRoute.splice(dropoffPos, 0, {
          type: 'dropoff',
          location: newDropoff,
          sequence: dropoffPos
        });
        
        newRoute.splice(pickupPos, 0, {
          type: 'pickup',
          location: newPickup,
          sequence: pickupPos
        });

        // Update sequences
        newRoute.forEach((stop, idx) => {
          stop.sequence = idx;
        });

        const newDistance = this.calculateRouteDistance(newRoute);
        const detour = (newDistance - originalDistance) / originalDistance;

        if (detour < minDetour) {
          minDetour = detour;
          bestRoute = newRoute;
          bestDistance = newDistance;
        }
      }
    }

    return {
      detourPercentage: minDetour,
      bestRoute: bestRoute,
      newDistance: bestDistance
    };
  }

  /**
   * Check if a point is within radius of another point
   * @param {Object} point1 - {coordinates: [lng, lat]}
   * @param {Object} point2 - {coordinates: [lng, lat]}
   * @param {number} radiusKm - Radius in kilometers
   * @returns {boolean}
   */
  static isWithinRadius(point1, point2, radiusKm) {
    const distance = this.calculateDistance(point1, point2);
    return distance <= radiusKm;
  }

  /**
   * Get center point of multiple locations
   * @param {Array} locations - Array of {coordinates: [lng, lat]}
   * @returns {Object} Center point {coordinates: [lng, lat]}
   */
  static getCenterPoint(locations) {
    if (locations.length === 0) return null;
    if (locations.length === 1) return locations[0];

    const points = locations.map(loc => ({
      latitude: loc.coordinates[1],
      longitude: loc.coordinates[0]
    }));

    const center = geolib.getCenter(points);

    return {
      type: 'Point',
      coordinates: [center.longitude, center.latitude]
    };
  }
}

module.exports = DistanceCalculator;