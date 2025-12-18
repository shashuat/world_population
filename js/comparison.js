/**
 * Country/Region Comparison Visualization
 * Adapted from viz1b_population_comparison.js for dashboard integration
 */

const ComparisonViz = {
    // Configuration
    margin: {top: 20, right: 120, bottom: 60, left: 80},
    svg: null,
    width: null,
    height: null,
    currentMode: 'regions',
    selectedCountries: [],
    
    /**
     * Initialize comparison visualization
     */
    init(container, appState) {
        console.log('Initializing comparison visualization...');
        
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
        const regionalData = DataLoader.processRegionalTimeSeries();
        const countryData = DataLoader.processCountryTimeSeries();
        const countriesList = DataLoader.getCountriesList();
        const regionMeta = DataLoader.getRegionMetadata();
        
        // Store data
        this.data = {
            regions: regionalData,
            countries: countryData,
            countriesList: countriesList,
            regionMeta: regionMeta
        };
        
        // Set up controls
        this.setupControls();
        
        // Initial render
        this.updateChart();
        
        // Mark processed
        appState.data.processed.comparison = true;
        
        console.log('✓ Comparison visualization initialized');
    },
    
    /**
     * Set up mode controls and country selector
     */
    setupControls() {
        // Populate country selector
        const countrySelect = d3.select('#country-select');
        countrySelect.selectAll('option:not([value=""])').remove();
        
        this.data.countriesList.forEach(country => {
            countrySelect.append('option')
                .attr('value', country)
                .text(country);
        });
        
        // Country select handler
        const self = this;
        countrySelect.on('change', function() {
            const country = this.value;
            if (country && !self.selectedCountries.includes(country)) {
                if (self.selectedCountries.length < 10) {
                    self.selectedCountries.push(country);
                    self.updateSelectedTags();
                    self.updateChart();
                }
            }
            this.value = '';
        });
        
        // Mode buttons
        document.querySelectorAll('#comparison-view .mode-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('#comparison-view .mode-btn').forEach(b => 
                    b.classList.remove('active'));
                this.classList.add('active');
                self.currentMode = this.dataset.mode;
                
                if (self.currentMode === 'regions') {
                    document.getElementById('country-selector-group').style.display = 'none';
                } else {
                    document.getElementById('country-selector-group').style.display = 'block';
                }
                
                self.updateChart();
            });
        });
    },
    
    /**
     * Update selected country tags
     */
    updateSelectedTags() {
        const container = d3.select('#selected-countries');
        container.selectAll('.tag').remove();
        
        const colorScale = d3.scaleOrdinal(d3.schemeCategory10);
        const self = this;
        
        this.selectedCountries.forEach(country => {
            const tag = container.append('div')
                .attr('class', 'tag')
                .style('background', colorScale(country));
            
            tag.append('span').text(country);
            tag.append('span')
                .attr('class', 'tag-remove')
                .text('×')
                .on('click', function() {
                    self.selectedCountries = self.selectedCountries.filter(c => c !== country);
                    self.updateSelectedTags();
                    self.updateChart();
                });
        });
    },
    
    /**
     * Update chart based on current mode
     */
    updateChart() {
        // Clear existing
        this.svg.selectAll('*').remove();
        
        let data, colorScale;
        const regionColors = {};
        this.data.regionMeta.forEach(r => {
            regionColors[r.name] = r.color;
        });
        
        if (this.currentMode === 'regions') {
            data = this.data.regions;
            colorScale = d3.scaleOrdinal()
                .domain(data.map(d => d.region))
                .range(data.map(d => regionColors[d.region]));
        } else {
            if (this.selectedCountries.length === 0) {
                this.svg.append('text')
                    .attr('x', this.width / 2)
                    .attr('y', this.height / 2)
                    .attr('text-anchor', 'middle')
                    .style('fill', '#999')
                    .style('font-size', '16px')
                    .text('Select countries from the dropdown above to compare');
                return;
            }
            
            // Group country data
            const grouped = d3.nest()
                .key(d => d.country)
                .entries(this.data.countries.filter(d => 
                    this.selectedCountries.includes(d.country)));
            
            data = grouped.map(g => ({
                region: g.key,
                values: g.values.map(v => ({year: v.year, population: v.population}))
            }));
            
            colorScale = d3.scaleOrdinal(d3.schemeCategory10)
                .domain(this.selectedCountries);
        }
        
        // Create scales
        const xScale = d3.scaleLinear()
            .domain([1950, 2023])
            .range([0, this.width]);
        
        const yScale = d3.scaleLinear()
            .domain([0, d3.max(data, d => d3.max(d.values, v => v.population)) * 1.1])
            .range([this.height, 0])
            .nice();
        
        // Add gridlines
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
        
        // Add axes
        this.svg.append('g')
            .attr('class', 'axis')
            .attr('transform', `translate(0,${this.height})`)
            .call(d3.axisBottom(xScale)
                .tickFormat(d3.format('d'))
                .ticks(15));
        
        this.svg.append('g')
            .attr('class', 'axis')
            .call(d3.axisLeft(yScale)
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
            .x(d => xScale(d.year))
            .y(d => yScale(d.population))
            .curve(d3.curveMonotoneX);
        
        // Tooltip
        const tooltip = d3.select('#tooltip');
        
        // Draw lines
        const lines = this.svg.selectAll('.entity-line')
            .data(data)
            .enter()
            .append('g')
            .attr('class', 'entity-line');
        
        lines.append('path')
            .attr('class', 'line')
            .attr('d', d => line(d.values))
            .attr('stroke', d => colorScale(d.region))
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