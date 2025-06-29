const express = require('express');
const Gun = require('gun');
const path = require('path');
const OpenAI = require('openai');

const app = express();
const port = process.env.PORT || 3013;

// --- AI Provider Setup ---
const fireworks = new OpenAI({
  apiKey: process.env.FIREWORKS_API_KEY || 'fw_3ZaHC8mMnw9W8ZtQ5PHLox2m',
  baseURL: 'https://api.fireworks.ai/inference/v1',
});


// Middleware to parse JSON bodies
app.use(express.json());

// Serve the 'public' directory for frontend files
app.use(express.static('public'));

// Add a route to specifically serve the data.json file
app.get('/data.json', (req, res) => {
    res.sendFile(path.join(__dirname, 'data.json'));
});

app.get('/zip_codes.json', (req, res) => {
    res.sendFile(path.join(__dirname, 'zip_codes.json'));
});

// --- Modular Chatbot API Endpoint ---
app.post('/api/chat', async (req, res) => {
    const { message } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        const stream = await fireworks.chat.completions.create({
            model: 'accounts/fireworks/models/deepseek-r1-0528',
            messages: [{ role: 'user', content: message }],
            stream: true,
        });
        for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content || '';
            if (text) {
                res.write(`data: ${JSON.stringify({ text })}\n\n`);
            }
        }
    } catch (error) {
        console.error(`Error with fireworks API:`, error);
        res.status(500).json({ error: `Failed to get response from fireworks` });
    } finally {
        res.end();
    }
});


app.use(Gun.serve);

const server = app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
  console.log('Gun relay peer started. Waiting for client connections.');
});

// Initialize Gun and attach it to the server.
// The server now only acts as a relay peer.
Gun({ web: server });