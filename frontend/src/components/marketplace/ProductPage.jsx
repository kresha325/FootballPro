import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { marketplaceAPI } from '../../services/api';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';

export default function ProductPage() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItem } = useCart();
  const [product, setProduct] = useState(null);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    marketplaceAPI.getProduct(productId)
      .then(({ data }) => {
        if (!cancelled) {
          setProduct(data);
          setError('');
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.msg || 'Produkti nuk u gjet');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [productId]);

  if (loading) return <div className="mx-auto max-w-3xl px-4 py-16 text-center">Po ngarkohet produkti…</div>;
  if (error || !product) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="mb-4">{error || 'Produkt bosh'}</p>
        <Link to="/marketplace" className="btn btn-primary">Kthehu te tregu</Link>
      </div>
    );
  }

  const own = user?.id != null && Number(product.sellerId) === Number(user.id);
  const stock = Number(product.stock) || 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 pb-24">
      <Link to="/marketplace" className="text-sm text-[var(--xt-color-gold-bright)]">← Tregu</Link>
      <div className="xt-card mt-4 overflow-hidden">
        {product.imageUrl ? <img src={product.imageUrl} alt="" className="h-64 w-full object-cover" /> : <div className="h-40 bg-black/20" />}
        <div className="space-y-3 p-5">
          <p className="text-xs uppercase tracking-wide text-[var(--xt-color-text-muted)]">{product.category} · {product.condition || 'new'} · {product.status}</p>
          <h1 className="text-3xl font-black">{product.name}</h1>
          <p className="text-[var(--xt-color-text-muted)]">{product.description || 'Pa përshkrim.'}</p>
          <p className="font-mono text-2xl">{product.joncoinPrice} XCoin <span className="text-sm text-[var(--xt-color-text-muted)]">({product.price} {product.currency || 'EUR'})</span></p>
          <p>{stock > 0 ? `${stock} në stok` : 'Jashtë stokut'}</p>
          {notice ? <p className="text-sm text-red-500">{notice}</p> : null}
          {!own && product.purchasable ? (
            <div className="flex flex-wrap gap-2">
              <input className="input w-24" type="number" min="1" max={stock} value={qty} onChange={(e) => setQty(e.target.value)} />
              <button
                className="btn btn-primary"
                type="button"
                onClick={async () => {
                  setNotice('');
                  await addItem(product, qty);
                  navigate('/cart');
                }}
              >
                Shto në shportë
              </button>
            </div>
          ) : (
            <p className="text-sm">{own ? 'Ky është produkti yt.' : 'Ky produkt nuk blihet për momentin.'}</p>
          )}
        </div>
      </div>
    </div>
  );
}
