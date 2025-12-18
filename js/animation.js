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
        selectedCountries: new Set(),
        xAxis: 'fertility',
        yAxis: 'lifeExpectancy'
    },
    
    // Major countries to always label
    majorCountries: [
        'China', 'India', 
        'Brazil', 'Nigeria',
        'Japan', 'Ethiopia', 
        'Germany',  'France', 'Italy'
    ],
    
    // Available metrics for axes
    metrics: {
        fertility: {
            label: 'Fertility Rate (births per woman)',
            accessor: d => d.fertility,
            format: d3.format('.2f')
        },
        lifeExpectancy: {
            label: 'Life Expectancy (years)',
            accessor: d => d.lifeExpectancy,
            format: d3.format('.1f')
        },
        population: {
            label: 'Population (millions)',
            accessor: d => d.population / 1000000,
            format: d3.format(',.1f')
        },
        birthRate: {
            label: 'Birth Rate (per 1000)',
            accessor: d => d.birthRate || d.fertility * 15,
            format: d3.format('.1f')
        },
        deathRate: {
            label: 'Death Rate (per 1000)',
            accessor: d => d.deathRate || (1000 / d.lifeExpectancy) * 13,
            format: d3.format('.1f')
        }
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
        
        // Create scales (will be updated by updateScales)
        this.xScale = d3.scaleLinear().range([0, this.width]);
        this.yScale = d3.scaleLinear().range([this.height, 0]);
        
        this.sizeScale = d3.scaleSqrt()
            .domain([0, d3.max(animationData, d => d.population)])
            .range([2, 40]);
        
        this.colorScale = d3.scaleOrdinal()
            .domain(Object.keys(this.regionColors))
            .range(Object.values(this.regionColors));
        
        // Update scales with initial axes
        this.updateScales();
        
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
     * Update scales based on selected axes
     */
    updateScales() {
        const xMetric = this.metrics[this.state.xAxis];
        const yMetric = this.metrics[this.state.yAxis];
        
        const xValues = this.data.map(xMetric.accessor);
        const yValues = this.data.map(yMetric.accessor);
        
        this.xScale.domain([0, d3.max(xValues) * 1.1]).nice();
        this.yScale.domain([d3.min(yValues) * 0.9, d3.max(yValues) * 1.05]).nice();
    },
    
    /**
     * Draw axes and gridlines
     */
    drawAxes() {
        // Create containers for dynamic elements
        this.svg.append('g').attr('class', 'grid-x');
        this.svg.append('g').attr('class', 'grid-y');
        this.svg.append('g').attr('class', 'axis-x');
        this.svg.append('g').attr('class', 'axis-y');
        this.svg.append('text').attr('class', 'axis-label-x');
        this.svg.append('text').attr('class', 'axis-label-y');
        
        // Initial draw
        this.redrawAxes();
    },
    
    /**
     * Redraw axes with current selections
     */
    redrawAxes() {
        const xMetric = this.metrics[this.state.xAxis];
        const yMetric = this.metrics[this.state.yAxis];
        
        // Gridlines
        this.svg.select('.grid-x')
            .attr('transform', `translate(0,${this.height})`)
            .call(d3.axisBottom(this.xScale)
                .tickSize(-this.height)
                .tickFormat('')
                .ticks(10));
        
        this.svg.select('.grid-y')
            .call(d3.axisLeft(this.yScale)
                .tickSize(-this.width)
                .tickFormat('')
                .ticks(10));
        
        // Axes
        this.svg.select('.axis-x')
            .attr('transform', `translate(0,${this.height})`)
            .call(d3.axisBottom(this.xScale).ticks(10));
        
        this.svg.select('.axis-y')
            .call(d3.axisLeft(this.yScale).ticks(10));
        
        // Axis labels
        this.svg.select('.axis-label-x')
            .attr('text-anchor', 'middle')
            .attr('x', this.width / 2)
            .attr('y', this.height + 45)
            .text(xMetric.label);
        
        this.svg.select('.axis-label-y')
            .attr('text-anchor', 'middle')
            .attr('transform', 'rotate(-90)')
            .attr('x', -this.height / 2)
            .attr('y', -55)
            .text(yMetric.label);
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
        
        // Create axis selection dropdowns if they don't exist
        this.createAxisControls();
        
        // X-axis selector
        const xAxisSelect = document.getElementById('anim-x-axis');
        if (xAxisSelect) {
            xAxisSelect.addEventListener('change', (e) => {
                self.state.xAxis = e.target.value;
                self.updateScales();
                self.redrawAxes();
                self.update(self.state.currentYear);
            });
        }
        
        // Y-axis selector
        const yAxisSelect = document.getElementById('anim-y-axis');
        if (yAxisSelect) {
            yAxisSelect.addEventListener('change', (e) => {
                self.state.yAxis = e.target.value;
                self.updateScales();
                self.redrawAxes();
                self.update(self.state.currentYear);
            });
        }
        
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
     * Create axis selection controls
     */
    createAxisControls() {
        const controlsContainer = document.querySelector('#animation-view .animation-controls');
        if (!controlsContainer || document.getElementById('anim-x-axis')) return;
        
        const axisControls = document.createElement('div');
        axisControls.className = 'axis-controls';
        axisControls.style.display = 'flex';
        axisControls.style.gap = '20px';
        axisControls.style.alignItems = 'center';
        axisControls.style.marginBottom = '15px';
        axisControls.style.paddingBottom = '15px';
        axisControls.style.borderBottom = '1px solid #e0e0e0';
        axisControls.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <label for="anim-x-axis" style="font-size: 14px; font-weight: 500; color: #333;">X-Axis:</label>
                <select id="anim-x-axis" style="padding: 6px 10px; border-radius: 4px; border: 1px solid #ccc; font-size: 13px; min-width: 200px;">
                    ${Object.entries(this.metrics).map(([key, metric]) => 
                        `<option value="${key}" ${key === 'fertility' ? 'selected' : ''}>${metric.label}</option>`
                    ).join('')}
                </select>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <label for="anim-y-axis" style="font-size: 14px; font-weight: 500; color: #333;">Y-Axis:</label>
                <select id="anim-y-axis" style="padding: 6px 10px; border-radius: 4px; border: 1px solid #ccc; font-size: 13px; min-width: 200px;">
                    ${Object.entries(this.metrics).map(([key, metric]) => 
                        `<option value="${key}" ${key === 'lifeExpectancy' ? 'selected' : ''}>${metric.label}</option>`
                    ).join('')}
                </select>
            </div>
        `;
        
        controlsContainer.insertBefore(axisControls, controlsContainer.firstChild);
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
    
    // Get current metric accessors
    const xMetric = this.metrics[this.state.xAxis];
    const yMetric = this.metrics[this.state.yAxis];
    
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
        .attr('cx', d => this.xScale(xMetric.accessor(d)))
        .attr('cy', d => this.yScale(yMetric.accessor(d)))
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
            
            // Get formatted values for current axes
            const xValue = xMetric.format(xMetric.accessor(d));
            const yValue = yMetric.format(yMetric.accessor(d));
            const xLabel = xMetric.label.split('(')[0].trim();
            const yLabel = yMetric.label.split('(')[0].trim();
            
            // Show Tooltip with Flag and Name
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
                            <span>${xLabel}:</span> <strong>${xValue}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; gap: 20px;">
                            <span>${yLabel}:</span> <strong>${yValue}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; gap: 20px;">
                            <span>Population:</span> <strong>${d3.format(',.1f')(d.population/1000000)}M</strong>
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
        .attr('cx', d => this.xScale(xMetric.accessor(d)))
        .attr('cy', d => this.yScale(yMetric.accessor(d)))
        .attr('r', d => this.sizeScale(d.population));
    
    // Exit
    circles.exit()
        .transition()
        .duration(this.state.animationSpeed * 0.3)
        .attr('r', 0)
        .remove();
    
    // Update country labels for major countries
    const labelData = yearData.filter(d => this.majorCountries.includes(d.country));
    
    const labels = this.svg.selectAll('.country-label')
        .data(labelData, d => d.country);
    
    labels.enter()
        .append('text')
        .attr('class', 'country-label')
        .attr('x', d => this.xScale(xMetric.accessor(d)) + 8)
        .attr('y', d => this.yScale(yMetric.accessor(d)) + 4)
        .attr('font-size', '11px')
        .attr('font-weight', '600')
        .attr('fill', '#333')
        .attr('opacity', 0)
        .attr('pointer-events', 'none')
        .style('text-shadow', '0 0 3px white, 0 0 3px white, 0 0 3px white')
        .text(d => d.country)
        .merge(labels)
        .transition()
        .duration(this.state.animationSpeed * 0.8)
        .attr('x', d => this.xScale(xMetric.accessor(d)) + 8)
        .attr('y', d => this.yScale(yMetric.accessor(d)) + 4)
        .attr('opacity', 0.8);
    
    labels.exit()
        .transition()
        .duration(this.state.animationSpeed * 0.3)
        .attr('opacity', 0)
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