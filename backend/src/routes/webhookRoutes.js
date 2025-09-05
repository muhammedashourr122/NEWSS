const express = require('express');
const router = express.Router();

// Example webhook endpoint
router.post('/payment', (req, res) => {
  console.log('Received payment webhook:', req.body);
  res.status(200).json({ success: true, message: 'Webhook received' });
});

module.exports = router;
