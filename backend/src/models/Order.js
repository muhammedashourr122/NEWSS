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
    required: [true, 'Merchant is required']
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Customer might not be registered
  },
  customerInfo: {
    name: {
      type: String,
      required: [true, 'Customer name is required']
    },
    phone: {
      type: String,
      required: [true, 'Customer phone is required']
    },
    email: {
      type: String,
      lowercase: true,
      trim: true
    },
    address: {
      street: {
        type: String,
        required: [true, 'Street address is required']
      },
      city: {
        type: String,
        required: [true, 'City is required']
      },
      state: String,
      zipCode: String,
      country: {
        type: String,
        default: 'Egypt'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        index: '2dsphere'
      },
      notes: String // Delivery instructions
    }
  },
  pickupAddress: {
    street: {
      type: String,
      required: [true, 'Pickup street address is required']
    },
    city: {
      type: String,
      required: [true, 'Pickup city is required']
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
      required: true
    },
    contactPerson: String,
    contactPhone: String,
    notes: String
  },
  items: [{
    name: {
      type: String,
      required: [true, 'Item name is required']
    },
    description: String,
    sku: String,
    quantity: {
      type: Number,
      required: [true, 'Item quantity is required'],
      min: [1, 'Quantity must be at least 1']
    },
    weight: {
      type: Number,
      required: [true, 'Item weight is required'],
      min: [0.1, 'Weight must be at least 0.1 kg']
    },
    dimensions: {
      length: Number,
      width: Number,
      height: Number
    },
    value: {
      type: Number,
      required: [true, 'Item value is required'],
      min: [0, 'Value cannot be negative']
    },
    category: {
      type: String,
      enum: ['electronics', 'clothing', 'books', 'food', 'fragile', 'documents', 'other'],
      default: 'other'
    },
    isFragile: {
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
      uppercase: true
    }
  },
  payment: {
    method: {
      type: String,
      enum: ['cod', 'prepaid', 'card', 'wallet'],
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending'
    },
    transactionId: String,
    paidAt: Date,
    codAmount: Number // Cash on delivery amount
  },
  status: {
    type: String,
    enum: [
      'pending',           // Order created, waiting for pickup
      'confirmed',         // Order confirmed by merchant
      'pickup_scheduled',  // Pickup scheduled
      'picked_up',        // Items collected from merchant
      'in_transit',       // On the way to destination
      'out_for_delivery', // Out for final delivery
      'delivered',        // Successfully delivered
      'failed_delivery',  // Delivery attempt failed
      'returned',         // Returned to merchant
      'cancelled',        // Order cancelled
      'refunded'          // Order refunded
    ],
    default: 'pending'
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  serviceType: {
    type: String,
    enum: ['standard', 'express', 'same_day', 'next_day'],
    required: true,
    default: 'standard'
  },
  scheduledPickup: {
    date: Date,
    timeSlot: {
      start: String, // "09:00"
      end: String    // "17:00"
    }
  },
  scheduledDelivery: {
    date: Date,
    timeSlot: {
      start: String,
      end: String
    }
  },
  assignedHub: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hub'
  },
  tracking: {
    trackingNumber: {
      type: String,
      unique: true,
      sparse: true
    },
    currentLocation: {
      type: [Number], // [longitude, latitude]
      index: '2dsphere'
    },
    estimatedDelivery: Date,
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
      }
    }]
  },
  specialInstructions: String,
  internalNotes: String, // For admin/driver notes
  metadata: {
    source: {
      type: String,
      enum: ['web', 'mobile_app', 'shopify', 'woocommerce', 'api'],
      default: 'web'
    },
    sourceOrderId: String, // Original order ID from e-commerce platform
    tags: [String],
    customFields: mongoose.Schema.Types.Mixed
  },
  attempts: [{
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
      enum: ['success', 'failed', 'rescheduled'],
      required: true
    },
    reason: String,
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    notes: String,
    photo: String, // Photo evidence
    signature: String // Digital signature
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for total weight
orderSchema.virtual('totalWeight').get(function() {
  return this.items.reduce((total, item) => total + (item.weight * item.quantity), 0);
});

// Virtual for total items count
orderSchema.virtual('totalItems').get(function() {
  return this.items.reduce((total, item) => total + item.quantity, 0);
});

// Virtual for days since order
orderSchema.virtual('daysSinceOrder').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Indexes for better query performance
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ merchant: 1, status: 1 });
orderSchema.index({ customer: 1 });
orderSchema.index({ 'customerInfo.phone': 1 });
orderSchema.index({ 'tracking.trackingNumber': 1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ 'customerInfo.address.coordinates': '2dsphere' });
orderSchema.index({ 'pickupAddress.coordinates': '2dsphere' });
orderSchema.index({ createdAt: -1 });

// Pre-save middleware to generate order number and tracking number
orderSchema.pre('save', async function(next) {
  if (this.isNew) {
    // Generate order number
    if (!this.orderNumber) {
      const count = await mongoose.model('Order').countDocuments();
      this.orderNumber = `ORD${Date.now()}${(count + 1).toString().padStart(4, '0')}`;
    }
    
    // Generate tracking number
    if (!this.tracking.trackingNumber) {
      this.tracking.trackingNumber = `TRK${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    }
    
    // Add initial status to history
    this.tracking.statusHistory.push({
      status: this.status,
      timestamp: new Date(),
      notes: 'Order created'
    });
  }
  
  next();
});

// Pre-save middleware to update status history
orderSchema.pre('save', function(next) {
  if (this.isModified('status') && !this.isNew) {
    this.tracking.statusHistory.push({
      status: this.status,
      timestamp: new Date()
    });
  }
  next();
});

// Static method to find orders by status
orderSchema.statics.findByStatus = function(status, limit = 10) {
  return this.find({ status })
    .populate('merchant', 'firstName lastName email phone')
    .populate('customer', 'firstName lastName email phone')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static method to find orders in area
orderSchema.statics.findInArea = function(coordinates, radius = 5000) {
  return this.find({
    'customerInfo.address.coordinates': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: coordinates
        },
        $maxDistance: radius
      }
    }
  });
};

// Instance method to update status
orderSchema.methods.updateStatus = function(newStatus, notes, updatedBy) {
  this.status = newStatus;
  this.tracking.statusHistory.push({
    status: newStatus,
    timestamp: new Date(),
    notes,
    updatedBy
  });
  
  return this.save();
};

// Instance method to add delivery attempt
orderSchema.methods.addDeliveryAttempt = function(result, reason, driver, notes, photo, signature) {
  const attemptNumber = this.attempts.length + 1;
  
  this.attempts.push({
    attemptNumber,
    result,
    reason,
    driver,
    notes,
    photo,
    signature
  });
  
  return this.save();
};

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;