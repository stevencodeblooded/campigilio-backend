const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Venue = require('../models/Venue');

// Helper function to sign JWT
const signToken = (id) => {
    return jwt.sign(
        { id },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
    );
};

// Helper function for sending JWT token response
const createSendToken = (admin, statusCode, res) => {
    const token = signToken(admin._id);

    // Remove password from output
    admin.password = undefined;

    res.status(statusCode).json({
        status: 'success',
        token,
        data: {
            admin
        }
    });
};

exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;

        // Check if username and password exist
        if (!username || !password) {
            return res.status(400).json({
                status: 'fail',
                message: 'Please provide username and password'
            });
        }

        // Find admin and include password for comparison
        const admin = await Admin.findOne({ username }).select('+password');

        if (!admin || !(await admin.correctPassword(password, admin.password))) {
            return res.status(401).json({
                status: 'fail',
                message: 'Incorrect username or password'
            });
        }

        // Update last login timestamp
        admin.lastLogin = Date.now();
        await admin.save({ validateBeforeSave: false });

        // Send token
        createSendToken(admin, 200, res);
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Error logging in',
            error: error.message
        });
    }
};

exports.getDashboardStats = async (req, res) => {
    try {
        const stats = await Venue.aggregate([
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 },
                    avgRating: { $avg: '$rating' },
                    totalVenues: { $sum: 1 }
                }
            },
            {
                $project: {
                    category: '$_id',
                    count: 1,
                    avgRating: { $round: ['$avgRating', 1] },
                    totalVenues: 1
                }
            }
        ]);

        // Get total venues count
        const totalVenues = await Venue.countDocuments();

        // Get venues added in last 30 days
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const recentVenues = await Venue.countDocuments({
            createdAt: { $gte: thirtyDaysAgo }
        });

        res.status(200).json({
            status: 'success',
            data: {
                stats,
                totalVenues,
                recentVenues
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Error fetching dashboard statistics',
            error: error.message
        });
    }
};