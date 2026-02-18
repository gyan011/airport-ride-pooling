const DistanceCalculator = require('../utils/distanceCalculator');

describe('DistanceCalculator', () => {
  describe('calculateDistance', () => {
    it('should calculate distance between two points correctly', () => {
      const point1 = { coordinates: [-122.4194, 37.7749] }; // SF
      const point2 = { coordinates: [-122.4089, 37.7858] }; // SF nearby

      const distance = DistanceCalculator.calculateDistance(point1, point2);

      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(2); // Should be less than 2km
    });

    it('should return 0 for same location', () => {
      const point1 = { coordinates: [-122.4194, 37.7749] };
      const point2 = { coordinates: [-122.4194, 37.7749] };

      const distance = DistanceCalculator.calculateDistance(point1, point2);

      expect(distance).toBe(0);
    });
  });

  describe('calculateDetour', () => {
    it('should calculate detour percentage correctly', () => {
      const originalRoute = [
        { location: { coordinates: [-122.4194, 37.7749] }, sequence: 0 },
        { location: { coordinates: [-122.4089, 37.7858] }, sequence: 1 }
      ];

      const newPickup = { coordinates: [-122.4150, 37.7800] };
      const newDropoff = { coordinates: [-122.4100, 37.7850] };

      const result = DistanceCalculator.calculateDetour(
        originalRoute,
        newPickup,
        newDropoff
      );

      expect(result).toHaveProperty('detourPercentage');
      expect(result).toHaveProperty('bestRoute');
      expect(result).toHaveProperty('newDistance');
      expect(result.detourPercentage).toBeGreaterThanOrEqual(0);
    });

    it('should return 0 detour for empty route', () => {
      const originalRoute = [];
      const newPickup = { coordinates: [-122.4194, 37.7749] };
      const newDropoff = { coordinates: [-122.4089, 37.7858] };

      const result = DistanceCalculator.calculateDetour(
        originalRoute,
        newPickup,
        newDropoff
      );

      expect(result.detourPercentage).toBe(0);
      expect(result.bestRoute).toHaveLength(2);
    });
  });

  describe('estimateDuration', () => {
    it('should estimate duration based on distance', () => {
      const distance = 20; // 20 km
      const duration = DistanceCalculator.estimateDuration(distance);

      expect(duration).toBeGreaterThan(0);
      expect(duration).toBe(30); // 20km / 40km/h = 0.5h = 30min
    });
  });

  describe('isWithinRadius', () => {
    it('should return true for points within radius', () => {
      const point1 = { coordinates: [-122.4194, 37.7749] };
      const point2 = { coordinates: [-122.4089, 37.7858] };
      const radius = 5; // 5 km

      const result = DistanceCalculator.isWithinRadius(point1, point2, radius);

      expect(result).toBe(true);
    });

    it('should return false for points outside radius', () => {
      const point1 = { coordinates: [-122.4194, 37.7749] }; // SF
      const point2 = { coordinates: [-118.2437, 34.0522] }; // LA
      const radius = 5; // 5 km

      const result = DistanceCalculator.isWithinRadius(point1, point2, radius);

      expect(result).toBe(false);
    });
  });

  describe('getCenterPoint', () => {
    it('should calculate center of multiple points', () => {
      const locations = [
        { coordinates: [-122.4194, 37.7749] },
        { coordinates: [-122.4089, 37.7858] },
        { coordinates: [-122.3972, 37.7897] }
      ];

      const center = DistanceCalculator.getCenterPoint(locations);

      expect(center).toHaveProperty('type', 'Point');
      expect(center).toHaveProperty('coordinates');
      expect(center.coordinates).toHaveLength(2);
    });

    it('should return null for empty array', () => {
      const center = DistanceCalculator.getCenterPoint([]);
      expect(center).toBeNull();
    });

    it('should return same point for single location', () => {
      const location = { coordinates: [-122.4194, 37.7749] };
      const center = DistanceCalculator.getCenterPoint([location]);

      expect(center).toEqual(location);
    });
  });
});

describe('PricingEngine', () => {
  const PricingEngine = require('../services/pricingEngine');

  describe('calculateBasePrice', () => {
    it('should calculate base price correctly', () => {
      const distance = 10; // 10 km
      const duration = 15; // 15 minutes

      const price = PricingEngine.calculateBasePrice(distance, duration);

      // Expected: (10 * 2.0) + (15 * 0.5) + 3.0 = 30.5
      expect(price).toBe(30.5);
    });

    it('should return minimum fare for short trips', () => {
      const distance = 0.5; // 0.5 km
      const duration = 2; // 2 minutes

      const price = PricingEngine.calculateBasePrice(distance, duration);

      // Should return minimum fare
      expect(price).toBeGreaterThanOrEqual(5.0);
    });
  });

  describe('calculateDemandMultiplier', () => {
    it('should return 1.0 for low demand', () => {
      const multiplier = PricingEngine.calculateDemandMultiplier(5, 20);
      expect(multiplier).toBe(1.0);
    });

    it('should return 1.2 for normal demand', () => {
      const multiplier = PricingEngine.calculateDemandMultiplier(10, 15);
      expect(multiplier).toBe(1.2);
    });

    it('should return 2.5 for surge pricing', () => {
      const multiplier = PricingEngine.calculateDemandMultiplier(100, 20);
      expect(multiplier).toBe(2.5);
    });
  });

  describe('calculatePoolingDiscount', () => {
    it('should increase discount with more passengers', () => {
      const discount2 = PricingEngine.calculatePoolingDiscount(2, 0);
      const discount3 = PricingEngine.calculatePoolingDiscount(3, 0);
      const discount4 = PricingEngine.calculatePoolingDiscount(4, 0);

      expect(discount3).toBeGreaterThan(discount2);
      expect(discount4).toBeGreaterThan(discount3);
    });

    it('should reduce discount for higher detour', () => {
      const lowDetour = PricingEngine.calculatePoolingDiscount(3, 0.1);
      const highDetour = PricingEngine.calculatePoolingDiscount(3, 0.4);

      expect(lowDetour).toBeGreaterThan(highDetour);
    });

    it('should not go below 10% minimum discount', () => {
      const discount = PricingEngine.calculatePoolingDiscount(2, 0.5);
      expect(discount).toBeGreaterThanOrEqual(0.10);
    });
  });
});