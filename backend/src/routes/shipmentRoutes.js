const express = require('express');
const router = express.Router();

// Example placeholder route
router.get('/', (req, res) => {
  res.json({ success: true, message: 'Shipment routes working 🚚' });
});

module.exports = router;
