# 🎯 QUICK START GUIDE - FootballPro Development

## ⚡ 5-MINUTE SETUP

### 1. Clone & Install
```bash
git clone https://github.com/kresha325/FootballPro.git
cd FootballPro

# Backend
cd backend && npm install && cd ..

# Frontend  
cd frontend && npm install && cd ..

# Mobile (use legacy-peer-deps for React 18 compatibility)
cd mobile && npm install --legacy-peer-deps && cd ..
```

### 2. Environment Setup
Create `.env` files in each directory:

**backend/.env**
```
DATABASE_URL=postgresql://user:password@localhost:5432/footballpro
JWT_SECRET=your_super_secret_key_here
STRIPE_SECRET_KEY=sk_test_xxxxx
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
NODE_ENV=development
PORT=5098
```

**frontend/.env.local**
```
VITE_API_URL=http://localhost:5098
VITE_APP_NAME=FootballPro
```

**mobile/.env**
```
EXPO_PUBLIC_API_URL=http://localhost:5098
EXPO_PUBLIC_APP_NAME=FootballPro
```

### 3. Start All Services
```bash
# Terminal 1: Backend
cd backend && npm run dev
# Listens on http://localhost:5098

# Terminal 2: Frontend
cd frontend && npm run dev
# Listens on http://localhost:5174

# Terminal 3: Mobile
cd mobile && npm start
# Press 'a' for Android or 'i' for iOS
```

---

## 📁 PROJECT STRUCTURE

```
FootballPro/
├── backend/                 # Node.js + Express + PostgreSQL
│   ├── controllers/         # Business logic
│   ├── models/              # Database models (Sequelize)
│   ├── routes/              # API endpoints
│   ├── services/            # Email, payment, etc
│   └── socket.js            # Real-time features
│
├── frontend/                # React 19 + Vite
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/           # Page components
│   │   ├── api/             # API calls
│   │   └── styles/          # Tailwind CSS
│   └── package.json         # Frontend dependencies
│
├── mobile/                  # React Native + Expo
│   ├── src/
│   │   ├── screens/         # Mobile screens
│   │   ├── navigation/      # React Navigation
│   │   ├── api/             # API client
│   │   └── context/         # State management
│   └── app.json             # Expo config
│
└── docs/                    # Documentation
```

---

## 🎮 KEY FEATURES IMPLEMENTED

### ✅ Gamification System
- 📊 Level & XP progression
- 🏆 Achievement tracking (15 achievements)
- 🎖️ Badge rarity system (Legendary, Epic, Rare, Uncommon)
- 🏁 Global leaderboard
- **Mobile Screen**: `GamificationScreen.js`

### ✅ Real-Time Messaging
- 💬 1-on-1 conversations
- ✅ Read receipts (single/double check marks)
- ⌨️ Typing indicators
- 📎 File attachments
- 🕐 Message timestamps
- **Mobile Screen**: `ConversationScreen.js`

### ✅ Live Streaming
- 📡 Stream playback with WebView
- 💬 Native chat panel
- 👁️ Real-time viewer count
- 🔴 Live indicator badge
- 📊 Quality selector (Auto/720p/480p/360p/240p)
- **Mobile Screen**: `LiveViewerScreen.js`

### ✅ Analytics Dashboard
- 📊 Interactive charts (Victory.js)
- 📈 Engagement metrics
- 👥 Follower trends
- 🎮 Gamification stats
- **Mobile Screen**: `InsightsScreen.js`

### ✅ Advanced Search
- 🔍 Search users with filters (position, club)
- 🏢 Search posts by date range & likes
- 💡 Trending content discovery
- **Mobile Screen**: `SearchScreen.js`

---

## 🧪 TESTING

### Run Tests
```bash
# Backend (if tests are configured)
cd backend && npm test

# Frontend (if tests are configured)  
cd frontend && npm test

# Mobile (if tests are configured)
cd mobile && npm test
```

### Manual Testing Checklist
- [ ] Login works on all platforms
- [ ] Gamification stats display correctly
- [ ] Messages send and receive in real-time
- [ ] Charts render without errors
- [ ] Live streams play and pause
- [ ] Search filters work as expected
- [ ] Mobile and web look identical

---

## 🚀 DEPLOYMENT

### To Staging
```bash
# Build and deploy frontend to staging
cd frontend && npm run build && vercel --scope=footballpro

# Deploy backend (configure your server)
# Deploy mobile to staging via EAS
```

