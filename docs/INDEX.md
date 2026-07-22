# EstPoker Documentation Index

Comprehensive documentation for the EstPoker estimation poker application.

---

## 📚 Documentation Overview

### Quick Links

- **[README.md](../README.md)** - Project overview and quick start
- **[USER-GUIDE.md](USER-GUIDE.md)** - 📖 **Benutzerhandbuch für Endanwender** (Deutsch)
- **[USER-GUIDE-EN.md](USER-GUIDE-EN.md)** - 📖 **User Guide for End Users** (English)
- **[BRIEFING.md](BRIEFING.md)** - Essential project baseline (read this first!)

### Core Documentation

#### 🏗️ Architecture & Design
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture, components, data flow, and design decisions
- **[ADR/](adr/)** - Architecture Decision Records (detailed technical decisions)

#### 🔌 API Reference
- **[API.md](API.md)** - Complete HTTP REST and WebSocket API documentation

#### 💻 Development
- **[DEVELOPER-GUIDE.md](DEVELOPER-GUIDE.md)** - Setup, workflow, testing, debugging, and common tasks
- **[E2E-TESTING.md](E2E-TESTING.md)** - Playwright end-to-end testing guide

#### 🚀 Operations
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Production deployment, Docker, monitoring, and troubleshooting

#### 🎨 Design & Style
- **[STYLE.md](STYLE.md)** - UI design tokens, CSS guidelines, and style conventions

#### 📋 Planning
- **[BACKLOG.md](BACKLOG.md)** - Future features, enhancements, and roadmap

---

## 🎯 I Want To...

### Get Started

**I'm an end user (non-technical)**
→ Read [USER-GUIDE.md](USER-GUIDE.md) (German) or [USER-GUIDE-EN.md](USER-GUIDE-EN.md) (English)

**I'm new to the project (developer)**
→ Start with [BRIEFING.md](BRIEFING.md) for project overview and setup

