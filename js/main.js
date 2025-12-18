/**
 * Main Application Controller - ENHANCED
 * Coordinates all visualizations and handles global state with Brushing & Linking
 */

// Country name mapping for inconsistencies between data sources
const countryNameMap = {
    'United States': 'United States of America',
    'United States of America': 'United States of America',
    'Russia': 'Russian Federation',
    'Russian Federation': 'Russian Federation',
    'South Korea': 'Republic of Korea',
    'Republic of Korea': 'Republic of Korea',
    'North Korea': "Democratic People's Republic of Korea",
    "Democratic People's Republic of Korea": "Democratic People's Republic of Korea",
    'Iran': 'Iran (Islamic Republic of)',
    'Iran (Islamic Republic of)': 'Iran (Islamic Republic of)',
    'Venezuela': 'Venezuela (Bolivarian Republic of)',
    'Venezuela (Bolivarian Republic of)': 'Venezuela (Bolivarian Republic of)',
    'Bolivia': 'Bolivia (Plurinational State of)',
    'Bolivia (Plurinational State of)': 'Bolivia (Plurinational State of)',
    'Syria': 'Syrian Arab Republic',
    'Syrian Arab Republic': 'Syrian Arab Republic',
    'Vietnam': 'Viet Nam',
    'Viet Nam': 'Viet Nam',
    'Tanzania': 'United Republic of Tanzania',
    'United Republic of Tanzania': 'United Republic of Tanzania',
    'Moldova': 'Republic of Moldova',
    'Republic of Moldova': 'Republic of Moldova',
    'Laos': "Lao People's Democratic Republic",
    "Lao People's Democratic Republic": "Lao People's Democratic Republic"
};

/**
 * Normalize country name for data lookups
 */
function normalizeCountryName(name) {
    return countryNameMap[name] || name;
}

// Global application state
const AppState = {
    selectedCountry: null,
    selectedCountryCode: null,
    selectedRegion: null,
    currentYear: 2023,
    currentMode: 'overview',
    currentVisualization: 'population',
    globeViewMode: '3d',
    data: {
        raw: null,
        geoJson: null,
        processed: {}
    },
    panes: {
        globe: 'normal',
        details: 'normal'
    }
};

// Event dispatcher for coordinated views (BRUSHING & LINKING)
const dispatcher = d3.dispatch(
    'countrySelected',
    'regionSelected',
    'yearChanged',
    'modeChanged',
    'visualizationChanged',
    'dataLoaded',
    'countryHighlighted',
    'countryUnhighlighted'
);

/**
 * Initialize application
 */
async function initApp() {
    console.log('Initializing World Demographics Dashboard - ENHANCED VERSION...');
    
    try {
        // Show loading screen
        showLoading(true);
        
        // 1. Load all data (including new advanced viz data)
        const data = await DataLoader.loadAllData();
        AppState.data.raw = data.raw;
        AppState.data.geoJson = data.geoJson;
        
        // 2. Initialize globe visualization
        GlobeViz.init(d3.select('#globe-container'), AppState);
        
        // 3. Set up navigation
        setupNavigation();
        
        // 4. Set up pane controls
        setupPaneControls();
        
        // 5. Set up modal
        setupModal();
        
        // 6. Set up event listeners (COORDINATED VIEWS)
        setupEventListeners();
        
        // 7. Dispatch data loaded event
        dispatcher.call('dataLoaded', null, data);
        
        // Hide loading screen
        showLoading(false);
        
        console.log('✓ Dashboard initialized successfully with coordinated views!');
        
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        showLoading(false);
        alert('Error loading data. Please refresh the page.');
    }
}

/**
 * Set up navigation menu
 */
function setupNavigation() {
    const vizButtons = document.querySelectorAll('.viz-btn');
    
    vizButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const vizType = this.dataset.viz;
            
            // Update active button
            vizButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // Switch visualization view
            switchVisualization(vizType);
        });
    });
}

/**
 * Switch between visualization modes
 */
