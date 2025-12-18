/**
 * Hans Rosling Style Demographic Transition Animation
 * Adapted from viz3_hans_rosling_animation.js for dashboard integration
 */

const AnimationViz = {
    // Configuration
    margin: {top: 20, right: 150, bottom: 60, left: 80},
    svg: null,
    width: null,
    height: null,
    
    // Animation state
    state: {
        currentYear: 1950,
        isPlaying: false,
        animationInterval: null,
        animationSpeed: 1000,
        selectedCountries: new Set()
    },
    
    // Color scheme
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
     * Initialize animation visualization
     */
    init(container, appState) {
        console.log('Initializing Hans Rosling animation...');
        
        // Calculate dimensions
        const containerNode = container.node();
        const rect = containerNode.getBoundingClientRect();
        const totalWidth = rect.width;
        const totalHeight = rect.height > 0 ? rect.height : 600; // Use container height or fallback to 600
        
        this.width = totalWidth - this.margin.left - this.margin.right;
        this.height = totalHeight - this.margin.top - this.margin.bottom;
        
        // Clear existing
        container.selectAll('*').remove();
        
        // Create SVG
        this.svg = container
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${totalWidth} ${totalHeight}`)
            .attr('preserveAspectRatio', 'xMidYMid meet')
            .append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);
        
        // Get data
        const animationData = DataLoader.processAnimationData();
        this.data = animationData;
        
        // Create scales
        this.xScale = d3.scaleLinear()
            .domain([0, d3.max(animationData, d => d.fertility) * 1.1])
            .range([0, this.width])
            .nice();
        
        this.yScale = d3.scaleLinear()
            .domain([d3.min(animationData, d => d.lifeExpectancy) * 0.9,
                     d3.max(animationData, d => d.lifeExpectancy) * 1.05])
            .range([this.height, 0])
            .nice();
        
        this.sizeScale = d3.scaleSqrt()
            .domain([0, d3.max(animationData, d => d.population)])
            .range([2, 40]);
        
        this.colorScale = d3.scaleOrdinal()
            .domain(Object.keys(this.regionColors))
            .range(Object.values(this.regionColors));
        
        // Draw static elements
        this.drawAxes();
        this.drawLegend();
        
        // Set up controls
        this.setupControls();
        
        // Initial render
        this.update(1950);
        
        // Mark processed
        appState.data.processed.animation = true;
        
        console.log('✓ Animation visualization initialized');
    },
    
    /**
     * Draw axes and gridlines
     */
    drawAxes() {
        // Gridlines
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
                .ticks(10));
        
        // Axes
        this.svg.append('g')
            .attr('class', 'axis')
            .attr('transform', `translate(0,${this.height})`)
            .call(d3.axisBottom(this.xScale).ticks(10));
        
        this.svg.append('g')
            .attr('class', 'axis')
            .call(d3.axisLeft(this.yScale).ticks(10));
        
        // Axis labels
        this.svg.append('text')
            .attr('class', 'axis-label')
            .attr('text-anchor', 'middle')
            .attr('x', this.width / 2)
            .attr('y', this.height + 45)
            .text('Total Fertility Rate (births per woman)');
        
        this.svg.append('text')
            .attr('class', 'axis-label')
            .attr('text-anchor', 'middle')
            .attr('transform', 'rotate(-90)')
            .attr('x', -this.height / 2)
            .attr('y', -55)
            .text('Life Expectancy at Birth (years)');
    },
    
    /**
     * Draw legend
     */
    drawLegend() {
        const uniqueRegions = [...new Set(this.data.map(d => d.region))]
            .filter(r => r !== 'Unknown')
            .sort();
        
        const legend = d3.select('#animation-legend');
        legend.selectAll('*').remove();
        
        uniqueRegions.forEach(region => {
            const item = legend.append('div')
                .attr('class', 'legend-item')
                .style('display', 'inline-flex')
                .style('align-items', 'center')
                .style('gap', '8px')
                .style('margin-right', '20px');
            
            item.append('div')
                .attr('class', 'legend-circle')
                .style('width', '14px')
                .style('height', '14px')
                .style('border-radius', '50%')
                .style('background-color', this.colorScale(region));
            
            item.append('span')
                .attr('class', 'legend-text')
                .style('font-size', '13px')
                .text(region);
        });
    },
    
    /**
     * Set up animation controls
     */
    setupControls() {
        const self = this;
        
        // Play button
        document.getElementById('anim-play-btn').addEventListener('click', () => {
            self.play();
        });
        
        // Pause button
        document.getElementById('anim-pause-btn').addEventListener('click', () => {
            self.pause();
        });
        
        // Reset button
        document.getElementById('anim-reset-btn').addEventListener('click', () => {
            self.reset();
        });
        
        // Year slider
        document.getElementById('anim-year-slider').addEventListener('input', (e) => {
            if (self.state.isPlaying) {
                self.pause();
            }
            self.update(parseInt(e.target.value));
        });
        
        // Speed controls
        document.querySelectorAll('#animation-view .speed-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('#animation-view .speed-btn').forEach(b => 
                    b.classList.remove('active'));
                this.classList.add('active');
                self.state.animationSpeed = parseInt(this.dataset.speed);
            });
        });
    },
    /**
 * Update visualization for given year
 */
update(year) {
    this.state.currentYear = year;
    
    // Update displays
    d3.select('#year-display').text(year);
    document.getElementById('anim-slider-label').textContent = year;
    document.getElementById('anim-year-slider').value = year;
    
    // Filter data for current year
    const yearData = this.data.filter(d => 
        d.year === year && d.region !== 'Unknown');
    
    // Tooltip
    const tooltip = d3.select('#tooltip');
    const self = this;
    
    // Data join
    const circles = this.svg.selectAll('.circle')
        .data(yearData, d => d.country);
    
    // Enter + Update
    circles.enter()
        .append('circle')
        .attr('class', 'circle')
        .attr('cx', d => this.xScale(d.fertility))
        .attr('cy', d => this.yScale(d.lifeExpectancy))
        .attr('r', 0)
        .attr('fill', d => this.colorScale(d.region))
        .attr('fill-opacity', 0.7)
        .attr('stroke', '#333')
        .attr('stroke-width', 1)
        .on('mouseover', function(d) {
            // Highlight bubble
            d3.select(this)
                .raise()
                .transition()
                .duration(100)
                .attr('r', self.sizeScale(d.population) * 1.3)
                .attr('stroke-width', 2)
                .attr('fill-opacity', 1);
            
            // Show Tooltip with Flag and Name
            tooltip
                .style('display', 'block')
                .style('opacity', 1) // Critical fix: ensure opacity is 1
                .style('left', d3.event.pageX + 15 + 'px')
                .style('top', d3.event.pageY - 15 + 'px')
                .html(`
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px; border-bottom: 1px solid #555; padding-bottom: 6px;">
                        <img src="img/flags/${d.iso3}.png" alt="" style="width: 28px; height: 20px; border-radius: 2px; object-fit: cover; box-shadow: 0 1px 3px rgba(0,0,0,0.3);">
                        <div style="font-weight: 700; font-size: 15px; color: #fff;">${d.country}</div>
                    </div>
                    <div style="font-size: 13px; line-height: 1.5;">
                        <div style="display: flex; justify-content: space-between; gap: 20px;">
                            <span>Fertility:</span> <strong>${d.fertility.toFixed(2)}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; gap: 20px;">
                            <span>Life Exp:</span> <strong>${d.lifeExpectancy.toFixed(1)}y</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; gap: 20px;">
                            <span>Pop:</span> <strong>${d3.format(',.1f')(d.population/1000)}M</strong>
                        </div>
                    </div>
                `);
        })
        .on('mousemove', function() {
            // Keep tooltip following cursor
            tooltip
                .style('left', d3.event.pageX + 15 + 'px')
                .style('top', d3.event.pageY - 15 + 'px');
        })
        .on('mouseout', function(d) {
            // Restore bubble
            d3.select(this)
                .transition()
                .duration(200)
                .attr('r', self.sizeScale(d.population))
                .attr('stroke-width', 1)
                .attr('fill-opacity', 0.7);
            
            // Hide tooltip
            tooltip.style('opacity', 0).style('display', 'none');
        })
        .merge(circles)
        .transition()
        .duration(this.state.animationSpeed * 0.8)
        .attr('cx', d => this.xScale(d.fertility))
        .attr('cy', d => this.yScale(d.lifeExpectancy))
        .attr('r', d => this.sizeScale(d.population));
    
    // Exit
    circles.exit()
        .transition()
        .duration(this.state.animationSpeed * 0.3)
        .attr('r', 0)
        .remove();
},
    
    /**
     * Play animation
     */
    play() {
        if (this.state.isPlaying) return;
        
        this.state.isPlaying = true;
        document.getElementById('anim-play-btn').disabled = true;
        document.getElementById('anim-pause-btn').disabled = false;
        
        const self = this;
        this.state.animationInterval = setInterval(() => {
            if (self.state.currentYear < 2023) {
                self.update(self.state.currentYear + 1);
            } else {
                self.pause();
            }
        }, this.state.animationSpeed);
    },
    
    /**
     * Pause animation
     */
    pause() {
        this.state.isPlaying = false;
        document.getElementById('anim-play-btn').disabled = false;
        document.getElementById('anim-pause-btn').disabled = true;
        clearInterval(this.state.animationInterval);
    },
    
    /**
     * Reset to 1950
     */
    reset() {
        if (this.state.isPlaying) {
            this.pause();
        }
        this.update(1950);
    }
};