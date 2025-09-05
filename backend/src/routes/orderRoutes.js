const express = require('express');
const { body, param, query } = require('express-validator');
const router = express.Router();

// Import controllers
const {
  createOrder,
  getOrders,
  getOrder,
  updateOrder,
  updateOrderStatus,
  trackOrder,
  cancelOrder,
  getOrderStats
} = require('../controllers/orderController');

// Import middleware
const {
  authenticate,
  authorize,
  isMerchant,
  isDriver,
  optionalAuth
} = require('../middleware/auth');

// Validation rules
const createOrderValidation = [
  // Customer information validation
  body('customerInfo.name')
    .trim()
    .notEmpty()
    .withMessage('Customer name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Customer name must be between 2 and 100 characters'),
    
  body('customerInfo.phone')
    .isMobilePhone()
    .withMessage('Valid customer phone number is required'),
    
  body('customerInfo.email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email address required'),
    
  body('customerInfo.address.street')
    .trim()
    .notEmpty()
    .withMessage('Customer street address is required')
    .isLength({ min: 5, max: 200 })
    .withMessage('Street address must be between 5 and 200 characters'),
    
  body('customerInfo.address.city')
    .trim()
    .notEmpty()
    .withMessage('Customer city is required'),
    
  body('customerInfo.address.coordinates')
    .isArray({ min: 2, max: 2 })
    .withMessage('Customer coordinates must be [longitude, latitude]'),
    
  // Pickup address validation
  body('pickupAddress.street')
    .trim()
    .notEmpty()
    .withMessage('Pickup street address is required')
    .isLength({ min: 5, max: 200 })
    .withMessage('Pickup street address must be between 5 and 200 characters'),
    
  body('pickupAddress.city')
    .trim()
    .notEmpty()
    .withMessage('Pickup city is required'),
    
  body('pickupAddress.coordinates')
    .isArray({ min: 2, max: 2 })
    .withMessage('Pickup coordinates must be [longitude, latitude]'),
    
  // Items validation
  body('items')
    .isArray({ min: 1 })
    .withMessage('At least one item is required'),
    
  body('items.*.name')
    .trim()
    .notEmpty()
    .withMessage('Item name is required')
    .isLength({ max: 100 })
    .withMessage('Item name cannot exceed 100 characters'),
    
  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Item quantity must be at least 1'),
    
  body('items.*.weight')
    .isFloat({ min: 0.1 })
    .withMessage('Item weight must be at least 0.1 kg'),
    
  body('items.*.value')
    .isFloat({ min: 0 })
    .withMessage('Item value cannot be negative'),
    
  body('items.*.category')
    .optional()
    .isIn(['electronics', 'clothing', 'books', 'food', 'fragile', 'documents', 'other'])
    .withMessage('Invalid item category'),
    
  // Pricing validation
  body('pricing.subtotal')
    .isFloat({ min: 0 })
    .withMessage('Subtotal cannot be negative'),
    
  body('pricing.shippingCost')
    .isFloat({ min: 0 })
    .withMessage('Shipping cost cannot be negative'),
    
  body('pricing.total')
    .isFloat({ min: 0 })
    .withMessage('Total cannot be negative'),
    
  // Payment validation
  body('payment.method')
    .isIn(['cod', 'prepaid', 'card', 'wallet'])
    .withMessage('Invalid payment method'),
    
  // Service type validation
  body('serviceType')
    .optional()
    .isIn(['standard', 'express', 'same_day', 'next_day'])
    .withMessage('Invalid service type'),
    
  body('priority')
    .optional()
    .isIn(['low', 'normal', 'high', 'urgent'])
    .withMessage('Invalid priority level')
];

const updateOrderValidation = [
  body('customerInfo.name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Customer name must be between 2 and 100 characters'),
    
  body('customerInfo.phone')
    .optional()
    .isMobilePhone()
    .withMessage('Valid phone number required'),
    
  body('customerInfo.email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email address required'),
    
  body('items')
    .optional()
    .isArray({ min: 1 })
    .withMessage('At least one item is required'),
    
  body('pricing.total')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Total cannot be negative'),
    
  body('specialInstructions')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Special instructions cannot exceed 500 characters')
];

const statusUpdateValidation = [
  body('status')
    .isIn([
      'pending', 'confirmed', 'pickup_scheduled', 'picked_up', 
      'in_transit', 'out_for_delivery', 'delivered', 
      'failed_delivery', 'returned', 'cancelled', 'refunded'
    ])
    .withMessage('Invalid status'),
    
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 300 })
    .withMessage('Notes cannot exceed 300 characters'),
    
  body('location')
    .optional()
    .isArray({ min: 2, max: 2 })
    .withMessage('Location must be [longitude, latitude]')
];

