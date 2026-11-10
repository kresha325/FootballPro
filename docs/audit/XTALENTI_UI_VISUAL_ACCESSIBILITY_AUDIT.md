# XTALENTI UI Visual and Accessibility Audit

**Date:** 2026-11-10
**Scope:** React/Vite web (`frontend/src`) and React Native/Expo (`mobile/src`). Static source inventory plus targeted contrast and regression validation. No backend, database, payment, navigation, or product behavior was changed.

## Executive result

Three confirmed visual/accessibility defects were fixed: the light-theme Matches page title was white on a white card; several web controls placed near-black text on the brand gold and missed WCAG AA for normal text; and the mobile light-theme `mutedSoft` token had insufficient contrast. The mobile tournament match sheet now gives the official score a distinct, accessible presentation with tabular large digits and a persistent colon.

This is **not a declaration that every screen is fully visually verified**. We inventoried the source surface but did not capture screenshots on each authenticated role/route, viewport, system font scale, device, keyboard state, or modal. Those checks remain required before a final visual sign-off.

## Screen-by-screen audit matrix

| Screen family / reachable surface | Implementations inspected | Severity and finding | Verification |
|---|---|---|---|
| Match calendar, tabs, live and completed results | `frontend/src/components/Matches.jsx`; `mobile/src/screens/MatchesScreen.js` | **P1 fixed:** web Matches heading used `text-white` on the semantic surface card, making it invisible in light mode. **P2 fixed:** selected state used near-black on gold at 4.03:1. | Source review; contrast regression test; frontend production build. |
| Match center/detail and tournament match editor/sheet | `frontend/src/components/competitions/MatchCenterPage.jsx`; `frontend/src/components/TournamentSimple.jsx`; `mobile/src/screens/MatchDetailScreen.js`; `mobile/src/screens/TournamentDetailScreen.js` | **P1 fixed:** tournament modal's official score was embedded in ordinary body copy (or only shown via editable inputs). Added a dedicated score panel, strong hierarchy and screen-reader label. Tournament actions now use the theme-aware foreground on gold in both themes. | Source regression assertion; frontend tests; iOS and Android Expo export. |
| Common web actions, selected controls, onboarding, auth, search, nav, messages, premium, settings, marketplace and tournaments | `frontend/src/index.css`, `WelcomeOnboarding.jsx`, `RegisterOnboarding.jsx`, `AuthScreen.jsx`, `GlobalSearch.jsx`, `Navbar.jsx`, `Notifications.jsx`, `Settings.jsx`, `MarketplaceSimple.jsx`, `Messaging.jsx`, `Premium.jsx`, `ProPerksPanel.jsx`, `TournamentSimple.jsx` | **P2 fixed:** brand-gold actions now use theme-paired `--xt-color-on-gold` (light white, dark near-black) instead of a fixed foreground. Marketplace hover now stays within the gold hierarchy. | Token contrast tests in both themes; frontend lint/build/tests. |
| Mobile shared theme tokens | `mobile/src/theme/tokens.js`; `mobile/src/theme/nativeComponents.js`; `mobile/src/context/ThemeContext.js` | **P2 fixed:** light `mutedSoft` increased from 2.58:1 to 4.97:1; dark is 4.68:1. | Contrast tests for both themes. |
| Login/register/recovery/guardian verification | Web routes in `frontend/src/App.jsx`; mobile `LoginScreen.js`, `RegisterOnboardingScreen.js`, `ResetPasswordScreen.js`, `ParentVerificationScreen.js`, `WelcomeOnboardingScreen.js` | Static source/theme pass; no additional verified hidden-text issue confirmed in this pass. Role/data states need authenticated visual validation. | Source inventory only; manual role-by-role screenshots still required. |
| Profiles, athlete/club/coach/scout/federation/league/business/admin | Web `components/profiles/**`, `Profile.jsx`, `ClubRoster.jsx`, `AdminShell.jsx`, `admin/**`; mobile `PublicProfileScreen.js`, `EditProfileScreen.js`, `ClubRosterScreen.js`, `AdminDashboardScreen.js`, `AdminOperationsScreen.js`, `BrowseProfilesScreen.js` | Static source inventory and token scan. Dynamic profile data, long names and moderation states were not visually captured. | Authenticated test accounts/screenshots unavailable in this run. |
| Feed, gallery, stories/video, live and calls | Web `Feed.jsx`, `Gallery.jsx`, `Videos.jsx`, `StreamsPage.jsx`, `VideoCallSimple.jsx`, `CallModal.jsx`, `GroupLiveKitCall.jsx`; mobile `FeedScreen.js`, `GalleryScreen.js`, `VideosScreen.js`, `GoLiveScreen.js`, `GoLiveBroadcastScreen.js`, `LiveViewerScreen.js`, `IncomingCallScreen.js`, `OutgoingCallScreen.js`, `GroupCallScreen.js` | Static token scan; media overlays and camera states require real device verification. No device or screenshots were claimed. | Device/emulator manual verification pending. |
| Marketplace, cart, wallet, subscription, ads and analytics | Web `marketplace/**`, `MarketplaceSimple.jsx`, `WalletPage.jsx`, `Premium.jsx`, `SponsorsAdsHub.jsx`, `AnalyticsCenter.jsx`; mobile `MarketplaceScreen.js`, `CartScreen.js`, `OrdersScreen.js`, `ProductDetailScreen.js`, `CreateProductScreen.js`, `EditProductScreen.js`, `WalletScreen.js`, `PremiumScreen.js`, `AdsScreen.js`, `SponsorsScreen.js`, `InsightsScreen.js`, `PerformanceScreen.js` | Theme token scan and source inventory only. Checkout/payment states are not visually verified. | Automated build/tests plus manual states pending. |
| Notifications, conversation UI, menus, dialogs, forms, toasts, overlays, legal/help | All files under `frontend/src/components` and `mobile/src/components`, plus mobile `MessagingScreen.js`, `ConversationScreen.js`, `SettingsScreen.js`, `MoreScreen.js`, `LegalScreen.js`, `NotificationsScreen.js` | Inventory completed; no all-state screenshot sweep. Keyboard, focus order, hit target and platform dynamic type still require device/browser QA. | Source inventory and automated checks; manual validation pending. |

