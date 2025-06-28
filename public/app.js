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

        // Search the in-memory waterData object
        for (const pwsid in waterData) {
            const system = waterData[pwsid];
            if (system) {
                const name = system.PWS_NAME || '';
                if (name.toLowerCase().includes(query) || pwsid.toLowerCase().includes(query)) {
                    const div = document.createElement('div');
                    div.className = 'search-result-item';
                    div.textContent = `${name} (${pwsid})`;
                    div.dataset.pwsid = pwsid;
                    searchResults.appendChild(div);
                }
            }
        }
    });

    searchResults.addEventListener('click', (e) => {
        if (e.target && e.target.classList.contains('search-result-item')) {
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
                if (v.VIOLATION_NAME && v.VIOLATION_NAME.toLowerCase().includes(query)) {
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
        if (e.target && e.target.classList.contains('search-result-item')) {
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
        currentPwsid = pwsid; // Set the current system for context
        const system = waterData[pwsid];
        if (!system) return;

        let violationsHtml = '<h4>Violations</h4>';
        const violations = system.violations || {};
        if (Object.keys(violations).length > 0) {
            for (const key in violations) {
                const v = violations[key];
                violationsHtml += `
                    <div class="violation-item">
                        <div class="violation-header">${v.VIOLATION_NAME || 'Unknown Violation'} (${v.VIOLATION_CODE})</div>
                        <p><strong>Contaminant:</strong> ${v.CONTAMINANT_NAME || v.CONTAMINANT_CODE || 'N/A'}</p>
                        <p><strong>Period:</strong> ${v.NON_COMPL_PER_BEGIN_DATE} to ${v.NON_COMPL_PER_END_DATE || 'Present'}</p>
                        <p><strong>Status:</strong> ${v.VIOLATION_STATUS}</p>
                        <div class="messages-container" id="messages-${v.VIOLATION_ID}"></div>
                        <div class="message-input">
                            <input type="text" id="msg-input-${v.VIOLATION_ID}" placeholder="Type message...">
                            <button class="send-btn" data-violation-id="${v.VIOLATION_ID}">Send</button>
                        </div>
                    </div>
                `;
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
            ${violationsHtml}
        `;

        attachMessageListeners(system);
    }

    function attachMessageListeners(system) {
        document.querySelectorAll('.send-btn').forEach(button => {
            button.onclick = sendMessage;
        });

        const violations = system.violations || {};
        for (const key in violations) {
            const v = violations[key];
            const violationId = v.VIOLATION_ID;
            const messagesContainer = document.getElementById(`messages-${violationId}`);
            
            // Listen for messages on this violation's node
            gun.get('messages').get(violationId).map().on((message, id) => {
                if (message) {
                    displayMessage(messagesContainer, message);
                }
            });
        }
    }

    function sendMessage(e) {
        const violationId = e.target.dataset.violationId;
        const input = document.getElementById(`msg-input-${violationId}`);
        const messageText = input.value.trim();

        if (messageText && violationId) {
            const message = {
                text: messageText,
                timestamp: new Date().toISOString(),
                sender: 'User' // Simplified for demo
            };
            gun.get('messages').get(violationId).set(message);
            input.value = '';
        }
    }

    function displayMessage(container, message) {
        if (!container || !message) return;
        
        // Avoid duplicate messages
        const existingMsg = document.getElementById(message.timestamp);
        if(existingMsg) return;

        const messageEl = document.createElement('div');
        messageEl.className = 'message-item';
        messageEl.id = message.timestamp; // Use timestamp as a unique ID
        
        const sentTime = new Date(message.timestamp).toLocaleString();
        messageEl.innerHTML = `
            <strong>${message.sender}</strong> <small>(${sentTime})</small>:
            <p>${message.text}</p>
        `;
        container.appendChild(messageEl);
        container.scrollTop = container.scrollHeight;
    }

    // --- Chatbot Logic ---
    const chatHistory = document.getElementById('chat-history');
    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send-btn');

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

        // --- Hybrid RAG: Build the context ---
        let context = "You are a helpful AI assistant for water system compliance. ";
        if (currentPwsid && waterData[currentPwsid]) {
            const system = waterData[currentPwsid];
            // Sanitize and simplify the context to send to the AI
            const systemContext = {
                name: system.PWS_NAME,
                id: system.PWSID,
                population: system.POPULATION_SERVED_COUNT,
                violations: Object.values(system.violations || {}).map(v => ({
                    name: v.VIOLATION_NAME,
                    contaminant: v.CONTAMINANT_NAME,
                    status: v.VIOLATION_STATUS
                }))
            };
            context += `The user is currently viewing the following water system: ${JSON.stringify(systemContext)}. Please use this information to answer their question.`;
        }
        
        const finalMessage = `${context}\n\nUser Question: "${userMessage}"`;
        
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: finalMessage }),
            });

            if (!response.body) return;

            const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
            let aiResponseContainer = appendMessage('', 'ai');
            
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                
                // Process Server-Sent Events
                const chunks = value.split('\n\n');
                for (const chunk of chunks) {
                    if (chunk.startsWith('data: ')) {
                        const jsonStr = chunk.substring(6);
                        if (jsonStr.trim()) {
                            const data = JSON.parse(jsonStr);
                            aiResponseContainer.textContent += data.text;
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
        messageWrapper.textContent = text;
        chatHistory.appendChild(messageWrapper);
        chatHistory.scrollTop = chatHistory.scrollHeight;
        return messageWrapper;
    }



    // --- Map Logic ---
    function initializeMap() {
        map = L.map('map').setView([32.9866, -83.6479], 7); // Centered on Georgia
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
        }).addTo(map);
    }

    function plotAllViolations() {
        for (const pwsid in waterData) {
            const system = waterData[pwsid];
            if (Object.keys(system.violations).length > 0) {
                const geo = Object.values(system.geo_areas)[0]; // Use first available geo area
                if (geo && geo.ZIP_CODE_SERVED) {
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

    // --- Load initial data when the app starts ---
    loadData();
});