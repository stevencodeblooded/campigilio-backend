const errorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    if (process.env.NODE_ENV === 'development') {
        // Send detailed error in development
        res.status(err.statusCode).json({
            status: err.status,
            error: err,
            message: err.message,
            stack: err.stack
        });
    } else {
        // Send simplified error in production
        let error = { ...err };
        error.message = err.message;

        // Mongoose bad ObjectId
        if (err.name === 'CastError') {
            error.message = `Resource not found`;
            error.statusCode = 404;
        }

        // Mongoose duplicate key
        if (err.code === 11000) {
            error.message = 'Duplicate field value entered';
            error.statusCode = 400;
        }

        // Mongoose validation error
        if (err.name === 'ValidationError') {
            error.message = Object.values(err.errors)
                .map(val => val.message)
                .join('. ');
            error.statusCode = 400;
        }

        res.header("Access-Control-Allow-Origin", "http://localhost:5501");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        
        res.status(statusCode).json({
            status: status,
            error: err,
            message: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
};

module.exports = errorHandler;