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
            plotAllViolations();

        } catch (e) {
            console.error("Failed to load or parse data:", e);
            systemDetails.innerHTML = "<p>Error: Could not load initial data.</p>";
        }
    }

    // --- Regulator View Logic ---
    searchInput.addEventListener('keyup', () => {
        const query = searchInput.value.toLowerCase().trim();
        searchResults.innerHTML = '';
        if (query.length < 3) return;
        for (const pwsid in waterData) {
            const system = waterData[pwsid];
            if (system && (system.PWS_NAME?.toLowerCase().includes(query) || pwsid.toLowerCase().includes(query))) {
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

    violationSearchInput.addEventListener('keyup', () => {
        const query = violationSearchInput.value.toLowerCase().trim();
        violationSearchResults.innerHTML = '';
        if (query.length < 4) return;
        const matchingSystems = new Set();
        for (const pwsid in waterData) {
            const system = waterData[pwsid];
            for (const key in system.violations) {
                const v = system.violations[key];
                if (v.VIOLATION_NAME?.toLowerCase().includes(query)) {
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
    });

    violationSearchResults.addEventListener('click', (e) => {
        if (e.target.classList.contains('search-result-item')) {
            const pwsid = e.target.dataset.pwsid;
            displaySystemDetails(pwsid, systemDetails);
            violationSearchResults.innerHTML = '';
            violationSearchInput.value = '';
        }
    });

    // --- Operator View Logic ---
    loadOperatorDashboardBtn.addEventListener('click', () => {
        const pwsid = operatorPwsidInput.value.trim();
        if (pwsid && waterData[pwsid]) {
            displaySystemDetails(pwsid, operatorDetails);
        } else {
            operatorDetails.innerHTML = `<p>System with PWSID ${pwsid} not found.</p>`;
        }
    });

    // --- Shared Display & Messaging Logic ---
    function displaySystemDetails(pwsid, container) {
        currentPwsid = pwsid;
        const system = waterData[pwsid];
        if (!system) return;

        const geo = Object.values(system.geo_areas)[0];
        if (geo?.ZIP_CODE_SERVED) {
            const zip = geo.ZIP_CODE_SERVED.substring(0, 5);
            const coords = zipCodeData[zip];
            if (coords && map) {
                map.setView([coords.lat, coords.lon], 13);
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

        container.innerHTML = `
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
            const messagesContainer = document.getElementById(`messages-${v.VIOLATION_ID}`);
            gun.get('messages').get(v.VIOLATION_ID).map().on((message) => {
                if (message) displayMessage(messagesContainer, message);
            });
        }
        if (taskList) loadTasks(system.PWSID);
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
        if (!container || !message) return;
        const existingMsg = document.getElementById(message.timestamp);
        if (existingMsg) return;
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
            const parts = text.split('</think>');
            if (parts.length > 1) {
                const thinking = parts[0].replace('<think>', '');
                const mainResponse = parts[1];
                messageWrapper.innerHTML = `<details><summary>Show Thought Process</summary><div class="thought-process">${marked.parse(thinking)}</div></details>${marked.parse(mainResponse)}`;
            } else {
                messageWrapper.innerHTML = marked.parse(text);
            }
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
        taskList.innerHTML = '';
        gun.get('tasks').get(pwsid).map().on((task) => {
            if (task) displayTask(task);
        });
    }

    function displayTask(task) {
        const existingTask = document.getElementById(task.id);
        if (existingTask) existingTask.remove();
        const taskEl = document.createElement('div');
        taskEl.className = 'task-item';
        taskEl.id = task.id;
        taskEl.innerHTML = `<p><strong>Task:</strong> ${task.text}</p><p><strong>Status:</strong> ${task.status}</p><p><small>Violation ID: ${task.violationId}</small></p>`;
        taskList.prepend(taskEl);
    }

    // --- Map Logic ---
    function initializeMap() {
        map = L.map('map').setView([32.9866, -83.6479], 7);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
        }).addTo(map);
    }

    function plotAllViolations() {
        for (const pwsid in waterData) {
            const system = waterData[pwsid];
            if (Object.keys(system.violations).length > 0) {
                const geo = Object.values(system.geo_areas)[0];
                if (geo?.ZIP_CODE_SERVED) {
                    const zip = geo.ZIP_CODE_SERVED.substring(0, 5);
                    const coords = zipCodeData[zip];
                    if (coords) {
                        L.marker([coords.lat, coords.lon])
                            .addTo(map)
                            .bindPopup(`<b>${system.PWS_NAME}</b><br>${Object.keys(system.violations).length} violation(s).`)
                            .on('click', () => displaySystemDetails(pwsid, systemDetails));
                    }
                }
            }
        }
    }

    // --- UI Logic for Collapsible Panels ---
    document.querySelectorAll('.view-header').forEach(header => {
        header.addEventListener('click', () => {
            const targetId = header.dataset.target;
            const content = document.getElementById(targetId);
            const viewSection = content.closest('.view-section');

            // Toggle all sections first
            document.querySelectorAll('.view-section').forEach(section => {
                if (section !== viewSection) {
                    section.classList.add('collapsed');
                }
            });

            // Then toggle the clicked section
            viewSection.classList.toggle('collapsed');
        });
    });

    // --- Load initial data when the app starts ---
    loadData();
});