**I want to run it locally**
→ See [DEVELOPER-GUIDE.md § Local Development Setup](DEVELOPER-GUIDE.md#local-development-setup)

**I want to understand the architecture**
→ Read [ARCHITECTURE.md](ARCHITECTURE.md)

### Develop

**I want to add a new feature**
→ See [DEVELOPER-GUIDE.md § Common Tasks](DEVELOPER-GUIDE.md#common-tasks)

**I want to fix a bug**
→ See [DEVELOPER-GUIDE.md § Debugging](DEVELOPER-GUIDE.md#debugging)

**I want to write tests**
→ See [E2E-TESTING.md](E2E-TESTING.md) and [DEVELOPER-GUIDE.md § Testing](DEVELOPER-GUIDE.md#testing)

**I want to understand the API**
→ See [API.md](API.md)

### Deploy

**I want to deploy to production**
→ See [DEPLOYMENT.md § Production Deployment](DEPLOYMENT.md#production-deployment-koyeb)

**I want to build a Docker image**
→ See [DEPLOYMENT.md § Docker Deployment](DEPLOYMENT.md#docker-deployment)

**I want to configure the app**
→ See [DEPLOYMENT.md § Environment Configuration](DEPLOYMENT.md#environment-configuration)

### Style & Design

**I want to understand the UI design**
→ See [STYLE.md](STYLE.md)

**I want to add CSS**
→ See [STYLE.md](STYLE.md) and [BRIEFING.md § 4 "Coding & Style Rules"](BRIEFING.md#4-coding--style-rules)

---

## 📖 Document Summaries

### USER-GUIDE.md / USER-GUIDE-EN.md
**End-user documentation** (German / English) covering:
- Schnellstart für Moderatoren und Teilnehmer
- Schritt-für-Schritt Anleitungen
- UI-Elemente erklärt
- Kartenwerte und ihre Bedeutung
- Häufige Fragen (FAQ)
- Tipps für effektive Planning-Poker Sessions
- Troubleshooting für Endanwender
- Beispiel-Session

**For non-technical users who want to use the tool.**

---

### BRIEFING.md
**Essential project baseline** covering:
- Purpose and tech stack
- Local development environment
- Configuration and feature flags
- Coding standards and style rules
- Collaboration workflow (Dev ↔ AI)
- Change management process

**Read this first!** It's the foundation for everything else.

---

### ARCHITECTURE.md
**Deep dive into system design** covering:
- Technology stack details
- Component architecture (backend, frontend, persistence)
- Data flow diagrams
- WebSocket protocol specification
- Key design decisions and rationale
- Performance characteristics
- Security considerations

**For understanding how everything works.**

---

### API.md
**Complete API reference** covering:
- All HTTP REST endpoints
- WebSocket protocol messages (client ↔ server)
- Data models and payload structures
- Error handling
- Example requests and responses

**For integrating with or extending the API.**

---

### DEVELOPER-GUIDE.md
**Practical development guide** covering:
- Prerequisites and setup
- Project structure walkthrough
- Development workflow
- Building and testing
- Debugging techniques
- Common development tasks
- Troubleshooting

**For day-to-day development work.**

---

### DEPLOYMENT.md
**Operations and deployment guide** covering:
- Production deployment (Koyeb)
- Docker containerization
- Manual deployment strategies
- Environment configuration
- Monitoring and health checks
- Backup and disaster recovery
- Troubleshooting deployment issues

**For deploying and maintaining production systems.**

---

### E2E-TESTING.md
**Playwright testing guide** covering:
- Test philosophy and scope
- Prerequisites and setup
- Running tests (single, multiple, full suite)
- Writing new tests
- Debugging test failures
- Best practices for stable tests

**For ensuring quality through automated testing.**

---

### STYLE.md
**UI/UX design guide** covering:
- Design tokens (spacing, typography, colors)
- CSS custom properties
- Layout principles
- Compact mode
- Accessibility guidelines
- Token usage examples

**For consistent, maintainable UI styling.**

---

### BACKLOG.md
**Future work and roadmap** covering:
- Planned features (prioritized)
- Enhancement ideas
- Technical debt
- Known limitations
- Nice-to-have features

**For understanding what's coming next.**

---

## 🗂️ Documentation by Role

### End User / Team Member
1. [USER-GUIDE.md](USER-GUIDE.md) - Complete user guide (German)
2. [USER-GUIDE-EN.md](USER-GUIDE-EN.md) - Complete user guide (English)

### Developer
1. [BRIEFING.md](BRIEFING.md) - Start here
2. [ARCHITECTURE.md](ARCHITECTURE.md) - Understand the system
3. [DEVELOPER-GUIDE.md](DEVELOPER-GUIDE.md) - Daily workflow
4. [API.md](API.md) - Reference
5. [E2E-TESTING.md](E2E-TESTING.md) - Testing

### DevOps / SRE
1. [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment and operations
2. [ARCHITECTURE.md](ARCHITECTURE.md) - System design
3. [API.md](API.md) - Monitoring endpoints
4. [BRIEFING.md](BRIEFING.md) - Configuration

### Designer / Frontend Developer
1. [STYLE.md](STYLE.md) - Design system
2. [ARCHITECTURE.md § Frontend](ARCHITECTURE.md#2-frontend-components) - Frontend structure
3. [DEVELOPER-GUIDE.md](DEVELOPER-GUIDE.md) - Development setup

### Product Manager / Stakeholder
1. [README.md](../README.md) - Project overview
2. [BACKLOG.md](BACKLOG.md) - Roadmap
3. [BRIEFING.md](BRIEFING.md) - Technical capabilities

### QA / Tester
1. [E2E-TESTING.md](E2E-TESTING.md) - Testing guide
2. [API.md](API.md) - API for testing
3. [DEVELOPER-GUIDE.md § Testing](DEVELOPER-GUIDE.md#testing) - Test types

---

## 🔄 Documentation Updates

### When to Update

Update documentation when:
- Adding new features or endpoints
- Changing existing behavior
- Modifying deployment process
- Updating dependencies or requirements
- Making architectural changes
- Adding configuration options

### How to Update

1. Identify affected documents
2. Make changes inline with code changes
3. Update examples if necessary
4. Keep cross-references consistent
5. Update this index if adding new docs

### Review Checklist

- [ ] All code examples are correct
- [ ] Links work (no broken references)
- [ ] Screenshots/diagrams are up to date
- [ ] Version numbers are current
- [ ] Configuration examples match actual code

---

## 🆘 Getting Help

If you can't find what you need:

1. **Search the docs** - Use Ctrl+F or GitHub search
2. **Check existing issues** - GitHub Issues tab
3. **Review code comments** - Often more detailed than docs
4. **Ask the team** - Team chat / Slack
5. **Create an issue** - Document what's missing

---

## 📝 Document Standards

### Formatting
- Use Markdown (.md)
- Follow consistent heading hierarchy (H1 → H2 → H3)
- Include a table of contents for long documents
- Use code blocks with language hints

### Structure
- Start with overview/summary
- Provide context before details
- Include examples for complex topics
- Add troubleshooting sections
- Link to related documents

### Tone
- Clear and concise
- Assume reader is intelligent but unfamiliar
- Avoid jargon without explanation
- Use active voice
- Be specific, not vague

---

## 📊 Documentation Statistics

| Document | Lines | Topics | Last Major Update |
|----------|-------|--------|-------------------|
| USER-GUIDE.md | ~650 | 15 | 2026-07-22 |
| USER-GUIDE-EN.md | ~650 | 15 | 2026-07-22 |
| BRIEFING.md | ~300 | 7 | Regularly updated |
| ARCHITECTURE.md | ~800 | 11 | 2026-07-22 |
| API.md | ~1000 | 7 | 2026-07-22 |
| DEVELOPER-GUIDE.md | ~900 | 9 | 2026-07-22 |
| DEPLOYMENT.md | ~700 | 7 | 2026-07-22 |
| E2E-TESTING.md | ~200 | 6 | Regularly updated |
| STYLE.md | ~100 | 4 | Regularly updated |
| BACKLOG.md | ~150 | Varies | Ongoing |

**Total documentation:** ~5,450 lines across 10 primary documents

---

## 🌐 External Resources

### Spring Boot
- [Spring Boot Reference](https://docs.spring.io/spring-boot/docs/current/reference/html/)
- [Spring WebSocket Guide](https://spring.io/guides/gs/messaging-stomp-websocket/)

### Frontend
- [Thymeleaf Documentation](https://www.thymeleaf.org/documentation.html)
- [MDN Web Docs](https://developer.mozilla.org/)

### Testing
- [Playwright Documentation](https://playwright.dev/)
- [JUnit 5 User Guide](https://junit.org/junit5/docs/current/user-guide/)

### Deployment
- [Koyeb Documentation](https://www.koyeb.com/docs)
- [Docker Documentation](https://docs.docker.com/)
- [Cloudflare Docs](https://developers.cloudflare.com/)

---

## ✅ Documentation Health

**Last Review:** 2026-07-22  
**Coverage:** Comprehensive  
**Status:** ✅ Complete

**Gaps Identified:**
- None currently

**Upcoming Updates:**
- Keep BACKLOG.md in sync with development
- Add ADRs for future major decisions

---

*This index is maintained as part of the EstPoker project documentation. For questions or suggestions, please create an issue on GitHub.*
