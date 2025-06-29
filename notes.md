# 🚀 Speed Trials Hackathon - Winning Strategy (v2)

**PIVOT:** New direction as of 1:02 PM.

## 1. Core Mission

**Focus on the Regulator-Operator communication gap.** We will build a real-time "Compliance Hub" that allows regulators and water system operators to communicate and track tasks directly, using a decentralized `gun.js` backend.

## 2. Key Features (Our "Big Swing")

*   **Real-Time Tasking:** A regulator can view a water system, see its violations, and assign a task or send a message related to a specific violation (e.g., "Provide update on MCL violation #123").
*   **Instant Sync:** The operator for that system sees the message/task instantly without a page refresh, powered by `gun.js`.
*   **Decentralized Log:** All communication is part of a decentralized, tamper-resistant log associated with the water system, creating a clear audit trail.
*   **Simple Views:**
    *   **Operator Dashboard:** Shows a list of their systems and any open violations or messages from regulators.
    *   **Regulator "Field Kit":** A view to quickly look up any water system and see its live compliance status and communication history.

## 3. Tech Stack (Real-Time & Decentralized)

*   **Data Ingestion:** Python (`pandas`) to convert the initial CSV data into a single `data.json` file. **This will be run in a virtual environment.**
*   **Backend/DB:** `Node.js` with `gun.js` for real-time, decentralized data storage and synchronization. We'll use `express` to serve the app.
*   **Frontend:** Vanilla HTML, CSS, and JavaScript.

## 4. The 5-Hour Game Plan

*   **Hour 1 (Setup & Data Conversion):**
    *   [ ] Create a Python virtual environment.
    *   [ ] Install `pandas` within the venv.
    *   [ ] Modify `ingest_data.py` to output `data.json`.
    *   [ ] Run the script to generate the JSON data.
    *   [ ] Set up a `Node.js` project (`npm init -y`) and install `express` and `gun`.
*   **Hours 2-3 (Core Application):**
    *   [ ] Build the `Node.js`/`express` server.
    *   [ ] Write a script to load `data.json` into the `gun` graph on startup.
    *   [ ] Create the basic HTML/CSS/JS frontend for the Operator and Regulator views.
*   **Hour 4 (Real-Time Magic):**
    *   [ ] Implement the real-time messaging/tasking feature between regulators and operators using `gun.js`.
*   **Hour 5 (Polish & Ship):**
    *   [ ] Refine UI/UX.
    *   [ ] Final testing.
    *   [ ] Record 2-min video highlighting the real-time collaboration.
    *   [ ] Set up `ngrok` and submit.

## 5. Deployment Instructions

This application has a Node.js backend, which means it cannot be deployed to a static hosting service like GitHub Pages without significant changes. The best option for easy deployment is Vercel.

### Deploying to Vercel (Recommended)

Vercel is a platform for hosting web applications that supports Node.js backends out of the box.

**Steps:**

1.  **Push to GitHub:** Make sure all your latest code is pushed to a GitHub repository.
2.  **Sign up for Vercel:** Create a free account at [vercel.com](https://vercel.com) using your GitHub account.
3.  **Import Project:**
    *   On your Vercel dashboard, click "Add New..." -> "Project".
    *   Select your GitHub repository.
4.  **Configure Project:**
    *   Vercel should automatically detect that you are using Node.js and configure the build settings correctly.
    *   **IMPORTANT:** You must add your `FIREWORKS_API_KEY` as an environment variable. Go to the "Settings" tab of your new Vercel project, find "Environment Variables", and add a new variable with the name `FIREWORKS_API_KEY` and the value of your actual key.
5.  **Deploy:** Click the "Deploy" button. Vercel will build and deploy your application. You will be given a public URL once it's finished.

### Why Not GitHub Pages?

GitHub Pages is designed for **static websites** (HTML, CSS, client-side JavaScript). It does not run server-side code, so it cannot run the `Node.js` server (`server.js`) that powers the chatbot API and the `gun.js` backend.