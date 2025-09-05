const mongoose = require('mongoose');

const hubSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Hub name is required'],
    trim: true,
    maxLength: [100, 'Hub name cannot exceed 100 characters']
  },
  code: {
    type: String,
    unique: true,
    required: true,
    uppercase: true
  },
  type: {
    type: String,
    enum: ['main', 'regional', 'local', 'pickup_point'],
    required: [true, 'Hub type is required'],
    default: 'local'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance', 'closed'],
    default: 'active'
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
      required: [true, 'Coordinates are required'],
      index: '2dsphere'
    }
  },
  contact: {
    phone: {
      type: String,
      required: [true, 'Contact phone is required']
    },
    email: {
      type: String,
      lowercase: true,
      trim: true
    },
    manager: {
      name: String,
      phone: String,
      email: String
    }
  },
  capacity: {
    storage: {
      type: Number,
      required: [true, 'Storage capacity is required'],
      min: [1, 'Storage capacity must be at least 1 cubic meter']
    },
    maxOrders: {
      type: Number,
      required: [true, 'Maximum orders capacity is required'],
      min: [1, 'Must handle at least 1 order']
    },
    currentLoad: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  operatingHours: {
    monday: {
      open: { type: String, default: '08:00' },
      close: { type: String, default: '20:00' },
      isOpen: { type: Boolean, default: true }
    },
    tuesday: {
      open: { type: String, default: '08:00' },
      close: { type: String, default: '20:00' },
      isOpen: { type: Boolean, default: true }
    },
    wednesday: {
      open: { type: String, default: '08:00' },
      close: { type: String, default: '20:00' },
      isOpen: { type: Boolean, default: true }
    },
    thursday: {
      open: { type: String, default: '08:00' },
      close: { type: String, default: '20:00' },
      isOpen: { type: Boolean, default: true }
    },
    friday: {
      open: { type: String, default: '08:00' },
      close: { type: String, default: '20:00' },
      isOpen: { type: Boolean, default: true }
    },
    saturday: {
      open: { type: String, default: '09:00' },
      close: { type: String, default: '18:00' },
      isOpen: { type: Boolean, default: true }
    },
    sunday: {
      open: { type: String, default: '10:00' },
      close: { type: String, default: '16:00' },
      isOpen: { type: Boolean, default: false }
    }
  },
  serviceArea: {
    // Geographic area served by this hub
    type: {
      type: String,
      enum: ['Polygon', 'Circle'],
      default: 'Circle'
    },
    coordinates: {
      type: mongoose.Schema.Types.Mixed, // Can be polygon coordinates or center point
      required: true
    },
    radius: {
      type: Number, // in meters, used when type is 'Circle'
      default: 10000
    }
  },
  facilities: {
    coldStorage: {
      type: Boolean,
      default: false
    },
    fragileHandling: {
      type: Boolean,
      default: true
    },
    largeItemHandling: {
      type: Boolean,
      default: true
    },
    "24HourOperation": {
      type: Boolean,
      default: false
    },
    parkingSpaces: {
      type: Number,
      default: 10
    },
    loadingDocks: {
      type: Number,
      default: 2
    }
  },
  assignedDrivers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver'
  }],
  currentOrders: [{
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order'
    },
    status: {
      type: String,
      enum: ['incoming', 'processing', 'ready_for_pickup', 'out_for_delivery'],
      default: 'incoming'
    },
    arrivedAt: {
      type: Date,
      default: Date.now
    },
    processedAt: Date,
    assignedDriver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver'
    }
  }],
  performance: {
    stats: {
      totalProcessed: {
        type: Number,
        default: 0
      },
      avgProcessingTime: {
        type: Number, // in minutes
        default: 0
      },
      onTimeDeliveryRate: {
        type: Number, // percentage
        default: 100
      },
      currentMonthProcessed: {
        type: Number,
        default: 0
      }
    },
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
    }
  },
  pricing: {
    baseRate: {
      type: Number,
      default: 0,
      min: 0
    },
    perKmRate: {
      type: Number,
      default: 2,
      min: 0
    },
    expressMultiplier: {
      type: Number,
      default: 1.5,
      min: 1
    },
    sameDay: {
      type: Number,
      default: 50,
      min: 0
    }
  },
  equipment: [{
    name: String,
    type: {
      type: String,
      enum: ['scanner', 'scale', 'printer', 'computer', 'vehicle', 'other']
    },
    status: {
      type: String,
      enum: ['operational', 'maintenance', 'broken'],
      default: 'operational'
    },
    lastMaintenance: Date
  }],
  notifications: [{
    type: {
      type: String,
      enum: ['alert', 'warning', 'info'],
      required: true
    },
    message: {
      type: String,
      required: true
    },
    isRead: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium'
    }
  }],
  metadata: {
    establishedDate: {
      type: Date,
      default: Date.now
    },
    lastUpdate: {
      type: Date,
      default: Date.now
    },
    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for capacity utilization
hubSchema.virtual('capacityUtilization').get(function() {
  return (this.capacity.currentLoad / this.capacity.maxOrders) * 100;
});

// Virtual for available capacity
hubSchema.virtual('availableCapacity').get(function() {
  return this.capacity.maxOrders - this.capacity.currentLoad;
});

// Virtual for current status based on operating hours
hubSchema.virtual('isCurrentlyOpen').get(function() {
  const now = new Date();
  const currentDay = now.toLocaleDateString('en-US', { weekday: 'lowercase' });
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
  
  const todayHours = this.operatingHours[currentDay];
  if (!todayHours || !todayHours.isOpen) return false;
  
  return currentTime >= todayHours.open && currentTime <= todayHours.close;
});

// Indexes
hubSchema.index({ code: 1 });
hubSchema.index({ type: 1, status: 1 });
hubSchema.index({ 'address.coordinates': '2dsphere' });
hubSchema.index({ 'address.city': 1 });
hubSchema.index({ status: 1 });

// Pre-save middleware to generate hub code
hubSchema.pre('save', async function(next) {
  if (this.isNew && !this.code) {
    const count = await mongoose.model('Hub').countDocuments();
    const typePrefix = this.type.charAt(0).toUpperCase();
    this.code = `HUB${typePrefix}${(count + 1).toString().padStart(4, '0')}`;
  }
  
  // Update metadata
  if (this.isModified() && !this.isNew) {
    this.metadata.lastUpdate = new Date();
  }
  
  next();
});

// Static method to find nearest hub
hubSchema.statics.findNearestHub = function(coordinates, type = null) {
  let query = {
    status: 'active',
    'address.coordinates': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: coordinates
        }
      }
    }
  };
  
  if (type) {
    query.type = type;
  }
  
  return this.findOne(query);
};

