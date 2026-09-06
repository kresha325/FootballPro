import 'fast-text-encoding';
import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { ensureLiveKitNative } from './src/livekit/register';

// Must run before App (and livekit-client) loads — Hermes has no TextEncoder.
ensureLiveKitNative();

// eslint-disable-next-line global-require
const App = require('./App').default;

registerRootComponent(App);
