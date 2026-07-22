# Architecture Overview

This document provides a comprehensive overview of the EstPoker system architecture, component structure, and key design decisions.

---

## System Overview

**EstPoker** is a lightweight, real-time estimation poker application built for agile teams. It provides:
- Real-time voting and collaboration via WebSockets
- Server-rendered HTML with vanilla JavaScript (no heavy frameworks)
- Optional persistence (in-memory or FTPS-based snapshots)
- Minimal footprint and high performance

**Production URL:** https://ep.noxvobiscum.at/

---

## Technology Stack

### Backend
- **Runtime:** Java 25 (OpenJDK)
- **Framework:** Spring Boot 3.5.7
- **WebSockets:** Spring WebSocket (STOMP-free, custom protocol)
- **Templating:** Thymeleaf
- **Build Tool:** Maven 3.x
- **Password Security:** BCrypt (via Spring Security Crypto)

### Frontend
- **Language:** Vanilla JavaScript (ES6+)
- **Styling:** CSS (centralized in `styles.css`)
- **Templating:** Server-rendered Thymeleaf templates
- **No frameworks:** React/Vue/Angular not used

### Testing
- **Unit Tests:** JUnit 5, Mockito
- **E2E Tests:** Playwright (TypeScript)
- **CI:** Automated via GitHub Actions (inferred)

### Infrastructure
- **Hosting:** Koyeb (PaaS)
- **CDN/Proxy:** Cloudflare
- **Persistence:** FTPS (DomainFactory file storage)
- **Container:** Docker (multi-stage build)

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         USERS                               │
│                      (Browsers)                             │
└────────────┬────────────────────────────┬───────────────────┘
             │                            │
             │ HTTP/HTTPS                 │ WebSocket (WSS)
             │                            │
             ▼                            ▼
┌────────────────────────────────────────────────────────────┐
│                      CLOUDFLARE CDN                        │
│                   (Proxy + TLS Termination)                │
└────────────┬────────────────────────────┬──────────────────┘
             │                            │
             ▼                            ▼
┌──────────────────────────────────────────────────────────────┐
│                      KOYEB (Cloud Host)                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │           SPRING BOOT APPLICATION                      │ │
│  │                                                        │ │
│  │  ┌──────────────┐      ┌──────────────┐             │ │
│  │  │  Controllers │◄─────┤  Thymeleaf   │             │ │
│  │  │  (REST/HTTP) │      │  Templates   │             │ │
│  │  └──────┬───────┘      └──────────────┘             │ │
│  │         │                                            │ │
│  │         ▼                                            │ │
│  │  ┌─────────────────────────────────────────┐        │ │
│  │  │          GameService                    │        │ │
│  │  │  (Core Business Logic)                  │        │ │
│  │  │  - Room Management                      │        │ │
│  │  │  - Voting State                         │        │ │
│  │  │  - Host Rotation                        │        │ │
│  │  │  - Participant Tracking                 │        │ │
│  │  └────────┬────────────────────────────────┘        │ │
│  │           │                                          │ │
│  │  ┌────────▼───────────┐    ┌──────────────┐        │ │
│  │  │ GameWebSocketHandler│◄───┤ WebSocket    │        │ │
│  │  │ (WS Protocol)       │    │ Config       │        │ │
│  │  └────────┬────────────┘    └──────────────┘        │ │
│  │           │                                          │ │
│  │           ▼                                          │ │
│  │  ┌─────────────────────┐                            │ │
│  │  │  RoomSnapshotter    │                            │ │
│  │  │  (Debounced saves)  │                            │ │
│  │  └────────┬────────────┘                            │ │
│  │           │                                          │ │
│  │           ▼                                          │ │
│  │  ┌─────────────────────────────┐                    │ │
│  │  │  Persistence Layer          │                    │ │
│  │  │  - NoOp (default)           │                    │ │
│  │  │  - FTPS (optional)          │                    │ │
│  │  └────────┬────────────────────┘                    │ │
│  └───────────┼────────────────────────────────────────┐│ │
│              │                                         ││ │
└──────────────┼─────────────────────────────────────────┘│ │
               │                                          │ │
               ▼                                          │ │
     ┌──────────────────────┐                            │ │
     │   FTPS File Storage  │                            │ │
     │  (DomainFactory)     │                            │ │
     │  - Room Snapshots    │                            │ │
     └──────────────────────┘                            │ │
                                                          │ │
