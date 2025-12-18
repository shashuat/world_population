/**
 * Time Series Visualization - ENHANCED
 * Supports multiple metrics (population, density, sex ratio, median age)
 * Toggleable regions and countries
 * Responds to globe visualization mode changes
 */

const TimeSeriesViz = {
    // Configuration
    margin: {top: 20, right: 120, bottom: 60, left: 80},
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
    currentMetric: 'population', // population, density, sexRatio, medianAge
    appState: null,
    
    // Metric configurations
    metricConfig: {
        population: {
            label: 'Population (thousands)',
            format: d => d >= 1000 ? `${d/1000}M` : `${d}k`,
            tooltip: d => `${d3.format(',.0f')(d)}k (${d3.format(',.1f')(d / 1000)}M)`
        },
        density: {
            label: 'Population Density (per km²)',
            format: d => d3.format(',.1f')(d),
            tooltip: d => d3.format(',.1f')(d)
        },
        sexRatio: {
            label: 'Sex Ratio (males per 100 females)',
            format: d => d3.format(',.1f')(d),
            tooltip: d => d3.format(',.1f')(d)
        },
        medianAge: {
            label: 'Median Age (years)',
            format: d => d3.format(',.1f')(d),
            tooltip: d => d3.format(',.1f')(d)
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
        
        // Create color scale
        this.colorScale = d3.scaleOrdinal()
            .domain(regionMeta.map(d => d.name))
            .range(regionMeta.map(d => d.color));
        
        // Initially select all regions
        this.regionalData.forEach(d => this.selectedRegions.add(d.region));
        
        // Draw chart with current metric
        this.draw();
        
        // Listen for country selections from globe
        dispatcher.on('countrySelected.timeseries', (countryCode, countryName) => {
            console.log('Timeseries: Country selected from globe:', countryName);
            this.toggleCountry(countryName);
        });
        
        // Listen for visualization mode changes from globe
        dispatcher.on('modeChanged.timeseries', (mode) => {
            console.log('Timeseries: Mode changed to:', mode);
            this.changeMetric(mode);
        });
        
        // Mark processed
        appState.data.processed.timeseries = true;
        
        console.log('✓ Time series visualization initialized');
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
        
        // Create scales
        this.xScale = d3.scaleLinear()
            .domain([1950, 2023])
            .range([0, this.width]);
        
        // Calculate y domain based on current metric
        let maxValue = 0;
        
        activeRegionalData.forEach(region => {
            const regionMax = d3.max(region.values, v => v[this.currentMetric]);
            if (regionMax > maxValue) maxValue = regionMax;
        });
        
        Object.values(this.countryTimeSeriesData).forEach(countryData => {
            const countryMax = d3.max(countryData, v => v[this.currentMetric]);
            if (countryMax > maxValue) maxValue = countryMax;
        });
        
        this.yScale = d3.scaleLinear()
            .domain([0, maxValue * 1.1])
            .range([this.height, 0])
            .nice();
        
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
        
        const config = this.metricConfig[this.currentMetric];
        this.svg.append('g')
            .attr('class', 'axis')
            .call(d3.axisLeft(this.yScale)
                .tickFormat(config.format)
                .ticks(8));
        
        // Add axis labels
        this.svg.append('text')
            .attr('class', 'axis-label')
            .attr('text-anchor', 'middle')
            .attr('x', this.width / 2)
            .attr('y', this.height + 45)
            .text('Year');
        
        this.svg.append('text')
            .attr('class', 'axis-label')
            .attr('text-anchor', 'middle')
            .attr('transform', 'rotate(-90)')
            .attr('x', -this.height / 2)
            .attr('y', -55)
            .text(config.label);
        
        // Draw regional lines
        this.drawRegionalLines(activeRegionalData);
        
        // Draw country lines
        this.svg.append('g').attr('class', 'country-lines-container');
        this.selectedCountries.forEach(country => this.addCountryLine(country));
        
        // Update legend
        this.updateLegend();
    },
    
    /**
     * Draw regional lines
     */
    drawRegionalLines(data) {
        const line = d3.line()
            .x(d => this.xScale(d.year))
            .y(d => this.yScale(d[this.currentMetric]))
            .curve(d3.curveMonotoneX);
        
        const tooltip = d3.select('#tooltip');
        const config = this.metricConfig[this.currentMetric];
        
        const lines = this.svg.selectAll('.region-line')
            .data(data)
            .enter()
            .append('g')
            .attr('class', 'region-line');
        
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
                            <div>${config.label}: ${config.tooltip(dataPoint[this.currentMetric])}</div>
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
        
        // Add direct labels at end of lines
        lines.append('text')
            .attr('class', 'region-label')
            .attr('x', this.width + 5)
            .attr('y', d => this.yScale(d.values[d.values.length - 1][this.currentMetric]))
            .attr('dy', '0.35em')
            .attr('fill', d => this.colorScale(d.region))
            .style('font-size', '12px')
            .style('font-weight', '600')
            .text(d => d.region);
    },
    
    /**
     * Change the displayed metric
     */
    changeMetric(mode) {
        this.currentMetric = mode;
        
        // Update title
        const titles = {
            population: 'Regional Population Trends (1950-2023)',
            density: 'Population Density Trends (1950-2023)',
            'sex-ratio': 'Sex Ratio Trends (1950-2023)',
            'median-age': 'Median Age Trends (1950-2023)'
        };
        
        const descriptions = {
            population: 'Population trends across major world regions and countries',
            density: 'Population density (per km²) trends across regions and countries',
            'sex-ratio': 'Sex ratio (males per 100 females) trends across regions and countries',
            'median-age': 'Median age trends showing demographic aging patterns'
        };
        
        // Map mode to metric
        const metricMap = {
            'sex-ratio': 'sexRatio',
            'median-age': 'medianAge'
        };
        
        this.currentMetric = metricMap[mode] || mode;
        
        document.getElementById('timeseries-title').textContent = titles[mode] || titles.population;
        document.getElementById('timeseries-description').textContent = descriptions[mode] || descriptions.population;
        
        this.draw();
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
            // Remove country
            this.selectedCountries.delete(countryName);
        } else {
            // Add country (and hide all regions when first country is added)
            if (this.selectedCountries.size === 0) {
                this.selectedRegions.clear();
            }
            this.selectedCountries.add(countryName);
        }
        this.draw();
    },
    
    /**
     * Add a country line to the chart
     */
    addCountryLine(countryName) {
        const countryData = this.countryTimeSeriesData[countryName];
        if (!countryData) {
            console.warn('No data found for country:', countryName);
            return;
        }
        
        // Generate a color for this country
        const countryColors = ['#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', '#ffff33', '#a65628', '#f781bf'];
        const colorIndex = Array.from(this.selectedCountries).indexOf(countryName) % countryColors.length;
        const countryColor = countryColors[colorIndex];
        
        // Line generator
        const line = d3.line()
            .x(d => this.xScale(d.year))
            .y(d => this.yScale(d[this.currentMetric]))
            .curve(d3.curveMonotoneX);
        
        const tooltip = d3.select('#tooltip');
        const config = this.metricConfig[this.currentMetric];
        
        // Add country line group
        const countryGroup = this.svg.select('.country-lines-container')
            .append('g')
            .attr('class', `country-line country-${countryName.replace(/\s+/g, '-')}`);
        
        // Add the line
        countryGroup.append('path')
            .datum(countryData)
            .attr('class', 'line')
            .attr('d', line)
            .attr('stroke', countryColor)
            .attr('fill', 'none')
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '5,5')
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
                            <div>${config.label}: ${config.tooltip(dataPoint[TimeSeriesViz.currentMetric])}</div>
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
        
        // Add label at the end
        const lastPoint = countryData[countryData.length - 1];
        countryGroup.append('text')
            .attr('class', 'country-label')
            .attr('x', this.width + 5)
            .attr('y', this.yScale(lastPoint[this.currentMetric]))
            .attr('dy', '0.35em')
            .attr('fill', countryColor)
            .style('font-size', '11px')
            .style('font-weight', '600')
            .text(countryName);
    },
    
    /**
     * Update the legend to show selected regions and countries
     */
    updateLegend() {
        const legendDiv = d3.select('#timeseries-legend');
        legendDiv.html('');
        
        let html = '<div style="padding: 12px; background: #f8f9fa; border-radius: 6px;">';
        
        // Show regions
        if (this.selectedRegions.size > 0) {
            html += '<div style="margin-bottom: 12px;"><strong>Regions:</strong><div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">';
            
            Array.from(this.selectedRegions).forEach((region) => {
                const color = this.colorScale(region);
                html += `
                    <div style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: white; border-radius: 4px; font-size: 12px;">
                        <div style="width: 20px; height: 2px; background: ${color};"></div>
                        <span>${region}</span>
                        <button onclick="TimeSeriesViz.toggleRegion('${region}')" style="margin-left: 4px; background: none; border: none; cursor: pointer; color: #666; font-size: 16px; line-height: 1;" title="Remove">×</button>
                    </div>
                `;
            });
            
            html += '</div></div>';
        } else if (this.selectedCountries.size === 0) {
            // Show option to add back regions
            html += '<div style="margin-bottom: 12px; color: #666;"><em>All regions hidden. Click below to add regions back:</em><div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">';
            
            this.regionalData.forEach((regionData) => {
                const color = this.colorScale(regionData.region);
                html += `
                    <button onclick="TimeSeriesViz.toggleRegion('${regionData.region}')" style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: white; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; cursor: pointer;">
                        <div style="width: 20px; height: 2px; background: ${color};"></div>
                        <span>+ ${regionData.region}</span>
                    </button>
                `;
            });
            
            html += '</div></div>';
        }
        
        // Show countries
        if (this.selectedCountries.size > 0) {
            const countryColors = ['#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', '#ffff33', '#a65628', '#f781bf'];
            
            html += '<div><strong>Countries:</strong><div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">';
            
            Array.from(this.selectedCountries).forEach((country, i) => {
                const color = countryColors[i % countryColors.length];
                html += `
                    <div style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: white; border-radius: 4px; font-size: 12px;">
                        <div style="width: 20px; height: 2px; background: ${color}; border: 1px dashed ${color};"></div>
                        <span>${country}</span>
                        <button onclick="TimeSeriesViz.toggleCountry('${country}')" style="margin-left: 4px; background: none; border: none; cursor: pointer; color: #666; font-size: 16px; line-height: 1;" title="Remove">×</button>
                    </div>
                `;
            });
            
            html += '</div></div>';
        }
        
        html += '</div>';
        legendDiv.html(html);
    }
};
