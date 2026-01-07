# 📱 Multi-User Testing Guide

## Serverat po punojnë! ✅

- **Backend:** http://192.168.100.57:5000 ✅
- **Frontend:** http://192.168.100.57:5174 ✅

---

## 🎯 Testing Setup

### PC (Desktop Browser)
1. Hap browser: http://192.168.100.57:5174
2. Login me nje user (p.sh. athlete@test.com)
3. Krijo post, follow users, etj.

### Mobile (Telefon në të njëjtin WiFi)
1. Hap browser në telefon (Chrome/Safari)
2. Shko te: http://192.168.100.57:5174
3. Login me një user tjetër (p.sh. club@test.com)
4. Testo features

---

## ✨ Features to Test

### 1. Real-time Messaging 💬
- **PC:** Login si User A
- **Mobile:** Login si User B
- **Test:** 
  - User A → Kliko "Messaging" → Search User B → Send message
  - User B (mobile) → Shiko nëse mesazhi shfaqet automatically
  - User B → Reply
  - User A → Shiko reply

### 2. Social Feed 📱
- **PC:** Create a new post me foto
- **Mobile:** Refresh feed → Shiko nëse post shfaqet
- **Mobile:** Like dhe comment post
- **PC:** Shiko notifications për like/comment

### 3. Profile Follow System 👥
- **Mobile:** Shko te profile e User A (PC user)
- **Mobile:** Kliko "Follow"
- **PC:** Refresh → Shiko followers count increased
- **PC:** Check notifications për new follower

### 4. Video Calls 📹
- **PC:** Go to User B's profile
- **PC:** Click "Video Call" button (green)
- **PC:** Grant camera/microphone permissions
- **Mobile:** Check notifications (would receive call notification in production)
- **Note:** WebRTC needs signaling server for production

### 5. Gallery & Photos 📸
- **PC:** Upload photo to gallery
- **Mobile:** Refresh gallery → See new photo
- **Mobile:** Like photo
- **PC:** See like notification

### 6. Club Roster (if roles allow) 🏆
- **Mobile (Athlete):** Go to club profile
- **Mobile:** Click "Request to Join Roster"
- **PC (Club):** Check pending roster requests
- **PC:** Approve request
- **Mobile:** Check email (if configured) and notification

### 7. Tournament System ⚽
- **PC (Club):** Create tournament
- **Mobile (Club):** Join tournament
- **PC:** Start tournament
- **Both:** See matches generated
- **Both:** Enter match results
- **Both:** See standings update

### 8. Scouting (Scout role) 🔍
- **PC (Scout):** Go to /api/scouting/recommendations
- **PC:** See ranked athletes
- **Mobile (Athlete):** Complete profile, add stats
- **PC:** Refresh recommendations → See athlete score increase

### 9. Marketplace 🛒
- **PC:** Browse products
- **PC:** Click "Buy Now"
- **PC:** Complete Stripe checkout (test card: 4242 4242 4242 4242)
- **Mobile:** Check orders page → See new order

### 10. Notifications Bell 🔔
- **Any device:** Perform actions (follow, like, comment)
- **Other device:** Click bell icon → See real-time notifications

---

## 🧪 Test Scenarios

### Scenario 1: New Athlete Joins Club
1. **Mobile (Athlete):** Register new account
2. **Mobile:** Complete profile with stats
3. **Mobile:** Find club and request to join roster
4. **PC (Club):** See notification
5. **PC:** Go to roster requests
6. **PC:** Approve athlete
7. **Mobile:** Get notification + email (if configured)
8. **Mobile:** See club affiliation on profile

### Scenario 2: Tournament Flow
1. **PC (Club 1):** Create "Summer Cup" tournament (knockout)
2. **Mobile (Club 2):** Join tournament
3. **PC (Club 3 - different browser):** Join tournament
4. **Mobile (Club 4):** Join tournament
5. **PC (Creator):** Start tournament
6. **All:** See bracket generated
7. **Winners:** Enter match scores
8. **All:** See next round created automatically

### Scenario 3: Scout Discovers Talent
1. **Mobile (Athlete):** Post training videos
2. **Mobile:** Add match stats (goals, assists)
3. **Mobile:** Post regularly
4. **PC (Scout):** Check recommendations
5. **PC:** See athlete ranked high
6. **PC:** Click athlete profile
7. **PC:** Send message to athlete
8. **Mobile:** Receive message, reply

### Scenario 4: Social Engagement
1. **PC:** Create post: "Who's ready for the championship?"
2. **Mobile User 1:** Like post
3. **Mobile User 2:** Comment: "We're ready! 🏆"
4. **Mobile User 3:** Like comment
5. **PC:** See 3 notifications (2 likes + 1 comment)
6. **PC:** Reply to comment
7. **Mobile User 2:** Get notification for reply

---

## 📊 Performance Monitoring

### Check Server Load
```bash
# Terminal 1 (Backend)
# Watch for database queries
# Check for errors

# Terminal 2 (Frontend)
# Watch for compilation warnings
# Check for hot-reload
```