```

---

## Component Structure

### 1. Backend Components

#### 1.1 Model Layer (`com.example.estpoker.model`)
- **Room**: Core domain model representing a poker room
  - Participants (linked map for stable order)
  - Voting state (revealed, auto-reveal)
  - Sequence/deck configuration
  - Topic (label, URL, visibility)
  - Specials configuration
  
- **Participant**: Individual user in a room
  - Name (canonical, unique per room)
  - Vote
  - Host status
  - Spectator mode
  - Disconnection state

- **CardSequences**: Static utility for managing voting sequences
  - Fibonacci (standard, enhanced)
  - T-shirt sizes
  - Powers of 2
  - Custom sequences

#### 1.2 Service Layer

##### GameService
**Location:** `com.example.estpoker.service.GameService`

Central orchestrator for all game logic:
- Room lifecycle (create, close)
- Participant management (join, leave, rename, kick)
- Voting operations (vote, reveal, reset)
- Host rotation (automatic on disconnect)
- Topic management
- Auto-reveal logic
- Spectator mode
- WebSocket session tracking
- Grace period handling for disconnects

**Concurrency:** Synchronizes on Room objects to ensure thread safety.

##### RoomSnapshotter
**Location:** `com.example.estpoker.rooms.service.RoomSnapshotter`

Debounced persistence handler:
- Triggers on room mutations (votes, topic, settings)
- Configurable debounce delay (default 1500ms)
- Prevents excessive writes to storage
- Non-blocking operation

##### RoomManager
**Location:** `com.example.estpoker.service.RoomManager`

Manages room registry and lifecycle operations.

#### 1.3 Controller Layer

##### HTTP Controllers
- **HomeController**: Landing page (`/`)
- **GameController**: Room page rendering (`/room`)
- **HealthController**: Health check endpoint (`/healthz`)
- **RoomsController**: Room creation/listing
- **SequencesController**: Available card sequences
- **LocaleController**: Internationalization
- **I18nController**: Dynamic message loading

##### WebSocket Handler
**GameWebSocketHandler**: Custom WebSocket protocol handler
- Connection handshake (room + name + client-id)
- Vote messages
- Host-only commands (reveal, reset, sequence, topic, specials)
- Heartbeat (ping/pong)
- Graceful disconnect handling

#### 1.4 Persistence Layer

Three implementations (strategy pattern):

1. **NoOpPersistenceService** (default)
   - No actual persistence
   - Rooms exist only in memory
   
2. **InMemoryRoomPersistenceService**
   - In-memory snapshots
   - Lost on restart
   
3. **StoredRoomPersistenceService** + **FtpsRoomStore**
   - JSON snapshots to FTPS
   - Survives restarts
   - Configurable via `features.persistentRooms.enabled`

#### 1.5 Configuration

**Key Configuration Classes:**
- `FeaturesProperties`: Feature flags
- `AppStorageProperties`: FTPS configuration
- `WebSocketConfig`: WebSocket endpoint mapping
- `PersistenceConfig`: Conditional bean registration
- `LocaleConfig`: i18n setup

---

### 2. Frontend Components

#### 2.1 Pages (Thymeleaf Templates)

**Location:** `src/main/resources/templates/`

1. **index.html**: Landing page
2. **invite.html**: Join/Create room form
3. **room.html**: Main poker room interface

**Fragments:**
- `fragments/head.html`: Common `<head>` content
- `fragments/header-controls.html`: Top bar controls
- `fragments/menu.html`: Settings menu
- `fragments/kbase.html`: Knowledge base/help
- `fragments/scripts.html`: Script includes
- `fragments/footer.html`: Footer content

#### 2.2 JavaScript Modules

**Location:** `src/main/resources/static/js/`

1. **room.js** (main game logic)
   - WebSocket connection & reconnection
   - Liveness/heartbeat (15s ping)
   - Watchdog (20s stale detection)
   - Vote rendering
   - Participant roster
   - Topic management
   - Stats calculation (average, median, range)
   - Auto-reveal handling
   - Specials palette
   
2. **menu.js**
   - Settings menu interactions
   - Sequence selection
   - Toggle switches (auto-reveal, topic, specials, hard mode)
   - Specials palette UI
   
3. **header-controls.js**
   - Top bar interactions
   - Menu open/close
   
4. **qr.js**
   - QR code generation for room invites
   
5. **invite-name-check.js**
   - Name availability pre-check
   
6. **index-flash.js**
   - Flash message handling on home page
   
7. **specials-bridge.js**
   - Bridge between menu and room for specials

#### 2.3 Styling

**Location:** `src/main/resources/static/styles.css`

Single centralized stylesheet with:
- CSS custom properties (design tokens)
- Responsive layout
- Compact mode support
- Dark theme (optional)
- Animation/transitions

**Design Tokens:** See [STYLE.md](STYLE.md) for details.

---

## Data Flow

### 3.1 Vote Flow

```
1. User clicks card button
   └─> room.js: send("vote:<name>:<value>")

