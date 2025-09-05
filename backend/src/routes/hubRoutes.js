const express = require('express');
const router = express.Router();

// Test route
router.get('/', (req, res) => {
  res.json({ success: true, message: 'Hub routes working 🏬' });
});

module.exports = router;
