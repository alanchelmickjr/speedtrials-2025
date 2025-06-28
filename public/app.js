document.addEventListener('DOMContentLoaded', () => {
    // Connect to the Gun instance on the server
    const gun = Gun(location.origin + '/gun');
    console.log('Connected to Gun relay peer.');

    // --- Global variables ---
    let waterData = {};
    let zipCodeData = {};
    let map;
    let currentPwsid = null; // To track the currently viewed system for context
    let mapExpanded = false;
    let showViolationsOnly = true;
    let showCompliant = false;

    // --- DOM Elements ---
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

    // --- Initial Data Load (Client-Side) ---
    async function loadData() {
        try {
            console.log('Fetching data...');
            const [waterResponse, zipResponse] = await Promise.all([
                fetch('/data.json'),
                fetch('/zip_codes.json')
            ]);
            if (!waterResponse.ok || !zipResponse.ok) {
                throw new Error(`HTTP error! Water: ${waterResponse.status}, Zip: ${zipResponse.status}`);
            }
            waterData = await waterResponse.json();
            zipCodeData = await zipResponse.json();
            console.log(`Successfully loaded ${Object.keys(waterData).length} water systems and ${Object.keys(zipCodeData).length} zip codes.`);
            
            initializeMap();
            plotAllSystems();
            
        } catch (e) {
            console.error("Failed to load or parse data:", e);
            systemDetails.innerHTML = "<p>Error: Could not load initial data.</p>";
        }
    }

    // --- ESC key handler for expanded map ---
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

    // --- Map Controls ---
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

    // --- Regulator View Logic ---
    const samplePwsids = ['GA0170001', 'GA0280000', 'GA1130001', 'GA1210001', 'GA1350002'];

    operatorPwsidInput.addEventListener('focus', () => {
        operatorSearchResults.innerHTML = '';
        const categorizedSystems = {
            pending: [],
            active: [],
            resolved: [],
            compliant: []
        };
        
        for (const pwsid in waterData) {
            const system = waterData[pwsid];
            const actualViolations = Object.values(system.violations || {})
                .filter(v => v && v.VIOLATION_ID && v.VIOLATION_NAME && v.VIOLATION_NAME !== 'Unknown Tribe');
            
            if (actualViolations.length === 0) {
                categorizedSystems.compliant.push(pwsid);
            } else {
                const pendingViolations = actualViolations.filter(v => !v.VIOLATION_STATUS || v.VIOLATION_STATUS === 'Unaddressed' || v.VIOLATION_STATUS === 'Open');
                const activeViolations = actualViolations.filter(v => v.VIOLATION_STATUS && v.VIOLATION_STATUS !== 'Archived' && v.VIOLATION_STATUS !== 'Resolved' && v.VIOLATION_STATUS !== 'Unaddressed' && v.VIOLATION_STATUS !== 'Open');
                const resolvedViolations = actualViolations.filter(v => v.VIOLATION_STATUS === 'Archived' || v.VIOLATION_STATUS === 'Resolved');
                
                if (pendingViolations.length > 0) {
                    categorizedSystems.pending.push(pwsid);
                } else if (activeViolations.length > 0) {
                    categorizedSystems.active.push(pwsid);
                } else if (resolvedViolations.length > 0) {
                    categorizedSystems.resolved.push(pwsid);
                }
            }
        }
        
        // Show samples: 6 pending, 2 active, 1 resolved, 1 compliant
        const sampleSystems = [
            ...categorizedSystems.pending.slice(0, 6),
            ...categorizedSystems.active.slice(0, 2),
            ...categorizedSystems.resolved.slice(0, 1),
            ...categorizedSystems.compliant.slice(0, 1)
        ];
        
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
        samplePwsids.forEach(pwsid => {
            if (waterData[pwsid]) {
                const system = waterData[pwsid];
                const div = document.createElement('div');
                div.className = 'search-result-item';
                div.textContent = `${system.PWS_NAME} (${pwsid})`;
                div.dataset.pwsid = pwsid;
                searchResults.appendChild(div);
            }
        });
    });

    searchInput.addEventListener('keyup', () => {
        const query = searchInput.value.toLowerCase().trim();
        if (!query) { // If search is empty, show samples
            searchInput.dispatchEvent(new Event('focus'));
            return;
        }
        // Filter all data for the actual search
        searchResults.innerHTML = '';
        for (const pwsid in waterData) {
            const system = waterData[pwsid];
            if ((system.PWS_NAME && system.PWS_NAME.toLowerCase().includes(query)) || pwsid.toLowerCase().includes(query)) {
                const div = document.createElement('div');
                div.className = 'search-result-item';
                div.textContent = `${system.PWS_NAME} (${pwsid})`;
                div.dataset.pwsid = pwsid;
                searchResults.appendChild(div);
            }
        }
    });

    searchResults.addEventListener('click', (e) => {
        if (e.target.classList.contains('search-result-item')) {
            const pwsid = e.target.dataset.pwsid;
            displaySystemDetails(pwsid, systemDetails);
            zoomToSystem(pwsid);
            searchResults.innerHTML = '';
            searchInput.value = '';
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

    violationSearchInput.addEventListener('keyup', () => {
        const query = violationSearchInput.value.toLowerCase().trim();
        const items = violationSearchResults.getElementsByClassName('search-result-item');
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.textContent.toLowerCase().includes(query)) {
                item.style.display = '';
            } else {
                item.style.display = 'none';
            }
        }
    });

    violationSearchResults.addEventListener('click', (e) => {
        if (e.target.classList.contains('search-result-item')) {
            const violationName = e.target.textContent;
            violationSearchInput.value = violationName;
            violationSearchResults.innerHTML = '';
            
            // Show regions with this violation type in the violation search results
            const regionsWithViolation = new Set();
            for (const pwsid in waterData) {
                const system = waterData[pwsid];
                for (const key in system.violations) {
                    const v = system.violations[key];
                    if (v.VIOLATION_NAME === violationName) {
                        // Get region info from geo_areas
                        const geoAreas = system.geo_areas || {};
                        for (const geoKey in geoAreas) {
                            const geo = geoAreas[geoKey];
                            if (geo.COUNTY_SERVED) {
                                regionsWithViolation.add(`${geo.COUNTY_SERVED} County`);
                            }
                            if (geo.CITY_SERVED) {
                                regionsWithViolation.add(`${geo.CITY_SERVED} City`);
                            }
                        }
                    }
                }
            }
            
            // Display regions in violation search results
            regionsWithViolation.forEach(region => {
                const div = document.createElement('div');
                div.className = 'search-result-item';
                div.textContent = `${region} - ${violationName}`;
                div.dataset.region = region;
                div.dataset.violation = violationName;
                violationSearchResults.appendChild(div);
            });
            
            // If no regions found, show systems directly
            if (regionsWithViolation.size === 0) {
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
                matchingSystems.forEach(pwsid => {
                    const system = waterData[pwsid];
                    const div = document.createElement('div');
                    div.className = 'search-result-item';
                    div.textContent = `${system.PWS_NAME} (${pwsid})`;
                    div.dataset.pwsid = pwsid;
                    violationSearchResults.appendChild(div);
                });
            }
        }
    });

    // Handle region selection to show systems
    violationSearchResults.addEventListener('click', (e) => {
        if (e.target.classList.contains('search-result-item') && e.target.dataset.region) {
            const region = e.target.dataset.region;
            const violationName = e.target.dataset.violation;
            
            // Find systems in this region with this violation
            const matchingSystems = new Set();
            for (const pwsid in waterData) {
                const system = waterData[pwsid];
                const geoAreas = system.geo_areas || {};
                let inRegion = false;
                
                for (const geoKey in geoAreas) {
                    const geo = geoAreas[geoKey];
                    if ((geo.COUNTY_SERVED && region.includes(geo.COUNTY_SERVED)) ||
                        (geo.CITY_SERVED && region.includes(geo.CITY_SERVED))) {
                        inRegion = true;
                        break;
                    }
                }
                
                if (inRegion) {
                    for (const key in system.violations) {
                        const v = system.violations[key];
                        if (v.VIOLATION_NAME === violationName) {
                            matchingSystems.add(pwsid);
                            break;
                        }
                    }
                }
            }
            
            // Show systems in the first search box
            searchResults.innerHTML = '';
            matchingSystems.forEach(pwsid => {
                const system = waterData[pwsid];
                const div = document.createElement('div');
                div.className = 'search-result-item';
                div.textContent = `${system.PWS_NAME} (${pwsid})`;
                div.dataset.pwsid = pwsid;
                searchResults.appendChild(div);
            });
        }
    });

    // --- Zoom to System Function ---
    function zoomToSystem(pwsid) {
        const system = waterData[pwsid];
        if (!system) return;

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

        if (coords && coords.lat && coords.lon && map) {
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

    // --- Shared Display & Messaging Logic ---
    function displaySystemDetails(pwsid, container) {
        currentPwsid = pwsid;
        const system = waterData[pwsid];
        if (!system) return;

        // Always update the main system details view
        const mainDetailsContainer = document.getElementById('system-details');

        let violationsHtml = '<h4>Violations</h4>';
        const violations = system.violations || {};
        
        // Filter out null/empty violations and "Unknown Tribe" entries
        const actualViolations = Object.values(violations)
            .filter(v => v && v.VIOLATION_ID && v.VIOLATION_NAME && v.VIOLATION_NAME !== 'Unknown Tribe');
        
        if (actualViolations.length > 0) {
            // Separate violations by status - prioritize pending/open first
            const pendingViolations = actualViolations.filter(v => !v.VIOLATION_STATUS || v.VIOLATION_STATUS === 'Unaddressed' || v.VIOLATION_STATUS === 'Open');
            const activeViolations = actualViolations.filter(v => v.VIOLATION_STATUS && v.VIOLATION_STATUS !== 'Archived' && v.VIOLATION_STATUS !== 'Resolved' && v.VIOLATION_STATUS !== 'Unaddressed' && v.VIOLATION_STATUS !== 'Open');
            const resolvedViolations = actualViolations.filter(v => v.VIOLATION_STATUS === 'Archived' || v.VIOLATION_STATUS === 'Resolved');
            
            // Show pending violations first
            if (pendingViolations.length > 0) {
                violationsHtml += '<h5 style="color: #d32f2f;">⚠️ Pending Violations (' + pendingViolations.length + ')</h5>';
                pendingViolations.forEach(v => {
                    violationsHtml += `
                        <div class="violation-item" style="border-left: 4px solid #ff5722;">
                            <div class="violation-header">${v.VIOLATION_NAME || 'Unknown Violation'} (${v.VIOLATION_CODE || 'N/A'})</div>
                            <p><strong>Contaminant:</strong> ${v.CONTAMINANT_NAME || v.CONTAMINANT_CODE || 'N/A'}</p>
                            <p><strong>Period:</strong> ${v.NON_COMPL_PER_BEGIN_DATE || ''} to ${v.NON_COMPL_PER_END_DATE || 'Present'}</p>
                            <p><strong>Status:</strong> <span style="color: #ff5722; font-weight: bold;">${v.VIOLATION_STATUS || 'Pending'}</span></p>
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
            
            if (activeViolations.length > 0) {
                violationsHtml += '<h5 style="color: #d32f2f;">Active Violations (' + activeViolations.length + ')</h5>';
                activeViolations.forEach(v => {
                    violationsHtml += `
                        <div class="violation-item" style="border-left: 4px solid #d32f2f;">
                            <div class="violation-header">${v.VIOLATION_NAME || 'Unknown Violation'} (${v.VIOLATION_CODE || 'N/A'})</div>
                            <p><strong>Contaminant:</strong> ${v.CONTAMINANT_NAME || v.CONTAMINANT_CODE || 'N/A'}</p>
                            <p><strong>Period:</strong> ${v.NON_COMPL_PER_BEGIN_DATE || ''} to ${v.NON_COMPL_PER_END_DATE || 'Present'}</p>
                            <p><strong>Status:</strong> <span style="color: #d32f2f; font-weight: bold;">${v.VIOLATION_STATUS || 'Active'}</span></p>
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
            
            if (resolvedViolations.length > 0) {
                violationsHtml += '<h5 style="color: #666;">Resolved Violations (' + resolvedViolations.length + ')</h5>';
                resolvedViolations.slice(0, 3).forEach(v => {
                    violationsHtml += `
                        <div class="violation-item" style="border-left: 4px solid #4caf50; opacity: 0.7;">
                            <div class="violation-header" style="color: #666;">${v.VIOLATION_NAME || 'Unknown Violation'} (${v.VIOLATION_CODE || 'N/A'})</div>
                            <p><strong>Period:</strong> ${v.NON_COMPL_PER_BEGIN_DATE || ''} to ${v.NON_COMPL_PER_END_DATE || 'N/A'}</p>
                            <p><strong>Status:</strong> <span style="color: #4caf50; font-weight: bold;">${v.VIOLATION_STATUS || 'Resolved'}</span></p>
                        </div>`;
                });
                if (resolvedViolations.length > 3) {
                    violationsHtml += `<p style="color: #666; font-style: italic;">... and ${resolvedViolations.length - 3} more resolved violations</p>`;
                }
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

        for (const key in system.violations) {
            const v = system.violations[key];
            if (v && v.VIOLATION_ID) { // Check if violation and its ID exist
                const messagesContainer = document.getElementById(`messages-${v.VIOLATION_ID}`);
                if (messagesContainer) {
                    messagesContainer.innerHTML = ''; // Clear previous messages
                    gun.get('messages').get(v.VIOLATION_ID).map().on((message) => {
                        if (message) displayMessage(messagesContainer, message);
                    });
                }
            }
        }
    }

    function sendMessage(e) {
        const violationId = e.target.dataset.violationId;
        const input = document.getElementById(`msg-input-${violationId}`);
        if (input.value.trim() && violationId) {
            gun.get('messages').get(violationId).set({
                text: input.value.trim(),
                timestamp: new Date().toISOString(),
                sender: 'User' // This could be enhanced with roles
            });
            input.value = '';
        }
    }

    function displayMessage(container, message) {
        if (!container || !message || !message.timestamp) return;
        const existingMsg = document.getElementById(message.timestamp);
        if (existingMsg) return; // Prevent duplicates
        const messageEl = document.createElement('div');
        messageEl.className = 'message-item';
        messageEl.id = message.timestamp;
        messageEl.innerHTML = `<strong>${message.sender}</strong> <small>(${new Date(message.timestamp).toLocaleString()})</small><p>${message.text}</p>`;
        container.appendChild(messageEl);
        container.scrollTop = container.scrollHeight;
    }

    // --- Chatbot Logic ---
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
            // Simplified rendering for now, can add back thought process later if needed
            messageWrapper.innerHTML = marked.parse(text);
        } else {
            messageWrapper.textContent = text;
        }
        chatHistory.appendChild(messageWrapper);
        chatHistory.scrollTop = chatHistory.scrollHeight;
        return messageWrapper;
    }

    // --- Task Management Logic ---
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

    // --- Map Logic ---
    let markerLayer; // To hold all the pins

    const greenIcon = new L.Icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });

    const redIcon = new L.Icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });

    function initializeMap() {
        if (map) { // If map already exists, remove it to re-initialize
            map.remove();
        }
        map = L.map('map').setView([32.9866, -83.6479], 7);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
        }).addTo(map);
        markerLayer = L.layerGroup().addTo(map);
    }

    function plotAllSystems() {
        if (markerLayer) {
            markerLayer.clearLayers();
        }
        for (const pwsid in waterData) {
            const system = waterData[pwsid];
            
            // Try to get coordinates from geo_areas
            let coords = null;
            const geoAreas = system.geo_areas || {};
            
            // Look for ZIP_CODE_SERVED in any geo area
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
            
            // If no ZIP found, try using the system's ZIP_CODE
            if (!coords && system.ZIP_CODE) {
                const zip = String(system.ZIP_CODE).trim().substring(0, 5);
                if (zipCodeData[zip]) {
                    coords = zipCodeData[zip];
                }
            }

            if (coords && coords.lat && coords.lon) {
                // Count actual violations (filter out null/empty violations and Unknown Tribe)
                const actualViolations = Object.values(system.violations || {})
                    .filter(v => v && v.VIOLATION_ID && v.VIOLATION_NAME && v.VIOLATION_NAME !== 'Unknown Tribe');
                const activeViolations = actualViolations.filter(v => v.VIOLATION_STATUS !== 'Archived' && v.VIOLATION_STATUS !== 'Resolved');
                const violationCount = activeViolations.length;
                
                // Apply filters
                const hasViolations = violationCount > 0;
                const isCompliant = violationCount === 0;
                
                if ((showViolationsOnly && !hasViolations) || (!showCompliant && isCompliant)) {
                    continue; // Skip this system based on filters
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
        console.log(`Plotted ${markerLayer.getLayers().length} water systems on the map`);
    }

    // --- UI Logic for Tabs and Search Hiding ---
    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            tabContents.forEach(content => {
                content.classList.add('hidden');
            });
            document.getElementById(tab.dataset.tab).classList.remove('hidden');
        });
    });

    document.addEventListener('click', (e) => {
        if (!searchResults.contains(e.target) && e.target !== searchInput) {
            searchResults.innerHTML = '';
        }
        if (!violationSearchResults.contains(e.target) && e.target !== violationSearchInput) {
            violationSearchResults.innerHTML = '';
        }
    });

    // --- Load initial data when the app starts ---
    loadData();
});