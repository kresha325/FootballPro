import { registerRootComponent } from 'expo';
import { ensureLiveKitNative } from './src/livekit/register';

import App from './App';

// Best-effort: registers WebRTC globals when running in a Dev Client / EAS build.
ensureLiveKitNative();

registerRootComponent(App);
