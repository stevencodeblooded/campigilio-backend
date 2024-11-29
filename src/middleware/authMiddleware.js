const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

exports.protect = async (req, res, next) => {
    try {
        // 1. Get token and check if it exists
        let token;
        if (req.headers.authorization?.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({
                status: 'fail',
                message: 'You are not logged in. Please log in to get access.'
            });
        }

        // 2. Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 3. Check if admin still exists
        const currentAdmin = await Admin.findById(decoded.id);
        if (!currentAdmin) {
            return res.status(401).json({
                status: 'fail',
                message: 'The admin belonging to this token no longer exists.'
            });
        }

        // 4. Check if admin changed password after token was issued
        if (currentAdmin.passwordChangedAt && decoded.iat < currentAdmin.passwordChangedAt.getTime() / 1000) {
            return res.status(401).json({
                status: 'fail',
                message: 'Admin recently changed password. Please log in again.'
            });
        }

        // Grant access to protected route
        req.admin = currentAdmin;
        next();
    } catch (error) {
        return res.status(401).json({
            status: 'fail',
            message: 'Invalid token or session expired'
        });
    }
};

exports.restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.admin.role)) {
            return res.status(403).json({
                status: 'fail',
                message: 'You do not have permission to perform this action'
            });
        }
        next();
    };
};