import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { subscribeXpNotifications } from '../utils/xpNotifications';

const DISPLAY_MS = 3200;

function XpToast({ item, index, topInset, onDone }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(48)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(translateX, { toValue: 0, friction: 8, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: 48, duration: 280, useNativeDriver: true }),
      ]).start(() => onDone(item.id));
    }, DISPLAY_MS);

    return () => clearTimeout(timer);
  }, [item.id, onDone, opacity, translateX]);

  const levelUp = item.levelUp;
  const isLevelUp = levelUp && levelUp.newLevel != null;

  return (
    <Animated.View
      style={[
        styles.toast,
        isLevelUp ? styles.toastLevelUp : styles.toastXp,
        {
          top: topInset + 12 + index * 92,
          opacity,
          transform: [{ translateX }],
        },
      ]}
      pointerEvents="none"
    >
      <Text style={styles.emoji}>{isLevelUp ? '🏆' : '✨'}</Text>
      <View style={styles.textCol}>
        {isLevelUp ? (
          <>
            <Text style={styles.title}>Level Up!</Text>
            <Text style={styles.sub}>
              Arrite nivelin {levelUp.newLevel}
              {levelUp.oldLevel != null ? ` (ishte ${levelUp.oldLevel})` : ''}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.title}>+{item.xp || 0} XP</Text>
            {item.reason ? <Text style={styles.sub}>{item.reason}</Text> : null}
          </>
        )}
      </View>
    </Animated.View>
  );
}

export default function XPNotificationManager() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState([]);
  const idRef = useRef(0);

  const remove = useCallback((id) => {
    setItems((prev) => prev.filter((n) => n.id !== id));
  }, []);

  useEffect(() => {
    return subscribeXpNotifications(({ xp, reason, levelUp }) => {
      const id = ++idRef.current;
      setItems((prev) => [...prev.slice(-4), { id, xp, reason, levelUp }]);
    });
  }, []);

  if (!items.length) return null;

  return (
    <View style={styles.host} pointerEvents="box-none">
      {items.map((item, index) => (
        <XpToast key={item.id} item={item} index={index} topInset={insets.top} onDone={remove} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
  toast: {
    position: 'absolute',
    right: 14,
    left: 14,
    maxWidth: 400,
    alignSelf: 'flex-end',
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  toastXp: {
    backgroundColor: '#4f46e5',
  },
  toastLevelUp: {
    backgroundColor: '#ea580c',
  },
  emoji: {
    fontSize: 28,
    marginRight: 12,
  },
  textCol: {
    flex: 1,
  },
  title: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
  },
  sub: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13,
    marginTop: 2,
  },
});
