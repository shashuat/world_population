/**
 * Growth Drivers Scatter Plot
 * X: Natural Change Rate, Y: Migration Rate, Size: Population, Color: Region
 */

const GrowthDriversViz = {
    // Configuration
    margin: {top: 20, right: 150, bottom: 60, left: 80},
    svg: null,
    width: null,
    height: null,
    
    // Animation state
    state: {
        currentYear: 2023,
        isPlaying: false,
        animationInterval: null,
        labeledCountries: new Set(['China', 'India', 'United States of America', 'Nigeria', 'Brazil', 'Japan', 'Germany', 'United Kingdom'])
    },
    
    // Color scheme (matching regions)
    regionColors: {
        'Africa': '#e41a1c',
        'Asia': '#377eb8',
        'Europe': '#4daf4a',
        'Latin America and the Caribbean': '#984ea3',
        'Northern America': '#ff7f00',
        'Oceania': '#a65628',
        'Unknown': '#999999'
    },
    
    /**
     * Initialize growth drivers visualization
     */
    init(container, appState) {
        console.log('Initializing growth drivers visualization...');
        
        // Calculate dimensions
        const containerNode = container.node();
        const rect = containerNode.getBoundingClientRect();
        this.width = rect.width - this.margin.left - this.margin.right;
        this.height = rect.height - this.margin.top - this.margin.bottom;
        
        // Clear existing
        container.selectAll('*').remove();
        
        // Create SVG
        this.svg = container
            .attr('width', this.width + this.margin.left + this.margin.right)
            .attr('height', this.height + this.margin.top + this.margin.bottom)
            .append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);
        
        // Get data
        const growthData = DataLoader.getGrowthDriversData();
        this.data = growthData;
        
        if (!growthData || growthData.length === 0) {
            console.error('No growth drivers data available');
            return;
        }
        
        // Create scales (using symlog to handle clustering and negative values)
        this.xScale = d3.scaleSymlog()
            .domain([
                d3.min(growthData, d => d.naturalChange) * 1.1,
                d3.max(growthData, d => d.naturalChange) * 1.1
            ])
            .range([0, this.width])
            .nice();
        
        this.yScale = d3.scaleSymlog()
            .domain([
                d3.min(growthData, d => d.migrationRate) * 1.1,
                d3.max(growthData, d => d.migrationRate) * 1.1
            ])
            .range([this.height, 0])
            .nice();
        
        this.sizeScale = d3.scaleSqrt()
            .domain([0, d3.max(growthData, d => d.population)])
            .range([2, 40]);
        
        this.colorScale = d3.scaleOrdinal()
            .domain(Object.keys(this.regionColors))
            .range(Object.values(this.regionColors));
        
        // Draw static elements
        this.drawAxes();
        this.drawQuadrants();
        this.drawLegend();
        
        // Set up controls
        this.setupControls();
        
        // Initial render
        this.update(2023);
        
        // Mark processed
        appState.data.processed.growthDrivers = true;
        
        console.log('✓ Growth drivers visualization initialized');
    },
    
    /**
     * Draw axes and gridlines
     */
    drawAxes() {
        // Calculate appropriate tick values for the data
        const xDomain = this.xScale.domain();
        const yDomain = this.yScale.domain();
        
        // Generate tick values that make sense for natural change rate (-20 to 40)
        const xTicks = [-20, -10, -5, 0, 5, 10, 15, 20, 25, 30, 35, 40]
            .filter(v => v >= xDomain[0] && v <= xDomain[1]);
        
        // Generate tick values that make sense for migration rate (-10 to 15)
        const yTicks = [-10, -5, -2, 0, 2, 5, 10, 15]
            .filter(v => v >= yDomain[0] && v <= yDomain[1]);
        
        // Gridlines
        this.svg.append('g')
            .attr('class', 'grid')
            .attr('transform', `translate(0,${this.height})`)
            .call(d3.axisBottom(this.xScale)
                .tickSize(-this.height)
                .tickFormat('')
                .tickValues(xTicks));
        
        this.svg.append('g')
            .attr('class', 'grid')
            .call(d3.axisLeft(this.yScale)
                .tickSize(-this.width)
                .tickFormat('')
                .tickValues(yTicks));
        
        // Axes
        this.svg.append('g')
            .attr('class', 'axis')
            .attr('transform', `translate(0,${this.height})`)
            .call(d3.axisBottom(this.xScale)
                .tickValues(xTicks)
                .tickFormat(d => d));
        
        this.svg.append('g')
            .attr('class', 'axis')
            .call(d3.axisLeft(this.yScale)
                .tickValues(yTicks)
                .tickFormat(d => d));
        
        // Zero lines (reference)
        this.svg.append('line')
            .attr('x1', this.xScale(0))
            .attr('x2', this.xScale(0))
            .attr('y1', 0)
            .attr('y2', this.height)
            .attr('stroke', '#333')
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '5,5');
        
        this.svg.append('line')
            .attr('x1', 0)
            .attr('x2', this.width)
            .attr('y1', this.yScale(0))
            .attr('y2', this.yScale(0))
            .attr('stroke', '#333')
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '5,5');
        
        // Axis labels
        this.svg.append('text')
            .attr('class', 'axis-label')
            .attr('text-anchor', 'middle')
            .attr('x', this.width / 2)
            .attr('y', this.height + 45)
            .text('Natural Change Rate (per 1,000 population)');
        
        this.svg.append('text')
            .attr('class', 'axis-label')
            .attr('text-anchor', 'middle')
            .attr('transform', 'rotate(-90)')
            .attr('x', -this.height / 2)
            .attr('y', -55)
            .text('Net Migration Rate (per 1,000 population)');
    },
    
    /**
     * Draw quadrant labels
     */
    drawQuadrants() {
        const quadrants = [
            {x: 0.75, y: 0.25, text: 'Growing: Births + Immigration', color: '#4daf4a'},
            {x: 0.25, y: 0.25, text: 'Shrinking: Deaths + Emigration', color: '#e41a1c'},
            {x: 0.75, y: 0.75, text: 'Growing: Births - Emigration', color: '#377eb8'},
            {x: 0.25, y: 0.75, text: 'Immigration Compensates', color: '#ff7f00'}
        ];
        
        quadrants.forEach(q => {
            this.svg.append('text')
                .attr('x', this.width * q.x)
                .attr('y', this.height * q.y)
                .attr('text-anchor', 'middle')
                .attr('fill', q.color)
                .attr('font-size', '11px')
                .attr('font-weight', '600')
                .attr('opacity', 0.5)
                .text(q.text);
        });
    },
    
    /**
     * Draw legend
     */
    drawLegend() {
        const uniqueRegions = [...new Set(this.data.map(d => d.region))]
            .filter(r => r !== 'Unknown')
            .sort();
        
        const legend = d3.select('#growth-legend');
        legend.selectAll('*').remove();
        
        uniqueRegions.forEach(region => {
            const item = legend.append('div')
                .attr('class', 'legend-item')
                .style('display', 'inline-flex')
                .style('align-items', 'center')
                .style('gap', '8px')
                .style('margin-right', '20px');
            
            item.append('div')
                .style('width', '14px')
                .style('height', '14px')
                .style('border-radius', '50%')
                .style('background-color', this.colorScale(region));
            
            item.append('span')
                .style('font-size', '13px')
                .text(region);
        });
    },
    
    /**
     * Set up controls
     */
    setupControls() {
        const self = this;
        
        // Play button
        document.getElementById('growth-play-btn').addEventListener('click', () => {
            self.play();
        });
        
        // Pause button
        document.getElementById('growth-pause-btn').addEventListener('click', () => {
            self.pause();
        });
        
        // Reset button
        document.getElementById('growth-reset-btn').addEventListener('click', () => {
            self.reset();
        });
        
        // Year slider
        document.getElementById('growth-year-slider').addEventListener('input', (e) => {
            if (self.state.isPlaying) {
                self.pause();
            }
            self.update(parseInt(e.target.value));
        });
    },
    
    /**
     * Update visualization for given year
     */
    update(year) {
        this.state.currentYear = year;
        
        // Update displays
        document.getElementById('growth-slider-label').textContent = year;
        document.getElementById('growth-year-slider').value = year;
        
        // Filter data for current year
        const yearData = this.data.filter(d => 
            d.year === year && d.region !== 'Unknown');
        
        // Tooltip
        const tooltip = d3.select('#tooltip');
        const self = this;
        
        // Data join
        const circles = this.svg.selectAll('.growth-circle')
            .data(yearData, d => d.country);
        
        // Enter
        circles.enter()
            .append('circle')
            .attr('class', 'growth-circle')
            .attr('cx', d => this.xScale(d.naturalChange))
            .attr('cy', d => this.yScale(d.migrationRate))
            .attr('r', 0)
            .attr('fill', d => this.colorScale(d.region))
            .attr('fill-opacity', 0.7)
            .attr('stroke', '#333')
            .attr('stroke-width', 1)
            .on('mouseover', function(d) {
                d3.select(this)
                    .raise()
                    .transition()
                    .duration(100)
                    .attr('r', self.sizeScale(d.population) * 1.3)
                    .attr('stroke-width', 2)
                    .attr('fill-opacity', 1);
                
                tooltip
                    .style('display', 'block')
                    .style('opacity', 1)
                    .style('left', d3.event.pageX + 15 + 'px')
                    .style('top', d3.event.pageY - 15 + 'px')
                    .html(`
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px; border-bottom: 1px solid #555; padding-bottom: 6px;">
                            <img src="img/flags/${d.iso3}.png" alt="" style="width: 28px; height: 20px; border-radius: 2px; object-fit: cover; box-shadow: 0 1px 3px rgba(0,0,0,0.3);">
                            <div style="font-weight: 700; font-size: 15px; color: #fff;">${d.country}</div>
                        </div>
                        <div style="font-size: 13px; line-height: 1.5;">
                            <div style="display: flex; justify-content: space-between; gap: 20px;">
                                <span>Natural Change:</span> <strong>${d.naturalChange.toFixed(2)} per 1k</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; gap: 20px;">
                                <span>Migration Rate:</span> <strong>${d.migrationRate.toFixed(2)} per 1k</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; gap: 20px;">
                                <span>Population:</span> <strong>${d3.format(',.1f')(d.population/1000)}M</strong>
                            </div>
                        </div>
                    `);
            })
            .on('mousemove', function() {
                tooltip
                    .style('left', d3.event.pageX + 15 + 'px')
                    .style('top', d3.event.pageY - 15 + 'px');
            })
            .on('mouseout', function(d) {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr('r', self.sizeScale(d.population))
                    .attr('stroke-width', 1)
                    .attr('fill-opacity', 0.7);
                
                tooltip.style('opacity', 0).style('display', 'none');
            })
            .merge(circles)
            .transition()
            .duration(500)
            .attr('cx', d => this.xScale(d.naturalChange))
            .attr('cy', d => this.yScale(d.migrationRate))
            .attr('r', d => this.sizeScale(d.population));
        
        // Exit
        circles.exit()
            .transition()
            .duration(300)
            .attr('r', 0)
            .remove();
        
        // Update country labels for selected countries
        const labeledData = yearData.filter(d => this.state.labeledCountries.has(d.country));
        
        const labels = this.svg.selectAll('.country-label')
            .data(labeledData, d => d.country);
        
        // Enter
        labels.enter()
            .append('text')
            .attr('class', 'country-label')
            .attr('x', d => this.xScale(d.naturalChange))
            .attr('y', d => this.yScale(d.migrationRate) - this.sizeScale(d.population) - 5)
            .attr('text-anchor', 'middle')
            .attr('font-size', '11px')
            .attr('font-weight', '600')
            .attr('fill', '#333')
            .attr('opacity', 0)
            .text(d => d.country)
            .merge(labels)
            .transition()
            .duration(500)
            .attr('x', d => this.xScale(d.naturalChange))
            .attr('y', d => this.yScale(d.migrationRate) - this.sizeScale(d.population) - 5)
            .attr('opacity', 0.8);
        
        // Exit
        labels.exit()
            .transition()
            .duration(300)
            .attr('opacity', 0)
            .remove();
    },
    
    /**
     * Play animation
     */
    play() {
        if (this.state.isPlaying) return;
        
        this.state.isPlaying = true;
        document.getElementById('growth-play-btn').disabled = true;
        document.getElementById('growth-pause-btn').disabled = false;
        
        const self = this;
        this.state.animationInterval = setInterval(() => {
            if (self.state.currentYear < 2023) {
                self.update(self.state.currentYear + 1);
            } else {
                self.pause();
            }
        }, 1000);
    },
    
    /**
     * Pause animation
     */
    pause() {
        this.state.isPlaying = false;
        document.getElementById('growth-play-btn').disabled = false;
        document.getElementById('growth-pause-btn').disabled = true;
        clearInterval(this.state.animationInterval);
    },
    
    /**
     * Reset to 2023
     */
    reset() {
        if (this.state.isPlaying) {
            this.pause();
        }
        this.update(2023);
    },
    
    /**
     * Highlight country (called from coordinated views)
     */
    highlightCountry(countryName) {
        this.svg.selectAll('.growth-circle')
            .attr('stroke', d => d.country === countryName ? '#ff0000' : '#333')
            .attr('stroke-width', d => d.country === countryName ? 3 : 1)
            .attr('fill-opacity', d => d.country === countryName ? 1 : 0.7);
    }
};