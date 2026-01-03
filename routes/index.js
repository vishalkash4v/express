var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.json({ 
    message: 'FYN Tools Backend API',
    status: 'running',
    endpoints: {
      shorturl: '/api/shorturl'
    }
  });
});

module.exports = router;
