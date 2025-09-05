const { validationResult } = require('express-validator');
const Order = require('../models/Order');
const User = require('../models/User');

// @desc    Create new order
// @route   POST /api/orders
// @access  Private (Merchant)
const createOrder = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      customerInfo,
      pickupAddress,
      items,
      pricing,
      payment,
      serviceType,
      priority,
      scheduledPickup,
      scheduledDelivery,
      specialInstructions
    } = req.body;

    // Calculate total weight and validate items
    let totalWeight = 0;
    let totalValue = 0;
    
    items.forEach(item => {
      totalWeight += item.weight * item.quantity;
      totalValue += item.value * item.quantity;
    });

    // Create order data
    const orderData = {
      merchant: req.user.userId,
      customerInfo,
      pickupAddress,
      items,
      pricing,
      payment,
      serviceType: serviceType || 'standard',
      priority: priority || 'normal',
      scheduledPickup,
      scheduledDelivery,
      specialInstructions,
      metadata: {
        source: req.body.source || 'web'
      }
    };

    // If customer email is provided, try to find existing customer
    if (customerInfo.email) {
      const existingCustomer = await User.findOne({ 
        email: customerInfo.email.toLowerCase(),
        role: 'customer'
      });
      if (existingCustomer) {
        orderData.customer = existingCustomer._id;
      }
    }

    const order = await Order.create(orderData);

    // Populate the created order
    await order.populate('merchant', 'firstName lastName email phone');
    if (order.customer) {
      await order.populate('customer', 'firstName lastName email phone');
    }

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: { order }
    });

  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create order',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Get all orders (with filtering and pagination)
// @route   GET /api/orders
// @access  Private
const getOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      merchant,
      customer,
      serviceType,
      priority,
      startDate,
      endDate,
      search
    } = req.query;

    // Build query based on user role
    let query = {};
    
    // Role-based access control
    if (req.user.role === 'merchant') {
      query.merchant = req.user.userId;
    } else if (req.user.role === 'customer') {
      query.$or = [
        { customer: req.user.userId },
        { 'customerInfo.email': req.user.user.email }
      ];
    } else if (req.user.role === 'driver') {
      // Driver sees assigned orders (will be implemented with Driver model)
      // For now, show orders that are ready for pickup or in transit
      query.status = { $in: ['pickup_scheduled', 'picked_up', 'in_transit', 'out_for_delivery'] };
    }
    // Admin sees all orders (no additional filter)

    // Apply filters
    if (status) {
      query.status = status;
    }
    
    if (merchant && req.user.role === 'admin') {
      query.merchant = merchant;
    }
    
    if (customer && (req.user.role === 'admin' || req.user.role === 'merchant')) {
      query.customer = customer;
    }
    
    if (serviceType) {
      query.serviceType = serviceType;
    }
    
    if (priority) {
      query.priority = priority;
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { 'tracking.trackingNumber': { $regex: search, $options: 'i' } },
        { 'customerInfo.name': { $regex: search, $options: 'i' } },
        { 'customerInfo.phone': { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Execute query
    const orders = await Order.find(query)
      .populate('merchant', 'firstName lastName email phone')
      .populate('customer', 'firstName lastName email phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await Order.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        orders,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalOrders: total,
          hasNext: skip + orders.length < total,
          hasPrev: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get orders'
    });
  }
};

// @desc    Get single order by ID
// @route   GET /api/orders/:id
// @access  Private
const getOrder = async (req, res) => {
  try {
    const { id } = req.params;

    let query = { _id: id };
    
    // Role-based access control
    if (req.user.role === 'merchant') {
      query.merchant = req.user.userId;
    } else if (req.user.role === 'customer') {
      query.$or = [
        { customer: req.user.userId },
        { 'customerInfo.email': req.user.user.email }
      ];
    }
    // Admin and driver can see all orders

    const order = await Order.findOne(query)
      .populate('merchant', 'firstName lastName email phone')
      .populate('customer', 'firstName lastName email phone')
      .populate('assignedHub', 'name address');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.status(200).json({
      success: true,
      data: { order }
    });

  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get order'
    });
  }
};

