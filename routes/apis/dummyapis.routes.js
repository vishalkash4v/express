var express = require('express');
var router = express.Router();
var dummyapisController = require('../../controllers/dummyapis.controller');

// Auth routes
router.post('/auth/register', dummyapisController.register);
router.post('/auth/login', dummyapisController.login);

// User routes (all require authentication via Bearer token)
router.post('/users', dummyapisController.createUser);
router.get('/users', dummyapisController.getUsers);
router.get('/users/my', dummyapisController.getMyUser);
router.put('/users/:id', dummyapisController.updateUser);
router.delete('/users/:id', dummyapisController.deleteUser);
router.patch('/users/:id/status', dummyapisController.updateUserStatus);

module.exports = router;
