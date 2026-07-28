# User Guide – EstPoker

Simple guide for using the EstPoker estimation tool for agile teams.

---

## What is EstPoker?

EstPoker is an online tool for **Planning Poker** sessions in agile teams. It allows teams to estimate user stories or tasks together without personal bias influencing the estimates.

**Live App:** https://ep.rbsnet.at/

### Benefits

✅ No registration required  
✅ Ready to use instantly via link  
✅ Real-time synchronization  
✅ Works on desktop, tablet, and smartphone  
✅ No installation needed (runs in browser)  

---

## Quick Start

### 1. Create a Room (as Moderator/Host)

1. Open https://ep.rbsnet.at/
2. Enter a **room name** (e.g., "Sprint-Planning-2024")
3. Enter your **name** (e.g., "Maria")
4. Click **"Create Room"**

**→ You're now in the room and automatically the moderator!**

### 2. Invite Your Team

1. Copy the **link** from the top bar (e.g., `https://ep.rbsnet.at/room?roomCode=...`)
2. Share the link with your team (Slack, Teams, email, etc.)
3. Team members open the link and enter their names

**→ All participants see each other in real-time!**

### 3. Estimate

1. **Moderator** provides the topic (e.g., "USER-123: Login functionality")
2. All participants select a **card** (number or symbol)
3. Once everyone has voted, the moderator clicks **"Reveal"**
4. Results are displayed with average and median

**→ Team discusses differences and re-estimates if needed!**

---

## The User Interface

### Overview of Main Areas

```
┌─────────────────────────────────────────────────┐
│  [EstPoker]  👤 Your Name    [⋮ Menu]  [🔗]    │  ← Header
├─────────────────────────────────────────────────┤
│  📋 Topic: USER-123: Implement login           │  ← Current topic
├─────────────────────────────────────────────────┤
│                                                 │
│   [1] [2] [3] [5] [8] [13] [21]                │  ← Cards to choose
│   [☕] [❓]                                      │
│                                                 │
├─────────────────────────────────────────────────┤
│  👥 Participants:                               │
│   • Maria (Moderator) ✓ [5]                    │  ← Participant list
│   • Tom ✓ [8]                                   │
│   • Sarah ✓ [?]                                 │
├─────────────────────────────────────────────────┤
│  [Reveal]  (moderator only)                    │  ← Action buttons
└─────────────────────────────────────────────────┘
```

---

## The Cards

### Standard Cards (Fibonacci)

The standard card values follow the Fibonacci sequence, which has proven effective for story points:

| Card | Meaning |
|------|---------|
| **1** | Very small / trivial (1-2 hours) |
| **2** | Small (half a day) |
| **3** | Small to medium |
| **5** | Medium (1-2 days) |
| **8** | Large (3-5 days) |
| **13** | Very large (1 week) |
| **21** | Extra large (too big, split it!) |

### Special Cards

| Card | Meaning | Usage |
|------|---------|-------|
| **❓** | Question mark | "I don't understand the task" / Need for discussion |
| **☕** | Coffee break | "I need a break" |
| **🔭** | Telescope | "Needs more analysis" (optional) |
| **⏳** | Hourglass | "Waiting for something" (optional) |

**Note:** Special cards are **not** included in the average calculation.

---

## Functions Step by Step

### Voting as a Participant

1. **Wait** until the moderator provides a topic
2. **Think** about your estimate (e.g., "This is a 5")
3. **Click** on the corresponding card
4. **Your choice** is marked (green outline)
5. You see a ✓ for other participants (but not their card!)
6. **Wait** for the reveal

**Tip:** You can change your choice anytime before the reveal!

### Working as Moderator

#### Enter Topic

1. **Click** on the topic field at the top
2. **Enter** the title (e.g., "USER-123: Login")
3. Or paste a **JIRA link** – the issue key is automatically extracted!
4. **Press Enter** or click outside

**→ Everyone sees the new topic instantly!**

#### Reveal Cards

1. **Wait** until everyone has voted (✓ for all participants)
2. **Click** on **"Reveal"**
3. **See** the results:
   - Selected card for each participant
   - **Average** (arithmetic mean)
   - **Median** (middle value)
   - **Range** (lowest to highest value)
   - **Outliers** (values that deviate significantly)

