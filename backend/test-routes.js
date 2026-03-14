const express = require('express');
const cors = require('cors');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Load routes
const userRoutes = require('./routes/user.routes');

// Mount routes
app.use('/api', userRoutes);

// Simple test route
app.get('/api/test', (req, res) => {
    res.json({ ok: true, message: 'Routes loaded successfully' });
});

const PORT = 3003;
app.listen(PORT, () => {
    console.log(`Test server running on port ${PORT}`);
});