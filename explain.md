# World Demographics Dashboard - Code Explanation

This document provides a detailed explanation of the codebase for the World Demographics Dashboard. The project is a comprehensive data visualization tool built with D3.js, designed to explore global demographic trends from 1950 to 2023.

## Project Structure

The project follows a modular architecture where each visualization and core functionality is encapsulated in its own JavaScript file.

- **`index.html`**: The main entry point defining the layout and loading resources.
- **`css/`**: Contains styling.
- **`data/`**: Contains preprocessed JSON and CSV data files.
- **`js/`**: Contains all the JavaScript logic, split into modules.
- **`scripts/`**: Python scripts for data preprocessing.

## HTML Structure (`index.html`)

The `index.html` file sets up the application layout, which is primarily a split-pane design:

1.  **Navigation Bar**: Top bar for switching between different visualization views (Overview, Trends, Regions, Animation, etc.).
2.  **Globe Pane (Left)**: A persistent 3D globe view that serves as a controller for selecting countries and years.
3.  **Details Pane (Right)**: A dynamic area that changes based on the selected visualization mode. It contains containers for all the different charts (Timeseries, Radar, etc.).
4.  **Modals & Overlays**: Loading screens and info modals.

It loads `d3.v7.min.js` and all the custom scripts at the end of the body.

## JavaScript Architecture

The JavaScript code is organized into a **Controller-Module** pattern.

### Core Modules

#### 1. `js/main.js` (Controller)
This is the central brain of the application.
-   **Initialization**: `initApp()` orchestrates the startup process: showing the loading screen, calling `DataLoader` to fetch data, and initializing the `GlobeViz`.
-   **State Management**: Maintains the global `AppState` object, which tracks the selected country, current year, active visualization mode, and loaded data.
-   **Event Dispatcher**: Uses `d3.dispatch` to create a custom event system (`countrySelected`, `yearChanged`, `modeChanged`). This allows different modules to communicate without being tightly coupled.
-   **Navigation**: Handles switching between views (e.g., from "Overview" to "Trends") by toggling visibility and initializing the required visualization module if it hasn't been loaded yet.

#### 2. `js/dataLoader.js` (Data Layer)
Responsible for all data fetching and caching.
-   **`loadAllData()`**: Asynchronously loads all required JSON files from the `data/` directory using `d3.json`.
-   **Caching**: Stores loaded data in a `cache` object to prevent redundant network requests.
-   **Accessors**: Provides specific methods (e.g., `processGlobeData`, `getCountryDetailData`) to format and return data as needed by different visualizations.

### Visualization Modules

Each visualization is a self-contained object (e.g., `GlobeViz`, `TimeSeriesViz`) with an `init()` method and an `update()` or `draw()` method.

#### 3. `js/globe.js` (3D Globe)
Renders the interactive 3D globe using D3's geographic projections.
-   **Rendering**: Uses `d3.geoOrthographic` for the 3D view and `d3.geoPath` to draw country shapes from GeoJSON.
-   **Interactivity**: Handles rotation, zooming, and clicking on countries.
-   **Dynamic Coloring**: Changes the color scale of countries based on the selected metric (Population, Density, Fertility, etc.) using `createColorPalette`.
-   **Synchronization**: Dispatches `countrySelected` and `yearChanged` events to update other views.

#### 4. `js/timeseries.js` (Line Charts)
Displays historical trends for regions and countries.
-   **Modes**: Supports multiple modes like Population, Density, Sex Ratio, etc.
-   **Dynamic Y-Axis**: Adjusts scales based on the active data.
-   **Interaction**: Listens to `countrySelected` events to add or remove country lines from the chart, allowing for comparison against regional averages.

#### 5. `js/comparison.js` (Comparison Tool)
Allows direct comparison of population trends.
-   **Modes**: Switches between comparing broad Regions and specific Countries.
-   **Tag System**: Manages a list of selected countries, allowing users to add/remove them via a dropdown or tags.

#### 6. `js/smallMultiples.js` (Regional Grid)
Shows a grid of small area charts for Birth vs. Death rates.
-   **Layout**: Renders a separate SVG for each world region.
-   **Demographic Transition**: Visualizes the gap between birth and death rates (natural increase).
-   **Country Overlay**: When a country is selected on the globe, it adds a new small chart for that specific country to the grid.

#### 7. `js/animation.js` (Hans Rosling Bubble Chart)
An animated scatter plot showing the relationship between Fertility Rate (X) and Life Expectancy (Y).
-   **Animation Loop**: Updates the chart year-by-year to show development over time.
-   **Bubbles**: Each bubble represents a country, sized by population and colored by region.
-   **Controls**: Includes Play, Pause, and Speed controls.

#### 8. `js/radarChart.js` (Demographic DNA)
A radar (spider) chart showing a multi-dimensional profile of a country.
-   **Dimensions**: Visualizes multiple metrics simultaneously (e.g., Literacy, Life Expectancy, GDP, etc.) on radial axes.
-   **Comparison**: Overlays the selected country's profile against its regional average.

#### 9. `js/growthDrivers.js` (Scatter Plot)
Analyzes what drives population growth.
-   **Axes**: Natural Change Rate (Births - Deaths) vs. Net Migration Rate.
-   **Quadrants**: Divides the plot into four sections to classify countries (e.g., "Growing via Immigration", "Shrinking").

#### 10. `js/genderGap.js` (Gap Analysis)
Focuses on the difference between male and female life expectancy.
-   **Visualization**: Renders a line chart of the gap over time.
-   **Color Coding**: Uses diverging colors to show female advantage (Red) vs. male advantage (Blue).

#### 11. `js/statistics.js` (Statistical Analysis)
Provides statistical insights.
-   **Correlation**: Scatter plot to explore relationships between any two variables (e.g., Median Age vs. Birth Rate) with a regression line and R² value.
-   **Distribution**: Box plots to show the spread of values across different regions.
-   **Outlier Detection**: Implements IQR method to filter out extreme values for cleaner plots.

## Data Flow

1.  **Load**: `main.js` calls `DataLoader.loadAllData()`.
2.  **Cache**: `DataLoader` fetches JSONs and stores them.
3.  **Init**: `main.js` initializes `GlobeViz` with the data.
4.  **User Action**: User clicks a country on the Globe.
5.  **Dispatch**: `GlobeViz` dispatches `countrySelected`.
6.  **React**:
    *   `TimeSeriesViz` adds the country line.
    *   `RadarChartViz` updates to show the country's profile.
    *   `SmallMultiplesViz` adds a chart for the country.
    *   `GenderGapViz` updates its chart.

This architecture ensures that all views stay synchronized while keeping the code manageable and modular.
