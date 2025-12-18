/**
 * Gender Gap Visualization - Enhanced for Globe Connectivity
 * Time series showing male vs female life expectancy gap
 */

const GenderGapViz = {
    // Configuration
    margin: {top: 40, right: 120, bottom: 60, left: 80},
    svg: null,
    width: null,
    height: null,
    data: null,
    currentCountry: "United States of America", // Default
    
    /**
     * Initialize gender gap visualization
     */
    init(container, appState) {
        console.log('Initializing gender gap visualization...');
        
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
        this.data = DataLoader.getGenderGapData();
        
        if (!this.data) {
            console.error('No gender gap data available');
            return;
        }

        // Use the appState's selected country if available
        if (appState.selectedCountry) {
            this.currentCountry = appState.selectedCountry;
        }

        // Render initial view
        this.render();
        
        // Mark processed
        appState.data.processed.genderGap = true;
        
        console.log('✓ Gender gap visualization initialized');
    },

    /**
     * Public method to update view when globe selection changes
     */
    update(countryName) {
        if (!countryName || countryName === this.currentCountry) return;
        this.currentCountry = countryName;
        this.render();
    },

    /**
     * Render the visualization for the current country
     */
    render() {
        this.svg.selectAll('*').remove();
        
        // Find data for selected country
        // Note: We need to check both timeseries (major) and comparison (all)
        // For a better experience, we'll try to get the full series from country_population_timeseries 
        // if it's not in the pre-calculated gender_gap_data timeseries
        let displayData = this.data.timeseries.find(d => d.country === this.currentCountry);
        
        // Fallback: Calculate on the fly if not in "major_countries" list
        if (!displayData) {
            const allSeries = DataLoader.getCountryTimeSeries();
            if (allSeries && allSeries[this.currentCountry]) {
                displayData = {
                    country: this.currentCountry,
                    values: allSeries[this.currentCountry].map(d => ({
                        year: d.year,
                        male: d.lifeExpectancyMale,
                        female: d.lifeExpectancyFemale,
                        gap: d.lifeExpectancyFemale - d.lifeExpectancyMale
                    }))
                };
            }
        }

        if (!displayData) {
            this.svg.append('text')
                .attr('x', this.width / 2)
                .attr('y', this.height / 2)
                .attr('text-anchor', 'middle')
                .style('font-size', '14px')
                .style('fill', '#666')
                .text(`No detailed gender gap data for ${this.currentCountry}`);
            return;
        }

        this.drawChart(displayData);
    },

    /**
     * Draw the chart for a specific country
     */
    drawChart(countryData) {
        const xScale = d3.scaleLinear()
            .domain([1950, 2023])
            .range([0, this.width]);
        
        // Handle both positive and negative gaps
        const gaps = countryData.values.map(d => d.gap);
        const minGap = d3.min(gaps);
        const maxGap = d3.max(gaps);
        const yMax = Math.max(Math.abs(minGap), Math.abs(maxGap)) * 1.2;
        
        const yScale = d3.scaleLinear()
            .domain([-yMax, yMax])
            .range([this.height, 0])
            .nice();

        // Title
        this.svg.append('text')
            .attr('class', 'viz-title')
            .attr('x', 0)
            .attr('y', -15)
            .style('font-size', '16px')
            .style('font-weight', 'bold')
            .text(`Life Expectancy Gender Gap: ${countryData.country}`);

        // Zero line (horizontal) - shows the baseline
        this.svg.append('line')
            .attr('x1', 0)
            .attr('x2', this.width)
            .attr('y1', yScale(0))
            .attr('y2', yScale(0))
            .attr('stroke', '#333')
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '5,5')
            .style('opacity', 0.5);

        // Gridlines
        this.svg.append('g')
            .attr('class', 'grid')
            .attr('transform', `translate(0,${this.height})`)
            .call(d3.axisBottom(xScale)
                .tickSize(-this.height)
                .tickFormat('')
                .ticks(10));
        
        this.svg.append('g')
            .attr('class', 'grid')
            .call(d3.axisLeft(yScale)
                .tickSize(-this.width)
                .tickFormat('')
                .ticks(8));

        // Drawing the line (color based on whether gap is positive or negative)
        const line = d3.line()
            .x(d => xScale(d.year))
            .y(d => yScale(d.gap))
            .curve(d3.curveMonotoneX);

        // Tooltip
        const tooltip = d3.select('#tooltip');
        
        // Determine predominant gap direction for color
        const avgGap = d3.mean(countryData.values, d => d.gap);
        const lineColor = avgGap >= 0 ? '#e74c3c' : '#3498db';  // Red for female advantage, blue for male advantage

        this.svg.append('path')
            .datum(countryData.values)
            .attr('fill', 'none')
            .attr('stroke', lineColor)
            .attr('stroke-width', 3)
            .attr('d', line)
            .on('mousemove', function() {
                const mouse = d3.mouse(this);
                const xPos = mouse[0];
                const year = Math.round(xScale.invert(xPos));
                const dataPoint = countryData.values.find(v => v.year === year);
                
                if (dataPoint) {
                    const gapText = dataPoint.gap >= 0 
                        ? `${dataPoint.gap.toFixed(1)} years (Female advantage)` 
                        : `${Math.abs(dataPoint.gap).toFixed(1)} years (Male advantage)`;
                    const gapColor = dataPoint.gap >= 0 ? '#e74c3c' : '#3498db';
                    
                    tooltip
                        .style('display', 'block')
                        .style('left', d3.event.pageX + 10 + 'px')
                        .style('top', d3.event.pageY - 10 + 'px')
                        .html(`
                            <div style="font-weight: 600; margin-bottom: 4px;">${countryData.country} - ${year}</div>
                            <div>Female: ${dataPoint.female.toFixed(1)} years</div>
                            <div>Male: ${dataPoint.male.toFixed(1)} years</div>
                            <div style="margin-top: 4px; font-weight: 600; color: ${gapColor};">Gap: ${gapText}</div>
                        `);
                }
            })
            .on('mouseout', function() {
                tooltip.style('display', 'none');
            });

        // Axes
        this.svg.append('g')
            .attr('class', 'axis')
            .attr('transform', `translate(0,${this.height})`)
            .call(d3.axisBottom(xScale)
                .tickFormat(d3.format('d'))
                .ticks(15));
            
        this.svg.append('g')
            .attr('class', 'axis')
            .call(d3.axisLeft(yScale).ticks(8));
        
        // Y-axis label
        this.svg.append('text')
            .attr('class', 'axis-label')
            .attr('transform', 'rotate(-90)')
            .attr('y', -55)
            .attr('x', -this.height / 2)
            .attr('text-anchor', 'middle')
            .style('font-size', '12px')
            .text('Gap (Female - Male Years)');
        
        // X-axis label
        this.svg.append('text')
            .attr('class', 'axis-label')
            .attr('x', this.width / 2)
            .attr('y', this.height + 45)
            .attr('text-anchor', 'middle')
            .style('font-size', '12px')
            .text('Year');
    },
    
    /**
     * Draw time series for major countries (legacy method for backward compatibility)
     */
    drawTimeSeries() {
        const data = this.data.timeseries;
        
        // Create scales
        const xScale = d3.scaleLinear()
            .domain([1950, 2023])
            .range([0, this.width]);
        
        const allGaps = [];
        data.forEach(country => {
            country.values.forEach(v => allGaps.push(v.gap));
        });
        
        const yScale = d3.scaleLinear()
            .domain([0, d3.max(allGaps) * 1.1])
            .range([this.height, 0])
            .nice();
        
        // Color scale
        const colorScale = d3.scaleOrdinal(d3.schemeCategory10)
            .domain(data.map(d => d.country));
        
        // Gridlines
        this.svg.append('g')
            .attr('class', 'grid')
            .attr('transform', `translate(0,${this.height})`)
            .call(d3.axisBottom(xScale)
                .tickSize(-this.height)
                .tickFormat('')
                .ticks(10));
        
        this.svg.append('g')
            .attr('class', 'grid')
            .call(d3.axisLeft(yScale)
                .tickSize(-this.width)
                .tickFormat('')
                .ticks(8));
        
        // Line generator
        const line = d3.line()
            .x(d => xScale(d.year))
            .y(d => yScale(d.gap))
            .curve(d3.curveMonotoneX);
        
        // Tooltip
        const tooltip = d3.select('#tooltip');
        
        // Draw lines
        const lines = this.svg.selectAll('.gap-line')
            .data(data)
            .enter()
            .append('g')
            .attr('class', 'gap-line');
        
        lines.append('path')
            .attr('d', d => line(d.values))
            .attr('stroke', d => colorScale(d.country))
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
                const year = Math.round(xScale.invert(xPos));
                const dataPoint = d.values.find(v => v.year === year);
                
                if (dataPoint) {
                    tooltip
                        .style('display', 'block')
                        .style('left', d3.event.pageX + 10 + 'px')
                        .style('top', d3.event.pageY - 10 + 'px')
                        .html(`
                            <div style="font-weight: 600; margin-bottom: 4px;">${d.country} - ${year}</div>
                            <div>Female: ${dataPoint.female.toFixed(1)} years</div>
                            <div>Male: ${dataPoint.male.toFixed(1)} years</div>
                            <div style="margin-top: 4px; font-weight: 600;">Gap: ${dataPoint.gap.toFixed(1)} years</div>
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
        
        // Add direct labels
        lines.append('text')
            .attr('x', this.width + 5)
            .attr('y', d => yScale(d.values[d.values.length - 1].gap))
            .attr('dy', '0.35em')
            .attr('fill', d => colorScale(d.country))
            .style('font-size', '11px')
            .style('font-weight', '600')
            .text(d => d.country);
        
        // Add axes
        this.svg.append('g')
            .attr('class', 'axis')
            .attr('transform', `translate(0,${this.height})`)
            .call(d3.axisBottom(xScale)
                .tickFormat(d3.format('d'))
                .ticks(15));
        
        this.svg.append('g')
            .attr('class', 'axis')
            .call(d3.axisLeft(yScale).ticks(8));
        
        // Axis labels
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
            .text('Gender Gap in Life Expectancy (years)');
    }
};