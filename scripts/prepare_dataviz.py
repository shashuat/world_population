"""
Data Preprocessing Script for D3.js Visualizations - ENHANCED
Prepares JSON data files from world-demographic.csv for the dashboard
Includes advanced visualizations: Radar Charts, Ridgeline Plots, Growth Drivers, Gender Gaps
"""

import pandas as pd
import json
import numpy as np

def load_and_clean_data():
    """Load and clean the demographic data"""
    print("Loading data...")
    df = pd.read_csv('data/world-demographic.csv', low_memory=False)
    
    # Convert numeric columns - handle space-separated thousands
    numeric_cols = [
        'Year',
        'Total Population, as of 1 July (thousands)',
        'Total Fertility Rate (live births per woman)',
        'Life Expectancy at Birth, both sexes (years)',
        'Male Life Expectancy at Birth (years)',
        'Female Life Expectancy at Birth (years)',
        'Crude Birth Rate (births per 1,000 population)',
        'Crude Death Rate (deaths per 1,000 population)',
        'Infant Mortality Rate (infant deaths per 1,000 live births)',
        'Median Age, as of 1 July (years)',
        'Population Growth Rate (percentage)',
        'Population Density, as of 1 July (persons per square km)',
        'Population Sex Ratio, as of 1 July (males per 100 females)',
        'Net Migration Rate (per 1,000 population)',
        'Rate of Natural Change (per 1,000 population)'
    ]
    
    for col in numeric_cols:
        if col in df.columns:
            # Remove spaces (used as thousands separators) before converting
            if df[col].dtype == 'object':
                df[col] = df[col].astype(str).str.strip().str.replace(' ', '', regex=False)
            df[col] = pd.to_numeric(df[col], errors='coerce')
    
    print(f"✓ Loaded {len(df):,} records")
    return df


def format_population(num):
    """Format population for display"""
    if pd.isna(num) or num == 0:
        return "N/A"
    if num >= 1000000000:
        return f"{num / 1000000000:.2f} billion"
    elif num >= 1000000:
        return f"{num / 1000000:.2f} million"
    elif num >= 1000:
        return f"{num / 1000:.2f} thousand"
    return str(int(num))


def prepare_radar_chart_data(df):
    """
    Prepare data for Radar Chart (Country DNA Profile)
    For each country in latest year, normalize 5-6 key indicators
    Also include regional and world averages
    """
    print("\nPreparing radar chart data (Country DNA Profile)...")
    
    # Get latest year data for countries
    latest_year = df['Year'].max()
    countries_df = df[(df['Type'] == 'Country/Area') & (df['Year'] == latest_year)].copy()
    
    # Key indicators for radar chart
    indicators = {
        'fertility': 'Total Fertility Rate (live births per woman)',
        'migration': 'Net Migration Rate (per 1,000 population)',
        'lifeExpectancy': 'Life Expectancy at Birth, both sexes (years)',
        'medianAge': 'Median Age, as of 1 July (years)',
        'infantMortality': 'Infant Mortality Rate (infant deaths per 1,000 live births)'
    }
    
    # Calculate global statistics for normalization
    global_stats = {}
    for key, col in indicators.items():
        values = countries_df[col].dropna()
        global_stats[key] = {
            'min': float(values.min()),
            'max': float(values.max()),
            'mean': float(values.mean()),
            'median': float(values.median())
        }
    
    # Build country-to-region mapping
    region_map = {}
    subregion_to_region = {}
    
    # First, build subregion to region map
    for _, row in df[df['Type'] == 'Subregion'].iterrows():
        parent_code = row.get('Parent code')
        if pd.notna(parent_code):
            parent = df[df['Location code'] == parent_code]
            if not parent.empty:
                subregion_to_region[row['Region, subregion, country or area *']] = parent.iloc[0]['Region, subregion, country or area *']
    
    # Map countries to regions
    for _, row in df[df['Type'] == 'Country/Area'].iterrows():
        parent_code = row.get('Parent code')
        if pd.notna(parent_code):
            parent = df[df['Location code'] == parent_code]
            if not parent.empty:
                subregion = parent.iloc[0]['Region, subregion, country or area *']
                if subregion in subregion_to_region:
                    region_map[row['Region, subregion, country or area *']] = subregion_to_region[subregion]
    
    # Calculate regional averages
    regions_latest = df[(df['Type'] == 'Region') & (df['Year'] == latest_year)]
    regional_averages = {}
    
    for _, region_row in regions_latest.iterrows():
        region_name = region_row['Region, subregion, country or area *']
        regional_averages[region_name] = {}
        
        for key, col in indicators.items():
            value = region_row[col]
            if pd.notna(value):
                # Normalize (0-1 scale)
                normalized = (value - global_stats[key]['min']) / (global_stats[key]['max'] - global_stats[key]['min'])
                regional_averages[region_name][key] = {
                    'raw': float(value),
                    'normalized': float(normalized)
                }
    
    # Calculate world average
    world_average = {}
    for key, col in indicators.items():
        world_average[key] = {
            'raw': float(global_stats[key]['mean']),
            'normalized': 0.5  # Mean is roughly in the middle
        }
    
    # Process each country
    country_data = {}
    
    for _, row in countries_df.iterrows():
        country_name = row['Region, subregion, country or area *']
        country_code = row.get('ISO3 Alpha-code', '')
        
        country_profile = {
            'country': country_name,
            'iso3': country_code,
            'region': region_map.get(country_name, 'Unknown'),
            'values': {}
        }
        
        # Extract and normalize each indicator
        all_valid = True
        for key, col in indicators.items():
            value = row[col]
            if pd.notna(value):
                # Normalize to 0-1 scale
                normalized = (value - global_stats[key]['min']) / (global_stats[key]['max'] - global_stats[key]['min'])
                
                # Special handling for infant mortality (invert - lower is better)
                if key == 'infantMortality':
                    normalized = 1 - normalized
                
                country_profile['values'][key] = {
                    'raw': float(value),
                    'normalized': float(max(0, min(1, normalized)))  # Clamp to [0,1]
                }
            else:
                all_valid = False
                break
        
        if all_valid:
            country_data[country_name] = country_profile
    
    # Save to JSON
    output = {
        'globalStats': global_stats,
        'worldAverage': world_average,
        'regionalAverages': regional_averages,
        'countries': country_data,
        'indicators': {
            'fertility': 'Total Fertility Rate',
            'migration': 'Net Migration Rate',
            'lifeExpectancy': 'Life Expectancy',
            'medianAge': 'Median Age',
            'infantMortality': 'Infant Mortality (inverted)'
        }
    }
    
    with open('data/radar_chart_data.json', 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f"✓ Created radar_chart_data.json ({len(country_data)} countries)")


