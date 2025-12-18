/**
 * Radar Chart - Country DNA Profile
 * Multi-dimensional demographic fingerprint
 */

const RadarChartViz = {
    // Configuration
    margin: {top: 80, right: 80, bottom: 80, left: 80},
    svg: null,
    width: null,
    height: null,
    radius: null,
    selectedCountry: null,
    
    /**
     * Initialize radar chart visualization
     */
    init(container, appState) {
        console.log('Initializing radar chart visualization...');
        
        // Calculate dimensions
        const containerNode = container.node();
        const rect = containerNode.getBoundingClientRect();
        const totalWidth = rect.width;
        const totalHeight = rect.height > 0 ? rect.height : 500; // Use container height or fallback
        
        this.width = totalWidth - this.margin.left - this.margin.right;
        this.height = totalHeight - this.margin.top - this.margin.bottom;
        this.radius = Math.min(this.width, this.height) / 2;
        
        // Clear existing
        container.selectAll('*').remove();
        
        // Create SVG
        this.svg = container
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${totalWidth} ${totalHeight}`)
            .attr('preserveAspectRatio', 'xMidYMid meet')
            .append('g')
            .attr('transform', `translate(${this.width/2 + this.margin.left},${this.height/2 + this.margin.top})`);
        
        // Get data
        const radarData = DataLoader.getRadarChartData();
        this.data = radarData;
        
        if (!radarData || !radarData.countries) {
            console.error('No radar chart data available');
            return;
        }
        
        // Set up country selector
        this.setupControls();
        
        // Draw static elements
        this.drawAxes();
        
        // Show instructions initially
        this.showInstructions();
        
        // Listen for country selections from globe
        dispatcher.on('countrySelected.radar', (countryCode, countryName) => {
            console.log('Radar chart: Country selected from globe:', countryName);
            if (this.data && this.data.countries[countryName]) {
                this.updateChart(countryName);
                // Hide instructions after first selection
                const instructions = document.getElementById('radar-instructions');
                if (instructions) {
                    instructions.style.display = 'none';
                }
            }
        });
        
        // Mark processed
        appState.data.processed.radar = true;
        
        console.log('✓ Radar chart visualization initialized');
    },
    
    /**
     * Set up country selector
     */
    setupControls() {
        const countrySelect = d3.select('#radar-country-select');
        countrySelect.selectAll('option:not([value=""])').remove();
        
        const countries = Object.keys(this.data.countries).sort();
        
        countries.forEach(country => {
            countrySelect.append('option')
                .attr('value', country)
                .text(country);
        });
        
        const self = this;
        countrySelect.on('change', function() {
            const country = this.value;
            if (country) {
                self.updateChart(country);
            }
        });
    },
    
    /**
     * Draw axes and gridlines
     */
    drawAxes() {
        const indicators = Object.keys(this.data.indicators);
        const numAxes = indicators.length;
        const angleSlice = (Math.PI * 2) / numAxes;
        
        // Draw concentric circles
        const levels = 5;
        for (let i = 1; i <= levels; i++) {
            const r = (this.radius / levels) * i;
            
            this.svg.append('circle')
                .attr('cx', 0)
                .attr('cy', 0)
                .attr('r', r)
                .attr('fill', 'none')
                .attr('stroke', '#e2e8f0')
                .attr('stroke-width', 1);
            
            // Add scale labels
            if (i < levels) {
                this.svg.append('text')
                    .attr('x', 5)
                    .attr('y', -r)
                    .attr('fill', '#999')
                    .attr('font-size', '10px')
                    .text((i / levels).toFixed(1));
            }
        }
        
        // Draw axes
        indicators.forEach((indicator, i) => {
            const angle = angleSlice * i - Math.PI / 2;
            const x = Math.cos(angle) * this.radius;
            const y = Math.sin(angle) * this.radius;
            
            // Axis line
            this.svg.append('line')
                .attr('x1', 0)
                .attr('y1', 0)
                .attr('x2', x)
                .attr('y2', y)
                .attr('stroke', '#cbd5e0')
                .attr('stroke-width', 1);
            
            // Label
            const labelX = Math.cos(angle) * (this.radius + 30);
            const labelY = Math.sin(angle) * (this.radius + 30);
            
            this.svg.append('text')
                .attr('x', labelX)
                .attr('y', labelY)
                .attr('text-anchor', 'middle')
                .attr('dominant-baseline', 'middle')
                .attr('fill', '#4a5568')
                .attr('font-size', '12px')
                .attr('font-weight', '600')
                .text(this.data.indicators[indicator]);
        });
    },
    
    /**
     * Update chart for selected country
     */
    updateChart(countryName) {
        this.selectedCountry = countryName;
        
        // Clear instruction text if present
        this.svg.selectAll('.radar-instruction-text').remove();
        
        const countryData = this.data.countries[countryName];
        if (!countryData) return;
        
        const indicators = Object.keys(this.data.indicators);
        const numAxes = indicators.length;
        const angleSlice = (Math.PI * 2) / numAxes;
        
        // Create path data for country
        const countryPath = indicators.map((indicator, i) => {
            const angle = angleSlice * i - Math.PI / 2;
            const value = countryData.values[indicator].normalized;
            const x = Math.cos(angle) * (this.radius * value);
            const y = Math.sin(angle) * (this.radius * value);
            return [x, y];
        });
        
        // Create path data for regional average
        const regionName = countryData.region;
        const regionalAvg = this.data.regionalAverages[regionName];
        
        let regionalPath = null;
        if (regionalAvg) {
            regionalPath = indicators.map((indicator, i) => {
                const angle = angleSlice * i - Math.PI / 2;
                const value = regionalAvg[indicator] ? regionalAvg[indicator].normalized : 0;
                const x = Math.cos(angle) * (this.radius * value);
                const y = Math.sin(angle) * (this.radius * value);
                return [x, y];
            });
        }
        
        // Line generator
        const lineGenerator = d3.lineRadial()
            .radius(d => d[0])
            .angle((d, i) => angleSlice * i)
            .curve(d3.curveLinearClosed);
        
        // Remove previous paths
        this.svg.selectAll('.radar-path').remove();
        this.svg.selectAll('.radar-dot').remove();
        
        // Draw regional average first (background)
        if (regionalPath) {
            const regionalPathData = regionalPath.map(([x, y], i) => {
                const angle = angleSlice * i;
                const r = Math.sqrt(x * x + y * y);
                return [r, angle];
            });
            
            this.svg.append('path')
                .datum(regionalPathData)
                .attr('class', 'radar-path regional')
                .attr('d', lineGenerator)
                .attr('fill', '#667eea')
                .attr('fill-opacity', 0.15)
                .attr('stroke', '#667eea')
                .attr('stroke-width', 1.5)
                .attr('stroke-dasharray', '5,5');
        }
        
        // Draw country path
        const countryPathData = countryPath.map(([x, y], i) => {
            const angle = angleSlice * i;
            const r = Math.sqrt(x * x + y * y);
            return [r, angle];
        });
        
        this.svg.append('path')
            .datum(countryPathData)
            .attr('class', 'radar-path country')
            .attr('d', lineGenerator)
            .attr('fill', '#e41a1c')
            .attr('fill-opacity', 0.3)
            .attr('stroke', '#e41a1c')
            .attr('stroke-width', 3);
        
        // Add dots on country path
        const tooltip = d3.select('#tooltip');
        const self = this;
        
        countryPath.forEach(([x, y], i) => {
            const indicator = indicators[i];
            const data = countryData.values[indicator];
            
            this.svg.append('circle')
                .attr('class', 'radar-dot')
                .attr('cx', x)
                .attr('cy', y)
                .attr('r', 5)
                .attr('fill', '#e41a1c')
                .attr('stroke', 'white')
                .attr('stroke-width', 2)
                .on('mouseover', function() {
                    d3.select(this)
                        .transition()
                        .duration(100)
                        .attr('r', 7);
                    
                    tooltip
                        .style('display', 'block')
                        .style('left', d3.event.pageX + 10 + 'px')
                        .style('top', d3.event.pageY - 10 + 'px')
                        .html(`
                            <div style="font-weight: 600; margin-bottom: 4px;">${countryName}</div>
                            <div>${self.data.indicators[indicator]}</div>
                            <div>Raw: ${data.raw.toFixed(2)}</div>
                            <div>Normalized: ${data.normalized.toFixed(2)}</div>
                        `);
                })
                .on('mouseout', function() {
                    d3.select(this)
                        .transition()
                        .duration(200)
                        .attr('r', 5);
                    
                    tooltip.style('display', 'none');
                });
        });
        
        // Update legend
        this.updateLegend(countryName, regionName);
    },
    
    /**
     * Update legend
     */
    updateLegend(countryName, regionName) {
        const legend = d3.select('#radar-legend');
        legend.selectAll('*').remove();
        
        // Country
        const countryItem = legend.append('div')
            .attr('class', 'legend-item')
            .style('display', 'inline-flex')
            .style('align-items', 'center')
            .style('gap', '8px')
            .style('margin-right', '20px');
        
        countryItem.append('div')
            .style('width', '20px')
            .style('height', '3px')
            .style('background-color', '#e41a1c');
        
        countryItem.append('span')
            .style('font-size', '13px')
            .style('font-weight', '600')
            .text(countryName);
        
        // Regional average
        const regionalItem = legend.append('div')
            .attr('class', 'legend-item')
            .style('display', 'inline-flex')
            .style('align-items', 'center')
            .style('gap', '8px');
        
        regionalItem.append('div')
            .style('width', '20px')
            .style('height', '3px')
            .style('background-color', '#667eea')
            .style('border', '1px dashed #667eea');
        
        regionalItem.append('span')
            .style('font-size', '13px')
            .text(`${regionName} Average`);
    },
    
    /**
     * Show instructions message
     */
    showInstructions() {
        // Clear any existing chart elements
        this.svg.selectAll('.radar-path').remove();
        this.svg.selectAll('.radar-dot').remove();
        
        // Show instruction text in the center
        this.svg.append('text')
            .attr('class', 'radar-instruction-text')
            .attr('x', 0)
            .attr('y', -20)
            .attr('text-anchor', 'middle')
            .attr('font-size', '18px')
            .attr('font-weight', '600')
            .attr('fill', '#666')
            .text('Click a country on the globe');
        
        this.svg.append('text')
            .attr('class', 'radar-instruction-text')
            .attr('x', 0)
            .attr('y', 10)
            .attr('text-anchor', 'middle')
            .attr('font-size', '14px')
            .attr('fill', '#999')
            .text('to see its demographic DNA profile');
    },
    
    /**
     * Highlight country (called from coordinated views)
     */
    highlightCountry(countryName) {
        if (this.data && this.data.countries[countryName]) {
            this.updateChart(countryName);
            document.getElementById('radar-country-select').value = countryName;
            // Hide instructions
            const instructions = document.getElementById('radar-instructions');
            if (instructions) {
                instructions.style.display = 'none';
            }
        }
    }
};