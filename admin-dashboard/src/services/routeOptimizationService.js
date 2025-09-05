const axios = require('axios');
const Order = require('../models/Order');
const Driver = require('../models/Driver');
const Hub = require('../models/Hub');

class RouteOptimizationService {
  constructor() {
    this.googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   * @param {Array} coord1 - [longitude, latitude]
   * @param {Array} coord2 - [longitude, latitude]
   * @returns {number} Distance in kilometers
   */
  calculateDistance(coord1, coord2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRads(coord2[1] - coord1[1]);
    const dLon = this.toRads(coord2[0] - coord1[0]);
    const lat1 = this.toRads(coord1[1]);
    const lat2 = this.toRads(coord2[1]);

    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  /**
   * Convert degrees to radians
   * @param {number} degrees
   * @returns {number} Radians
   */
  toRads(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Find the best driver for an order based on distance and capacity
   * @param {string} orderId - Order ID
   * @returns {Object} Best driver assignment
   */
  async findBestDriver(orderId) {
    try {
      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      const deliveryCoordinates = order.customerInfo.address.coordinates;
      const pickupCoordinates = order.pickupAddress.coordinates;

      // Find available drivers within reasonable distance
      const availableDrivers = await Driver.findAvailableDrivers(
        pickupCoordinates,
        20000 // 20km radius
      );

      if (availableDrivers.length === 0) {
        return {
          success: false,
          message: 'No available drivers found in the area'
        };
      }

      // Score each driver based on multiple factors
      const driverScores = await Promise.all(
        availableDrivers.map(async (driver) => {
          const score = await this.calculateDriverScore(driver, order);
          return {
            driver,
            score,
            distance: this.calculateDistance(driver.currentLocation, pickupCoordinates)
          };
        })
      );

      // Sort by score (higher is better)
      driverScores.sort((a, b) => b.score - a.score);

      const bestDriver = driverScores[0];

      return {
        success: true,
        driver: bestDriver.driver,
        score: bestDriver.score,
        distance: bestDriver.distance,
        estimatedPickupTime: this.estimatePickupTime(bestDriver.distance),
        alternatives: driverScores.slice(1, 3) // Top 2 alternatives
      };

    } catch (error) {
      console.error('Error finding best driver:', error);
      throw error;
    }
  }

  /**
   * Calculate driver score based on multiple factors
   * @param {Object} driver - Driver document
   * @param {Object} order - Order document
   * @returns {number} Driver score (0-100)
   */
  async calculateDriverScore(driver, order) {
    let score = 0;

    // Distance factor (closer is better) - 40% weight
    const distance = this.calculateDistance(
      driver.currentLocation,
      order.pickupAddress.coordinates
    );
    const distanceScore = Math.max(0, 100 - (distance * 5)); // Penalty: 5 points per km
    score += distanceScore * 0.4;

    // Driver rating - 25% weight
    const ratingScore = (driver.performance.rating.average / 5) * 100;
    score += ratingScore * 0.25;

    // Current capacity - 20% weight
    const capacityScore = ((driver.preferences.maxDeliveries - driver.activeDeliveries.length) / driver.preferences.maxDeliveries) * 100;
    score += capacityScore * 0.2;

    // Vehicle compatibility - 10% weight
    const vehicleScore = this.getVehicleCompatibilityScore(driver.vehicle, order);
    score += vehicleScore * 0.1;

    // Success rate - 5% weight
    const successRate = driver.successRate || 100;
    score += successRate * 0.05;

    return Math.round(score);
  }

  /**
   * Get vehicle compatibility score
   * @param {Object} vehicle - Vehicle details
   * @param {Object} order - Order details
   * @returns {number} Compatibility score (0-100)
   */
  getVehicleCompatibilityScore(vehicle, order) {
    const totalWeight = order.totalWeight;
    const hasFragileItems = order.items.some(item => item.isFragile);

    let score = 100;

    // Check weight capacity
    if (totalWeight > vehicle.capacity.weight) {
      return 0; // Cannot handle the weight
    }

    // Penalty for overloading
    const weightUtilization = totalWeight / vehicle.capacity.weight;
    if (weightUtilization > 0.8) {
      score -= 20; // 20% penalty for high weight utilization
    }

    // Bonus for fragile items with appropriate vehicle
    if (hasFragileItems && (vehicle.type === 'car' || vehicle.type === 'van')) {
      score += 10;
    }

    // Penalty for fragile items with inappropriate vehicle
    if (hasFragileItems && vehicle.type === 'motorcycle') {
      score -= 30;
    }

    return Math.max(0, score);
  }

  /**
   * Estimate pickup time based on distance
   * @param {number} distance - Distance in kilometers
   * @returns {number} Estimated time in minutes
   */
  estimatePickupTime(distance) {
    const averageSpeed = 30; // km/h in city traffic
    const baseTime = 10; // Base preparation time in minutes
    
    return Math.round((distance / averageSpeed) * 60 + baseTime);
  }

  /**
   * Optimize route for multiple deliveries
   * @param {Array} deliveries - Array of delivery coordinates
   * @param {Array} startPoint - Starting coordinates [longitude, latitude]
   * @returns {Object} Optimized route
   */
  async optimizeRoute(deliveries, startPoint) {
    try {
      if (deliveries.length <= 1) {
        return {
          success: true,
          route: deliveries,
          totalDistance: deliveries.length > 0 ? 
            this.calculateDistance(startPoint, deliveries[0]) : 0,
          estimatedTime: deliveries.length > 0 ? 
            this.estimatePickupTime(this.calculateDistance(startPoint, deliveries[0])) : 0
        };
      }

      // For small number of deliveries, use simple nearest neighbor algorithm
      if (deliveries.length <= 10) {
        return this.nearestNeighborOptimization(deliveries, startPoint);
      }

      // For larger routes, could integrate with Google Maps Directions API
      // For now, fall back to nearest neighbor
      return this.nearestNeighborOptimization(deliveries, startPoint);

    } catch (error) {
      console.error('Error optimizing route:', error);
      throw error;
    }
  }

  /**
   * Simple nearest neighbor route optimization
   * @param {Array} deliveries - Array of delivery objects with coordinates
   * @param {Array} startPoint - Starting coordinates
   * @returns {Object} Optimized route
   */
  nearestNeighborOptimization(deliveries, startPoint) {
    const route = [];
    const remaining = [...deliveries];
    let currentPoint = startPoint;
    let totalDistance = 0;

    while (remaining.length > 0) {
      let nearestIndex = 0;
      let nearestDistance = this.calculateDistance(currentPoint, remaining[0].coordinates);

      // Find nearest unvisited delivery
      for (let i = 1; i < remaining.length; i++) {
        const distance = this.calculateDistance(currentPoint, remaining[i].coordinates);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = i;
        }
      }

      // Add nearest delivery to route
      const nearestDelivery = remaining.splice(nearestIndex, 1)[0];
      route.push(nearestDelivery);
      currentPoint = nearestDelivery.coordinates;
      totalDistance += nearestDistance;
    }

    return {
      success: true,
      route,
      totalDistance: Math.round(totalDistance * 100) / 100, // Round to 2 decimal places
      estimatedTime: this.estimatePickupTime(totalDistance)
    };
  }

  /**
   * Calculate delivery time estimate based on multiple factors
   * @param {Array} pickupCoords - Pickup coordinates
   * @param {Array} deliveryCoords - Delivery coordinates  
   * @param {string} serviceType - Service type (standard, express, etc.)
   * @param {string} priority - Priority level
   * @returns {Object} Time estimates
   */
  calculateDeliveryEstimate(pickupCoords, deliveryCoords, serviceType = 'standard', priority = 'normal') {
    const distance = this.calculateDistance(pickupCoords, deliveryCoords);
    const baseTime = this.estimatePickupTime(distance);

    // Service type multipliers
    const serviceMultipliers = {
      'same_day': 0.5,
      'express': 0.7,
      'next_day': 1.0,
      'standard': 1.5
    };

    // Priority multipliers  
    const priorityMultipliers = {
      'urgent': 0.5,
      'high': 0.7,
      'normal': 1.0,
      'low': 1.3
    };

    const serviceMultiplier = serviceMultipliers[serviceType] || 1.0;
    const priorityMultiplier = priorityMultipliers[priority] || 1.0;

    const estimatedTime = Math.round(baseTime * serviceMultiplier * priorityMultiplier);

    // Calculate delivery window
    const now = new Date();
    const estimatedDelivery = new Date(now.getTime() + estimatedTime * 60000);

    return {
      distance: Math.round(distance * 100) / 100,
      estimatedTime,
      estimatedDelivery,
      serviceType,
      priority
    };
  }

  /**
   * Get optimal hub for order processing
   * @param {Array} pickupCoords - Pickup coordinates
   * @param {Array} deliveryCoords - Delivery coordinates
   * @returns {Object} Best hub recommendation
   */
  async getOptimalHub(pickupCoords, deliveryCoords) {
    try {
      // Calculate midpoint for hub selection
      const midpoint = [
        (pickupCoords[0] + deliveryCoords[0]) / 2,
        (pickupCoords[1] + deliveryCoords[1]) / 2
      ];

      const availableHubs = await Hub.findAvailableHubs(midpoint, 1);

      if (availableHubs.length === 0) {
        return {
          success: false,
          message: 'No available hubs found'
        };
      }

      // Score hubs based on distance and capacity
      const hubScores = availableHubs.map(hub => {
        const distanceToPickup = this.calculateDistance(hub.address.coordinates, pickupCoords);
        const distanceToDelivery = this.calculateDistance(hub.address.coordinates, deliveryCoords);
        const averageDistance = (distanceToPickup + distanceToDelivery) / 2;
        
        const capacityScore = (hub.availableCapacity / hub.capacity.maxOrders) * 100;
        const distanceScore = Math.max(0, 100 - (averageDistance * 3));
        
        const totalScore = (distanceScore * 0.7) + (capacityScore * 0.3);

        return {
          hub,
          score: totalScore,
          distanceToPickup,
          distanceToDelivery,
          averageDistance
        };
      });

      // Sort by score
      hubScores.sort((a, b) => b.score - a.score);

      return {
        success: true,
        recommendedHub: hubScores[0].hub,
        score: hubScores[0].score,
        alternatives: hubScores.slice(1, 3)
      };

    } catch (error) {
      console.error('Error finding optimal hub:', error);
      throw error;
    }
  }

  /**
   * Batch assign multiple orders to drivers
   * @param {Array} orderIds - Array of order IDs
   * @returns {Object} Batch assignment results
   */
  async batchAssignOrders(orderIds) {
    const results = {
      successful: [],
      failed: [],
      summary: {
        total: orderIds.length,
        assigned: 0,
        unassigned: 0
      }
    };

    for (const orderId of orderIds) {
      try {
        const assignment = await this.findBestDriver(orderId);
        
        if (assignment.success) {
          results.successful.push({
            orderId,
            driverId: assignment.driver._id,
            driverName: assignment.driver.user.firstName + ' ' + assignment.driver.user.lastName,
            score: assignment.score,
            distance: assignment.distance
          });
          results.summary.assigned++;
        } else {
          results.failed.push({
            orderId,
            reason: assignment.message
          });
          results.summary.unassigned++;
        }
      } catch (error) {
        results.failed.push({
          orderId,
          reason: error.message
        });
        results.summary.unassigned++;
      }
    }

    return results;
  }
}

module.exports = new RouteOptimizationService();