def prepare_ridgeline_data(df):
    """
    Prepare data for Ridgeline Plot (Global Ageing Distribution)
    Show distribution of Median Age across countries for each decade
    """
    print("\nPreparing ridgeline plot data (Global Ageing Distribution)...")
    
    countries_df = df[df['Type'] == 'Country/Area'].copy()
    
    # Group by decades
    decades = []
    for year in range(1950, 2030, 10):
        decade_data = countries_df[countries_df['Year'] == year].copy()
        
        median_ages = decade_data['Median Age, as of 1 July (years)'].dropna()
        
        if len(median_ages) > 0:
            # Create histogram bins
            bins = np.arange(10, 60, 2)  # Age bins from 10 to 60, step 2
            hist, bin_edges = np.histogram(median_ages, bins=bins)
            
            # Prepare distribution data
            distribution = []
            for i in range(len(hist)):
                distribution.append({
                    'age': float((bin_edges[i] + bin_edges[i+1]) / 2),  # Midpoint
                    'count': int(hist[i]),
                    'density': float(hist[i] / len(median_ages))  # Normalized
                })
            
            decades.append({
                'decade': year,
                'label': f"{year}s",
                'countries': int(len(median_ages)),
                'mean': float(median_ages.mean()),
                'median': float(median_ages.median()),
                'distribution': distribution
            })
    
    with open('data/ridgeline_data.json', 'w') as f:
        json.dump(decades, f, indent=2)
    
    print(f"✓ Created ridgeline_data.json ({len(decades)} decades)")


def prepare_growth_drivers_data(df):
    """
    Prepare data for Growth Drivers Scatter Plot
    X: Rate of Natural Change, Y: Net Migration Rate
    Size: Population, Color: Region
    """
    print("\nPreparing growth drivers scatter data...")
    
    # Build country-to-region mapping
    region_map = {}
    subregion_to_region = {}
    
    for _, row in df[df['Type'] == 'Subregion'].iterrows():
        parent_code = row.get('Parent code')
        if pd.notna(parent_code):
            parent = df[df['Location code'] == parent_code]
            if not parent.empty:
                subregion_to_region[row['Region, subregion, country or area *']] = parent.iloc[0]['Region, subregion, country or area *']
    
    for _, row in df[df['Type'] == 'Country/Area'].iterrows():
        parent_code = row.get('Parent code')
        if pd.notna(parent_code):
            parent = df[df['Location code'] == parent_code]
            if not parent.empty:
                subregion = parent.iloc[0]['Region, subregion, country or area *']
                if subregion in subregion_to_region:
                    region_map[row['Region, subregion, country or area *']] = subregion_to_region[subregion]
    
    countries_df = df[df['Type'] == 'Country/Area'].copy()
    
    # Process data for each year
    data = []
    for _, row in countries_df.iterrows():
        natural_change = row['Rate of Natural Change (per 1,000 population)']
        migration_rate = row['Net Migration Rate (per 1,000 population)']
        population = row['Total Population, as of 1 July (thousands)']
        
        if pd.notna(natural_change) and pd.notna(migration_rate) and pd.notna(population):
            country_name = row['Region, subregion, country or area *']
            data.append({
                'country': country_name,
                'year': int(row['Year']),
                'naturalChange': float(natural_change),
                'migrationRate': float(migration_rate),
                'population': float(population),
                'iso3': row.get('ISO3 Alpha-code', ''),
                'region': region_map.get(country_name, 'Unknown')
            })
    
    with open('data/growth_drivers_data.json', 'w') as f:
        json.dump(data, f, indent=2)
    
    print(f"✓ Created growth_drivers_data.json ({len(data)} records)")


