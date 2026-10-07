import 'fast-text-encoding';
import 'react-native-gesture-handler';
import { enableFreeze } from 'react-native-screens';
import { registerRootComponent } from 'expo';
import { ensureLiveKitNative } from './src/livekit/register';

// Blurred screens stop re-rendering. Without this, every tab visit leaves another
// heavy screen in the tree and later taps get slower. react-native-screens
// leaves this off unless it is turned on before the first screen renders.
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

// Must run before App (and livekit-client) loads — Hermes has no TextEncoder.
ensureLiveKitNative();

// eslint-disable-next-line global-require
const App = require('./App').default;

registerRootComponent(App);
