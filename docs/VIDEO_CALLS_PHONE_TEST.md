# 📱 TEST VIDEO CALLS NË TELEFON

## ✅ Fiksimi i fundit:
- Backend CORS: Tani pranon connections nga çdo origin (*)
- Frontend: Automatic backend URL detection bazuar në hostname
- Socket.IO: Tani përdor websocket + polling fallback

## 🔧 HAPAT PËR TESTIM:

### 1️⃣ Sigurohu që serverat janë duke u ekzekutuar:

**Backend (në terminal):**
```bash
cd C:\Users\Urim\Desktop\FootballPro\backend
node server.js
```
Duhet të shikosh: `✅ Database connected`

**Frontend (në terminal tjetër):**
```bash
cd C:\Users\Urim\Desktop\FootballPro\frontend
npm run dev
```
Duhet të shikosh: `Network: http://192.168.100.57:5174/`

---

### 2️⃣ NË TELEFON:

1. **Sigurohu që telefoni është në të njëjtin WiFi** me laptop-in

2. **Hap browser-in** (Chrome ose Safari)

3. **Shkruaj në URL:**
   ```
   http://192.168.100.57:5174
   ```

4. **Login** me një user (p.sh. user1@test.com)

5. **Hap Console për debugging** (opsionale):
   - Chrome Android: `chrome://inspect`
   - Safari iOS: Settings > Safari > Advanced > Web Inspector

6. **Kontrollo në console:**
   - Duhet të shikosh: `🔗 Backend URL: http://192.168.100.57:5098`
   - Duhet të shikosh: `✅ Socket connected: [ID]`

---

### 3️⃣ NË LAPTOP:

1. **Hap browser** (Chrome rekomandohet)

2. **Shko në:** `http://192.168.100.57:5174` (ose `http://localhost:5174`)

3. **Login** me user tjetër (p.sh. user2@test.com)

4. **Shko te Profiles** ose **Search**

5. **Gjej user-in që je logged në telefon**

6. **Hap profilin e tij**

7. **Kliko butonin "Video Call"** 📞

---

### 4️⃣ NË TELEFON (do të shfaqet):

- ✅ Modal me **"Duke ju thirrur me video..."**
- ✅ Fotoja/inicialet e thirrësit
- ✅ Butoni i **gjelbër (Accept)**
- ✅ Butoni i **kuq (Reject)**

**Kliko ACCEPT** ✅

**Jep permissions:**
- Kamera ✅
- Mikrofoni ✅

---

### 5️⃣ TESTO:

✅ **Video duhet të shfaqet:**
- Local video (i yti) në këndin lart-djathtas (small)
- Remote video (nga laptop) në ekran të plotë

✅ **Testo butonët:**
- 🎤 **Mute** - fik/ndiz mikrofonin
- 📹 **Video** - fik/ndiz kamerën  
- 📞 **Hang Up** - mbyll thirrjen

---

## 🔍 DEBUGGING:

### Nëse telefoni nuk po lidhet:

**Hapi 1: Kontrollo Console në telefon**
Duhet të shikosh:
```
🔗 Backend URL: http://192.168.100.57:5098
🔗 Connecting to Socket.IO: http://192.168.100.57:5098
✅ Socket connected: [ID]
```

**Hapi 2: Nëse shikon error:**

❌ **"Socket connection error"**
```
Zgjidhje:
1. Sigurohu që backend është running
2. Kontrollo që WiFi është i njëjtë
3. Kontrollo firewall në laptop
```

❌ **"MediaDevices not supported"**
```
Zgjidhje:
Nevojitet HTTPS për production
Por duhet të funksionojë në LAN me HTTP
```

❌ **"Permission denied"**
```
Zgjidhje:
Settings > Chrome/Safari > Camera/Microphone > Allow
```

---

## 📊 SI TË KONTROLLOSH NËSE BACKEND PO PRET CONNECTIONS:

**Në laptop (backend terminal):**
```bash
netstat -ano | findstr ":5098"
```

Duhet të shikosh:
```
TCP    0.0.0.0:5098           0.0.0.0:0              LISTENING
TCP    192.168.100.57:5098    192.168.100.57:XXXXX   ESTABLISHED
```

---

## 🆘 NËSE AKA PROBLEME:

### Restart Everything:

**1. Kill të gjitha node processes:**
```bash
taskkill //F //IM node.exe
```

**2. Start backend:**
```bash
cd backend
node server.js
```

**3. Start frontend:**
```bash
cd frontend
npm run dev
```

**4. Refresh të dyja browser-at** (laptop + telefon)

---

## ✅ ÇFARË DUHET TË FUNKSIONOJË:

- ✅ Telefoni lidhet me backend
- ✅ Socket.IO connection është stable
- ✅ Video call initiate nga laptop
- ✅ Incoming call shfaqet në telefon
- ✅ Accept call funksionon
- ✅ Video/Audio streaming funksionon
- ✅ Mute/Video toggle funksionon
- ✅ Hang up funksionon

---

**GATI PËR TESTIM! 📱✨**

Nëse telefoni ende nuk po lidhet, më thuaj çfarë error shikon në console!
