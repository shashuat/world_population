# World Demographics Explorer

An interactive visualization dashboard exploring global demographic trends from the UN World Population Prospects 2024 dataset (237 countries, 1950-2023).

## Running the Project

The project requires a live server to run due to CORS restrictions when loading JSON data files.

### Option 1: Using Python
```bash
python -m http.server 8000
```
Then open `http://localhost:8000` in your browser.

### Option 2: Using Node.js
```bash
npx http-server
```

### Option 3: Using VS Code
Install the "Live Server" extension and click "Go Live" in the status bar.

## Project Structure

```
├── index.html              # Main HTML file
├── README.md               # Project documentation
├── css/
│   └── styles.css          # Stylesheet
├── js/                     # JavaScript modules
│   ├── main.js
│   ├── globe.js
│   ├── animation.js
│   ├── timeseries.js
│   ├── statistics.js
│   ├── comparison.js
│   ├── genderGap.js
│   ├── growthDrivers.js
│   ├── radarChart.js
│   ├── smallMultiples.js
│   ├── dataLoader.js
│   └── d3.v7.min.js
├── data/                   # Preprocessed JSON data files
├── img/
│   └── flags/              # Country flag images
├── report/                 # Report
└── scripts/
    └── prepare_dataviz.py  # Data preprocessing script
```

## Features

- 3D interactive globe with 10 choropleth modes
- Coordinated multiple views with brushing and linking
- Animated scatter plots (Gapminder-style)
- Time series analysis across 9 visualization modes
- Statistical correlation and distribution analysis
- Small multiples for regional comparison

## Live Demo

🌐 **[https://world-population.vercel.app/](https://world-population.vercel.app/)**

## Data

All data files are preprocessed and included as JSON in the `data/` directory. No additional data preparation is needed.