## Contrast evidence

Ratios use WCAG relative luminance formula and the actual source token values. The automated test fails when a critical pair falls below 4.5:1.

| Pair | Before | After | AA |
|---|---:|---:|---|
| Mobile light `mutedSoft` on white elevated surface | 2.58:1 | 4.97:1 | Pass |
| Mobile dark `mutedSoft` on dark elevated surface | 4.68:1 | 4.68:1 | Pass |
| Web light on-gold foreground on `#9A6B12` | 4.03:1 with near-black | 4.68:1 with white | Pass |
| Web dark on-gold foreground on `#D9A441` | 8.39:1 | 8.39:1 with `#101114` | Pass |
| Web light subtle text on white surface | 4.76:1 | 4.76:1 | Pass |
| Web dark subtle text on `#0D1420` surface | 4.79:1 | 4.79:1 | Pass |

## Source inventory

Inspected source inventory: **205 Web source files and 149 mobile source files** (JS/JSX/TS/TSX). Mobile route-level screen modules: **52**. This is a file inventory, not proof that every runtime state was manually rendered.

<details><summary>Web source modules (205)</summary>

- `frontend/src/App.jsx`
- `frontend/src/components/AdSlider.jsx`
- `frontend/src/components/AdminDashboard.jsx`
- `frontend/src/components/AdminMedia.jsx`
- `frontend/src/components/AdminStadiums.jsx`
- `frontend/src/components/AdminTournaments.jsx`
- `frontend/src/components/Analytics.jsx`
- `frontend/src/components/AuthCallback.jsx`
- `frontend/src/components/AuthScreen.jsx`
- `frontend/src/components/BottomNav.jsx`
- `frontend/src/components/BrowseProfiles.jsx`
- `frontend/src/components/CallModal.jsx`
- `frontend/src/components/CancelTournamentButton.jsx`
- `frontend/src/components/ClubRoster.jsx`
- `frontend/src/components/ContentManagement.jsx`
- `frontend/src/components/EditProfile.jsx`
- `frontend/src/components/EmbedGoLive.jsx`
- `frontend/src/components/EmbedIncomingCall.jsx`
- `frontend/src/components/EmbedOutboundCall.jsx`
- `frontend/src/components/ErrorBoundary.jsx`
- `frontend/src/components/Feed.jsx`
- `frontend/src/components/FeedLiveNow.jsx`
- `frontend/src/components/FeedPostPager.jsx`
- `frontend/src/components/FeedScoutingReport.jsx`
- `frontend/src/components/FollowListModal.jsx`
- `frontend/src/components/ForgotPassword.jsx`
- `frontend/src/components/ForwardButton.jsx`
- `frontend/src/components/Gallery.jsx`
- `frontend/src/components/Gamification.jsx`
- `frontend/src/components/GlobalSearch.jsx`
- `frontend/src/components/GroupLiveKitCall.jsx`
- `frontend/src/components/IncomingCallModal.jsx`
- `frontend/src/components/InsightsHub.jsx`
- `frontend/src/components/JonCoinWallet.jsx`
- `frontend/src/components/LandingPage.jsx`
- `frontend/src/components/LandingPlayerShowcase.jsx`
- `frontend/src/components/LegalPage.jsx`
- `frontend/src/components/ListSearchBar.jsx`
- `frontend/src/components/LiveDiscovery.jsx`
- `frontend/src/components/LiveStreamViewer.jsx`
- `frontend/src/components/Login.jsx`
- `frontend/src/components/ManagedAthleteRegistrationForm.jsx`
- `frontend/src/components/MarketplaceSimple.jsx`
- `frontend/src/components/MatchGoalEventsForm.jsx`
- `frontend/src/components/Matches.jsx`
- `frontend/src/components/Messaging.jsx`
- `frontend/src/components/Modal.jsx`
- `frontend/src/components/Navbar.jsx`
- `frontend/src/components/NotificationBell.jsx`
- `frontend/src/components/NotificationPreferences.jsx`
- `frontend/src/components/Notifications.jsx`
- `frontend/src/components/OAuthCodeRelay.jsx`
- `frontend/src/components/ParentVerification.jsx`
- `frontend/src/components/ParentVerificationForm.jsx`
- `frontend/src/components/ParentVerificationModal.jsx`
- `frontend/src/components/ParentVerified.jsx`
- `frontend/src/components/ParticipantPickGrid.jsx`
- `frontend/src/components/PersonName.jsx`
- `frontend/src/components/Premium.jsx`
- `frontend/src/components/ProPerksPanel.jsx`
- `frontend/src/components/Profile.jsx`
- `frontend/src/components/ProfileTournaments.jsx`
- `frontend/src/components/PublicCvPage.jsx`
- `frontend/src/components/Register.jsx`
- `frontend/src/components/RegisterOnboarding.jsx`
- `frontend/src/components/ResetPassword.jsx`
- `frontend/src/components/Scouting.jsx`
- `frontend/src/components/Settings.jsx`
- `frontend/src/components/ShareChannelsPanel.jsx`
- `frontend/src/components/ShareProfileCvButton.jsx`
- `frontend/src/components/Splash.jsx`
- `frontend/src/components/SponsorBanner.jsx`
- `frontend/src/components/SponsorsAdsHub.jsx`
- `frontend/src/components/StadiumModal.jsx`
- `frontend/src/components/StadiumStrip.jsx`
- `frontend/src/components/StreamsPage.jsx`
- `frontend/src/components/TournamentSimple.jsx`
- `frontend/src/components/TransferHistory.jsx`
- `frontend/src/components/UserAvatarLink.jsx`
- `frontend/src/components/UserCardsSection.jsx`
- `frontend/src/components/UserManagement.jsx`
- `frontend/src/components/VerifiedBadge.jsx`
- `frontend/src/components/VideoCallManager.jsx`
- `frontend/src/components/VideoCallRoom.jsx`
- `frontend/src/components/VideoCallSimple.jsx`
- `frontend/src/components/VideoPlayer.jsx`
- `frontend/src/components/Videos.jsx`
- `frontend/src/components/WalletPage.jsx`
- `frontend/src/components/WelcomeOnboarding.jsx`
- `frontend/src/components/XPLevelWidget.jsx`
- `frontend/src/components/XPNotificationManager.jsx`
- `frontend/src/components/admin/AdminShell.jsx`
- `frontend/src/components/admin/OpsDashboard.jsx`
- `frontend/src/components/admin/opsFormat.js`
- `frontend/src/components/admin/opsFormat.test.js`
- `frontend/src/components/admin/pages.jsx`
- `frontend/src/components/admin/platformState.jsx`
- `frontend/src/components/admin/ui.jsx`
- `frontend/src/components/ai/AiGenerateBioButton.jsx`
- `frontend/src/components/ai/AiSuggestCaptionButton.jsx`
- `frontend/src/components/analytics/AnalyticsCenter.jsx`
- `frontend/src/components/competitions/CalendarPage.jsx`
- `frontend/src/components/competitions/CompetitionCenter.jsx`
- `frontend/src/components/competitions/CompetitionStreams.jsx`
- `frontend/src/components/competitions/MatchCenterPage.jsx`
- `frontend/src/components/competitions/MatchMediaPanel.jsx`
- `frontend/src/components/marketplace/CartPage.jsx`
- `frontend/src/components/marketplace/CheckoutPage.jsx`
- `frontend/src/components/marketplace/OrdersPage.jsx`
- `frontend/src/components/marketplace/ProductPage.jsx`
- `frontend/src/components/media/AddMediaModal.jsx`
- `frontend/src/components/media/MediaCard.jsx`
- `frontend/src/components/media/MediaGrid.jsx`
- `frontend/src/components/media/MediaPlayer.jsx`
- `frontend/src/components/media/MediaSection.jsx`
- `frontend/src/components/media/MediaWatchModal.jsx`
- `frontend/src/components/media/YouTubePlayer.jsx`
- `frontend/src/components/profile/LiveStreamWidgets.jsx`
- `frontend/src/components/profile/ProfileGalleryPanel.jsx`
- `frontend/src/components/profile/ProfileSponsorsPanel.jsx`
- `frontend/src/components/profiles/BusinessProfile.jsx`
- `frontend/src/components/profiles/ClubProfile.jsx`
- `frontend/src/components/profiles/CoachProfile.jsx`
- `frontend/src/components/profiles/FederationProfile.jsx`
- `frontend/src/components/profiles/LigaProfile.jsx`
- `frontend/src/components/profiles/ManagerProfile.jsx`
- `frontend/src/components/profiles/PlayerProfile.jsx`
- `frontend/src/components/profiles/PlayerProfileAchievements.jsx`
- `frontend/src/components/profiles/PlayerProfileHeader.jsx`
- `frontend/src/components/profiles/PlayerProfileMatchHistory.jsx`
- `frontend/src/components/profiles/PlayerProfileMedia.jsx`
- `frontend/src/components/profiles/PlayerProfileOverview.jsx`
- `frontend/src/components/profiles/PlayerProfileTabs.jsx`
- `frontend/src/components/profiles/ProfileSelector.jsx`
- `frontend/src/components/profiles/RefereeProfile.jsx`
- `frontend/src/components/profiles/RoleProfileOverview.jsx`
- `frontend/src/components/profiles/ScoutProfile.jsx`
- `frontend/src/components/profiles/edit/EditAthleteProfile.jsx`
- `frontend/src/components/profiles/edit/EditBusinessProfile.jsx`
- `frontend/src/components/profiles/edit/EditClubProfile.jsx`
- `frontend/src/components/profiles/edit/EditCoachProfile.jsx`
- `frontend/src/components/profiles/edit/EditFederationProfile.jsx`
- `frontend/src/components/profiles/edit/EditLigaProfile.jsx`
- `frontend/src/components/profiles/edit/EditManagerProfile.jsx`
- `frontend/src/components/profiles/edit/EditRefereeProfile.jsx`
- `frontend/src/components/profiles/edit/EditScoutProfile.jsx`
- `frontend/src/components/scouting/ScoutPlayerCard.jsx`
- `frontend/src/components/scouting/ScoutingCompare.jsx`
- `frontend/src/components/scouting/ScoutingDashboard.jsx`
- `frontend/src/components/scouting/ScoutingDiscover.jsx`
- `frontend/src/components/scouting/ScoutingLayout.jsx`
- `frontend/src/components/scouting/ScoutingReports.jsx`
- `frontend/src/components/scouting/ScoutingShortlist.jsx`
- `frontend/src/components/scouting/ScoutingWatchlist.jsx`
- `frontend/src/components/scouting/scoutingState.js`
- `frontend/src/config/api.js`
- `frontend/src/config/branding.js`
- `frontend/src/constants/placeholderImage.js`
- `frontend/src/content/legalPages.js`
- `frontend/src/contexts/AuthContext.jsx`
- `frontend/src/contexts/CartContext.jsx`
- `frontend/src/contexts/LocaleContext.jsx`
- `frontend/src/contexts/PostsContext.jsx`
- `frontend/src/contexts/SocketContext.jsx`
- `frontend/src/locales/catalog.js`
- `frontend/src/main.jsx`
- `frontend/src/models/gamification.d.ts`
- `frontend/src/services/api.js`
- `frontend/src/services/joncoin.js`
- `frontend/src/services/streamsAPI.js`
- `frontend/src/services/userStreamsAPI.js`
- `frontend/src/test/setup.js`
- `frontend/src/utils/__tests__/liveStreams.test.js`
- `frontend/src/utils/__tests__/messagePresentation.test.js`
- `frontend/src/utils/__tests__/passwordPolicy.test.js`
- `frontend/src/utils/__tests__/visualContrast.test.js`
- `frontend/src/utils/athleteIdentity.js`
- `frontend/src/utils/avatarUrl.js`
- `frontend/src/utils/cameraSwitch.js`
- `frontend/src/utils/clubLogos.jsx`
- `frontend/src/utils/cropImage.js`
- `frontend/src/utils/device.js`
- `frontend/src/utils/footballSeason.js`
- `frontend/src/utils/goLiveConfirm.js`
- `frontend/src/utils/goLiveNavigate.js`
- `frontend/src/utils/lazyWithReload.js`
- `frontend/src/utils/listSearch.js`
- `frontend/src/utils/liveStreams.js`
- `frontend/src/utils/mediaUrl.js`
- `frontend/src/utils/messagePresentation.js`
- `frontend/src/utils/notificationLinks.js`
- `frontend/src/utils/orgProfile.js`
- `frontend/src/utils/passwordPolicy.js`
- `frontend/src/utils/profileThemes.js`
- `frontend/src/utils/safeNextPath.js`
- `frontend/src/utils/scoutingScore.js`
- `frontend/src/utils/shareProfile.js`
- `frontend/src/utils/sponsor.js`
- `frontend/src/utils/subscriptionAccess.js`
- `frontend/src/utils/tournamentParticipants.js`
- `frontend/src/utils/tournamentPoints.js`
- `frontend/src/utils/uploadLimits.js`
- `frontend/src/utils/youtubeChannel.js`
- `frontend/src/utils/youtubeLiveEmbed.js`
- `frontend/src/utils/youtubeVideo.js`

