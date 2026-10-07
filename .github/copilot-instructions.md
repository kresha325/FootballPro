# Copilot Instructions for FootballPro

## Project Architecture
- **Monorepo** with three main apps: `backend/` (Node.js/Express/Sequelize/PostgreSQL), `frontend/` (React 19/Vite/Tailwind 3), and `mobile/` (React Native/Expo). The public site is xtalenti.com. The API host is footballpro.onrender.com.
- **Backend**: Organized by feature with `controllers/`, `models/`, `routes/`, `middleware/`, and `services/`. Uses JWT auth, Passport.js, Multer for uploads, Stripe for payments, Nodemailer for email, and Socket.IO for real-time messaging.
- **Frontend**: React app with Context API for state, React Router, Axios for API, and Tailwind for styling. Organized by `components/`, `contexts/`, `services/`, and `assets/`.
- **Mobile**: React Native app, navigation via React Navigation, API utils in `utils/`.

## Key Workflows
- **Backend**: 
  - Install: `cd backend && npm install`
  - Run: `npm run dev` (uses `.env` for config)
  - Migrate DB: `npm run migrate`
- **Frontend**: 
  - Install: `cd frontend && npm install`
  - Run: `npm run dev`
- **Mobile**: 
  - Install: `cd mobile && npm install`
  - Run: `npm start` (or `npm run web`)

## Conventions & Patterns
- **Controllers**: One per feature (e.g., `controllers/analytics.js`, `controllers/gamification.js`).
- **Models**: Sequelize models in `models/`, named singular (e.g., `Achievement.js`).
- **Routes**: RESTful, grouped by resource (e.g., `/api/posts`, `/api/auth`).
- **Middleware**: Auth, admin, and upload logic in `middleware/`.
- **Docs**: See `/docs` for feature and integration details (e.g., `EMAIL_SETUP.md`, `STRIPE_SETUP.md`).
- **Roles**: 7 user roles (Athlete, Coach, Scout, Club, Agent, Business, Media) with role-based access.
- **Gamification**: XP, achievements, badges, and leaderboards in backend and surfaced in frontend.
- **Payments**: Stripe exists, but live card charges stay off unless `PAYMENTS_ENABLED=true`.
- **Real-time**: Socket.IO for chat, notifications, and call signaling. LiveKit carries the audio and video for calls and live rooms.

## Integration Points
- **Stripe**: Payments via `/api/payments/*`, see `STRIPE_SETUP.md`.
- **Email**: Nodemailer with Gmail, see `EMAIL_SETUP.md`.
- **Video Calls**: Implemented. Socket.IO signals the call. LiveKit issues the room token from `POST /api/livekit/token`. See `docs/VIDEO_CALLS.md`.
- **Live Streaming**: Implemented on LiveKit (`stream-{id}` rooms, public or unlisted live rooms for anonymous viewers). `mediasoup-server/` is deprecated and still referenced. See `docs/LIVESTREAM_SETUP.md`.

## Examples
- Add a new API: Create controller, model, and route file, register in `server.js`.
- Add a frontend feature: Create React component, add to `src/components/`, update context/service if needed.
- Add a mobile screen: Create in `mobile/screens/`, add to navigation.

## Tips
- Use `.env.example` as a template for environment variables.
- For full API, see Postman collection in `/docs`.
- For new features, follow existing file and folder naming patterns.

---
For more, see `README.md` and `/docs`.
