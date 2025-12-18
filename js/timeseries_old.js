/**
 * Regional Population Time Series Visualization
 * Adapted from viz1_regional_timeseries.js for dashboard integration
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
    selectedCountries: new Set(),
    countryTimeSeriesData: null,
    regionalData: null,
    
    /**
     * Initialize time series visualization
     */
    init(container, appState) {
        console.log('Initializing time series visualization...');
        
        // Calculate dimensions
        const containerNode = container.node();
        const rect = containerNode.getBoundingClientRect();
        this.width = rect.width - this.margin.left - this.margin.right;
        this.height = 500 - this.margin.top - this.margin.bottom;
        
        // Clear existing
        container.selectAll('*').remove();
        
        // Create SVG
        this.svg = container
            .attr('width', this.width + this.margin.left + this.margin.right)
            .attr('height', 500)
            .append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);
        
        // Get data
        const data = DataLoader.processRegionalTimeSeries();
        const regionMeta = DataLoader.getRegionMetadata();
        this.regionalData = data;
        this.countryTimeSeriesData = DataLoader.getCountryTimeSeriesData();
        
        // Create color scale
        this.colorScale = d3.scaleOrdinal()
            .domain(regionMeta.map(d => d.name))
            .range(regionMeta.map(d => d.color));
        
        // Sort by final population
        data.sort((a, b) => {
            const aLast = a.values[a.values.length - 1].population;
            const bLast = b.values[b.values.length - 1].population;
            return bLast - aLast;
        });
        
        // Create scales
        this.xScale = d3.scaleLinear()
            .domain([1950, 2023])
            .range([0, this.width]);
        
        this.yScale = d3.scaleLinear()
            .domain([0, d3.max(data, d => d3.max(d.values, v => v.population)) * 1.1])
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
        
        this.svg.append('g')
            .attr('class', 'axis')
            .call(d3.axisLeft(this.yScale)
                .tickFormat(d => d >= 1000 ? `${d/1000}M` : `${d}k`)
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
            .text('Population (thousands)');
        
        // Line generator
        const line = d3.line()
            .x(d => this.xScale(d.year))
            .y(d => this.yScale(d.population))
            .curve(d3.curveMonotoneX);
        
        // Tooltip
        const tooltip = d3.select('#tooltip');
        
        // Draw lines
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
            .on('mousemove', function(d) {
                const mouse = d3.mouse(this);
                const xPos = mouse[0];
                const year = Math.round(TimeSeriesViz.xScale.invert(xPos));
                const dataPoint = d.values.find(v => v.year === year);
                
                if (dataPoint) {
                    tooltip
                        .style('display', 'block')
                        .style('left', d3.event.pageX + 10 + 'px')
                        .style('top', d3.event.pageY - 10 + 'px')
                        .html(`
                            <div style="font-weight: 600; margin-bottom: 4px;">${d.region}</div>
                            <div>Year: ${dataPoint.year}</div>
                            <div>Population: ${d3.format(',.0f')(dataPoint.population)}k</div>
                            <div>${d3.format(',.1f')(dataPoint.population / 1000)}M</div>
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
            .attr('y', d => this.yScale(d.values[d.values.length - 1].population))
            .attr('dy', '0.35em')
            .attr('fill', d => this.colorScale(d.region))
            .style('font-size', '12px')
            .style('font-weight', '600')
            .text(d => d.region);
        
        // Create container for country lines (above regional lines)
        this.svg.append('g').attr('class', 'country-lines-container');
        
        // Listen for country selections from globe
        dispatcher.on('countrySelected.timeseries', (countryCode, countryName) => {
            console.log('Timeseries: Country selected from globe:', countryName);
            this.toggleCountry(countryName);
        });
        
        // Mark processed
        appState.data.processed.timeseries = true;
        
        console.log('✓ Time series visualization initialized');
    },
    
    /**
     * Toggle a country line on/off
     */
    toggleCountry(countryName) {
        if (this.selectedCountries.has(countryName)) {
            // Remove country
            this.selectedCountries.delete(countryName);
            this.removeCountryLine(countryName);
        } else {
            // Add country
            this.selectedCountries.add(countryName);
            this.addCountryLine(countryName);
        }
        this.updateCountryLegend();
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
        
        // Generate a color for this country (use a different color scheme)
        const countryColors = ['#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', '#ffff33', '#a65628', '#f781bf'];
        const colorIndex = Array.from(this.selectedCountries).indexOf(countryName) % countryColors.length;
        const countryColor = countryColors[colorIndex];
        
        // Line generator
        const line = d3.line()
            .x(d => this.xScale(d.year))
            .y(d => this.yScale(d.population))
            .curve(d3.curveMonotoneX);
        
        const tooltip = d3.select('#tooltip');
        
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
            .style('opacity', 0)
            .transition()
            .duration(500)
            .style('opacity', 1)
            .on('end', function() {
                d3.select(this)
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
                                    <div>Population: ${d3.format(',.0f')(dataPoint.population)}k</div>
                                    <div>${d3.format(',.1f')(dataPoint.population / 1000)}M</div>
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
            });
        
        // Add label at the end
        const lastPoint = countryData[countryData.length - 1];
        countryGroup.append('text')
            .attr('class', 'country-label')
            .attr('x', this.width + 5)
            .attr('y', this.yScale(lastPoint.population))
            .attr('dy', '0.35em')
            .attr('fill', countryColor)
            .style('font-size', '11px')
            .style('font-weight', '600')
            .style('opacity', 0)
            .text(countryName)
            .transition()
            .duration(500)
            .style('opacity', 1);
    },
    
    /**
     * Remove a country line from the chart
     */
    removeCountryLine(countryName) {
        this.svg.select(`.country-${countryName.replace(/\s+/g, '-')}`)
            .transition()
            .duration(300)
            .style('opacity', 0)
            .remove();
    },
    
    /**
     * Update the legend to show selected countries
     */
    updateCountryLegend() {
        const legendDiv = d3.select('#timeseries-legend');
        
        if (this.selectedCountries.size === 0) {
            legendDiv.html('');
            return;
        }
        
        const countryColors = ['#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', '#ffff33', '#a65628', '#f781bf'];
        
        let html = '<div style="padding: 12px; background: #f8f9fa; border-radius: 6px;"><strong>Selected Countries:</strong><div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">';
        
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
        legendDiv.html(html);
    }
};