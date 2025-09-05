const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  driverCode: {
    type: String,
    unique: true,
    required: true,
    uppercase: true
  },
  license: {
    number: {
      type: String,
      required: [true, 'License number is required'],
      unique: true
    },
    expiryDate: {
      type: Date,
      required: [true, 'License expiry date is required']
    },
    category: {
      type: String,
      enum: ['motorcycle', 'car', 'van', 'truck'],
      required: true
    }
  },
  vehicle: {
    type: {
      type: String,
      enum: ['motorcycle', 'car', 'van', 'truck'],
      required: [true, 'Vehicle type is required']
    },
    make: {
      type: String,
      required: [true, 'Vehicle make is required']
    },
    model: {
      type: String,
      required: [true, 'Vehicle model is required']
    },
    year: {
      type: Number,
      required: [true, 'Vehicle year is required'],
      min: 1980,
      max: new Date().getFullYear() + 1
    },
    plateNumber: {
      type: String,
      required: [true, 'Vehicle plate number is required'],
      unique: true,
      uppercase: true
    },
    color: String,
    capacity: {
      weight: {
        type: Number,
        required: [true, 'Vehicle weight capacity is required'],
        min: 1
      },
      volume: {
        type: Number,
        required: [true, 'Vehicle volume capacity is required'],
        min: 1
      }
    },
    insurance: {
      policyNumber: {
        type: String,
        required: [true, 'Insurance policy number is required']
      },
      expiryDate: {
        type: Date,
        required: [true, 'Insurance expiry date is required']
      },
      provider: String
    }
  },
  documents: {
    profilePhoto: {
      type: String,
      required: [true, 'Profile photo is required']
    },
    licensePhoto: {
      type: String,
      required: [true, 'License photo is required']
    },
    vehicleRegistration: {
      type: String,
      required: [true, 'Vehicle registration document is required']
    },
    insuranceDocument: {
      type: String,
      required: [true, 'Insurance document is required']
    },
    backgroundCheck: {
      type: String,
      status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
      },
      completedAt: Date
    }
  },
  status: {
    type: String,
    enum: ['inactive', 'available', 'busy', 'on_break', 'offline'],
    default: 'inactive'
  },
  verification: {
    status: {
      type: String,
      enum: ['pending', 'in_review', 'approved', 'rejected'],
      default: 'pending'
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: Date,
    notes: String
  },
  currentLocation: {
    type: [Number], // [longitude, latitude]
    index: '2dsphere'
  },
  workingArea: {
    // Geographic area where driver operates
    type: {
      type: String,
      enum: ['Polygon'],
      default: 'Polygon'
    },
    coordinates: {
      type: [[[Number]]], // Array of arrays of coordinates
      required: true
    }
  },
  assignedHub: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hub'
  },
  activeDeliveries: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  }],
  workSchedule: {
    monday: {
      available: { type: Boolean, default: true },
      startTime: { type: String, default: '09:00' },
      endTime: { type: String, default: '18:00' }
    },
    tuesday: {
      available: { type: Boolean, default: true },
      startTime: { type: String, default: '09:00' },
      endTime: { type: String, default: '18:00' }
    },
    wednesday: {
      available: { type: Boolean, default: true },
      startTime: { type: String, default: '09:00' },
      endTime: { type: String, default: '18:00' }
    },
    thursday: {
      available: { type: Boolean, default: true },
      startTime: { type: String, default: '09:00' },
      endTime: { type: String, default: '18:00' }
    },
    friday: {
      available: { type: Boolean, default: true },
      startTime: { type: String, default: '09:00' },
      endTime: { type: String, default: '18:00' }
    },
    saturday: {
      available: { type: Boolean, default: false },
      startTime: { type: String, default: '09:00' },
      endTime: { type: String, default: '14:00' }
    },
    sunday: {
      available: { type: Boolean, default: false },
      startTime: { type: String, default: '09:00' },
      endTime: { type: String, default: '14:00' }
    }
  },
  performance: {
    rating: {
      average: {
        type: Number,
        default: 5.0,
        min: 1,
        max: 5
      },
      count: {
        type: Number,
        default: 0
      }
    },
    stats: {
      totalDeliveries: {
        type: Number,
        default: 0
      },
      successfulDeliveries: {
        type: Number,
        default: 0
      },
      failedDeliveries: {
        type: Number,
        default: 0
      },
      averageDeliveryTime: {
        type: Number, // in minutes
        default: 0
      },
      onTimeDeliveryRate: {
        type: Number, // percentage
        default: 100
      }
    },
    currentMonth: {
      deliveries: {
        type: Number,
        default: 0
      },
      earnings: {
        type: Number,
        default: 0
      },
      workingHours: {
        type: Number,
        default: 0
      }
    }
  },
  earnings: {
    total: {
      type: Number,
      default: 0
    },
    pending: {
      type: Number,
      default: 0
    },
    paid: {
      type: Number,
      default: 0
    },
    commission: {
      type: Number,
      default: 0.1, // 10% commission
      min: 0,
      max: 1
    }
  },
  emergencyContact: {
    name: {
      type: String,
      required: [true, 'Emergency contact name is required']
    },
    phone: {
      type: String,
      required: [true, 'Emergency contact phone is required']
    },
    relationship: String
  },
  preferences: {
    maxDeliveries: {
      type: Number,
      default: 10,
      min: 1,
      max: 50
    },
    maxDistance: {
      type: Number,
      default: 20, // km
      min: 1,
      max: 100
    },
    autoAcceptOrders: {
      type: Boolean,
      default: false
    },
    notifications: {
      newOrder: {
        type: Boolean,
        default: true
      },
      orderUpdate: {
        type: Boolean,
        default: true
      },
      payment: {
        type: Boolean,
        default: true
      }
    }
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  notes: String, // Admin notes
  metadata: {
    joinedAt: {
      type: Date,
      default: Date.now
    },
    lastLocationUpdate: Date,
    deviceInfo: {
      platform: String,
      version: String,
      deviceId: String
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for success rate
driverSchema.virtual('successRate').get(function() {
  if (this.performance.stats.totalDeliveries === 0) return 100;
  return (this.performance.stats.successfulDeliveries / this.performance.stats.totalDeliveries) * 100;
});

// Virtual for current load
driverSchema.virtual('currentLoad').get(function() {
  return this.activeDeliveries.length;
});

// Virtual for available capacity
driverSchema.virtual('availableCapacity').get(function() {
  return this.preferences.maxDeliveries - this.activeDeliveries.length;
});

// Indexes
driverSchema.index({ user: 1 });
driverSchema.index({ driverCode: 1 });
driverSchema.index({ status: 1 });
driverSchema.index({ 'verification.status': 1 });
driverSchema.index({ currentLocation: '2dsphere' });
driverSchema.index({ assignedHub: 1 });
driverSchema.index({ 'license.number': 1 });
driverSchema.index({ 'vehicle.plateNumber': 1 });

// Pre-save middleware to generate driver code
driverSchema.pre('save', async function(next) {
  if (this.isNew && !this.driverCode) {
    const count = await mongoose.model('Driver').countDocuments();
    this.driverCode = `DRV${(count + 1).toString().padStart(6, '0')}`;
  }
  next();
});

// Static method to find available drivers
driverSchema.statics.findAvailableDrivers = function(coordinates, maxDistance = 5000) {
  return this.find({
    status: 'available',
    'verification.status': 'approved',
    currentLocation: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: coordinates
        },
        $maxDistance: maxDistance
      }
    }
  })
  .populate('user', 'firstName lastName phone')
  .populate('assignedHub', 'name address');
};

