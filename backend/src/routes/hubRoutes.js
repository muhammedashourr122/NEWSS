const express = require('express');
const router = express.Router();
const Hub = require('../models/Hub');
const Order = require('../models/Order');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

// @route   POST /api/hubs
// @desc    Create a new hub
// @access  Private (Admin)
router.post('/', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const hubData = {
      ...req.body,
      createdBy: req.user.userId
    };

    const hub = new Hub(hubData);
    await hub.save();

    res.status(201).json({
      success: true,
      message: 'Hub created successfully',
      hub
    });
  } catch (error) {
    console.error('Hub creation error:', error);
    res.status(500).json({ error: 'Failed to create hub' });
  }
});

// @route   GET /api/hubs
// @desc    Get all hubs
// @access  Private
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { city, type, isActive, page = 1, limit = 20 } = req.query;
    const query = {};

    if (city) query['address.city'] = new RegExp(city, 'i');
    if (type) query.type = type;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const hubs = await Hub.find(query)
      .populate('manager', 'firstName lastName email phone')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Hub.countDocuments(query);

    res.json({
      success: true,
      hubs,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Hubs fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch hubs' });
  }
});

// @route   GET /api/hubs/nearby
// @desc    Find nearest hub to coordinates
// @access  Private
router.get('/nearby', authMiddleware, async (req, res) => {
  try {
    const { lat, lng, maxDistance = 10000 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const hubs = await Hub.find({
      isActive: true,
      'location.coordinates': {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: parseInt(maxDistance)
        }
      }
    }).limit(5);

    res.json({
      success: true,
      hubs
    });
  } catch (error) {
    console.error('Nearby hubs error:', error);
    res.status(500).json({ error: 'Failed to find nearby hubs' });
  }
});

// @route   GET /api/hubs/:id
// @desc    Get hub by ID
// @access  Private
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const hub = await Hub.findById(req.params.id)
      .populate('manager', 'firstName lastName email phone')
      .populate('staff', 'firstName lastName email role');

    if (!hub) {
      return res.status(404).json({ error: 'Hub not found' });
    }

    res.json({
      success: true,
      hub
    });
  } catch (error) {
    console.error('Hub fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch hub' });
  }
});

// @route   PUT /api/hubs/:id
// @desc    Update hub
// @access  Private (Admin)
router.put('/:id', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const allowedUpdates = [
      'name', 'type', 'address', 'location', 'capacity',
      'operatingHours', 'manager', 'contactPhone', 'contactEmail',
      'facilities', 'isActive'
    ];

    const updates = {};
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const hub = await Hub.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('manager', 'firstName lastName email phone');

    if (!hub) {
      return res.status(404).json({ error: 'Hub not found' });
    }

    res.json({
      success: true,
      message: 'Hub updated successfully',
      hub
    });
  } catch (error) {
    console.error('Hub update error:', error);
    res.status(500).json({ error: 'Failed to update hub' });
  }
});

// @route   GET /api/hubs/:id/orders
// @desc    Get orders at hub
// @access  Private
router.get('/:id/orders', authMiddleware, async (req, res) => {
  try {
    const { status, date, page = 1, limit = 20 } = req.query;
    
    const query = { assignedHub: req.params.id };
    
    if (status) query.status = status;
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      query.createdAt = { $gte: startDate, $lt: endDate };
    }

    const orders = await Order.find(query)
      .populate('merchant', 'firstName lastName')
      .populate('assignedDriver', 'firstName lastName')
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
    console.error('Hub orders error:', error);
    res.status(500).json({ error: 'Failed to fetch hub orders' });
  }
});

// @route   POST /api/hubs/:id/assign-staff
// @desc    Assign staff to hub
// @access  Private (Admin)
router.post('/:id/assign-staff', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const { staffId } = req.body;

    const hub = await Hub.findById(req.params.id);
    if (!hub) {
      return res.status(404).json({ error: 'Hub not found' });
    }

    if (!hub.staff.includes(staffId)) {
      hub.staff.push(staffId);
      await hub.save();
    }

    await hub.populate('staff', 'firstName lastName email role');

    res.json({
      success: true,
      message: 'Staff assigned successfully',
      hub
    });
  } catch (error) {
    console.error('Staff assignment error:', error);
    res.status(500).json({ error: 'Failed to assign staff' });
  }
});

