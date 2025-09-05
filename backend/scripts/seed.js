const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const User = require('../src/models/User');
const Order = require('../src/models/Order');
const Driver = require('../src/models/Driver');
const Hub = require('../src/models/Hub');

// Cairo coordinates and areas for realistic data
const cairoAreas = [
  { name: 'Downtown Cairo', coords: [31.2357, 30.0444] },
  { name: 'Nasr City', coords: [31.3243, 30.0626] },
  { name: 'Maadi', coords: [31.2536, 29.9601] },
  { name: 'Heliopolis', coords: [31.3208, 30.0882] },
  { name: 'Zamalek', coords: [31.2225, 30.0617] },
  { name: 'New Cairo', coords: [31.4739, 29.9869] },
  { name: 'Giza', coords: [31.2001, 30.0131] },
  { name: '6th of October', coords: [31.0539, 29.9097] }
];

const egyptianNames = {
  male: ['Ahmed', 'Mohamed', 'Omar', 'Hassan', 'Ali', 'Mahmoud', 'Youssef', 'Khaled', 'Amr', 'Tarek'],
  female: ['Fatma', 'Aisha', 'Sara', 'Mariam', 'Nour', 'Yasmin', 'Heba', 'Dina', 'Rania', 'Salma'],
  surnames: ['Hassan', 'Mohamed', 'Ali', 'Ahmed', 'Mahmoud', 'Ibrahim', 'Youssef', 'Abdel Rahman', 'El Sayed', 'Farouk']
};

const sampleProducts = [
  { name: 'iPhone 14', category: 'electronics', price: 25000, weight: 0.2 },
  { name: 'Samsung TV 55"', category: 'electronics', price: 15000, weight: 20 },
  { name: 'Nike Sneakers', category: 'clothing', price: 3000, weight: 0.8 },
  { name: 'MacBook Pro', category: 'electronics', price: 45000, weight: 2 },
  { name: 'Coffee Machine', category: 'electronics', price: 8000, weight: 5 },
  { name: 'Books Set', category: 'books', price: 500, weight: 2 },
  { name: 'Perfume', category: 'fragile', price: 1200, weight: 0.3 },
  { name: 'Tablet', category: 'electronics', price: 8000, weight: 0.5 }
];

class DatabaseSeeder {
  constructor() {
    this.users = [];
    this.drivers = [];
    this.hubs = [];
    this.orders = [];
  }

