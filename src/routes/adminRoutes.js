const express = require('express');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const {
    login,
    getDashboardStats
} = require('../controllers/adminController');
const {
    createVenue,
    updateVenue,
    deleteVenue
} = require('../controllers/venueController');

const router = express.Router();

// Public routes
router.post('/login', login);

// Protected routes
router.use(protect); // All routes after this middleware are protected

// Dashboard statistics
router.get('/dashboard-stats', getDashboardStats);

// Venue management routes
router.post('/venues', restrictTo('admin', 'super-admin'), createVenue);
router.patch('/venues/:id', restrictTo('admin', 'super-admin'), updateVenue);
router.delete('/venues/:id', restrictTo('admin', 'super-admin'), deleteVenue);

module.exports = router;