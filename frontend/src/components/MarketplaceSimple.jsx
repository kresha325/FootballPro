import { useState, useEffect, useMemo } from 'react';
import ListSearchBar from './ListSearchBar';
import { filterBySearch } from '../utils/listSearch';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import axios from 'axios';
import { getJonCoinBalance } from '../services/joncoin';
import { useNavigate } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';

const API = axios.create({ baseURL: import.meta.env.VITE_API_URL });
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** API mund të kthejë `/uploads/...` ose URL të plotë pasi backend e normalizon. */
function productImageSrc(url) {
  if (!url || typeof url !== 'string') return '';
  const u = url.trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  const base = String(import.meta.env.VITE_API_URL || '')
    .replace(/\/api\/?$/i, '')
    .replace(/\/$/, '');
  const path = u.startsWith('/') ? u : `/${u}`;
  return `${base}${path}`;
}

export default function MarketplaceSimple() {
  const navigate = useNavigate();
  const [jonCoinBalance, setJonCoinBalance] = useState(null);
  const { user } = useAuth();
  const { addItem, items, totalPieces, orderPayload, subtotalJonCoin, setLineQuantity, removeItem, clearCart } =
    useCart();
  const [searchParams] = useSearchParams();
    const [imageFile, setImageFile] = useState(null);
  const [products, setProducts] = useState([]);
  const [listSearch, setListSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [category, setCategory] = useState('all');
  const [cartChecking, setCartChecking] = useState(false);
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [orderQty, setOrderQty] = useState({}); // productId -> sasi
  const [showEditModal, setShowEditModal] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    price: '',
    stock: '1',
    category: 'gear',
    condition: 'new',
  });
  const [editImageFile, setEditImageFile] = useState(null);
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    price: '',
    stock: '1',
    category: 'gear',
    condition: 'new',
  });

  const deleteProduct = async (productId) => {
    if (!window.confirm('A je i sigurt që do ta fshish këtë produkt?')) return;
    try {
      await API.delete(`/products/${productId}`);
      setSelectedProduct(null);
      fetchProducts();
    } catch (error) {
      alert(error.response?.data?.msg || 'Nuk u fshi produkti!');
    }
  };

  const openEditModal = (product) => {
    setEditProduct(product);
    setEditForm({
      name: product.name || '',
      description: product.description || '',
      price: String(product.price ?? ''),
      stock: String(product.stock ?? '0'),
      category: product.category || 'gear',
      condition: product.condition || 'new',
    });
    setEditImageFile(null);
    setShowEditModal(true);
  };

  const saveProductEdit = async (e) => {
    e.preventDefault();
    if (!editProduct?.id) return;
    try {
      const formData = new FormData();
      formData.append('name', editForm.name);
      formData.append('description', editForm.description);
      formData.append('price', editForm.price);
      formData.append('category', editForm.category);
      formData.append('condition', editForm.condition);
      const stockNum = Math.max(0, parseInt(String(editForm.stock || '0'), 10) || 0);
      formData.append('stock', String(stockNum));
      if (editImageFile) {
        formData.append('image', editImageFile);
      }
      await API.put(`/products/${editProduct.id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setShowEditModal(false);
      setEditProduct(null);
      setSelectedProduct((prev) => (prev && prev.id === editProduct.id ? null : prev));
      fetchProducts();
      alert('Produkti u përditësua.');
    } catch (error) {
      console.error('Error updating product:', error);
      alert(error.response?.data?.msg || 'Përditësimi dështoi');
    }
  };

  useEffect(() => {
    fetchProducts();

    // Fetch JonCoin balance
    getJonCoinBalance().then(({ balance: bal }) => setJonCoinBalance(Number(bal) || 0));
    
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');
    if (success || canceled) {
      window.history.replaceState({}, '', '/marketplace');
    }
  }, [category, searchParams]);

  const fetchProducts = async () => {
    try {
      const response = await API.get('/products');
      let allProducts = response.data || [];
      if (category !== 'all') {
        allProducts = allProducts.filter(p => p.category === category);
      }
      setProducts(allProducts);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const createProduct = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('name', newProduct.name);
      formData.append('description', newProduct.description);
      formData.append('price', newProduct.price);
      formData.append('category', newProduct.category);
      formData.append('condition', newProduct.condition);
      const stockNum = Math.max(0, parseInt(String(newProduct.stock || '0'), 10) || 0);
      formData.append('stock', String(stockNum));
      if (user?.id) {
        formData.append('sellerId', user.id);
      }
      if (imageFile) {
        formData.append('image', imageFile);
      }
      await API.post('/products', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setShowCreateModal(false);
      setNewProduct({
        name: '',
        description: '',
        price: '',
        stock: '1',
        category: 'gear',
        condition: 'new',
      });
      setImageFile(null);
      fetchProducts();
    } catch (error) {
      console.error('Error creating product:', error);
      alert('Failed to create product');
    }
  };

  const addToCart = (product, e) => {
    if (e?.stopPropagation) e.stopPropagation();
    if (!product?.id) return;
    if (user?.id != null && Number(product.sellerId) === Number(user.id)) {
      return;
    }
    const stock = Math.max(0, parseInt(String(product.stock), 10) || 0);
    if (stock < 1) {
      alert('Nuk ka stok.');
      return;
    }
    const raw = orderQty[product.id];
    const q = Math.max(1, Math.min(stock, parseInt(String(raw != null && raw !== '' ? raw : 1), 10) || 1));
    addItem(product, q);
  };

  const checkoutCart = async () => {
    if (!orderPayload.length) {
      alert('Shporta është bosh.');
      return;
    }
    const total = subtotalJonCoin;
    if (total > (Number(jonCoinBalance) || 0)) {
      alert('Nuk ke mjaftueshëm JonCoin për këtë porosi.');
      return;
    }
    if (!window.confirm(`Paguaj ${total} JonCoin për ${totalPieces} copë?`)) return;

    setCartChecking(true);
    try {
      await API.post('/orders', { products: orderPayload });
      alert('✅ Porosia u krye me JonCoin. Shitësit morën njoftime në chat.');
      clearCart();
      setShowCartDrawer(false);
      await fetchProducts();
      const { balance: bal } = await getJonCoinBalance();
      setJonCoinBalance(Number(bal) || 0);
    } catch (error) {
      console.error('Error checkout cart:', error);
      alert(error.response?.data?.msg || 'Porosia dështoi');
    } finally {
      setCartChecking(false);
    }
  };

  const categories = [
    { value: 'all', label: 'Të gjitha', icon: '📦' },
    { value: 'gear', label: 'Pajisjet', icon: '⚽' },
    { value: 'tickets', label: 'Biletat', icon: '🎫' },
    { value: 'merchandise', label: 'Merchendiset', icon: '🛍️' },
  ];

  const getCategoryIcon = (cat) => {
    const found = categories.find(c => c.value === cat);
    return found ? found.icon : '📦';
  };

  const displayProducts = useMemo(
    () => filterBySearch(products, listSearch, (p) => [p.name, p.description, p.category]),
    [products, listSearch]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      {/* JonCoin Balance Header */}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1" title="JonCoin Balance">
            {jonCoinBalance !== null ? `${jonCoinBalance} JonCoin` : '...'}
            <span className="text-xs text-gray-500 ml-1">(1 JonCoin = 1€)</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="relative bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded font-semibold shadow"
            onClick={() => setShowCartDrawer(true)}
          >
            Shporta
            {totalPieces > 0 ? (
              <span className="absolute -top-2 -right-2 min-h-[20px] min-w-[20px] px-1 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center">
                {totalPieces > 99 ? '99+' : totalPieces}
              </span>
            ) : null}
          </button>
          <button
            className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded font-semibold shadow"
            onClick={() => navigate('/wallet')}
          >
            Shiko Wallet
          </button>
        </div>
      </div>
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Marketplace</h1>
          <p className="text-gray-600 dark:text-gray-400">Bli dhe shit pajisje sportive</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold shadow-md"
        >
          + Shto Produkt
        </button>
      </div>

      <ListSearchBar
        value={listSearch}
        onChange={setListSearch}
        placeholder="Kërko produkte sipas emrit ose përshkrimit…"
      />

      {/* Category Filter */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        {categories.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setCategory(cat.value)}
            className={`px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all ${
              category === cat.value
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {displayProducts.map((product) => {
          const isOwner = Number(product.sellerId) === Number(user?.id);
          const isSold = Number(product.stock || 0) <= 0 || product.status === 'sold';

          return (
            <div
              key={product.id}
              onClick={() => setSelectedProduct(product)}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-xl transition-all cursor-pointer border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              {/* Image */}
              <div className="relative aspect-square bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 flex items-center justify-center overflow-hidden">
                {product.imageUrl ? (
                  <img
                    src={productImageSrc(product.imageUrl)}
                    alt={product.name}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <span className="text-6xl">{getCategoryIcon(product.category)}</span>
                )}
                {isSold && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="bg-red-600 text-white px-4 py-2 rounded-full font-bold text-lg">
                      SHITUR
                    </span>
                  </div>
                )}
                {isOwner && !isSold && (
                  <div className="absolute top-2 right-2 bg-purple-600 text-white px-2 py-1 rounded-full text-xs font-semibold">
                    Your Item
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 line-clamp-2">
                  {product.name}
                </h3>

                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {product.price} JonCoin
                  </span>
                  <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs font-medium capitalize">
                    {product.condition}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-3">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center font-bold text-xs border-2 border-white dark:border-gray-800">
                    {product.Seller?.firstName?.[0]}
                  </div>
                  {product.Seller?.id ? (
                    <a
                      href={`/profile/${product.Seller.id}`}
                      className="hover:underline text-blue-600 dark:text-blue-400"
                      onClick={e => { e.stopPropagation(); }}
                    >
                      {product.Seller?.firstName} {product.Seller?.lastName}
                    </a>
                  ) : (
                    <span>{product.Seller?.firstName} {product.Seller?.lastName}</span>
                  )}
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
                  {product.description}
                </p>

                {isOwner && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(product);
                    }}
                    className="w-full py-2 mb-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-semibold transition-colors"
                  >
                    Ndrysho produktin
                  </button>
                )}

                {!isOwner && !isSold && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">Sasia</label>
                      <input
                        type="number"
                        min={1}
                        max={Math.max(1, Number(product.stock) || 1)}
                        value={orderQty[product.id] ?? 1}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          setOrderQty((prev) => ({ ...prev, [product.id]: e.target.value }))
                        }
                        className="w-20 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-gray-900 dark:text-white bg-white dark:bg-gray-800"
                      />
                      <span className="text-xs text-gray-500">max {product.stock ?? 0}</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => addToCart(product, e)}
                      className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      Shto në shportë
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {products.length === 0 && (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🛒</div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Nuk ka produkte
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {category === 'all' 
              ? 'Bëhu i pari që shet diçka!' 
              : `Nuk ka produkte në kategorinë "${categories.find(c => c.value === category)?.label}"`}
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold"
          >
            Shto Produktin e Parë
          </button>
        </div>
      )}

      {/* Create Product Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Shto Produkt të Ri</h2>
            
            <form onSubmit={createProduct} className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Foto e Produktit
                              </label>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={e => setImageFile(e.target.files[0])}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Emri i Produktit
                </label>
                <input
                  type="text"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nike Football Boots"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Përshkrimi
                </label>
                <textarea
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Përshkruaj produktin..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Çmimi (JonCoin)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newProduct.price}
                  onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="29.99"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Sasia në stok (copë)
                </label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={newProduct.stock}
                  onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="10"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Sa njësi janë në dispozicion për shitje.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Kategoria
                </label>
                <select
                  value={newProduct.category}
                  onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {categories.filter(c => c.value !== 'all').map(cat => (
                    <option key={cat.value} value={cat.value}>
                      {cat.icon} {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Gjendja
                </label>
                <select
                  value={newProduct.condition}
                  onChange={(e) => setNewProduct({ ...newProduct, condition: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="new">E Re</option>
                  <option value="like-new">Si e Re</option>
                  <option value="good">E Mirë</option>
                  <option value="fair">E Përdorur</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
                >
                  Anulo
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Shto Produktin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {showEditModal && editProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Ndrysho produktin</h2>
            <form onSubmit={saveProductEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Foto e re (opsionale)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setEditImageFile(e.target.files?.[0] || null)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Emri</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Përshkrimi</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Çmimi (JonCoin)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editForm.price}
                  onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Sasia në stok (copë)</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={editForm.stock}
                  onChange={(e) => setEditForm({ ...editForm, stock: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Kategoria</label>
                <select
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {categories.filter((c) => c.value !== 'all').map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.icon} {cat.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Gjendja</label>
                <select
                  value={editForm.condition}
                  onChange={(e) => setEditForm({ ...editForm, condition: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="new">E Re</option>
                  <option value="like-new">Si e Re</option>
                  <option value="good">E Mirë</option>
                  <option value="fair">E Përdorur</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditProduct(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium"
                >
                  Anulo
                </button>
                <button type="submit" className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium">
                  Ruaj
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product Details Modal */}
      {showCartDrawer && (
        <div
          className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/50"
          role="dialog"
          aria-label="Shporta"
          onClick={() => setShowCartDrawer(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-t-2xl max-h-[75vh] flex flex-col shadow-2xl border-t border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Shporta {totalPieces > 0 ? `(${totalPieces} copë)` : ''}
              </h3>
              <button
                type="button"
                className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 text-2xl leading-none px-2"
                onClick={() => setShowCartDrawer(false)}
                aria-label="Mbyll"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto p-4 flex-1 min-h-0">
              {items.length === 0 ? (
                <p className="text-center text-gray-600 dark:text-gray-400 py-8">Shporta është bosh.</p>
              ) : (
                <ul className="space-y-3">
                  {items.map((line) => {
                    const cap = Math.max(0, parseInt(String(line.maxStock ?? 0), 10) || 0);
                    const q = parseInt(String(line.quantity), 10) || 1;
                    return (
                      <li
                        key={line.productId}
                        className="flex gap-3 items-center border border-gray-200 dark:border-gray-600 rounded-lg p-3"
                      >
                        <div className="w-14 h-14 rounded-lg bg-gray-100 dark:bg-gray-700 overflow-hidden shrink-0">
                          {line.imageUrl ? (
                            <img
                              src={productImageSrc(line.imageUrl)}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="flex items-center justify-center h-full text-2xl">📦</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 dark:text-white truncate">{line.name}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {(Number(line.price) || 0).toFixed(2)} JonCoin × {q}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <button
                              type="button"
                              className="w-8 h-8 rounded border border-gray-300 dark:border-gray-600 text-lg leading-none"
                              onClick={() => setLineQuantity(line.productId, q - 1)}
                              disabled={q <= 1}
                            >
                              −
                            </button>
                            <span className="font-bold w-6 text-center">{q}</span>
                            <button
                              type="button"
                              className="w-8 h-8 rounded border border-gray-300 dark:border-gray-600 text-lg leading-none"
                              onClick={() => setLineQuantity(line.productId, q + 1)}
                              disabled={q >= cap}
                            >
                              +
                            </button>
                            <button
                              type="button"
                              className="ml-auto text-red-600 text-sm font-semibold"
                              onClick={() => removeItem(line.productId)}
                            >
                              Hiq
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
              <div className="flex justify-between text-gray-900 dark:text-white font-bold">
                <span>Total</span>
                <span>{subtotalJonCoin} JonCoin</span>
              </div>
              <button
                type="button"
                onClick={checkoutCart}
                disabled={cartChecking || items.length === 0}
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold disabled:opacity-50"
              >
                {cartChecking ? '…' : 'Paguaj me JonCoin'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {selectedProduct.name}
              </h2>
              <button
                onClick={() => setSelectedProduct(null)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            <div className="aspect-video bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 rounded-xl flex items-center justify-center mb-6">
              <span className="text-9xl">{getCategoryIcon(selectedProduct.category)}</span>
                {selectedProduct.imageUrl ? (
                  <img
                    src={productImageSrc(selectedProduct.imageUrl)}
                    alt={selectedProduct.name}
                    className="object-contain h-48 w-48"
                  />
                ) : (
                  <span className="text-9xl">{getCategoryIcon(selectedProduct.category)}</span>
                )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                  {selectedProduct.price} JonCoin
                </span>
                <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm font-medium capitalize">
                  {selectedProduct.condition}
                </span>
              </div>

              <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center font-bold text-lg">
                  {selectedProduct.Seller?.Profile?.profilePhoto ? (
                    <img
                      src={selectedProduct.Seller.Profile.profilePhoto}
                      alt={selectedProduct.Seller?.firstName}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    selectedProduct.Seller?.firstName?.[0]
                  )}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {selectedProduct.Seller?.firstName} {selectedProduct.Seller?.lastName}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Seller</p>
                </div>
              </div>

              {selectedProduct.description && (
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Përshkrimi</h3>
                  <p className="text-gray-700 dark:text-gray-300">{selectedProduct.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Kategoria</p>
                  <p className="font-medium text-gray-900 dark:text-white capitalize">
                    {getCategoryIcon(selectedProduct.category)} {selectedProduct.category}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Statusi</p>
                  <p className="font-medium text-gray-900 dark:text-white capitalize">
                    {selectedProduct.status}
                  </p>
                </div>
              </div>

              {Number(selectedProduct.sellerId) !== Number(user?.id) &&
                Number(selectedProduct.stock || 0) > 0 &&
                selectedProduct.status !== 'sold' && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600 dark:text-gray-400">Sasia</label>
                    <input
                      type="number"
                      min={1}
                      max={Math.max(1, Number(selectedProduct.stock) || 1)}
                      value={orderQty[selectedProduct.id] ?? 1}
                      onChange={(e) =>
                        setOrderQty((prev) => ({ ...prev, [selectedProduct.id]: e.target.value }))
                      }
                      className="w-24 border border-gray-300 dark:border-gray-600 rounded px-2 py-2 text-gray-900 dark:text-white bg-white dark:bg-gray-800"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => addToCart(selectedProduct)}
                    className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-lg"
                  >
                    Shto në shportë —{' '}
                    {Math.round(
                      (Number(selectedProduct.price) || 0) *
                        (parseInt(
                          String(
                            orderQty[selectedProduct.id] != null && orderQty[selectedProduct.id] !== ''
                              ? orderQty[selectedProduct.id]
                              : 1
                          ),
                          10
                        ) || 1) *
                        100
                    ) / 100}{' '}
                    JonCoin
                  </button>
                </div>
              )}

              {/* Pronari: ndrysho / fshi */}
              {Number(selectedProduct.sellerId) === Number(user?.id) && (
                <div className="space-y-2 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      openEditModal(selectedProduct);
                    }}
                    className="w-full py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-semibold text-lg"
                  >
                    Ndrysho produktin
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteProduct(selectedProduct.id)}
                    className="w-full py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold text-lg"
                  >
                    🗑️ Fshi Produktin
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
