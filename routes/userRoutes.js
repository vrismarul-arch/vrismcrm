// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Get all users
router.get('/', userController.getAllUsers);

// Get a single user by ID
router.get('/:id', userController.getSingleUser);


// Create a new user
router.post('/', userController.createUser);

// Update an existing user
router.put('/:id', userController.updateUser);

// Delete a user
router.delete('/:id', userController.deleteUser);

// Transfer a user
router.put('/transfer/:id', userController.transferUser);

module.exports = router;