def prepare_gender_gap_data(df):
    """
    Prepare data for Gender Gap Visualization (Slopegraph)
    Compare Male vs Female Life Expectancy for 1950 and latest year
    """
    print("\nPreparing gender gap data (Life Expectancy Slopegraph)...")
    
    countries_df = df[df['Type'] == 'Country/Area'].copy()
    
    # Get data for 1950 and latest year
    year_1950 = countries_df[countries_df['Year'] == 1950]
    latest_year = df['Year'].max()
    year_latest = countries_df[countries_df['Year'] == latest_year]
    
    # Build country-to-region mapping
    region_map = {}
    subregion_to_region = {}
    
    for _, row in df[df['Type'] == 'Subregion'].iterrows():
        parent_code = row.get('Parent code')
        if pd.notna(parent_code):
            parent = df[df['Location code'] == parent_code]
            if not parent.empty:
                subregion_to_region[row['Region, subregion, country or area *']] = parent.iloc[0]['Region, subregion, country or area *']
    
    for _, row in df[df['Type'] == 'Country/Area'].iterrows():
        parent_code = row.get('Parent code')
        if pd.notna(parent_code):
            parent = df[df['Location code'] == parent_code]
            if not parent.empty:
                subregion = parent.iloc[0]['Region, subregion, country or area *']
                if subregion in subregion_to_region:
                    region_map[row['Region, subregion, country or area *']] = subregion_to_region[subregion]
    
    # Process data
    data = []
    
    for country in countries_df['Region, subregion, country or area *'].unique():
        country_1950 = year_1950[year_1950['Region, subregion, country or area *'] == country]
        country_latest = year_latest[year_latest['Region, subregion, country or area *'] == country]
        
        if not country_1950.empty and not country_latest.empty:
            row_1950 = country_1950.iloc[0]
            row_latest = country_latest.iloc[0]
            
            male_1950 = row_1950['Male Life Expectancy at Birth (years)']
            female_1950 = row_1950['Female Life Expectancy at Birth (years)']
            male_latest = row_latest['Male Life Expectancy at Birth (years)']
            female_latest = row_latest['Female Life Expectancy at Birth (years)']
            
            if all(pd.notna([male_1950, female_1950, male_latest, female_latest])):
                data.append({
                    'country': country,
                    'iso3': row_latest.get('ISO3 Alpha-code', ''),
                    'region': region_map.get(country, 'Unknown'),
                    'year1950': {
                        'male': float(male_1950),
                        'female': float(female_1950),
                        'gap': float(female_1950 - male_1950)
                    },
                    f'year{latest_year}': {
                        'male': float(male_latest),
                        'female': float(female_latest),
                        'gap': float(female_latest - male_latest)
                    },
                    'gapChange': float((female_latest - male_latest) - (female_1950 - male_1950))
                })
    
    # Also create time series of gender gaps for selected countries
    major_countries = ['China', 'India', 'United States of America', 'Indonesia', 
                      'Pakistan', 'Brazil', 'Nigeria', 'Bangladesh', 'Russian Federation', 'Japan']
    
    timeseries_data = []
    for country in major_countries:
        country_data = countries_df[countries_df['Region, subregion, country or area *'] == country]
        
        country_series = []
        for _, row in country_data.iterrows():
            male = row['Male Life Expectancy at Birth (years)']
            female = row['Female Life Expectancy at Birth (years)']
            
            if pd.notna(male) and pd.notna(female):
                country_series.append({
                    'year': int(row['Year']),
                    'male': float(male),
                    'female': float(female),
                    'gap': float(female - male)
                })
        
        if country_series:
            timeseries_data.append({
                'country': country,
                'values': country_series
            })
    
    output = {
        'comparison': data,
        'timeseries': timeseries_data,
        'years': {
            'start': 1950,
            'end': int(latest_year)
        }
    }
    
    with open('data/gender_gap_data.json', 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f"✓ Created gender_gap_data.json ({len(data)} countries)")


