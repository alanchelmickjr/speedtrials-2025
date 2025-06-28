# Georgia Water Compliance Hub

A comprehensive real-time communication platform for water system compliance management, connecting regulators and operators to ensure public water safety across Georgia.

## 🌊 Overview

The Georgia Water Compliance Hub is a full-stack web application designed to streamline communication and task management between water system regulators and operators. Built during the Codegen Speed Trials 2025, this platform demonstrates how modern web technologies can solve real-world public health challenges.

## ✨ Key Features

### 🗺️ **Interactive Compliance Map**
- Real-time visualization of water systems across Georgia
- Color-coded violation indicators with badge counts
- Expandable map view with ESC key support
- Geographic filtering by regions and violation types

### 👥 **Dual-Role Interface**
- **Regulator View**: Field kit for compliance monitoring and violation management
- **Operator View**: Dashboard for task management and system oversight
- Role-specific workflows and data access

### 💬 **Real-Time Communication**
- Violation-specific messaging threads
- Task creation and assignment system
- Live updates using Gun.js peer-to-peer database
- Message persistence across sessions

### 🤖 **AI Compliance Assistant**
- Context-aware chatbot with access to system data, tasks, and messages
- Hybrid RAG (Retrieval-Augmented Generation) implementation
- Direct, actionable responses without thinking process exposure
- System-specific guidance and recommendations

### 📊 **Analytics Dashboard**
- Interactive charts showing compliance trends
- Filterable data by region and violation type
- Bar charts for regional violation distribution
- Pie charts for violation type analysis
- Line charts for compliance trends over time

### 🌐 **Public Transparency**
- Public-facing map showing only violation systems
- Tabular data display for system information
- No edit controls for public safety

### ⚡ **Advanced Functionality**
- Regulator violation resolution workflow
- Real-time map filtering and search
- Responsive design for mobile and desktop
- Persistent data storage with Gun.js

## 🛠️ Technology Stack

### Frontend
- **HTML5/CSS3**: Modern responsive design
- **JavaScript (ES6+)**: Client-side functionality
- **Leaflet.js**: Interactive mapping
- **Chart.js**: Data visualization
- **Marked.js**: Markdown rendering for AI responses

### Backend
- **Node.js**: Server runtime
- **Express.js**: Web framework
- **Gun.js**: Real-time peer-to-peer database
- **OpenAI API**: AI assistant integration

### Data
- **Georgia EPA Water Data**: Real compliance violation data
- **ZIP Code Geocoding**: Geographic positioning
- **Real-time Messaging**: Persistent communication threads

## 🚀 Installation & Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-repo/georgia-water-compliance-hub
   cd georgia-water-compliance-hub
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Add your OpenAI API key to .env
   ```

4. **Start the server**
   ```bash
   npm start
   ```

5. **Access the application**
   - Main Dashboard: `http://localhost:3000`
   - Public Map: `http://localhost:3000/public.html`
   - Analytics: `http://localhost:3000/analytics.html`

## 📱 Usage Guide

### For Regulators
1. Use the **Regulator** tab to access field tools
2. Search by region or violation type to filter systems
3. Click map pins to view detailed violation information
4. Create tasks and send messages for specific violations
5. Mark violations as resolved when compliance is achieved

### For Operators
1. Switch to the **Operator** tab
2. Enter your PWSID to access your system dashboard
3. View assigned tasks and violation details
4. Communicate with regulators through message threads
5. Track compliance status and resolution progress

### For the Public
1. Visit the Public Map page for transparency
2. View systems with active violations
3. Access detailed violation information in tabular format
4. No login required for public access

## 🎯 Real-World Applications

This platform addresses critical needs in water system compliance:

- **Regulatory Efficiency**: Streamlines communication between agencies and operators
- **Public Safety**: Ensures rapid response to water quality violations
- **Transparency**: Provides public access to compliance information
- **Data-Driven Decisions**: Analytics support policy and resource allocation
- **Mobile Accessibility**: Field-ready interface for on-site inspections

## 🏆 Competition Highlights

Built for the **Codegen Speed Trials 2025**, this project demonstrates:
- Rapid full-stack development under time constraints
- Integration of multiple complex technologies
- Real-world problem solving with practical solutions
- Scalable architecture for production deployment

## 👨‍💻 Development Team

- **Alan Helmick** - Project Lead & Full-Stack Development
- **Claude (Anthropic)** - AI Development Assistant & Code Generation

## 🔮 Future Enhancements

- Mobile app development for field inspections
- Integration with state EPA databases
- Automated violation detection and alerts
- Advanced analytics and predictive modeling
- Multi-state expansion capabilities

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

We welcome contributions to improve water safety technology! Please read our contributing guidelines and submit pull requests for review.

## 📞 Contact

For questions about this project or potential collaboration opportunities, please reach out through the repository issues or contact the development team directly.

---

*Built with ❤️ for public water safety during Codegen Speed Trials 2025*