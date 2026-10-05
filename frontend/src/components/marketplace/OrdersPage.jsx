import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ordersAPI } from '../../services/api';

const NEXT = {
  paid: 'processing',
  processing: 'shipped',
  shipped: 'delivered',
};

export default function OrdersPage() {
  const { id } = useParams();
  const [orders, setOrders] = useState([]);
  const [sales, setSales] = useState([]);
  const [summary, setSummary] = useState(null);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      if (id) {
        const { data } = await ordersAPI.getOrder(id);
        setOrder(data);
      } else {
        const [mine, selling, sum] = await Promise.all([
          ordersAPI.getMyOrders(),
          ordersAPI.getSellerOrders(),
          ordersAPI.getSellerSummary(),
        ]);
        setOrders(Array.isArray(mine.data) ? mine.data : []);
        setSales(Array.isArray(selling.data) ? selling.data : []);
        setSummary(sum.data);
      }
    } catch (err) {
      setError(err?.response?.data?.msg || 'Porositë nuk u ngarkuan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const act = async (fn) => {
    setNotice('');
    try {
      await fn();
      await load();
    } catch (err) {
      setNotice(err?.response?.data?.msg || 'Veprimi dështoi');
    }
  };

  if (loading) return <div className="mx-auto max-w-4xl px-4 py-16 text-center">Po ngarkohen porositë…</div>;
  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <p className="mb-4">{error}</p>
        <button className="btn btn-primary" type="button" onClick={load}>Provo përsëri</button>
      </div>
    );
  }

  if (id && order) {
    const next = NEXT[order.status];
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 pb-24">
        <Link to="/orders" className="text-sm text-[var(--xt-color-gold-bright)]">← Porositë</Link>
        <div className="xt-card space-y-2 p-5">
          <h1 className="text-2xl font-black">Porosia #{order.id}</h1>
          <p className="capitalize">Statusi: <strong>{order.status}</strong></p>
          <p>Totali: {order.totalAmount} XCoin</p>
          <p>Shitësi merr: {order.sellerNetAmount || order.totalAmount} · tarifa: {order.platformFeeAmount || '0.00'}</p>
          <p>{Array.isArray(order.products) ? order.products.map((line) => `${line.name} × ${line.quantity}`).join(', ') : ''}</p>
          <p>Kontakti: {order.buyerContact || '—'}</p>
          <p>{order.deliveryMethod} {order.deliveryAddress || ''}</p>
          {notice ? <p className="text-sm text-red-500">{notice}</p> : null}
          <div className="flex flex-wrap gap-2 pt-2">
            {order.status === 'pending' ? (
              <>
                <button className="btn btn-primary" type="button" onClick={() => act(() => ordersAPI.acceptOrder(order.id))}>Prano</button>
                <button className="btn btn-outline" type="button" onClick={() => act(() => ordersAPI.rejectOrder(order.id))}>Refuzo</button>
                <button className="btn btn-outline" type="button" onClick={() => act(() => ordersAPI.cancelOrder(order.id))}>Anulo</button>
              </>
            ) : null}
            {next ? <button className="btn btn-primary" type="button" onClick={() => act(() => ordersAPI.updateStatus(order.id, next))}>Shëno {next}</button> : null}
            {['paid', 'processing', 'shipped', 'delivered'].includes(order.status) ? (
              <button className="btn btn-outline" type="button" onClick={() => act(() => ordersAPI.refundOrder(order.id))}>Rimburso</button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  const list = (rows, empty) => rows.length === 0
    ? <p className="text-sm text-[var(--xt-color-text-muted)]">{empty}</p>
    : rows.map((row) => (
      <Link key={row.id} to={`/orders/${row.id}`} className="xt-card block p-3">
        <div className="flex justify-between"><span>#{row.id}</span><span className="capitalize">{row.status}</span></div>
        <p className="text-sm">{row.totalAmount} XCoin</p>
      </Link>
    ));

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black">Porositë</h1>
        <Link to="/marketplace" className="text-sm text-[var(--xt-color-gold-bright)]">Tregu</Link>
      </div>
      {summary ? (
        <div className="xt-card grid gap-2 p-4 text-sm sm:grid-cols-3">
          <p>Shitje bruto: <strong>{summary.grossSales}</strong></p>
          <p>Tarifa: <strong>{summary.platformFees}</strong></p>
          <p>Neto: <strong>{summary.netAmount}</strong></p>
          <p>Të përfunduara: {summary.completedOrders}</p>
          <p>Të rimbursuara: {summary.refundedOrders}</p>
          <p>Balanca: {summary.sellerBalance} XCoin</p>
        </div>
      ) : null}
      <section className="space-y-2">
        <h2 className="font-bold">Blerjet</h2>
        {list(orders, 'Nuk ke blerje.')}
      </section>
      <section className="space-y-2">
        <h2 className="font-bold">Shitjet</h2>
        {list(sales, 'Nuk ke shitje.')}
      </section>
    </div>
  );
}
