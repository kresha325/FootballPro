import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { verificationAPI } from '../services/api';

const ParentVerification = () => {
  const [parentEmail, setParentEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!parentEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail)) {
      setError('Please enter a valid parent email');
      return;
    }
    setLoading(true);
    try {
      const res = await verificationAPI.parentRequest({ parentEmail });
      if (res.data && res.data.success) {
        navigate('/profile');
      } else {
        setError('Failed to send verification email');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Server error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12">
      <h2 className="text-2xl font-bold mb-4">Parent Verification</h2>
      <p className="mb-4">Enter your parent's email to send a verification link.</p>
      {error && <div className="text-red-600 mb-2">{error}</div>}
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Parent email"
          value={parentEmail}
          onChange={(e) => setParentEmail(e.target.value)}
          className="w-full px-3 py-2 border rounded mb-3"
        />
        <button className="bg-blue-600 text-white px-4 py-2 rounded" disabled={loading}>
          {loading ? 'Sending...' : 'Send verification email'}
        </button>
      </form>
    </div>
  );
};

export default ParentVerification;
