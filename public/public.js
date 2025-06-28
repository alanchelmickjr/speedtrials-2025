document.addEventListener('DOMContentLoaded', () => {
    let waterData = {};
    let zipCodeData = {};
    let map;
    let markerLayer;

    async function loadData() {
        try {
            const [waterResponse, zipResponse] = await Promise.all([
                fetch('/data.json'),
                fetch('/zip_codes.json')
            ]);
            waterData = await waterResponse.json();
            zipCodeData = await zipResponse.json();
            initializeMap();
            plotAllSystems();
        } catch (e) {
            console.error("Failed to load data:", e);
        }
    }

    function initializeMap() {
        map = L.map('public-map').setView([32.9866, -83.6479], 7);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
        }).addTo(map);
        markerLayer = L.layerGroup().addTo(map);
    }

    function plotAllSystems() {
        if (markerLayer) markerLayer.clearLayers();
        
        for (const pwsid in waterData) {
            const system = waterData[pwsid];
            let coords = null;
            const geoAreas = system.geo_areas || {};
            
            for (const geoKey in geoAreas) {
                const geo = geoAreas[geoKey];
                if (geo && geo.ZIP_CODE_SERVED) {
                    const zip = String(geo.ZIP_CODE_SERVED).trim().substring(0, 5);
                    if (zipCodeData[zip]) {
                        coords = zipCodeData[zip];
                        break;
                    }
                }
            }
            
            if (!coords && system.ZIP_CODE) {
                const zip = String(system.ZIP_CODE).trim().substring(0, 5);
                if (zipCodeData[zip]) {
                    coords = zipCodeData[zip];
                }
            }

            if (coords && coords.lat && coords.lon) {
                const actualViolations = Object.values(system.violations || {})
                    .filter(v => v && v.VIOLATION_ID && v.VIOLATION_NAME && v.VIOLATION_NAME !== 'Unknown Tribe');
                const activeViolations = actualViolations.filter(v => v.VIOLATION_STATUS !== 'Archived' && v.VIOLATION_STATUS !== 'Resolved');
                const violationCount = activeViolations.length;
                
                // Only show systems with violations on public map
                if (violationCount === 0) {
                    continue;
                }
                
                const icon = L.divIcon({
                    className: 'custom-div-icon',
                    html: `<div class="marker-pin-red"></div><div class="marker-badge">${violationCount}</div>`,
                    iconSize: [30, 42],
                    iconAnchor: [15, 42]
                });

                const marker = L.marker([parseFloat(coords.lat), parseFloat(coords.lon)], { icon: icon })
                    .on('click', () => {
                        displaySystemTable(pwsid);
                    });
                markerLayer.addLayer(marker);
            }
        }
    }

    function displaySystemTable(pwsid) {
        const system = waterData[pwsid];
        if (!system) return;

        const violations = system.violations || {};
        const actualViolations = Object.values(violations)
            .filter(v => v && v.VIOLATION_ID && v.VIOLATION_NAME && v.VIOLATION_NAME !== 'Unknown Tribe');

        let tableHtml = `
            <h3>${system.PWS_NAME}</h3>
            <table class="public-table">
                <tr><th>PWSID</th><td>${system.PWSID}</td></tr>
                <tr><th>Population Served</th><td>${system.POPULATION_SERVED_COUNT}</td></tr>
                <tr><th>Primary Source</th><td>${system.PRIMARY_SOURCE_CODE}</td></tr>
                <tr><th>Total Violations</th><td>${actualViolations.length}</td></tr>
            </table>`;

        if (actualViolations.length > 0) {
            tableHtml += `
                <h4>Violations</h4>
                <table class="public-table">
                    <thead>
                        <tr>
                            <th>Violation</th>
                            <th>Contaminant</th>
                            <th>Status</th>
                            <th>Period</th>
                        </tr>
                    </thead>
                    <tbody>`;
            
            actualViolations.forEach(v => {
                tableHtml += `
                    <tr>
                        <td>${v.VIOLATION_NAME || 'Unknown'}</td>
                        <td>${v.CONTAMINANT_NAME || v.CONTAMINANT_CODE || 'N/A'}</td>
                        <td>${v.VIOLATION_STATUS || 'Pending'}</td>
                        <td>${v.NON_COMPL_PER_BEGIN_DATE || ''} to ${v.NON_COMPL_PER_END_DATE || 'Present'}</td>
                    </tr>`;
            });
            
            tableHtml += '</tbody></table>';
        }

        document.getElementById('public-system-table').innerHTML = tableHtml;
    }

    loadData();
});