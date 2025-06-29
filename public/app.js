document.addEventListener('DOMContentLoaded', () => {
    const gun = Gun(location.origin + '/gun');
    console.log('Connected to Gun relay peer.');

    let waterData = {};
    let zipCodeData = {};
    let map;
    let currentPwsid = null;
    let mapExpanded = false;
    let showViolationsOnly = true;
    let showCompliant = false;
    let selectedViolationType = null;

    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    const violationSearchInput = document.getElementById('violation-search-input');
    const violationSearchResults = document.getElementById('violation-search-results');
    const systemDetails = document.getElementById('system-details');
    const operatorPwsidInput = document.getElementById('operator-pwsid-input');
    const operatorSearchResults = document.getElementById('operator-search-results');
    const operatorDetails = document.getElementById('operator-details');
    const taskList = document.getElementById('task-list');
    const chatHistory = document.getElementById('chat-history');
    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send-btn');
    const expandMapBtn = document.getElementById('expand-map-btn');
    const closeMapBtn = document.getElementById('close-map-btn');
    const showViolationsOnlyCheckbox = document.getElementById('show-violations-only');
    const showCompliantCheckbox = document.getElementById('show-compliant');
    const mapElement = document.getElementById('map');
    const mapCard = document.querySelector('.map-card');

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

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && mapExpanded) {
            closeExpandedMap();
        }
    });

    function closeExpandedMap() {
        mapCard.classList.remove('expanded');
        mapElement.className = 'map-normal';
        expandMapBtn.classList.remove('hidden');
        closeMapBtn.classList.add('hidden');
        mapExpanded = false;
        setTimeout(() => map.invalidateSize(), 300);
    }

    expandMapBtn.addEventListener('click', () => {
        mapCard.classList.add('expanded');
        mapElement.className = 'map-expanded';
        expandMapBtn.classList.add('hidden');
        closeMapBtn.classList.remove('hidden');
        mapExpanded = true;
        setTimeout(() => map.invalidateSize(), 300);
    });

    closeMapBtn.addEventListener('click', closeExpandedMap);

    showViolationsOnlyCheckbox.addEventListener('change', (e) => {
        showViolationsOnly = e.target.checked;
        plotAllSystems();
    });

    showCompliantCheckbox.addEventListener('change', (e) => {
        showCompliant = e.target.checked;
        plotAllSystems();
    });

    operatorPwsidInput.addEventListener('focus', () => {
        operatorSearchResults.innerHTML = '';
        const categorizedSystems = { pending: [], active: [], resolved: [], compliant: [] };
        
        for (const pwsid in waterData) {
            const system = waterData[pwsid];
            const actualViolations = Object.values(system.violations || {})
                .filter(v => v && v.VIOLATION_ID && v.VIOLATION_NAME && v.VIOLATION_NAME !== 'Unknown Tribe');
            
            if (actualViolations.length === 0) {
                categorizedSystems.compliant.push(pwsid);
            } else {
                const pendingViolations = actualViolations.filter(v => !v.VIOLATION_STATUS || v.VIOLATION_STATUS === 'Unaddressed' || v.VIOLATION_STATUS === 'Open');
                if (pendingViolations.length > 0) {
                    categorizedSystems.pending.push(pwsid);
                }
            }
        }
        
        const sampleSystems = [...categorizedSystems.pending.slice(0, 8), ...categorizedSystems.compliant.slice(0, 2)];
        
        sampleSystems.forEach(pwsid => {
            const system = waterData[pwsid];
            const div = document.createElement('div');
            div.className = 'search-result-item';
            div.textContent = `${system.PWS_NAME} (${pwsid})`;
            div.dataset.pwsid = pwsid;
            operatorSearchResults.appendChild(div);
        });
    });

    operatorSearchResults.addEventListener('click', (e) => {
        if (e.target.classList.contains('search-result-item')) {
            const pwsid = e.target.dataset.pwsid;
            operatorPwsidInput.value = pwsid;
            operatorSearchResults.innerHTML = '';
            displaySystemDetails(pwsid, operatorDetails);
            loadTasks(pwsid);
            zoomToSystem(pwsid);
        }
    });

    searchInput.addEventListener('focus', () => {
        searchResults.innerHTML = '';
        const regionsWithViolations = new Set();
        for (const pwsid in waterData) {
            const system = waterData[pwsid];
            const actualViolations = Object.values(system.violations || {})
                .filter(v => v && v.VIOLATION_ID && v.VIOLATION_NAME && v.VIOLATION_NAME !== 'Unknown Tribe');
            
            if (actualViolations.length > 0) {
                const geoAreas = system.geo_areas || {};
                for (const geoKey in geoAreas) {
                    const geo = geoAreas[geoKey];
                    if (geo.COUNTY_SERVED) {
                        regionsWithViolations.add(`${geo.COUNTY_SERVED} County`);
                    }
                    if (geo.CITY_SERVED) {
                        regionsWithViolations.add(`${geo.CITY_SERVED} City`);
                    }
                }
            }
        }
        
        regionsWithViolations.forEach(region => {
            const div = document.createElement('div');
            div.className = 'search-result-item';
            div.textContent = region;
            div.dataset.region = region;
            searchResults.appendChild(div);
        });
    });

    searchResults.addEventListener('click', (e) => {
        if (e.target.classList.contains('search-result-item')) {
            if (e.target.dataset.region) {
                const region = e.target.dataset.region;
                searchInput.value = region;
                searchResults.innerHTML = '';
                
                const systemsInRegion = [];
                for (const pwsid in waterData) {
                    const system = waterData[pwsid];
                    const geoAreas = system.geo_areas || {};
                    
                    for (const geoKey in geoAreas) {
                        const geo = geoAreas[geoKey];
                        if ((geo.COUNTY_SERVED && region.includes(geo.COUNTY_SERVED)) ||
                            (geo.CITY_SERVED && region.includes(geo.CITY_SERVED))) {
                            systemsInRegion.push(pwsid);
                            break;
                        }
                    }
                }
                
                systemsInRegion.forEach(pwsid => {
                    const system = waterData[pwsid];
                    const div = document.createElement('div');
                    div.className = 'search-result-item';
                    div.textContent = `${system.PWS_NAME} (${pwsid})`;
                    div.dataset.pwsid = pwsid;
                    searchResults.appendChild(div);
                });
            } else if (e.target.dataset.pwsid) {
                const pwsid = e.target.dataset.pwsid;
                displaySystemDetails(pwsid, systemDetails);
                zoomToSystem(pwsid);
                searchResults.innerHTML = '';
                searchInput.value = '';
            }
        }
    });

    violationSearchInput.addEventListener('focus', () => {
        violationSearchResults.innerHTML = '';
        const violationNames = new Set();
        for (const pwsid in waterData) {
            const system = waterData[pwsid];
            for (const key in system.violations) {
                const v = system.violations[key];
                if (v.VIOLATION_NAME && v.VIOLATION_NAME !== 'Unknown Tribe') {
                    violationNames.add(v.VIOLATION_NAME);
                }
            }
        }
        violationNames.forEach(name => {
            const div = document.createElement('div');
            div.className = 'search-result-item';
            div.textContent = name;
            violationSearchResults.appendChild(div);
        });
    });

    violationSearchResults.addEventListener('click', (e) => {
        if (e.target.classList.contains('search-result-item') && !e.target.dataset.pwsid) {
            const violationName = e.target.textContent;
            violationSearchInput.value = violationName;
            violationSearchResults.innerHTML = '';
            selectedViolationType = violationName;
            
            const matchingSystems = new Set();
            for (const pwsid in waterData) {
                const system = waterData[pwsid];
                for (const key in system.violations) {
                    const v = system.violations[key];
                    if (v.VIOLATION_NAME === violationName) {
                        matchingSystems.add(pwsid);
                    }
                }
            }
            
            searchResults.innerHTML = '';
            matchingSystems.forEach(pwsid => {
                const system = waterData[pwsid];
                const div = document.createElement('div');
                div.className = 'search-result-item';
                div.textContent = `${system.PWS_NAME} (${pwsid})`;
                div.dataset.pwsid = pwsid;
                searchResults.appendChild(div);
            });
            
            plotAllSystems();
        }
    });

    function zoomToSystem(pwsid) {
        const system = waterData[pwsid];
        if (!system || !map) return;

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
            if (mapExpanded) {
                closeExpandedMap();
                setTimeout(() => {
                    map.setView([parseFloat(coords.lat), parseFloat(coords.lon)], 12);
                }, 300);
            } else {
                map.setView([parseFloat(coords.lat), parseFloat(coords.lon)], 12);
            }
        }
    }

    function displaySystemDetails(pwsid, container) {
        currentPwsid = pwsid;
        const system = waterData[pwsid];
        if (!system) return;

        const mainDetailsContainer = document.getElementById('system-details');
        let violationsHtml = '<h4>Violations</h4>';
        const violations = system.violations || {};
        
        const actualViolations = Object.values(violations)
            .filter(v => v && v.VIOLATION_ID && v.VIOLATION_NAME && v.VIOLATION_NAME !== 'Unknown Tribe');
        
        if (actualViolations.length > 0) {
            const pendingViolations = actualViolations.filter(v => !v.VIOLATION_STATUS || v.VIOLATION_STATUS === 'Unaddressed' || v.VIOLATION_STATUS === 'Open');
            
            if (pendingViolations.length > 0) {
                violationsHtml += '<h5 style="color: #d32f2f;">⚠️ Pending Violations (' + pendingViolations.length + ')</h5>';
                pendingViolations.forEach(v => {
                    violationsHtml += `
                        <div class="violation-item" style="border-left: 4px solid #ff5722;">
                            <div class="violation-header">${v.VIOLATION_NAME || 'Unknown Violation'} (${v.VIOLATION_CODE || 'N/A'})</div>
                            <p><strong>Contaminant:</strong> ${v.CONTAMINANT_NAME || v.CONTAMINANT_CODE || 'N/A'}</p>
                            <p><strong>Period:</strong> ${v.NON_COMPL_PER_BEGIN_DATE || ''} to ${v.NON_COMPL_PER_END_DATE || 'Present'}</p>
                            <p><strong>Status:</strong> <span style="color: #ff5722; font-weight: bold;">${v.VIOLATION_STATUS || 'Pending'}</span></p>
                            <button class="resolve-btn" data-violation-id="${v.VIOLATION_ID}" data-pwsid="${pwsid}">Mark as Resolved</button>
                            <div class="messages-container" id="messages-${v.VIOLATION_ID}"></div>
                            <div class="message-input">
                                <input type="text" id="msg-input-${v.VIOLATION_ID}" placeholder="Type message...">
                                <button class="send-btn" data-violation-id="${v.VIOLATION_ID}">Send</button>
                            </div>
                            <div class="task-input">
                                <input type="text" id="task-input-${v.VIOLATION_ID}" placeholder="Create a new task...">
                                <button class="create-task-btn" data-pwsid="${pwsid}" data-violation-id="${v.VIOLATION_ID}">Create Task</button>
                            </div>
                        </div>`;
                });
            }
        } else {
            violationsHtml += '<p style="color: #4caf50; font-weight: bold;">✓ No violations on record. System is in compliance.</p>';
        }

        mainDetailsContainer.innerHTML = `
            <h3>${system.PWS_NAME}</h3>
            <p><strong>PWSID:</strong> ${system.PWSID}</p>
            <p><strong>Population Served:</strong> ${system.POPULATION_SERVED_COUNT}</p>
            <p><strong>Primary Source:</strong> ${system.PRIMARY_SOURCE_CODE}</p>
            <hr>
            ${violationsHtml}`;

        attachMessageListeners(system);
    }

    function attachMessageListeners(system) {
        document.querySelectorAll('.send-btn').forEach(button => button.onclick = sendMessage);
        document.querySelectorAll('.create-task-btn').forEach(button => button.onclick = createTask);
        document.querySelectorAll('.resolve-btn').forEach(button => button.onclick = resolveViolation);

        for (const key in system.violations) {
            const v = system.violations[key];
            if (v && v.VIOLATION_ID) {
                const messagesContainer = document.getElementById(`messages-${v.VIOLATION_ID}`);
                if (messagesContainer) {
                    messagesContainer.innerHTML = '';
                    gun.get('messages').get(v.VIOLATION_ID).map().on((message) => {
                        if (message) displayMessage(messagesContainer, message);
                    });
                }
            }
        }
    }

    function resolveViolation(e) {
        const violationId = e.target.dataset.violationId;
        const pwsid = e.target.dataset.pwsid;
        
        if (confirm('Mark this violation as resolved?')) {
            const system = waterData[pwsid];
            for (const key in system.violations) {
                const v = system.violations[key];
                if (v && v.VIOLATION_ID === violationId) {
                    v.VIOLATION_STATUS = 'Resolved';
                    break;
                }
            }
            
            displaySystemDetails(pwsid, systemDetails);
            plotAllSystems();
            
            gun.get('resolutions').get(violationId).put({
                violationId: violationId,
                pwsid: pwsid,
                resolvedDate: new Date().toISOString(),
                resolvedBy: 'Regulator'
            });
        }
    }

    function sendMessage(e) {
        const violationId = e.target.dataset.violationId;
        const input = document.getElementById(`msg-input-${violationId}`);
        if (input.value.trim() && violationId) {
            gun.get('messages').get(violationId).set({
                text: input.value.trim(),
                timestamp: new Date().toISOString(),
                sender: 'User'
            });
            input.value = '';
        }
    }

    function displayMessage(container, message) {
        if (!container || !message || !message.timestamp) return;
        const existingMsg = document.getElementById(message.timestamp);
        if (existingMsg) return;
        const messageEl = document.createElement('div');
        messageEl.className = 'message-item';
        messageEl.id = message.timestamp;
        messageEl.innerHTML = `<strong>${message.sender}</strong> <small>(${new Date(message.timestamp).toLocaleString()})</small><p>${message.text}</p>`;
        container.appendChild(messageEl);
        container.scrollTop = container.scrollHeight;
    }

    chatSendBtn.addEventListener('click', sendChatMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage();
        }
    });

    async function sendChatMessage() {
        const userMessage = chatInput.value.trim();
        if (!userMessage) return;
        appendMessage(userMessage, 'user');
        chatInput.value = '';

        let context = "You are a helpful AI assistant for water system compliance. ";
        if (currentPwsid && waterData[currentPwsid]) {
            const system = waterData[currentPwsid];
            const systemContext = {
                name: system.PWS_NAME,
                id: system.PWSID,
                population: system.POPULATION_SERVED_COUNT,
                violations: Object.values(system.violations || {}).map(v => ({ name: v.VIOLATION_NAME, contaminant: v.CONTAMINANT_NAME, status: v.VIOLATION_STATUS }))
            };
            context += `The user is viewing: ${JSON.stringify(systemContext)}. Use this to answer.`;
        }
        const finalMessage = `${context}\\n\\nUser Question: "${userMessage}"`;

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: finalMessage })
            });
            if (!response.body) return;
            const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
            let aiResponseContainer = appendMessage('', 'ai');
            let accumulatedResponse = '';
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                const chunks = value.split('\\n\\n');
                for (const chunk of chunks) {
                    if (chunk.startsWith('data: ')) {
                        const jsonStr = chunk.substring(6);
                        if (jsonStr.trim()) {
                            const data = JSON.parse(jsonStr);
                            accumulatedResponse += data.text;
                            aiResponseContainer.innerHTML = marked.parse(accumulatedResponse);
                            chatHistory.scrollTop = chatHistory.scrollHeight;
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Chat error:', error);
            appendMessage('Sorry, I encountered an error.', 'ai');
        }
    }

    function appendMessage(text, sender) {
        const messageWrapper = document.createElement('div');
        messageWrapper.className = `${sender}-message`;
        if (sender === 'ai') {
            messageWrapper.innerHTML = marked.parse(text);
        } else {
            messageWrapper.textContent = text;
        }
        chatHistory.appendChild(messageWrapper);
        chatHistory.scrollTop = chatHistory.scrollHeight;
        return messageWrapper;
    }

    function createTask(e) {
        const violationId = e.target.dataset.violationId;
        const pwsid = e.target.dataset.pwsid;
        const input = document.getElementById(`task-input-${violationId}`);
        const taskText = input.value.trim();
        if (taskText && violationId && pwsid) {
            const taskId = `task-${Date.now()}`;
            gun.get('tasks').get(pwsid).get(taskId).put({
                id: taskId,
                pwsid: pwsid,
                violationId: violationId,
                text: taskText,
                status: 'Open',
                created: new Date().toISOString()
            });
            input.value = '';
        }
    }

    function loadTasks(pwsid) {
        if (!taskList) return;
        taskList.innerHTML = '';
        gun.get('tasks').get(pwsid).map().on((task) => {
            if (task) displayTask(task);
        });
    }

    function displayTask(task) {
        if (!task || !task.id) return;
        const existingTask = document.getElementById(task.id);
        if (existingTask) existingTask.remove();
        const taskEl = document.createElement('div');
        taskEl.className = 'task-item';
        taskEl.id = task.id;
        taskEl.innerHTML = `<p><strong>Task:</strong> ${task.text}</p><p><strong>Status:</strong> ${task.status}</p><p><small>Violation ID: ${task.violationId}</small></p>`;
        taskList.prepend(taskEl);
    }

    let markerLayer;

    const greenIcon = new L.Icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });

    function initializeMap() {
        if (map) map.remove();
        map = L.map('map').setView([32.9866, -83.6479], 7);
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
                
                if (selectedViolationType) {
                    const hasSelectedViolation = actualViolations.some(v => v.VIOLATION_NAME === selectedViolationType);
                    if (!hasSelectedViolation) {
                        continue;
                    }
                }
                
                const hasViolations = violationCount > 0;
                const isCompliant = violationCount === 0;
                
                if ((showViolationsOnly && !hasViolations) || (!showCompliant && isCompliant)) {
                    continue;
                }
                
                let icon;
                if (violationCount > 0) {
                    icon = L.divIcon({
                        className: 'custom-div-icon',
                        html: `<div class="marker-pin-red"></div><div class="marker-badge">${violationCount}</div>`,
                        iconSize: [30, 42],
                        iconAnchor: [15, 42]
                    });
                } else {
                    icon = greenIcon;
                }

                const popupContent = `<b>${system.PWS_NAME}</b><br>PWSID: ${pwsid}<br>${violationCount > 0 ? violationCount + ' active violation(s)' : 'In compliance'}`;
                const marker = L.marker([parseFloat(coords.lat), parseFloat(coords.lon)], { icon: icon })
                    .bindPopup(popupContent)
                    .on('click', () => {
                        displaySystemDetails(pwsid, systemDetails);
                        zoomToSystem(pwsid);
                    });
                markerLayer.addLayer(marker);
            }
        }
    }

    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            tabContents.forEach(content => content.classList.add('hidden'));
            document.getElementById(tab.dataset.tab).classList.remove('hidden');
        });
    });

    loadData();
});