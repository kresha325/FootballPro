import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'footballpro_marketplace_cart_v1';

const CartContext = createContext(null);

function clampQty(q, maxStock) {
  const n = Math.max(1, parseInt(String(q), 10) || 1);
  const cap = Math.max(0, parseInt(String(maxStock), 10) || 0);
  if (cap < 1) return 0;
  return Math.min(n, cap);
}

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setItems(parsed);
      }
    } catch (_e) {
      /* ignore */
    }
    setReady(true);
  }, []);

  const addItem = useCallback((product, quantity) => {
    if (!product?.id) return;
    const stock = Math.max(0, parseInt(String(product.stock ?? 0), 10) || 0);
    if (stock < 1) return;
    const pid = Number(product.id);
    const add = clampQty(quantity, stock);
    if (add < 1) return;

    setItems((prev) => {
      const next = [...prev];
      const idx = next.findIndex((x) => Number(x.productId) === pid);
      const line = {
        productId: pid,
        quantity: add,
        name: product.name || 'Produkt',
        price: Number(product.price) || 0,
        imageUrl: product.imageUrl || '',
        sellerId: product.sellerId != null ? Number(product.sellerId) : null,
        maxStock: stock,
      };
      if (idx >= 0) {
        const merged = clampQty(next[idx].quantity + add, stock);
        next[idx] = {
          ...next[idx],
          quantity: merged,
          maxStock: stock,
          price: line.price,
          name: line.name,
          imageUrl: line.imageUrl,
        };
      } else {
        next.push(line);
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (_e) {
        /* ignore */
      }
      return next;
    });
  }, []);

  const setLineQuantity = useCallback((productId, quantity) => {
    const pid = Number(productId);
    setItems((prev) => {
      const next = prev
        .map((x) => {
          if (Number(x.productId) !== pid) return x;
          const cap = Math.max(0, parseInt(String(x.maxStock ?? 0), 10) || 0);
          const q = Math.max(0, parseInt(String(quantity), 10) || 0);
          if (q < 1 || cap < 1) return null;
          return { ...x, quantity: Math.min(q, cap) };
        })
        .filter(Boolean);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (_e) {
        /* ignore */
      }
      return next;
    });
  }, []);

  const removeItem = useCallback((productId) => {
    const pid = Number(productId);
    setItems((prev) => {
      const next = prev.filter((x) => Number(x.productId) !== pid);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (_e) {
        /* ignore */
      }
      return next;
    });
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_e) {
      /* ignore */
    }
  }, []);

  const totalPieces = useMemo(() => items.reduce((s, x) => s + (parseInt(x.quantity, 10) || 0), 0), [items]);

  const orderPayload = useMemo(
    () => items.map((x) => ({ productId: Number(x.productId), quantity: parseInt(x.quantity, 10) || 1 })),
    [items]
  );

  const subtotalJonCoin = useMemo(() => {
    let t = 0;
    for (const x of items) {
      t += (Number(x.price) || 0) * (parseInt(x.quantity, 10) || 0);
    }
    return Math.round(t * 100) / 100;
  }, [items]);

  const value = useMemo(
    () => ({
      items,
      ready,
      addItem,
      setLineQuantity,
      removeItem,
      clearCart,
      totalPieces,
      orderPayload,
      subtotalJonCoin,
    }),
    [items, ready, addItem, setLineQuantity, removeItem, clearCart, totalPieces, orderPayload, subtotalJonCoin]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
