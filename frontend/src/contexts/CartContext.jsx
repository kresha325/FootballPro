import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { cartAPI } from '../services/api';
import { useAuth } from './AuthContext';

const STORAGE_KEY = 'footballpro_marketplace_cart_v1';
const CartContext = createContext(null);

function mapServerCart(data) {
  const items = Array.isArray(data?.items) ? data.items.map((item) => ({
    productId: Number(item.productId),
    quantity: Number(item.quantity) || 1,
    name: item.name || 'Produkt',
    price: Number(item.price) || 0,
    imageUrl: item.imageUrl || '',
    sellerId: item.sellerId != null ? Number(item.sellerId) : null,
    maxStock: Number(item.maxStock) || 0,
    lineTotal: item.lineTotal,
    purchasable: item.purchasable !== false,
    unavailableReason: item.unavailableReason || '',
  })) : [];
  return {
    items,
    quote: {
      subtotal: data?.subtotal || '0.00',
      platformFee: data?.platformFee || '0.00',
      total: data?.total || '0.00',
      currency: data?.currency || 'JON',
    },
  };
}

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [quote, setQuote] = useState(null);
  const [ready, setReady] = useState(false);
  const [cartError, setCartError] = useState('');

  const apply = useCallback((data) => {
    const mapped = mapServerCart(data);
    setItems(mapped.items);
    setQuote(mapped.quote);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped.items));
    } catch (_e) {
      /* ignore */
    }
  }, []);

  const refresh = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setReady(true);
      return;
    }
    try {
      const { data } = await cartAPI.get();
      apply(data);
      setCartError('');
    } catch (err) {
      setCartError(err?.response?.data?.msg || '');
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setItems(parsed);
        }
      } catch (_e) {
        /* ignore */
      }
    } finally {
      setReady(true);
    }
  }, [apply]);

  useEffect(() => {
    refresh();
  }, [refresh, user?.id]);

  const addItem = useCallback(async (product, quantity) => {
    if (!product?.id) return;
    setCartError('');
    try {
      const { data } = await cartAPI.add(Number(product.id), Math.max(1, parseInt(quantity, 10) || 1));
      apply(data);
      return true;
    } catch (err) {
      const message = err?.response?.data?.msg || 'Nuk u shtua në shportë';
      setCartError(message);
      return false;
    }
  }, [apply]);

  const setLineQuantity = useCallback(async (productId, quantity) => {
    const q = parseInt(quantity, 10) || 0;
    setCartError('');
    try {
      if (q < 1) {
        const { data } = await cartAPI.remove(productId);
        apply(data);
        return;
      }
      const { data } = await cartAPI.update(productId, q);
      apply(data);
    } catch (err) {
      setCartError(err?.response?.data?.msg || 'Sasia nuk u përditësua');
    }
  }, [apply]);

  const removeItem = useCallback(async (productId) => {
    setCartError('');
    try {
      const { data } = await cartAPI.remove(productId);
      apply(data);
    } catch (err) {
      setCartError(err?.response?.data?.msg || 'Nuk u hoq nga shporta');
    }
  }, [apply]);

  const clearCart = useCallback(async () => {
    setCartError('');
    try {
      const { data } = await cartAPI.clear();
      apply(data);
    } catch (_err) {
      setItems([]);
      setQuote(null);
      try { localStorage.removeItem(STORAGE_KEY); } catch (_e) { /* ignore */ }
    }
  }, [apply]);

  const totalPieces = useMemo(() => items.reduce((sum, item) => sum + (parseInt(item.quantity, 10) || 0), 0), [items]);
  const orderPayload = useMemo(
    () => items.map((item) => ({ productId: Number(item.productId), quantity: parseInt(item.quantity, 10) || 1 })),
    [items]
  );
  const subtotalJonCoin = useMemo(() => {
    if (quote?.total != null) return Number(quote.total) || 0;
    return items.reduce((sum, item) => sum + (Number(item.price) || 0) * (parseInt(item.quantity, 10) || 0), 0);
  }, [items, quote]);

  const value = useMemo(() => ({
    items, quote, ready, cartError, addItem, setLineQuantity, removeItem, clearCart, refresh,
    totalPieces, orderPayload, subtotalJonCoin,
  }), [items, quote, ready, cartError, addItem, setLineQuantity, removeItem, clearCart, refresh, totalPieces, orderPayload, subtotalJonCoin]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
