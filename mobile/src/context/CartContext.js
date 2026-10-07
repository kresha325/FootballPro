import React, { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addCartItemRequest,
  cartRequest,
  clearCartRequest,
  removeCartItemRequest,
  updateCartItemRequest,
} from '../api/client';
import { useAuth } from './AuthContext';

const STORAGE_KEY = 'footballpro_marketplace_cart_v1';
const CartContext = createContext(null);

let cartSnapshot = { items: [], serverTotal: null, ready: false };
const cartSubscribers = new Set();

function subscribeCart(listener) {
  cartSubscribers.add(listener);
  return () => cartSubscribers.delete(listener);
}

function readCart() {
  return cartSnapshot;
}

function publishCart(next) {
  if (
    next.items === cartSnapshot.items &&
    next.serverTotal === cartSnapshot.serverTotal &&
    next.ready === cartSnapshot.ready
  ) {
    return;
  }
  cartSnapshot = next;
  cartSubscribers.forEach((listener) => listener());
}

function mapServer(data) {
  const items = Array.isArray(data?.items) ? data.items.map((item) => ({
    productId: Number(item.productId),
    quantity: Number(item.quantity) || 1,
    name: item.name || 'Produkt',
    price: Number(item.price) || 0,
    imageUrl: item.imageUrl || '',
    sellerId: item.sellerId != null ? Number(item.sellerId) : null,
    maxStock: Number(item.maxStock) || 0,
  })) : [];
  return { items, total: data?.total };
}

export function CartProvider({ children }) {
  const { token } = useAuth();

  const apply = useCallback(async (data) => {
    const mapped = mapServer(data);
    publishCart({ items: mapped.items, serverTotal: mapped.total, ready: true });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(mapped.items));
    } catch (_e) {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await cartRequest();
        if (!cancelled) await apply(res.data);
      } catch (_e) {
        try {
          const raw = await AsyncStorage.getItem(STORAGE_KEY);
          if (!cancelled && raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) publishCart({ ...readCart(), items: parsed });
          }
        } catch (_err) {
          /* ignore */
        }
      } finally {
        if (!cancelled) publishCart({ ...readCart(), ready: true });
      }
    })();
    return () => { cancelled = true; };
  }, [apply, token]);

  const addItem = useCallback(async (product, quantity) => {
    if (!product?.id) return;
    try {
      const res = await addCartItemRequest(Number(product.id), Math.max(1, parseInt(quantity, 10) || 1));
      await apply(res.data);
    } catch (_e) {
      /* server remains source of truth when it is reachable */
    }
  }, [apply]);

  const setLineQuantity = useCallback(async (productId, quantity) => {
    const q = parseInt(quantity, 10) || 0;
    try {
      const res = q < 1 ? await removeCartItemRequest(productId) : await updateCartItemRequest(productId, q);
      await apply(res.data);
    } catch (_e) {
      /* ignore */
    }
  }, [apply]);

  const removeItem = useCallback(async (productId) => {
    try {
      const res = await removeCartItemRequest(productId);
      await apply(res.data);
    } catch (_e) {
      /* ignore */
    }
  }, [apply]);

  const clearCart = useCallback(async () => {
    try {
      const res = await clearCartRequest();
      await apply(res.data);
    } catch (_e) {
      publishCart({ items: [], serverTotal: null, ready: true });
      AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    }
  }, [apply]);

  const value = useMemo(
    () => ({ addItem, setLineQuantity, removeItem, clearCart }),
    [addItem, setLineQuantity, removeItem, clearCart]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const actions = useContext(CartContext);
  const snapshot = useSyncExternalStore(subscribeCart, readCart, readCart);
  if (!actions) throw new Error('useCart outside CartProvider');
  const { items, serverTotal, ready } = snapshot;
  const totalPieces = items.reduce((sum, item) => sum + (parseInt(item.quantity, 10) || 0), 0);
  const orderPayload = items.map((item) => ({
    productId: Number(item.productId),
    quantity: parseInt(item.quantity, 10) || 1,
  }));
  const subtotalJonCoin = serverTotal != null
    ? Number(serverTotal) || 0
    : items.reduce((sum, item) => sum + (Number(item.price) || 0) * (parseInt(item.quantity, 10) || 0), 0);
  return { ...actions, items, ready, totalPieces, orderPayload, subtotalJonCoin };
}