// Instance method to update location
driverSchema.methods.updateLocation = function(coordinates) {
  this.currentLocation = coordinates;
  this.metadata.lastLocationUpdate = new Date();
  this.lastSeen = new Date();
  return this.save();
};

// Instance method to assign order
driverSchema.methods.assignOrder = function(orderId) {
  if (this.activeDeliveries.length >= this.preferences.maxDeliveries) {
    throw new Error('Driver has reached maximum delivery capacity');
  }
  
  if (!this.activeDeliveries.includes(orderId)) {
    this.activeDeliveries.push(orderId);
    this.status = 'busy';
  }
  
  return this.save();
};

// Instance method to complete delivery
driverSchema.methods.completeDelivery = function(orderId, successful = true) {
  this.activeDeliveries.pull(orderId);
  
  // Update performance stats
  this.performance.stats.totalDeliveries += 1;
  this.performance.currentMonth.deliveries += 1;
  
  if (successful) {
    this.performance.stats.successfulDeliveries += 1;
  } else {
    this.performance.stats.failedDeliveries += 1;
  }
  
  // If no more active deliveries, set status to available
  if (this.activeDeliveries.length === 0) {
    this.status = 'available';
  }
  
  return this.save();
};

// Instance method to calculate earnings
driverSchema.methods.calculateEarnings = function(deliveryFee) {
  const commission = deliveryFee * this.earnings.commission;
  const driverEarning = deliveryFee - commission;
  
  this.earnings.pending += driverEarning;
  this.earnings.total += driverEarning;
  this.performance.currentMonth.earnings += driverEarning;
  
  return this.save();
};

const Driver = mongoose.model('Driver', driverSchema);

module.exports = Driver;