  async connect() {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('Connected to MongoDB');
    } catch (error) {
      console.error('MongoDB connection error:', error);
      process.exit(1);
    }
  }

  async clearDatabase() {
    console.log('Clearing existing data...');
    await Promise.all([
      User.deleteMany({}),
      Order.deleteMany({}),
      Driver.deleteMany({}),
      Hub.deleteMany({})
    ]);
    console.log('Database cleared successfully');
  }

  generateRandomName(gender = null) {
    const genderChoice = gender || (Math.random() > 0.5 ? 'male' : 'female');
    const firstName = egyptianNames[genderChoice][Math.floor(Math.random() * egyptianNames[genderChoice].length)];
    const lastName = egyptianNames.surnames[Math.floor(Math.random() * egyptianNames.surnames.length)];
    return { firstName, lastName, gender: genderChoice };
  }

  generateRandomPhone() {
    const prefixes = ['010', '011', '012', '015'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const number = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
    return `+2${prefix}${number}`;
  }

  generateRandomAddress() {
    const area = cairoAreas[Math.floor(Math.random() * cairoAreas.length)];
    const streetNumber = Math.floor(Math.random() * 200) + 1;
    const streetName = ['El Tahrir', 'El Nasr', 'El Gomhoria', 'El Nil', 'El Azhar'][Math.floor(Math.random() * 5)];
    
    return {
      street: `${streetNumber} ${streetName} Street`,
      city: area.name,
      state: 'Cairo',
      zipCode: `1${Math.floor(Math.random() * 9000) + 1000}`,
      country: 'Egypt',
      coordinates: [
        area.coords[0] + (Math.random() - 0.5) * 0.02, // Small random offset
        area.coords[1] + (Math.random() - 0.5) * 0.02
      ]
    };
  }

  async createUsers() {
    console.log('Creating users...');

    // Hash password for admin
    const hashedAdminPassword = await bcrypt.hash('Admin123!@#', 12);

    // Create admin user
    const admin = await User.create({
      firstName: 'Admin',
      lastName: 'System',
      email: 'admin@shippingsystem.com',
      phone: '+201000000000',
      password: hashedAdminPassword,
      role: 'admin',
      isEmailVerified: true,
      isPhoneVerified: true,
      address: this.generateRandomAddress()
    });
    this.users.push(admin);
    console.log('✓ Admin user created');

    // Create merchants
    const hashedMerchantPassword = await bcrypt.hash('Merchant123!', 12);
    for (let i = 1; i <= 10; i++) {
      const name = this.generateRandomName();
      const merchant = await User.create({
        firstName: name.firstName,
        lastName: name.lastName,
        email: `merchant${i}@example.com`,
        phone: this.generateRandomPhone(),
        password: hashedMerchantPassword,
        role: 'merchant',
        isEmailVerified: true,
        address: this.generateRandomAddress()
      });
      this.users.push(merchant);
    }
    console.log('✓ 10 merchants created');

    // Create drivers (will create Driver documents separately)
    const hashedDriverPassword = await bcrypt.hash('Driver123!', 12);
    for (let i = 1; i <= 15; i++) {
      const name = this.generateRandomName('male'); // Assuming male drivers for this demo
      const driver = await User.create({
        firstName: name.firstName,
        lastName: name.lastName,
        email: `driver${i}@example.com`,
        phone: this.generateRandomPhone(),
        password: hashedDriverPassword,
        role: 'driver',
        isEmailVerified: true,
        address: this.generateRandomAddress()
      });
      this.users.push(driver);
    }
    console.log('✓ 15 drivers created');

    // Create customers
    const hashedCustomerPassword = await bcrypt.hash('Customer123!', 12);
    for (let i = 1; i <= 50; i++) {
      const name = this.generateRandomName();
      const customer = await User.create({
        firstName: name.firstName,
        lastName: name.lastName,
        email: `customer${i}@example.com`,
        phone: this.generateRandomPhone(),
        password: hashedCustomerPassword,
        role: 'customer',
        isEmailVerified: Math.random() > 0.3, // 70% verified
        address: this.generateRandomAddress()
      });
      this.users.push(customer);
    }
    console.log('✓ 50 customers created');
  }

  async createHubs() {
    console.log('Creating hubs...');

    const hubTypes = ['main', 'regional', 'local', 'pickup_point'];
    const hubNames = ['Central Hub', 'North Hub', 'South Hub', 'East Hub', 'West Hub', 'Express Center', 'Quick Point', 'City Hub'];

    for (let i = 0; i < 8; i++) {
      const area = cairoAreas[i];
      const hub = await Hub.create({
        name: `${area.name} - ${hubNames[i]}`,
        type: hubTypes[Math.floor(Math.random() * hubTypes.length)],
        status: 'active',
        address: {
          street: `Hub Complex, ${area.name}`,
          city: area.name,
          state: 'Cairo',
          zipCode: `1${Math.floor(Math.random() * 9000) + 1000}`,
          country: 'Egypt',
          coordinates: area.coords
        },
        contact: {
          phone: this.generateRandomPhone(),
          email: `${area.name.toLowerCase().replace(' ', '')}@shippingsystem.com`,
          manager: {
            name: `${this.generateRandomName().firstName} ${this.generateRandomName().lastName}`,
            phone: this.generateRandomPhone(),
            email: `manager${i}@shippingsystem.com`
          }
        },
        capacity: {
          storage: Math.floor(Math.random() * 500) + 200,
          maxOrders: Math.floor(Math.random() * 100) + 50,
          currentLoad: Math.floor(Math.random() * 20)
        },
        serviceArea: {
          type: 'Circle',
          coordinates: area.coords,
          radius: 5000 + Math.floor(Math.random() * 5000)
        },
        facilities: {
          coldStorage: Math.random() > 0.7,
          fragileHandling: true,
          largeItemHandling: Math.random() > 0.3,
          "24HourOperation": Math.random() > 0.6, // Fixed property name
          parkingSpaces: Math.floor(Math.random() * 20) + 5,
          loadingDocks: Math.floor(Math.random() * 5) + 1
        }
      });
      this.hubs.push(hub);
    }
    console.log('✓ 8 hubs created');
  }

  async createDriverProfiles() {
    console.log('Creating driver profiles...');

    const driverUsers = this.users.filter(user => user.role === 'driver');
    const vehicleTypes = ['motorcycle', 'car', 'van'];
    const vehicleMakes = {
      motorcycle: ['Honda', 'Yamaha', 'Suzuki'],
      car: ['Toyota', 'Hyundai', 'Nissan', 'Chevrolet'],
      van: ['Ford', 'Mercedes', 'Iveco']
    };

    for (let i = 0; i < driverUsers.length; i++) {
      const driverUser = driverUsers[i];
      const vehicleType = vehicleTypes[Math.floor(Math.random() * vehicleTypes.length)];
      const makes = vehicleMakes[vehicleType];
      const make = makes[Math.floor(Math.random() * makes.length)];
      
      // Assign driver to a random hub
      const assignedHub = this.hubs[Math.floor(Math.random() * this.hubs.length)];

      const driver = await Driver.create({
        user: driverUser._id,
        license: {
          number: `L${Math.floor(Math.random() * 1000000)}`,
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
          category: vehicleType
        },
        vehicle: {
          type: vehicleType,
          make,
          model: `Model-${Math.floor(Math.random() * 20) + 2010}`,
          year: Math.floor(Math.random() * 10) + 2015,
          plateNumber: `${Math.floor(Math.random() * 999).toString().padStart(3, '0')} ABC`,
          color: ['White', 'Black', 'Silver', 'Blue', 'Red'][Math.floor(Math.random() * 5)],
          capacity: {
            weight: vehicleType === 'motorcycle' ? 20 : vehicleType === 'car' ? 200 : 500,
            volume: vehicleType === 'motorcycle' ? 50 : vehicleType === 'car' ? 200 : 800
          },
          insurance: {
            policyNumber: `INS${Math.floor(Math.random() * 100000)}`,
            expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            provider: 'Cairo Insurance Co.'
          }
        },
        documents: {
          profilePhoto: '/uploads/drivers/profile-placeholder.jpg',
          licensePhoto: '/uploads/drivers/license-placeholder.jpg',
          vehicleRegistration: '/uploads/drivers/registration-placeholder.jpg',
          insuranceDocument: '/uploads/drivers/insurance-placeholder.jpg',
          backgroundCheck: '/uploads/drivers/background-placeholder.pdf'
        },
        status: ['available', 'busy', 'offline'][Math.floor(Math.random() * 3)],
        verification: {
          status: 'approved',
          approvedBy: this.users.find(u => u.role === 'admin')._id,
          approvedAt: new Date()
        },
        currentLocation: [
          driverUser.address.coordinates[0] + (Math.random() - 0.5) * 0.01,
          driverUser.address.coordinates[1] + (Math.random() - 0.5) * 0.01
        ],
        assignedHub: assignedHub._id,
        performance: {
          rating: {
            average: Math.round((Math.random() * 2 + 3) * 10) / 10, // 3.0 to 5.0
            count: Math.floor(Math.random() * 100) + 10
          },
          stats: {
            totalDeliveries: Math.floor(Math.random() * 500) + 50,
            successfulDeliveries: Math.floor(Math.random() * 450) + 45,
            failedDeliveries: Math.floor(Math.random() * 10),
            averageDeliveryTime: Math.floor(Math.random() * 30) + 20
          }
        },
        emergencyContact: {
          name: `${this.generateRandomName().firstName} ${this.generateRandomName().lastName}`,
          phone: this.generateRandomPhone(),
          relationship: ['spouse', 'parent', 'sibling'][Math.floor(Math.random() * 3)]
        }
      });

      this.drivers.push(driver);
      
      // Add driver to hub using direct update instead of non-existent method
      await Hub.findByIdAndUpdate(
        assignedHub._id,
        { $addToSet: { drivers: driver._id } }
      );
    }
    console.log('✓ 15 driver profiles created');
  }

  async createOrders() {
    console.log('Creating orders...');

    const merchants = this.users.filter(user => user.role === 'merchant');
    const customers = this.users.filter(user => user.role === 'customer');
    const statuses = ['pending', 'confirmed', 'pickup_scheduled', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled'];
    const priorities = ['low', 'normal', 'high'];
    const serviceTypes = ['standard', 'express', 'same_day', 'next_day'];

    for (let i = 1; i <= 100; i++) {
      const merchant = merchants[Math.floor(Math.random() * merchants.length)];
      const customer = Math.random() > 0.3 ? customers[Math.floor(Math.random() * customers.length)] : null;
      const hub = this.hubs[Math.floor(Math.random() * this.hubs.length)];
      
      // Generate random items
      const numItems = Math.floor(Math.random() * 3) + 1;
      const items = [];
      let subtotal = 0;

      for (let j = 0; j < numItems; j++) {
        const product = sampleProducts[Math.floor(Math.random() * sampleProducts.length)];
        const quantity = Math.floor(Math.random() * 3) + 1;
        const item = {
          name: product.name,
          description: `${product.name} - Premium quality`,
          sku: `SKU${Math.floor(Math.random() * 10000)}`,
          quantity,
          weight: product.weight,
          value: product.price,
          category: product.category,
          isFragile: product.category === 'fragile' || product.category === 'electronics'
        };
        items.push(item);
        subtotal += product.price * quantity;
      }

      const shippingCost = Math.floor(Math.random() * 100) + 50;
      const total = subtotal + shippingCost;

      // Generate customer info (either from registered customer or as guest)
      const customerInfo = customer ? {
        name: `${customer.firstName} ${customer.lastName}`,
        phone: customer.phone,
        email: customer.email,
        address: customer.address
      } : {
        name: `${this.generateRandomName().firstName} ${this.generateRandomName().lastName}`,
        phone: this.generateRandomPhone(),
        email: `guest${i}@example.com`,
        address: this.generateRandomAddress()
      };

      const order = await Order.create({
        merchant: merchant._id,
        customer: customer?._id,
        customerInfo,
        pickupAddress: merchant.address,
        deliveryAddress: customerInfo.address,
        items,
        pricing: {
          subtotal,
          shipping: shippingCost,
          taxes: Math.floor(total * 0.14), // 14% tax
          total: total + Math.floor(total * 0.14)
        },
        payment: {
          method: ['cod', 'prepaid', 'card'][Math.floor(Math.random() * 3)],
          status: ['pending', 'paid', 'failed'][Math.floor(Math.random() * 3)]
        },
        status: statuses[Math.floor(Math.random() * statuses.length)],
        priority: priorities[Math.floor(Math.random() * priorities.length)],
        serviceType: serviceTypes[Math.floor(Math.random() * serviceTypes.length)],
        assignedHub: hub._id,
        scheduledPickup: {
          date: new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000), // Within next 7 days
          timeSlot: {
            start: '09:00',
            end: '17:00'
          }
        },
        specialInstructions: Math.random() > 0.7 ? 'Please handle with care and call before delivery' : undefined,
        metadata: {
          source: ['web', 'mobile_app', 'shopify', 'api'][Math.floor(Math.random() * 4)]
        }
      });

      this.orders.push(order);

      // Add order to hub using direct update instead of non-existent method
      if (Math.random() > 0.5) {
        await Hub.findByIdAndUpdate(
          hub._id,
          { $addToSet: { currentOrders: order._id } }
        );
      }
    }
    console.log('✓ 100 orders created');
  }

  async run() {
    try {
      await this.connect();
      await this.clearDatabase();
      
      await this.createUsers();
      await this.createHubs();
      await this.createDriverProfiles();
      await this.createOrders();

      console.log('\n🎉 Database seeding completed successfully!');
      console.log('\n📊 Summary:');
      console.log(`   Users: ${this.users.length}`);
      console.log(`   - Admin: 1`);
      console.log(`   - Merchants: ${this.users.filter(u => u.role === 'merchant').length}`);
      console.log(`   - Drivers: ${this.users.filter(u => u.role === 'driver').length}`);
      console.log(`   - Customers: ${this.users.filter(u => u.role === 'customer').length}`);
      console.log(`   Hubs: ${this.hubs.length}`);
      console.log(`   Orders: ${this.orders.length}`);
      console.log(`   Driver Profiles: ${this.drivers.length}`);

      console.log('\n🔐 Login Credentials:');
      console.log('   Admin: admin@shippingsystem.com / Admin123!@#');
      console.log('   Merchant: merchant1@example.com / Merchant123!');
      console.log('   Driver: driver1@example.com / Driver123!');
      console.log('   Customer: customer1@example.com / Customer123!');

    } catch (error) {
      console.error('Seeding failed:', error);
    } finally {
      await mongoose.connection.close();
      console.log('\nDatabase connection closed');
      process.exit(0);
    }
  }
}

// Run seeder if called directly
if (require.main === module) {
  const seeder = new DatabaseSeeder();
  seeder.run();
}

module.exports = DatabaseSeeder;