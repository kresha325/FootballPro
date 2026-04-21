import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
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

export default function MarketplaceSimple() {
    const navigate = useNavigate();
    const [jonCoinBalance, setJonCoinBalance] = useState(null);
    const deleteProduct = async (productId) => {
      if (!window.confirm('A je i sigurt që do ta fshish këtë produkt?')) return;
      try {
        await API.delete(`/products/${productId}`);
        setSelectedProduct(null);
        fetchProducts();
      } catch (error) {
        alert('Nuk u fshi produkti!');
      }
    };
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
    const [imageFile, setImageFile] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [category, setCategory] = useState('all');
  const [checkingOut, setCheckingOut] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    price: '',
    category: 'gear',
    condition: 'new',
  });

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

  const buyWithJonCoin = async (productId) => {
    if (!window.confirm('Konfirmo blerjen me JonCoin nga wallet-i?')) return false;

    setCheckingOut(true);
    try {
      await API.post('/orders', {
        products: [{ productId, quantity: 1 }],
      });
      alert('✅ Blerja u krye me JonCoin.');
      await fetchProducts();
      const { balance: bal } = await getJonCoinBalance();
      setJonCoinBalance(Number(bal) || 0);
      return true;
    } catch (error) {
      console.error('Error purchasing with JonCoin:', error);
      alert(error.response?.data?.msg || 'Blerja dështoi');
      return false;
    } finally {
      setCheckingOut(false);
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
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1" title="JonCoin Balance">
            {jonCoinBalance !== null ? `${jonCoinBalance} JonCoin` : '...'}
            <span className="text-xs text-gray-500 ml-1">(1 JonCoin = 1€)</span>
          </span>
        </div>
        <button
          className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded font-semibold shadow"
          onClick={() => navigate('/wallet')}
        >
          Shiko Wallet
        </button>
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
        {products.map((product) => {
          const isOwner = product.sellerId === user?.id;
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
                    src={`${import.meta.env.VITE_API_URL.replace('/api','')}${product.imageUrl}`}
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

                {!isOwner && !isSold && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      buyWithJonCoin(product.id);
                    }}
                    disabled={checkingOut}
                    className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                  >
                    {checkingOut ? '…' : 'Bli me JonCoin'}
                  </button>
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

      {/* Product Details Modal */}
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
                    src={`${import.meta.env.VITE_API_URL.replace('/api','')}${selectedProduct.imageUrl}`}
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

              {selectedProduct.sellerId !== user?.id &&
                Number(selectedProduct.stock || 0) > 0 &&
                selectedProduct.status !== 'sold' && (
                <button
                  onClick={async () => {
                    const ok = await buyWithJonCoin(selectedProduct.id);
                    if (ok) setSelectedProduct(null);
                  }}
                  disabled={checkingOut}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-lg disabled:opacity-50"
                >
                  {checkingOut ? '…' : `🛒 Bli me JonCoin — ${selectedProduct.price}`}
                </button>
              )}

              {/* Butoni për fshirje vetëm për pronarin */}
              {selectedProduct.sellerId === user?.id && (
                <button
                  onClick={() => deleteProduct(selectedProduct.id)}
                  className="w-full py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold text-lg mt-2"
                >
                  🗑️ Fshi Produktin
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
