const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Venue = require('../models/Venue');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('MONGODB_URI is not defined in environment variables');
    process.exit(1);
}

async function updateVenueCategories() {
    try {
        // Connect to MongoDB
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');

        // Get all venues
        const venues = await Venue.find({});
        console.log(`Found ${venues.length} venues to update`);

        for (const venue of venues) {
            try {
                // Convert single category to array if it's a string
                const categories = Array.isArray(venue.category) 
                    ? venue.category 
                    : [venue.category];

                // Update the venue with the array of categories
                await Venue.findByIdAndUpdate(venue._id, {
                    category: categories
                });

                console.log(`Updated venue: ${venue.name}`);
            } catch (error) {
                console.error(`Error updating venue ${venue.name}:`, error.message);
            }
        }

        console.log('Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
    }
}

updateVenueCategories();