function switchVisualization(vizType) {
    console.log('Switching to visualization:', vizType);
    
    // Hide all views
    document.querySelectorAll('.viz-view').forEach(view => {
        view.classList.remove('active');
    });
    
    // Update state
    AppState.currentMode = vizType;
    
    // Show selected view
    switch(vizType) {
        case 'overview':
            document.getElementById('overview-view').classList.add('active');
            document.getElementById('details-title').textContent = 'Select a country to explore';
            break;
            
        case 'timeseries':
            document.getElementById('timeseries-view').classList.add('active');
            document.getElementById('details-title').textContent = 'Regional Population Trends';
            if (!AppState.data.processed.timeseries) {
                TimeSeriesViz.init(d3.select('#timeseries-chart'), AppState);
            }
            break;
            
        case 'comparison':
            document.getElementById('comparison-view').classList.add('active');
            document.getElementById('details-title').textContent = 'Population Comparison';
            if (!AppState.data.processed.comparison) {
                ComparisonViz.init(d3.select('#comparison-chart'), AppState);
            }
            break;
            
        case 'multiples':
            document.getElementById('multiples-view').classList.add('active');
            document.getElementById('details-title').textContent = 'Regional Birth & Death Rates';
            if (!AppState.data.processed.multiples) {
                SmallMultiplesViz.init(d3.select('#multiples-container'), AppState);
            }
            break;
            
        case 'animation':
            document.getElementById('animation-view').classList.add('active');
            document.getElementById('details-title').textContent = 'Demographic Transition Animation';
            if (!AppState.data.processed.animation) {
                AnimationViz.init(d3.select('#animation-chart'), AppState);
            }
            break;
            
        // NEW ADVANCED VISUALIZATIONS
        case 'radar':
            document.getElementById('radar-view').classList.add('active');
            document.getElementById('details-title').textContent = 'Country DNA Profile';
            if (!AppState.data.processed.radar) {
                RadarChartViz.init(d3.select('#radar-chart'), AppState);
            }
            break;
            
        case 'ridgeline':
            document.getElementById('ridgeline-view').classList.add('active');
            document.getElementById('details-title').textContent = 'Global Ageing Distribution';
            if (!AppState.data.processed.ridgeline) {
                RidgelinePlotViz.init(d3.select('#ridgeline-chart'), AppState);
            }
            break;
            
        case 'growth-drivers':
            document.getElementById('growth-drivers-view').classList.add('active');
            document.getElementById('details-title').textContent = 'Drivers of Population Growth';
            if (!AppState.data.processed.growthDrivers) {
                GrowthDriversViz.init(d3.select('#growth-drivers-chart'), AppState);
            }
            break;
            
        case 'gender-gap':
            document.getElementById('gender-gap-view').classList.add('active');
            document.getElementById('details-title').textContent = 'Life Expectancy Gender Gap';
            if (!AppState.data.processed.genderGap) {
                GenderGapViz.init(d3.select('#gender-gap-chart'), AppState);
            }
            break;
    }
    
    // Dispatch event
    dispatcher.call('visualizationChanged', null, vizType);
}

/**
 * Set up pane maximize/minimize controls
 */
function setupPaneControls() {
    const globeMaxBtn = document.getElementById('globe-maximize');
    const detailsMaxBtn = document.getElementById('details-maximize');
    const globePane = document.getElementById('globe-pane');
    const detailsPane = document.getElementById('details-pane');
    
    globeMaxBtn.addEventListener('click', function() {
        if (AppState.panes.globe === 'normal') {
            // Maximize globe pane
            globePane.classList.add('maximized');
            detailsPane.classList.add('minimized');
            AppState.panes.globe = 'maximized';
            AppState.panes.details = 'minimized';
            this.textContent = '⛶';
            this.title = 'Restore';
            
            // Resize globe
            setTimeout(() => GlobeViz.resize(), 350);
        } else {
            // Restore normal layout
            globePane.classList.remove('maximized');
            detailsPane.classList.remove('minimized');
            AppState.panes.globe = 'normal';
            AppState.panes.details = 'normal';
            this.textContent = '⛶';
            this.title = 'Maximize';
            
            // Resize globe
            setTimeout(() => GlobeViz.resize(), 350);
        }
    });
    
    detailsMaxBtn.addEventListener('click', function() {
        if (AppState.panes.details === 'normal') {
            // Maximize details pane
            detailsPane.classList.add('maximized');
            globePane.classList.add('minimized');
            AppState.panes.details = 'maximized';
            AppState.panes.globe = 'minimized';
            this.textContent = '⛶';
            this.title = 'Restore';
        } else {
            // Restore normal layout
            detailsPane.classList.remove('maximized');
            globePane.classList.remove('minimized');
            AppState.panes.details = 'normal';
            AppState.panes.globe = 'normal';
            this.textContent = '⛶';
            this.title = 'Maximize';
            
            // Resize globe
            setTimeout(() => GlobeViz.resize(), 350);
        }
    });
}