def prepare_globe_data_by_year(df):
    """
    Prepare data for globe visualization - one file per year would be too many
    Instead, create a structured file with all years
    """
    print("\nPreparing globe data (all years)...")
    
    # Filter for countries only
    countries_df = df[df['Type'] == 'Country/Area'].copy()
    
    # Group by year
    data_by_year = {}
    
    for year in sorted(countries_df['Year'].unique()):
        year_data = countries_df[countries_df['Year'] == year].copy()
        
        # Sort by population
        year_data = year_data.sort_values('Total Population, as of 1 July (thousands)', 
                                          ascending=False, na_position='last')
        
        year_records = []
        for idx, row in year_data.iterrows():
            pop_thousands = row['Total Population, as of 1 July (thousands)']
            if pd.isna(pop_thousands) or pop_thousands <= 0:
                continue
                
            record = {
                'country': row['Region, subregion, country or area *'],
                'alpha3_code': row.get('ISO3 Alpha-code', ''),
                'population_number': float(pop_thousands * 1000),
                'population': format_population(pop_thousands * 1000),
                'population_density_number': float(row['Population Density, as of 1 July (persons per square km)']) if pd.notna(row['Population Density, as of 1 July (persons per square km)']) else 0,
                'population_density': f"{row['Population Density, as of 1 July (persons per square km)']:.1f}" if pd.notna(row['Population Density, as of 1 July (persons per square km)']) else 'N/A',
                'sex_ratio_number': float(row['Population Sex Ratio, as of 1 July (males per 100 females)']) if pd.notna(row['Population Sex Ratio, as of 1 July (males per 100 females)']) else 100,
                'sex_ratio': f"{row['Population Sex Ratio, as of 1 July (males per 100 females)']:.1f}" if pd.notna(row['Population Sex Ratio, as of 1 July (males per 100 females)']) else 'N/A',
                'median_age_number': float(row['Median Age, as of 1 July (years)']) if pd.notna(row['Median Age, as of 1 July (years)']) else 0,
                'median_age': f"{row['Median Age, as of 1 July (years)']:.1f}" if pd.notna(row['Median Age, as of 1 July (years)']) else 'N/A',
                # NEW: Fields for advanced visualization modes
                'birth_rate_number': float(row['Crude Birth Rate (births per 1,000 population)']) if pd.notna(row['Crude Birth Rate (births per 1,000 population)']) else 0,
                'birth_rate': f"{row['Crude Birth Rate (births per 1,000 population)']:.1f}" if pd.notna(row['Crude Birth Rate (births per 1,000 population)']) else 'N/A',
                'death_rate_number': float(row['Crude Death Rate (deaths per 1,000 population)']) if pd.notna(row['Crude Death Rate (deaths per 1,000 population)']) else 0,
                'death_rate': f"{row['Crude Death Rate (deaths per 1,000 population)']:.1f}" if pd.notna(row['Crude Death Rate (deaths per 1,000 population)']) else 'N/A',
                'natural_change_number': float(row['Rate of Natural Change (per 1,000 population)']) if pd.notna(row['Rate of Natural Change (per 1,000 population)']) else 0,
                'natural_change': f"{row['Rate of Natural Change (per 1,000 population)']:.1f}" if pd.notna(row['Rate of Natural Change (per 1,000 population)']) else 'N/A',
                'migration_rate_number': float(row['Net Migration Rate (per 1,000 population)']) if pd.notna(row['Net Migration Rate (per 1,000 population)']) else 0,
                'migration_rate': f"{row['Net Migration Rate (per 1,000 population)']:.1f}" if pd.notna(row['Net Migration Rate (per 1,000 population)']) else 'N/A',
                'life_expectancy_number': float(row['Life Expectancy at Birth, both sexes (years)']) if pd.notna(row['Life Expectancy at Birth, both sexes (years)']) else 0,
                'life_expectancy': f"{row['Life Expectancy at Birth, both sexes (years)']:.1f}" if pd.notna(row['Life Expectancy at Birth, both sexes (years)']) else 'N/A',
                'life_expectancy_male_number': float(row['Male Life Expectancy at Birth (years)']) if pd.notna(row['Male Life Expectancy at Birth (years)']) else 0,
                'life_expectancy_female_number': float(row['Female Life Expectancy at Birth (years)']) if pd.notna(row['Female Life Expectancy at Birth (years)']) else 0,
                'fertility_rate_number': float(row['Total Fertility Rate (live births per woman)']) if pd.notna(row['Total Fertility Rate (live births per woman)']) else 0,
                'fertility_rate': f"{row['Total Fertility Rate (live births per woman)']:.2f}" if pd.notna(row['Total Fertility Rate (live births per woman)']) else 'N/A',
                'infant_mortality_number': float(row['Infant Mortality Rate (infant deaths per 1,000 live births)']) if pd.notna(row['Infant Mortality Rate (infant deaths per 1,000 live births)']) else 0,
                'infant_mortality': f"{row['Infant Mortality Rate (infant deaths per 1,000 live births)']:.1f}" if pd.notna(row['Infant Mortality Rate (infant deaths per 1,000 live births)']) else 'N/A'
            }
            year_records.append(record)
        
        # Add rank
        for idx, record in enumerate(year_records):
            record['rank'] = idx + 1
        
        data_by_year[int(year)] = year_records
    
    with open('data/globe_data_all_years.json', 'w') as f:
        json.dump(data_by_year, f, indent=2)
    
    print(f"✓ Created globe_data_all_years.json ({len(data_by_year)} years)")


