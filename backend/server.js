'use strict';

const express = require('express');
const cors    = require('cors');
const { processData } = require('./logic/processor');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health check
app.get('/bfhl', (_req, res) => res.status(200).json({ operation_code: 1 }));

// Main endpoint
app.post('/bfhl', (req, res) => {
  try {
    const { data } = req.body || {};
    if (!Array.isArray(data)) {
      return res.status(400).json({ error: '"data" must be an array of strings' });
    }
    res.status(200).json(processData(data));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => console.log(`🚀 BFHL API → http://localhost:${PORT}`));

module.exports = app;
