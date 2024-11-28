require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const venueRoutes = require('./routes/venueRoutes');
const errorHandler = require('./middleware/errorHandler');

// Initialize express app
const app = express();

app.use(cors({
    origin: ['http://localhost:5501', 'http://127.0.0.1:5501', 'https://your-production-domain.com'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting configuration
const limiter = rateLimit({
    windowMs: process.env.RATE_LIMIT_WINDOW * 60 * 1000, // Default: 15 minutes
    max: process.env.RATE_LIMIT_MAX, // Default: 100 requests per window
    message: 'Too many requests from this IP, please try again later.'
});

app.use(express.json({ limit: '10kb' })); // Body parser with size limit
app.use(morgan('dev')); // Logging in development
app.use(limiter); // Apply rate limiting

// Health Check Route
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'Server is running',
        time: new Date().toISOString(),
        environment: process.env.NODE_ENV
    });
});

app.options('*', cors()); // Enable pre-flight for all routes

// API Routes
app.use('/api/venues', venueRoutes);

// Handle undefined routes
app.all('*', (req, res) => {
    res.status(404).json({
        status: 'fail',
        message: `Can't find ${req.originalUrl} on this server!`
    });
});

// Global Error Handler
app.use(errorHandler);

// Server Setup
const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        // Connect to MongoDB
        await connectDB();
        
        // Start server
        const server = app.listen(PORT, () => {
            console.log(`
══════════════════════════════════════════
  Server running in ${process.env.NODE_ENV} mode
  Port: ${PORT}
  URL: http://localhost:${PORT}
  Health Check: http://localhost:${PORT}/health
══════════════════════════════════════════
            `);
        });

        // Handle unhandled rejections
        process.on('unhandledRejection', (err) => {
            console.error('UNHANDLED REJECTION! 💥 Shutting down...');
            console.error(err.name, err.message);
            // Gracefully close server & exit process
            server.close(() => {
                process.exit(1);
            });
        });

        // Handle SIGTERM
        process.on('SIGTERM', () => {
            console.log('👋 SIGTERM RECEIVED. Shutting down gracefully');
            server.close(() => {
                console.log('💥 Process terminated!');
            });
        });

    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

// Start the server
startServer();

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
    console.error(err.name, err.message);
    process.exit(1);
});