document.addEventListener('DOMContentLoaded', () => {
    // Connect to the Gun instance on the server
    const gun = Gun(location.origin + '/gun');
    console.log('Connected to Gun relay peer.');

    // --- Global variables ---
    let waterData = {};
    let zipCodeData = {};
    let map;
    let currentPwsid = null; // To track the currently viewed system for context

    // --- DOM Elements ---
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    const violationSearchInput = document.getElementById('violation-search-input');
    const violationSearchResults = document.getElementById('violation-search-results');
    const systemDetails = document.getElementById('system-details');
    const operatorPwsidInput = document.getElementById('operator-pwsid-input');
    const operatorSearchResults = document.getElementById('operator-search-results');
    const loadOperatorDashboardBtn = document.getElementById('load-operator-dashboard');
    const operatorDetails = document.getElementById('operator-details');
    const taskList = document.getElementById('task-list');
    const chatHistory = document.getElementById('chat-history');
    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send-btn');

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

    // --- Regulator View Logic ---
    const samplePwsids = ['GA0170001', 'GA0280000', 'GA1130001', 'GA1210001', 'GA1350002'];

    operatorPwsidInput.addEventListener('focus', () => {
        operatorSearchResults.innerHTML = '';
        const systemsWithViolations = [];
        for (const pwsid in waterData) {
            if (waterData[pwsid].violations && Object.keys(waterData[pwsid].violations).length > 0) {
                systemsWithViolations.push(pwsid);
            }
        }
        const sampleViolations = systemsWithViolations.slice(0, 10);
        sampleViolations.forEach(pwsid => {
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
            loadOperatorDashboardBtn.click();
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
                if (v.VIOLATION_NAME) {
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
        }
    });

    // --- Operator View Logic ---
    loadOperatorDashboardBtn.addEventListener('click', () => {
        const pwsid = operatorPwsidInput.value.trim();
        if (pwsid && waterData[pwsid]) {
            displaySystemDetails(pwsid, operatorDetails); // Display in the correct container
            loadTasks(pwsid); // Also load tasks for the operator
        } else {
            systemDetails.innerHTML = `<p>System with PWSID ${pwsid} not found.</p>`;
            operatorDetails.innerHTML = '';
        }
    });

    // --- Shared Display & Messaging Logic ---
    function displaySystemDetails(pwsid, container) {
        currentPwsid = pwsid;
        const system = waterData[pwsid];
        if (!system) return;

        // Always update the main system details view
        const mainDetailsContainer = document.getElementById('system-details');

        const geo = Object.values(system.geo_areas)[0];
        if (geo?.ZIP_CODE_SERVED) {
            const zip = geo.ZIP_CODE_SERVED.substring(0, 5);
            const coords = zipCodeData[zip];
            if (coords && map) {
                map.setView([parseFloat(coords.lat), parseFloat(coords.lon)], 15);
            }
        }

        let violationsHtml = '<h4>Violations</h4>';
        const violations = system.violations || {};
        if (Object.keys(violations).length > 0) {
            for (const key in violations) {
                const v = violations[key];
                violationsHtml += `
                    <div class="violation-item">
                        <div class="violation-header">${v.VIOLATION_NAME || 'Unknown Violation'} (${v.VIOLATION_CODE})</div>
                        <p><strong>Contaminant:</strong> ${v.CONTAMINANT_NAME || v.CONTAMINANT_CODE || 'N/A'}</p>
                        <p><strong>Period:</strong> ${v.NON_COMPL_PER_BEGIN_DATE || ''} to ${v.NON_COMPL_PER_END_DATE || 'Present'}</p>
                        <p><strong>Status:</strong> ${v.VIOLATION_STATUS || ''}</p>
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
            }
        } else {
            violationsHtml += '<p>No violations on record. System is in compliance.</p>';
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
        const finalMessage = `${context}\n\nUser Question: "${userMessage}"`;

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
                const chunks = value.split('\n\n');
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
            const geo = Object.values(system.geo_areas)[0];
            if (geo && geo.ZIP_CODE_SERVED) {
                const zip = String(geo.ZIP_CODE_SERVED).trim().substring(0, 5);
                const coords = zipCodeData[zip];

                if (coords && coords.lat && coords.lon) {
                    const violationCount = Object.keys(system.violations || {}).length;
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

                    const popupContent = `<b>${system.PWS_NAME}</b><br>${violationCount > 0 ? violationCount + ' violation(s).' : 'In compliance.'}`;
                    const marker = L.marker([parseFloat(coords.lat), parseFloat(coords.lon)], { icon: icon })
                        .bindPopup(popupContent)
                        .on('click', () => {
                            displaySystemDetails(pwsid, systemDetails);
                            map.setView([parseFloat(coords.lat), parseFloat(coords.lon)], 15);
                        });
                    markerLayer.addLayer(marker);
                }
            }
        }
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