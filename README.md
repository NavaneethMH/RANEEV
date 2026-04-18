<div align="center">

# 🚨 RANEEV
### Rapid Assistance Network for Emergency & Essential Volunteerism

*A real-time, AI-powered emergency response platform that connects people in distress with nearby volunteers — reducing response time from 20–30 minutes to under 5 minutes.*

<br/>

**React** · **Vite** · **FastAPI** · **Tailwind CSS** · **SQLite** · **Python**

`MIT License` · `PRs Welcome` · `Status: Active Development`

</div>

---

## 🌍 What is RANEEV?

> **"Every second counts in an emergency. RANEEV makes sure help is never more than minutes away."**

RANEEV is a community-powered emergency response web app with three operational modes:

| Mode | Symbol | Purpose |
|------|--------|---------|
| **ERN** — Emergency Response Network | 🔴 | General SOS distress signal → finds nearest volunteers instantly |
| **GHR** — Golden Hour Response | 🟡 | AI-assisted medical emergencies → top responders + first aid guidance |
| **LVM** — Live Volunteer Mode | 🟢 | Volunteers go active on map → receive & respond to nearby alerts |

---

## ✨ Key Features

- 🆘 **One-tap SOS** with real-time location broadcasting
- 🤖 **AI Volunteer Matching** — ranks responders by distance, skill & trust score
- 🗺️ **Live Map** — shows active volunteers (green), SOS alerts (red), medical cases (yellow)
- 🏥 **In-app First Aid Guidance** for Golden Hour medical emergencies
- 🔔 **Push Notifications** via Firebase for instant volunteer alerting
- 🏅 **Trust & Reputation System** — badges, scores, leaderboard
- 🪙 **Volunteer Coin Wallet** — earn coins for helping, redeem real rewards
- 🎁 **Redeem Store** — vouchers, kits, certificates, and more
- 📱 **Responsive UI** — works on desktop and mobile browsers

---

## 🛠️ Tech Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                         RANEEV STACK                            │
├──────────────────────────┬──────────────────────────────────────┤
│  Frontend                │  Backend                             │
│  ─────────────────────   │  ──────────────────────────────────  │
│  ⚡ Vite (build tool)    │  🐍 FastAPI (Python)                 │
│  ⚛️  React.js            │  🗄️  SQLite (database)               │
│  🎨 Tailwind CSS         │  🤖 Python AI matching engine        │
│  🎞️  Framer Motion       │  🔔 Firebase (notifications)         │
│  🗺️  Google Maps React   │  📍 Google Maps API                  │
└──────────────────────────┴──────────────────────────────────────┘
```

---

## 🚀 Getting Started

### Prerequisites

Make sure you have these installed on your computer:

- [Node.js](https://nodejs.org) (v18 or higher)
- [Python](https://python.org) (v3.10 or higher)
- [Git](https://git-scm.com)

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/your-username/raneev.git
cd raneev
```

### 2️⃣ Start the Backend (FastAPI + Python)

```bash
# Go into the server folder
cd server

# Create a virtual environment (like a clean workspace for Python)
python -m venv .venv

# Activate the virtual environment
# On Windows:
.\.venv\Scripts\activate
# On Mac/Linux:
source .venv/bin/activate

# Install all required Python packages
pip install -r requirements.txt

# Start the backend server
uvicorn main:app --reload --port 8000
```

✅ Backend is running at: **`http://localhost:8000`**  
📖 Auto-generated API docs at: **`http://localhost:8000/docs`**

### 3️⃣ Start the Frontend (React + Vite)

Open a **new terminal window**, then:

```bash
# Go into the client folder
cd client

# Install all required packages
npm install

# Start the frontend development server
npm run dev
```

✅ Frontend is running at: **`http://localhost:5173`**

---

## 📁 Project Structure

```
raneev/
│
├── 📂 client/                  ← React frontend
│   ├── src/
│   │   ├── screens/            ← App screens (Home, ERN, GHR, LVM...)
│   │   ├── components/         ← Reusable UI parts (SOSButton, Map...)
│   │   ├── api.js              ← All backend API calls
│   │   └── App.jsx             ← Main app + routing
│   ├── public/
│   └── package.json
│
├── 📂 server/                  ← FastAPI backend
│   ├── main.py                 ← API endpoints (SOS, volunteers, redeem...)
│   ├── matching.py             ← AI volunteer matching engine
│   ├── database.py             ← SQLite database setup
│   ├── models.py               ← Data models
│   └── requirements.txt        ← Python dependencies
│
└── README.md
```

