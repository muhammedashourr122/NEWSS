const express = require('express');
const router = express.Router();

// Example route to confirm it's working
router.get('/', (req, res) => {
  res.json({ success: true, message: 'Driver routes working 🚗' });
});

module.exports = router;