#### Reset Round

1. **After discussion** click on **"Reset"**
2. **All votes** are cleared
3. **Next round** can begin

### Adjust Settings (Menu)

Click on **[⋮ Menu]** in the top right to open settings:

#### 📊 Switch Card Set

Different sequences for different estimation methods:

- **Fibonacci** (Standard): 1, 2, 3, 5, 8, 13, 21
- **Fibonacci Extended**: 0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, ∞
- **T-Shirt Sizes**: XS, S, M, L, XL, XXL
- **Powers of Two**: 1, 2, 4, 8, 16, 32, 64

**When to switch?**
- **T-Shirt Sizes** → Quick, rough estimates
- **Fibonacci Extended** → When very large or very small tasks are involved
- **Powers of Two** → Technical tasks (often used in DevOps)

#### ⚡ Auto-Reveal

**Enabled:** Cards are automatically revealed once everyone has voted  
**Disabled:** Moderator must manually click "Reveal"

**Recommendation:** Enable for quick sessions, disable when time for discussion before revealing is desired.

#### ☕ Special Cards

**Enabled:** Shows additional cards (☕, 🔭, ⏳, etc.)  
**Disabled:** Only numbers and question mark

#### 📋 Show Topic

**Enabled:** Topic is visible to everyone  
**Disabled:** Topic is hidden (but saved)

#### 👓 Spectator Mode

As a participant, you can switch between **Participant** and **Spectator**:

- **Participant:** Your vote counts
- **Spectator:** You see everything, but your vote doesn't count (e.g., for stakeholders who only observe)

---

## Frequently Asked Questions (FAQ)

### How many people can participate?

Theoretically unlimited, but **5-10 people** are ideal for Planning Poker.

### What happens if someone loses connection?

- **Brief interruption** (<5 seconds): Automatic reconnection
- **Longer interruption**: Participant is marked as "disconnected" (grayed out)
- **Return**: Simply reload the page – the chosen name is recognized again

### What happens to the moderator if they lose connection?

Another participant is **automatically promoted to new moderator**. If the original moderator returns, they can reclaim the role.

### Is data saved?

**By default:** No. Everything runs in the server's memory and is lost when everyone leaves the room.

**Optional:** The server can be configured to save rooms as snapshots (for later resumption).

### Can someone see others' votes before revealing?

**No!** This is the core of Planning Poker: Nobody sees others' votes until the moderator reveals them. This prevents early estimates from influencing later ones.

### How long does a room stay active?

A room stays active as long as at least one person is connected. When everyone leaves, it's automatically closed after a short time (without persistence).

### Can I find an existing room again?

Only via the **link**! There's no room list. Save the link if you want to return later.

### Does it work on smartphones?

Yes! The interface automatically adapts to small screens. Best used in landscape mode for better overview.

---

## Tips for Effective Sessions

### 🎯 Preparation

- **Prepare topics in advance**: Have a list of user stories/tasks ready
- **Invite all participants**: Ensure everyone has the link
- **Clarify Definition of Done**: Team should know what "done" means

### 💡 During the Session

- **Timebox per story**: Max. 5 minutes per estimate
- **With large differences**: Have people with highest/lowest estimates explain
- **Second round**: If needed, vote again after discussion
- **Plan breaks**: Short break after 45-60 minutes

### ⚖️ Handling Outliers

When someone estimates **much higher** or **lower** than the rest:

1. **Ask** why this person estimates that way
2. **Listen** – often there are important aspects others overlooked
3. **Discuss** – align team understanding
4. **Vote again** – with new knowledge

### 🚫 Avoid Common Mistakes

- **Too much discussion**: At 3-5 minutes without consensus → split story or discuss later
- **First person influences**: That's why **only reveal** when everyone has chosen
- **Getting too technical**: Focus on "How much work?" not "How do we do it?"
- **Perfectionism**: Planning Poker is a rough estimate, not an exact value!

---

## Keyboard Shortcuts (for Power Users)