def prepare_country_detail_data(df):
    """
    Prepare time series data for country detail view
    """
    print("\nPreparing country detail data...")
    
    countries_df = df[df['Type'] == 'Country/Area'].copy()
    
    # Create a dictionary with country name as key
    country_data = {}
    
    for country in countries_df['Region, subregion, country or area *'].unique():
        country_rows = countries_df[countries_df['Region, subregion, country or area *'] == country].sort_values('Year')
        
        timeseries = []
        for _, row in country_rows.iterrows():
            pop = row['Total Population, as of 1 July (thousands)']
            if pd.isna(pop):
                continue
                
            timeseries.append({
                'year': int(row['Year']),
                'population': float(pop * 1000),
                'density': float(row['Population Density, as of 1 July (persons per square km)']) if pd.notna(row['Population Density, as of 1 July (persons per square km)']) else 0,
                'sexRatio': float(row['Population Sex Ratio, as of 1 July (males per 100 females)']) if pd.notna(row['Population Sex Ratio, as of 1 July (males per 100 females)']) else 100,
                'medianAge': float(row['Median Age, as of 1 July (years)']) if pd.notna(row['Median Age, as of 1 July (years)']) else 0
            })
        
        if timeseries:
            country_data[country] = timeseries
    
    with open('data/country_detail_data.json', 'w') as f:
        json.dump(country_data, f, indent=2)
    
    print(f"✓ Created country_detail_data.json ({len(country_data)} countries)")


def prepare_regional_timeseries(df):
    """
    Prepare data for regional time-series chart
    Includes all demographic metrics for graduate-level analysis
    """
    print("\nPreparing regional time-series data...")
    
    regions_df = df[df['Type'] == 'Region'].copy()
    
    data = []
    for region in regions_df['Region, subregion, country or area *'].unique():
        region_data = regions_df[regions_df['Region, subregion, country or area *'] == region].sort_values('Year')
        
        values = []
        for _, row in region_data.iterrows():
            pop = row['Total Population, as of 1 July (thousands)']
            if pd.notna(pop):
                values.append({
                    'year': int(row['Year']),
                    'population': float(pop),
                    'density': float(row['Population Density, as of 1 July (persons per square km)']) if pd.notna(row['Population Density, as of 1 July (persons per square km)']) else 0,
                    'sexRatio': float(row['Population Sex Ratio, as of 1 July (males per 100 females)']) if pd.notna(row['Population Sex Ratio, as of 1 July (males per 100 females)']) else 100,
                    'medianAge': float(row['Median Age, as of 1 July (years)']) if pd.notna(row['Median Age, as of 1 July (years)']) else 0,
                    'birthRate': float(row['Crude Birth Rate (births per 1,000 population)']) if pd.notna(row['Crude Birth Rate (births per 1,000 population)']) else 0,
                    'deathRate': float(row['Crude Death Rate (deaths per 1,000 population)']) if pd.notna(row['Crude Death Rate (deaths per 1,000 population)']) else 0,
                    'naturalChange': float(row['Rate of Natural Change (per 1,000 population)']) if pd.notna(row['Rate of Natural Change (per 1,000 population)']) else 0,
                    'migrationRate': float(row['Net Migration Rate (per 1,000 population)']) if pd.notna(row['Net Migration Rate (per 1,000 population)']) else 0,
                    'fertilityRate': float(row['Total Fertility Rate (live births per woman)']) if pd.notna(row['Total Fertility Rate (live births per woman)']) else 0,
                    'meanAgeChildbearing': float(row['Mean Age Childbearing (years)']) if pd.notna(row['Mean Age Childbearing (years)']) else 0,
                    'infantMortality': float(row['Infant Mortality Rate (infant deaths per 1,000 live births)']) if pd.notna(row['Infant Mortality Rate (infant deaths per 1,000 live births)']) else 0,
                    'underFiveMortality': float(row['Under-Five Mortality (deaths under age 5 per 1,000 live births)']) if pd.notna(row['Under-Five Mortality (deaths under age 5 per 1,000 live births)']) else 0,
                    'lifeExpectancyMale': float(row['Male Life Expectancy at Birth (years)']) if pd.notna(row['Male Life Expectancy at Birth (years)']) else 0,
                    'lifeExpectancyFemale': float(row['Female Life Expectancy at Birth (years)']) if pd.notna(row['Female Life Expectancy at Birth (years)']) else 0,
                    'lifeExpectancyBoth': float(row['Life Expectancy at Birth, both sexes (years)']) if pd.notna(row['Life Expectancy at Birth, both sexes (years)']) else 0
                })
        
        if values:
            data.append({
                'region': region,
                'values': values
            })
    
    with open('data/regional_population_nested.json', 'w') as f:
        json.dump(data, f, indent=2)
    
    print(f"✓ Created regional_population_nested.json ({len(data)} regions)")


