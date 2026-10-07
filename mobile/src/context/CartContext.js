import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
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
  const [items, setItems] = useState([]);
  const [serverTotal, setServerTotal] = useState(null);
  const [ready, setReady] = useState(false);

  const apply = useCallback(async (data) => {
    const mapped = mapServer(data);
    setItems(mapped.items);
    setServerTotal(mapped.total);
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
            if (Array.isArray(parsed)) setItems(parsed);
          }
        } catch (_err) {
          /* ignore */
        }
      } finally {
        if (!cancelled) setReady(true);
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
      setItems([]);
      setServerTotal(null);
      AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    }
  }, [apply]);

  const totalPieces = useMemo(() => items.reduce((sum, item) => sum + (parseInt(item.quantity, 10) || 0), 0), [items]);
  const orderPayload = useMemo(
    () => items.map((item) => ({ productId: Number(item.productId), quantity: parseInt(item.quantity, 10) || 1 })),
    [items]
  );
  const subtotalJonCoin = useMemo(() => {
    if (serverTotal != null) return Number(serverTotal) || 0;
    return items.reduce((sum, item) => sum + (Number(item.price) || 0) * (parseInt(item.quantity, 10) || 0), 0);
  }, [items, serverTotal]);

  const value = useMemo(() => ({
    items, ready, addItem, setLineQuantity, removeItem, clearCart, totalPieces, orderPayload, subtotalJonCoin,
  }), [items, ready, addItem, setLineQuantity, removeItem, clearCart, totalPieces, orderPayload, subtotalJonCoin]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart outside CartProvider');
  return ctx;
}
