/**
 * Interactive 3D Globe Visualization
 * Adapted from original globe code for integrated dashboard
 */

const GlobeViz = {
    // Configuration
    config: {
        width: null,
        height: null,
        radius: null,
        center: null,
        rotationSensitivity: 60,
        zoomSensitivity: 0.5
    },
    
    // State
    state: {
        currentRotation: [0, -25],
        currentZoomScale: null,
        currentViewMode: '3d',
        rotationTimer: null,
        animationTimer: null,
        isPlaying: false,
        cachedGeoJson: null,
        cachedData: null
    },
    
    // D3 components
    svg: null,
    projection: null,
    pathGenerator: null,
    
    // Color schemes
    colorSchemes: {
        population: d3.interpolateReds,
        density: d3.interpolateBlues,
        'sex-ratio': d3.interpolatePiYG,
        'median-age': d3.interpolateYlOrRd,
        'demographic-transition': d3.interpolateGreens,
        'growth-drivers': d3.interpolatePurples,
        'longevity-gap': d3.interpolateOranges,
        'fertility-health': d3.interpolatePurples,
        'healthcare-quality': d3.interpolateReds,
        'gender-gap': d3.interpolateRdBu  // Diverging: Blue (negative/male advantage) to Red (positive/female advantage)
    },
    
    /**
     * Initialize globe visualization
     */
    init(container, appState) {
        console.log('Initializing globe visualization...');
        
        // Calculate dimensions
        this.updateDimensions();
        
        // Store app state reference
        this.appState = appState;
        
        // Cache data
        this.state.cachedGeoJson = appState.data.geoJson;
        
        // Set up controls
        this.setupControls();
        
        // Draw initial globe
        this.draw();
        
        console.log('✓ Globe initialized');
    },
    
    /**
     * Update dimensions based on container size
     */
    updateDimensions() {
        const container = document.getElementById('globe-container');
        const rect = container.getBoundingClientRect();
        
        this.config.width = rect.width;
        this.config.height = Math.max(400, rect.height);
        this.config.radius = Math.min(this.config.width, this.config.height) / 2.5;
        this.config.center = [this.config.width / 2, this.config.height / 2];
    },
    
    /**
     * Set up control handlers
     */
    setupControls() {
        // Mode selector dropdown
        const modeSelector = document.getElementById('globe-mode-selector');
        modeSelector.addEventListener('change', (e) => {
            const mode = e.target.value;
            this.appState.currentVisualization = mode;
            
            // Update globe colors
            this.updateColors(mode);
            
            // Dispatch event to sync with timeseries
            dispatcher.call('modeChanged', null, mode);
        });
        
        // Year slider
        const yearSlider = document.getElementById('year-slider');
        const currentYearDisplay = document.getElementById('current-year');
        
        yearSlider.addEventListener('input', (e) => {
            const year = parseInt(e.target.value);
            currentYearDisplay.textContent = year;
        });
        
        yearSlider.addEventListener('change', (e) => {
            const year = parseInt(e.target.value);
            this.updateYear(year);
            dispatcher.call('yearChanged', null, year);
        });
        
        // Playback controls
        document.getElementById('play-btn').addEventListener('click', () => this.play());
        document.getElementById('pause-btn').addEventListener('click', () => this.pause());
        document.getElementById('reset-btn').addEventListener('click', () => this.reset());
        
        // View toggle (3D/2D)
        document.getElementById('view-toggle-btn').addEventListener('click', () => this.toggleView());
    },
    
    /**
     * Draw the globe
     */
    draw() {
        // Clear existing
        d3.select('#globe-container').selectAll('*').remove();
        
        const year = this.appState.currentYear;
        const mode = this.appState.currentVisualization;
        
        // Get data for current year
        const contextData = DataLoader.processGlobeData(year, mode);
        this.state.cachedData = contextData;
        
        // Create color palette
        const colorPalette = this.createColorPalette(contextData, mode);
        
        // Set up projection
        if (this.state.currentViewMode === '3d') {
            this.projection = d3.geoOrthographic()
                .scale(this.state.currentZoomScale || this.config.radius)
                .center([0, 0])
                .rotate(this.state.currentRotation)
                .translate(this.config.center);
        } else {
            this.projection = d3.geoEquirectangular()
                .scale(this.state.currentZoomScale || (this.config.radius * 0.8))
                .center([0, 0])
                .translate(this.config.center);
        }
        
        const initialScale = this.projection.scale();
        
        // Create SVG
        this.svg = d3.select('#globe-container')
            .append('svg')
            .attr('width', this.config.width)
            .attr('height', this.config.height);
        
        // Path generator
        this.pathGenerator = d3.geoPath().projection(this.projection);
        
        // Draw globe outline (3D only)
        if (this.state.currentViewMode === '3d') {
            this.svg.append('circle')
                .attr('cx', this.config.width / 2)
                .attr('cy', this.config.height / 2)
                .attr('r', this.projection.scale())
                .attr('fill', '#f0f4f8')
                .attr('stroke', '#cbd5e0')
                .attr('stroke-width', 1);
        }
        
        // Create map group
        const globeMap = this.svg.append('g');
        
        // Set up drag behavior
        this.svg.call(this.createDrag());
        
        // Set up zoom behavior
        this.configureZoom(initialScale);
        
        // Draw countries
        const self = this;
        globeMap.append('g')
            .attr('class', 'countries')
            .selectAll('path')
            .data(this.state.cachedGeoJson.features)
            .enter().append('path')
            .attr('d', this.pathGenerator)
            .attr('fill', country => this.getColor(country, contextData, colorPalette))
            .attr('stroke', '#fff')
            .attr('stroke-width', 0.5)
            .on('mouseover', function(country) { self.onCountryMouseOver(this, country, contextData); })
            .on('mousemove', function() { self.onCountryMouseMove(); })
            .on('mouseout', function() { self.onCountryMouseOut(this); })
            .on('click', (country) => this.onCountryClick(country));
        
        // Draw legend
        this.drawLegend(colorPalette, mode);
        
        // Start rotation (3D only)
        if (this.state.currentViewMode === '3d') {
            this.rotateGlobe();
        }
    },
    
    /**
     * Create color palette for current mode
     */
    createColorPalette(data, mode) {
        const colorScheme = this.colorSchemes[mode];
        
        let dataValues;
        switch(mode) {
            case 'population':
                dataValues = data.map(d => d.population_number);
                break;
            case 'density':
                dataValues = data.map(d => d.population_density_number);
                break;
            case 'sex-ratio':
                dataValues = data.map(d => d.sex_ratio_number);
                break;
            case 'median-age':
                dataValues = data.map(d => d.median_age_number);
                break;
            case 'demographic-transition':
                dataValues = data.map(d => d.birth_rate_number || 0);
                break;
            case 'growth-drivers':
                dataValues = data.map(d => d.natural_change_number || 0);
                break;
            case 'longevity-gap':
                dataValues = data.map(d => d.life_expectancy_number || 0);
                break;
            case 'fertility-health':
                dataValues = data.map(d => d.fertility_rate_number || 0);
                break;
            case 'healthcare-quality':
                dataValues = data.map(d => d.infant_mortality_number || 0);
                break;
            case 'gender-gap':
                // Calculate gender gap for all countries
                dataValues = data.map(d => {
                    const female = d.life_expectancy_female_number || 0;
                    const male = d.life_expectancy_male_number || 0;
                    return female - male;
                });
                break;
            default:
                dataValues = data.map(d => d.population_number);
        }
        
        // Handle gender gap with diverging scale (can be negative)
        if (mode === 'gender-gap') {
            const [minValue, maxValue] = d3.extent(dataValues);
            const absMax = Math.max(Math.abs(minValue), Math.abs(maxValue));
            return d3.scaleSequential(colorScheme)
                .domain([-absMax, absMax]);  // Symmetric domain for diverging scale
        }
        
        const [minValue, maxValue] = d3.extent(dataValues.filter(v => v > 0));
        
        // Use log scale for population and density
        if (mode === 'population' || mode === 'density') {
            return d3.scaleLog()
                .domain([Math.max(1, minValue), maxValue])
                .range([0, 1])
                .interpolate(() => colorScheme);
        } else {
            return d3.scaleSequential(colorScheme)
                .domain([minValue, maxValue]);
        }
    },
    
    /**
     * Get color for a country
     */
    getColor(geoFeature, contextData, colorPalette) {
        const countryData = contextData.find(d => d.alpha3_code === geoFeature.id);
        if (!countryData) return '#ccc';
        
        const mode = this.appState.currentVisualization;
        let value;
        
        switch(mode) {
            case 'population':
                value = countryData.population_number;
                break;
            case 'density':
                value = countryData.population_density_number;
                break;
            case 'sex-ratio':
                value = countryData.sex_ratio_number;
                break;
            case 'median-age':
                value = countryData.median_age_number;
                break;
            case 'demographic-transition':
                value = countryData.birth_rate_number || 0;
                break;
            case 'growth-drivers':
                value = countryData.natural_change_number || 0;
                break;
            case 'longevity-gap':
                value = countryData.life_expectancy_number || 0;
                break;
            case 'fertility-health':
                value = countryData.fertility_rate_number || 0;
                break;
            case 'healthcare-quality':
                value = countryData.infant_mortality_number || 0;
                break;
            case 'gender-gap':
                // Calculate gender gap from life expectancy data
                const femaleLE = countryData.life_expectancy_female_number || 0;
                const maleLE = countryData.life_expectancy_male_number || 0;
                value = femaleLE - maleLE;
                break;
            default:
                value = countryData.population_number;
        }
        
        // For gender-gap, allow negative values; for others, filter out zero/negative
        if (mode === 'gender-gap') {
            return (value !== 0) ? colorPalette(value) : '#ccc';
        }
        return value > 0 ? colorPalette(value) : '#ccc';
    },
    
    /**
     * Handle country mouse over
     */
    onCountryMouseOver(element, country, contextData) {
        // Highlight country
        d3.select(element)
            .style('opacity', 0.7)
            .style('stroke', '#333')
            .style('stroke-width', '1.5px');
        
        // Show tooltip
        const tooltip = d3.select('#tooltip');
        const countryCode = country.id;
        const countryName = country.properties.name;
        
        const countryData = contextData.find(d => d.alpha3_code === countryCode);
        
        if (countryData) {
            const mode = this.appState.currentVisualization;
            let modeLabel = '';
            let modeSpecific = '';
            
            // Add mode-specific data with descriptive labels
            switch(mode) {
                case 'population':
                    modeLabel = 'Population';
                    modeSpecific = `
                        <div style="display: flex; justify-content: space-between; gap: 20px;">
                            <span>Total Population:</span> <strong>${countryData.population}</strong>
                        </div>`;
                    break;
                case 'density':
                    modeLabel = 'Population Density';
                    modeSpecific = `
                        <div style="display: flex; justify-content: space-between; gap: 20px;">
                            <span>Density:</span> <strong>${countryData.population_density} per km²</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; gap: 20px;">
                            <span>Population:</span> <strong>${countryData.population}</strong>
                        </div>`;
                    break;
                case 'sex-ratio':
                    modeLabel = 'Sex Ratio';
                    modeSpecific = `
                        <div style="display: flex; justify-content: space-between; gap: 20px;">
                            <span>Sex Ratio:</span> <strong>${countryData.sex_ratio}</strong>
                        </div>
                        <div style="font-size: 11px; color: #ccc; margin-top: 4px;">Males per 100 females</div>`;
                    break;
                case 'median-age':
                    modeLabel = 'Median Age';
                    modeSpecific = `
                        <div style="display: flex; justify-content: space-between; gap: 20px;">
                            <span>Median Age:</span> <strong>${countryData.median_age} years</strong>
                        </div>
                        <div style="font-size: 11px; color: #ccc; margin-top: 4px;">Half the population is older, half younger</div>`;
                    break;
                case 'demographic-transition':
                    modeLabel = 'Demographic Transition';
                    modeSpecific = `
                        <div style="display: flex; justify-content: space-between; gap: 20px;">
                            <span>Birth Rate:</span> <strong>${countryData.birth_rate} per 1,000</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; gap: 20px;">
                            <span>Death Rate:</span> <strong>${countryData.death_rate} per 1,000</strong>
                        </div>`;
                    break;
                case 'growth-drivers':
                    modeLabel = 'Population Growth Drivers';
                    modeSpecific = `
                        <div style="display: flex; justify-content: space-between; gap: 20px;">
                            <span>Natural Change:</span> <strong>${countryData.natural_change} per 1,000</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; gap: 20px;">
                            <span>Migration Rate:</span> <strong>${countryData.migration_rate} per 1,000</strong>
                        </div>`;
                    break;
                case 'longevity-gap':
                    modeLabel = 'Life Expectancy';
                    modeSpecific = `
                        <div style="display: flex; justify-content: space-between; gap: 20px;">
                            <span>Life Expectancy:</span> <strong>${countryData.life_expectancy} years</strong>
                        </div>`;
                    break;
                case 'fertility-health':
                    modeLabel = 'Fertility & Health';
                    modeSpecific = `
                        <div style="display: flex; justify-content: space-between; gap: 20px;">
                            <span>Fertility Rate:</span> <strong>${countryData.fertility_rate} births/woman</strong>
                        </div>`;
                    break;
                case 'healthcare-quality':
                    modeLabel = 'Healthcare Quality';
                    modeSpecific = `
                        <div style="display: flex; justify-content: space-between; gap: 20px;">
                            <span>Infant Mortality:</span> <strong>${countryData.infant_mortality} per 1,000</strong>
                        </div>`;
                    break;
                case 'gender-gap':
                    modeLabel = 'Life Expectancy Gender Gap';
                    const femaleLE = countryData.life_expectancy_female_number || 0;
                    const maleLE = countryData.life_expectancy_male_number || 0;
                    const gap = femaleLE - maleLE;
                    const gapDescription = gap > 0 ? 
                        `Females live ${gap.toFixed(1)} years longer` : 
                        `Males live ${Math.abs(gap).toFixed(1)} years longer`;
                    modeSpecific = `
                        <div style="display: flex; justify-content: space-between; gap: 20px;">
                            <span>Female:</span> <strong>${femaleLE.toFixed(1)} years</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; gap: 20px;">
                            <span>Male:</span> <strong>${maleLE.toFixed(1)} years</strong>
                        </div>
                        <div style="background: ${gap > 0 ? 'rgba(255, 243, 205, 0.2)' : 'rgba(209, 236, 241, 0.2)'}; padding: 6px; margin-top: 6px; border-radius: 3px; border-left: 3px solid ${gap > 0 ? '#ff9800' : '#03a9f4'};">
                            <strong>Gap:</strong> ${gapDescription}
                        </div>`;
                    break;
            }
            
            // Check if country flag exists
            const flagPath = `img/flags/${countryCode}.png`;
            
            tooltip
                .style('display', 'block')
                .style('opacity', 1)
                .style('left', (d3.event.pageX + 15) + 'px')
                .style('top', (d3.event.pageY - 10) + 'px')
                .html(`
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 6px 10px; margin: -10px -12px 10px -12px; border-radius: 6px 6px 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">
                        ${modeLabel}
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #555;">
                        <img src="${flagPath}" alt="" onerror="this.style.display='none'" style="width: 28px; height: 20px; border-radius: 2px; object-fit: cover; box-shadow: 0 1px 3px rgba(0,0,0,0.3);">
                        <div style="font-weight: 700; font-size: 15px; color: #fff;">${countryName}</div>
                    </div>
                    <div style="font-size: 13px; line-height: 1.6;">
                        ${modeSpecific}
                    </div>
                `);
        }
    },
    
    /**
     * Handle country mouse move
     */
    onCountryMouseMove() {
        const tooltip = d3.select('#tooltip');
        tooltip
            .style('left', (d3.event.pageX + 15) + 'px')
            .style('top', (d3.event.pageY - 10) + 'px');
    },
    
    /**
     * Handle country mouse out
     */
    onCountryMouseOut(element) {
        d3.select(element)
            .style('opacity', 1)
            .style('stroke', '#fff')
            .style('stroke-width', '0.5px');
        
        d3.select('#tooltip')
            .style('opacity', 0)
            .style('display', 'none');
    },
    
    /**
     * Handle country click
     */
    onCountryClick(country) {
        d3.event.stopPropagation();
        
        const countryCode = country.id;
        const countryName = country.properties.name;
        
        console.log('Country clicked:', countryName, countryCode);
        
        // Dispatch event
        dispatcher.call('countrySelected', null, countryCode, countryName);
    },
    
    /**
     * Draw color legend
     */
    drawLegend(colorPalette, mode) {
        // 1. Select the legend container and clear previous contents to prevent stacking
        const colorScale = d3.select('#color-scale');
        colorScale.selectAll('*').remove();
        
        const legendWidth = colorScale.node().getBoundingClientRect().width;
        const colorScheme = this.colorSchemes[mode];
        
        // Create gradient
        const gradientStops = d3.range(0, 1.01, 0.01).map(t => colorScheme(t));
        const gradientString = gradientStops.map((color, i) => 
            `${color} ${i}%`
        ).join(', ');
        colorScale.style('background', `linear-gradient(to right, ${gradientString})`);
        
        // Determine scale type
        const isLogScale = mode === 'population' || mode === 'density';
        const isDivergingScale = mode === 'gender-gap';
        
        // 2. Use .nice() on scales to get rounded, clean tick intervals
        let xScale;
        if (isLogScale) {
            xScale = d3.scaleLog()
                .domain(colorPalette.domain())
                .nice()
                .range([0, legendWidth]);
        } else {
            xScale = d3.scaleLinear()
                .domain(colorPalette.domain())
                .nice()
                .range([0, legendWidth]);
        }
        
        // 3. Force 5 specific labels to prevent cluttering
        const legendAxis = d3.axisBottom(xScale)
            .ticks(5)
            .tickSize(10)
            .tickFormat(d => {
                switch(mode) {
                    case 'sex-ratio':
                        return d.toFixed(1);
                    case 'median-age':
                        return d.toFixed(0) + 'y';
                    case 'demographic-transition':
                    case 'growth-drivers':
                        return d.toFixed(1);
                    case 'longevity-gap':
                        return d.toFixed(0) + 'y';
                    case 'fertility-health':
                        return d.toFixed(1);
                    case 'healthcare-quality':
                        return d.toFixed(0);
                    case 'gender-gap':
                        return d > 0 ? '+' + d.toFixed(1) + 'y' : d.toFixed(1) + 'y';
                    default:
                        return d3.format('.2s')(d);
                }
            });
        
        // 4. Create a clean SVG for the new legend
        const legendSvg = colorScale.append('svg')
            .attr('width', '100%')
            .attr('height', 60);
        
        const legendHeight = legendSvg.node().getBoundingClientRect().height;
        
        legendSvg.append('g')
            .attr('transform', `translate(0, ${legendHeight / 4})`)
            .call(legendAxis)
            .selectAll('text')
            .style('fill', '#444')
            .style('font-size', '11px')
            .style('font-weight', '500');
        
        // Add center marker for diverging scales
        if (isDivergingScale) {
            legendSvg.append('line')
                .attr('x1', legendWidth / 2)
                .attr('x2', legendWidth / 2)
                .attr('y1', 0)
                .attr('y2', legendHeight / 2)
                .attr('stroke', '#333')
                .attr('stroke-width', 2)
                .attr('stroke-dasharray', '3,3');
        }
    },
    
    /**
     * Create drag behavior
     */
    createDrag() {
        if (this.state.currentViewMode === '2d') {
            return d3.drag();
        }
        
        const self = this;
        
        return d3.drag()
            .on('start', function() {
                if (self.state.rotationTimer) {
                    self.state.rotationTimer.stop();
                }
            })
            .on('drag', function() {
                const rotate = self.projection.rotate();
                const rotationAdjustmentFactor = self.config.rotationSensitivity / self.projection.scale();
                
                self.projection.rotate([
                    rotate[0] + d3.event.dx * rotationAdjustmentFactor,
                    rotate[1] - d3.event.dy * rotationAdjustmentFactor
                ]);
                
                self.state.currentRotation = self.projection.rotate();
                
                self.pathGenerator = d3.geoPath().projection(self.projection);
                self.svg.selectAll('path').attr('d', self.pathGenerator);
            })
            .on('end', function() {
                self.state.currentRotation = self.projection.rotate();
                self.rotateGlobe();
            });
    },
    
    /**
     * Configure zoom behavior
     */
    configureZoom(initialScale) {
        const self = this;
        
        this.svg.call(d3.zoom()
            .on('zoom', function() {
                if (d3.event.transform.k > self.config.zoomSensitivity) {
                    const newScale = initialScale * d3.event.transform.k;
                    self.projection.scale(newScale);
                    self.state.currentZoomScale = newScale;
                    
                    const path = d3.geoPath().projection(self.projection);
                    self.svg.selectAll('path').attr('d', path);
                    
                    if (self.state.currentViewMode === '3d') {
                        self.svg.selectAll('circle').attr('r', self.projection.scale());
                    }
                } else {
                    d3.event.transform.k = self.config.zoomSensitivity;
                }
            }));
    },
    
    /**
     * Rotate globe automatically
     */
    rotateGlobe() {
        const self = this;
        
        if (this.state.rotationTimer) {
            this.state.rotationTimer.stop();
        }
        
        this.state.rotationTimer = d3.timer(function() {
            const rotate = self.projection.rotate();
            const rotationAdjustmentFactor = self.config.rotationSensitivity / self.projection.scale();
            
            self.projection.rotate([
                rotate[0] - 0.15 * rotationAdjustmentFactor,
                rotate[1]
            ]);
            
            self.state.currentRotation = self.projection.rotate();
            
            self.pathGenerator = d3.geoPath().projection(self.projection);
            self.svg.selectAll('path').attr('d', self.pathGenerator);
        });
    },
    
    /**
     * Update globe for new year
     */
    updateYear(year) {
        this.appState.currentYear = year;
        
        // Get new data
        const mode = this.appState.currentVisualization;
        const contextData = DataLoader.processGlobeData(year, mode);
        this.state.cachedData = contextData;
        
        // Update colors
        const colorPalette = this.createColorPalette(contextData, mode);
        
        this.svg.selectAll('.countries path')
            .transition()
            .duration(300)
            .attr('fill', country => this.getColor(country, contextData, colorPalette));
        
        this.drawLegend(colorPalette, mode);
    },
    
    /**
     * Update colors for mode change
     */
    updateColors(mode) {
        const year = this.appState.currentYear;
        const contextData = DataLoader.processGlobeData(year, mode);
        this.state.cachedData = contextData;
        
        const colorPalette = this.createColorPalette(contextData, mode);
        
        this.svg.selectAll('.countries path')
            .transition()
            .duration(300)
            .attr('fill', country => this.getColor(country, contextData, colorPalette));
        
        this.drawLegend(colorPalette, mode);
    },
    
    /**
     * Play animation
     */
    play() {
        if (this.state.isPlaying) return;
        
        this.state.isPlaying = true;
        document.getElementById('play-btn').style.display = 'none';
        document.getElementById('pause-btn').style.display = 'inline-block';
        
        const yearSlider = document.getElementById('year-slider');
        const currentYearDisplay = document.getElementById('current-year');
        
        this.state.animationTimer = setInterval(() => {
            let year = this.appState.currentYear;
            if (year < 2023) {
                year++;
                this.updateYear(year);
                yearSlider.value = year;
                currentYearDisplay.textContent = year;
                dispatcher.call('yearChanged', null, year);
            } else {
                this.pause();
            }
        }, 500);
    },
    
    /**
     * Pause animation
     */
    pause() {
        this.state.isPlaying = false;
        document.getElementById('play-btn').style.display = 'inline-block';
        document.getElementById('pause-btn').style.display = 'none';
        clearInterval(this.state.animationTimer);
    },
    
    /**
     * Reset to 2023
     */
    reset() {
        if (this.state.isPlaying) {
            this.pause();
        }
        
        this.updateYear(2023);
        document.getElementById('year-slider').value = 2023;
        document.getElementById('current-year').textContent = 2023;
        dispatcher.call('yearChanged', null, 2023);
    },
    
    /**
     * Toggle between 3D and 2D view
     */
    toggleView() {
        // Stop rotation if active
        if (this.state.rotationTimer) {
            this.state.rotationTimer.stop();
        }
        
        // Toggle view mode
        this.state.currentViewMode = this.state.currentViewMode === '3d' ? '2d' : '3d';
        
        // Reset zoom scale
        this.state.currentZoomScale = null;
        
        // Update button text
        const toggleText = document.getElementById('toggle-text');
        toggleText.textContent = this.state.currentViewMode === '3d' ? 
            'Map' : 'Globe';
        
        // Redraw
        this.draw();
    },
    
    /**
     * Resize globe
     */
    resize() {
        // Stop rotation if active
        if (this.state.rotationTimer) {
            this.state.rotationTimer.stop();
        }
        
        // Update dimensions
        this.updateDimensions();
        
        // Reset zoom scale
        this.state.currentZoomScale = null;
        
        // Redraw
        this.draw();
    }
};