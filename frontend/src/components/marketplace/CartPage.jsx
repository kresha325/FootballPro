import { Link } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';

export default function CartPage() {
  const { items, quote, ready, cartError, setLineQuantity, removeItem, clearCart, subtotalJonCoin } = useCart();

  if (!ready) return <div className="mx-auto max-w-3xl px-4 py-16 text-center">Po ngarkohet shporta…</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black">Shporta</h1>
        <Link to="/marketplace" className="text-sm text-[var(--xt-color-gold-bright)]">Tregu</Link>
      </div>
      {cartError ? <p className="text-sm text-red-500">{cartError}</p> : null}
      {items.length === 0 ? (
        <div className="xt-card p-8 text-center">
          <p>Shporta është bosh.</p>
          <Link to="/marketplace" className="btn btn-primary mt-4 inline-flex">Shiko produktet</Link>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.productId} className="xt-card flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <Link to={`/marketplace/${item.productId}`} className="font-semibold">{item.name}</Link>
                  <p className="text-sm text-[var(--xt-color-text-muted)]">{item.price} XCoin · stok {item.maxStock}</p>
                  {item.purchasable === false ? <p className="text-sm text-red-500">{item.unavailableReason || 'Nuk është i disponueshëm'}</p> : null}
                </div>
                <div className="flex items-center gap-2">
                  <input className="input w-20" type="number" min="1" max={item.maxStock || 99} value={item.quantity} onChange={(e) => setLineQuantity(item.productId, e.target.value)} />
                  <button type="button" className="btn btn-outline" onClick={() => removeItem(item.productId)}>Hiq</button>
                </div>
              </div>
            ))}
          </div>
          <div className="xt-card space-y-1 p-4 text-sm">
            <p>Nëntotali: <strong>{quote?.subtotal || subtotalJonCoin} XCoin</strong></p>
            <p>Komisioni i platformës (nga shitësi): {quote?.platformFee || '0.00'} XCoin</p>
            <p className="text-lg font-black">Totali për pagesë: {quote?.total || subtotalJonCoin} XCoin</p>
            <p className="text-[var(--xt-color-text-muted)]">Çmimi llogaritet nga serveri në checkout.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn btn-outline" onClick={clearCart}>Pastro</button>
            <Link to="/checkout" className="btn btn-primary">Vazhdo te pagesa</Link>
          </div>
        </>
      )}
    </div>
  );
}
