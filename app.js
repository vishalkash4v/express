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
var { connectDB } = require('./utils/db');

// Connect to MongoDB on startup (for serverless, connection is cached)
connectDB().catch((err) => {
  console.error('Failed to connect to MongoDB:', err);
});

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
