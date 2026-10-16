import { useLocale } from '../../contexts/LocaleContext';
import { Link } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';

export default function CartPage() {
  const { t } = useLocale();
  const { items, quote, ready, cartError, setLineQuantity, removeItem, clearCart, subtotalJonCoin } = useCart();

  if (!ready) return <div className="mx-auto max-w-3xl px-4 py-16 text-center">{t("Po ngarkohet shporta…")}</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black">{t("Shporta")}</h1>
        <Link to="/marketplace" className="text-sm text-[var(--xt-color-gold-bright)]">{t("Tregu")}</Link>
      </div>
      {cartError ? <p className="text-sm text-red-500">{cartError}</p> : null}
      {items.length === 0 ? (
        <div className="xt-card p-8 text-center">
          <p>{t("Shporta është bosh.")}</p>
          <Link to="/marketplace" className="btn btn-primary mt-4 inline-flex">{t("Shiko produktet")}</Link>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.productId} className="xt-card flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <Link to={`/marketplace/${item.productId}`} className="font-semibold">{item.name}</Link>
                  <p className="text-sm text-[var(--xt-color-text-muted)]">{item.price} {t("XCoin · stok")} {item.maxStock}</p>
                  {item.purchasable === false ? <p className="text-sm text-red-500">{item.unavailableReason || t('Nuk është i disponueshëm')}</p> : null}
                </div>
                <div className="flex items-center gap-2">
                  <input className="input w-20" type="number" min="1" max={item.maxStock || 99} value={item.quantity} onChange={(e) => setLineQuantity(item.productId, e.target.value)} />
                  <button type="button" className="btn btn-outline" onClick={() => removeItem(item.productId)}>{t("Hiq")}</button>
                </div>
              </div>
            ))}
          </div>
          <div className="xt-card space-y-1 p-4 text-sm">
            <p>{t("Nëntotali:")} <strong>{quote?.subtotal || subtotalJonCoin} {t("XCoin")}</strong></p>
            <p>{t("Komisioni i platformës (nga shitësi):")} {quote?.platformFee || '0.00'} {t("XCoin")}</p>
            <p className="text-lg font-black">{t("Totali për pagesë:")} {quote?.total || subtotalJonCoin} {t("XCoin")}</p>
            <p className="text-[var(--xt-color-text-muted)]">{t("Çmimi llogaritet nga serveri në checkout.")}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn btn-outline" onClick={clearCart}>{t("Pastro")}</button>
            <Link to="/checkout" className="btn btn-primary">{t("Vazhdo te pagesa")}</Link>
          </div>
        </>
      )}
    </div>
  );
}
