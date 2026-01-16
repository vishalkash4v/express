var jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Generate JWT token (works for both admin and user)
function generateToken(userOrAdmin) {
  return jwt.sign(
    {
      id: userOrAdmin._id || userOrAdmin.id,
      username: userOrAdmin.username,
      role: userOrAdmin.role || 'user'
    },
    JWT_SECRET,
    { expiresIn: '7d' } // 7 days for users, 24h for admin
  );
}

// Authenticate token middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access token required'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }
    req.user = decoded;
    next();
  });
}

module.exports = {
  generateToken,
  authenticateToken
};
