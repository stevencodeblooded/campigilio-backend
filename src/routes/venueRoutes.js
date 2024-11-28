const express = require('express');
const {
    getVenues,
    getVenue,
    createVenue,
    updateVenue,
    deleteVenue,
    getVenueStats
} = require('../controllers/venueController');

const router = express.Router();

// Stats route
router.get('/stats', getVenueStats);

// Main venue routes
router
    .route('/')
    .get(getVenues)
    .post(createVenue);

router
    .route('/:id')
    .get(getVenue)
    .patch(updateVenue)
    .delete(deleteVenue);

module.exports = router;