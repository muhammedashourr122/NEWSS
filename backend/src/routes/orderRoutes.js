const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const { validateOrder } = require('../middleware/validation');

// @route   POST /api/orders
// @desc    Create a new order
// @access  Private (Merchant)
router.post('/', authMiddleware, roleMiddleware(['merchant', 'admin']), validateOrder, async (req, res) => {
  try {
    const orderData = {
      ...req.body,
      merchant: req.user.userId,
      metadata: {
        ...req.body.metadata,
        createdBy: req.user.userId,
        source: req.body.source || 'api'
      }
    };

    const order = new Order(orderData);
    await order.save();

    await order.populate('merchant', 'firstName lastName email phone');

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      order
    });
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// @route   GET /api/orders
// @desc    Get orders (filtered by role)
// @access  Private
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, priority, startDate, endDate, page = 1, limit = 20, all } = req.query;
    const query = {};

    // Role-based filtering
    if (req.user.role === 'merchant') {
      query.merchant = req.user.userId;
    } else if (req.user.role === 'customer') {
      query.customer = req.user.userId;
    } else if (req.user.role === 'driver') {
      query.assignedDriver = req.user.userId;
    } else if (req.user.role !== 'admin' && !all) {
      query.merchant = req.user.userId;
    }

    // Apply filters
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const orders = await Order.find(query)
      .populate('merchant', 'firstName lastName email')
      .populate('customer', 'firstName lastName email')
      .populate('assignedDriver', 'firstName lastName phone')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      orders,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Orders fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// @route   GET /api/orders/track/:trackingNumber
// @desc    Track order by tracking number (public)
// @access  Public
router.get('/track/:trackingNumber', async (req, res) => {
  try {
    const order = await Order.findOne({ 
      'tracking.trackingNumber': req.params.trackingNumber.toUpperCase() 
    }).select('orderNumber status tracking customerInfo.name serviceType pricing.total createdAt');

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({
      success: true,
      order: {
        orderNumber: order.orderNumber,
        trackingNumber: order.tracking.trackingNumber,
        status: order.status,
        customerName: order.customerInfo.name,
        serviceType: order.serviceType,
        total: order.pricing.total,
        createdAt: order.createdAt,
        statusHistory: order.tracking.statusHistory,
        estimatedDelivery: order.tracking.estimatedDelivery,
        currentLocation: order.tracking.currentLocation
      }
    });
  } catch (error) {
    console.error('Order tracking error:', error);
    res.status(500).json({ error: 'Failed to track order' });
  }
});

// @route   GET /api/orders/:id
// @desc    Get single order
// @access  Private
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('merchant', 'firstName lastName email phone')
      .populate('customer', 'firstName lastName email phone')
      .populate('assignedDriver', 'firstName lastName phone vehicle');

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Check access permissions
    if (req.user.role !== 'admin') {
      const hasAccess = 
        order.merchant._id.toString() === req.user.userId ||
        order.customer?._id.toString() === req.user.userId ||
        order.assignedDriver?._id.toString() === req.user.userId;

      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    res.json({
      success: true,
      order
    });
  } catch (error) {
    console.error('Order fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// @route   PUT /api/orders/:id
// @desc    Update order
// @access  Private (Merchant/Admin)
router.put('/:id', authMiddleware, roleMiddleware(['merchant', 'admin']), async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Check ownership
    if (req.user.role === 'merchant' && order.merchant.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Prevent updates to delivered/cancelled orders
    if (['delivered', 'cancelled', 'returned'].includes(order.status)) {
      return res.status(400).json({ error: 'Cannot update completed orders' });
    }

    // Update allowed fields
    const allowedUpdates = [
      'customerInfo', 'items', 'pricing', 'priority', 
      'serviceType', 'specialInstructions', 'scheduledPickup', 'scheduledDelivery'
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        order[field] = req.body[field];
      }
    });

    order.metadata.lastModifiedBy = req.user.userId;
    await order.save();

    res.json({
      success: true,
      message: 'Order updated successfully',
      order
    });
  } catch (error) {
    console.error('Order update error:', error);
    res.status(500).json({ error: 'Failed to update order' });
  }
});

