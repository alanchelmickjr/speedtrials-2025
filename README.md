# 🍑 Georgia Water Compliance Hub

![Georgia State Capitol](public/georgia/georgiastatecapital.tiff)
*The Georgia State Capitol*

![Georgia State Seal](public/georgia/891-004-1A660847.jpg.webp)

## Our Solution

We have built the **Georgia Water Compliance Hub**, a real-time platform designed to empower the public, water system operators, and regulators to monitor and address drinking water quality issues across the state.

### Key Features:

*   **Interactive Map:** A comprehensive, color-coded map of all public water systems in Georgia. Systems with active violations are marked in red, while compliant systems are green. Each pin is interactive, providing detailed information on click.
*   **Violation Badges:** Systems with violations display a badge with the total number of active issues, allowing for at-a-glance identification of problem areas.
*   **Real-Time Messaging:** A live messaging system for each violation, enabling direct communication between operators and regulators to coordinate and resolve issues.
*   **AI-Powered Assistant:** An integrated AI chatbot that provides context-aware answers to questions about water systems, violations, and regulations.
*   **Dedicated Dashboards:** Separate, tailored views for the public, operators, and regulators, providing the most relevant information and tools for each user group.

Our solution directly addresses the challenges outlined in the Georgia Environmental Protection Division's Request for Information by transforming raw, complex data into an accessible, actionable, and collaborative platform.

---

# 🏁 Codegen Speed Trials - Challenge Repo 

**🚰 What's in our public drinking water? Turn Georgia's cryptic water quality data into something the public, operators, and regulators can actually use.**

American's [top environmental concern](https://news.gallup.com/poll/643850/seven-key-gallup-findings-environment-earth-day.aspx) is pollution in their drinking water. The EPA publishes [national drinking water data](https://www.epa.gov/ground-water-and-drinking-water/safe-drinking-water-information-system-sdwis-federal-reporting), but it's difficult to interpret, especially for the public or under-resourced rural water systems.

To give you a feel for existing solutions, here's the state of Georgia's official drinker water viewer:

<img width="900" alt="Screenshot 2025-06-27 at 8 30 45 PM" src="https://github.com/user-attachments/assets/d8f7c9e9-a146-4a8f-b6c7-fed8d634ca2c" />


**✨ The good news:** the Georgia Environmental Protection Division knows the public deserves better! Three weeks ago, they published a [Request for Information](https://drive.google.com/file/d/13VkRTJhGJcF9FmgrXs-j4PZzI3jepFvq/view?usp=sharing) to overhaul the whole thing.

**✅ Your task:** Set the water data free. Build a product that ingests real-world raw water quality data and empowers the public and water systems operators to interpret and act on it.

## 🗂️ What We're Giving You

In the [data](data/) directory, you'll find a raw export of the public Georgia water system data from SDWIS along with a README packed with helpful context and links. Feel free to augment! 

The Georgia RFP wants solutions for three primary stakeholders:

1. **The Public:** Make it easier for Georgia residents to understand the safety of their drinking water. You could help them better understand what violations mean, the health implications of different contaminants, or take action to stay up-to-date on their local water system. 
2. **The Operators:** Help water system operators view information on their system, track notices from regulators, and take action on compliance tasks. 
3. **The Regulators:** A field kit allowing them to quickly understand the live status of a water system on-the-go on site visits or in meetings. They'll need to drill down into specifics, but high level summaries are helpful too! 

## Getting Started

1. **Fork**
   - Fork this repository, you'll include a link to your fork in your submission.
3. **Explore:**
   - Look through the [data directory](data/) to understand structure and patterns.
   - Ingest the raw data into a clean, queryable database.
   - Feel free to augment with any additional data you need (e.g. geographic data for mapping)
4. **Create:**
   - Take [Georgia's current offering](https://gadrinkingwater.net/DWWPUB/) out of the 2000s.
   - You can build for the Public, the Operators, the Regulators (or all three!).
1. **Submit:** Instructions below.

## Implementation Requirements

- **Don't sweat hosting:** You can build the whole thing locally and share a live link via [ngrok tunnel](https://ngrok.com/our-product/secure-tunnels) (or similar) to your localhost:

   ```shell
   brew install ngrok
   # If you don't have one, sign up for a free ngrok account at https://ngrok.com
   ngrok config add-authtoken <your-ngrok-auth-token>
   ngrok http http://localhost:<your-local-server-port>
   ```
- **BYO stack:** As long as you follow the submission instructions, you can take any approach you want — any libraries, any DB, any interface. We will be rewarding bold swings!  


## ⚖️ Judging

Unlike traditional hackathons, the Codegen Speed Trials aren't just about what you build, they're about how you build it. We'll reward participants who take the challenge the furthest, but we're equally excited to celebrate innovative collaborations with AI.

​Projects will be scored across four categories:

1. **Core Delivery:** Does your submission preserve and accurately represent the data provided?
2. **Impact and Relevance:** Does your submission improve on [Georgia's exising solution](https://gadrinkingwater.net/DWWPUB/) for the public, water system operators, regulators (or multiple)?
3. **Ambition and Scope:** Did you take a big, creative swing at the problem? How far beyond the baseline did you dare to go?
4. **Iron Man Score:** Did you make creative use of AI tools and agents to get the challenge done?

We have $1000s in cash and credit prizes to award for winning submissions, and are excited to see what you build!

## 📤 Submission Instructions

**Submissions are due by 5 PM. [Use this link to submit.](https://cerebralvalley.ai/e/codegen-speedtrials-2025/hackathon/submit)**

Include the following with your submission:

1. A public link to your forked Github repo
2. 3. A link to a short (< 2 min) video explaining your submission and the tools + approaches you used to build it. We want to hear details on how you accelerated your work using AI!
3. A link via [ngrok tunnel](https://ngrok.com/our-product/secure-tunnels) (or similar) to your localhost:

   **Important:** your tunnel will need to remain accessible throughout the entire judging period, which runs from 5-7P PT.

---

Good luck!
