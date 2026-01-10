# Copilot Instructions for FootballPro

## Project Architecture
- **Monorepo** with three main apps: `backend/` (Node.js/Express/Sequelize/PostgreSQL), `frontend/` (React 18/Vite/Tailwind), and `mobile/` (React Native/Expo).
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
- **Payments**: Stripe integration, test key fallback if not configured.
- **Real-time**: Socket.IO for chat, notifications, and (planned) video call signaling.

## Integration Points
- **Stripe**: Payments via `/api/payments/*`, see `STRIPE_SETUP.md`.
- **Email**: Nodemailer with Gmail, see `EMAIL_SETUP.md`.
- **Video Calls**: WebRTC, signaling via Socket.IO (planned), see `VIDEO_CALLS.md`.
- **Live Streaming**: Planned, see `LIVESTREAM_SETUP.md`.

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
