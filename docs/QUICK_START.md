# FootballPro - Quick Start Guide

Get FootballPro up and running in 10 minutes! ⚡

---

## 🚀 Quick Setup (Development)

### 1. Prerequisites Check

```bash
# Check Node.js (need 16+)
node --version

# Check PostgreSQL (need 12+)
psql --version

# Check npm
npm --version
```

### 2. Clone & Install

```bash
# Navigate to project
cd c:\Users\Urim\Desktop\FootballPro

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 3. Database Setup

```bash
# Create database
psql -U postgres
CREATE DATABASE footballpro;
\q

# Update DATABASE_URL in backend/.env
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/footballpro
```

### 4. Environment Configuration

**Backend (.env):**
```env
# Required
DATABASE_URL=postgresql://postgres:password@localhost:5432/footballpro
JWT_SECRET=mysecretkey123
PORT=5098

# Optional (for full features)
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
FRONTEND_URL=http://192.168.100.57:5174
```

**Frontend (.env):**
```env
VITE_API_URL=http://192.168.100.57:5098/api
```

### 5. Start Servers

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
# Server running on http://192.168.100.57:5098
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
# App running on http://192.168.100.57:5174
```

### 6. Test It!

1. Open http://192.168.100.57:5174
2. Click "Register" → Create an account
3. Choose role (Athlete, Coach, Scout, etc.)
4. Explore the platform!

---

## 🎯 Essential Features Setup

### Enable Email Notifications (5 minutes)

