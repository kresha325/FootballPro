import { Platform } from 'react-native';
import {
  initConnection,
  endConnection,
  fetchProducts,
  requestPurchase,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  ErrorCode,
} from 'expo-iap';
import { verifyIapPurchaseRequest } from '../api/client';
import { JONCOIN_SKUS, PREMIUM_SKUS } from './products';

let connectionReady = false;

function removeSub(sub) {
  try {
    if (!sub) return;
    if (typeof sub === 'function') sub();
    else if (typeof sub.remove === 'function') sub.remove();
  } catch {
    /* ignore */
  }
}

export async function ensureIapConnection() {
  if (connectionReady) return true;
  try {
    connectionReady = !!(await initConnection());
    return connectionReady;
  } catch (error) {
    console.warn('IAP init failed:', error?.message || error);
    connectionReady = false;
    return false;
  }
}

export async function disconnectIap() {
  try {
    await endConnection();
  } catch {
    /* ignore */
  }
  connectionReady = false;
}

export async function loadIapProducts() {
  const ok = await ensureIapConnection();
  if (!ok) return { subscriptions: [], consumables: [] };

  const [subscriptions, consumables] = await Promise.all([
    fetchProducts({ skus: PREMIUM_SKUS, type: 'subs' }).catch(() => []),
    fetchProducts({ skus: JONCOIN_SKUS, type: 'inapp' }).catch(() => []),
  ]);

  return {
    subscriptions: Array.isArray(subscriptions) ? subscriptions : [],
    consumables: Array.isArray(consumables) ? consumables : [],
  };
}

function normalizePurchase(result) {
  if (!result) return null;
  if (Array.isArray(result)) return result[0] || null;
  return result;
}

function isUserCancelled(error) {
  const code = error?.code;
  return (
    code === ErrorCode.E_USER_CANCELLED ||
    code === 'E_USER_CANCELLED' ||
    code === 'user-cancelled' ||
    /cancel/i.test(String(error?.message || ''))
  );
}

/**
 * Purchase a product/subscription then verify+fulfill on backend, then finish transaction.
 * @param {string} sku
 * @param {{ type?: 'inapp' | 'subs' }} [opts]
 */
export async function purchaseAndFulfill(sku, { type = 'inapp' } = {}) {
  const ok = await ensureIapConnection();
  if (!ok) {
    throw new Error('IAP nuk është i disponueshëm në këtë build. Kërkon rebuild me expo-iap (jo Expo Go).');
  }

  const purchase = await new Promise((resolve, reject) => {
    let settled = false;
    const successSub = purchaseUpdatedListener((p) => {
      if (settled) return;
      settled = true;
      removeSub(successSub);
      removeSub(errorSub);
      resolve(p);
    });
    const errorSub = purchaseErrorListener((error) => {
      if (settled) return;
      settled = true;
      removeSub(successSub);
      removeSub(errorSub);
      if (isUserCancelled(error)) {
        reject(Object.assign(new Error('Blerja u anulua'), { cancelled: true }));
        return;
      }
      reject(error instanceof Error ? error : new Error(error?.message || 'IAP error'));
    });

    requestPurchase({
      request: {
        ios: { sku },
        android: { skus: [sku] },
      },
      type,
    })
      .then((immediate) => {
        const normalized = normalizePurchase(immediate);
        if (normalized && !settled) {
          settled = true;
          removeSub(successSub);
          removeSub(errorSub);
          resolve(normalized);
        }
      })
      .catch((err) => {
        if (settled) return;
        if (isUserCancelled(err)) {
          settled = true;
          removeSub(successSub);
          removeSub(errorSub);
          reject(Object.assign(new Error('Blerja u anulua'), { cancelled: true }));
        }
        // Otherwise wait for listener (common on Android)
      });
  });

  const productId = purchase.productId || purchase.id || sku;
  const transactionId = String(purchase.id || purchase.transactionId || '');
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';

  const verifyRes = await verifyIapPurchaseRequest({
    platform,
    productId: purchase.productId || sku,
    transactionId,
    purchaseToken: purchase.purchaseToken || null,
    transactionReceipt: purchase.transactionReceipt || null,
  });

  const consumable = !!verifyRes?.data?.consumable || type === 'inapp';
  try {
    await finishTransaction({ purchase, isConsumable: consumable });
  } catch (finishErr) {
    console.warn('finishTransaction:', finishErr?.message || finishErr);
  }

  return verifyRes?.data;
}
