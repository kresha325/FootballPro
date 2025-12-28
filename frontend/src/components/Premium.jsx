import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { subscriptionsAPI } from '../services/api';
import { CheckIcon, XMarkIcon, SparklesIcon, StarIcon } from '@heroicons/react/24/solid';

function Premium() {
  const { user } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState('monthly');
  const [loading, setLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const plans = {
    monthly: {
      name: 'Monthly',
      price: 9.99,
      period: '/month',
      features: [
        'Unlimited profile views',
        'Advanced analytics dashboard',
        'Priority scout recommendations',
        'Video highlights upload (up to 10)',
        'Premium badge on profile',
        'Remove ads',
        'Priority support',
      ],
    },
    yearly: {
      name: 'Yearly',
      price: 99.99,
      originalPrice: 119.88,
      period: '/year',
      savings: 'Save 17%',
      features: [
        'Everything in Monthly',
        '2 months free',
        'Exclusive tournaments access',
        'Advanced gamification features',
        'Custom profile themes',
        'Early access to new features',
        'Personal career advisor',
      ],
    },
  };

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // In real implementation, integrate with Stripe or payment provider
      alert(`Subscribed to ${plans[selectedPlan].name} plan for $${plans[selectedPlan].price}`);
      setShowPaymentModal(false);
    } catch (error) {
      console.error('Subscription error:', error);
      alert('Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 rounded-lg p-8 md:p-12 text-white mb-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <StarIcon className="h-12 w-12 text-yellow-300" />
            <h1 className="text-4xl md:text-5xl font-bold">Go Premium</h1>
          </div>
          <p className="text-xl text-white/90 max-w-2xl">
            Unlock exclusive features and boost your football career to the next level.
            Get noticed by scouts worldwide!
          </p>
        </div>
        <div className="absolute top-0 right-0 opacity-10 text-[200px]">⚽</div>
      </div>

      {/* Current Status */}
      {user?.isPremium ? (
        <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-500 rounded-lg p-6 mb-8">
          <div className="flex items-center gap-3">
            <CheckIcon className="h-8 w-8 text-green-600" />
            <div>
              <h2 className="text-xl font-bold text-green-900 dark:text-green-400">
                You're a Premium Member!
              </h2>
              <p className="text-green-700 dark:text-green-300">
                Your subscription is active and renews on {new Date(user.premiumExpiresAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500 rounded-lg p-6 mb-8">
          <div className="flex items-center gap-3">
            <SparklesIcon className="h-8 w-8 text-blue-600" />
            <div>
              <h2 className="text-xl font-bold text-blue-900 dark:text-blue-400">
                Free Account
              </h2>
              <p className="text-blue-700 dark:text-blue-300">
                Upgrade to Premium to unlock all features and stand out!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Plan Selector */}
      <div className="flex justify-center gap-4 mb-8">
        <button
          onClick={() => setSelectedPlan('monthly')}
          className={`px-8 py-3 rounded-lg font-medium transition ${
            selectedPlan === 'monthly'
              ? 'bg-purple-600 text-white shadow-lg scale-105'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => setSelectedPlan('yearly')}
          className={`px-8 py-3 rounded-lg font-medium transition relative ${
            selectedPlan === 'yearly'
              ? 'bg-purple-600 text-white shadow-lg scale-105'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          Yearly
          <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-bold">
            Best Value
          </span>
        </button>
      </div>

      {/* Pricing Cards */}
      <div className="grid md:grid-cols-2 gap-8 mb-12">
        {/* Free Plan */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 border border-gray-200 dark:border-gray-700">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Free</h3>
          <div className="text-4xl font-bold text-gray-900 dark:text-white mb-6">
            $0
            <span className="text-lg font-normal text-gray-500">/month</span>
          </div>
          <ul className="space-y-3 mb-8">
            <li className="flex items-start gap-2">
              <CheckIcon className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
              <span className="text-gray-700 dark:text-gray-300">Basic profile</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckIcon className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
              <span className="text-gray-700 dark:text-gray-300">Post highlights</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckIcon className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
              <span className="text-gray-700 dark:text-gray-300">Join tournaments</span>
            </li>
            <li className="flex items-start gap-2">
              <XMarkIcon className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <span className="text-gray-500 dark:text-gray-400">Advanced analytics</span>
            </li>
            <li className="flex items-start gap-2">
              <XMarkIcon className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <span className="text-gray-500 dark:text-gray-400">Scout recommendations</span>
            </li>
            <li className="flex items-start gap-2">
              <XMarkIcon className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <span className="text-gray-500 dark:text-gray-400">Premium badge</span>
            </li>
          </ul>
          <button
            disabled
            className="w-full py-3 rounded-lg font-medium bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
          >
            Current Plan
          </button>
        </div>

        {/* Premium Plan */}
        <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg shadow-xl p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-yellow-400 text-purple-900 px-4 py-1 text-sm font-bold rounded-bl-lg">
            RECOMMENDED
          </div>
          <h3 className="text-2xl font-bold mb-2">Premium</h3>
          <div className="text-4xl font-bold mb-2">
            ${plans[selectedPlan].price}
            <span className="text-lg font-normal opacity-90">{plans[selectedPlan].period}</span>
          </div>
          {plans[selectedPlan].originalPrice && (
            <div className="flex items-center gap-2 mb-4">
              <span className="line-through text-white/60">${plans[selectedPlan].originalPrice}</span>
              <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                {plans[selectedPlan].savings}
              </span>
            </div>
          )}
          <ul className="space-y-3 mb-8">
            {plans[selectedPlan].features.map((feature, index) => (
              <li key={index} className="flex items-start gap-2">
                <CheckIcon className="h-5 w-5 text-yellow-300 flex-shrink-0 mt-0.5" />
                <span className="text-white">{feature}</span>
              </li>
            ))}
          </ul>
          <button
            onClick={() => setShowPaymentModal(true)}
            disabled={user?.isPremium}
            className="w-full py-3 rounded-lg font-medium bg-white text-purple-600 hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {user?.isPremium ? 'Already Premium' : 'Upgrade Now'}
          </button>
        </div>
      </div>

      {/* Benefits Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 mb-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6 text-center">
          Why Go Premium?
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Get Noticed</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Premium badge makes your profile stand out to scouts and clubs
            </p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Track Progress</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Advanced analytics show your growth and engagement metrics
            </p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Priority Access</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Get early access to new features and exclusive tournaments
            </p>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6 text-center">
          Frequently Asked Questions
        </h2>
        <div className="space-y-4 max-w-3xl mx-auto">
          <details className="bg-white dark:bg-gray-800 rounded-lg p-4">
            <summary className="font-medium text-gray-900 dark:text-white cursor-pointer">
              Can I cancel anytime?
            </summary>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Yes! You can cancel your subscription at any time. You'll continue to have access until the end of your billing period.
            </p>
          </details>
          <details className="bg-white dark:bg-gray-800 rounded-lg p-4">
            <summary className="font-medium text-gray-900 dark:text-white cursor-pointer">
              What payment methods do you accept?
            </summary>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              We accept all major credit cards, PayPal, and bank transfers.
            </p>
          </details>
          <details className="bg-white dark:bg-gray-800 rounded-lg p-4">
            <summary className="font-medium text-gray-900 dark:text-white cursor-pointer">
              Is there a free trial?
            </summary>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Yes! New users get a 7-day free trial of Premium to try all features risk-free.
            </p>
          </details>
          <details className="bg-white dark:bg-gray-800 rounded-lg p-4">
            <summary className="font-medium text-gray-900 dark:text-white cursor-pointer">
              Will scouts really see my profile?
            </summary>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Premium profiles are boosted in scout recommendations and appear higher in search results, significantly increasing your visibility.
            </p>
          </details>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                Complete Payment
              </h3>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-6 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-700 dark:text-gray-300">Plan:</span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {plans[selectedPlan].name}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700 dark:text-gray-300">Total:</span>
                <span className="text-2xl font-bold text-purple-600">
                  ${plans[selectedPlan].price}
                </span>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <input
                type="text"
                placeholder="Card Number"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="MM/YY"
                  className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <input
                  type="text"
                  placeholder="CVV"
                  className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <button
              onClick={handleSubscribe}
              disabled={loading}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Subscribe Now'}
            </button>

            <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-4">
              🔒 Secure payment powered by Stripe
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default Premium;
