#!/usr/bin/env node
/**
 * Xcode 26 / newer Clang compatibility patches for Expo 49 + RN 0.72.
 * Safe to re-run; no-ops when already applied.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function patchFile(relPath, replacements) {
  const filePath = path.join(root, relPath);
  if (!fs.existsSync(filePath)) {
    console.warn(`[patch-xcode26] skip missing ${relPath}`);
    return;
  }
  let src = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  for (const { from, to } of replacements) {
    if (src.includes(to) && !src.includes(from)) continue;
    if (!src.includes(from)) continue;
    src = src.split(from).join(to);
    changed = true;
  }
  if (changed) {
    fs.writeFileSync(filePath, src);
    console.log(`[patch-xcode26] patched ${relPath}`);
  } else {
    console.log(`[patch-xcode26] ok ${relPath}`);
  }
}

// Yoga: space before user-defined literal suffix is deprecated / -Werror on Xcode 26
patchFile('node_modules/react-native/ReactCommon/yoga/yoga/YGValue.h', [
  { from: 'operator"" _pt', to: 'operator""_pt' },
  { from: 'operator"" _percent', to: 'operator""_percent' },
]);

// expo-dev-menu: TARGET_IPHONE_SIMULATOR is not imported into Swift on newer SDKs
patchFile('node_modules/expo-dev-menu/ios/DevMenuViewController.swift', [
  {
    from: 'let isSimulator = TARGET_IPHONE_SIMULATOR > 0',
    to: `#if targetEnvironment(simulator)
    let isSimulator = true
    #else
    let isSimulator = false
    #endif`,
  },
]);
