# Udhëzim për Transmetim Live (WebRTC/MediaSoup)

Ky udhëzim shpjegon si të përdorësh funksionalitetin e ri të livestream-it me MediaSoup (WebRTC) në FootballPro.

---

## 🎥 Si të Nisësh Transmetim Live (Broadcaster)

1. Hyr në platformë me llogarinë tënde.
2. Shko te seksioni "Live Streams".
3. Kliko butonin **Go Live**.
4. Jep leje për kamerë dhe mikrofon.
5. Transmetimi yt do të shfaqet LIVE për të gjithë përdoruesit.
6. Përfundimi i transmetimit ndodh automatikisht kur mbyll dritaren ose ndalon kamerën.

---

## 👀 Si të Shikosh një Transmetim Live (Viewer)

1. Hyr në platformë dhe shko te "Live Streams".
2. Zgjidh një stream nga lista dhe kliko për ta parë.
3. Kliko **Shiko Live**.
4. Video do të shfaqet automatikisht në browser.
5. Nëse broadcaster largohet, do të shfaqet njoftim që transmetimi është mbyllur.

---

## 🔒 Siguria & Autorizimi

- Vetëm përdoruesit e loguar mund të transmetojnë ose të shikojnë live.
- Çdo lidhje verifikohet me JWT token.

---

## ℹ️ Karakteristika të Avancuara

- Numërimi i shikuesve është real-time dhe përditësohet automatikisht.
- UI është e optimizuar për mobile dhe desktop.
- Pas mbylljes së stream-it, të gjitha resurset fshihen automatikisht.

---

## 🛠️ Troubleshooting

- Nëse nuk shfaqet video: Kontrollo lejet për kamerë/mikrofon dhe rifresko faqen.
- Nëse shfaqet error "Nuk mund të shfaqësh transmetimin": Kontrollo lidhjen me internetin dhe provo sërish.
- Nëse je shikues dhe stream-i mbyllet papritur: Broadcaster ka ndalur transmetimin.

---

## 📦 Për Administrata/DevOps

- MediaSoup server duhet të jetë i hapur në portin 4000 (ose sipas konfigurimit).
- Variablat e nevojshme në .env:
  - `MEDIASOUP_ADMIN_TOKEN` (për komunikim të sigurt me backend)
  - `FOOTBALLPRO_API_URL` (URL e backend-it)

---

Për pyetje ose probleme, kontakto ekipin teknik ose shiko dokumentimin në `docs/`.
