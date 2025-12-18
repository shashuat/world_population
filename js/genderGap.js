/**
 * Gender Gap Visualization
 * Time series showing male vs female life expectancy gap
 */

const GenderGapViz = {
    // Configuration
    margin: {top: 40, right: 120, bottom: 60, left: 80},
    svg: null,
    width: null,
    height: null,
    
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
        
        if (!genderData || !genderData.timeseries) {
            console.error('No gender gap data available');
            return;
        }
        
        // Draw time series
        this.drawTimeSeries();
        
        // Mark processed
        appState.data.processed.genderGap = true;
        
        console.log('✓ Gender gap visualization initialized');
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
    }
};