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
        search,
        page = 0,
        limit = 15
    } = req.query;

    try {
        // Base query
        let query = {};

        // Add search conditions if search parameter exists
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { address: { $regex: search, $options: 'i' } },
                { category: { $regex: search, $options: 'i' } }
            ];
        }

        // Get total count for pagination
        const total = await Venue.countDocuments(query);

        // Get paginated results
        const venues = await Venue.find(query)
            .skip(page * limit)
            .limit(limit)
            .exec();

        res.status(200).json({
            status: 'success',
            data: venues,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit)
        });

    } catch (error) {
        console.error('Venue query error:', error);
        res.status(500).json({
            status: 'error',
            message: 'An error occurred while fetching venues'
        });
    }
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
    // Handle categories if they come as a comma-separated string
    if (typeof req.body.category === 'string') {
        req.body.category = req.body.category.split(',').map(cat => cat.trim());
    }

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
    // Handle categories if they come as a comma-separated string
    if (typeof req.body.category === 'string') {
        req.body.category = req.body.category.split(',').map(cat => cat.trim());
    }

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
            new: true,
            runValidators: true
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

exports.getVenueStats = catchAsync(async (req, res) => {
    const stats = await Venue.aggregate([
        // Unwind the category array to create a document for each category
        { $unwind: "$category" },
        // Group by category and count
        {
            $group: {
                _id: "$category", // This is now a single string, not an array
                count: { $sum: 1 },
                avgRating: { $avg: "$rating" }
            }
        },
        // Sort by count in descending order
        { $sort: { count: -1 } }
    ]);

    console.log('Aggregated stats:', stats); // Debug log

    res.status(200).json({
        status: 'success',
        data: {
            categoryStats: stats.map(stat => ({
                ...stat,
                _id: stat._id // Ensure _id is a string
            })),
            totalVenues: await Venue.countDocuments(),
            totalCategories: stats.length,
            recentUpdates: await Venue.countDocuments()
        }
    });
});