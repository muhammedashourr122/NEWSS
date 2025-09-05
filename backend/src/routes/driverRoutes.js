const express = require('express');
const router = express.Router();
const Driver = require('../models/Driver');
const Order = require('../models/Order');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

// @route   POST /api/drivers/register
// @desc    Register a new driver
// @access  Private (Admin)
router.post('/register', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const driverData = {
      ...req.body,
      user: req.body.userId, // Link to User model
      createdBy: req.user.userId
    };

    const driver = new Driver(driverData);
    await driver.save();

    res.status(201).json({
      success: true,
      message: 'Driver registered successfully',
      driver
    });
  } catch (error) {
    console.error('Driver registration error:', error);
    res.status(500).json({ error: 'Failed to register driver' });
  }
});

// @route   GET /api/drivers
// @desc    Get all drivers
// @access  Private (Admin)
router.get('/', authMiddleware, roleMiddleware(['admin', 'dispatcher']), async (req, res) => {
  try {
    const { status, available, page = 1, limit = 20 } = req.query;
    const query = {};

    if (status) query.status = status;
    if (available !== undefined) query.isAvailable = available === 'true';

    const drivers = await Driver.find(query)
      .populate('user', 'firstName lastName email phone')
      .populate('currentHub', 'name location')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Driver.countDocuments(query);

    res.json({
      success: true,
      drivers,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Drivers fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch drivers' });
  }
});

// @route   GET /api/drivers/me
// @desc    Get current driver profile
// @access  Private (Driver)
router.get('/me', authMiddleware, roleMiddleware(['driver']), async (req, res) => {
  try {
    const driver = await Driver.findOne({ user: req.user.userId })
      .populate('user', 'firstName lastName email phone')
      .populate('currentHub', 'name location')
      .populate('activeOrders', 'orderNumber status customerInfo.address');

    if (!driver) {
      return res.status(404).json({ error: 'Driver profile not found' });
    }

    res.json({
      success: true,
      driver
    });
  } catch (error) {
    console.error('Driver profile error:', error);
    res.status(500).json({ error: 'Failed to fetch driver profile' });
  }
});

// @route   GET /api/drivers/:id
// @desc    Get driver by ID
// @access  Private (Admin)
router.get('/:id', authMiddleware, roleMiddleware(['admin', 'dispatcher']), async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id)
      .populate('user', 'firstName lastName email phone')
      .populate('currentHub', 'name location')
      .populate('activeOrders', 'orderNumber status');

    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    res.json({
      success: true,
      driver
    });
  } catch (error) {
    console.error('Driver fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch driver' });
  }
});

// @route   PUT /api/drivers/:id
// @desc    Update driver information
// @access  Private (Admin)
router.put('/:id', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const allowedUpdates = [
      'vehicle', 'licenseNumber', 'licenseExpiry', 
      'maxCapacity', 'currentHub', 'serviceAreas', 'isAvailable'
    ];

    const updates = {};
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const driver = await Driver.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('user', 'firstName lastName email phone');

    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    res.json({
      success: true,
      message: 'Driver updated successfully',
      driver
    });
  } catch (error) {
    console.error('Driver update error:', error);
    res.status(500).json({ error: 'Failed to update driver' });
  }
});

// @route   PATCH /api/drivers/:id/status
// @desc    Update driver status (online/offline)
// @access  Private (Driver/Admin)
router.patch('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { status, location } = req.body;
    
    let driverId = req.params.id;
    
    // If driver is updating their own status
    if (req.user.role === 'driver') {
      const driver = await Driver.findOne({ user: req.user.userId });
      if (!driver) {
        return res.status(404).json({ error: 'Driver profile not found' });
      }
      driverId = driver._id;
    }

    const updates = {};
    if (status !== undefined) updates.status = status;
    if (location) updates.currentLocation = location;
    updates.lastSeenAt = new Date();

    const driver = await Driver.findByIdAndUpdate(
      driverId,
      updates,
      { new: true }
    );

    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    res.json({
      success: true,
      message: 'Driver status updated',
      driver
    });
  } catch (error) {
    console.error('Driver status error:', error);
    res.status(500).json({ error: 'Failed to update driver status' });
  }
});

