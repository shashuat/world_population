# Time Series Visualization Upgrade - Graduate Level Demographics

## Changes Implemented

### 1. New Visualization Modes (9 Total)
The time series visualization now supports 9 sophisticated demographic modes instead of just 4 basic metrics:

#### Original 4 Modes (from Globe):
1. **Population** - Population size trends
2. **Density** - Population density (per km²)
3. **Sex Ratio** - Males per 100 females
4. **Median Age** - Demographic aging patterns

#### NEW 5 Graduate-Level Modes:
5. **Demographic Transition** - Birth Rate + Death Rate on same chart
   - Shows crossover points and transition stages
   - Green line for births, red line for deaths

6. **Growth Drivers** - Natural Change + Migration Rate
   - Distinguishes between natural growth vs migration-driven growth
   - Green for natural change, purple for migration

7. **Longevity & Gender Gap** - Male vs Female Life Expectancy
   - Shows gender differences in survival
   - Blue for male, red for female

8. **Fertility & Reproductive Health** - Fertility Rate + Mean Age at Childbearing
   - Orange for fertility rate, purple for mean age
   - Shows reproductive patterns over time

9. **Healthcare Quality** - Infant Mortality + Under-5 Mortality
   - Red for infant mortality, orange for under-5
   - **Supports logarithmic scale** for better visualization of improvements

### 2. Mode Selector Dropdown
- Replaced the 4 globe mode buttons with a clean dropdown selector
- Located in the time series view with label "Visualization Mode:"
- Automatically updates title and description when mode changes
- Works alongside globe mode buttons (syncs with population/density/sex-ratio/median-age)

### 3. Logarithmic Scale Toggle
- Added "📈 Log Scale" button for Healthcare Quality mode
- Toggles between linear and logarithmic y-axis
- Only appears when viewing mortality-related metrics
- Helps visualize dramatic improvements in infant/child mortality

### 4. Bug Fixes

#### Fixed: Dynamic Y-Axis
- Y-axis now **recalculates based on currently visible data only**
- Previously used all data regardless of what was displayed
- Now filters by:
  - Only selected regions (from `selectedRegions` Set)
  - Only selected countries (from `selectedCountries` Set)
  - Only metrics in current mode
- Dynamically adjusts when toggling regions/countries

#### Fixed: Region Toggle Bug
- Fixed bug where adding a region back would make other regions disappear
- Previously: `toggleRegion()` cleared the entire Set before adding
- Now: Properly uses `Set.add()` and `Set.delete()` without clearing

### 5. Data Layer Updates

Updated `prepare_dataviz.py` to extract 11 new demographic metrics:
- `birthRate` - Crude birth rate (per 1,000)
- `deathRate` - Crude death rate (per 1,000)
- `naturalChange` - Rate of natural change (per 1,000)
- `migrationRate` - Net migration rate (per 1,000)
- `fertilityRate` - Total fertility rate (births per woman)
- `meanAgeChildbearing` - Mean age at childbearing (years)
- `infantMortality` - Infant mortality rate (per 1,000 births)
- `underFiveMortality` - Under-5 mortality rate (per 1,000 births)
- `lifeExpectancyMale` - Male life expectancy (years)
- `lifeExpectancyFemale` - Female life expectancy (years)
- `lifeExpectancyBoth` - Overall life expectancy (years)

Both regional and country timeseries data now include these metrics.

### 6. Multi-Metric Line Charts
- Modes can now display **multiple metrics simultaneously**
- Each metric gets its own color-coded line
- Example: Demographic Transition shows birth rate (green) AND death rate (red) together
- Tooltips show values for specific metric when hovering
- Legend labels only added for the last metric to avoid clutter

### 7. Enhanced UI Elements

#### Updated Instruction Banner:
"👈 Click on any country on the globe to add/remove its trend line. Use the dropdown below to switch between visualization modes."

#### Dynamic Titles:
- Title updates based on selected mode (e.g., "Demographic Transition (1950-2023)")
- Description explains what the visualization shows
- Y-axis label shows all metrics in mode (e.g., "Birth Rate / Death Rate")

## File Changes

### Modified Files:
1. `/js/timeseries.js` - Completely rewritten with new architecture
   - 9 visualization modes in `visualizationModes` config object
   - `changeMode()` method to switch between modes
   - `toggleLogScale()` method for logarithmic y-axis
   - Fixed `draw()` to calculate dynamic y-axis from visible data only
   - Fixed `toggleRegion()` to preserve other regions
   - Multi-metric support in `drawRegionalLines()` and `addCountryLine()`