/**
 * Set up info modal
 */
function setupModal() {
    const infoBtn = document.getElementById('info-btn');
    const modal = document.getElementById('info-modal');
    const closeBtn = modal.querySelector('.modal-close');
    
    infoBtn.addEventListener('click', () => {
        modal.classList.add('active');
    });
    
    closeBtn.addEventListener('click', () => {
        modal.classList.remove('active');
    });
    
    // Close on outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
}

/**
 * Set up event listeners for coordinated views (BRUSHING & LINKING)
 */
function setupEventListeners() {
    // Listen for country selection from globe (PRIMARY INTERACTION)
    dispatcher.on('countrySelected', function(countryCode, countryName) {
        console.log('🎯 COORDINATED VIEW: Country selected:', countryName);
        
        AppState.selectedCountry = countryName;
        AppState.selectedCountryCode = countryCode;
        
        // Only show country detail view if in overview mode
        if (AppState.currentMode === 'overview') {
            showCountryDetail(countryCode, countryName);
        }
        
        // BRUSHING & LINKING: Highlight country in all other visualizations
        highlightCountryInAllViews(countryName);
    });
    
    // Listen for country highlighting (hover)
    dispatcher.on('countryHighlighted', function(countryName) {
        console.log('🔦 Highlighting country:', countryName);
        highlightCountryInAllViews(countryName);
    });
    
    dispatcher.on('countryUnhighlighted', function() {
        unhighlightAllCountries();
    });
    
    // Listen for year changes
    dispatcher.on('yearChanged', function(year) {
        AppState.currentYear = year;
        
        // Sync year across animated visualizations
        if (AnimationViz.update) {
            AnimationViz.update(year);
        }
        if (GrowthDriversViz.update) {
            GrowthDriversViz.update(year);
        }
    });
    
    // Listen for mode changes (population, density, etc.)
    dispatcher.on('modeChanged', function(mode) {
        AppState.currentVisualization = mode;
    });
}

/**
 * COORDINATED VIEWS: Highlight country across all visualizations
 */
function highlightCountryInAllViews(countryName) {
    // Highlight in Animation view
    if (AnimationViz.svg && AnimationViz.highlightCountry) {
        AnimationViz.highlightCountry(countryName);
    }
    
    // Highlight in Growth Drivers view
    if (GrowthDriversViz.svg && GrowthDriversViz.highlightCountry) {
        GrowthDriversViz.highlightCountry(countryName);
    }
    
    // Update Radar Chart to show this country
    if (RadarChartViz.svg && RadarChartViz.highlightCountry) {
        RadarChartViz.highlightCountry(countryName);
    }
    
    // Could also highlight in comparison, timeseries, etc.
    console.log(`✓ Coordinated highlight applied to ${countryName}`);
}

/**
 * COORDINATED VIEWS: Remove highlights
 */
function unhighlightAllCountries() {
    // Remove highlights from all visualizations
    if (AnimationViz.svg) {
        AnimationViz.svg.selectAll('.circle')
            .attr('stroke', '#333')
            .attr('stroke-width', 1);
    }
    
    if (GrowthDriversViz.svg) {
        GrowthDriversViz.svg.selectAll('.growth-circle')
            .attr('stroke', '#333')
            .attr('stroke-width', 1)
            .attr('fill-opacity', 0.7);
    }
}

/**
 * Show country detail view - FIXED DATA SOURCE & NORMALIZATION
 */