</details>

<details><summary>Mobile source modules (149)</summary>

- `mobile/src/api/client.js`
- `mobile/src/components/AdvancedSearchInput.js`
- `mobile/src/components/AiBioButton.js`
- `mobile/src/components/AiCaptionButton.js`
- `mobile/src/components/FeedAdSlot.js`
- `mobile/src/components/HomeCompetitionShortcuts.js`
- `mobile/src/components/IncomingCallListener.js`
- `mobile/src/components/ListSearchBar.js`
- `mobile/src/components/ManagedAthleteRegistrationForm.js`
- `mobile/src/components/NotificationHeaderButton.js`
- `mobile/src/components/PostSponsorStrip.js`
- `mobile/src/components/PushNotificationManager.js`
- `mobile/src/components/ReportSheet.js`
- `mobile/src/components/SharePostPanel.js`
- `mobile/src/components/SplashIntro.js`
- `mobile/src/components/TournamentBracketView.js`
- `mobile/src/components/UserAvatar.js`
- `mobile/src/components/UserProfileBrowsePager.js`
- `mobile/src/components/XPNotificationManager.js`
- `mobile/src/components/editProfile/EditAthleteMatchAchievements.js`
- `mobile/src/components/media/AddMediaSheet.js`
- `mobile/src/components/media/LazyVideo.js`
- `mobile/src/components/media/OptimizedImage.js`
- `mobile/src/components/media/YouTubeWebPlayer.js`
- `mobile/src/components/messaging/CreateGroupModal.js`
- `mobile/src/components/messaging/ForwardMessageModal.js`
- `mobile/src/components/messaging/MessageActionsSheet.js`
- `mobile/src/components/messaging/ReplyPreview.js`
- `mobile/src/components/messaging/StartConversationModal.js`
- `mobile/src/components/publicProfile/PublicProfileAboutTab.js`
- `mobile/src/components/publicProfile/PublicProfileAchievementsTab.js`
- `mobile/src/components/publicProfile/PublicProfileContactTab.js`
- `mobile/src/components/publicProfile/PublicProfileGalleryTab.js`
- `mobile/src/components/publicProfile/PublicProfileMatchHistoryTab.js`
- `mobile/src/components/publicProfile/PublicProfileOverviewTab.js`
- `mobile/src/components/publicProfile/PublicProfilePostsTab.js`
- `mobile/src/components/publicProfile/PublicProfileSponsorsTab.js`
- `mobile/src/components/publicProfile/PublicProfileTabBar.js`
- `mobile/src/components/publicProfile/PublicProfileTournamentsTab.js`
- `mobile/src/components/publicProfile/PublicProfileVideosTab.js`
- `mobile/src/components/publicProfile/profileListFrame.js`
- `mobile/src/config/branding.js`
- `mobile/src/config/constants.js`
- `mobile/src/constants/registerRoles.js`
- `mobile/src/content/legalPages.js`
- `mobile/src/context/AuthContext.js`
- `mobile/src/context/CartContext.js`
- `mobile/src/context/LocaleContext.js`
- `mobile/src/context/PlatformContext.js`
- `mobile/src/context/ThemeContext.js`
- `mobile/src/hooks/useUnreadBadges.js`
- `mobile/src/iap/products.js`
- `mobile/src/iap/purchase.js`
- `mobile/src/livekit/NativeCallRoom.js`
- `mobile/src/livekit/NativeGoLiveBroadcaster.js`
- `mobile/src/livekit/NativeLiveViewer.js`
- `mobile/src/livekit/register.js`
- `mobile/src/localization/catalog.js`
- `mobile/src/navigation/AppNavigator.js`
- `mobile/src/navigation/feedPagerStore.js`
- `mobile/src/navigation/navigationRef.js`
- `mobile/src/notifications/handlePushOpen.js`
- `mobile/src/notifications/push.js`
- `mobile/src/screens/AdminDashboardScreen.js`
- `mobile/src/screens/AdminOperationsScreen.js`
- `mobile/src/screens/AdsScreen.js`
- `mobile/src/screens/AuthCallbackScreen.js`
- `mobile/src/screens/BrowseProfilesScreen.js`
- `mobile/src/screens/CalendarScreen.js`
- `mobile/src/screens/CartScreen.js`
- `mobile/src/screens/ClubRosterScreen.js`
- `mobile/src/screens/ConversationScreen.js`
- `mobile/src/screens/CreatePostScreen.js`
- `mobile/src/screens/CreateProductScreen.js`
- `mobile/src/screens/EditProductScreen.js`
- `mobile/src/screens/EditProfileScreen.js`
- `mobile/src/screens/FeedPostPagerScreen.js`
- `mobile/src/screens/FeedScreen.js`
- `mobile/src/screens/GalleryScreen.js`
- `mobile/src/screens/GoLiveBroadcastScreen.js`
- `mobile/src/screens/GoLiveScreen.js`
- `mobile/src/screens/GroupCallScreen.js`
- `mobile/src/screens/IncomingCallScreen.js`
- `mobile/src/screens/InsightsScreen.js`
- `mobile/src/screens/LandingScreen.js`
- `mobile/src/screens/LegalScreen.js`
- `mobile/src/screens/LiveViewerScreen.js`
- `mobile/src/screens/LoginScreen.js`
- `mobile/src/screens/MarketplaceScreen.js`
- `mobile/src/screens/MatchDetailScreen.js`
- `mobile/src/screens/MatchesScreen.js`
- `mobile/src/screens/MessagingScreen.js`
- `mobile/src/screens/MoreScreen.js`
- `mobile/src/screens/NotificationsScreen.js`
- `mobile/src/screens/OrdersScreen.js`
- `mobile/src/screens/OutgoingCallScreen.js`
- `mobile/src/screens/ParentVerificationScreen.js`
- `mobile/src/screens/PerformanceScreen.js`
- `mobile/src/screens/PremiumScreen.js`
- `mobile/src/screens/ProductDetailScreen.js`
- `mobile/src/screens/PublicCvScreen.js`
- `mobile/src/screens/PublicProfileScreen.js`
- `mobile/src/screens/RegisterOnboardingScreen.js`
- `mobile/src/screens/ResetPasswordScreen.js`
- `mobile/src/screens/ScoutingScreen.js`
- `mobile/src/screens/SearchScreen.js`
- `mobile/src/screens/SettingsScreen.js`
- `mobile/src/screens/SponsorsScreen.js`
- `mobile/src/screens/StreamsScreen.js`
- `mobile/src/screens/TournamentDetailScreen.js`
- `mobile/src/screens/TournamentsScreen.js`
- `mobile/src/screens/VideosScreen.js`
- `mobile/src/screens/WalletScreen.js`
- `mobile/src/screens/WelcomeOnboardingScreen.js`
- `mobile/src/screens/editProfileConstants.js`
- `mobile/src/theme/nativeComponents.js`
- `mobile/src/theme/tokens.js`
- `mobile/src/utils/athleteIdentity.js`
- `mobile/src/utils/footballSeason.js`
- `mobile/src/utils/goLiveConfirm.js`
- `mobile/src/utils/imageUrl.js`
- `mobile/src/utils/incomingCallPayload.js`
- `mobile/src/utils/listSearch.js`
- `mobile/src/utils/liveStreams.js`
- `mobile/src/utils/mediaPermissions.js`
- `mobile/src/utils/messageActions.js`
- `mobile/src/utils/messageStatus.js`
- `mobile/src/utils/messagingRealtime.js`
- `mobile/src/utils/navigateFromNotification.js`
- `mobile/src/utils/openUserProfile.js`
- `mobile/src/utils/orgProfile.js`
- `mobile/src/utils/passwordPolicy.js`
- `mobile/src/utils/perfLog.js`
- `mobile/src/utils/playbackAudio.js`
- `mobile/src/utils/presenceLabel.js`
- `mobile/src/utils/profileArrays.js`
- `mobile/src/utils/profileThemes.js`
- `mobile/src/utils/queryString.js`
- `mobile/src/utils/sharePost.js`
- `mobile/src/utils/shareProfile.js`
- `mobile/src/utils/subscriptionAccess.js`
- `mobile/src/utils/tournamentBracket.js`
- `mobile/src/utils/tournamentParticipants.js`
- `mobile/src/utils/tournamentPoints.js`
- `mobile/src/utils/uploadLimits.js`
- `mobile/src/utils/xpNotifications.js`
- `mobile/src/utils/youtubeChannel.js`
- `mobile/src/utils/youtubeLiveEmbed.js`
- `mobile/src/utils/youtubeVideo.js`

