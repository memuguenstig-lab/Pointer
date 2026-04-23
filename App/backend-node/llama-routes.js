'use strict';
const express = require('express');
const router = express.Router();

// Stub for node-llama-cpp routes
// node-llama-cpp requires native compilation — not available in dev mode
router.get('/status', (req, res) => {
  res.json({ available: false, message: 'Embedded LLM not available in this build' });
});

router.post('/load', (req, res) => {
  res.status(503).json({ error: 'Embedded LLM not available' });
});

router.post('/generate', (req, res) => {
  res.status(503).json({ error: 'Embedded LLM not available' });
});

module.exports = router;
