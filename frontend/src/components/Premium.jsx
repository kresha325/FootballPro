import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CheckIcon, XMarkIcon, SparklesIcon, StarIcon } from '@heroicons/react/24/solid';
import api from '../services/api';

function Premium() {
  const { user, refreshUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedPlan, setSelectedPlan] = useState('monthly');
  const [loading, setLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [paymentsLive, setPaymentsLive] = useState(false);

  useEffect(() => {
    api.get('/config/public').then((res) => {
      setPaymentsLive(!!res.data?.paymentsEnabled && res.data?.premiumMode === 'stripe');
    }).catch(() => setPaymentsLive(false));
  }, []);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    const success = searchParams.get('success');
    if (!sessionId || success !== '1') return;

    (async () => {
      try {
        const { data } = await api.get(`/premium/verify-session/${sessionId}`);
        if (data.success) {
          await refreshUser?.();
          alert('Premium u aktivizua me sukses!');
        }
      } catch (e) {
        console.error('Premium verify:', e);
      } finally {
        setSearchParams({}, { replace: true });
      }
    })();
  }, [searchParams, setSearchParams, refreshUser]);

  const plans = {
    monthly: {
      name: 'Monthly',
      price: 11.99,
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
      price: 119.9,
      originalPrice: 143.88,
      period: '/year',
      savings: '2 months free',
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
    setCheckoutError('');
    try {
      const { data } = await api.post('/premium/checkout', { plan: selectedPlan });

      if (data.mode === 'demo' && data.success) {
        await refreshUser?.();
        alert(data.message || 'Premium activated (demo mode).');
        setShowPaymentModal(false);
        return;
      }

      if (data.mode === 'stripe' && data.url) {
        window.location.href = data.url;
        return;
      }

      setCheckoutError('Could not start checkout.');
    } catch (error) {
      console.error('Subscription error:', error);
      setCheckoutError(error.response?.data?.msg || 'Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-7xl space-y-6 bg-[var(--xt-color-canvas)] px-4 py-5 pb-24 text-[var(--xt-color-text)] sm:px-6 sm:py-8">
      {/* Hero Section */}
      <header className="xt-card relative overflow-hidden p-5 sm:p-8">
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-[var(--xt-color-gold)]/10 to-transparent"></div>
        <div className="relative z-10">
          <div className="mb-4 flex items-center gap-3">
            <StarIcon className="h-9 w-9 text-[var(--xt-color-gold-bright)]" />
            <div><p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--xt-color-gold-bright)]">X TALENTI · Membership</p><h1 className="mt-1 text-3xl font-black text-white sm:text-4xl">Premium</h1></div>
          </div>
          <p className="max-w-2xl text-base text-[var(--xt-color-text-muted)] sm:text-lg">
            Unlock exclusive features and boost your football career to the next level.
            Get noticed by scouts worldwide!
          </p>
        </div>
        <SparklesIcon className="pointer-events-none absolute bottom-4 right-5 h-20 w-20 text-[var(--xt-color-gold)]/10" aria-hidden="true" />
      </header>

      {!paymentsLive ? (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-semibold">Pagesat nuk janë aktive</p>
          <p className="text-sm mt-1">
            Premium aktivizohet në mënyrë demo (pa kartë). Marketplace përdor XCoin. Stripe aktivizohet vetëm kur
            PAYMENTS_ENABLED=true në server.
          </p>
        </div>
      ) : null}

      {/* Current Status */}
      {user?.premium ? (
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
        <div className="bg-[var(--xt-color-gold)]/10 border-2 border-blue-500 rounded-lg p-6 mb-8">
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
          className={`btn min-h-11 px-6 font-medium transition ${
            selectedPlan === 'monthly'
              ? 'bg-[var(--xt-color-gold)] text-slate-950 shadow-lg'
              : 'xt-card text-[var(--xt-color-text-muted)] hover:border-[var(--xt-color-gold)]/50'
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => setSelectedPlan('yearly')}
          className={`btn min-h-11 px-6 font-medium transition relative ${
            selectedPlan === 'yearly'
              ? 'bg-[var(--xt-color-gold)] text-slate-950 shadow-lg'
              : 'xt-card text-[var(--xt-color-text-muted)] hover:border-[var(--xt-color-gold)]/50'
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
        <div className="xt-card p-5 sm:p-8">
          <h3 className="text-2xl font-bold text-[var(--xt-color-text)] mb-2">Free</h3>
          <div className="text-4xl font-bold text-[var(--xt-color-text)] mb-6">
            €0
            <span className="text-lg font-normal text-gray-500"> / 30 days</span>
          </div>
          <ul className="space-y-3 mb-8">
            <li className="flex items-start gap-2">
              <CheckIcon className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
              <span className="text-[var(--xt-color-text-muted)]">Basic profile</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckIcon className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
              <span className="text-[var(--xt-color-text-muted)]">Post highlights</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckIcon className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
              <span className="text-[var(--xt-color-text-muted)]">Join tournaments</span>
            </li>
            <li className="flex items-start gap-2">
              <XMarkIcon className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <span className="text-[var(--xt-color-text-subtle)]">Advanced analytics</span>
            </li>
            <li className="flex items-start gap-2">
              <XMarkIcon className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <span className="text-[var(--xt-color-text-subtle)]">Scout recommendations</span>
            </li>
            <li className="flex items-start gap-2">
              <XMarkIcon className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <span className="text-[var(--xt-color-text-subtle)]">Premium badge</span>
            </li>
          </ul>
          <button
            disabled
            className="w-full py-3 rounded-lg font-medium bg-gray-200 dark:bg-gray-700 text-[var(--xt-color-text-subtle)] cursor-not-allowed"
          >
            Current Plan
          </button>
        </div>

        {/* Premium Plan */}
        <div className="xt-card relative overflow-hidden border-[var(--xt-color-gold)]/35 bg-[var(--xt-color-surface-raised)] p-5 text-white shadow-xl sm:p-8">
          <div className="absolute right-0 top-0 rounded-bl-lg bg-[var(--xt-color-gold)] px-4 py-1 text-sm font-bold text-slate-950">
            RECOMMENDED
          </div>
          <h3 className="text-2xl font-bold mb-2">Premium</h3>
          <div className="text-4xl font-bold mb-2">
            €{plans[selectedPlan].price}
            <span className="text-lg font-normal opacity-90">{plans[selectedPlan].period}</span>
          </div>
          {plans[selectedPlan].originalPrice && (
            <div className="flex items-center gap-2 mb-4">
              <span className="line-through text-white/60">€{plans[selectedPlan].originalPrice}</span>
              <span className="xt-badge xt-badge-gold">
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
            disabled={user?.premium}
            className="btn btn-primary min-h-12 w-full disabled:cursor-not-allowed"
          >
            {user?.premium ? 'Already Premium' : 'Upgrade Now'}
          </button>
        </div>
      </div>

      {/* Benefits Section */}
      <div className="xt-card p-5 sm:p-8">
        <h2 className="text-3xl font-bold text-[var(--xt-color-text)] mb-6 text-center">
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
            <h3 className="text-xl font-bold text-[var(--xt-color-text)] mb-2">Get Noticed</h3>
            <p className="text-[var(--xt-color-text-muted)]">
              Premium badge makes your profile stand out to scouts and clubs
            </p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-[var(--xt-color-text)] mb-2">Track Progress</h3>
            <p className="text-[var(--xt-color-text-muted)]">
              Advanced analytics show your growth and engagement metrics
            </p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-[var(--xt-color-text)] mb-2">Priority Access</h3>
            <p className="text-[var(--xt-color-text-muted)]">
              Get early access to new features and exclusive tournaments
            </p>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="bg-[var(--xt-color-canvas)] rounded-lg p-8">
        <h2 className="text-3xl font-bold text-[var(--xt-color-text)] mb-6 text-center">
          Frequently Asked Questions
        </h2>
        <div className="space-y-4 max-w-3xl mx-auto">
          <details className="bg-[var(--xt-color-surface)] rounded-lg p-4">
            <summary className="font-medium text-[var(--xt-color-text)] cursor-pointer">
              Can I cancel anytime?
            </summary>
            <p className="mt-2 text-[var(--xt-color-text-muted)]">
              Yes! You can cancel your subscription at any time. You'll continue to have access until the end of your billing period.
            </p>
          </details>
          <details className="bg-[var(--xt-color-surface)] rounded-lg p-4">
            <summary className="font-medium text-[var(--xt-color-text)] cursor-pointer">
              What payment methods do you accept?
            </summary>
            <p className="mt-2 text-[var(--xt-color-text-muted)]">
              We accept all major credit cards, PayPal, and bank transfers.
            </p>
          </details>
          <details className="bg-[var(--xt-color-surface)] rounded-lg p-4">
            <summary className="font-medium text-[var(--xt-color-text)] cursor-pointer">
              Is there a free trial?
            </summary>
            <p className="mt-2 text-[var(--xt-color-text-muted)]">
              Yes! New users get 30 days free to try the platform, then can upgrade to Basic (€5.99/mo) or Pro (€11.99/mo).
            </p>
          </details>
          <details className="bg-[var(--xt-color-surface)] rounded-lg p-4">
            <summary className="font-medium text-[var(--xt-color-text)] cursor-pointer">
              Will scouts really see my profile?
            </summary>
            <p className="mt-2 text-[var(--xt-color-text-muted)]">
              Premium profiles are boosted in scout recommendations and appear higher in search results, significantly increasing your visibility.
            </p>
          </details>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--xt-color-surface)] rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-[var(--xt-color-text)]">
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
                <span className="text-[var(--xt-color-text-muted)]">Plan:</span>
                <span className="font-bold text-[var(--xt-color-text)]">
                  {plans[selectedPlan].name}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--xt-color-text-muted)]">Total:</span>
                <span className="text-2xl font-bold text-purple-600">
                  €{plans[selectedPlan].price}
                </span>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <input
                type="text"
                placeholder="Card Number"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-[var(--xt-color-text)]"
              />
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="MM/YY"
                  className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-[var(--xt-color-text)]"
                />
                <input
                  type="text"
                  placeholder="CVV"
                  className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-[var(--xt-color-text)]"
                />
              </div>
            </div>

            {checkoutError ? (
              <p className="text-sm text-red-600 dark:text-red-400 mb-3">{checkoutError}</p>
            ) : null}

            <button
              onClick={handleSubscribe}
              disabled={loading}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Subscribe Now'}
            </button>

            <p className="text-xs text-[var(--xt-color-text-subtle)] text-center mt-4">
              🔒 Secure payment powered by Stripe
            </p>
          </div>
        </div>
      )}
    </main>
  );
}

export default Premium;
