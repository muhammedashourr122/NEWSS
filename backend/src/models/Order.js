const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
    required: true,
    uppercase: true
  },
  merchant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Merchant is required'],
    index: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Customer might not be registered
  },
  customerInfo: {
    name: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true
    },
    phone: {
      type: String,
      required: [true, 'Customer phone is required'],
      match: [/^\+?[\d\s-()]+$/, 'Please enter a valid phone number']
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    address: {
      street: {
        type: String,
        required: [true, 'Delivery street address is required'],
        trim: true
      },
      city: {
        type: String,
        required: [true, 'Delivery city is required'],
        trim: true
      },
      state: String,
      zipCode: String,
      country: {
        type: String,
        default: 'Egypt'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        index: '2dsphere',
        validate: {
          validator: function(arr) {
            return arr.length === 2 && 
                   arr[0] >= -180 && arr[0] <= 180 && 
                   arr[1] >= -90 && arr[1] <= 90;
          },
          message: 'Coordinates must be [longitude, latitude] with valid ranges'
        }
      },
      notes: String // Delivery instructions
    }
  },
  pickupAddress: {
    street: {
      type: String,
      required: [true, 'Pickup street address is required'],
      trim: true
    },
    city: {
      type: String,
      required: [true, 'Pickup city is required'],
      trim: true
    },
    state: String,
    zipCode: String,
    country: {
      type: String,
      default: 'Egypt'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      index: '2dsphere',
      required: [true, 'Pickup coordinates are required']
    },
    contactPerson: String,
    contactPhone: String,
    notes: String // Pickup instructions
  },
  items: [{
    name: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    sku: String,
    quantity: {
      type: Number,
      required: [true, 'Item quantity is required'],
      min: [1, 'Quantity must be at least 1']
    },
    weight: {
      type: Number,
      required: [true, 'Item weight is required'],
      min: [0.01, 'Weight must be at least 0.01 kg']
    },
    dimensions: {
      length: { type: Number, min: 0 },
      width: { type: Number, min: 0 },
      height: { type: Number, min: 0 }
    },
    value: {
      type: Number,
      required: [true, 'Item value is required'],
      min: [0, 'Value cannot be negative']
    },
    category: {
      type: String,
      enum: ['electronics', 'clothing', 'books', 'food', 'fragile', 'documents', 'medical', 'other'],
      default: 'other'
    },
    isFragile: {
      type: Boolean,
      default: false
    },
    requiresRefrigeration: {
      type: Boolean,
      default: false
    }
  }],
  pricing: {
    subtotal: {
      type: Number,
      required: true,
      min: 0
    },
    shippingCost: {
      type: Number,
      required: true,
      min: 0
    },
    taxes: {
      type: Number,
      default: 0,
      min: 0
    },
    fees: {
      type: Number,
      default: 0,
      min: 0
    },
    discount: {
      type: Number,
      default: 0,
      min: 0
    },
    total: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      default: 'EGP',
      uppercase: true,
      enum: ['EGP', 'USD', 'EUR']
    }
  },
  payment: {
    method: {
      type: String,
      enum: ['cod', 'prepaid', 'card', 'wallet', 'bank_transfer'],
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded', 'partial'],
      default: 'pending'
    },
    transactionId: String,
    paidAt: Date,
    codAmount: Number, // Cash on delivery amount
    paymentDetails: {
      cardLast4: String,
      paymentGateway: String,
      gatewayTransactionId: String
    }
  },
  status: {
    type: String,
    enum: [
      'pending',           // Order created, waiting for confirmation
      'confirmed',         // Order confirmed by merchant
      'pickup_scheduled',  // Pickup scheduled with driver
      'picked_up',        // Items collected from merchant
      'in_transit',       // On the way to destination hub
      'at_hub',           // Arrived at destination hub
      'out_for_delivery', // Out for final delivery
      'delivered',        // Successfully delivered
      'failed_delivery',  // Delivery attempt failed
      'returned',         // Returned to merchant
      'cancelled',        // Order cancelled
      'refunded'          // Order refunded
    ],
    default: 'pending',
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal',
    index: true
  },
  serviceType: {
    type: String,
    enum: ['standard', 'express', 'same_day', 'next_day', 'scheduled'],
    required: true,
    default: 'standard'
  },
  scheduledPickup: {
    date: Date,
    timeSlot: {
      start: String, // "09:00"
      end: String    // "17:00"
    },
    instructions: String
  },
  scheduledDelivery: {
    date: Date,
    timeSlot: {
      start: String,
      end: String
    },
    instructions: String
  },
  assignedDriver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver'
  },
  assignedHub: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hub'
  },
  tracking: {
    trackingNumber: {
      type: String,
      unique: true,
      sparse: true,
      uppercase: true
    },
    currentLocation: {
      type: [Number], // [longitude, latitude]
      index: '2dsphere'
    },
    estimatedDelivery: Date,
    actualPickupTime: Date,
    actualDeliveryTime: Date,
    statusHistory: [{
      status: {
        type: String,
        required: true
      },
      timestamp: {
        type: Date,
        default: Date.now
      },
      location: {
        type: [Number]
      },
      notes: String,
      updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      metadata: {
        reason: String,
        automaticUpdate: Boolean
      }
    }]
  },
  deliveryAttempts: [{
    attemptNumber: {
      type: Number,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    result: {
      type: String,
      enum: ['success', 'failed', 'rescheduled', 'customer_not_available'],
      required: true
    },
    reason: String,
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    notes: String,
    evidence: {
      photos: [String],
      signature: String,
      recipientName: String,
      recipientId: String
    },
    nextAttemptScheduled: Date
  }],
  specialInstructions: {
    type: String,
    maxLength: [500, 'Special instructions cannot exceed 500 characters']
  },
  internalNotes: {
    type: String,
    maxLength: [1000, 'Internal notes cannot exceed 1000 characters']
  },
  metadata: {
    source: {
      type: String,
      enum: ['web', 'mobile_app', 'shopify', 'woocommerce', 'api', 'manual'],
      default: 'web'
    },
    sourceOrderId: String, // Original order ID from e-commerce platform
    tags: [String],
    customFields: mongoose.Schema.Types.Mixed,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  notifications: {
    customerNotified: {
      created: { type: Boolean, default: false },
      confirmed: { type: Boolean, default: false },
      pickedUp: { type: Boolean, default: false },
      outForDelivery: { type: Boolean, default: false },
      delivered: { type: Boolean, default: false }
    },
    merchantNotified: {
      created: { type: Boolean, default: false },
      pickedUp: { type: Boolean, default: false },
      delivered: { type: Boolean, default: false }
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual fields
orderSchema.virtual('totalWeight').get(function() {
  return this.items.reduce((total, item) => total + (item.weight * item.quantity), 0);
});

orderSchema.virtual('totalItems').get(function() {
  return this.items.reduce((total, item) => total + item.quantity, 0);
});

orderSchema.virtual('totalVolume').get(function() {
  return this.items.reduce((total, item) => {
    if (item.dimensions && item.dimensions.length && item.dimensions.width && item.dimensions.height) {
      return total + (item.dimensions.length * item.dimensions.width * item.dimensions.height * item.quantity);
    }
    return total;
  }, 0);
});

orderSchema.virtual('daysSinceOrder').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

orderSchema.virtual('isFragileOrder').get(function() {
  return this.items.some(item => item.isFragile);
});

orderSchema.virtual('requiresRefrigeration').get(function() {
  return this.items.some(item => item.requiresRefrigeration);
});

// Indexes for performance
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ merchant: 1, status: 1 });
orderSchema.index({ customer: 1 });
orderSchema.index({ 'customerInfo.phone': 1 });
orderSchema.index({ 'tracking.trackingNumber': 1 });
orderSchema.index({ status: 1, priority: 1, createdAt: -1 });
orderSchema.index({ 'customerInfo.address.coordinates': '2dsphere' });
orderSchema.index({ 'pickupAddress.coordinates': '2dsphere' });
orderSchema.index({ assignedDriver: 1, status: 1 });
orderSchema.index({ assignedHub: 1, status: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ 'scheduledPickup.date': 1 });
orderSchema.index({ 'scheduledDelivery.date': 1 });

// Pre-save middleware
orderSchema.pre('save', async function(next) {
  try {
    if (this.isNew) {
      // Generate order number
      if (!this.orderNumber) {
        const count = await mongoose.model('Order').countDocuments();
        const timestamp = Date.now().toString().slice(-6);
        this.orderNumber = `ORD${timestamp}${(count + 1).toString().padStart(4, '0')}`;
      }
      
      // Generate tracking number
      if (!this.tracking.trackingNumber) {
        this.tracking.trackingNumber = `TRK${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
      }
      
      // Add initial status to history
      this.tracking.statusHistory.push({
        status: this.status,
        timestamp: new Date(),
        notes: 'Order created',
        updatedBy: this.metadata.createdBy
      });
      
      // Calculate pricing if not provided
      if (!this.pricing.subtotal && this.items.length > 0) {
        this.pricing.subtotal = this.items.reduce((total, item) => total + (item.value * item.quantity), 0);
      }
      
      if (!this.pricing.total) {
        this.pricing.total = this.pricing.subtotal + this.pricing.shippingCost + this.pricing.taxes + this.pricing.fees - this.pricing.discount;
      }
    }
    
    // Update status history if status changed
    if (this.isModified('status') && !this.isNew) {
      this.tracking.statusHistory.push({
        status: this.status,
        timestamp: new Date(),
        updatedBy: this.metadata.lastModifiedBy
      });
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Static methods
orderSchema.statics.findByStatus = function(status, limit = 50) {
  return this.find({ status })
    .populate('merchant', 'firstName lastName email phone')
    .populate('customer', 'firstName lastName email phone')
    .populate('assignedDriver', 'firstName lastName phone')
    .sort({ createdAt: -1 })
    .limit(limit);
};

orderSchema.statics.findInArea = function(coordinates, radius = 5000, status = null) {
  const query = {
    'customerInfo.address.coordinates': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: coordinates
        },
        $maxDistance: radius
      }
    }
  };
  
  if (status) {
    query.status = status;
  }
  
  return this.find(query);
};

orderSchema.statics.findByMerchant = function(merchantId, options = {}) {
  const query = { merchant: merchantId };
  
  if (options.status) query.status = options.status;
  if (options.startDate) query.createdAt = { $gte: options.startDate };
  if (options.endDate) query.createdAt = { ...query.createdAt, $lte: options.endDate };
  
  return this.find(query)
    .populate('customer', 'firstName lastName phone')
    .sort({ createdAt: -1 })
    .limit(options.limit || 50);
};

// Instance methods
orderSchema.methods.updateStatus = function(newStatus, notes, updatedBy) {
  this.status = newStatus;
  this.metadata.lastModifiedBy = updatedBy;
  
  this.tracking.statusHistory.push({
    status: newStatus,
    timestamp: new Date(),
    notes,
    updatedBy
  });
  
  // Update specific timestamps
  if (newStatus === 'picked_up') {
    this.tracking.actualPickupTime = new Date();
  } else if (newStatus === 'delivered') {
    this.tracking.actualDeliveryTime = new Date();
  }
  
  return this.save();
};

orderSchema.methods.addDeliveryAttempt = function(result, reason, driver, notes, evidence) {
  const attemptNumber = this.deliveryAttempts.length + 1;
  
  this.deliveryAttempts.push({
    attemptNumber,
    result,
    reason,
    driver,
    notes,
    evidence
  });
  
  // Update status based on attempt result
  if (result === 'success') {
    this.status = 'delivered';
    this.tracking.actualDeliveryTime = new Date();
  } else if (result === 'failed' && attemptNumber >= 3) {
    this.status = 'returned';
  }
  
  return this.save();
};

orderSchema.methods.calculateDistance = function() {
  if (!this.pickupAddress.coordinates || !this.customerInfo.address.coordinates) {
    return null;
  }
  
  const [pickupLng, pickupLat] = this.pickupAddress.coordinates;
  const [deliveryLng, deliveryLat] = this.customerInfo.address.coordinates;
  
  const R = 6371; // Earth's radius in km
  const dLat = (deliveryLat - pickupLat) * Math.PI / 180;
  const dLng = (deliveryLng - pickupLng) * Math.PI / 180;
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(pickupLat * Math.PI / 180) * Math.cos(deliveryLat * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
};

orderSchema.methods.estimateDeliveryTime = function() {
  const distance = this.calculateDistance();
  if (!distance) return null;
  
  let baseTime = 60; // Base time in minutes
  let speedKmH = 30; // Average speed in Cairo traffic
  
  // Adjust based on service type
  switch (this.serviceType) {
    case 'same_day':
      speedKmH = 35;
      baseTime = 30;
      break;
    case 'express':
      speedKmH = 40;
      baseTime = 45;
      break;
    case 'next_day':
      baseTime = 24 * 60; // 24 hours
      break;
  }
  
  const travelTime = (distance / speedKmH) * 60; // Convert to minutes
  return baseTime + travelTime;
};

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;