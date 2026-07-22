# API Reference

Complete reference for all HTTP and WebSocket APIs in EstPoker.

---

## Table of Contents

1. [HTTP REST API](#http-rest-api)
2. [WebSocket Protocol](#websocket-protocol)
3. [Data Models](#data-models)
4. [Error Handling](#error-handling)

---

## HTTP REST API

### 1. Pages (Server-Rendered)

#### GET `/`
**Description:** Landing page  
**Controller:** `HomeController.index()`  
**Response:** HTML page with links to create/join rooms

---

#### GET `/room`
**Description:** Poker room interface  
**Controller:** `GameController.roomPage()`  
**Query Parameters:**
- `roomCode` (required): Room identifier
- `participantName` (required): User's display name

**Response:** HTML page with room interface

**Example:**
```
GET /room?roomCode=demo&participantName=Alice
```

---

#### GET `/invite`
**Description:** Join/Create room form  
**Controller:** Likely `RoomsController` or similar  
**Response:** HTML form

---

### 2. API Endpoints

#### GET `/healthz`
**Description:** Health check endpoint  
**Controller:** `HealthController.health()`  
**Response:**
```json
{
  "status": "UP"
}
```
**Status Code:** `200 OK`

---

#### GET `/api/sequences`
**Description:** Get available card sequences  
**Controller:** `SequencesController.listSequences()`  
**Response:**
```json
{
  "fib": ["1", "2", "3", "5", "8", "13", "21"],
  "fib.enh": ["0", "1", "2", "3", "5", "8", "13", "21", "34", "55", "89", "♾️"],
  "tshirt": ["XS", "S", "M", "L", "XL", "XXL"],
  "pow2": ["1", "2", "4", "8", "16", "32", "64"]
}
```
**Status Code:** `200 OK`

---

#### GET `/api/rooms/{roomCode}/check`
**Description:** Check if room exists  
**Controller:** `RoomCheckController.checkRoom()`  
**Path Parameters:**
- `roomCode`: Room identifier

**Response:**
```json
{
  "exists": true
}
```
**Status Code:** `200 OK`

---

#### GET `/api/rooms/{roomCode}/names/{name}/available`
**Description:** Check if name is available in room  
**Controller:** `RoomNameCheckController.checkName()`  
**Path Parameters:**
- `roomCode`: Room identifier
- `name`: Desired participant name

**Response:**
```json
{
  "available": true
}
```
**Status Code:** `200 OK`

---

#### GET `/i18n/messages`
**Description:** Get localized messages  
**Controller:** `I18nController.messages()`  
**Query Parameters:**
- `lang` (optional): Language code (`en`, `de`); defaults to request locale

**Response:**
```json
{
  "welcome": "Welcome",
  "vote.placeholder": "Choose a card",
  "reveal.button": "Reveal",
  "reset.button": "Reset"
}
```
**Status Code:** `200 OK`

---

#### GET `/api/locale`
**Description:** Get current locale  
**Controller:** `LocaleController.getLocale()`  
**Response:**
```json
{
  "locale": "en"
}
```

---

#### POST `/api/locale`
**Description:** Change locale  
**Controller:** `LocaleController.setLocale()`  
**Request Body:**
```json
{
  "locale": "de"
}
```
**Response:** `204 No Content`

---

### 3. Diagnostic Endpoints (Disabled by Default)

#### GET `/api/storage/probe`
**Description:** Test storage connection  
**Enabled:** `features.securityProbe.enabled=true`  
**Controller:** `StorageController`

#### POST `/api/security/hash`
**Description:** Hash a password (for testing)  
**Enabled:** `features.securityProbe.enabled=true`  
**Controller:** `SecurityProbeController`

⚠️ **Security Warning:** Never enable these endpoints in production!

---

## WebSocket Protocol

### Connection

**Endpoint:** `/gameSocket`

**Full URL:**
- Local: `ws://localhost:8080/gameSocket`
- Production: `wss://ep.noxvobiscum.at/gameSocket`

**Handshake:**
```javascript
const ws = new WebSocket('ws://localhost:8080/gameSocket');
ws.send('join:demo:cid-12345:Alice');
```

**Expected Response:**
```
identity:Alice:cid-12345
voteUpdate:{"type":"voteUpdate",...}
```

---

### Message Format

**From Client:** Plain text messages with colon-separated fields  
**From Server:** Plain text or JSON (indicated by message type)

---

### Client → Server Messages

#### JOIN
**Format:** `join:<roomCode>:<clientId>:<requestedName>`

**Description:** Join a room with a unique client ID and requested name

**Example:**
```
join:demo:abc-123:Alice
```

**Server Response:**
```
identity:Alice:abc-123
voteUpdate:{...}
```

**Notes:**
- Server may canonicalize name (trim, deduplicate)
- Client ID persists across reconnects

---

#### RENAME
**Format:** `rename:<newName>`

**Description:** Change participant's display name

**Example:**
```
rename:Bob
```

**Server Broadcast:**
```json
{
  "type": "participantRenamed",
  "oldName": "Alice",
  "newName": "Bob"
}
```

---

#### VOTE
**Format:** `vote:<participantName>:<value>`

**Description:** Cast a vote

**Example:**
```
vote:Alice:5
```

**Server Broadcast:**
```json
{
  "type": "voteUpdate",
  "participants": [...]
}
```

**Valid Values:**
- Numeric: `"1"`, `"2"`, `"3"`, `"5"`, `"8"`, `"13"`, etc.
- T-shirt: `"XS"`, `"S"`, `"M"`, `"L"`, `"XL"`, `"XXL"`
- Specials: `"❓"`, `"☕"`, `"🔭"`, `"⏳"`, etc.
- Infinity: `"♾️"` or `"∞"`

---

#### REVEAL CARDS
**Format:** `revealCards`

**Description:** Reveal all votes (host-only)

**Example:**
```
revealCards
```

**Server Broadcast:**
```json
{
  "type": "voteUpdate",
  "revealed": true,
  "average": 5.5,
  "median": 5,
  "range": "3-8",
  "consensus": false,
  "outliers": []
}
```

---

#### RESET ROOM
**Format:** `resetRoom`

**Description:** Reset voting round (host-only)

**Example:**
```
resetRoom
```

**Server Broadcast:**
```json
{
  "type": "voteUpdate",
  "revealed": false,
  "participants": [
    {"name": "Alice", "vote": null, ...}
  ]
}
```

---

#### SET SEQUENCE
**Format:** `sequence:<sequenceId>` or `setSequence:<sequenceId>` or `seq:<sequenceId>`

**Description:** Change card sequence (host-only)

**Example:**
```
sequence:fib.enh
```

**Valid Sequence IDs:**
- `fib`: Standard Fibonacci
- `fib.enh`: Enhanced Fibonacci (includes 0 and ∞)
- `tshirt`: T-shirt sizes
- `pow2`: Powers of 2

**Server Broadcast:**
```json
{
  "type": "voteUpdate",
  "sequenceId": "fib.enh",
  "cards": ["0", "1", "2", "3", "5", "8", "13", "21", "34", "55", "89", "♾️"]
}
```

---

#### TOPIC SAVE
**Format:** `topicSave:<text>`

**Description:** Save topic/user story (host-only)

**Example:**
```
topicSave:https://jira.example.com/browse/USER-123
```

**Behavior:**
- Extracts JIRA issue key from full URLs
- Preserves full URL as link target
- Displays only the key (e.g., `USER-123`)

**Server Broadcast:**
```json
{
  "type": "voteUpdate",
  "topicLabel": "USER-123",
  "topicUrl": "https://jira.example.com/browse/USER-123",
  "topicVisible": true
}
```

---

#### TOPIC CLEAR
**Format:** `topicClear`

**Description:** Clear current topic (host-only)

**Server Broadcast:**
```json
{
  "type": "voteUpdate",
  "topicLabel": null,
  "topicUrl": null
}
```

---

#### TOPIC VISIBLE
**Format:** `topicVisible:<boolean>`

**Description:** Toggle topic visibility (host-only)

**Example:**
```
topicVisible:true
```

---

#### AUTO-REVEAL
**Format:** `autoReveal:<boolean>`

**Description:** Toggle auto-reveal (host-only)

**Example:**
```
autoReveal:true
```

**Behavior:**
- When enabled, votes are automatically revealed when all eligible participants have voted
- Spectators are excluded from the count

---

#### SPECIALS (Boolean)
**Format:** `specials:<boolean>`

**Description:** Toggle specials on/off (host-only, legacy)

**Example:**
```
specials:true
```

**Notes:**
- Legacy API; prefer `specials:set:<ids>`
- Question mark (`❓`) is always available regardless

---

#### SPECIALS (Set Selection)
**Format:** `specials:set:<id1,id2,...>`

**Description:** Set selected specials by IDs (host-only)

**Example:**
```
specials:set:coffee,telescope,waiting
```

**Valid IDs:**
- `coffee` → ☕
- `speech` → 💬
- `telescope` → 🔭
- `waiting` → ⏳
- `dependency` → 🔗
- `risk` → ⚠️
- `relevance` → 🎯

**Server Broadcast:**
```json
{
  "type": "voteUpdate",
  "specials": ["❓", "☕", "🔭", "⏳"],
  "allowSpecials": true
}
```

---

#### PARTICIPATION
**Format:** `participation:<boolean>`

**Description:** Toggle spectator mode (self)

**Example:**
```
participation:false
```

**Behavior:**
- `false` = spectator (not counted in votes)
- `true` = participant (votes count)

---

#### INTENTIONAL LEAVE
**Format:** `intentionalLeave`

**Description:** Signal intentional disconnect (shorter grace period)

**Example:**
```
intentionalLeave
```

**Behavior:**
- Host grace: 2 seconds (vs. 5 seconds for unexpected)
- Participant grace: 2 seconds

---

#### CLOSE ROOM
**Format:** `closeRoom`

**Description:** Close room and disconnect all participants (host-only)

**Example:**
```
closeRoom
```

**Behavior:**
- Room is removed from memory
- All connections are closed
- Persistence snapshot may be saved

---

#### PING
**Format:** `ping`

**Description:** Heartbeat to keep connection alive

**Example:**
```
ping
```

**Server Response:**
```
pong
```

**Notes:**
- Sent every 15 seconds by client (`room.js`)
- Watchdog disconnects if no message received for 20 seconds

---

### Server → Client Messages

#### IDENTITY
**Format:** `identity:<canonicalName>:<clientId>`

**Description:** Confirms identity after join

**Example:**
```
identity:Alice:abc-123
```

---

#### VOTE UPDATE
**Type:** `voteUpdate`  
**Format:** JSON object

**Description:** Complete room state update

**Example:**
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
    },
    {
      "name": "Bob",
      "vote": null,
      "isHost": false,
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
  "topicLabel": null,
  "topicUrl": null,
  "topicVisible": false,
  "average": null,
  "median": null,
  "range": null,
  "consensus": false,
  "outliers": []
}
```

**When Revealed:**
```json
{
  "type": "voteUpdate",
  "revealed": true,
  "average": 5.5,
  "median": 5,
  "range": "3-8",
  "consensus": false,
  "outliers": ["Alice", "Bob"],
  "participants": [...]
}
```

---

#### HOST CHANGED
**Type:** `hostChanged`  
**Format:** JSON object

**Description:** Host rotation event

**Example:**
```json
{
  "type": "hostChanged",
  "newHost": "Bob"
}
```

---

#### PARTICIPANT JOINED
**Type:** `participantJoined`  
**Format:** JSON object

**Description:** New participant joined room

**Example:**
```json
{
  "type": "participantJoined",
  "name": "Charlie"
}
```

---

#### PARTICIPANT LEFT
**Type:** `participantLeft`  
**Format:** JSON object

**Description:** Participant left room

**Example:**
```json
{
  "type": "participantLeft",
  "name": "Charlie"
}
```

---

#### PARTICIPANT RENAMED
**Type:** `participantRenamed`  
**Format:** JSON object

**Description:** Participant changed name

**Example:**
```json
{
  "type": "participantRenamed",
  "oldName": "Alice",
  "newName": "Alicia"
}
```

---

#### TOAST
**Type:** `toast`  
**Format:** JSON object

**Description:** Notification message

**Example:**
```json
{
  "type": "toast",
  "message": "Alice has been made host"
}
```

---

#### PONG
**Format:** `pong`

**Description:** Heartbeat response

**Example:**
```
pong
```

---

## Data Models

### Participant Object

```typescript
interface Participant {
  name: string;              // Display name (canonical)
  vote: string | null;       // Vote value or null
  isHost: boolean;           // Host flag
  spectator: boolean;        // Spectator mode
  participating: boolean;    // Participating in estimation
  disconnected: boolean;     // Connection state
  away: boolean;             // Away flag (reserved)
}
```

---

### Room State Object

```typescript
interface RoomState {
  type: "voteUpdate";
  you: string;                      // Your name
  participants: Participant[];      // All participants
  revealed: boolean;                // Votes revealed
  cards: string[];                  // Available cards (main sequence)
  specials: string[];               // Available special cards
  sequenceId: string;               // Current sequence ID
  autoRevealEnabled: boolean;       // Auto-reveal toggle
  allowSpecials: boolean;           // Specials enabled
  topicLabel: string | null;        // Topic display text
  topicUrl: string | null;          // Topic link URL
  topicVisible: boolean;            // Topic visibility
  average: number | null;           // Average (when revealed)
  median: number | null;            // Median (when revealed)
  range: string | null;             // Range (when revealed, e.g. "3-8")
  consensus: boolean;               // All votes identical
  outliers: string[];               // Participants with outlier votes
}
```

---

### Statistics Calculation

**Average:**
- Numeric votes only
- Specials excluded (except infinity = 999)
- Spectators excluded
- Rounded to 1 decimal place

**Median:**
- Middle value of sorted numeric votes
- If even count, average of two middle values

**Range:**
- Format: `"min-max"` (e.g., `"3-13"`)
- Numeric votes only

**Consensus:**
- All eligible participants voted the same value
- Spectators excluded

**Outliers:**
- Votes > 1.5× away from average
- Names of participants with outlier votes

---

## Error Handling

### HTTP Errors

#### 404 Not Found
**Scenario:** Invalid endpoint or room not found

**Response:**
```json
{
  "error": "Not Found",
  "message": "Room 'xyz' does not exist",
  "status": 404
}
```

---

#### 403 Forbidden
**Scenario:** Unauthorized action (e.g., non-host tries host-only command)

**Behavior:** WebSocket message is ignored silently

---

#### 500 Internal Server Error
**Scenario:** Unexpected server error

**Response:**
```json
{
  "error": "Internal Server Error",
  "message": "An unexpected error occurred",
  "status": 500
}
```

---

### WebSocket Errors

#### Connection Refused
**Scenario:** Invalid origin or server unavailable

**Client Behavior:**
- Exponential backoff reconnection (800ms → 12s)
- User notified via UI toast

---

#### Stale Connection
**Scenario:** No messages received for 20+ seconds

**Client Behavior:**
- Watchdog triggers reconnection
- Automatic resync on reconnect

---

#### Name Conflict
**Scenario:** Requested name is already taken

**Server Response:**
```
identity:Alice-2:abc-123
```

**Notes:**
- Server appends suffix to deduplicate
- Client receives canonicalized name

---

## Rate Limiting

Currently **not implemented**.

Potential future enhancements:
- Vote throttling (max 1/second per participant)
- Message rate limits (10/second per connection)

---

## CORS & Security

### WebSocket Origins

**Configured in:** `application.properties`

```properties
app.websocket.allowed-origins=http://localhost:*,https://ep.noxvobiscum.at
```

**Enforcement:** Origin header checked on WebSocket upgrade request

---

### HTTPS/WSS

**Production:** Enforced via Cloudflare proxy  
**Local Dev:** Plain HTTP/WS acceptable

---

## Versioning

**Current Version:** Implicit v1 (no versioning in URLs)

**Breaking Changes:** Not anticipated; backward compatibility maintained

---

## Client Libraries

### JavaScript (Browser)

**Included in:** `/js/room.js`

**Usage:**
```javascript
// Connect
const ws = new WebSocket('ws://localhost:8080/gameSocket');

// Join
ws.send('join:demo:client-123:Alice');

// Vote
ws.send('vote:Alice:5');

// Listen for updates
ws.onmessage = (event) => {
  const data = event.data;
  if (data.startsWith('voteUpdate:')) {
    const json = data.substring('voteUpdate:'.length);
    const state = JSON.parse(json);
    console.log(state);
  }
};
```

---

### Other Languages

**No official SDKs** provided. Protocol is simple enough to implement directly.

**Example (Python):**
```python
import websocket
import json

ws = websocket.create_connection("ws://localhost:8080/gameSocket")
ws.send("join:demo:py-client:PythonBot")

while True:
    msg = ws.recv()
    if msg.startswith("voteUpdate:"):
        state = json.loads(msg[len("voteUpdate:"):])
        print(state)
```

---

## Postman Collection

Not currently available. Consider creating one for API testing.

---

## References

- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture
- [BRIEFING.md](BRIEFING.md) - Project overview
- [E2E-TESTING.md](E2E-TESTING.md) - Testing guide
