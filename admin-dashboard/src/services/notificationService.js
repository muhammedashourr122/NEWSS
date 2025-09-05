const nodemailer = require('nodemailer');
const axios = require('axios');

class NotificationService {
  constructor() {
    // Email transporter setup
    this.emailTransporter = nodemailer.createTransporter({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });

    // SMS configuration (using Twilio)
    this.twilioConfig = {
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      phoneNumber: process.env.TWILIO_PHONE_NUMBER
    };

    // Push notification configuration (Firebase FCM)
    this.fcmServerKey = process.env.FCM_SERVER_KEY;
  }

  /**
   * Send email notification
   * @param {Object} options - Email options
   * @returns {Promise} Email send result
   */
  async sendEmail(options) {
    try {
      const {
        to,
        subject,
        html,
        text,
        template,
        templateData
      } = options;

      let emailContent = {};

      if (template && templateData) {
        emailContent = this.generateEmailFromTemplate(template, templateData);
      } else {
        emailContent = {
          subject: subject || 'Notification from Shipping System',
          html: html || text || 'No content provided',
          text: text
        };
      }

      const mailOptions = {
        from: `"Shipping System" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
        to,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text
      };

      const result = await this.emailTransporter.sendMail(mailOptions);
      
      console.log('Email sent successfully:', result.messageId);
      return {
        success: true,
        messageId: result.messageId
      };

    } catch (error) {
      console.error('Email sending failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send SMS notification
   * @param {Object} options - SMS options
   * @returns {Promise} SMS send result
   */
  async sendSMS(options) {
    try {
      const { to, message, template, templateData } = options;

      if (!this.twilioConfig.accountSid || !this.twilioConfig.authToken) {
        console.log('SMS service not configured - would send:', message);
        return {
          success: true,
          mock: true,
          message: 'SMS service not configured in development'
        };
      }

      let smsMessage = message;
      if (template && templateData) {
        smsMessage = this.generateSMSFromTemplate(template, templateData);
      }

      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.twilioConfig.accountSid}/Messages.json`;
      
      const response = await axios.post(url, {
        From: this.twilioConfig.phoneNumber,
        To: to,
        Body: smsMessage
      }, {
        auth: {
          username: this.twilioConfig.accountSid,
          password: this.twilioConfig.authToken
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      return {
        success: true,
        sid: response.data.sid
      };

    } catch (error) {
      console.error('SMS sending failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send push notification
   * @param {Object} options - Push notification options
   * @returns {Promise} Push notification result
   */
  async sendPushNotification(options) {
    try {
      const {
        tokens, // Array of FCM tokens or single token
        title,
        body,
        data,
        template,
        templateData
      } = options;

      if (!this.fcmServerKey) {
        console.log('Push notification service not configured - would send:', { title, body });
        return {
          success: true,
          mock: true,
          message: 'Push notification service not configured in development'
        };
      }

      let notification = { title, body };
      if (template && templateData) {
        notification = this.generatePushFromTemplate(template, templateData);
      }

      const payload = {
        notification,
        data: data || {},
        priority: 'high',
        content_available: true
      };

      // Handle multiple tokens
      const tokensArray = Array.isArray(tokens) ? tokens : [tokens];
      const results = [];

      for (const token of tokensArray) {
        try {
          const response = await axios.post('https://fcm.googleapis.com/fcm/send', {
            ...payload,
            to: token
          }, {
            headers: {
              'Authorization': `key=${this.fcmServerKey}`,
              'Content-Type': 'application/json'
            }
          });

          results.push({
            token,
            success: true,
            messageId: response.data.message_id
          });

        } catch (tokenError) {
          results.push({
            token,
            success: false,
            error: tokenError.message
          });
        }
      }

      return {
        success: true,
        results
      };

    } catch (error) {
      console.error('Push notification sending failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send multi-channel notification
   * @param {Object} options - Multi-channel notification options
   * @returns {Promise} Notification results
   */
  async sendNotification(options) {
    const {
      user,
      channels = ['email'], // Array of channels: email, sms, push
      template,
      templateData,
      subject,
      message,
      title,
      priority = 'normal'
    } = options;

    const results = {
      email: null,
      sms: null,
      push: null,
      success: false
    };

    // Check user preferences
    const userPreferences = user.preferences?.notifications || {};
    
    try {
      // Send email notification
      if (channels.includes('email') && userPreferences.email !== false && user.email) {
        results.email = await this.sendEmail({
          to: user.email,
          subject,
          template,
          templateData: { ...templateData, user }
        });
      }

      // Send SMS notification
      if (channels.includes('sms') && userPreferences.sms !== false && user.phone) {
        results.sms = await this.sendSMS({
          to: user.phone,
          message,
          template,
          templateData: { ...templateData, user }
        });
      }

      // Send push notification (would need FCM token from user device)
      if (channels.includes('push') && userPreferences.push !== false && user.fcmToken) {
        results.push = await this.sendPushNotification({
          tokens: user.fcmToken,
          title,
          body: message,
          template,
          templateData: { ...templateData, user }
        });
      }

      // Mark as successful if at least one channel succeeded
      results.success = Object.values(results).some(result => result?.success);

      return results;

    } catch (error) {
      console.error('Multi-channel notification failed:', error);
      return {
        ...results,
        error: error.message
      };
    }
  }

  /**
   * Generate email content from template
   * @param {string} template - Template name
   * @param {Object} data - Template data
   * @returns {Object} Email content
   */
  generateEmailFromTemplate(template, data) {
    const templates = {
      order_created: {
        subject: `Order Confirmation - ${data.orderNumber}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Order Confirmed!</h2>
            <p>Dear ${data.user?.firstName || data.customerName},</p>
            <p>Your order has been successfully created and is being processed.</p>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Order Details:</h3>
              <p><strong>Order Number:</strong> ${data.orderNumber}</p>
              <p><strong>Total Amount:</strong> ${data.total} EGP</p>
              <p><strong>Delivery Address:</strong> ${data.deliveryAddress}</p>
              <p><strong>Estimated Delivery:</strong> ${data.estimatedDelivery}</p>
            </div>
            
            <p>You can track your order using the tracking number: <strong>${data.trackingNumber}</strong></p>
            <p>Thank you for choosing our delivery service!</p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
              <p style="color: #666; font-size: 12px;">
                If you have any questions, please contact us at support@shippingsystem.com
              </p>
            </div>
          </div>
        `
      },

      order_picked_up: {
        subject: `Order Picked Up - ${data.orderNumber}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #28a745;">Order Picked Up!</h2>
            <p>Dear ${data.user?.firstName || data.customerName},</p>
            <p>Great news! Your order has been picked up and is on its way to you.</p>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Order Number:</strong> ${data.orderNumber}</p>
              <p><strong>Driver:</strong> ${data.driverName}</p>
              <p><strong>Estimated Delivery:</strong> ${data.estimatedDelivery}</p>
            </div>
            
            <p>Track your order: <a href="${data.trackingUrl || '#'}" style="color: #007bff;">Click here</a></p>
          </div>
        `
      },

      order_delivered: {
        subject: `Order Delivered - ${data.orderNumber}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #28a745;">Order Delivered Successfully!</h2>
            <p>Dear ${data.user?.firstName || data.customerName},</p>
            <p>Your order has been delivered successfully!</p>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Order Number:</strong> ${data.orderNumber}</p>
              <p><strong>Delivered At:</strong> ${data.deliveredAt}</p>
              <p><strong>Delivered By:</strong> ${data.driverName}</p>
            </div>
            
            <p>Thank you for using our delivery service. We hope to serve you again soon!</p>
          </div>
        `
      },

      driver_assignment: {
        subject: `New Delivery Assignment - ${data.orderNumber}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #007bff;">New Delivery Assignment</h2>
            <p>Hello ${data.user?.firstName},</p>
            <p>You have been assigned a new delivery!</p>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Delivery Details:</h3>
              <p><strong>Order Number:</strong> ${data.orderNumber}</p>
              <p><strong>Pickup Address:</strong> ${data.pickupAddress}</p>
              <p><strong>Delivery Address:</strong> ${data.deliveryAddress}</p>
              <p><strong>Customer Phone:</strong> ${data.customerPhone}</p>
              <p><strong>Priority:</strong> ${data.priority}</p>
            </div>
            
            <p>Please log in to your driver app to accept this assignment.</p>
          </div>
        `
      }
    };

    return templates[template] || {
      subject: 'Notification from Shipping System',
      html: '<p>Notification content not available.</p>'
    };
  }

  /**
   * Generate SMS content from template
   * @param {string} template - Template name
   * @param {Object} data - Template data
   * @returns {string} SMS message
   */
  generateSMSFromTemplate(template, data) {
    const templates = {
      order_created: `Order ${data.orderNumber} confirmed! Track with: ${data.trackingNumber}. Estimated delivery: ${data.estimatedDelivery}`,
      order_picked_up: `Your order ${data.orderNumber} has been picked up by ${data.driverName}. Track: ${data.trackingNumber}`,
      order_out_for_delivery: `Your order ${data.orderNumber} is out for delivery! Expected within ${data.estimatedTime} minutes.`,
      order_delivered: `Order ${data.orderNumber} delivered successfully! Thank you for choosing our service.`,
      driver_assignment: `New delivery assigned: ${data.orderNumber}. Pickup: ${data.pickupAddress}. Check your app for details.`,
      failed_delivery: `Delivery attempt failed for ${data.orderNumber}. Reason: ${data.reason}. We'll contact you to reschedule.`
    };

    return templates[template] || `Notification: ${data.message || 'Update available'}`;
  }

  /**
   * Generate push notification content from template
   * @param {string} template - Template name
   * @param {Object} data - Template data
   * @returns {Object} Push notification content
   */
  generatePushFromTemplate(template, data) {
    const templates = {
      order_created: {
        title: 'Order Confirmed!',
        body: `Your order ${data.orderNumber} has been confirmed and is being processed.`
      },
      order_picked_up: {
        title: 'Order Picked Up',
        body: `Your order is on its way! Driver: ${data.driverName}`
      },
      order_out_for_delivery: {
        title: 'Out for Delivery',
        body: `Your order ${data.orderNumber} will arrive within ${data.estimatedTime} minutes.`
      },
      order_delivered: {
        title: 'Order Delivered',
        body: `Your order ${data.orderNumber} has been delivered successfully!`
      },
      driver_assignment: {
        title: 'New Delivery Assignment',
        body: `Order ${data.orderNumber} - Pickup: ${data.pickupAddress}`
      }
    };

    return templates[template] || {
      title: 'Notification',
      body: data.message || 'You have a new update'
    };
  }

  /**
   * Send order status update notifications
   * @param {Object} order - Order document
   * @param {string} status - New status
   * @returns {Promise} Notification results
   */
  async notifyOrderStatusChange(order, status) {
    const templateMap = {
      confirmed: 'order_created',
      picked_up: 'order_picked_up',
      out_for_delivery: 'order_out_for_delivery',
      delivered: 'order_delivered',
      failed_delivery: 'failed_delivery'
    };

    const template = templateMap[status];
    if (!template) return { success: false, message: 'No template for status' };

    // Notify customer
    const customerNotification = await this.sendNotification({
      user: {
        email: order.customerInfo.email,
        phone: order.customerInfo.phone,
        firstName: order.customerInfo.name.split(' ')[0],
        preferences: { notifications: { email: true, sms: true } }
      },
      channels: ['email', 'sms'],
      template,
      templateData: {
        orderNumber: order.orderNumber,
        trackingNumber: order.tracking.trackingNumber,
        customerName: order.customerInfo.name,
        deliveryAddress: `${order.customerInfo.address.street}, ${order.customerInfo.address.city}`,
        total: order.pricing.total,
        estimatedDelivery: order.tracking.estimatedDelivery?.toLocaleDateString() || 'TBD'
      }
    });

    return customerNotification;
  }

  /**
   * Send driver assignment notification
   * @param {Object} driver - Driver document
   * @param {Object} order - Order document
   * @returns {Promise} Notification results
   */
  async notifyDriverAssignment(driver, order) {
    return this.sendNotification({
      user: driver.user,
      channels: ['email', 'push'],
      template: 'driver_assignment',
      templateData: {
        orderNumber: order.orderNumber,
        pickupAddress: `${order.pickupAddress.street}, ${order.pickupAddress.city}`,
        deliveryAddress: `${order.customerInfo.address.street}, ${order.customerInfo.address.city}`,
        customerPhone: order.customerInfo.phone,
        priority: order.priority
      }
    });
  }

  /**
   * Send bulk notifications
   * @param {Array} notifications - Array of notification objects
   * @returns {Promise} Bulk notification results
   */
  async sendBulkNotifications(notifications) {
    const results = [];
    
    for (const notification of notifications) {
      try {
        const result = await this.sendNotification(notification);
        results.push({
          success: result.success,
          userId: notification.user?._id || notification.user?.id,
          channels: notification.channels,
          result
        });
      } catch (error) {
        results.push({
          success: false,
          userId: notification.user?._id || notification.user?.id,
          error: error.message
        });
      }
    }

    return {
      success: true,
      total: notifications.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }
}

module.exports = new NotificationService();