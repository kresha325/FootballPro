import 'fast-text-encoding';
import 'react-native-gesture-handler';
import { enableFreeze } from 'react-native-screens';
import { registerRootComponent } from 'expo';
import * as SplashScreen from 'expo-splash-screen';
import { ensureLiveKitNative } from './src/livekit/register';

// Pause screens that are not visible. The tab bar stays a component so this
// does not repeat the launch crash from calling it as a function.
enableFreeze(true);

// Hermes may lack WeakRef / FinalizationRegistry — livekit-client needs them.
if (typeof global.WeakRef === 'undefined') {
  global.WeakRef = class WeakRef {
    constructor(target) {
      this._target = target;
    }
    deref() {
      return this._target;
    }
  };
}
if (typeof global.FinalizationRegistry === 'undefined') {
  global.FinalizationRegistry = class FinalizationRegistry {
    // eslint-disable-next-line no-unused-vars
    constructor(_callback) {}
    // eslint-disable-next-line no-unused-vars
    register() {}
    // eslint-disable-next-line no-unused-vars
    unregister() {}
  };
}

SplashScreen.preventAutoHideAsync().catch(() => {});

// Must run before App (and livekit-client) loads — Hermes has no TextEncoder.
ensureLiveKitNative();

// eslint-disable-next-line global-require
const App = require('./App').default;

registerRootComponent(App);
