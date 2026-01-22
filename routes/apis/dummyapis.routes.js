var express = require('express');
var router = express.Router();
var dummyapisController = require('../../controllers/dummyapis.controller');

// Auth routes
router.post('/auth/register', dummyapisController.register);
router.post('/auth/login', dummyapisController.login);
router.post('/auth/change-password', dummyapisController.changePassword);

// User routes (all require authentication via Bearer token)
router.post('/users', dummyapisController.createUser);
router.get('/users', dummyapisController.getUsers);
router.get('/users/my', dummyapisController.getMyUser);
router.put('/users/:id', dummyapisController.updateUser);
router.delete('/users/:id', dummyapisController.deleteUser);
router.patch('/users/:id/status', dummyapisController.updateUserStatus);

// Product routes (all require authentication via Bearer token)
router.post('/products', dummyapisController.createProduct);
router.get('/products', dummyapisController.getProducts);
router.get('/products/:id', dummyapisController.getProduct);
router.put('/products/:id', dummyapisController.updateProduct);
router.delete('/products/:id', dummyapisController.deleteProduct);
router.patch('/products/:id/status', dummyapisController.updateProductStatus);

// Cart routes (all require authentication via Bearer token)
router.post('/cart', dummyapisController.addToCart);
router.get('/cart/:userId', dummyapisController.getCart);
router.put('/cart/:userId/:productId', dummyapisController.updateCartItem);
router.delete('/cart/:userId/:productId', dummyapisController.removeFromCart);
router.delete('/cart/:userId', dummyapisController.clearCart);

module.exports = router;
