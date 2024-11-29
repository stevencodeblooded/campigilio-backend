const mongoose = require('mongoose');

const openingHoursSchema = new mongoose.Schema({
    open: String,
    close: String
});

const venueSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a venue name'],
        trim: true,
        index: true
    },
    category: {
        type: [String], // Changed from String to Array of Strings
        required: [true, 'Please add at least one category'],
        validate: {
            validator: function(v) {
                // Check if array is not empty and all values are valid categories
                return v.length > 0 && v.every(cat => 
                    ['bars', 'clubs', 'restaurants', 'hotels', 'shops', 'skiresorts'].includes(cat)
                );
            },
            message: 'Please provide valid categories'
        }
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            required: true
        },
        coordinates: {
            type: [Number],
            required: true,
            validate: {
                validator: function(v) {
                    return v.length === 2 && 
                           v[0] >= -180 && v[0] <= 180 && 
                           v[1] >= -90 && v[1] <= 90;
                },
                message: 'Invalid coordinates'
            }
        }
    },
    address: {
        type: String,
        required: [true, 'Please add an address']
    },
    phone: String,
    website: String,
    rating: {
        type: Number,
        min: 0,
        max: 5
    },
    openingHours: {
        monday: openingHoursSchema,
        tuesday: openingHoursSchema,
        wednesday: openingHoursSchema,
        thursday: openingHoursSchema,
        friday: openingHoursSchema,
        saturday: openingHoursSchema,
        sunday: openingHoursSchema
    },
    is24_7: {
        type: Boolean,
        default: false
    },
    photos: [String],
    placeType: [String],
    lastUpdated: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for efficient querying
venueSchema.index({ location: '2dsphere' });
venueSchema.index({ name: 'text', address: 'text' });
venueSchema.index({ category: 1 });

module.exports = mongoose.model('Venue', venueSchema);