---

## 🤖 How the AI Matching Engine Works

When a user triggers an SOS, RANEEV's Python algorithm scores every nearby live volunteer and picks the **top 5** to alert — all within milliseconds.

```python
def match_score(distance_km, trust_score, has_required_skill, is_available):
    if not is_available:
        return 0                                  # Skip offline volunteers

    distance_score = (1 / distance_km) * 40      # Closer = much better
    trust_pts      = trust_score * 0.3            # Higher trust = better
    skill_bonus    = 20 if has_required_skill else 0  # Skill match bonus

    return round(distance_score + trust_pts + skill_bonus, 2)
```

| Factor | Weight | Why it matters |
|--------|--------|---------------|
| 📍 Distance | 40% | Closer volunteers arrive faster |
| ⭐ Trust Score | 30% | Reliable volunteers are prioritized |
| 🩺 Skill Match | 20% | Right skills for the emergency type |
| ✅ Availability | 10% | Only live/active volunteers are matched |

---

## 🎮 App Screens

| Screen | Description |
|--------|-------------|
| 🔐 **Auth** | Sign up / Login with optional skill tagging |
| 🏠 **Home** | Dashboard with stats + 3 mode buttons |
| 🆘 **ERN** | Big SOS button → broadcasts location → shows nearest volunteers |
| 🏥 **GHR** | AI severity assessment → top responders → first aid guide |
| 🗺️ **LVM** | Live map → toggle active → accept/decline emergency alerts |
| 👤 **Profile** | Trust score, badges, coin wallet, activity history |
| 🎁 **Redeem Store** | Spend coins on vouchers, kits, certificates & more |

---

## 🪙 Volunteer Reward System

Volunteers earn **coins** for every action:

| Action | Coins Earned |
|--------|-------------|
| Going Live on map | +10 🪙 |
| Accepting an alert | +50 🪙 |
| Completing a help | +100 🪙 |
| Fast response bonus (< 3 min) | +25 🪙 |
| Medical emergency assist | +150 🪙 |

Coins can be redeemed in the **Redeem Store** for:
- 🛒 Amazon / Swiggy / Flipkart gift vouchers
- 🧰 First Aid kits (delivered to your door)
- 📜 Certificates (digital + ministry verified)
- 💗 CPR & First Aid training course passes
- 🏆 Gold volunteer badge for your profile

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/sos` | Trigger emergency SOS |
| `POST` | `/volunteer/golive` | Volunteer goes live on map |
| `GET` | `/volunteers/nearby` | Get nearby active volunteers |
| `POST` | `/volunteer/accept` | Accept an emergency alert |
| `GET` | `/user/{id}` | Get user profile & coins |
| `POST` | `/redeem` | Redeem coins for a reward |
| `GET` | `/leaderboard` | Top volunteers by score |

Full interactive API documentation available at `http://localhost:8000/docs` when the backend is running.

---

## 🗺️ Roadmap

- [x] Interactive UI prototype (all screens)
- [x] Volunteer coin wallet & Redeem Store
- [x] AI volunteer matching algorithm
- [ ] FastAPI backend — core endpoints
- [ ] SQLite database integration
- [ ] Google Maps live volunteer tracking
- [ ] Firebase push notifications
- [ ] SMS fallback for low-network areas
- [ ] Voice-trigger SOS
- [ ] Crash detection (sensor-based)
- [ ] Admin dashboard for monitoring
- [ ] Mobile app (React Native / Flutter)

---

## 🤝 Contributing

Contributions are what make open source amazing! Here's how you can help:

1. **Fork** this repository
2. Create your feature branch: `git checkout -b feature/add-crash-detection`
3. Commit your changes: `git commit -m 'Add crash detection using accelerometer'`
4. Push to the branch: `git push origin feature/add-crash-detection`
5. Open a **Pull Request**

Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting.

---

## 🐛 Found a Bug?

Open an [issue](https://github.com/your-username/raneev/issues) with:
- What you expected to happen
- What actually happened
- Steps to reproduce it

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Author

**Navaneeth**  
CSE Student | VTU  
Building RANEEV to save lives with technology 🚑

[GitHub](https://github.com/your-username)