</details>

## Validation results

- `cd frontend && npm test -- --run`: **PASS**, 5 test files / 13 tests.
- `cd frontend && npm run build`: **PASS**. Vite reports the existing large-chunk warning (927.61 kB main bundle, 503.47 kB LiveKit); build did complete.
- `cd frontend && npm run lint`: **PASS**, 0 errors / 147 warnings. The first run caught 3 `no-undef` errors in the new test using `process`; corrected to `globalThis.process`. The warnings are existing codebase issues and were not addressed by this scoped visual task.
- `cd mobile && npm run verify:parity`: **PASS**, all 24 parity checks.
- `cd mobile && npm run release:preflight`: **PASS**, including config, release metadata and key-file syntax checks.
- `cd mobile && npx expo export --platform ios --output-dir .expo-qa-export-ios`: **PASS**, Metro bundled 1,500 modules; output was removed after verification.
- `cd mobile && npx expo export --platform android --output-dir .expo-qa-export-android`: **PASS**, Metro bundled 1,502 modules; output was removed after verification.
- **Not run:** device/emulator screenshots, VoiceOver/TalkBack, system font scaling, and browser viewport sweep.

## Remaining manual release checks

1. Capture web screenshots at 320, 375, 390, 768, 1024 and 1440 px for light and dark theme, including `/matches`, `/matches/:id`, tournament score modal, auth, roles, messaging and admin.
2. Capture mobile compact/large iPhone and Android layouts in both themes, including the tournament sheet with no score, 0:0, multi-digit scores, edit mode, keyboard open and long club names.
3. Verify focus visibility/keyboard flow, VoiceOver/TalkBack labels, text scaling, safe areas and bottom-sheet scrolling.
4. Re-audit residual hardcoded color pairs across the source inventory; only findings reproduced with actual rendered foreground/background should be marked fixed.

## Scope and delivery status

No production data, backend logic, migrations or deployment settings were changed. GitHub reports latest `main` at `91a660e4b66694fc78b28e655a44b4f9e981ba9a`; local checkout is `983822f33fce12955c94e71516bca2522f3926db`. A new branch and draft PR were requested by the task. Local Git could not create the branch because the workspace policy denies writes to `.git/refs` (`Operation not permitted`), and the GitHub integration rejected branch creation with HTTP 403 (`Resource not accessible by integration`). The patch remains in the working tree and has not been rebased onto latest `main`; no push, PR or merge has been performed. The repository also contains unrelated pre-existing working-tree changes, which were not staged or committed.
