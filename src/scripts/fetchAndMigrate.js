require('dotenv').config();
const { Client } = require('@googlemaps/google-maps-services-js');
const connectDB = require('../config/db');
const Venue = require('../models/Venue');

// Configuration
const CONFIG = {
    DEFAULT_LOCATION: {
        lat: 46.2309,
        lng: 10.8266,
        name: 'Madonna di Campiglio'
    },
    SEARCH_RADIUS: 10000, // Increased to 10km
    CATEGORIES: {
        bars: {
            placeTypes: ['bar', 'night_club'],
            searchQueries: ['bar', 'pub', 'wine bar', 'cocktail bar', 'après-ski bar'],
            openingPattern: {
                openHour: 16,
                closeHour: 2
            }
        },
        clubs: {
            placeTypes: ['night_club'],
            searchQueries: ['nightclub', 'disco', 'discoteca', 'club', 'dance club', 'night club'],
            openingPattern: {
                openHour: 22,
                closeHour: 4
            }
        },
        restaurants: {
            placeTypes: ['restaurant', 'cafe'],
            searchQueries: ['restaurant', 'trattoria', 'ristorante', 'pizzeria', 'osteria', 'dining'],
            openingPattern: {
                openHour: 11,
                closeHour: 23
            }
        },
        hotels: {
            placeTypes: ['lodging'],
            searchQueries: ['hotel', 'albergo', 'resort', 'lodge', 'chalet', 'spa hotel'],
            openingPattern: {
                isAlwaysOpen: true
            }
        },
        shops: {
            placeTypes: ['store', 'shopping_mall'],
            searchQueries: ['shop', 'store', 'boutique', 'retail', 'ski shop', 'sport shop', 'negozio'],
            openingPattern: {
                openHour: 9,
                closeHour: 19
            }
        },
        skiresorts: {
            placeTypes: ['ski_resort'],
            searchQueries: ['ski resort', 'ski area', 'ski lift', 'skiing', 'winter sport', 'ski rental'],
            openingPattern: {
                openHour: 8,
                closeHour: 17
            }
        }
    }
};

class VenueMigrator {
    constructor() {
        this.googleMapsClient = new Client({});
        this.processedVenues = new Set();
        this.venueCount = 0;
    }

    async migrate() {
        try {
            await connectDB();
            console.log('Connected to MongoDB');

            await Venue.deleteMany({});
            console.log('Cleared existing venues');

            for (const [category, config] of Object.entries(CONFIG.CATEGORIES)) {
                console.log(`\nProcessing ${category}...`);
                
                // First try nearby search
                for (const placeType of config.placeTypes) {
                    await this.fetchAndSaveVenues(category, placeType);
                    await new Promise(resolve => setTimeout(resolve, 2000)); // Delay between requests
                }

                // Then try text search for each query
                for (const query of config.searchQueries) {
                    await this.textSearchVenues(category, query);
                    await new Promise(resolve => setTimeout(resolve, 2000)); // Delay between requests
                }
            }

            console.log(`\nTotal venues saved: ${this.venueCount}`);
            console.log('Migration completed successfully!');
            process.exit(0);
        } catch (error) {
            console.error('Migration failed:', error);
            process.exit(1);
        }
    }

    async textSearchVenues(category, query) {
        try {
            const response = await this.googleMapsClient.textSearch({
                params: {
                    query: `${query} in Madonna di Campiglio`,
                    location: CONFIG.DEFAULT_LOCATION,
                    radius: CONFIG.SEARCH_RADIUS,
                    language: 'en',
                    key: process.env.GOOGLE_MAPS_API_KEY
                }
            });

            if (response.data.results) {
                console.log(`Found ${response.data.results.length} places for "${query}"`);
                for (const place of response.data.results) {
                    if (this.processedVenues.has(place.place_id)) continue;
                    this.processedVenues.add(place.place_id);

                    const details = await this.fetchPlaceDetails(place.place_id);
                    if (details) {
                        await this.saveVenue(place, details, category);
                        this.venueCount++;
                    }
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Delay between detail requests
                }
            }
        } catch (error) {
            console.error(`Error in text search for ${query}:`, error.message);
        }
    }

    async fetchAndSaveVenues(category, placeType) {
        try {
            const response = await this.googleMapsClient.placesNearby({
                params: {
                    location: CONFIG.DEFAULT_LOCATION,
                    radius: CONFIG.SEARCH_RADIUS,
                    type: placeType,
                    key: process.env.GOOGLE_MAPS_API_KEY
                }
            });

            if (response.data.results) {
                console.log(`Found ${response.data.results.length} places for type "${placeType}"`);
                for (const place of response.data.results) {
                    if (this.processedVenues.has(place.place_id)) continue;
                    this.processedVenues.add(place.place_id);

                    const details = await this.fetchPlaceDetails(place.place_id);
                    if (details) {
                        await this.saveVenue(place, details, category);
                        this.venueCount++;
                    }
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        } catch (error) {
            console.error(`Error fetching ${category} - ${placeType}:`, error.message);
        }
    }

    async fetchPlaceDetails(placeId) {
        try {
            const response = await this.googleMapsClient.placeDetails({
                params: {
                    place_id: placeId,
                    fields: ['formatted_phone_number', 'website', 'opening_hours', 'formatted_address'],
                    key: process.env.GOOGLE_MAPS_API_KEY
                }
            });
            return response.data.result;
        } catch (error) {
            console.error(`Error fetching details for place ${placeId}:`, error.message);
            return null;
        }
    }

    async saveVenue(place, details, category) {
        try {
            const venue = {
                name: place.name,
                category: category,
                location: {
                    type: 'Point',
                    coordinates: [
                        place.geometry.location.lng,
                        place.geometry.location.lat
                    ]
                },
                address: details?.formatted_address || place.vicinity,
                phone: details?.formatted_phone_number,
                website: details?.website,
                rating: place.rating,
                is24_7: this.is24Hours(details?.opening_hours),
                openingHours: this.transformOpeningHours(details?.opening_hours?.periods),
                placeType: [place.types[0]],
                googlePlaceId: place.place_id
            };

            const savedVenue = await Venue.create(venue);
            console.log(`Saved venue: ${savedVenue.name} (${category})`);
        } catch (error) {
            console.error(`Error saving venue ${place.name}:`, error.message);
        }
    }

    is24Hours(openingHours) {
        if (!openingHours?.periods) return false;
        return openingHours.periods.some(period => 
            period.open?.time === '0000' && 
            (!period.close || period.close?.time === '0000')
        );
    }

    transformOpeningHours(periods) {
        if (!periods) return null;

        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        const openingHours = {};

        days.forEach(day => {
            const dayPeriod = periods.find(p => p.open?.day === days.indexOf(day));
            if (dayPeriod) {
                openingHours[day] = {
                    open: this.formatTime(dayPeriod.open?.time),
                    close: this.formatTime(dayPeriod.close?.time)
                };
            }
        });

        return openingHours;
    }

    formatTime(time) {
        if (!time) return null;
        return `${time.slice(0, 2)}:${time.slice(2)}`;
    }
}

// Run migration
new VenueMigrator().migrate();