// @route   DELETE /api/hubs/:id/remove-staff
// @desc    Remove staff from hub
// @access  Private (Admin)
router.delete('/:id/remove-staff', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const { staffId } = req.body;

    const hub = await Hub.findById(req.params.id);
    if (!hub) {
      return res.status(404).json({ error: 'Hub not found' });
    }

    hub.staff = hub.staff.filter(id => id.toString() !== staffId);
    await hub.save();

    res.json({
      success: true,
      message: 'Staff removed successfully',
      hub
    });
  } catch (error) {
    console.error('Staff removal error:', error);
    res.status(500).json({ error: 'Failed to remove staff' });
  }
});

// @route   GET /api/hubs/:id/stats
// @desc    Get hub statistics
// @access  Private (Admin, Manager)
router.get('/:id/stats', authMiddleware, roleMiddleware(['admin', 'hub_manager']), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const query = { assignedHub: req.params.id };
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const stats = await Order.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalValue: { $sum: '$pricing.total' }
        }
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: '$count' },
          totalRevenue: { $sum: '$totalValue' },
          statusBreakdown: {
            $push: {
              status: '$_id',
              count: '$count',
              value: '$totalValue'
            }
          }
        }
      }
    ]);

    const hub = await Hub.findById(req.params.id);
    
    res.json({
      success: true,
      stats: {
        hub: {
          id: hub._id,
          name: hub.name,
          capacity: hub.capacity,
          currentLoad: hub.currentLoad
        },
        orders: stats[0] || {
          totalOrders: 0,
          totalRevenue: 0,
          statusBreakdown: []
        },
        utilization: hub.capacity > 0 
          ? ((hub.currentLoad / hub.capacity) * 100).toFixed(2) + '%'
          : '0%'
      }
    });
  } catch (error) {
    console.error('Hub stats error:', error);
    res.status(500).json({ error: 'Failed to fetch hub statistics' });
  }
});

// @route   PATCH /api/hubs/:id/capacity
// @desc    Update hub capacity/load
// @access  Private (Hub Manager, Admin)
router.patch('/:id/capacity', authMiddleware, roleMiddleware(['admin', 'hub_manager']), async (req, res) => {
  try {
    const { currentLoad, capacity } = req.body;

    const updates = {};
    if (currentLoad !== undefined) updates.currentLoad = currentLoad;
    if (capacity !== undefined) updates.capacity = capacity;

    const hub = await Hub.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true }
    );

    if (!hub) {
      return res.status(404).json({ error: 'Hub not found' });
    }

    res.json({
      success: true,
      message: 'Hub capacity updated',
      hub: {
        id: hub._id,
        name: hub.name,
        capacity: hub.capacity,
        currentLoad: hub.currentLoad,
        utilization: hub.capacity > 0 
          ? ((hub.currentLoad / hub.capacity) * 100).toFixed(2) + '%'
          : '0%'
      }
    });
  } catch (error) {
    console.error('Capacity update error:', error);
    res.status(500).json({ error: 'Failed to update capacity' });
  }
});

// @route   DELETE /api/hubs/:id
// @desc    Deactivate hub
// @access  Private (Admin)
router.delete('/:id', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const hub = await Hub.findById(req.params.id);
    
    if (!hub) {
      return res.status(404).json({ error: 'Hub not found' });
    }

    // Check if hub has active orders
    const activeOrders = await Order.countDocuments({
      assignedHub: req.params.id,
      status: { $nin: ['delivered', 'cancelled', 'returned'] }
    });

    if (activeOrders > 0) {
      return res.status(400).json({ 
        error: 'Cannot deactivate hub with active orders',
        activeOrders
      });
    }

    hub.isActive = false;
    await hub.save();

    res.json({
      success: true,
      message: 'Hub deactivated successfully'
    });
  } catch (error) {
    console.error('Hub deactivation error:', error);
    res.status(500).json({ error: 'Failed to deactivate hub' });
  }
});

module.exports = router;