# RBS' Planning Poker

Lightweight online *Planning Poker* for agile teams.  
No accounts, no heavy SPA — just fast joins, real-time updates, and a clean UI.

**Live:** https://planning-poker.at/

## What it does
- Create or join a room via link and start voting in seconds
- Host controls (reveal, reset, deck/sequence, topic visibility)
- Responsive, keyboard-friendly UI with accessible controls
- Shared full-width header with German/English, Light/Dark/System themes and
  switchable Dev/Clean interface styles
- Topic field that accepts full JIRA links  
  → displays the **issue key** while keeping the full link as the target
- Real-time updates for votes, participants, and topic changes
- Minimal client code and server-rendered HTML; public content pages use Google Analytics

## Why
Planning sessions should be fast, predictable, and low-friction.
Planning Poker focuses on clarity, speed, and stability — especially for
distributed teams who meet briefly and often.

## Tech overview (at a glance)
- **Backend:** Java 25, Spring Boot 4.1.1, WebSocket
- **Frontend:** Server-rendered HTML (Thymeleaf), vanilla JS, single global CSS
- **State:** In-memory live state; snapshotting to JSON files (FTPS) for persistence
- **Deploy:** Container-ready; production auto-deploys from GitHub to Koyeb

## Quick Start

**Run locally:**
```bash
# Clone repository
git clone https://github.com/nox-vobiscum/planning-poker.git
cd planning-poker

# Run with Maven Wrapper (requires Java 25)
./mvnw spring-boot:run

# Open browser
# http://localhost:8080
```

**Docker:**
```bash
docker build -t planning-poker .
docker run -p 8080:8080 planning-poker
```

## Documentation

### For Users
- **[Live App](https://planning-poker.at/)** - Try it now!
- **[USER-GUIDE.md](docs/USER-GUIDE.md)** - 📖 Complete user guide (German)
- **[USER-GUIDE-EN.md](docs/USER-GUIDE-EN.md)** - 📖 Complete user guide (English)

### For Developers
- **[BRIEFING.md](docs/BRIEFING.md)** - Project overview, setup, workflows, checklists
- **[CHANGELOG.md](CHANGELOG.md)** - Compact history of recent releases and fixes
- **[DEVELOPER-GUIDE.md](docs/DEVELOPER-GUIDE.md)** - Complete development guide with setup, testing, debugging
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - System architecture, components, data flow
- **[API.md](docs/API.md)** - HTTP and WebSocket API reference
- **[E2E-TESTING.md](docs/E2E-TESTING.md)** - Playwright testing guide

### For Operations
- **[DEPLOYMENT.md](docs/DEPLOYMENT.md)** - Deployment guide (Koyeb, Docker, manual)

### Additional Resources
- **[STYLE.md](docs/STYLE.md)** - UI design tokens and style guide
- **[BACKLOG.md](docs/BACKLOG.md)** - Future features and roadmap
- **[PLANNING-POKER-CHANGE-REQUESTS.md](docs/PLANNING-POKER-CHANGE-REQUESTS.md)** - Approved post-redesign change requests
- **[ADR](docs/adr/)** - Architecture Decision Records

## Features

✅ **Real-time collaboration** via WebSockets  
✅ **Multiple card sequences** (Fibonacci, T-shirt sizes, Powers of 2)  
✅ **Spectator mode** for observers  
✅ **Auto-reveal** when all votes are in  
✅ **Topic management** with JIRA link extraction  
✅ **Host rotation** on disconnect  
✅ **Special cards** (question, coffee, etc.)  
✅ **Statistics** (average, median, range, outliers)  
✅ **Internationalization** (English, German)  
✅ **Mobile-friendly** responsive design  
✅ **Light/Dark/System themes** and **Dev/Clean interface styles**

## Contributing

We welcome contributions! Please see:
- [BRIEFING.md § 5 "Collaboration Workflow"](docs/BRIEFING.md#5-collaboration-workflow-dev--ai) for contribution guidelines
- [DEVELOPER-GUIDE.md](docs/DEVELOPER-GUIDE.md) for development setup
- [Pull Request Template](.github/pull_request_template.md) for PR guidelines

## License

See [LICENSE](LICENSE) file for details.

## Acknowledgments

Built with Spring Boot, Thymeleaf, and Playwright.

---

> This README intentionally stays high-level for GitHub visitors.
> Operational details, commands, and contributor workflows live in the docs.