2. `/index.html` - Added dropdown selector and log scale button
   - `<select id="timeseries-mode-selector">` dropdown
   - `<button id="log-scale-toggle">` for logarithmic scale
   - Updated instruction text

3. `/scripts/prepare_dataviz.py` - Added 11 new demographic metrics
   - Updated `prepare_regional_timeseries()`
   - Updated `prepare_country_timeseries()`

### Backup Created:
- `/js/timeseries_old_backup.js` - Original version saved

## How to Use

### Switching Visualization Modes:
1. Open the "Trends" tab (Time Series view)
2. Use the **Visualization Mode** dropdown to select from 9 modes
3. Click countries on the globe to add their trend lines
4. Use region legend to toggle regions on/off

### Using Logarithmic Scale:
1. Select "Healthcare Quality Indicators" mode
2. Click the "📈 Log Scale" button that appears
3. Y-axis switches to logarithmic scale (better for viewing mortality improvements)
4. Click again to return to linear scale ("📊 Linear Scale")

### Globe Integration:
- Globe mode buttons (Population, Density, Sex Ratio, Median Age) still work
- They automatically sync with the dropdown selector
- Clicking a mode button updates the time series chart

### Adding Countries:
- Click any country on the globe while in Trends tab
- Country line appears as dashed line with unique color
- Click again to remove
- First country added automatically hides all regions
- Remove all countries to see regions again

### Re-adding Regions:
- When all countries are removed, see "+ Region Name" buttons
- Click to add that region back
- Use × button on region tags to remove

## Next Steps (Optional Enhancements)

1. **Run Data Script**: Execute `python3 scripts/prepare_dataviz.py` to regenerate JSON files with new metrics
2. **Test All Modes**: Click through all 9 visualization modes to ensure data loads correctly
3. **Logarithmic Scale Refinement**: Test with real infant mortality data to ensure log scale works properly
4. **Additional Modes**: Could add more combinations like:
   - Dependency Ratios (child + elderly dependency)
   - Urbanization Trends
   - Migration Flows by Age Group

## Technical Notes

### Metric Configuration Structure:
```javascript
{
    title: 'Mode Title (1950-2023)',
    description: 'What this mode shows',
    metrics: [
        {
            key: 'csvColumnName',
            label: 'Display Label',
            color: '#hexcolor',
            format: d => formatFunction(d),
            tooltip: d => tooltipFormat(d)
        }
    ],
    supportsLogScale: true  // optional
}
```

### Y-Axis Dynamic Calculation:
```javascript
// Filters to only visible data
modeConfig.metrics.forEach(metric => {
    activeRegionalData.forEach(region => {
        // Only selected regions
    });
    selectedCountries.forEach(country => {
        // Only selected countries
    });
});
```

### Set-Based Toggle System:
```javascript
selectedRegions = new Set(['Africa', 'Asia', 'Europe', ...])
selectedCountries = new Set(['China', 'India', ...])

toggleRegion(name) {
    if (this.selectedRegions.has(name)) {
        this.selectedRegions.delete(name);  // Remove
    } else {
        this.selectedRegions.add(name);     // Add back
    }
}
```

## Testing Checklist

- [ ] All 9 modes load without errors
- [ ] Dropdown selector populates correctly
- [ ] Mode switching updates title/description
- [ ] Y-axis recalculates when toggling regions/countries
- [ ] Region toggle no longer clears other regions
- [ ] Log scale button appears only for Healthcare Quality mode
- [ ] Log scale toggles correctly
- [ ] Multi-metric modes show all lines with correct colors
- [ ] Country lines appear as dashed with unique colors
- [ ] Tooltips show correct values for each metric
- [ ] Legend updates when adding/removing countries and regions
- [ ] Globe mode buttons still sync with dropdown

## Known Limitations

1. **Data Required**: Must run `prepare_dataviz.py` to generate JSON with new metrics
2. **CSV Columns**: Assumes exact column names in world-demographic.csv match the metric keys
3. **Log Scale**: Only enabled for Healthcare Quality mode (could be expanded to other mortality/rate metrics)
4. **Performance**: With many countries selected, rendering may slow down slightly

---

**Status**: ✅ Code complete, pending data regeneration and testing
