import React from 'react';
import * as ReactNative from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { radius } from './tokens';

// Keep the React Native API available from this module, while routing visual
// primitives through the shared X TALENTI palette.
export * from 'react-native';

const styleCache = new WeakMap();

const surfaceBg = new Map([
  ['#fff', 'card'], ['#ffffff', 'card'], ['white', 'card'],
  ['#f8fafc', 'bg'], ['#f9fafb', 'bg'], ['#fafafa', 'bg'], ['#f3f4f6', 'bg'],
  ['#f1f5f9', 'bgElevated'], ['#f5f5f5', 'bgElevated'],
  ['#f0f9ff', 'bgElevated'], ['#eff6ff', 'bgElevated'], ['#ecfeff', 'bgElevated'],
  ['#f0fdfa', 'bg'], ['#ccfbf1', 'primarySoft'],
  ['#ecfdf5', 'successSoft'], ['#f0fdf4', 'successSoft'], ['#fffbeb', 'warningSoft'],
  ['#fef3c7', 'warningSoft'], ['#fff7f7', 'dangerSoft'], ['#fff1f2', 'dangerSoft'],
  ['#e2e8f0', 'border'], ['#e5e7eb', 'border'], ['#f3f4f6', 'bg'],
]);

const textTone = new Map([
  ['#020617', 'text'], ['#0f172a', 'text'], ['#111827', 'text'], ['#1e293b', 'textSecondary'],
  ['#334155', 'textSecondary'], ['#374151', 'textSecondary'], ['#475569', 'muted'],
  ['#64748b', 'muted'], ['#6b7280', 'muted'], ['#94a3b8', 'mutedSoft'],
  ['#9ca3af', 'mutedSoft'], ['#0f766e', 'primaryText'], ['#0d9488', 'primaryText'],
  ['#14b8a6', 'primaryText'], ['#2dd4bf', 'primaryText'], ['#9a6b12', 'primaryText'],
  ['#b45309', 'primaryText'], ['#92400e', 'primaryText'], ['#78500c', 'primaryText'],
  // Bright golds stay literal on dark brand surfaces; darker golds map to primaryText.
  ['#dc2626', 'danger'], ['#ef4444', 'danger'], ['#b91c1c', 'danger'],
  ['#10b981', 'success'], ['#16a34a', 'success'], ['#15803d', 'success'],
]);

const borderTone = new Map([
  ['#e2e8f0', 'border'], ['#e5e7eb', 'border'], ['#d1d5db', 'border'],
  ['#cbd5e1', 'borderStrong'], ['#94a3b8', 'borderStrong'], ['#334155', 'borderStrong'],
  ['#0f766e', 'primaryBorder'], ['#9a6b12', 'primaryBorder'],
]);

function resolveColor(value, property, colors) {
  if (typeof value !== 'string') return value;
  const normalized = value.trim().toLowerCase();
  let token;
  if (property === 'backgroundColor' || property === 'background') {
    token = surfaceBg.get(normalized);
    if (normalized === '#0f766e' || normalized === '#9a6b12') token = 'primary';
    if (normalized === '#d9a441' || normalized === '#f59e0b') token = 'primary';
    if (normalized === '#dc2626' || normalized === '#ef4444') token = 'danger';
    if (normalized === '#10b981' || normalized === '#16a34a') token = 'success';
  } else if (property === 'borderColor' || property === 'borderTopColor' || property === 'borderBottomColor' || property === 'borderLeftColor' || property === 'borderRightColor') {
    token = borderTone.get(normalized);
  } else if (property === 'color' || property === 'placeholderTextColor' || property === 'selectionColor' || property === 'cursorColor' || property === 'underlineColorAndroid' || property === 'tintColor') {
    // Keep pure white/black as intentional contrast (e.g. white label on dark CTA).
    // Remapping #fff → colors.text made "Hyr" and hero copy invisible in light mode.
    if (normalized === '#ffffff' || normalized === '#fff' || normalized === 'white') return value;
    if (normalized === '#000000' || normalized === '#000' || normalized === 'black') return value;
    token = textTone.get(normalized);
  } else if (property === 'shadowColor' && (normalized === '#000' || normalized === '#000000' || normalized === 'black')) {
    token = 'shadow';
  }
  return token && colors[token] ? colors[token] : value;
}