// Static method to find hubs with capacity
hubSchema.statics.findAvailableHubs = function(coordinates, requiredCapacity = 1) {
  return this.find({
    status: 'active',
    $expr: {
      $gte: [
        { $subtract: ['$capacity.maxOrders', '$capacity.currentLoad'] },
        requiredCapacity
      ]
    },
    'address.coordinates': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: coordinates
        }
      }
    }
  }).limit(5);
};

// Instance method to add order
hubSchema.methods.addOrder = function(orderId, driverId = null) {
  if (this.capacity.currentLoad >= this.capacity.maxOrders) {
    throw new Error('Hub has reached maximum capacity');
  }
  
  this.currentOrders.push({
    order: orderId,
    status: 'incoming',
    assignedDriver: driverId
  });
  
  this.capacity.currentLoad += 1;
  return this.save();
};

// Instance method to process order
hubSchema.methods.processOrder = function(orderId, status = 'processing') {
  const orderIndex = this.currentOrders.findIndex(
    order => order.order.toString() === orderId.toString()
  );
  
  if (orderIndex === -1) {
    throw new Error('Order not found in hub');
  }
  
  this.currentOrders[orderIndex].status = status;
  if (status === 'processing') {
    this.currentOrders[orderIndex].processedAt = new Date();
  }
  
  return this.save();
};

// Instance method to complete order
hubSchema.methods.completeOrder = function(orderId) {
  this.currentOrders.pull({ order: orderId });
  this.capacity.currentLoad -= 1;
  this.performance.stats.totalProcessed += 1;
  this.performance.stats.currentMonthProcessed += 1;
  
  return this.save();
};

// Instance method to assign driver
hubSchema.methods.assignDriver = function(driverId) {
  if (!this.assignedDrivers.includes(driverId)) {
    this.assignedDrivers.push(driverId);
  }
  return this.save();
};

// Instance method to remove driver
hubSchema.methods.removeDriver = function(driverId) {
  this.assignedDrivers.pull(driverId);
  return this.save();
};

// Instance method to add notification
hubSchema.methods.addNotification = function(type, message, priority = 'medium') {
  this.notifications.push({
    type,
    message,
    priority
  });
  
  // Keep only last 50 notifications
  if (this.notifications.length > 50) {
    this.notifications = this.notifications.slice(-50);
  }
  
  return this.save();
};

// Instance method to check if point is in service area
hubSchema.methods.isInServiceArea = function(coordinates) {
  if (this.serviceArea.type === 'Circle') {
    const hubCoords = this.address.coordinates;
    const distance = this.calculateDistance(hubCoords, coordinates);
    return distance <= this.serviceArea.radius;
  }
  
  // For polygon, would need more complex point-in-polygon calculation
  // For now, return true
  return true;
};

// Helper method to calculate distance
hubSchema.methods.calculateDistance = function(coords1, coords2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = coords1[1] * Math.PI/180;
  const φ2 = coords2[1] * Math.PI/180;
  const Δφ = (coords2[1]-coords1[1]) * Math.PI/180;
  const Δλ = (coords2[0]-coords1[0]) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
};

const Hub = mongoose.model('Hub', hubSchema);

module.exports = Hub;