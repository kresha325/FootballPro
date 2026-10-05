import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ordersAPI } from '../../services/api';
import { useCart } from '../../contexts/CartContext';
import { getJonCoinBalance } from '../../services/joncoin';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { items, quote, orderPayload, subtotalJonCoin, clearCart, cartError } = useCart();
  const [form, setForm] = useState({ deliveryMethod: 'meetup', buyerContact: '', deliveryAddress: '', deliveryNotes: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pay = async (event) => {
    event.preventDefault();
    setError('');
    if (!orderPayload.length) {
      setError('Shporta është bosh.');
      return;
    }
    setBusy(true);
    const idempotencyKey = `checkout-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      const { data } = await ordersAPI.createOrder({
        products: orderPayload,
        ...form,
      }, idempotencyKey);
      await clearCart();
      const orderId = data?.order?.id || data?.orders?.[0]?.id;
      navigate(orderId ? `/orders/${orderId}` : '/orders');
    } catch (err) {
      setError(err?.response?.data?.msg || 'Pagesa dështoi. Asgjë nuk u tërhoq nëse porosia nuk u krijua.');
      getJonCoinBalance().catch(() => {});
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-6 pb-24">
      <Link to="/cart" className="text-sm text-[var(--xt-color-gold-bright)]">← Shporta</Link>
      <h1 className="mt-3 text-3xl font-black">Pagesa me XCoin</h1>
      <p className="mt-2 text-sm text-[var(--xt-color-text-muted)]">
        {items.length} artikuj · {quote?.total || subtotalJonCoin} XCoin. Serveri rillogarit çmimin dhe stokun.
      </p>
      {cartError ? <p className="mt-2 text-sm text-red-500">{cartError}</p> : null}
      {error ? <p className="mt-2 text-sm text-red-500">{error}</p> : null}
      <form onSubmit={pay} className="xt-card mt-4 space-y-3 p-4">
        <label className="block text-sm">
          Marrja
          <select className="input mt-1 w-full" value={form.deliveryMethod} onChange={(e) => setForm({ ...form, deliveryMethod: e.target.value })}>
            <option value="meetup">Takim</option>
            <option value="pickup">Marrje personale</option>
            <option value="shipping">Dërgesë</option>
          </select>
        </label>
        <label className="block text-sm">
          Kontakti
          <input className="input mt-1 w-full" required value={form.buyerContact} onChange={(e) => setForm({ ...form, buyerContact: e.target.value })} placeholder="Telefon ose email" />
        </label>
        <label className="block text-sm">
          Adresa
          <textarea className="input mt-1 w-full" required={form.deliveryMethod === 'shipping'} value={form.deliveryAddress} onChange={(e) => setForm({ ...form, deliveryAddress: e.target.value })} />
        </label>
        <label className="block text-sm">
          Shënim
          <textarea className="input mt-1 w-full" value={form.deliveryNotes} onChange={(e) => setForm({ ...form, deliveryNotes: e.target.value })} />
        </label>
        <button className="btn btn-primary w-full" type="submit" disabled={busy || items.length === 0}>
          {busy ? 'Po procesohet…' : 'Paguaj me XCoin'}
        </button>
      </form>
    </div>
  );
}