2. Server: GameWebSocketHandler receives message
   └─> GameService.setVote(roomCode, cid, value)
       └─> Updates Room model
       └─> RoomSnapshotter.onChange() (debounced)
       └─> Broadcasts "voteUpdate" to all sessions

3. All clients receive "voteUpdate"
   └─> room.js: applyVoteUpdate()
       └─> Renders updated participant list
       └─> Calculates stats (if revealed)
       └─> Auto-reveal check (if enabled)
```

### 3.2 Host Rotation Flow

```
1. Host disconnects unexpectedly
   └─> GameWebSocketHandler.afterConnectionClosed()
       └─> GameService schedules grace period (5s)

2. Grace period expires
   └─> GameService.handleGracedDisconnect()
       └─> Checks if still disconnected
       └─> Selects new host (next participant)
       └─> Broadcasts "hostChanged" event
       └─> Broadcasts "voteUpdate" with new host flag
```

### 3.3 Persistence Flow

```
1. Mutation occurs (vote, topic change, etc.)
   └─> GameService calls snapshot(room, actor)

2. RoomSnapshotter.onChange()
   └─> Debounces (cancels previous timer)
   └─> Schedules new save after debounceMs

3. After debounce expires
   └─> RoomPersistenceService.saveFromLive()
       └─> Converts Room → StoredRoom
       └─> RoomStore.save(roomCode, json)
           └─> FtpsFileStorage.write(path, content)
```

---

## WebSocket Protocol

### Connection

**Endpoint:** `ws(s)://host/gameSocket`

**Handshake:**
```
Client → Server: join:<roomCode>:<cid>:<requestedName>
Server → Client: identity:<canonicalName>:<cid>
Server → Client: voteUpdate (initial state)
```

### Messages (Client → Server)

| Message Pattern | Auth | Description |
|----------------|------|-------------|
| `join:<room>:<cid>:<name>` | - | Join room with client-id and requested name |
| `rename:<newName>` | Self | Rename current participant |
| `vote:<name>:<value>` | Self | Cast a vote |
| `revealCards` | Host | Reveal all votes |
| `resetRoom` | Host | Reset voting round |
| `sequence:<seqId>` | Host | Change card sequence |
| `topicSave:<text>` | Host | Save topic (auto-extracts JIRA links) |
| `topicClear` | Host | Clear topic |
| `topicVisible:<bool>` | Host | Toggle topic visibility |
| `autoReveal:<bool>` | Host | Toggle auto-reveal |
| `specials:<bool>` | Host | Toggle specials (legacy) |
| `specials:set:<ids>` | Host | Set specials by IDs (e.g., `coffee,telescope`) |
| `participation:<bool>` | Self | Toggle spectator mode |
| `intentionalLeave` | Self | Signal intentional disconnect (short grace) |
| `closeRoom` | Host | Close room |
| `ping` | - | Heartbeat (expect `pong`) |

### Messages (Server → Client)

| Message Type | Payload | Description |
|-------------|---------|-------------|
| `identity` | `{ name, cid }` | Confirms identity after join |
| `voteUpdate` | Full state object | Room state update |
| `hostChanged` | `{ newHost }` | Host rotation event |
| `participantJoined` | `{ name }` | New participant |
| `participantLeft` | `{ name }` | Participant left |
| `participantRenamed` | `{ oldName, newName }` | Rename event |
| `toast` | `{ message }` | Toast notification |
| `pong` | - | Heartbeat response |

