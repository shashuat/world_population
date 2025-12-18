/**
 * Time Series Visualization - GRADUATE LEVEL
 * Supports multiple visualization modes with demographic storytelling
 * Toggleable regions and countries with dynamic y-axis
 * Includes logarithmic scale option for mortality rates
 */

const TimeSeriesViz = {
    // Configuration
    margin: {top: 20, right: 150, bottom: 60, left: 80},
    svg: null,
    width: null,
    height: null,
    xScale: null,
    yScale: null,
    colorScale: null,
    selectedRegions: new Set(),
    selectedCountries: new Set(),
    countryTimeSeriesData: null,
    regionalData: null,
    currentMode: 'population',
    useLogScale: false,
    appState: null,
    
    // Visualization modes with their metrics
    visualizationModes: {
        // Original 4 modes
        population: {
            title: 'Population Trends (1950-2023)',
            description: 'Population size across regions and countries',
            metrics: [{
                key: 'population',
                label: 'Population (thousands)',
                color: '#377eb8',
                format: d => d >= 1000 ? `${d/1000}M` : `${d}k`,
                tooltip: d => `${d3.format(',.0f')(d)}k (${d3.format(',.1f')(d / 1000)}M)`
            }]
        },
        density: {
            title: 'Population Density Trends (1950-2023)',
            description: 'Population density (per km²) trends',
            metrics: [{
                key: 'density',
                label: 'Population Density (per km²)',
                color: '#377eb8',
                format: d => d3.format(',.1f')(d),
                tooltip: d => d3.format(',.1f')(d)
            }]
        },
        'sex-ratio': {
            title: 'Sex Ratio Trends (1950-2023)',
            description: 'Sex ratio (males per 100 females) trends',
            metrics: [{
                key: 'sexRatio',
                label: 'Sex Ratio (males per 100 females)',
                color: '#377eb8',
                format: d => d3.format(',.1f')(d),
                tooltip: d => d3.format(',.1f')(d)
            }]
        },
        'median-age': {
            title: 'Median Age Trends (1950-2023)',
            description: 'Median age trends showing demographic aging',
            metrics: [{
                key: 'medianAge',
                label: 'Median Age (years)',
                color: '#377eb8',
                format: d => d3.format(',.1f')(d),
                tooltip: d => d3.format(',.1f')(d)
            }]
        },
        
        // NEW GRADUATE-LEVEL MODES
        'demographic-transition': {
            title: 'Demographic Transition (1950-2023)',
            description: 'Birth and death rates showing demographic transition stages',
            metrics: [
                {
                    key: 'birthRate',
                    label: 'Crude Birth Rate (per 1,000)',
                    color: '#4daf4a',
                    format: d => d3.format(',.1f')(d),
                    tooltip: d => d3.format(',.1f')(d)
                },
                {
                    key: 'deathRate',
                    label: 'Crude Death Rate (per 1,000)',
                    color: '#e41a1c',
                    format: d => d3.format(',.1f')(d),
                    tooltip: d => d3.format(',.1f')(d)
                }
            ]
        },
        'growth-drivers': {
            title: 'Population Growth Drivers (1950-2023)',
            description: 'Natural change vs migration showing what drives population growth',
            metrics: [
                {
                    key: 'naturalChange',
                    label: 'Rate of Natural Change (per 1,000)',
                    color: '#4daf4a',
                    format: d => d3.format(',.1f')(d),
                    tooltip: d => d3.format(',.1f')(d)
                },
                {
                    key: 'migrationRate',
                    label: 'Net Migration Rate (per 1,000)',
                    color: '#984ea3',
                    format: d => d3.format(',.1f')(d),
                    tooltip: d => d3.format(',.1f')(d)
                }
            ]
        },
        'longevity-gap': {
            title: 'Life Expectancy & Gender Gap (1950-2023)',
            description: 'Male vs female life expectancy showing survival differences',
            metrics: [
                {
                    key: 'lifeExpectancyMale',
                    label: 'Male Life Expectancy (years)',
                    color: '#377eb8',
                    format: d => d3.format(',.1f')(d),
                    tooltip: d => d3.format(',.1f')(d)
                },
                {
                    key: 'lifeExpectancyFemale',
                    label: 'Female Life Expectancy (years)',
                    color: '#e41a1c',
                    format: d => d3.format(',.1f')(d),
                    tooltip: d => d3.format(',.1f')(d)
                }
            ]
        },
        'fertility-health': {
            title: 'Fertility & Reproductive Health (1950-2023)',
            description: 'Fertility rate and mean age at childbearing',
            metrics: [
                {
                    key: 'fertilityRate',
                    label: 'Total Fertility Rate (births per woman)',
                    color: '#ff7f00',
                    format: d => d3.format(',.2f')(d),
                    tooltip: d => d3.format(',.2f')(d)
                },
                {
                    key: 'meanAgeChildbearing',
                    label: 'Mean Age at Childbearing (years)',
                    color: '#984ea3',
                    format: d => d3.format(',.1f')(d),
                    tooltip: d => d3.format(',.1f')(d)
                }
            ]
        },
        'healthcare-quality': {
            title: 'Healthcare Quality Indicators (1950-2023)',
            description: 'Infant and under-5 mortality rates (development proxy)',
            metrics: [
                {
                    key: 'infantMortality',
                    label: 'Infant Mortality Rate (per 1,000 births)',
                    color: '#e41a1c',
                    format: d => d3.format(',.1f')(d),
                    tooltip: d => d3.format(',.1f')(d)
                },
                {
                    key: 'underFiveMortality',
                    label: 'Under-5 Mortality Rate (per 1,000 births)',
                    color: '#ff7f00',
                    format: d => d3.format(',.1f')(d),
                    tooltip: d => d3.format(',.1f')(d)
                }
            ],
            supportsLogScale: true
        }
    },
    
    /**
     * Initialize time series visualization
     */
    init(container, appState) {
        console.log('Initializing time series visualization...');
        
        this.appState = appState;
        this.container = container;
        
        // Calculate dimensions
        const containerNode = container.node();
        const rect = containerNode.getBoundingClientRect();
        this.width = rect.width - this.margin.left - this.margin.right;
        this.height = 500 - this.margin.top - this.margin.bottom;
        
        // Get data
        this.regionalData = DataLoader.processRegionalTimeSeries();
        this.countryTimeSeriesData = DataLoader.getCountryTimeSeriesData();
        
        const regionMeta = DataLoader.getRegionMetadata();
        
        // Create color scale for regions
        this.colorScale = d3.scaleOrdinal()
            .domain(regionMeta.map(d => d.name))
            .range(regionMeta.map(d => d.color));
        
        // Initially select all regions
        this.regionalData.forEach(d => this.selectedRegions.add(d.region));
        
        // Draw chart with current mode
        this.draw();
        
        // Listen for country selections from globe
        dispatcher.on('countrySelected.timeseries', (countryCode, countryName) => {
            console.log('Timeseries: Country selected from globe:', countryName);
            this.toggleCountry(countryName);
        });
        
        // Listen for visualization mode changes from globe (for original 4 modes)
        dispatcher.on('modeChanged.timeseries', (mode) => {
            console.log('Timeseries: Mode changed to:', mode);
            if (this.visualizationModes[mode]) {
                this.changeMode(mode);
            }
        });
        
        // Mark processed
        appState.data.processed.timeseries = true;
        
        console.log('✓ Time series visualization initialized');
    },
    
    /**
     * Change visualization mode
     */
    changeMode(mode) {
        this.currentMode = mode;
        this.useLogScale = false; // Reset log scale when changing modes
        
        // Update title and description
        const modeConfig = this.visualizationModes[mode];
        document.getElementById('timeseries-title').textContent = modeConfig.title;
        document.getElementById('timeseries-description').textContent = modeConfig.description;
        
        this.draw();
    },
    
    /**
     * Toggle logarithmic scale
     */
    toggleLogScale() {
        this.useLogScale = !this.useLogScale;
        const btn = document.getElementById('log-scale-toggle');
        if (btn) {
            btn.textContent = this.useLogScale ? '📊 Linear Scale' : '📈 Log Scale';
            btn.classList.toggle('active', this.useLogScale);
        }
        this.draw();
    },
    
    /**
     * Draw/redraw the entire chart
     */
    draw() {
        // Clear existing
        this.container.selectAll('*').remove();
        
        // Create SVG
        this.svg = this.container
            .attr('width', this.width + this.margin.left + this.margin.right)
            .attr('height', 500)
            .append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);
        
        // Get active data
        const activeRegionalData = this.regionalData.filter(d => this.selectedRegions.has(d.region));
        const modeConfig = this.visualizationModes[this.currentMode];
        
        // Calculate y domain dynamically based on current data
        let minValue = Infinity;
        let maxValue = -Infinity;
        
        // Check all metrics in current mode
        modeConfig.metrics.forEach(metric => {
            // Regional data
            activeRegionalData.forEach(region => {
                region.values.forEach(v => {
                    const val = v[metric.key];
                    if (val > 0) {  // Only consider positive values for log scale
                        if (val < minValue) minValue = val;
                        if (val > maxValue) maxValue = val;
                    }
                });
            });
            
            // Country data
            this.selectedCountries.forEach(countryName => {
                const countryData = this.countryTimeSeriesData[countryName];
                if (countryData) {
                    countryData.forEach(v => {
                        const val = v[metric.key];
                        if (val > 0) {
                            if (val < minValue) minValue = val;
                            if (val > maxValue) maxValue = val;
                        }
                    });
                }
            });
        });
        
        // Handle case where no data
        if (minValue === Infinity) minValue = 0;
        if (maxValue === -Infinity) maxValue = 100;
        
        // Create scales
        this.xScale = d3.scaleLinear()
            .domain([1950, 2023])
            .range([0, this.width]);
        
        // Y scale - logarithmic or linear
        if (this.useLogScale && modeConfig.supportsLogScale) {
            this.yScale = d3.scaleLog()
                .domain([Math.max(0.1, minValue), maxValue * 1.1])
                .range([this.height, 0])
                .nice();
        } else {
            this.yScale = d3.scaleLinear()
                .domain([0, maxValue * 1.1])
                .range([this.height, 0])
                .nice();
        }
        
        // Add gridlines
        this.svg.append('g')
            .attr('class', 'grid')
            .attr('transform', `translate(0,${this.height})`)
            .call(d3.axisBottom(this.xScale)
                .tickSize(-this.height)
                .tickFormat('')
                .ticks(10));
        
        this.svg.append('g')
            .attr('class', 'grid')
            .call(d3.axisLeft(this.yScale)
                .tickSize(-this.width)
                .tickFormat('')
                .ticks(8));
        
        // Add axes
        this.svg.append('g')
            .attr('class', 'axis')
            .attr('transform', `translate(0,${this.height})`)
            .call(d3.axisBottom(this.xScale)
                .tickFormat(d3.format('d'))
                .ticks(15));
        
        this.svg.append('g')
            .attr('class', 'axis')
            .call(d3.axisLeft(this.yScale)
                .tickFormat(modeConfig.metrics[0].format)
                .ticks(8));
        
        // Add axis labels
        this.svg.append('text')
            .attr('class', 'axis-label')
            .attr('text-anchor', 'middle')
            .attr('x', this.width / 2)
            .attr('y', this.height + 45)
            .text('Year');
        
        // Y-axis label shows all metrics in mode
        const yAxisLabel = modeConfig.metrics.map(m => m.label).join(' / ');
        this.svg.append('text')
            .attr('class', 'axis-label')
            .attr('text-anchor', 'middle')
            .attr('transform', 'rotate(-90)')
            .attr('x', -this.height / 2)
            .attr('y', -55)
            .text(yAxisLabel);
        
        // Draw regional lines for each metric
        modeConfig.metrics.forEach(metric => {
            this.drawRegionalLines(activeRegionalData, metric);
        });
        
        // Draw country lines for each metric
        this.svg.append('g').attr('class', 'country-lines-container');
        modeConfig.metrics.forEach(metric => {
            this.selectedCountries.forEach(country => this.addCountryLine(country, metric));
        });
        
        // Update legend
        this.updateLegend();
    },
    
    /**
     * Draw regional lines for a specific metric
     */
    drawRegionalLines(data, metricConfig) {
        const line = d3.line()
            .x(d => this.xScale(d.year))
            .y(d => this.yScale(d[metricConfig.key]))
            .curve(d3.curveMonotoneX);
        
        const tooltip = d3.select('#tooltip');
        
        const lines = this.svg.selectAll(`.region-line-${metricConfig.key}`)
            .data(data)
            .enter()
            .append('g')
            .attr('class', `region-line region-line-${metricConfig.key}`);
        
        lines.append('path')
            .attr('class', 'line')
            .attr('d', d => line(d.values))
            .attr('stroke', d => this.colorScale(d.region))
            .attr('fill', 'none')
            .attr('stroke-width', 2.5)
            .on('mouseover', function(d) {
                d3.select(this)
                    .raise()
                    .transition()
                    .duration(100)
                    .attr('stroke-width', 4);
            })
            .on('mousemove', (d) => {
                const mouse = d3.mouse(d3.event.currentTarget);
                const xPos = mouse[0];
                const year = Math.round(this.xScale.invert(xPos));
                const dataPoint = d.values.find(v => v.year === year);
                
                if (dataPoint) {
                    tooltip
                        .style('display', 'block')
                        .style('left', d3.event.pageX + 10 + 'px')
                        .style('top', d3.event.pageY - 10 + 'px')
                        .html(`
                            <div style="font-weight: 600; margin-bottom: 4px;">${d.region}</div>
                            <div>Year: ${dataPoint.year}</div>
                            <div>${metricConfig.label}: ${metricConfig.tooltip(dataPoint[metricConfig.key])}</div>
                        `);
                }
            })
            .on('mouseout', function() {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr('stroke-width', 2.5);
                
                tooltip.style('display', 'none');
            });
        
        // Add labels only for last metric to avoid clutter
        const modeConfig = this.visualizationModes[this.currentMode];
        if (metricConfig === modeConfig.metrics[modeConfig.metrics.length - 1]) {
            lines.append('text')
                .attr('class', 'region-label')
                .attr('x', this.width + 5)
                .attr('y', d => this.yScale(d.values[d.values.length - 1][metricConfig.key]))
                .attr('dy', '0.35em')
                .attr('fill', d => this.colorScale(d.region))
                .style('font-size', '11px')
                .style('font-weight', '600')
                .text(d => d.region);
        }
    },
    
    /**
     * Toggle a region on/off
     */
    toggleRegion(regionName) {
        if (this.selectedRegions.has(regionName)) {
            this.selectedRegions.delete(regionName);
        } else {
            this.selectedRegions.add(regionName);
        }
        this.draw();
    },
    
    /**
     * Toggle a country line on/off
     */
    toggleCountry(countryName) {
        if (this.selectedCountries.has(countryName)) {
            this.selectedCountries.delete(countryName);
        } else {
            // Add country (hide regions when first country is added)
            if (this.selectedCountries.size === 0) {
                this.selectedRegions.clear();
            }
            this.selectedCountries.add(countryName);
        }
        this.draw();
    },
    
    /**
     * Add a country line for a specific metric
     */
    addCountryLine(countryName, metricConfig) {
        const countryData = this.countryTimeSeriesData[countryName];
        if (!countryData) {
            console.warn('No data found for country:', countryName);
            return;
        }
        
        // Generate a unique color for this country (consistent across all metrics)
        const countryColors = ['#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', '#a65628', '#f781bf', '#999999'];
        const colorIndex = Array.from(this.selectedCountries).indexOf(countryName) % countryColors.length;
        // Use country color unless metric specifies its own color
        const countryColor = countryColors[colorIndex];
        
        // Line generator
        const line = d3.line()
            .x(d => this.xScale(d.year))
            .y(d => this.yScale(d[metricConfig.key]))
            .curve(d3.curveMonotoneX);
        
        const tooltip = d3.select('#tooltip');
        
        // Add country line group
        const countryGroup = this.svg.select('.country-lines-container')
            .append('g')
            .attr('class', `country-line country-${countryName.replace(/\s+/g, '-')}-${metricConfig.key}`);
        
        // Add the line
        countryGroup.append('path')
            .datum(countryData)
            .attr('class', 'line')
            .attr('d', line)
            .attr('stroke', countryColor)
            .attr('fill', 'none')
            .attr('stroke-width', 2)
            .on('mouseover', function() {
                d3.select(this)
                    .raise()
                    .transition()
                    .duration(100)
                    .attr('stroke-width', 3.5);
            })
            .on('mousemove', function() {
                const mouse = d3.mouse(this);
                const xPos = mouse[0];
                const year = Math.round(TimeSeriesViz.xScale.invert(xPos));
                const dataPoint = countryData.find(v => v.year === year);
                
                if (dataPoint) {
                    tooltip
                        .style('display', 'block')
                        .style('left', d3.event.pageX + 10 + 'px')
                        .style('top', d3.event.pageY - 10 + 'px')
                        .html(`
                            <div style="font-weight: 600; margin-bottom: 4px;">${countryName}</div>
                            <div>Year: ${dataPoint.year}</div>
                            <div>${metricConfig.label}: ${metricConfig.tooltip(dataPoint[metricConfig.key])}</div>
                        `);
                }
            })
            .on('mouseout', function() {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr('stroke-width', 2);
                tooltip.style('display', 'none');
            });
        
        // Add label for last metric only
        const modeConfig = this.visualizationModes[this.currentMode];
        if (metricConfig === modeConfig.metrics[modeConfig.metrics.length - 1]) {
            const lastPoint = countryData[countryData.length - 1];
            countryGroup.append('text')
                .attr('class', 'country-label')
                .attr('x', this.width + 5)
                .attr('y', this.yScale(lastPoint[metricConfig.key]))
                .attr('dy', '0.35em')
                .attr('fill', countryColor)
                .style('font-size', '10px')
                .style('font-weight', '600')
                .text(countryName);
        }
    },
    
    /**
     * Update the legend to show selected regions and countries
     */
    updateLegend() {
        const legendDiv = d3.select('#timeseries-legend');
        legendDiv.html('');
        
        let html = '<div style="display: flex; gap: 16px; flex-wrap: wrap;">';
        
        // REGIONS BOX - Always show all regions for easy selection
        html += '<div style="flex: 1; min-width: 300px; padding: 12px; background: #f8f9fa; border-radius: 6px; border: 2px solid #e3f2fd;">';
        html += '<div style="margin-bottom: 8px;"><strong style="color: #1976d2;">📊 Regions</strong></div>';
        html += '<div style="display: flex; flex-wrap: wrap; gap: 8px;">';
        
        // Show all regions with their selection state
        this.regionalData.forEach((regionData) => {
            const color = this.colorScale(regionData.region);
            const isSelected = this.selectedRegions.has(regionData.region);
            
            if (isSelected) {
                // Selected region - show with remove button
                html += `
                    <div style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: white; border-radius: 4px; font-size: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                        <div style="width: 20px; height: 3px; background: ${color}; border-radius: 2px;"></div>
                        <span>${regionData.region}</span>
                        <button onclick="TimeSeriesViz.toggleRegion('${regionData.region}')" style="margin-left: 4px; background: none; border: none; cursor: pointer; color: #666; font-size: 16px; line-height: 1;" title="Remove">×</button>
                    </div>
                `;
            } else {
                // Not selected - show add button
                html += `
                    <button onclick="TimeSeriesViz.toggleRegion('${regionData.region}')" style="display: inline-flex; align-items: center; gap: 6px; padding: 3px 8px; background: white; border: 1px solid #ddd; border-radius: 4px; font-size: 11px; cursor: pointer; opacity: 0.7; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'">
                        <div style="width: 16px; height: 2px; background: ${color};"></div>
                        <span>+ ${regionData.region}</span>
                    </button>
                `;
            }
        });
        
        html += '</div></div>';
        
        // COUNTRIES BOX
        html += '<div style="flex: 1; min-width: 300px; padding: 12px; background: #f8f9fa; border-radius: 6px; border: 2px solid #fff3e0;">';
        html += '<div style="margin-bottom: 8px;"><strong style="color: #f57c00;">🌍 Countries</strong></div>';
        
        if (this.selectedCountries.size > 0) {
            const countryColors = ['#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', '#a65628', '#f781bf', '#999999'];
            
            html += '<div style="display: flex; flex-wrap: wrap; gap: 8px;">';
            
            Array.from(this.selectedCountries).forEach((country, i) => {
                const color = countryColors[i % countryColors.length];
                html += `
                    <div style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: white; border-radius: 4px; font-size: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                        <div style="width: 20px; height: 3px; background: ${color}; border-radius: 2px;"></div>
                        <span>${country}</span>
                        <button onclick="TimeSeriesViz.toggleCountry('${country}')" style="margin-left: 4px; background: none; border: none; cursor: pointer; color: #666; font-size: 16px; line-height: 1;" title="Remove">×</button>
                    </div>
                `;
            });
            
            html += '</div>';
        } else {
            html += '<div style="color: #666; font-size: 12px;"><em>No countries selected. Click any country on the globe to add it here.</em></div>';
        }
        
        html += '</div>';
        
        html += '</div>';
        legendDiv.html(html);
    }
};
