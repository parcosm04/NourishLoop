const dns = require('dns');
// Use public DNS to resolve MongoDB SRV records on Windows networks
dns.setServers(['8.8.8.8', '1.1.1.1']);

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PUT'] }
});

app.use(cors());
app.use(express.json());

// Make io accessible to routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Routes
const donationRoutes = require('./src/routes/donations');
const authRoutes = require('./src/routes/auth');
const feedbackRoutes = require('./src/routes/feedback');
app.use('/api/donations', donationRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/feedback', feedbackRoutes);


// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/food-rescue';

// Always start the HTTP server so API and Socket.IO are available
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Connect to MongoDB Atlas/local
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
    console.warn('Note: If using MongoDB Atlas, verify your IP address is whitelisted in Network Access.');
  });