function showCountryDetail(countryCode, countryName) {
    const normalizedName = normalizeCountryName(countryName);
    
    // Switch to country detail view
    document.querySelectorAll('.viz-view').forEach(view => {
        view.classList.remove('active');
    });
    document.getElementById('country-detail-view').classList.add('active');
    
    // Update header
    document.getElementById('details-title').textContent = countryName;
    document.getElementById('detail-country-name').textContent = countryName;
    document.getElementById('detail-flag').src = `img/flags/${countryCode}.png`;
    
    // FIXED: Use the Full Timeseries data which contains the Graduate Level Metrics
    const allCountryData = DataLoader.getCountryTimeSeriesData();
    const countryData = allCountryData[normalizedName];
    
    if (!countryData || countryData.length === 0) {
        console.warn('No demographic data found for:', normalizedName);
        document.getElementById('detail-country-stats').innerHTML = '<span style="color:red">Data unavailable for this country.</span>';
        return;
    }
    
    // Get latest data point
    const latestData = countryData[countryData.length - 1];
    
    // Update stats
    document.getElementById('detail-country-stats').innerHTML = `
        Population: <strong>${DataLoader.formatPopulation(latestData.population)}</strong> | 
        Density: <strong>${latestData.density.toFixed(1)}/km²</strong> | 
        Median Age: <strong>${latestData.medianAge.toFixed(1)}y</strong> |
        Birth Rate: <strong>${latestData.birthRate?.toFixed(1) || 'N/A'}</strong>
    `;
    
    // Draw charts with a slight delay for container sizing
    setTimeout(() => {
        // 1. Original 4 Metrics
        drawDetailChart(countryData, 'population', 'population-chart', 'Population');
        drawDetailChart(countryData, 'density', 'density-chart', 'Density (per km²)');
        drawDetailChart(countryData, 'sexRatio', 'sex-ratio-chart', 'Sex Ratio');
        drawDetailChart(countryData, 'medianAge', 'median-age-chart', 'Median Age (years)');
        
        // 2. NEW: 5 Graduate-Level Multi-Metric Charts
        drawDetailChart(countryData, [
            {key: 'birthRate', label: 'Birth Rate', color: '#4daf4a'},
            {key: 'deathRate', label: 'Death Rate', color: '#e41a1c'}
        ], 'transition-detail-chart', 'Rate (per 1,000)');
        
        drawDetailChart(countryData, [
            {key: 'naturalChange', label: 'Natural Change', color: '#4daf4a'},
            {key: 'migrationRate', label: 'Net Migration', color: '#984ea3'}
        ], 'growth-detail-chart', 'Rate (per 1,000)');
        
        drawDetailChart(countryData, [
            {key: 'lifeExpectancyMale', label: 'Male', color: '#377eb8'},
            {key: 'lifeExpectancyFemale', label: 'Female', color: '#e41a1c'}
        ], 'longevity-detail-chart', 'Life Expectancy (years)');
        
        drawDetailChart(countryData, [
            {key: 'fertilityRate', label: 'Fertility', color: '#ff7f00'},
            {key: 'meanAgeChildbearing', label: 'Childbearing Age', color: '#984ea3'}
        ], 'fertility-detail-chart', 'Rate / Age');
        
        drawDetailChart(countryData, [
            {key: 'infantMortality', label: 'Infant', color: '#e41a1c'},
            {key: 'underFiveMortality', label: 'Under-5', color: '#ff7f00'}
        ], 'healthcare-detail-chart', 'Mortality (per 1,000 births)');
        
        // 3. NEW: DNA Profile Radar Chart
        drawDetailRadarChart(normalizedName);
    }, 100);
    
    // Set up close button
    document.getElementById('close-detail-btn').onclick = function() {
        // Return to overview
        document.getElementById('country-detail-view').classList.remove('active');
        document.getElementById('overview-view').classList.add('active');
        document.getElementById('details-title').textContent = 'Select a country to explore';
        
        // Update nav
        document.querySelectorAll('.viz-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.viz-btn[data-viz="overview"]').classList.add('active');
        
        AppState.selectedCountry = null;
        AppState.selectedCountryCode = null;
        
        // Clear highlights
        unhighlightAllCountries();
    };
}

/**
 * Draw line chart for country detail
 */
/**
 * Enhanced drawDetailChart to support single or multiple metric lines
 */
