/**
 * Gender Gap Visualization
 * Slopegraph showing male vs female life expectancy (1950 vs 2023)
 * Plus time series for selected countries
 */

const GenderGapViz = {
    // Configuration
    margin: {top: 40, right: 120, bottom: 60, left: 120},
    svg: null,
    width: null,
    height: null,
    currentMode: 'slopegraph',
    
    /**
     * Initialize gender gap visualization
     */
    init(container, appState) {
        console.log('Initializing gender gap visualization...');
        
        // Calculate dimensions
        const containerNode = container.node();
        const rect = containerNode.getBoundingClientRect();
        this.width = rect.width - this.margin.left - this.margin.right;
        this.height = 700 - this.margin.top - this.margin.bottom;
        
        // Clear existing
        container.selectAll('*').remove();
        
        // Create SVG
        this.svg = container
            .attr('width', this.width + this.margin.left + this.margin.right)
            .attr('height', 700)
            .append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);
        
        // Get data
        const genderData = DataLoader.getGenderGapData();
        this.data = genderData;
        
        if (!genderData || !genderData.comparison) {
            console.error('No gender gap data available');
            return;
        }
        
        // Set up controls
        this.setupControls();
        
        // Initial render
        this.drawSlopegraph();
        
        // Mark processed
        appState.data.processed.genderGap = true;
        
        console.log('✓ Gender gap visualization initialized');
    },
    
    /**
     * Set up mode controls
     */
    setupControls() {
        const self = this;
        
        document.querySelectorAll('#gender-gap-view .mode-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('#gender-gap-view .mode-btn').forEach(b => 
                    b.classList.remove('active'));
                this.classList.add('active');
                self.currentMode = this.dataset.mode;
                
                self.svg.selectAll('*').remove();
                
                if (self.currentMode === 'slopegraph') {
                    self.drawSlopegraph();
                } else {
                    self.drawTimeSeries();
                }
            });
        });
    },
    
    /**
     * Draw slopegraph (1950 vs 2023)
     */
    drawSlopegraph() {
        const data = this.data.comparison;
        
        // Extract year keys dynamically
        const yearKeys = Object.keys(data[0]).filter(k => k.startsWith('year'));
        const year1Key = yearKeys[0];
        const year2Key = yearKeys[1];
        const year1 = parseInt(year1Key.replace('year', ''));
        const year2 = parseInt(year2Key.replace('year', ''));
        
        // Sort by gap change
        const sortedData = data.sort((a, b) => b.gapChange - a.gapChange).slice(0, 30); // Top 30
        
        // Scales
        const xScale = d3.scalePoint()
            .domain([year1, year2])
            .range([0, this.width])
            .padding(0.1);
        
        // Get extent of life expectancy values
        const allValues = [];
        sortedData.forEach(d => {
            allValues.push(d[year1Key].male, d[year1Key].female, d[year2Key].male, d[year2Key].female);
        });
        
        const yScale = d3.scaleLinear()
            .domain([d3.min(allValues) - 5, d3.max(allValues) + 5])
            .range([this.height, 0])
            .nice();
        
        // Color scale by region
        const regionColors = {
            'Africa': '#e41a1c',
            'Asia': '#377eb8',
            'Europe': '#4daf4a',
            'Latin America and the Caribbean': '#984ea3',
            'Northern America': '#ff7f00',
            'Oceania': '#a65628'
        };
        
        const colorScale = d3.scaleOrdinal()
            .domain(Object.keys(regionColors))
            .range(Object.values(regionColors));
        
        // Gridlines
        this.svg.append('g')
            .attr('class', 'grid')
            .call(d3.axisLeft(yScale)
                .tickSize(-this.width)
                .tickFormat('')
                .ticks(10));
        
        // Year labels
        this.svg.append('text')
            .attr('x', xScale(year1))
            .attr('y', -15)
            .attr('text-anchor', 'middle')
            .attr('font-size', '16px')
            .attr('font-weight', '700')
            .attr('fill', '#2d3748')
            .text(year1);
        
        this.svg.append('text')
            .attr('x', xScale(year2))
            .attr('y', -15)
            .attr('text-anchor', 'middle')
            .attr('font-size', '16px')
            .attr('font-weight', '700')
            .attr('fill', '#2d3748')
            .text(year2);
        
        // Tooltip
        const tooltip = d3.select('#tooltip');
        
        // Draw lines for each country
        const lines = this.svg.selectAll('.slope-line')
            .data(sortedData)
            .enter()
            .append('g')
            .attr('class', 'slope-line');
        
        // Female line (on top)
        lines.append('line')
            .attr('class', 'female-line')
            .attr('x1', xScale(year1))
            .attr('y1', d => yScale(d[year1Key].female))
            .attr('x2', xScale(year2))
            .attr('y2', d => yScale(d[year2Key].female))
            .attr('stroke', d => colorScale(d.region))
            .attr('stroke-width', 2)
            .attr('stroke-opacity', 0.6);
        
        // Male line (below)
        lines.append('line')
            .attr('class', 'male-line')
            .attr('x1', xScale(year1))
            .attr('y1', d => yScale(d[year1Key].male))
            .attr('x2', xScale(year2))
            .attr('y2', d => yScale(d[year2Key].male))
            .attr('stroke', d => colorScale(d.region))
            .attr('stroke-width', 2)
            .attr('stroke-opacity', 0.3)
            .attr('stroke-dasharray', '4,4');
        
        // Add circles at endpoints (only for first 10 for clarity)
        sortedData.slice(0, 10).forEach(d => {
            // 1950 female
            this.svg.append('circle')
                .attr('cx', xScale(year1))
                .attr('cy', yScale(d[year1Key].female))
                .attr('r', 4)
                .attr('fill', colorScale(d.region));
            
            // 2023 female
            this.svg.append('circle')
                .attr('cx', xScale(year2))
                .attr('cy', yScale(d[year2Key].female))
                .attr('r', 4)
                .attr('fill', colorScale(d.region));
        });
        
        // Interactive overlay
        const self = this;
        lines.append('rect')
            .attr('x', xScale(year1) - 10)
            .attr('y', d => Math.min(yScale(d[year1Key].female), yScale(d[year2Key].female)) - 5)
            .attr('width', xScale(year2) - xScale(year1) + 20)
            .attr('height', d => Math.abs(yScale(d[year1Key].female) - yScale(d[year2Key].female)) + 10)
            .attr('fill', 'transparent')
            .on('mouseover', function(d) {
                d3.select(this.parentNode).selectAll('line')
                    .transition()
                    .duration(100)
                    .attr('stroke-width', 4)
                    .attr('stroke-opacity', 1);
                
                tooltip
                    .style('display', 'block')
                    .style('left', d3.event.pageX + 10 + 'px')
                    .style('top', d3.event.pageY - 10 + 'px')
                    .html(`
                        <div style="font-weight: 600; margin-bottom: 8px;">${d.country}</div>
                        <div style="margin-bottom: 4px;"><strong>${year1}:</strong></div>
                        <div>Female: ${d[year1Key].female.toFixed(1)} years</div>
                        <div>Male: ${d[year1Key].male.toFixed(1)} years</div>
                        <div>Gap: ${d[year1Key].gap.toFixed(1)} years</div>
                        <div style="margin-top: 8px; margin-bottom: 4px;"><strong>${year2}:</strong></div>
                        <div>Female: ${d[year2Key].female.toFixed(1)} years</div>
                        <div>Male: ${d[year2Key].male.toFixed(1)} years</div>
                        <div>Gap: ${d[year2Key].gap.toFixed(1)} years</div>
                        <div style="margin-top: 8px; font-weight: 600;">Gap Change: ${d.gapChange > 0 ? '+' : ''}${d.gapChange.toFixed(1)} years</div>
                    `);
            })
            .on('mouseout', function() {
                d3.select(this.parentNode).selectAll('line')
                    .transition()
                    .duration(200)
                    .attr('stroke-width', 2)
                    .attr('stroke-opacity', d => d3.select(this).classed('female-line') ? 0.6 : 0.3);
                
                tooltip.style('display', 'none');
            });
        
        // Add axis
        this.svg.append('g')
            .attr('class', 'axis')
            .call(d3.axisLeft(yScale).ticks(10));
        
        // Axis label
        this.svg.append('text')
            .attr('class', 'axis-label')
            .attr('text-anchor', 'middle')
            .attr('transform', 'rotate(-90)')
            .attr('x', -this.height / 2)
            .attr('y', -70)
            .text('Life Expectancy at Birth (years)');
        
        // Legend
        this.updateLegend('slopegraph');
    },
    
    /**
     * Draw time series for major countries
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
        
        // Legend
        this.updateLegend('timeseries');
    },
    
    /**
     * Update legend
     */
    updateLegend(mode) {
        const legend = d3.select('#gender-gap-legend');
        legend.selectAll('*').remove();
        
        if (mode === 'slopegraph') {
            const femaleItem = legend.append('div')
                .attr('class', 'legend-item')
                .style('display', 'inline-flex')
                .style('align-items', 'center')
                .style('gap', '8px')
                .style('margin-right', '20px');
            
            femaleItem.append('div')
                .style('width', '30px')
                .style('height', '3px')
                .style('background-color', '#667eea');
            
            femaleItem.append('span')
                .style('font-size', '13px')
                .text('Female Life Expectancy');
            
            const maleItem = legend.append('div')
                .attr('class', 'legend-item')
                .style('display', 'inline-flex')
                .style('align-items', 'center')
                .style('gap', '8px');
            
            maleItem.append('div')
                .style('width', '30px')
                .style('height', '3px')
                .style('background-color', '#667eea')
                .style('opacity', '0.3')
                .style('border', '1px dashed #667eea');
            
            maleItem.append('span')
                .style('font-size', '13px')
                .text('Male Life Expectancy');
        }
    }
};