### Network Tab (Browser DevTools)
- Open F12 → Network
- Watch API calls
- Check response times
- Look for failed requests

### Console Logs
- Check browser console for errors
- Check backend terminal for auth logs:
  - `✅ AUTH: Token decoded` (successful)
  - `❌ AUTH: Token verification failed` (error)

---

## 🔧 Common Issues & Fixes

### Mobile can't access site
**Problem:** http://192.168.100.57:5174 not loading
**Solution:**
1. Verify phone is on same WiFi network
2. Check Windows Firewall:
   - Windows Security → Firewall → Allow app
   - Allow Node.js through firewall
3. Test ping from mobile:
   - Use Network Analyzer app
   - Ping 192.168.100.57

### API calls failing (401 Unauthorized)
**Problem:** Token not being sent
**Solution:**
1. Check if logged in
2. Refresh page
3. Clear localStorage:
   ```javascript
   localStorage.clear()
   location.reload()
   ```

### Images not loading
**Problem:** Image URLs pointing to localhost
**Solution:**
- Backend serves from: http://192.168.100.57:5098/uploads/...
- Check API base URL in frontend .env

### Notifications not updating
**Problem:** Need page refresh to see notifications
**Solution:**
- Refresh page manually
- For real-time: Need Socket.IO integration (future feature)

### Video calls not connecting
**Problem:** Only local video shows, remote doesn't
**Solution:**
- This is expected (simulated connection)
- For production: Need Socket.IO signaling server
- See VIDEO_CALLS.md for setup

---

## 📱 Mobile-Specific Features to Test

### PWA Installation (if configured)
- Mobile browser → Menu → "Add to Home Screen"
- Open as app
- Test offline capabilities

### Camera Access
- Create post → Upload photo → Take photo with camera
- Profile edit → Change profile photo → Use camera
- Video call → Grant camera permission

### Touch Gestures
- Swipe through gallery
- Pull to refresh feed
- Tap to expand/collapse comments

### Mobile Navigation
- Bottom navigation bar
- Swipe back gesture
- Hamburger menu

---

## 🎬 Demo Flow (10 minutes)

### Quick Demo for Showcase:

**Minute 1-2: Registration & Profiles**
- PC: Register as Club
- Mobile: Register as Athlete

**Minute 3-4: Social Features**
- PC: Create post with image
- Mobile: Like and comment
- PC: See notifications

**Minute 5-6: Roster System**
- Mobile: Request to join club
- PC: Approve request
- Both: Verify club affiliation

**Minute 7-8: Tournament**
- PC: Create and start tournament
- Mobile: Join tournament
- Both: See matches generated

**Minute 9-10: Messaging**
- PC: Send message to athlete
- Mobile: Reply
- Both: Chat real-time

---

## 📸 Screenshot Checklist

Good screenshots for documentation:
- [ ] Login/Register screens (mobile & desktop)
- [ ] Feed with posts (both views)
- [ ] Profile page (athlete with stats)
- [ ] Messaging interface (conversation)
- [ ] Roster request approval (club view)
- [ ] Tournament bracket
- [ ] Video call interface
- [ ] Marketplace checkout
- [ ] Notifications dropdown

---

## 🚀 Next Steps After Testing

1. **Note Bugs:** Create list of issues found
2. **Performance:** Check response times
3. **UX Issues:** Note anything confusing
4. **Mobile Optimization:** Check responsiveness
5. **Feature Requests:** List improvements needed

---

## 🎯 Success Criteria

✅ **Basic Functionality:**
- Can register and login
- Can create and view posts
- Can like and comment
- Can send messages

✅ **Multi-Device:**
- Actions on PC visible on mobile (after refresh)
- Actions on mobile visible on PC (after refresh)
- Both devices work simultaneously

✅ **Role-Based:**
- Athletes can request roster
- Clubs can approve requests
- Scouts can see recommendations

✅ **Performance:**
- Pages load < 3 seconds
- Images load properly
- No console errors
- Backend responds < 500ms

---

## 📞 Testing Checklist

**Before Testing:**
- [ ] Backend running (port 5098)
- [ ] Frontend running (port 5174)
- [ ] Mobile on same WiFi
- [ ] Test accounts created
- [ ] Database has sample data

**During Testing:**
- [ ] Test each feature one by one
- [ ] Note response times
- [ ] Check browser console
- [ ] Monitor backend terminal
- [ ] Take screenshots of issues

**After Testing:**
- [ ] Document bugs found
- [ ] List improvements needed
- [ ] Review performance
- [ ] Plan next iteration

---

## 🎉 Have Fun Testing!

Testo çdo feature me kujdes dhe shëno çfarë punon dhe çfarë duhet përmirësuar!

**Remember:** Features currently work best with page refresh. For true real-time updates, Socket.IO integration is needed (documented in COMPLETION_SUMMARY.md).

⚽️ **Enjoy testing FootballPro!** 🚀
