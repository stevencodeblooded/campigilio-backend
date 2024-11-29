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
        radius = 5000,
        search,
        openNow,
        page = 0,
        limit = 15
    } = req.query;

    try {
        // Base match conditions
        let matchConditions = {};

        // Add category filter
        if (category && category !== 'all') {
            matchConditions.category = category;
        }

        // Add name search if present
        if (search) {
            matchConditions.name = { $regex: search, $options: 'i' };
        }

        // Add open now filter
        if (openNow === 'true') {
            const now = new Date();
            const day = now.toLocaleLowerCase().split(',')[0];
            const time = now.toTimeString().slice(0, 5);
            
            matchConditions.$or = [
                { is24_7: true },
                {
                    [`openingHours.${day}.open`]: { $lte: time },
                    [`openingHours.${day}.close`]: { $gte: time }
                }
            ];
        }

        let pipeline = [];

        // If we have location coordinates, start with geoNear
        if (lat && lng) {
            pipeline.push({
                $geoNear: {
                    near: {
                        type: "Point",
                        coordinates: [parseFloat(lng), parseFloat(lat)]
                    },
                    distanceField: "distance",
                    maxDistance: parseInt(radius),
                    spherical: true
                }
            });
        }

        // Add match conditions
        if (Object.keys(matchConditions).length > 0) {
            pipeline.push({ $match: matchConditions });
        }

        // Add pagination
        pipeline.push(
            { $skip: parseInt(page) * parseInt(limit) },
            { $limit: parseInt(limit) }
        );

        // Execute the aggregation
        const venues = await Venue.aggregate(pipeline);
        
        // Get total count for pagination
        const countPipeline = [...pipeline];
        // Remove skip and limit for count
        countPipeline.splice(-2, 2);
        countPipeline.push({ $count: "total" });
        const countResult = await Venue.aggregate(countPipeline);
        const total = countResult[0]?.total || 0;

        res.status(200).json({
            status: 'success',
            results: venues.length,
            total,
            data: venues,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('Venue query error:', error);
        res.status(500).json({
            status: 'error',
            message: 'An error occurred while fetching venues',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
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