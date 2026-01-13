var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var mongoose = require('mongoose');
var cors = require('cors');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var shortUrlRouter = require('./routes/shorturl');
var rewriteRouter = require('./routes/rewrite');
var adminRouter = require('./routes/admin');
var registerRouter = require('./routes/register');

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://cqlsysvishal:Lukethedog1234@cluster0.gcqrn8m.mongodb.net/fyntools?retryWrites=true&w=majority&appName=Cluster0';

// Cache the connection to reuse in serverless environments
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log('MongoDB connected successfully');
      console.log('Database:', mongoose.connection.name);
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    console.log('MongoDB connection failed');
    console.error('MongoDB connection error:', e.message);
    throw e;
  }

  return cached.conn;
}

// Connect to MongoDB on startup (for serverless, connection is cached)
connectDB().catch((err) => {
  console.error('Failed to connect to MongoDB:', err);
});

// Export connectDB for use in routes if needed
module.exports.connectDB = connectDB;

var app = express();

// No view engine needed - API only

// CORS configuration
app.use(cors({
  origin: '*', // Allow all origins for now
  credentials: true
}));

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/api/shorturl', shortUrlRouter);
app.use('/api', rewriteRouter);
app.use('/api/admin', adminRouter);
app.use('/kuthera', registerRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // Return JSON error response (API only, no views)
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(status).json({
    success: false,
    error: message,
    ...(req.app.get('env') === 'development' && { stack: err.stack })
  });
});

module.exports = app;
