# Food Rescue Platform 🥗🤝

An interactive, real-time dual-sided digital exhibition and logistics platform connecting food donors (restaurants, hotels, messes, bakeries) with food receivers (charities, food banks, shelters).

Built with **Node.js**, **Express**, **MongoDB Atlas (Mongoose)**, **Socket.io**, **Vite (Vanilla JS & CSS)**, and **Firebase Authentication**.

---

## 📁 Project Architecture

```text
food-rescue-platform/
├── backend/
│   ├── src/
│   │   ├── models/
│   │   │   ├── User.js              # Extended user schema with organization metadata
│   │   │   ├── Donation.js          # Surplus items with approval & handoff states
│   │   │   └── Feedback.js          # Platform feedback & suggestions schema
│   │   ├── routes/
│   │   │   ├── auth.js              # Profile sync & UID lookup
│   │   │   ├── donations.js         # Surplus CRUD, claim request, approve, decline & complete
│   │   │   └── feedback.js          # Feedback submission & email dispatch
│   │   └── services/
│   │       └── emailService.js      # Nodemailer receipt delivery
│   ├── .env.example                 # Example environment variables
│   ├── package.json                 # Express, Mongoose, Socket.io, Nodemailer, CORS, Dotenv
│   └── server.js                    # Express + HTTP + Socket.io server (port 5000)
│
├── frontend/
│   ├── src/
│   │   ├── css/
│   │   │   ├── style.css            # Dark obsidian palette, neon tokens, typography
│   │   │   └── grid.css             # Asymmetrical gallery grid rules
│   │   └── js/
│   │       ├── auth.js              # Firebase Email/Password, Google OAuth & Magic Link
│   │       ├── donor.js             # Live Surplus Monitor, approvals, Chart.js ESG, history
│   │       ├── receiver.js          # Proximity-sorted feed, claim requests, QR generation
│   │       └── feedbackHelper.js    # Reusable feedback modal & logout handler
│   ├── index.html                   # Unified Authentication Hub
│   ├── donor.html                   # Donor Dashboard
│   ├── receiver.html                # Receiver Archive Feed
│   ├── vite.config.js               # Multi-page Vite configuration
│   └── package.json                 # Vite, Chart.js, QRCode, Socket.io-client, Firebase
│
├── .gitignore                       # Root ignore rules (protects .env and node_modules)
└── README.md                        # Project documentation & team handoff guide
```

---

## ⚡ Quick Start for Development

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [Git](https://git-scm.com/)

### 2. Backend Setup
1. Open a terminal and navigate to `backend`:
   ```bash
   cd backend
   npm install
   ```
2. Create your `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```
3. Populate `MONGO_URI` in `backend/.env` with your MongoDB Atlas connection string.
4. Start the backend API server:
   ```bash
   node server.js
   ```
   *The backend will listen on `http://localhost:5000` and connect to MongoDB Atlas.*

### 3. Frontend Setup
1. In a second terminal, navigate to `frontend`:
   ```bash
   cd frontend
   npm install
   ```
2. Start the Vite dev server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:5173` in your browser.

---

## 🔌 API Reference & Endpoints

### Authentication (`/api/auth`)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/sync` | Creates or updates user profile in MongoDB from Firebase UID |
| `GET` | `/api/auth/:uid` | Retrieves full profile metadata for a user |

### Donations & Logistics (`/api/donations`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/donations` | Fetches all available surplus items for the receiver feed |
| `GET` | `/api/donations/donor/:donorUid` | Fetches all listings by a specific donor (active + history) |
| `POST` | `/api/donations` | Lists a new surplus item |
| `PUT` | `/api/donations/:id/claim` | Receiver requests a claim (sets status to `pending_approval`) |
| `PUT` | `/api/donations/:id/approve` | Donor approves the claim (sets status to `claimed`) |
| `PUT` | `/api/donations/:id/reject` | Donor declines the claim (restores status to `available`) |
| `PUT` | `/api/donations/:id/complete` | Donor completes physical handoff (sets status to `completed`) |

### Feedback & Email Receipts (`/api/feedback`)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/feedback` | Saves feedback and emails a copy to the user |
| `GET` | `/api/feedback` | Lists submitted feedback records |

---

## 📡 Real-Time Socket.io Events

The platform uses bi-directional Socket.io events for zero-refresh synchronization:

| Event Name | Payload | Description |
|---|---|---|
| `new_donation` | `Donation` | Broadcast when a donor exhibits a new surplus item |
| `claim_requested` | `Donation` | Broadcast when a receiver requests to claim an item |
| `claim_approved` | `Donation` | Broadcast when the donor approves the request |
| `claim_rejected` | `{ donationId, receiverUid, foodItem }` | Broadcast when the donor declines the request |
| `donation_completed` | `Donation` | Broadcast when physical pickup is confirmed |
| `donation_restored` | `Donation` | Broadcast when an item returns to the public feed |

---

## 🎨 UI/UX Guidelines for Design Partner

1. **Color Tokens**:
   - Background Obsidian: `#0f0f11`
   - Surface Charcoal: `#1a1a1c`
   - Electric Lime (Action / Available): `#ccff00`
   - Electric Tangerine (Donor / Approval Alert): `#ff6b35`
   - Electric Violet (Receiver / Claimed): `#b5179e`
   - Electric Cyan (Handoff Completed): `#00f0ff`
2. **Typography**:
   - Headlines: `'Playfair Display', serif`
   - Body & UI: `'Space Grotesk', sans-serif`
3. **Responsive Views**:
   - `index.html`: Unified authentication hub (Role selector, Sign-in, Register, Google OAuth, Magic Link)
   - `donor.html`: Surplus form, ESG Impact Chart, Live Surplus Monitor, Handoff verification, Exhibition Archive
   - `receiver.html`: Asymmetrical rescue grid, proximity sorting, QR modal