// @route   PATCH /api/orders/:id/status
// @desc    Update order status
// @access  Private
router.patch('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { status, notes, location } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Role-based status update permissions
    const allowedStatusByRole = {
      merchant: ['confirmed', 'cancelled'],
      driver: ['picked_up', 'in_transit', 'at_hub', 'out_for_delivery', 'delivered', 'failed_delivery'],
      admin: ['pending', 'confirmed', 'pickup_scheduled', 'picked_up', 'in_transit', 
              'at_hub', 'out_for_delivery', 'delivered', 'failed_delivery', 'returned', 
              'cancelled', 'refunded']
    };

    const allowedStatuses = allowedStatusByRole[req.user.role] || [];

    if (!allowedStatuses.includes(status)) {
      return res.status(403).json({ 
        error: `Your role cannot set status to ${status}` 
      });
    }

    // Update status
    await order.updateStatus(status, notes, req.user.userId);

    // Update location if provided
    if (location && Array.isArray(location) && location.length === 2) {
      order.tracking.currentLocation = location;
      await order.save();
    }

    res.json({
      success: true,
      message: 'Order status updated successfully',
      order
    });
  } catch (error) {
    console.error('Status update error:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// @route   POST /api/orders/:id/assign-driver
// @desc    Assign driver to order
// @access  Private (Admin)
router.post('/:id/assign-driver', authMiddleware, roleMiddleware(['admin', 'dispatcher']), async (req, res) => {
  try {
    const { driverId } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Verify driver exists
    // TODO: Check driver availability and capacity

    order.assignedDriver = driverId;
    order.status = 'pickup_scheduled';
    order.metadata.lastModifiedBy = req.user.userId;
    
    await order.updateStatus('pickup_scheduled', 'Driver assigned', req.user.userId);

    res.json({
      success: true,
      message: 'Driver assigned successfully',
      order
    });
  } catch (error) {
    console.error('Driver assignment error:', error);
    res.status(500).json({ error: 'Failed to assign driver' });
  }
});

// @route   POST /api/orders/:id/delivery-attempt
// @desc    Record delivery attempt
// @access  Private (Driver)
router.post('/:id/delivery-attempt', authMiddleware, roleMiddleware(['driver', 'admin']), async (req, res) => {
  try {
    const { result, reason, notes, evidence } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Check if driver is assigned to this order
    if (req.user.role === 'driver' && 
        order.assignedDriver?.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'You are not assigned to this order' });
    }

    await order.addDeliveryAttempt(
      result, 
      reason, 
      req.user.userId, 
      notes, 
      evidence
    );

    res.json({
      success: true,
      message: 'Delivery attempt recorded',
      order
    });
  } catch (error) {
    console.error('Delivery attempt error:', error);
    res.status(500).json({ error: 'Failed to record delivery attempt' });
  }
});

// @route   DELETE /api/orders/:id
// @desc    Cancel/Delete order
// @access  Private
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Check permissions
    const canDelete = 
      req.user.role === 'admin' ||
      (req.user.role === 'merchant' && order.merchant.toString() === req.user.userId);

    if (!canDelete) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Only allow cancellation of pending/confirmed orders
    if (!['pending', 'confirmed'].includes(order.status)) {
      return res.status(400).json({ 
        error: 'Can only cancel pending or confirmed orders' 
      });
    }

    await order.updateStatus('cancelled', 'Order cancelled by user', req.user.userId);

    res.json({
      success: true,
      message: 'Order cancelled successfully'
    });
  } catch (error) {
    console.error('Order deletion error:', error);
    res.status(500).json({ error: 'Failed to cancel order' });
  }
});

// @route   GET /api/orders/stats/summary
// @desc    Get order statistics
// @access  Private
router.get('/stats/summary', authMiddleware, async (req, res) => {
  try {
    const query = {};
    
    if (req.user.role === 'merchant') {
      query.merchant = req.user.userId;
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const stats = await Order.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$pricing.total' },
          avgOrderValue: { $avg: '$pricing.total' },
          statusCounts: {
            $push: '$status'
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalOrders: 1,
          totalRevenue: 1,
          avgOrderValue: { $round: ['$avgOrderValue', 2] },
          statusBreakdown: {
            $arrayToObject: {
              $map: {
                input: { $setUnion: ['$statusCounts'] },
                as: 'status',
                in: {
                  k: '$$status',
                  v: {
                    $size: {
                      $filter: {
                        input: '$statusCounts',
                        cond: { $eq: ['$$this', '$$status'] }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    ]);

    res.json({
      success: true,
      stats: stats[0] || {
        totalOrders: 0,
        totalRevenue: 0,
        avgOrderValue: 0,
        statusBreakdown: {}
      }
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// @route   GET /api/orders/nearby
// @desc    Get orders near a location
// @access  Private (Driver)
router.get('/nearby', authMiddleware, roleMiddleware(['driver', 'admin']), async (req, res) => {
  try {
    const { lat, lng, radius = 5000, status = 'pickup_scheduled' } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const orders = await Order.findInArea(
      [parseFloat(lng), parseFloat(lat)], 
      parseInt(radius),
      status
    );

    res.json({
      success: true,
      orders,
      count: orders.length
    });
  } catch (error) {
    console.error('Nearby orders error:', error);
    res.status(500).json({ error: 'Failed to fetch nearby orders' });
  }
});

module.exports = router;