document.addEventListener('DOMContentLoaded', () => {
    let waterData = {};
    let barChart, pieChart, lineChart;
    let selectedRegion = 'all';
    let selectedViolation = 'all';

    async function loadData() {
        try {
            const response = await fetch('/data.json');
            waterData = await response.json();
            populateFilters();
            createCharts();
        } catch (e) {
            console.error("Failed to load data:", e);
        }
    }

    function populateFilters() {
        const regionFilter = document.getElementById('region-filter');
        const violationFilter = document.getElementById('violation-filter');
        
        const regions = new Set();
        const violations = new Set();
        
        for (const pwsid in waterData) {
            const system = waterData[pwsid];
            const geoAreas = system.geo_areas || {};
            
            for (const geoKey in geoAreas) {
                const geo = geoAreas[geoKey];
                if (geo.COUNTY_SERVED) {
                    regions.add(geo.COUNTY_SERVED);
                }
            }
            
            for (const key in system.violations) {
                const v = system.violations[key];
                if (v.VIOLATION_NAME && v.VIOLATION_NAME !== 'Unknown Tribe') {
                    violations.add(v.VIOLATION_NAME);
                }
            }
        }
        
        regions.forEach(region => {
            const option = document.createElement('option');
            option.value = region;
            option.textContent = region;
            regionFilter.appendChild(option);
        });
        
        violations.forEach(violation => {
            const option = document.createElement('option');
            option.value = violation;
            option.textContent = violation;
            violationFilter.appendChild(option);
        });

        // Add event listeners for filters
        regionFilter.addEventListener('change', (e) => {
            selectedRegion = e.target.value;
            updateCharts();
        });

        violationFilter.addEventListener('change', (e) => {
            selectedViolation = e.target.value;
            updateCharts();
        });
    }

    function createCharts() {
        createBarChart();
        createPieChart();
        createLineChart();
    }

    function updateCharts() {
        if (barChart) barChart.destroy();
        if (pieChart) pieChart.destroy();
        if (lineChart) lineChart.destroy();
        createCharts();
    }

    function getFilteredData() {
        const filteredData = {};
        
        for (const pwsid in waterData) {
            const system = waterData[pwsid];
            let includeSystem = true;
            
            // Filter by region
            if (selectedRegion !== 'all') {
                const geoAreas = system.geo_areas || {};
                let inRegion = false;
                for (const geoKey in geoAreas) {
                    const geo = geoAreas[geoKey];
                    if (geo.COUNTY_SERVED === selectedRegion) {
                        inRegion = true;
                        break;
                    }
                }
                if (!inRegion) includeSystem = false;
            }
            
            // Filter by violation
            if (selectedViolation !== 'all') {
                let hasViolation = false;
                for (const key in system.violations) {
                    const v = system.violations[key];
                    if (v.VIOLATION_NAME === selectedViolation) {
                        hasViolation = true;
                        break;
                    }
                }
                if (!hasViolation) includeSystem = false;
            }
            
            if (includeSystem) {
                filteredData[pwsid] = system;
            }
        }
        
        return filteredData;
    }

    function createBarChart() {
        const ctx = document.getElementById('barChart').getContext('2d');
        const regionData = {};
        const filteredData = getFilteredData();
        
        for (const pwsid in filteredData) {
            const system = filteredData[pwsid];
            const geoAreas = system.geo_areas || {};
            
            for (const geoKey in geoAreas) {
                const geo = geoAreas[geoKey];
                if (geo.COUNTY_SERVED) {
                    const county = geo.COUNTY_SERVED;
                    if (!regionData[county]) regionData[county] = 0;
                    
                    const violations = Object.values(system.violations || {})
                        .filter(v => v && v.VIOLATION_ID && v.VIOLATION_STATUS !== 'Archived');
                    regionData[county] += violations.length;
                    break;
                }
            }
        }
        
        const sortedRegions = Object.entries(regionData)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
        
        barChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sortedRegions.map(r => r[0]),
                datasets: [{
                    label: 'Active Violations',
                    data: sortedRegions.map(r => r[1]),
                    backgroundColor: '#ff5722',
                    borderColor: '#d32f2f',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    function createPieChart() {
        const ctx = document.getElementById('pieChart').getContext('2d');
        const violationTypes = {};
        const filteredData = getFilteredData();
        
        for (const pwsid in filteredData) {
            const system = filteredData[pwsid];
            for (const key in system.violations) {
                const v = system.violations[key];
                if (v.VIOLATION_NAME && v.VIOLATION_NAME !== 'Unknown Tribe' && v.VIOLATION_STATUS !== 'Archived') {
                    if (!violationTypes[v.VIOLATION_NAME]) violationTypes[v.VIOLATION_NAME] = 0;
                    violationTypes[v.VIOLATION_NAME]++;
                }
            }
        }
        
        const sortedTypes = Object.entries(violationTypes)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8);
        
        pieChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: sortedTypes.map(t => t[0]),
                datasets: [{
                    data: sortedTypes.map(t => t[1]),
                    backgroundColor: [
                        '#ff5722', '#ff9800', '#ffc107', '#ffeb3b',
                        '#cddc39', '#8bc34a', '#4caf50', '#009688'
                    ]
                }]
            },
            options: {
                responsive: true
            }
        });
    }

    function createLineChart() {
        const ctx = document.getElementById('lineChart').getContext('2d');
        const filteredData = getFilteredData();
        
        // Calculate current stats
        let totalViolations = 0;
        let totalSystems = Object.keys(filteredData).length;
        
        for (const pwsid in filteredData) {
            const system = filteredData[pwsid];
            const violations = Object.values(system.violations || {})
                .filter(v => v && v.VIOLATION_ID && v.VIOLATION_STATUS !== 'Archived');
            totalViolations += violations.length;
        }
        
        const complianceRate = totalSystems > 0 ? Math.round(((totalSystems - totalViolations) / totalSystems) * 100) : 100;
        
        // Mock trend data based on current stats
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
        const violationTrend = [
            Math.round(totalViolations * 1.3),
            Math.round(totalViolations * 1.2),
            Math.round(totalViolations * 1.1),
            Math.round(totalViolations * 1.05),
            Math.round(totalViolations * 1.02),
            totalViolations
        ];
        const complianceTrend = [
            Math.max(complianceRate - 15, 0),
            Math.max(complianceRate - 12, 0),
            Math.max(complianceRate - 8, 0),
            Math.max(complianceRate - 5, 0),
            Math.max(complianceRate - 2, 0),
            complianceRate
        ];
        
        lineChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: months,
                datasets: [{
                    label: 'Active Violations',
                    data: violationTrend,
                    borderColor: '#ff5722',
                    backgroundColor: 'rgba(255, 87, 34, 0.1)',
                    tension: 0.4
                }, {
                    label: 'Compliance Rate (%)',
                    data: complianceTrend,
                    borderColor: '#4caf50',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    loadData();
});