def prepare_birth_death_rates(df):
    """
    Prepare data for small multiples visualization
    Includes both regional and country-level data
    """
    print("\nPreparing birth/death rate data...")
    
    # Regional data
    regions_df = df[df['Type'] == 'Region'].copy()
    regional_data = []
    
    for region in regions_df['Region, subregion, country or area *'].unique():
        region_data = regions_df[regions_df['Region, subregion, country or area *'] == region].sort_values('Year')
        
        values = []
        for _, row in region_data.iterrows():
            birth = row['Crude Birth Rate (births per 1,000 population)']
            death = row['Crude Death Rate (deaths per 1,000 population)']
            
            if pd.notna(birth) and pd.notna(death):
                values.append({
                    'year': int(row['Year']),
                    'birthRate': float(birth),
                    'deathRate': float(death),
                    'naturalChange': float(birth - death)
                })
        
        if values:
            regional_data.append({
                'region': region,
                'values': values
            })
    
    # Country-level data (nested dictionary)
    countries_df = df[df['Type'] == 'Country/Area'].copy()
    country_data = {}
    
    for country in countries_df['Region, subregion, country or area *'].unique():
        country_rows = countries_df[countries_df['Region, subregion, country or area *'] == country].sort_values('Year')
        
        values = []
        for _, row in country_rows.iterrows():
            birth = row['Crude Birth Rate (births per 1,000 population)']
            death = row['Crude Death Rate (deaths per 1,000 population)']
            
            if pd.notna(birth) and pd.notna(death):
                values.append({
                    'year': int(row['Year']),
                    'birthRate': float(birth),
                    'deathRate': float(death),
                    'naturalChange': float(birth - death)
                })
        
        if values:
            country_data[country] = values
    
    # Combine both into one file
    output = {
        'regions': regional_data,
        'countries': country_data
    }
    
    with open('data/birth_death_rates.json', 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f"✓ Created birth_death_rates.json ({len(regional_data)} regions, {len(country_data)} countries)")