function drawDetailChart(data, metrics, chartId, yLabel) {
    // Convert single string metric to standardized array format
    if (typeof metrics === 'string') {
        metrics = [{key: metrics, color: '#667eea', label: yLabel, showArea: true}];
    }
    
    const svg = d3.select(`#${chartId}`);
    svg.selectAll("*").remove();
    const container = svg.node().parentElement;
    const width_full = container.getBoundingClientRect().width;
    const height_full = 250;
    const margin = {top: 20, right: 30, bottom: 40, left: 60};
    const width = width_full - margin.left - margin.right;
    const height = height_full - margin.top - margin.bottom;
    
    svg.attr("width", width_full).attr("height", height_full);
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    
    const x = d3.scaleLinear().domain(d3.extent(data, d => d.year)).range([0, width]);
    const maxVal = d3.max(data, d => d3.max(metrics.map(m => d[m.key] || 0))) * 1.1;
    const y = d3.scaleLinear().domain([0, maxVal || 100]).range([height, 0]);
    
    // Draw Grid
    g.append("g").attr("class", "grid").selectAll("line").data(y.ticks(5)).enter()
     .append("line").attr("x1", 0).attr("x2", width).attr("y1", d => y(d)).attr("y2", d => y(d))
     .attr("stroke", "#e2e8f0").attr("stroke-dasharray", "2,2");

    metrics.forEach(m => {
        const line = d3.line().x(d => x(d.year)).y(d => y(d[m.key] || 0)).curve(d3.curveMonotoneX);
        
        // Area fill (only for single metric charts to avoid overlap confusion)
        if (m.showArea) {
            const area = d3.area().x(d => x(d.year)).y0(height).y1(d => y(d[m.key])).curve(d3.curveMonotoneX);
            g.append("path").datum(data).attr("fill", m.color).attr("fill-opacity", 0.1).attr("d", area);
        }
        
        g.append("path").datum(data).attr("fill", "none").attr("stroke", m.color).attr("stroke-width", 2).attr("d", line);
        
        // Add legend label at the end of the line
        const last = data[data.length - 1];
        g.append("text").attr("x", x(last.year)).attr("y", y(last[m.key])).attr("dx", -5).attr("dy", -5)
         .attr("fill", m.color).style("font-size", "9px").style("text-anchor", "end").text(m.label);
    });

    g.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).ticks(5).tickFormat(d3.format("d")));
    g.append("g").call(d3.axisLeft(y).ticks(5).tickFormat(d => (metrics[0].key === 'population' ? d3.format(".2s")(d) : d3.format(".1f")(d))));
}

/**
 * Dedicated Radar Chart drawing for the Detail View
 */
function drawDetailRadarChart(normalizedName) {
    const radarData = DataLoader.getRadarChartData();
    if (!radarData || !radarData.countries[normalizedName]) return;
    
    const svg = d3.select('#detail-radar-chart');
    svg.selectAll("*").remove();
    const width = 400, height = 400, radius = 150;
    svg.attr("width", width).attr("height", height);
    const g = svg.append("g").attr("transform", `translate(${width/2},${height/2})`);
    
    const indicators = Object.keys(radarData.indicators);
    const angleSlice = (Math.PI * 2) / indicators.length;
    
    // Draw grid circles
    [0.2, 0.4, 0.6, 0.8, 1].forEach(v => {
        g.append("circle").attr("r", radius * v).attr("fill", "none").attr("stroke", "#e2e8f0");
    });

    // Draw axes and labels
    indicators.forEach((ind, i) => {
        const angle = angleSlice * i - Math.PI / 2;
        g.append("line").attr("x1", 0).attr("y1", 0).attr("x2", Math.cos(angle) * radius).attr("y2", Math.sin(angle) * radius).attr("stroke", "#cbd5e0");
        g.append("text").attr("x", Math.cos(angle) * (radius + 20)).attr("y", Math.sin(angle) * (radius + 20))
         .attr("text-anchor", "middle").style("font-size", "10px").text(radarData.indicators[ind]);
    });

    const countryValues = radarData.countries[normalizedName].values;
    const pathData = indicators.map((ind, i) => {
        const val = countryValues[ind].normalized;
        const angle = angleSlice * i - Math.PI / 2;
        return [Math.cos(angle) * radius * val, Math.sin(angle) * radius * val];
    });

    g.append("path").datum(pathData).attr("d", d3.line().curve(d3.curveLinearClosed))
     .attr("fill", "#e41a1c").attr("fill-opacity", 0.3).attr("stroke", "#e41a1c").attr("stroke-width", 3);
}

/**
 * Show/hide loading screen
 */
function showLoading(show) {
    const loadingScreen = document.getElementById('loading-screen');
    if (show) {
        loadingScreen.classList.remove('hidden');
    } else {
        loadingScreen.classList.add('hidden');
    }
}

/**
 * Handle window resize
 */
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        if (GlobeViz.resize) {
            GlobeViz.resize();
        }
    }, 250);
});

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initApp);