function themeStyle(style, colors) {
  if (style == null) return style;
  if (typeof style === 'function') return (...args) => themeStyle(style(...args), colors);
  if (Array.isArray(style)) return style.map((item) => themeStyle(item, colors));
  let source = style;
  if (typeof source === 'number') source = ReactNative.StyleSheet.flatten(source);
  if (!source || typeof source !== 'object') return source;

  let byStyle = styleCache.get(colors);
  if (!byStyle) {
    byStyle = new WeakMap();
    styleCache.set(colors, byStyle);
  }
  if (typeof style === 'object' && byStyle.has(style)) return byStyle.get(style);

  const output = { ...source };
  Object.keys(output).forEach((property) => {
    const value = output[property];
    if (property.toLowerCase().includes('radius') && typeof value === 'number' && value > 0 && value < 40) {
      output[property] = value <= 6 ? radius.sm : value <= 12 ? radius.md : value <= 16 ? radius.lg : radius.xl;
    } else {
      output[property] = resolveColor(value, property, colors);
    }
  });
  if (typeof style === 'object') byStyle.set(style, output);
  return output;
}

function withTheme(Component, options = {}) {
  const ThemedComponent = React.forwardRef(function ThemedNativeComponent(props, ref) {
    const { colors } = useTheme();
    const nextProps = { ...props, ref };
    if (Object.prototype.hasOwnProperty.call(props, 'style')) nextProps.style = themeStyle(props.style, colors);
    if (options.contentContainer && props.contentContainerStyle !== undefined) {
      nextProps.contentContainerStyle = themeStyle(props.contentContainerStyle, colors);
    }
    if (options.colorProps) {
      options.colorProps.forEach((property) => {
        if (props[property] !== undefined) nextProps[property] = resolveColor(props[property], property, colors);
      });
    }
    if (options.colorArrayProps) {
      options.colorArrayProps.forEach((property) => {
        if (Array.isArray(props[property])) {
          nextProps[property] = props[property].map((value) => resolveColor(value, 'color', colors));
        }
      });
    }
    if (options.trackColor && props.trackColor) {
      nextProps.trackColor = Object.fromEntries(
        Object.entries(props.trackColor).map(([key, value]) => [key, resolveColor(value, 'backgroundColor', colors)])
      );
    }
    if (options.thumbColor && props.thumbColor) {
      nextProps.thumbColor = resolveColor(props.thumbColor, 'backgroundColor', colors);
    }
    return <Component {...nextProps} />;
  });
  ThemedComponent.displayName = `XTalenti${Component.displayName || Component.name || 'Native'}`;
  return ThemedComponent;
}

export const View = withTheme(ReactNative.View);
export const Text = withTheme(ReactNative.Text, { colorProps: ['selectionColor'] });
export const TextInput = withTheme(ReactNative.TextInput, {
  colorProps: ['placeholderTextColor', 'selectionColor', 'cursorColor', 'underlineColorAndroid'],
});
export const TouchableOpacity = withTheme(ReactNative.TouchableOpacity);
export const TouchableHighlight = withTheme(ReactNative.TouchableHighlight);
export const TouchableWithoutFeedback = withTheme(ReactNative.TouchableWithoutFeedback);
export const Pressable = withTheme(ReactNative.Pressable);
export const Image = withTheme(ReactNative.Image);
export const ImageBackground = withTheme(ReactNative.ImageBackground);
export const ScrollView = withTheme(ReactNative.ScrollView, { contentContainer: true });
export const FlatList = withTheme(ReactNative.FlatList, { contentContainer: true });
export const SectionList = withTheme(ReactNative.SectionList, { contentContainer: true });
export const VirtualizedList = withTheme(ReactNative.VirtualizedList, { contentContainer: true });
export const KeyboardAvoidingView = withTheme(ReactNative.KeyboardAvoidingView);
export const SafeAreaView = withTheme(ReactNative.SafeAreaView);
export const ActivityIndicator = withTheme(ReactNative.ActivityIndicator, { colorProps: ['color'] });
export const RefreshControl = withTheme(ReactNative.RefreshControl, {
  colorArrayProps: ['colors'],
  colorProps: ['tintColor', 'progressBackgroundColor'],
});
export const Switch = withTheme(ReactNative.Switch, { trackColor: true, thumbColor: true });

export const Animated = new Proxy(ReactNative.Animated, {
  get(target, key) {
    if (key === 'View') return withTheme(target.View);
    if (key === 'Text') return withTheme(target.Text);
    if (key === 'ScrollView') return withTheme(target.ScrollView, { contentContainer: true });
    return Reflect.get(target, key);
  },
});
