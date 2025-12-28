import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { marketplaceAPI, ordersAPI } from '../services/api';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

//const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

const Marketplace = () => {
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState({ title: '', description: '', price: '', category: '' });
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  // Mock data for demonstration
  useEffect(() => {
    setItems([
      { id: 1, title: 'Football Boots', description: 'Used but in good condition', price: 50, seller: 'John Doe', category: 'Equipment' },
      { id: 2, title: 'Team Jersey', description: 'Official club jersey', price: 30, seller: 'Jane Smith', category: 'Apparel' },
    ]);
  }, []);

  const handleCreateItem = (e) => {
    e.preventDefault();
    if (!newItem.title || !newItem.price) return;

    const item = {
      id: Date.now(),
      ...newItem,
      seller: user.username,
      price: parseFloat(newItem.price),
    };
    setItems([item, ...items]);
    setNewItem({ title: '', description: '', price: '', category: '' });
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Marketplace</h1>

      {/* Create Item Form */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Sell an Item</h2>
        <form onSubmit={handleCreateItem} className="space-y-4">
          <input
            type="text"
            placeholder="Item Title"
            value={newItem.title}
            onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <textarea
            placeholder="Description"
            value={newItem.description}
            onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows="3"
          />
          <div className="flex gap-4">
            <input
              type="number"
              placeholder="Price (JonCoins)"
              value={newItem.price}
              onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
              className="flex-1 p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="0"
              step="0.01"
              required
            />
            <select
              value={newItem.category}
              onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
              className="flex-1 p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Category</option>
              <option value="Equipment">Equipment</option>
              <option value="Apparel">Apparel</option>
              <option value="Accessories">Accessories</option>
              <option value="Tickets">Tickets</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
          >
            List Item
          </button>
        </form>
      </div>

      {/* Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((item) => (
          <div key={item.id} className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="h-48 bg-gray-200 flex items-center justify-center">
              <span className="text-gray-500">No Image</span>
            </div>
            <div className="p-4">
              <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
              <p className="text-gray-600 text-sm mb-2">{item.description}</p>
              <p className="text-sm text-gray-500 mb-2">Category: {item.category}</p>
              <p className="text-sm text-gray-500 mb-3">Seller: {item.seller}</p>
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold text-green-600">{item.price} JonCoins</span>
                <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm">
                  Buy Now
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <div className="text-center text-gray-500 py-12">
          No items listed yet. Be the first to sell something!
        </div>
      )}
    </div>
  );
};

export default Marketplace;