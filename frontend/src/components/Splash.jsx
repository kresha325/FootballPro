import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Splash() {
  const { user } = useAuth()
  const navigate = useNavigate()
  // No auto-dismiss; user will tap "Get Started" to continue

  function handleGetStarted() {
    navigate(user ? '/feed' : '/login')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="max-w-md w-full text-center">
        <img
          src="/splash-logo.jpeg"
          alt="X Talenti"
          className="mx-auto w-64 h-64 md:w-80 md:h-80 object-contain mb-6"
        />

        <p className="text-lg mb-8 text-slate-600">
          Platforma për lojtarë, klube dhe skautim — ide, features dhe bashkëpunim.
        </p>

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={handleGetStarted}
            className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold px-6 py-2 rounded shadow transition-colors"
          >
            Get Started
          </button>

          {/* Optional: a subtle login link for users who want to sign in directly */}
          <button
            onClick={() => navigate(user ? '/feed' : '/login')}
            className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded border border-slate-900 transition-colors"
          >
            Log In
          </button>
        </div>
      </div>
    </div>
  )
}
