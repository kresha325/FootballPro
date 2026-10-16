import { useLocale } from '../../contexts/LocaleContext';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ordersAPI } from '../../services/api';

const NEXT = {
  paid: 'processing',
  processing: 'shipped',
  shipped: 'delivered',
};

export default function OrdersPage() {
  const { t } = useLocale();
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
      setError(err?.response?.data?.msg || t('Porositë nuk u ngarkuan'));
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
      setNotice(err?.response?.data?.msg || t('Veprimi dështoi'));
    }
  };

  if (loading) return <div className="mx-auto max-w-4xl px-4 py-16 text-center">{t("Po ngarkohen porositë…")}</div>;
  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <p className="mb-4">{error}</p>
        <button className="btn btn-primary" type="button" onClick={load}>{t("Provo përsëri")}</button>
      </div>
    );
  }

  if (id && order) {
    const next = NEXT[order.status];
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 pb-24">
        <Link to="/orders" className="text-sm text-[var(--xt-color-gold-bright)]">{t("← Porositë")}</Link>
        <div className="xt-card space-y-2 p-5">
          <h1 className="text-2xl font-black">{t("Porosia #")}{order.id}</h1>
          <p className="capitalize">{t("Statusi:")} <strong>{t(order.status)}</strong></p>
          <p>{t("Totali:")} {order.totalAmount} {t("XCoin")}</p>
          <p>{t("Shitësi merr:")} {order.sellerNetAmount || order.totalAmount} {t("· tarifa:")} {order.platformFeeAmount || '0.00'}</p>
          <p>{Array.isArray(order.products) ? order.products.map((line) => `${line.name} × ${line.quantity}`).join(', ') : ''}</p>
          <p>{t("Kontakti:")} {order.buyerContact || '—'}</p>
          <p>{order.deliveryMethod} {order.deliveryAddress || ''}</p>
          {notice ? <p className="text-sm text-red-500">{notice}</p> : null}
          <div className="flex flex-wrap gap-2 pt-2">
            {order.status === 'pending' ? (
              <>
                <button className="btn btn-primary" type="button" onClick={() => act(() => ordersAPI.acceptOrder(order.id))}>{t("Prano")}</button>
                <button className="btn btn-outline" type="button" onClick={() => act(() => ordersAPI.rejectOrder(order.id))}>{t("Refuzo")}</button>
                <button className="btn btn-outline" type="button" onClick={() => act(() => ordersAPI.cancelOrder(order.id))}>{t("Anulo")}</button>
              </>
            ) : null}
            {next ? <button className="btn btn-primary" type="button" onClick={() => act(() => ordersAPI.updateStatus(order.id, next))}>{t("Shëno")} {t(next)}</button> : null}
            {['paid', 'processing', 'shipped', 'delivered'].includes(order.status) ? (
              <button className="btn btn-outline" type="button" onClick={() => act(() => ordersAPI.refundOrder(order.id))}>{t("Rimburso")}</button>
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
        <div className="flex justify-between"><span>#{row.id}</span><span className="capitalize">{t(row.status)}</span></div>
        <p className="text-sm">{row.totalAmount} {t("XCoin")}</p>
      </Link>
    ));

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black">{t("Porositë")}</h1>
        <Link to="/marketplace" className="text-sm text-[var(--xt-color-gold-bright)]">{t("Tregu")}</Link>
      </div>
      {summary ? (
        <div className="xt-card grid gap-2 p-4 text-sm sm:grid-cols-3">
          <p>{t("Shitje bruto:")} <strong>{summary.grossSales}</strong></p>
          <p>{t("Tarifa:")} <strong>{summary.platformFees}</strong></p>
          <p>{t("Neto:")} <strong>{summary.netAmount}</strong></p>
          <p>{t("Të përfunduara:")} {summary.completedOrders}</p>
          <p>{t("Të rimbursuara:")} {summary.refundedOrders}</p>
          <p>{t("Balanca:")} {summary.sellerBalance} {t("XCoin")}</p>
        </div>
      ) : null}
      <section className="space-y-2">
        <h2 className="font-bold">{t("Blerjet")}</h2>
        {list(orders, t('Nuk ke blerje.'))}
      </section>
      <section className="space-y-2">
        <h2 className="font-bold">{t("Shitjet")}</h2>
        {list(sales, t('Nuk ke shitje.'))}
      </section>
    </div>
  );
}