def prepare_country_timeseries(df):
    """
    Prepare country-level time-series for comparison tool
    Organized as nested dictionary with all demographic metrics
    """
    print("\nPreparing country time-series data...")
    
    countries_df = df[df['Type'] == 'Country/Area'].copy()
    
    # Create nested dictionary by country
    country_data = {}
    
    for country in countries_df['Region, subregion, country or area *'].unique():
        country_rows = countries_df[countries_df['Region, subregion, country or area *'] == country].sort_values('Year')
        
        timeseries = []
        for _, row in country_rows.iterrows():
            pop = row['Total Population, as of 1 July (thousands)']
            if pd.notna(pop):
                timeseries.append({
                    'year': int(row['Year']),
                    'population': float(pop),
                    'density': float(row['Population Density, as of 1 July (persons per square km)']) if pd.notna(row['Population Density, as of 1 July (persons per square km)']) else 0,
                    'sexRatio': float(row['Population Sex Ratio, as of 1 July (males per 100 females)']) if pd.notna(row['Population Sex Ratio, as of 1 July (males per 100 females)']) else 100,
                    'medianAge': float(row['Median Age, as of 1 July (years)']) if pd.notna(row['Median Age, as of 1 July (years)']) else 0,
                    'birthRate': float(row['Crude Birth Rate (births per 1,000 population)']) if pd.notna(row['Crude Birth Rate (births per 1,000 population)']) else 0,
                    'deathRate': float(row['Crude Death Rate (deaths per 1,000 population)']) if pd.notna(row['Crude Death Rate (deaths per 1,000 population)']) else 0,
                    'naturalChange': float(row['Rate of Natural Change (per 1,000 population)']) if pd.notna(row['Rate of Natural Change (per 1,000 population)']) else 0,
                    'migrationRate': float(row['Net Migration Rate (per 1,000 population)']) if pd.notna(row['Net Migration Rate (per 1,000 population)']) else 0,
                    'fertilityRate': float(row['Total Fertility Rate (live births per woman)']) if pd.notna(row['Total Fertility Rate (live births per woman)']) else 0,
                    'meanAgeChildbearing': float(row['Mean Age Childbearing (years)']) if pd.notna(row['Mean Age Childbearing (years)']) else 0,
                    'infantMortality': float(row['Infant Mortality Rate (infant deaths per 1,000 live births)']) if pd.notna(row['Infant Mortality Rate (infant deaths per 1,000 live births)']) else 0,
                    'underFiveMortality': float(row['Under-Five Mortality (deaths under age 5 per 1,000 live births)']) if pd.notna(row['Under-Five Mortality (deaths under age 5 per 1,000 live births)']) else 0,
                    'lifeExpectancyMale': float(row['Male Life Expectancy at Birth (years)']) if pd.notna(row['Male Life Expectancy at Birth (years)']) else 0,
                    'lifeExpectancyFemale': float(row['Female Life Expectancy at Birth (years)']) if pd.notna(row['Female Life Expectancy at Birth (years)']) else 0,
                    'lifeExpectancyBoth': float(row['Life Expectancy at Birth, both sexes (years)']) if pd.notna(row['Life Expectancy at Birth, both sexes (years)']) else 0,
                    'iso3': row.get('ISO3 Alpha-code', '')
                })
        
        if timeseries:
            country_data[country] = timeseries
    
    with open('data/country_population_timeseries.json', 'w') as f:
        json.dump(country_data, f, indent=2)
    
    print(f"✓ Created country_population_timeseries.json ({len(country_data)} countries)")


def prepare_countries_list(df):
    """
    Create list of all countries for selector
    """
    print("\nPreparing countries list...")
    
    countries_df = df[df['Type'] == 'Country/Area']
    countries_list = sorted(countries_df['Region, subregion, country or area *'].unique().tolist())
    
    with open('data/countries_list.json', 'w') as f:
        json.dump(countries_list, f, indent=2)
    
    print(f"✓ Created countries_list.json ({len(countries_list)} countries)")


def prepare_projection_uncertainty(df):
    """
    Create confidence intervals for 2024-2030 population projections
    Uses simple extrapolation with increasing uncertainty bands
    """
    print("\nPreparing projection uncertainty data...")
    
    countries_df = df[df['Type'] == 'Country/Area'].copy()
    projection_data = []
    
    for country in countries_df['Region, subregion, country or area *'].unique():
        # Get historical data for this country
        country_data = countries_df[countries_df['Region, subregion, country or area *'] == country].sort_values('Year')
        
        # Get last 10 years for trend calculation
        historical = country_data.tail(10)
        
        if len(historical) < 5:  # Need at least 5 years for reasonable trend
            continue
        
        # Simple linear trend calculation
        years = historical['Year'].values
        populations = historical['Total Population, as of 1 July (thousands)'].values
        
        # Remove NaN values
        valid_mask = ~np.isnan(populations)
        years = years[valid_mask]
        populations = populations[valid_mask]
        
        if len(years) < 5:
            continue
        
        # Calculate linear trend
        coefficients = np.polyfit(years, populations, 1)
        trend_slope = coefficients[0]
        trend_intercept = coefficients[1]
        
        # Project future years (2024-2030)
        for year in range(2024, 2031):
            years_ahead = year - 2023
            uncertainty_factor = 1 + (years_ahead * 0.05)  # 5% per year
            
            # Predicted value
            predicted_pop = trend_slope * year + trend_intercept
            
            # Ensure non-negative
            if predicted_pop < 0:
                predicted_pop = populations[-1]  # Use last known value
            
            projection_data.append({
                'country': country,
                'year': int(year),
                'median': float(predicted_pop),
                'lower_50': float(predicted_pop * (1 - 0.25 * uncertainty_factor)),
                'upper_50': float(predicted_pop * (1 + 0.25 * uncertainty_factor)),
                'lower_95': float(predicted_pop * (1 - 0.5 * uncertainty_factor)),
                'upper_95': float(predicted_pop * (1 + 0.5 * uncertainty_factor))
            })
    
    with open('data/projection_uncertainty.json', 'w') as f:
        json.dump(projection_data, f, indent=2)
    
    print(f"✓ Created projection_uncertainty.json ({len(projection_data)} projections)")


