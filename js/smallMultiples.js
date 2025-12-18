/**
 * Birth & Death Rate Small Multiples Visualization
 * Adapted from viz2_birth_death_small_multiples.js for dashboard integration
 * Enhanced to support adding individual countries
 */

const SmallMultiplesViz = {
    // Small multiple dimensions
    margin: {top: 40, right: 20, bottom: 40, left: 45},
    smallWidth: 360,
    smallHeight: 200,
    container: null,
    xScale: null,
    yScale: null,
    selectedCountries: new Set(),
    countryBirthDeathData: null,
    regionalData: null,
    
    /**
     * Initialize small multiples visualization
     */
    init(container, appState) {
        console.log('Initializing small multiples visualization...');
        
        this.container = container;
        
        // Clear existing
        container.selectAll('*').remove();
        
        // Get data
        const data = DataLoader.processBirthDeathRates();
        this.regionalData = data;
        this.countryBirthDeathData = DataLoader.getCountryBirthDeathRates();
        
        // Sort regions
        data.sort((a, b) => d3.ascending(a.region, b.region));
        
        // Calculate dimensions
        this.smallWidth = 360 - this.margin.left - this.margin.right;
        this.smallHeight = 200 - this.margin.top - this.margin.bottom;
        
        // Global scales
        this.xScale = d3.scaleLinear()
            .domain([1950, 2023])
            .range([0, this.smallWidth]);
        
        const maxRate = d3.max(data, d => d3.max(d.values, v => 
            Math.max(v.birthRate, v.deathRate)));
        
        this.yScale = d3.scaleLinear()
            .domain([0, maxRate * 1.1])
            .range([this.smallHeight, 0])
            .nice();
        
        // Draw regional charts
        this.drawRegionalCharts(data);
        
        // Listen for country selections from globe
        dispatcher.on('countrySelected.smallMultiples', (countryCode, countryName) => {
            console.log('Small Multiples: Country selected from globe:', countryName);
            this.toggleCountry(countryName);
        });
        
        // Mark processed
        appState.data.processed.multiples = true;
        
        console.log('✓ Small multiples visualization initialized');
    },
    
    /**
     * Draw regional small multiples
     */
    drawRegionalCharts(data) {
        // Area generators
        const birthArea = d3.area()
            .x(d => this.xScale(d.year))
            .y0(this.smallHeight)
            .y1(d => this.yScale(d.birthRate))
            .curve(d3.curveMonotoneX);
        
        const deathArea = d3.area()
            .x(d => this.xScale(d.year))
            .y0(this.smallHeight)
            .y1(d => this.yScale(d.deathRate))
            .curve(d3.curveMonotoneX);
        
        // Tooltip
        const tooltip = d3.select('#tooltip');
        
        // Create each small multiple
        data.forEach(regionData => {
            const svg = this.container.append('svg')
                .attr('width', this.smallWidth + this.margin.left + this.margin.right)
                .attr('height', this.smallHeight + this.margin.top + this.margin.bottom)
                .attr('class', 'regional-chart')
                .style('display', 'inline-block')
                .style('margin', '10px')
                .append('g')
                .attr('transform', `translate(${this.margin.left},${this.margin.top})`);
            
            // Title
            svg.append('text')
                .attr('class', 'region-title')
                .attr('x', this.smallWidth / 2)
                .attr('y', -20)
                .attr('text-anchor', 'middle')
                .style('font-size', '14px')
                .style('font-weight', '600')
                .style('fill', '#333')
                .text(regionData.region);
            
            // Gridlines
            svg.append('g')
                .attr('class', 'grid')
                .call(d3.axisLeft(this.yScale)
                    .tickSize(-this.smallWidth)
                    .tickFormat('')
                    .ticks(5));
            
            // Birth rate area
            svg.append('path')
                .datum(regionData.values)
                .attr('d', birthArea)
                .attr('fill', '#4daf4a')
                .attr('opacity', 0.7);
            
            // Death rate area
            svg.append('path')
                .datum(regionData.values)
                .attr('d', deathArea)
                .attr('fill', '#e41a1c')
                .attr('opacity', 0.7);
            
            // Overlay for tooltips
            svg.append('rect')
                .attr('width', this.smallWidth)
                .attr('height', this.smallHeight)
                .attr('fill', 'transparent')
                .on('mousemove', function() {
                    const mouse = d3.mouse(this);
                    const xPos = mouse[0];
                    const year = Math.round(SmallMultiplesViz.xScale.invert(xPos));
                    const dataPoint = regionData.values.find(v => v.year === year);
                    
                    if (dataPoint) {
                        tooltip
                            .style('display', 'block')
                            .style('left', d3.event.pageX + 10 + 'px')
                            .style('top', d3.event.pageY - 10 + 'px')
                            .html(`
                                <div style="font-weight: 600; margin-bottom: 4px;">${regionData.region} - ${year}</div>
                                <div style="color: #4daf4a;">Birth Rate: ${dataPoint.birthRate.toFixed(1)}</div>
                                <div style="color: #e41a1c;">Death Rate: ${dataPoint.deathRate.toFixed(1)}</div>
                                <div style="margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.3); padding-top: 4px;">
                                    Natural Change: ${dataPoint.naturalChange.toFixed(1)}
                                </div>
                            `);
                    }
                })
                .on('mouseout', function() {
                    tooltip.style('display', 'none');
                });
            
            // Axes
            svg.append('g')
                .attr('class', 'axis')
                .attr('transform', `translate(0,${this.smallHeight})`)
                .call(d3.axisBottom(this.xScale)
                    .tickFormat(d3.format('d'))
                    .ticks(5));
            
            svg.append('g')
                .attr('class', 'axis')
                .call(d3.axisLeft(this.yScale)
                    .ticks(5));
        });
    },
    
    /**
     * Toggle a country chart on/off
     */
    toggleCountry(countryName) {
        if (this.selectedCountries.has(countryName)) {
            // Remove country
            this.selectedCountries.delete(countryName);
            this.removeCountryChart(countryName);
        } else {
            // Add country
            this.selectedCountries.add(countryName);
            this.addCountryChart(countryName);
        }
        this.updateCountryLegend();
    },
    
    /**
     * Add a country chart
     */
    addCountryChart(countryName) {
        const countryData = this.countryBirthDeathData[countryName];
        if (!countryData) {
            console.warn('No birth/death data found for country:', countryName);
            return;
        }
        
        // Area generators
        const birthArea = d3.area()
            .x(d => this.xScale(d.year))
            .y0(this.smallHeight)
            .y1(d => this.yScale(d.birthRate))
            .curve(d3.curveMonotoneX);
        
        const deathArea = d3.area()
            .x(d => this.xScale(d.year))
            .y0(this.smallHeight)
            .y1(d => this.yScale(d.deathRate))
            .curve(d3.curveMonotoneX);
        
        const tooltip = d3.select('#tooltip');
        
        // Create SVG for country
        const svg = this.container.append('svg')
            .attr('width', this.smallWidth + this.margin.left + this.margin.right)
            .attr('height', this.smallHeight + this.margin.top + this.margin.bottom)
            .attr('class', `country-chart country-${countryName.replace(/\s+/g, '-')}`)
            .style('display', 'inline-block')
            .style('margin', '10px')
            .style('opacity', 0)
            .append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);
        
        // Title
        svg.append('text')
            .attr('class', 'country-title')
            .attr('x', this.smallWidth / 2)
            .attr('y', -20)
            .attr('text-anchor', 'middle')
            .style('font-size', '14px')
            .style('font-weight', '600')
            .style('fill', '#e41a1c')
            .text(countryName + ' ★');
        
        // Gridlines
        svg.append('g')
            .attr('class', 'grid')
            .call(d3.axisLeft(this.yScale)
                .tickSize(-this.smallWidth)
                .tickFormat('')
                .ticks(5));
        
        // Birth rate area
        svg.append('path')
            .datum(countryData)
            .attr('d', birthArea)
            .attr('fill', '#4daf4a')
            .attr('opacity', 0.7);
        
        // Death rate area
        svg.append('path')
            .datum(countryData)
            .attr('d', deathArea)
            .attr('fill', '#e41a1c')
            .attr('opacity', 0.7);
        
        // Overlay for tooltips
        svg.append('rect')
            .attr('width', this.smallWidth)
            .attr('height', this.smallHeight)
            .attr('fill', 'transparent')
            .on('mousemove', function() {
                const mouse = d3.mouse(this);
                const xPos = mouse[0];
                const year = Math.round(SmallMultiplesViz.xScale.invert(xPos));
                const dataPoint = countryData.find(v => v.year === year);
                
                if (dataPoint) {
                    tooltip
                        .style('display', 'block')
                        .style('left', d3.event.pageX + 10 + 'px')
                        .style('top', d3.event.pageY - 10 + 'px')
                        .html(`
                            <div style="font-weight: 600; margin-bottom: 4px;">${countryName} - ${year}</div>
                            <div style="color: #4daf4a;">Birth Rate: ${dataPoint.birthRate.toFixed(1)}</div>
                            <div style="color: #e41a1c;">Death Rate: ${dataPoint.deathRate.toFixed(1)}</div>
                            <div style="margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.3); padding-top: 4px;">
                                Natural Change: ${dataPoint.naturalChange.toFixed(1)}
                            </div>
                        `);
                }
            })
            .on('mouseout', function() {
                tooltip.style('display', 'none');
            });
        
        // Axes
        svg.append('g')
            .attr('class', 'axis')
            .attr('transform', `translate(0,${this.smallHeight})`)
            .call(d3.axisBottom(this.xScale)
                .tickFormat(d3.format('d'))
                .ticks(5));
        
        svg.append('g')
            .attr('class', 'axis')
            .call(d3.axisLeft(this.yScale)
                .ticks(5));
        
        // Fade in
        this.container.select(`.country-${countryName.replace(/\s+/g, '-')}`)
            .transition()
            .duration(500)
            .style('opacity', 1);
    },
    
    /**
     * Remove a country chart
     */
    removeCountryChart(countryName) {
        this.container.select(`.country-${countryName.replace(/\s+/g, '-')}`)
            .transition()
            .duration(300)
            .style('opacity', 0)
            .remove();
    },
    
    /**
     * Update the legend to show selected countries
     */
    updateCountryLegend() {
        const legendDiv = d3.select('#multiples-legend');
        
        if (this.selectedCountries.size === 0) {
            legendDiv.html('');
            return;
        }
        
        let html = '<div style="padding: 12px; background: #f8f9fa; border-radius: 6px; margin-top: 16px;"><strong>Selected Countries:</strong><div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">';
        
        Array.from(this.selectedCountries).forEach((country) => {
            html += `
                <div style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: white; border-radius: 4px; font-size: 12px;">
                    <span>★ ${country}</span>
                    <button onclick="SmallMultiplesViz.toggleCountry('${country}')" style="margin-left: 4px; background: none; border: none; cursor: pointer; color: #666; font-size: 16px; line-height: 1;" title="Remove">×</button>
                </div>
            `;
        });
        
        html += '</div></div>';
        legendDiv.html(html);
    }
};