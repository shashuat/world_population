/**
 * Ridgeline Plot - Global Ageing Distribution
 * Shows how median age has shifted across countries over decades
 */

const RidgelinePlotViz = {
    // Configuration
    margin: {top: 60, right: 60, bottom: 60, left: 100},
    svg: null,
    width: null,
    height: null,
    
    /**
     * Initialize ridgeline plot visualization
     */
    init(container, appState) {
        console.log('Initializing ridgeline plot visualization...');
        
        // Calculate dimensions
        const containerNode = container.node();
        const rect = containerNode.getBoundingClientRect();
        this.width = rect.width - this.margin.left - this.margin.right;
        this.height = 600 - this.margin.top - this.margin.bottom;
        
        // Clear existing
        container.selectAll('*').remove();
        
        // Create SVG
        this.svg = container
            .attr('width', this.width + this.margin.left + this.margin.right)
            .attr('height', 600)
            .append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);
        
        // Get data
        const ridgelineData = DataLoader.getRidgelineData();
        this.data = ridgelineData;
        
        if (!ridgelineData || ridgelineData.length === 0) {
            console.error('No ridgeline data available');
            return;
        }
        
        // Draw the ridgeline plot
        this.draw();
        
        // Mark processed
        appState.data.processed.ridgeline = true;
        
        console.log('✓ Ridgeline plot visualization initialized');
    },
    
    /**
     * Draw the ridgeline plot
     */
    draw() {
        // Scales
        const xScale = d3.scaleLinear()
            .domain([10, 60])
            .range([0, this.width]);
        
        const yScale = d3.scaleBand()
            .domain(this.data.map(d => d.decade))
            .range([0, this.height])
            .padding(0.1);
        
        const ridgeHeight = yScale.bandwidth();
        
        // Find max density for scaling
        const maxDensity = d3.max(this.data, d => 
            d3.max(d.distribution, p => p.density));
        
        const densityScale = d3.scaleLinear()
            .domain([0, maxDensity])
            .range([0, ridgeHeight * 1.5]);
        
        // Color scale (gradient from past to present)
        const colorScale = d3.scaleSequential(d3.interpolateViridis)
            .domain([1950, 2020]);
        
        // Area generator
        const area = d3.area()
            .x(d => xScale(d.age))
            .y0(ridgeHeight)
            .y1(d => ridgeHeight - densityScale(d.density))
            .curve(d3.curveBasis);
        
        // Line generator
        const line = d3.line()
            .x(d => xScale(d.age))
            .y(d => ridgeHeight - densityScale(d.density))
            .curve(d3.curveBasis);
        
        // Tooltip
        const tooltip = d3.select('#tooltip');
        
        // Draw each ridge
        const ridges = this.svg.selectAll('.ridge')
            .data(this.data)
            .enter()
            .append('g')
            .attr('class', 'ridge')
            .attr('transform', d => `translate(0,${yScale(d.decade)})`);
        
        // Add gradient fill
        ridges.append('path')
            .datum(d => d.distribution)
            .attr('d', area)
            .attr('fill', d => colorScale(d3.select(this.parentNode).datum().decade))
            .attr('fill-opacity', 0.6)
            .attr('stroke', 'none');
        
        // Add outline
        ridges.append('path')
            .datum(d => d.distribution)
            .attr('d', line)
            .attr('fill', 'none')
            .attr('stroke', d => colorScale(d3.select(this.parentNode).datum().decade))
            .attr('stroke-width', 2);
        
        // Add decade labels
        ridges.append('text')
            .attr('x', -10)
            .attr('y', ridgeHeight / 2)
            .attr('dy', '0.35em')
            .attr('text-anchor', 'end')
            .attr('fill', '#4a5568')
            .attr('font-size', '12px')
            .attr('font-weight', '600')
            .text(d => d.label);
        
        // Add mean age markers
        ridges.append('line')
            .attr('x1', d => xScale(d.mean))
            .attr('x2', d => xScale(d.mean))
            .attr('y1', ridgeHeight)
            .attr('y2', ridgeHeight - densityScale(maxDensity) * 0.5)
            .attr('stroke', d => colorScale(d.decade))
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '4,4')
            .attr('opacity', 0.7);
        
        // Interactive overlay for each ridge
        ridges.append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', this.width)
            .attr('height', ridgeHeight)
            .attr('fill', 'transparent')
            .on('mouseover', function(d) {
                d3.select(this.parentNode).select('path')
                    .transition()
                    .duration(100)
                    .attr('fill-opacity', 0.9);
                
                tooltip
                    .style('display', 'block')
                    .style('left', d3.event.pageX + 10 + 'px')
                    .style('top', d3.event.pageY - 10 + 'px')
                    .html(`
                        <div style="font-weight: 600; margin-bottom: 4px;">${d.label}</div>
                        <div>Countries: ${d.countries}</div>
                        <div>Mean Age: ${d.mean.toFixed(1)} years</div>
                        <div>Median Age: ${d.median.toFixed(1)} years</div>
                    `);
            })
            .on('mouseout', function() {
                d3.select(this.parentNode).select('path')
                    .transition()
                    .duration(200)
                    .attr('fill-opacity', 0.6);
                
                tooltip.style('display', 'none');
            });
        
        // Add axes
        this.svg.append('g')
            .attr('class', 'axis')
            .attr('transform', `translate(0,${this.height})`)
            .call(d3.axisBottom(xScale).ticks(10));
        
        // Add axis label
        this.svg.append('text')
            .attr('class', 'axis-label')
            .attr('text-anchor', 'middle')
            .attr('x', this.width / 2)
            .attr('y', this.height + 45)
            .text('Median Age (years)');
        
        // Add title annotation
        this.svg.append('text')
            .attr('x', this.width / 2)
            .attr('y', -30)
            .attr('text-anchor', 'middle')
            .attr('font-size', '14px')
            .attr('font-weight', '600')
            .attr('fill', '#2d3748')
            .text('The Rightward Shift: Global Population Aging (1950-2020)');
    }
};