### voteUpdate Payload Structure

```json
{
  "type": "voteUpdate",
  "you": "Alice",
  "participants": [
    {
      "name": "Alice",
      "vote": "5",
      "isHost": true,
      "spectator": false,
      "participating": true,
      "disconnected": false,
      "away": false
    }
  ],
  "revealed": false,
  "cards": ["1", "2", "3", "5", "8", "13"],
  "specials": ["❓", "☕"],
  "sequenceId": "fib",
  "autoRevealEnabled": false,
  "allowSpecials": true,
  "topicLabel": "USER-123",
  "topicUrl": "https://jira.example.com/browse/USER-123",
  "topicVisible": true,
  "average": null,
  "median": null,
  "range": null,
  "consensus": false,
  "outliers": []
}
```

---

## Key Design Decisions

### 1. No Database (Default)
- Rooms are ephemeral by design
- Reduces operational complexity
- FTPS persistence available as opt-in feature
- Simplifies deployments

### 2. Vanilla JavaScript (No Framework)
- Minimal client-side footprint (~50KB total)
- Fast load times
- Easy to understand and modify
- No build step for frontend code

### 3. Server-Rendered Templates
- SEO-friendly (if needed)
- Progressive enhancement
- Fast initial page load
- Simple deployment

### 4. Custom WebSocket Protocol
- No STOMP overhead
- Tailored to application needs
- Simple text-based messages
- Easy to debug

### 5. Host Rotation with Grace Periods
- Seamless host transitions
- Prevents accidental host loss on network blips
- Different grace periods for intentional vs. unexpected disconnects

### 6. Debounced Snapshots
- Prevents excessive storage writes
- Configurable delay
- Non-blocking
- Opt-in feature

### 7. Spectator Mode
- Allow observers without skewing votes
- Toggle per participant
- Preserved across reconnects

### 8. Specials System
- Host can enable/disable extra cards (coffee, question, etc.)
- Question mark always available
- Configurable palette
- Specials excluded from average calculation

---

## Security Considerations

### Password Protection (Planned)
- BCrypt hashing with configurable cost
- Optional pepper for additional security
- Room-level passwords
- Hashed storage

### WebSocket Origin Validation
- Allowed origins configured in `application.properties`
- Prevents unauthorized WebSocket connections
- Production: `https://ep.noxvobiscum.at`
- Local dev: `http://localhost:*`

### No Authentication System
- By design: lightweight, no user accounts
- Rooms are semi-public (know the code = join)
- Suitable for internal team use

---

## Performance Characteristics

### Scalability
- In-memory state: O(1) room access
- Synchronized on Room objects: acceptable for team sizes (< 50 people/room)
- Broadcast to N participants: O(N) per mutation
- Single-threaded scheduler for grace periods

### Resource Usage
- ~50-100MB heap per 100 active rooms (estimate)
- Minimal CPU (event-driven)
- No database connections
- Optional FTPS connections (pooled)

### Network
- Heartbeat every 15s per connection
- State updates only on mutations
- Gzip compression (via Cloudflare)
- WebSocket keeps connections alive

---

## Configuration

See [BRIEFING.md](BRIEFING.md) for detailed configuration options.

**Key Properties:**
```properties
# Feature flags
features.persistentRooms.enabled=false
features.persistentRooms.snapshot.enabled=true
features.persistentRooms.snapshot.debounceMs=1500

# WebSocket
app.websocket.allowed-origins=http://localhost:*,https://ep.noxvobiscum.at

# FTPS Storage
app.storage.mode=ftps
app.storage.ftps.host=ftp.noxvobiscum.at
app.storage.ftps.port=21
```

---

## Future Enhancements

See [BACKLOG.md](BACKLOG.md) for planned features.

**Highlights:**
- Room-level JIRA base URL configuration
- Enhanced statistics (standard deviation, etc.)
- Room templates
- Voting history
- Database persistence (PostgreSQL)

---

## References

- [BRIEFING.md](BRIEFING.md) - Project baseline and workflow
- [E2E-TESTING.md](E2E-TESTING.md) - Testing strategy
- [STYLE.md](STYLE.md) - UI design tokens
- [BACKLOG.md](BACKLOG.md) - Future work
