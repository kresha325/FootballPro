# Store release checklist — Phase 14

## Apple App Store

- [ ] App icon
- [ ] Screenshots (6.7" / 6.1" / iPad if applicable — tablet off)
- [ ] App description + keywords
- [x] Privacy policy URL (`https://xtalenti.com/privacy`)
- [x] Terms URL (`https://xtalenti.com/terms`)
- [x] Account deletion (Settings → Fshi llogarinë)
- [x] UGC report / block (profile + posts)
- [x] Community guidelines URL
- [x] Camera / Mic / Photo permission strings
- [x] Notifications (Phase 4 — needs rebuild + APNs)
- [ ] App Privacy questionnaire in ASC
- [ ] Age rating
- [ ] Payment compliance (see PAYMENTS_AUDIT — **IAP blocker**)
- [ ] Sign-in compliance
- [ ] TestFlight build
- [ ] Production build
- [ ] Crash-free device testing (Phase 5/15 — NOT VERIFIED)

## Google Play

- [ ] App icon + feature graphic
- [ ] Screenshots
- [ ] Description
- [x] Privacy policy
- [ ] Data Safety form
- [x] Account deletion
- [x] UGC moderation hooks
- [x] Report / Block
- [x] Target API 36
- [ ] Content rating
- [ ] Ads declaration
- [ ] Billing compliance (IAP if digital)
- [ ] Internal testing track
- [ ] Production AAB (`eas build --platform android --profile production`)