const trackingValidation = [
  param('trackingNumber')
    .matches(/^TRK[0-9A-Z]+$/)
    .withMessage('Invalid tracking number format')
];

const idValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid order ID')
];

const queryValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
    
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
    
  query('status')
    .optional()
    .isIn([
      'pending', 'confirmed', 'pickup_scheduled', 'picked_up', 
      'in_transit', 'out_for_delivery', 'delivered', 
      'failed_delivery', 'returned', 'cancelled', 'refunded'
    ])
    .withMessage('Invalid status filter'),
    
  query('serviceType')
    .optional()
    .isIn(['standard', 'express', 'same_day', 'next_day'])
    .withMessage('Invalid service type filter'),
    
  query('priority')
    .optional()
    .isIn(['low', 'normal', 'high', 'urgent'])
    .withMessage('Invalid priority filter'),
    
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
    
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
];

// Public routes
router.get('/track/:trackingNumber', trackingValidation, trackOrder);

// Protected routes - require authentication
router.use(authenticate);

// General order routes
router.get('/', queryValidation, getOrders);
router.get('/stats', getOrderStats);
router.get('/:id', idValidation, getOrder);

// Merchant-only routes
router.post('/', isMerchant, createOrderValidation, createOrder);
router.put('/:id', idValidation, updateOrderValidation, updateOrder);
router.delete('/:id', idValidation, cancelOrder);

// Admin and Driver routes for status updates
router.put(
  '/:id/status', 
  authorize('admin', 'driver'), 
  idValidation, 
  statusUpdateValidation, 
  updateOrderStatus
);

// Additional specialized routes

// Get orders by merchant (admin only)
router.get('/merchant/:merchantId', 
  authorize('admin'),
  param('merchantId').isMongoId().withMessage('Invalid merchant ID'),
  queryValidation,
  async (req, res, next) => {
    req.query.merchant = req.params.merchantId;
    next();
  },
  getOrders
);

// Get orders by status (admin, drivers)
router.get('/status/:status',
  authorize('admin', 'driver'),
  param('status').isIn([
    'pending', 'confirmed', 'pickup_scheduled', 'picked_up', 
    'in_transit', 'out_for_delivery', 'delivered', 
    'failed_delivery', 'returned', 'cancelled', 'refunded'
  ]).withMessage('Invalid status'),
  queryValidation,
  async (req, res, next) => {
    req.query.status = req.params.status;
    next();
  },
  getOrders
);

// Bulk status update (admin only)
router.put('/bulk/status',
  authorize('admin'),
  body('orderIds')
    .isArray({ min: 1 })
    .withMessage('At least one order ID is required'),
  body('orderIds.*')
    .isMongoId()
    .withMessage('All order IDs must be valid'),
  body('status')
    .isIn([
      'pending', 'confirmed', 'pickup_scheduled', 'picked_up', 
      'in_transit', 'out_for_delivery', 'delivered', 
      'failed_delivery', 'returned', 'cancelled', 'refunded'
    ])
    .withMessage('Invalid status'),
  async (req, res) => {
    try {
      const { orderIds, status, notes } = req.body;
      
      const updatePromises = orderIds.map(async (orderId) => {
        const order = await Order.findById(orderId);
        if (order) {
          await order.updateStatus(status, notes, req.user.userId);
          return { orderId, success: true };
        }
        return { orderId, success: false, error: 'Order not found' };
      });
      
      const results = await Promise.all(updatePromises);
      
      res.status(200).json({
        success: true,
        message: 'Bulk status update completed',
        data: { results }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Bulk update failed',
        error: error.message
      });
    }
  }
);

// Get orders near location (for drivers)
router.get('/nearby/location',
  isDriver,
  query('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Valid latitude is required'),
  query('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Valid longitude is required'),
  query('radius')
    .optional()
    .isInt({ min: 1, max: 50000 })
    .withMessage('Radius must be between 1 and 50000 meters'),
  async (req, res) => {
    try {
      const { latitude, longitude, radius = 5000 } = req.query;
      const coordinates = [parseFloat(longitude), parseFloat(latitude)];
      
      const orders = await Order.findInArea(coordinates, parseInt(radius))
        .where('status').in(['pickup_scheduled', 'picked_up', 'in_transit', 'out_for_delivery'])
        .populate('merchant', 'firstName lastName phone')
        .sort({ createdAt: -1 })
        .limit(20);
      
      res.status(200).json({
        success: true,
        data: { orders }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get nearby orders'
      });
    }
  }
);

module.exports = router;