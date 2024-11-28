const Venue = require('../models/Venue');

// Helper function for async error handling
const catchAsync = fn => {
    return (req, res, next) => {
        fn(req, res, next).catch(next);
    };
};

// Get all venues with filtering
exports.getVenues = catchAsync(async (req, res) => {
    const { 
        category,
        lat,
        lng,
        radius = 5000,  // Default 5km radius
        search,
        openNow
    } = req.query;

    let query = {};

    // Apply category filter
    if (category && category !== 'all') {
        query.category = category;
    }

    // Apply location filter
    if (lat && lng) {
        query.location = {
            $near: {
                $geometry: {
                    type: 'Point',
                    coordinates: [parseFloat(lng), parseFloat(lat)]
                },
                $maxDistance: parseInt(radius)
            }
        };
    }

    // Apply text search
    if (search) {
        query.$text = { $search: search };
    }

    // Apply open now filter
    if (openNow === 'true') {
        const now = new Date();
        const day = now.toLocaleLowerCase().split(',')[0];
        const time = now.toTimeString().slice(0, 5);
        
        query.$or = [
            { is24_7: true },
            {
                [`openingHours.${day}.open`]: { $lte: time },
                [`openingHours.${day}.close`]: { $gte: time }
            }
        ];
    }

    const venues = await Venue.find(query);

    res.status(200).json({
        status: 'success',
        results: venues.length,
        data: venues
    });
});

// Get single venue
exports.getVenue = catchAsync(async (req, res) => {
    const venue = await Venue.findById(req.params.id);

    if (!venue) {
        return res.status(404).json({
            status: 'fail',
            message: 'Venue not found'
        });
    }

    res.status(200).json({
        status: 'success',
        data: venue
    });
});

// Create new venue
exports.createVenue = catchAsync(async (req, res) => {
    // Ensure coordinates are in correct format
    if (req.body.location) {
        req.body.location = {
            type: 'Point',
            coordinates: [
                parseFloat(req.body.location.lng || req.body.location.coordinates[0]),
                parseFloat(req.body.location.lat || req.body.location.coordinates[1])
            ]
        };
    }

    const venue = await Venue.create(req.body);

    res.status(201).json({
        status: 'success',
        data: venue
    });
});

// Update venue
exports.updateVenue = catchAsync(async (req, res) => {
    // Handle location update if provided
    if (req.body.location) {
        req.body.location = {
            type: 'Point',
            coordinates: [
                parseFloat(req.body.location.lng || req.body.location.coordinates[0]),
                parseFloat(req.body.location.lat || req.body.location.coordinates[1])
            ]
        };
    }

    const venue = await Venue.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
            new: true,  // Return updated venue
            runValidators: true  // Run model validators
        }
    );

    if (!venue) {
        return res.status(404).json({
            status: 'fail',
            message: 'Venue not found'
        });
    }

    res.status(200).json({
        status: 'success',
        data: venue
    });
});

// Delete venue
exports.deleteVenue = catchAsync(async (req, res) => {
    const venue = await Venue.findByIdAndDelete(req.params.id);

    if (!venue) {
        return res.status(404).json({
            status: 'fail',
            message: 'Venue not found'
        });
    }

    res.status(204).json({
        status: 'success',
        data: null
    });
});

// Get venues stats (additional utility endpoint)
exports.getVenueStats = catchAsync(async (req, res) => {
    const stats = await Venue.aggregate([
        {
            $group: {
                _id: '$category',
                count: { $sum: 1 },
                avgRating: { $avg: '$rating' }
            }
        }
    ]);

    res.status(200).json({
        status: 'success',
        data: stats
    });
});