1. Go to [Google Account](https://myaccount.google.com/)
2. Enable 2-Factor Authentication
3. Go to [App Passwords](https://myaccount.google.com/apppasswords)
4. Create new app password
5. Copy password to `backend/.env`:
   ```env
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=abcd efgh ijkl mnop
   ```
6. Restart backend server
7. Test: Register new user → Check welcome email ✅

### Enable Stripe Payments (10 minutes)

1. Create account at [stripe.com](https://stripe.com)
2. Go to Dashboard → Developers → API Keys
3. Copy "Secret key" (starts with `sk_test_`)
4. Add to `backend/.env`:
   ```env
   STRIPE_SECRET_KEY=sk_test_51Abc...
   ```
5. Restart backend
6. Test:
   - Go to Marketplace
   - Click "Buy Now"
   - Use test card: `4242 4242 4242 4242`
   - Any future date, any CVC
   - Complete → Order created ✅

### Video Calls (Already Working!)

- Click any user profile
- Click "Video Call" button (green)
- Grant camera/microphone permissions
- Local video appears immediately
- (Currently simulated - see VIDEO_CALLS.md for production setup)

---

## 👤 Test Accounts

Create these for testing:

1. **Athlete** (Player)
   - Email: athlete@test.com
   - Password: Test123!
   - Role: athlete

2. **Club**
   - Email: club@test.com
   - Password: Test123!
   - Role: club

3. **Scout**
   - Email: scout@test.com
   - Password: Test123!
   - Role: scout

---

## 🧪 Quick Feature Tests

### Test Social Feed
```
1. Login as Athlete
2. Create post with image
3. Login as another user
4. Like and comment on post
5. Check notifications
```

### Test Roster System
```
1. Login as Athlete
2. Go to club profile
3. Submit roster request
4. Login as Club
5. Go to pending requests
6. Approve request
7. Check athlete's email ✅
```

### Test Tournament
```
1. Login as Club
2. Create tournament (league or knockout)
3. Login as other clubs
4. Join tournament (need 2+ participants)
5. Login as creator
6. Click "Start Tournament"
7. Matches auto-generated ✅
8. Enter match results
9. See standings update
```

### Test Scouting
```
1. Login as Scout
2. Go to /api/scouting/recommendations
3. See ranked athletes with scores
4. Filter: ?position=Forward
```

---

## 🔧 Troubleshooting

### Port Already in Use
```bash
# Windows
netstat -ano | findstr :5098
taskkill /PID <PID> /F

# Mac/Linux
lsof -ti:5098 | xargs kill -9
```

### Database Connection Error
```bash
# Check PostgreSQL is running
# Windows:
services.msc → PostgreSQL → Start

# Mac:
brew services start postgresql

# Linux:
sudo systemctl start postgresql
```

### Email Not Sending
- Check EMAIL_USER and EMAIL_PASSWORD in .env
- Verify 2FA enabled on Gmail
- Verify app password is correct (16 characters, no spaces)
- Check server logs for errors

### Stripe Webhook Not Working
- For local development: Webhooks won't work
- Use Stripe CLI for testing: `stripe listen --forward-to localhost:5098/api/payments/webhook`
- Or test without webhooks (orders created on frontend success page)

### Video Call Not Connecting
- Currently simulated (2-second timeout)
- For production: Need Socket.IO server
- See VIDEO_CALLS.md for full setup

---

## 📱 Mobile App (Optional)

```bash
cd mobile
npm install
npm start

# Scan QR code with Expo Go app
# Or press 'a' for Android emulator
# Or press 'i' for iOS simulator
```

---

## 🎨 Default Users (After Seeding)

If you run seed scripts:

```javascript
// backend/seeds/defaultUsers.js
{
  email: 'admin@footballpro.al',
  password: 'Admin123!',
  role: 'admin'
}
```

---

## 📊 Database Migrations

```bash
cd backend

# Create new migration
npx sequelize-cli migration:create --name add-feature

# Run migrations
npx sequelize-cli db:migrate

# Undo last migration
npx sequelize-cli db:migrate:undo

# Undo all
npx sequelize-cli db:migrate:undo:all
```

---

## 🔍 Useful Commands

### Backend
```bash
npm run dev          # Start with nodemon
npm start            # Start production
npm test             # Run tests
npm run migrate      # Run migrations
npm run seed         # Seed database
```

### Frontend
```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

---

## 📈 API Testing

Use Postman or curl:

### Register User
```bash
curl -X POST http://192.168.100.57:5098/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!",
    "firstName": "John",
    "lastName": "Doe",
    "role": "athlete"
  }'
```

### Login
```bash
curl -X POST http://192.168.100.57:5098/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!"
  }'
```

### Get Posts (with auth)
```bash
curl http://192.168.100.57:5098/api/posts \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 🎯 Next Steps

1. ✅ Basic setup complete
2. 🔧 Configure email (optional but recommended)
3. 💳 Configure Stripe (optional for payments)
4. 👥 Create test accounts
5. 🧪 Test features
6. 📚 Read full documentation in `/docs`
7. 🚀 Deploy to production

---

## 💡 Pro Tips

1. **Use Chrome DevTools** - Network tab to see API calls
2. **Check Console Logs** - Both browser and server for errors
3. **Use React DevTools** - Inspect component state
4. **Database GUI** - Use pgAdmin or TablePlus for database inspection
5. **Postman Collection** - Import API endpoints for easy testing

---

## 📞 Need Help?

1. Check `/docs/COMPLETION_SUMMARY.md` for feature details
2. Check `/docs/EMAIL_SETUP.md` for email issues
3. Check `/docs/STRIPE_SETUP.md` for payment issues
4. Check `/docs/VIDEO_CALLS.md` for video call issues
5. Check server logs: `backend/` terminal
6. Check browser console: F12 → Console

---

## ✅ Success Checklist

- [ ] Node.js and PostgreSQL installed
- [ ] Database created
- [ ] Backend dependencies installed
- [ ] Frontend dependencies installed
- [ ] Environment variables configured
- [ ] Backend server running (port 5098)
- [ ] Frontend server running (port 5174)
- [ ] Can register and login
- [ ] Can create posts
- [ ] Can view profiles
- [ ] Email notifications work (optional)
- [ ] Stripe payments work (optional)

---

## 🎉 You're Ready!

FootballPro is now running locally. Start exploring features and building your football ecosystem!

**Happy Coding! ⚽️🚀**