// @route   PATCH /api/drivers/:id/location
// @desc    Update driver location
// @access  Private (Driver)
router.patch('/:id/location', authMiddleware, roleMiddleware(['driver']), async (req, res) => {
  try {
    const { coordinates, heading, speed } = req.body;

    if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
      return res.status(400).json({ error: 'Valid coordinates are required' });
    }

    const driver = await Driver.findOne({ user: req.user.userId });
    if (!driver) {
      return res.status(404).json({ error: 'Driver profile not found' });
    }

    driver.currentLocation = coordinates;
    driver.lastSeenAt = new Date();
    
    if (heading !== undefined) driver.heading = heading;
    if (speed !== undefined) driver.speed = speed;

    // Add to location history
    driver.locationHistory.push({
      coordinates,
      timestamp: new Date(),
      heading,
      speed
    });

    // Keep only last 100 location points
    if (driver.locationHistory.length > 100) {
      driver.locationHistory = driver.locationHistory.slice(-100);
    }

    await driver.save();

    res.json({
      success: true,
      message: 'Location updated',
      location: {
        coordinates: driver.currentLocation,
        lastSeenAt: driver.lastSeenAt
      }
    });
  } catch (error) {
    console.error('Location update error:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

// @route   GET /api/drivers/:id/orders
// @desc    Get driver's assigned orders
// @access  Private
router.get('/:id/orders', authMiddleware, async (req, res) => {
  try {
    const { status, date, completed } = req.query;
    
    let driverId = req.params.id;
    
    // If driver is accessing their own orders
    if (req.user.role === 'driver') {
      const driver = await Driver.findOne({ user: req.user.userId });
      if (!driver) {
        return res.status(404).json({ error: 'Driver profile not found' });
      }
      driverId = driver._id;
    } else if (req.user.role !== 'admin' && req.user.role !== 'dispatcher') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const query = { assignedDriver: driverId };
    
    if (status) query.status = status;
    if (completed === 'true') {
      query.status = { $in: ['delivered', 'returned', 'cancelled'] };
    } else if (completed === 'false') {
      query.status = { $nin: ['delivered', 'returned', 'cancelled'] };
    }
    
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      query.createdAt = { $gte: startDate, $lt: endDate };
    }

    const orders = await Order.find(query)
      .populate('merchant', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      orders,
      count: orders.length
    });
  } catch (error) {
    console.error('Driver orders error:', error);
    res.status(500).json({ error: 'Failed to fetch driver orders' });
  }
});

// @route   POST /api/drivers/:id/accept-order
// @desc    Accept an order assignment
// @access  Private (Driver)
router.post('/:id/accept-order', authMiddleware, roleMiddleware(['driver']), async (req, res) => {
  try {
    const { orderId } = req.body;

    const driver = await Driver.findOne({ user: req.user.userId });
    if (!driver) {
      return res.status(404).json({ error: 'Driver profile not found' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.assignedDriver && order.assignedDriver.toString() !== driver._id.toString()) {
      return res.status(400).json({ error: 'Order already assigned to another driver' });
    }

    // Assign order to driver
    order.assignedDriver = driver._id;
    order.status = 'pickup_scheduled';
    await order.save();

    // Add to driver's active orders
    if (!driver.activeOrders.includes(orderId)) {
      driver.activeOrders.push(orderId);
      await driver.save();
    }

    res.json({
      success: true,
      message: 'Order accepted successfully',
      order
    });
  } catch (error) {
    console.error('Order acceptance error:', error);
    res.status(500).json({ error: 'Failed to accept order' });
  }
});

// @route   GET /api/drivers/:id/earnings
// @desc    Get driver earnings
// @access  Private
router.get('/:id/earnings', authMiddleware, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let driverId = req.params.id;
    
    if (req.user.role === 'driver') {
      const driver = await Driver.findOne({ user: req.user.userId });
      if (!driver) {
        return res.status(404).json({ error: 'Driver profile not found' });
      }
      driverId = driver._id;
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const driver = await Driver.findById(driverId);
    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    let earnings = driver.earnings;
    
    // Filter by date if provided
    if (startDate || endDate) {
      earnings = earnings.filter(earning => {
        const earningDate = new Date(earning.date);
        if (startDate && earningDate < new Date(startDate)) return false;
        if (endDate && earningDate > new Date(endDate)) return false;
        return true;
      });
    }

    const totalEarnings = earnings.reduce((sum, e) => sum + e.amount, 0);
    const totalDeliveries = earnings.reduce((sum, e) => sum + (e.deliveries || 0), 0);

    res.json({
      success: true,
      earnings,
      summary: {
        totalEarnings,
        totalDeliveries,
        averagePerDelivery: totalDeliveries > 0 ? totalEarnings / totalDeliveries : 0
      }
    });
  } catch (error) {
    console.error('Earnings fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch earnings' });
  }
});

// @route   GET /api/drivers/:id/stats
// @desc    Get driver statistics
// @access  Private
router.get('/:id/stats', authMiddleware, async (req, res) => {
  try {
    let driverId = req.params.id;
    
    if (req.user.role === 'driver') {
      const driver = await Driver.findOne({ user: req.user.userId });
      if (!driver) {
        return res.status(404).json({ error: 'Driver profile not found' });
      }
      driverId = driver._id;
    } else if (req.user.role !== 'admin' && req.user.role !== 'dispatcher') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const driver = await Driver.findById(driverId);
    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    // Get order statistics
    const orderStats = await Order.aggregate([
      { $match: { assignedDriver: driver._id } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          deliveredOrders: {
            $sum: {
              $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0]
            }
          },
          failedOrders: {
            $sum: {
              $cond: [{ $eq: ['$status', 'failed_delivery'] }, 1, 0]
            }
          },
          avgDeliveryTime: {
            $avg: {
              $cond: [
                { $and: [
                  { $ne: ['$tracking.actualPickupTime', null] },
                  { $ne: ['$tracking.actualDeliveryTime', null] }
                ]},
                {
                  $subtract: ['$tracking.actualDeliveryTime', '$tracking.actualPickupTime']
                },
                null
              ]
            }
          }
        }
      }
    ]);

    const stats = {
      driver: {
        id: driver._id,
        status: driver.status,
        isAvailable: driver.isAvailable,
        rating: driver.rating
      },
      performance: orderStats[0] || {
        totalOrders: 0,
        deliveredOrders: 0,
        failedOrders: 0,
        avgDeliveryTime: 0
      },
      successRate: orderStats[0] 
        ? (orderStats[0].deliveredOrders / orderStats[0].totalOrders * 100).toFixed(2)
        : 0
    };

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Driver stats error:', error);
    res.status(500).json({ error: 'Failed to fetch driver statistics' });
  }
});

// @route   DELETE /api/drivers/:id
// @desc    Deactivate driver
// @access  Private (Admin)
router.delete('/:id', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id);
    
    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    driver.status = 'inactive';
    driver.isAvailable = false;
    await driver.save();

    res.json({
      success: true,
      message: 'Driver deactivated successfully'
    });
  } catch (error) {
    console.error('Driver deactivation error:', error);
    res.status(500).json({ error: 'Failed to deactivate driver' });
  }
});

module.exports = router;