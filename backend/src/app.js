const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { MongoMemoryServer } = require('mongodb-memory-server');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/authRoutes');
const orderRoutes = require('./routes/orderRoutes');
const shipmentRoutes = require('./routes/shipmentRoutes');
const driverRoutes = require('./routes/driverRoutes');
const hubRoutes = require('./routes/hubRoutes');
const merchantRoutes = require('./routes/merchantRoutes');
const webhookRoutes = require('./routes/webhookRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware with relaxed CSP for development
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com', 'https://admin.yourdomain.com']
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// MongoDB connection with fallback
async function connectDB() {
  try {
    if (process.env.MONGODB_URI) {
      await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      console.log('✅ Connected to MongoDB');
    } else {
      throw new Error('No MONGODB_URI found');
    }
  } catch (err) {
    console.error('⚠️ MongoDB connection error:', err.message);
    console.log('➡️ Falling back to in-memory MongoDB...');
    const mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ In-memory MongoDB started');
  }
}
connectDB();

// Root route
app.get('/', (req, res) => {
  res.json({
    message: '🚚 Shipping System API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      auth: '/api/auth/*',
      orders: '/api/orders/*',
      drivers: '/api/drivers/*',
      hubs: '/api/hubs/*',
      merchants: '/api/merchants/*',
      test: '/test-ui'
    },
    documentation: 'Visit /test-ui for interactive API testing'
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/shipments', shipmentRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/hubs', hubRoutes);
app.use('/api/merchants', merchantRoutes);
app.use('/api/webhooks', webhookRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Interactive API Test UI
app.get('/test-ui', (req, res) => {
  res.send(`
    // Your existing HTML + add these new sections:
    
    <div class="section">
      <h3>📦 Order Management</h3>
      <input type="text" id="orderCustomerName" placeholder="Customer Name" value="Ahmed Hassan">
      <input type="tel" id="orderCustomerPhone" placeholder="Phone" value="+201234567890">
      <input type="email" id="orderCustomerEmail" placeholder="Email" value="ahmed@example.com">
      <br>
      <input type="text" id="orderItemName" placeholder="Item Name" value="iPhone 15">
      <input type="number" id="orderQuantity" placeholder="Quantity" value="1">
      <input type="number" id="orderWeight" placeholder="Weight (kg)" value="0.2">
      <input type="number" id="orderValue" placeholder="Value (EGP)" value="25000">
      <br>
      <button onclick="createOrder()" disabled id="createOrderBtn">Create Order (Login Required)</button>
      <div id="orderResult" class="result">Login as merchant to create orders</div>
    </div>
    
    <div class="section">
      <h3>📋 View Orders</h3>
      <button onclick="getMyOrders()" disabled id="getOrdersBtn">Get My Orders</button>
      <button onclick="getAllOrders()" disabled id="getAllOrdersBtn">Get All Orders (Admin)</button>
      <div id="ordersResult" class="result">Login to view orders</div>
    </div>
    
    // Add these JavaScript functions:
    
    async function createOrder() {
      const orderData = {
        customerInfo: {
          name: document.getElementById('orderCustomerName').value,
          phone: document.getElementById('orderCustomerPhone').value,
          email: document.getElementById('orderCustomerEmail').value,
          address: {
            street: "123 Test Street",
            city: "Cairo",
            coordinates: [31.2357, 30.0444]
          }
        },
        pickupAddress: {
          street: "456 Merchant Street",
          city: "Cairo", 
          coordinates: [31.2400, 30.0500]
        },
        items: [{
          name: document.getElementById('orderItemName').value,
          quantity: parseInt(document.getElementById('orderQuantity').value),
          weight: parseFloat(document.getElementById('orderWeight').value),
          value: parseFloat(document.getElementById('orderValue').value),
          category: "electronics"
        }],
        pricing: {
          subtotal: parseFloat(document.getElementById('orderValue').value),
          shippingCost: 50,
          total: parseFloat(document.getElementById('orderValue').value) + 50
        },
        payment: {
          method: "cod"
        },
        serviceType: "standard",
        priority: "normal"
      };

      const result = await apiCall('/api/orders', 'POST', orderData, true);
      displayResult('orderResult', result);
    }

    async function getMyOrders() {
      const result = await apiCall('/api/orders', 'GET', null, true);
      displayResult('ordersResult', result);
    }

    async function getAllOrders() {
      const result = await apiCall('/api/orders?all=true', 'GET', null, true);
      displayResult('ordersResult', result);
    }
    
    // Update the updateAuthState function to enable order buttons:
    function updateAuthState(token) {
      authToken = token;
      const hasAuth = !!token;
      
      // Enable/disable all auth-required buttons
      document.getElementById('profileBtn').disabled = !hasAuth;
      document.getElementById('updateBtn').disabled = !hasAuth;
      document.getElementById('createOrderBtn').disabled = !hasAuth;
      document.getElementById('getOrdersBtn').disabled = !hasAuth;
      document.getElementById('getAllOrdersBtn').disabled = !hasAuth;
      
      const tokenDisplay = document.getElementById('tokenDisplay');
      if (hasAuth) {
        tokenDisplay.style.display = 'block';
        tokenDisplay.textContent = 'Auth Token: ' + token.substring(0, 50) + '...';
      } else {
        tokenDisplay.style.display = 'none';
      }
    }
  `);
});

// 404
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    availableRoutes: {
      root: '/',
      health: '/health',
      testUI: '/test-ui',
      auth: '/api/auth/*',
      orders: '/api/orders/*'
    }
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  mongoose.connection.close(() => {
    console.log('MongoDB connection closed');
    process.exit(0);
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🧪 Test Interface: http://localhost:${PORT}/test-ui`);
    console.log(`📊 API Documentation: http://localhost:${PORT}/`);
  });
}

module.exports = app;