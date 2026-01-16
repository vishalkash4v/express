var jwt = require('jsonwebtoken');
var Participant = require('../models/Participant');
var Trip = require('../models/Trip');
var { connectDB } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Initialize Socket.IO
function initializeSocket(server) {
  var io = require('socket.io')(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Socket authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      jwt.verify(token, JWT_SECRET, async (err, decoded) => {
        if (err) {
          return next(new Error('Invalid or expired token'));
        }

        socket.userId = decoded.id;
        socket.username = decoded.username;
        next();
      });
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', async (socket) => {
    console.log(`User connected: ${socket.username} (${socket.userId})`);

    // Join trip room
    socket.on('join-trip', async (tripId) => {
      try {
        await connectDB();

        // Verify user is a member of the trip
        const trip = await Trip.findById(tripId);
        if (!trip) {
          socket.emit('error', { message: 'Trip not found' });
          return;
        }

        // Check if user is owner
        if (trip.createdBy.toString() === socket.userId) {
          socket.join(`trip:${tripId}`);
          socket.emit('joined-trip', { tripId, role: 'ADMIN' });
          return;
        }

        // Check if user is participant
        const participant = await Participant.findOne({
          tripId: tripId,
          userId: socket.userId
        });

        if (!participant) {
          socket.emit('error', { message: 'You are not a member of this trip' });
          return;
        }

        socket.join(`trip:${tripId}`);
        socket.emit('joined-trip', { tripId, role: participant.role });
      } catch (error) {
        console.error('Join trip error:', error);
        socket.emit('error', { message: 'Failed to join trip' });
      }
    });

    // Leave trip room
    socket.on('leave-trip', (tripId) => {
      socket.leave(`trip:${tripId}`);
      socket.emit('left-trip', { tripId });
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.username}`);
    });
  });

  // Helper function to emit to trip room
  io.toTrip = (tripId, event, data) => {
    io.to(`trip:${tripId}`).emit(event, data);
  };

  return io;
}

module.exports = { initializeSocket };
