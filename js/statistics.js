/**
 * Statistics Visualization Module
 * Handles Correlations (Scatter Plot) and Distributions (Box Plots)
 */

const StatisticsViz = {
    svgCorr: null,
    svgDist: null,
    AppState: null,
    regionMap: null,
    metrics: [
        { key: 'population', label: 'Total Population' },
        { key: 'density', label: 'Population Density' },
        { key: 'medianAge', label: 'Median Age' },
        { key: 'birthRate', label: 'Birth Rate' },
        { key: 'deathRate', label: 'Death Rate' },
        { key: 'fertilityRate', label: 'Fertility Rate' },
        { key: 'lifeExpectancyBoth', label: 'Life Expectancy' },
        { key: 'infantMortality', label: 'Infant Mortality' },
        { key: 'migrationRate', label: 'Net Migration' }
    ],

    init(state) {
        this.AppState = state;
        this.svgCorr = d3.select('#correlation-plot');
        this.svgDist = d3.select('#distribution-plot');
        
        this.setupSelectors();
        this.update();
        this.AppState.data.processed.statistics = true;
    },

    setupSelectors() {
        const xSelect = d3.select('#stats-x-select');
        const ySelect = d3.select('#stats-y-select');

        this.metrics.forEach(m => {
            xSelect.append('option').attr('value', m.key).text(m.label);
            ySelect.append('option').attr('value', m.key).text(m.label);
        });

        // Set defaults
        xSelect.property('value', 'medianAge');
        ySelect.property('value', 'birthRate');

        xSelect.on('change', () => this.update());
        ySelect.on('change', () => this.update());
    },

    update() {
        const year = this.AppState.currentYear;
        const xKey = d3.select('#stats-x-select').property('value');
        const yKey = d3.select('#stats-y-select').property('value');
        
        // Get data for the current year across all countries
        const allData = DataLoader.getCountryTimeSeriesData();
        const regionMap = this.getRegionMap();
        const yearData = [];

        Object.keys(allData).forEach(country => {
            const entry = allData[country].find(d => d.year === year);
            if (entry && entry[xKey] != null && entry[yKey] != null) {
                yearData.push({
                    name: country,
                    region: regionMap[country] || 'Other',
                    x: entry[xKey],
                    y: entry[yKey],
                    pop: entry.population
                });
            }
        });

        // Remove outliers for better readability
        const filteredData = this.removeOutliers(yearData, xKey, yKey);
        
        this.drawCorrelation(filteredData, xKey, yKey, yearData.length);
        this.drawDistribution(filteredData, yKey, yearData.length);
    },

    getRegionMap() {
        if (this.regionMap) return this.regionMap;
        
        const animationData = DataLoader.processAnimationData();
        this.regionMap = {};
        
        if (animationData && animationData.length > 0) {
            animationData.forEach(d => {
                if (d.country && d.region) {
                    this.regionMap[d.country] = d.region;
                }
            });
        }
        
        return this.regionMap;
    },

    /**
     * Remove outliers using IQR method
     * Removes extreme values that are beyond 1.5 * IQR from Q1/Q3
     */
    removeOutliers(data, xKey, yKey) {
        const xValues = data.map(d => d.x).sort(d3.ascending);
        const yValues = data.map(d => d.y).sort(d3.ascending);
        
        // Calculate IQR for X
        const xQ1 = d3.quantile(xValues, 0.25);
        const xQ3 = d3.quantile(xValues, 0.75);
        const xIQR = xQ3 - xQ1;
        const xLower = xQ1 - 1.5 * xIQR;
        const xUpper = xQ3 + 1.5 * xIQR;
        
        // Calculate IQR for Y
        const yQ1 = d3.quantile(yValues, 0.25);
        const yQ3 = d3.quantile(yValues, 0.75);
        const yIQR = yQ3 - yQ1;
        const yLower = yQ1 - 1.5 * yIQR;
        const yUpper = yQ3 + 1.5 * yIQR;
        
        // Filter out outliers
        return data.filter(d => 
            d.x >= xLower && d.x <= xUpper && 
            d.y >= yLower && d.y <= yUpper
        );
    },

    drawCorrelation(data, xKey, yKey, originalCount) {
        const svg = this.svgCorr;
        svg.selectAll("*").remove();
        
        const margin = {top: 20, right: 30, bottom: 50, left: 60};
        const width = svg.node().parentElement.clientWidth - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;

        svg.attr("width", width + margin.left + margin.right)
           .attr("height", height + margin.top + margin.bottom);

        const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        const x = d3.scaleLinear().domain(d3.extent(data, d => d.x)).nice().range([0, width]);
        const y = d3.scaleLinear().domain(d3.extent(data, d => d.y)).nice().range([height, 0]);
        const r = d3.scaleSqrt().domain(d3.extent(data, d => d.pop)).range([3, 20]);
        
        const regions = [...new Set(data.map(d => d.region))];
        const color = d3.scaleOrdinal(d3.schemeCategory10).domain(regions);

        // Axes
        g.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x))
            .selectAll("text")
            .style("font-size", "12px");
        
        // X-axis label
        g.append("text")
            .attr("x", width / 2)
            .attr("y", height + 40)
            .attr("text-anchor", "middle")
            .style("font-size", "13px")
            .style("font-weight", "500")
            .text(this.getMetricLabel(xKey));
            
        g.append("g")
            .call(d3.axisLeft(y))
            .selectAll("text")
            .style("font-size", "12px");
        
        // Y-axis label
        g.append("text")
            .attr("transform", "rotate(-90)")
            .attr("x", -height / 2)
            .attr("y", -45)
            .attr("text-anchor", "middle")
            .style("font-size", "13px")
            .style("font-weight", "500")
            .text(this.getMetricLabel(yKey));

        // Dots
        g.selectAll("circle")
            .data(data)
            .enter().append("circle")
            .attr("cx", d => x(d.x))
            .attr("cy", d => y(d.y))
            .attr("r", d => r(d.pop))
            .attr("fill", d => color(d.region))
            .attr("fill-opacity", 0.6)
            .attr("stroke", "#fff")
            .style("cursor", "pointer")
            .on("mouseover", (event, d) => {
                // Use global tooltip from your project
                const tooltip = d3.select("#tooltip");
                tooltip.style("opacity", 1)
                       .html(`<strong>${d.name}</strong><br>${this.getMetricLabel(xKey)}: ${d.x.toFixed(2)}<br>${this.getMetricLabel(yKey)}: ${d.y.toFixed(2)}`)
                       .style("left", (event.pageX + 10) + "px")
                       .style("top", (event.pageY - 20) + "px");
            })
            .on("mouseout", () => d3.select("#tooltip").style("opacity", 0));

        // Statistical Trend Line (Simple Linear Regression)
        if (data.length > 1) {
            const xMean = d3.mean(data, d => d.x);
            const yMean = d3.mean(data, d => d.y);
            const ssXX = d3.sum(data, d => Math.pow(d.x - xMean, 2));
            const ssXY = d3.sum(data, d => (d.x - xMean) * (d.y - yMean));
            const slope = ssXY / ssXX;
            const intercept = yMean - slope * xMean;

            // Calculate R-squared
            const ssYY = d3.sum(data, d => Math.pow(d.y - yMean, 2));
            const rSquared = (ssXY * ssXY) / (ssXX * ssYY);

            const line = d3.line()
                .x(d => x(d.x))
                .y(d => y(slope * d.x + intercept));

            const xRange = d3.extent(data, d => d.x);
            g.append("path")
                .datum([{x: xRange[0]}, {x: xRange[1]}])
                .attr("class", "trend-line")
                .attr("d", line)
                .attr("stroke", "#333")
                .attr("stroke-dasharray", "4,4")
                .attr("stroke-width", 1.5)
                .attr("fill", "none");

            // Display correlation info
            const corrInfo = d3.select("#correlation-info");
            const outliersRemoved = originalCount - data.length;
            corrInfo.html(`
                <strong>Statistical Analysis (${this.AppState.currentYear}):</strong><br>
                Sample Size: ${data.length} countries ${outliersRemoved > 0 ? `(${outliersRemoved} outliers removed)` : ''} | 
                R² = ${rSquared.toFixed(3)} | 
                Slope: ${slope.toFixed(3)} | 
                ${rSquared > 0.5 ? '<span style="color:#2e7d32">Strong correlation</span>' : 
                  rSquared > 0.25 ? '<span style="color:#f57c00">Moderate correlation</span>' : 
                  '<span style="color:#d32f2f">Weak correlation</span>'}
            `);
        }
    },

    drawDistribution(data, yKey, originalCount) {
        const svg = this.svgDist;
        svg.selectAll("*").remove();

        const container = svg.node().parentElement;
        const margin = {top: 20, right: 20, bottom: 80, left: 40};
        
        // Robust width calculation with fallback
        let containerWidth = container.clientWidth;
        if (containerWidth === 0) {
            containerWidth = container.getBoundingClientRect().width;
        }
        if (containerWidth === 0) {
            containerWidth = 800; // Fallback
        }

        const width = containerWidth - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;

        svg.attr("width", width + margin.left + margin.right)
           .attr("height", height + margin.top + margin.bottom);

        const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        // Group data by region (D3 v5 compatible using d3.nest)
        const nested = d3.nest()
            .key(d => d.region)
            .entries(data)
            .map(d => ({
                region: d.key,
                values: d.values.map(v => v.y).sort(d3.ascending)
            }));

        const x = d3.scaleBand().domain(nested.map(d => d.region)).range([0, width]).padding(0.4);
        const y = d3.scaleLinear().domain(d3.extent(data, d => d.y)).nice().range([height, 0]);

        // X Axis
        g.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x))
            .selectAll("text")
            .style("text-anchor", "end")
            .style("font-size", "11px")
            .attr("dx", "-.8em")
            .attr("dy", ".15em")
            .attr("transform", "rotate(-45)");
        
        // X-axis label
        g.append("text")
            .attr("x", width / 2)
            .attr("y", height + 70)
            .attr("text-anchor", "middle")
            .style("font-size", "13px")
            .style("font-weight", "500")
            .text("Region");
            
        // Y Axis
        g.append("g")
            .call(d3.axisLeft(y))
            .selectAll("text")
            .style("font-size", "12px");
        
        // Y-axis label
        g.append("text")
            .attr("transform", "rotate(-90)")
            .attr("x", -height / 2)
            .attr("y", -30)
            .attr("text-anchor", "middle")
            .style("font-size", "13px")
            .style("font-weight", "500")
            .text(this.getMetricLabel(yKey));

        // Draw Box Plots
        const boxGroups = g.selectAll(".box")
            .data(nested)
            .enter().append("g")
            .attr("class", "box")
            .attr("transform", d => `translate(${x(d.region)},0)`);

        boxGroups.each(function(d) {
            if (d.values.length === 0) return;
            
            const q1 = d3.quantile(d.values, 0.25);
            const median = d3.quantile(d.values, 0.5);
            const q3 = d3.quantile(d.values, 0.75);
            const min = d.values[0];
            const max = d.values[d.values.length - 1];

            const boxWidth = x.bandwidth();

            // Vertical line (Whiskers)
            d3.select(this).append("line")
                .attr("x1", boxWidth/2)
                .attr("x2", boxWidth/2)
                .attr("y1", y(min))
                .attr("y2", y(max))
                .attr("stroke", "#333")
                .attr("stroke-width", 1);
            
            // Box
            d3.select(this).append("rect")
                .attr("x", 0)
                .attr("y", y(q3))
                .attr("width", boxWidth)
                .attr("height", y(q1) - y(q3))
                .attr("fill", "#69b3a2")
                .attr("fill-opacity", 0.7)
                .attr("stroke", "#333")
                .attr("stroke-width", 1.5);
            
            // Median line
            d3.select(this).append("line")
                .attr("x1", 0)
                .attr("x2", boxWidth)
                .attr("y1", y(median))
                .attr("y2", y(median))
                .attr("stroke", "#000")
                .attr("stroke-width", 2);
            
            // Min/Max caps
            d3.select(this).append("line")
                .attr("x1", boxWidth/4)
                .attr("x2", 3*boxWidth/4)
                .attr("y1", y(min))
                .attr("y2", y(min))
                .attr("stroke", "#333")
                .attr("stroke-width", 1);
                
            d3.select(this).append("line")
                .attr("x1", boxWidth/4)
                .attr("x2", 3*boxWidth/4)
                .attr("y1", y(max))
                .attr("y2", y(max))
                .attr("stroke", "#333")
                .attr("stroke-width", 1);
        });
    },

    getMetricLabel(key) {
        const metric = this.metrics.find(m => m.key === key);
        return metric ? metric.label : key;
    }
};
