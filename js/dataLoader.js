/**
 * Data Loading Module - Loads preprocessed JSON files
 */

const DataLoader = {
    // Cache for loaded data
    cache: {
        globeData: null,
        countryDetailData: null,
        regionalTimeSeries: null,
        birthDeathRates: null,
        countryTimeSeries: null,
        countriesList: null,
        animationData: null,
        regionMetadata: null,
        geoJson: null,
        radarChartData: null,
        ridgelineData: null,
        growthDriversData: null,
        genderGapData: null
    },

    /**
     * Load all required data files
     */
    async loadAllData() {
        try {
            console.log('Loading preprocessed data...');
            
            // Load each file separately to get better error messages
            console.log('  Loading globe data...');
            const globeData = await d3.json('data/globe_data_all_years.json')
                .catch(e => { throw new Error('Failed to load globe_data_all_years.json: ' + e.message); });
            
            console.log('  Loading country detail data...');
            const countryDetailData = await d3.json('data/country_detail_data.json')
                .catch(e => { throw new Error('Failed to load country_detail_data.json: ' + e.message); });
            
            console.log('  Loading regional time series...');
            const regionalTimeSeries = await d3.json('data/regional_population_nested.json')
                .catch(e => { throw new Error('Failed to load regional_population_nested.json: ' + e.message); });
            
            console.log('  Loading birth/death rates...');
            const birthDeathRates = await d3.json('data/birth_death_rates.json')
                .catch(e => { throw new Error('Failed to load birth_death_rates.json: ' + e.message); });
            
            console.log('  Loading country time series...');
            const countryTimeSeries = await d3.json('data/country_population_timeseries.json')
                .catch(e => { throw new Error('Failed to load country_population_timeseries.json: ' + e.message); });
            
            console.log('  Loading countries list...');
            const countriesList = await d3.json('data/countries_list.json')
                .catch(e => { throw new Error('Failed to load countries_list.json: ' + e.message); });
            
            console.log('  Loading animation data...');
            const animationData = await d3.json('data/country_animation_data.json')
                .catch(e => { throw new Error('Failed to load country_animation_data.json: ' + e.message); });
            
            console.log('  Loading region metadata...');
            const regionMetadata = await d3.json('data/region_metadata.json')
                .catch(e => { throw new Error('Failed to load region_metadata.json: ' + e.message); });
            
            console.log('  Loading globe coordinates (GeoJSON)...');
            const geoJson = await d3.json('data/globeCoordinates.json')
                .catch(e => { throw new Error('Failed to load globeCoordinates.json: ' + e.message); });

            // NEW: Load advanced visualization data
            console.log('  Loading radar chart data...');
            const radarChartData = await d3.json('data/radar_chart_data.json')
                .catch(e => { throw new Error('Failed to load radar_chart_data.json: ' + e.message); });
            
            console.log('  Loading ridgeline data...');
            const ridgelineData = await d3.json('data/ridgeline_data.json')
                .catch(e => { throw new Error('Failed to load ridgeline_data.json: ' + e.message); });
            
            console.log('  Loading growth drivers data...');
            const growthDriversData = await d3.json('data/growth_drivers_data.json')
                .catch(e => { throw new Error('Failed to load growth_drivers_data.json: ' + e.message); });
            
            console.log('  Loading gender gap data...');
            const genderGapData = await d3.json('data/gender_gap_data.json')
                .catch(e => { throw new Error('Failed to load gender_gap_data.json: ' + e.message); });

            // Cache all data
            this.cache.globeData = globeData;
            this.cache.countryDetailData = countryDetailData;
            this.cache.regionalTimeSeries = regionalTimeSeries;
            this.cache.birthDeathRates = birthDeathRates;
            this.cache.countryTimeSeries = countryTimeSeries;
            this.cache.countriesList = countriesList;
            this.cache.animationData = animationData;
            this.cache.regionMetadata = regionMetadata;
            this.cache.geoJson = geoJson;
            // NEW: Cache advanced visualization data
            this.cache.radarChartData = radarChartData;
            this.cache.ridgelineData = ridgelineData;
            this.cache.growthDriversData = growthDriversData;
            this.cache.genderGapData = genderGapData;

            console.log('✓ All data loaded successfully');
            console.log(`  - Globe data: ${Object.keys(globeData).length} years`);
            console.log(`  - Country details: ${Object.keys(countryDetailData).length} countries`);
            console.log(`  - Regional data: ${regionalTimeSeries.length} regions`);
            console.log(`  - Animation data: ${animationData.length} records`);
            console.log(`  - GeoJSON features: ${geoJson.features ? geoJson.features.length : 0}`);
            console.log(`  - Radar chart data: ${Object.keys(radarChartData.countries).length} countries`);
            console.log(`  - Ridgeline data: ${ridgelineData.length} entries`);
            console.log(`  - Growth drivers data: ${growthDriversData.length} records`);
            console.log(`  - Gender gap data: ${genderGapData.comparison ? genderGapData.comparison.length : 0} countries`);
            
            return {
                raw: null, // Not loading raw CSV anymore
                geoJson: geoJson
            };
        } catch (error) {
            console.error('❌ Error loading data:', error);
            console.error('Error details:', error.message);
            console.error('Make sure all JSON files exist in the data/ folder');
            console.error('Required files:');
            console.error('  - data/globe_data_all_years.json');
            console.error('  - data/country_detail_data.json');
            console.error('  - data/regional_population_nested.json');
            console.error('  - data/birth_death_rates.json');
            console.error('  - data/country_population_timeseries.json');
            console.error('  - data/countries_list.json');
            console.error('  - data/country_animation_data.json');
            console.error('  - data/region_metadata.json');
            console.error('  - data/globeCoordinates.json');
            console.error('  - data/radar_chart_data.json');
            console.error('  - data/ridgeline_data.json');
            console.error('  - data/growth_drivers_data.json');
            console.error('  - data/gender_gap_data.json');
            throw error;
        }
    },

    /**
     * Format population for display
     */
    formatPopulation(num) {
        if (!num || num === 0) return "N/A";
        if (num >= 1000000000) {
            return (num / 1000000000).toFixed(2) + " billion";
        } else if (num >= 1000000) {
            return (num / 1000000).toFixed(2) + " million";
        } else if (num >= 1000) {
            return (num / 1000).toFixed(2) + " thousand";
        }
        return num.toString();
    },

    /**
     * Get globe data for a specific year
     */
    processGlobeData(year, mode = 'population') {
        if (!this.cache.globeData) return [];
        
        const yearData = this.cache.globeData[year.toString()];
        return yearData || [];
    },

    /**
     * Get regional time series data
     */
    processRegionalTimeSeries() {
        return this.cache.regionalTimeSeries || [];
    },

    /**
     * Get country time series data
     */
    processCountryTimeSeries() {
        return this.cache.countryTimeSeries || [];
    },

    /**
     * Get list of all countries
     */
    getCountriesList() {
        return this.cache.countriesList || [];
    },

    /**
     * Get birth/death rate data
     */
    processBirthDeathRates() {
        if (!this.cache.birthDeathRates) return [];
        // Handle new structure with regions array
        if (this.cache.birthDeathRates.regions) {
            return this.cache.birthDeathRates.regions;
        }
        // Backward compatibility
        return this.cache.birthDeathRates;
    },
    
    /**
     * Get country birth/death rate data
     */
    getCountryBirthDeathRates() {
        if (!this.cache.birthDeathRates) return {};
        return this.cache.birthDeathRates.countries || {};
    },

    /**
     * Get animation data
     */
    processAnimationData() {
        return this.cache.animationData || [];
    },

    /**
     * Get country detail data for all years
     */
    getCountryDetailData(countryName) {
        if (!this.cache.countryDetailData) return [];
        
        return this.cache.countryDetailData[countryName] || [];
    },

    /**
     * Get region metadata with colors
     */
    getRegionMetadata() {
        return this.cache.regionMetadata || [];
    },

    /**
     * Get country time series data
     */
    getCountryTimeSeriesData() {
        return this.cache.countryTimeSeries || {};
    },

    /**
     * NEW: Get radar chart data
     */
    getRadarChartData() {
        return this.cache.radarChartData || { countries: {}, regional_averages: {} };
    },

    /**
     * NEW: Get ridgeline data
     */
    getRidgelineData() {
        return this.cache.ridgelineData || [];
    },

    /**
     * NEW: Get growth drivers data
     */
    getGrowthDriversData() {
        return this.cache.growthDriversData || [];
    },

    /**
     * NEW: Get gender gap data
     */
    getGenderGapData() {
        return this.cache.genderGapData || { comparison: [], timeseries: [] };
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataLoader;
}