### To Production
```bash
# Deploy everything
bash deploy.sh
# Select option 3 (Production)
```

---

## 🐛 COMMON ISSUES

### Port Already in Use
```bash
# Kill process on port 5098
lsof -ti:5098 | xargs kill -9

# Or change port in backend/.env
PORT=5099
```

### Database Connection Failed
```bash
# Check PostgreSQL is running
psql -U postgres -d footballpro -c "SELECT 1;"

# Or check MySQL
mysql -u root -p footballpro -e "SELECT 1;"
```

### Mobile App Won't Start
```bash
# Clear Expo cache
cd mobile && expo start --clear

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

### Charts Not Rendering
```bash
# Verify victory-native is installed
npm list victory-native

# Reinstall if missing
npm install victory-native --legacy-peer-deps
```

---

## 📊 API ENDPOINTS

### Authentication
```
POST   /api/auth/register         # Create account
POST   /api/auth/login            # Login
POST   /api/auth/forgot-password  # Password reset
POST   /api/auth/refresh-token    # Get new JWT
```

### Gamification
```
GET    /api/gamification/user-status      # User stats
GET    /api/gamification/achievements     # All achievements
GET    /api/gamification/badges           # All badges
GET    /api/gamification/leaderboard      # Top players
```

### Messaging
```
GET    /api/conversations                 # All conversations
GET    /api/conversations/:id/messages    # Messages in conversation
POST   /api/conversations/:id/messages    # Send message
PUT    /api/conversations/:id/read        # Mark read
```

### Analytics
```
GET    /api/dashboard/overview            # User dashboard
GET    /api/dashboard/analytics           # Detailed analytics
GET    /api/dashboard/engagement          # Engagement data
```

### Search
```
GET    /api/search/users?q=name&position=GK&club=Arsenal
GET    /api/search/posts?q=term&dateRange=week&minLikes=10
GET    /api/search/everything?q=term     # Search all content
```

---

## 🔧 ENVIRONMENT VARIABLES

### Backend (.env)
```
DATABASE_URL          - PostgreSQL connection string
JWT_SECRET            - Secret key for JWT tokens
STRIPE_SECRET_KEY     - Stripe API key
EMAIL_USER            - Gmail account for emails
EMAIL_PASSWORD        - Gmail app password
NODE_ENV              - development/staging/production
PORT                  - Server port (default: 5098)
SOCKET_PORT           - WebSocket port (default: 5099)
FIREBASE_PROJECT_ID   - Firebase project (optional)
CLOUDINARY_URL        - Cloudinary URL for images
```

### Frontend (.env.local)
```
VITE_API_URL          - Backend API URL
VITE_APP_NAME         - App name
VITE_STRIPE_KEY       - Stripe public key
```

### Mobile (.env)
```
EXPO_PUBLIC_API_URL   - Backend API URL
EXPO_PUBLIC_APP_NAME  - App name
```

---

## 📝 USEFUL COMMANDS

```bash
# Reset everything
git reset --hard HEAD

# Clean dependencies
rm -rf node_modules package-lock.json

# Check installed packages
npm list --depth=0

# Update dependencies (carefully!)
npm update

# Find unused dependencies
npm audit

# View logs
tail -f logs/app.log
```

---

## 💡 DEVELOPMENT TIPS

1. **Use VS Code Extensions**
   - ES7+ React/Redux/React-Native snippets
   - Tailwind CSS IntelliSense
   - Prettier - Code formatter

2. **Enable Hot Reload**
   ```bash
   frontend: npm run dev  # Auto-reloads on save
   mobile: npm start      # Fast refresh enabled
   ```

3. **Debug Mobile App**
   - Install Expo DevTools app
   - Press 'j' in Expo CLI to open debugger
   - Use console.log for logging

4. **Monitor Backend**
   ```bash
   # Watch for changes
   npm run dev

   # View logs
   tail -f logs/backend.log
   ```

---

## 🆘 GET HELP

- 📖 Check `docs/` folder for detailed guides
- 🐛 Create GitHub issue with error details
- 💬 Ping #backend, #frontend, #mobile on Discord
- 📞 Email: support@footballpro.com

---

## 🎉 YOU'RE ALL SET!

Start developing:
```bash
# Open 3 terminals and run:
cd backend && npm run dev
cd frontend && npm run dev  
cd mobile && npm start
```

Happy coding! 🚀