def prepare_animation_data(df):
    """
    Prepare data for Hans Rosling animation
    """
    print("\nPreparing animation data...")
    
    # Build country-to-region mapping
    region_map = {}
    
    # First, build subregion to region map
    subregion_to_region = {}
    for _, row in df[df['Type'] == 'Subregion'].iterrows():
        parent_code = row.get('Parent code')
        if pd.notna(parent_code):
            parent = df[df['Location code'] == parent_code]
            if not parent.empty:
                subregion_to_region[row['Region, subregion, country or area *']] = parent.iloc[0]['Region, subregion, country or area *']
    
    # Now map countries to regions via subregions
    for _, row in df[df['Type'] == 'Country/Area'].iterrows():
        parent_code = row.get('Parent code')
        if pd.notna(parent_code):
            parent = df[df['Location code'] == parent_code]
            if not parent.empty:
                subregion = parent.iloc[0]['Region, subregion, country or area *']
                if subregion in subregion_to_region:
                    region_map[row['Region, subregion, country or area *']] = subregion_to_region[subregion]
    
    # Now create animation data
    countries_df = df[df['Type'] == 'Country/Area'].copy()
    
    data = []
    for _, row in countries_df.iterrows():
        fertility = row['Total Fertility Rate (live births per woman)']
        life_exp = row['Life Expectancy at Birth, both sexes (years)']
        pop = row['Total Population, as of 1 July (thousands)']
        
        if pd.notna(fertility) and pd.notna(life_exp) and pd.notna(pop):
            country_name = row['Region, subregion, country or area *']
            data.append({
                'country': country_name,
                'year': int(row['Year']),
                'fertility': float(fertility),
                'lifeExpectancy': float(life_exp),
                'population': float(pop),
                'iso3': row.get('ISO3 Alpha-code', ''),
                'region': region_map.get(country_name, 'Unknown')
            })
    
    with open('data/country_animation_data.json', 'w') as f:
        json.dump(data, f, indent=2)
    
    print(f"✓ Created country_animation_data.json ({len(data)} records)")


def create_region_metadata():
    """
    Create metadata for regions including color schemes
    """
    print("\nCreating region metadata...")
    
    regions = [
        {'name': 'Africa', 'color': '#e41a1c'},
        {'name': 'Asia', 'color': '#377eb8'},
        {'name': 'Europe', 'color': '#4daf4a'},
        {'name': 'Latin America and the Caribbean', 'color': '#984ea3'},
        {'name': 'Northern America', 'color': '#ff7f00'},
        {'name': 'Oceania', 'color': '#a65628'}
    ]
    
    with open('data/region_metadata.json', 'w') as f:
        json.dump(regions, f, indent=2)
    
    print(f"✓ Created region_metadata.json ({len(regions)} regions)")


def main():
    """Main preprocessing pipeline"""
    print("=" * 80)
    print("DATA PREPROCESSING FOR D3.JS DASHBOARD - ENHANCED VERSION")
    print("=" * 80)
    
    # Load data
    df = load_and_clean_data()
    
    # Generate original data files
    prepare_globe_data_by_year(df)
    prepare_country_detail_data(df)
    prepare_regional_timeseries(df)
    prepare_birth_death_rates(df)
    prepare_country_timeseries(df)
    prepare_countries_list(df)
    prepare_animation_data(df)
    create_region_metadata()
    
    # Generate NEW advanced visualization data files
    prepare_radar_chart_data(df)
    prepare_ridgeline_data(df)
    prepare_growth_drivers_data(df)
    prepare_gender_gap_data(df)
    prepare_projection_uncertainty(df)
    
    print("\n" + "=" * 80)
    print("PREPROCESSING COMPLETE!")
    print("=" * 80)
    print("\nGenerated files in data/ directory:")
    print("\n=== ORIGINAL FILES ===")
    print("  1. globe_data_all_years.json - Globe visualization (all years)")
    print("  2. country_detail_data.json - Country detail charts")
    print("  3. regional_population_nested.json - Regional time-series")
    print("  4. birth_death_rates.json - Small multiples")
    print("  5. country_population_timeseries.json - Country comparisons")
    print("  6. countries_list.json - List of all countries")
    print("  7. country_animation_data.json - Animation data")
    print("  8. region_metadata.json - Region colors")
    print("\n=== NEW ADVANCED VISUALIZATION FILES ===")
    print("  9. radar_chart_data.json - Country DNA Profile (Radar Charts)")
    print(" 10. ridgeline_data.json - Global Ageing Distribution (Ridgeline)")
    print(" 11. growth_drivers_data.json - Natural Change vs Migration (Scatter)")
    print(" 12. gender_gap_data.json - Life Expectancy Gender Gaps (Slopegraph)")
    print(" 13. projection_uncertainty.json - Population Projections with Confidence Bands (2024-2030)")
    print("\nReady for enhanced D3.js visualizations! 🚀\n")


if __name__ == "__main__":
    main()