// @desc    Update order
// @route   PUT /api/orders/:id
// @access  Private
const updateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Role-based access control for updates
    let query = { _id: id };
    
    if (req.user.role === 'merchant') {
      query.merchant = req.user.userId;
      // Merchants can only update certain fields
      const allowedFields = ['customerInfo', 'items', 'pricing', 'specialInstructions', 'scheduledPickup'];
      const filteredUpdates = {};
      allowedFields.forEach(field => {
        if (updates[field] !== undefined) {
          filteredUpdates[field] = updates[field];
        }
      });
      updates = filteredUpdates;
    }

    const order = await Order.findOne(query);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if order can be updated based on status
    const nonEditableStatuses = ['delivered', 'cancelled', 'refunded'];
    if (nonEditableStatuses.includes(order.status) && req.user.role !== 'admin') {
      return res.status(400).json({
        success: false,
        message: `Cannot update order with status: ${order.status}`
      });
    }

    // Update order
    Object.keys(updates).forEach(key => {
      order[key] = updates[key];
    });

    await order.save();

    // Populate updated order
    await order.populate('merchant', 'firstName lastName email phone');
    if (order.customer) {
      await order.populate('customer', 'firstName lastName email phone');
    }

    res.status(200).json({
      success: true,
      message: 'Order updated successfully',
      data: { order }
    });

  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order'
    });
  }
};

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private (Admin, Driver)
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, location, photo, signature } = req.body;

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Validate status transition
    const validTransitions = {
      'pending': ['confirmed', 'cancelled'],
      'confirmed': ['pickup_scheduled', 'cancelled'],
      'pickup_scheduled': ['picked_up', 'cancelled'],
      'picked_up': ['in_transit', 'returned'],
      'in_transit': ['out_for_delivery', 'returned'],
      'out_for_delivery': ['delivered', 'failed_delivery'],
      'failed_delivery': ['out_for_delivery', 'returned'],
      'delivered': ['returned'], // Only in case of issues
      'returned': [],
      'cancelled': [],
      'refunded': []
    };

    if (!validTransitions[order.status]?.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot change status from ${order.status} to ${status}`
      });
    }

    // Update order status with history
    await order.updateStatus(status, notes, req.user.userId);

    // Update location if provided
    if (location && Array.isArray(location) && location.length === 2) {
      order.tracking.currentLocation = location;
    }

    // Handle delivery attempt for failed deliveries
    if (status === 'failed_delivery' || status === 'delivered') {
      const result = status === 'delivered' ? 'success' : 'failed';
      await order.addDeliveryAttempt(result, notes, req.user.userId, notes, photo, signature);
    }

    await order.save();

    res.status(200).json({
      success: true,
      message: `Order status updated to ${status}`,
      data: { 
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          status: order.status,
          trackingNumber: order.tracking.trackingNumber
        }
      }
    });

  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order status'
    });
  }
};

// @desc    Track order by tracking number
// @route   GET /api/orders/track/:trackingNumber
// @access  Public
const trackOrder = async (req, res) => {
  try {
    const { trackingNumber } = req.params;

    const order = await Order.findOne({ 'tracking.trackingNumber': trackingNumber })
      .select('orderNumber status tracking customerInfo.name createdAt')
      .populate('merchant', 'firstName lastName phone');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found with this tracking number'
      });
    }

    // Public tracking info (limited data)
    const trackingInfo = {
      orderNumber: order.orderNumber,
      trackingNumber: order.tracking.trackingNumber,
      status: order.status,
      customerName: order.customerInfo.name,
      createdAt: order.createdAt,
      estimatedDelivery: order.tracking.estimatedDelivery,
      statusHistory: order.tracking.statusHistory.map(history => ({
        status: history.status,
        timestamp: history.timestamp,
        notes: history.notes
      })),
      merchant: {
        name: `${order.merchant.firstName} ${order.merchant.lastName}`,
        phone: order.merchant.phone
      }
    };

    res.status(200).json({
      success: true,
      data: { tracking: trackingInfo }
    });

  } catch (error) {
    console.error('Track order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track order'
    });
  }
};

// @desc    Cancel order
// @route   DELETE /api/orders/:id
// @access  Private
const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    let query = { _id: id };
    
    // Role-based access control
    if (req.user.role === 'merchant') {
      query.merchant = req.user.userId;
    } else if (req.user.role === 'customer') {
      query.$or = [
        { customer: req.user.userId },
        { 'customerInfo.email': req.user.user.email }
      ];
    }

    const order = await Order.findOne(query);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if order can be cancelled
    const nonCancellableStatuses = ['delivered', 'cancelled', 'refunded'];
    if (nonCancellableStatuses.includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel order with status: ${order.status}`
      });
    }

    // Update status to cancelled
    await order.updateStatus('cancelled', reason || 'Order cancelled by user', req.user.userId);

    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      data: { 
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          status: order.status
        }
      }
    });

  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel order'
    });
  }
};

// @desc    Get order statistics
// @route   GET /api/orders/stats
// @access  Private
const getOrderStats = async (req, res) => {
  try {
    let matchQuery = {};
    
    // Role-based access control
    if (req.user.role === 'merchant') {
      matchQuery.merchant = req.user.userId;
    } else if (req.user.role === 'customer') {
      matchQuery.$or = [
        { customer: req.user.userId },
        { 'customerInfo.email': req.user.user.email }
      ];
    }

    const stats = await Order.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalValue: { $sum: '$pricing.total' }
        }
      }
    ]);

    const totalOrders = await Order.countDocuments(matchQuery);
    
    // Get recent orders count
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);
    
    const recentOrders = await Order.countDocuments({
      ...matchQuery,
      createdAt: { $gte: last30Days }
    });

    res.status(200).json({
      success: true,
      data: {
        statusBreakdown: stats,
        totalOrders,
        recentOrders,
        period: 'last_30_days'
      }
    });

  } catch (error) {
    console.error('Get order stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get order statistics'
    });
  }
};

module.exports = {
  createOrder,
  getOrders,
  getOrder,
  updateOrder,
  updateOrderStatus,
  trackOrder,
  cancelOrder,
  getOrderStats
};