| Key | Function |
|-----|----------|
| **1-9** | Select card with corresponding number |
| **?** | Select question mark card |
| **Space** | Open/close menu |
| **R** | Reset round (moderator only) |
| **V** | Reveal (moderator only) |
| **Esc** | Close menu |

---

## Troubleshooting

### Problem: I can't select a card

**Solution:**
- Check if you're marked as **Spectator** (switch in menu)
- Ensure you're connected to the internet
- Reload the page (F5)

### Problem: I don't see other participants

**Solution:**
- Check if you're in the correct room (verify link)
- Reload the page (F5)
- Ensure others have actually joined

### Problem: My name is already taken

**Solution:**
- The server automatically adds a number (e.g., "Maria" → "Maria-2")
- Or: Choose a unique name when joining

### Problem: Page won't load

**Solution:**
- Check your internet connection
- Clear browser cache (Ctrl+Shift+R / Cmd+Shift+R)
- Try a different browser
- Check if the app is online: https://ep.rbsnet.at/

### Problem: WebSocket connection fails

**Solution:**
- Check if your company blocks WebSockets (firewall/proxy)
- Try private/incognito mode
- Contact your IT support

---

## Example Session

### Scenario: Sprint Planning for 5 User Stories

**Participants:**
- Maria (Scrum Master, Moderator)
- Tom (Developer)
- Sarah (Developer)
- Alex (QA)
- Chris (Product Owner, Spectator)

**Timeline:**

1. **10:00** – Maria creates room "Sprint24-Planning"
2. **10:02** – All team members have joined
3. **10:05** – Chris switches to spectator mode (doesn't want to estimate)
4. **10:05** – Maria enters first topic: "USER-123: Login functionality"
5. **10:07** – Everyone has voted:
   - Maria: 5
   - Tom: 8
   - Sarah: 5
   - Alex: 8
6. **10:08** – Revealed: Average 6.5, Median 6.5
7. **10:09** – Discussion: Tom and Alex explain their 8 (testing effort)
8. **10:12** – Second vote: Everyone chooses 8 → **Consensus!**
9. **10:12** – Maria resets
10. **10:13** – Next topic: "USER-124: Forgot password"
11. ... (more stories)
12. **11:00** – Session ended, results entered in JIRA

**Result:** 5 stories estimated in 60 minutes

---

## For Team Leads: Introducing to the Team

### Preparation

1. **Demo session** with 2-3 colleagues in advance
2. **Establish rules**: How do we handle outliers? When second round?
3. **Define card values**: What does a "5" mean to us? (e.g., 2 days of work)
4. **Prepare link**: Create room in advance, include link in invitation

### First Session

1. **5 min**: Briefly introduce and demonstrate the tool
2. **5 min**: Estimate one simple story as practice
3. **40 min**: Estimate real stories
4. **10 min**: Retrospective: What went well? What can we improve?

### Establish Best Practices

- **Fixed time**: E.g., every Tuesday 10:00-11:00
- **Preparation**: Product Owner prepares stories
- **Timeboxing**: Max. 5 minutes per story
- **Focus**: Only estimate, don't design

---

## Glossary

| Term | Explanation |
|------|-------------|
| **Planning Poker** | Estimation method for agile teams where everyone votes simultaneously |
| **Story Points** | Relative unit of effort (not a time estimate!) |
| **Moderator/Host** | Person leading the session (can set topic, reveal, etc.) |
| **Spectator** | Participant who only watches but doesn't vote |
| **Average** | Arithmetic mean of all votes |
| **Median** | Middle value (divides votes into two halves) |
| **Outlier** | Votes that deviate significantly from the average |
| **Consensus** | Everyone has chosen the same card |
| **Fibonacci Sequence** | 1, 2, 3, 5, 8, 13, 21... (each number is the sum of the two preceding ones) |

---

## Contact & Support

**Live App:** https://ep.rbsnet.at/  
**GitHub:** https://github.com/nox-vobiscum/estpoker  
**Documentation:** https://github.com/nox-vobiscum/estpoker/tree/main/docs

**For problems:**
1. Check this guide and [Troubleshooting](#troubleshooting)
2. Create an issue on GitHub
3. Contact your team lead or IT support

---

*Last updated: 2026-07-22*
