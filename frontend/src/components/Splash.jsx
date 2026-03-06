import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Splash() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [seconds, setSeconds] = useState(5)

  useEffect(() => {
    if (seconds <= 0) {
      navigate(user ? '/feed' : '/login')
      return
    }
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [seconds, user, navigate])

  function handleGetStarted() {
    navigate(user ? '/feed' : '/login')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-600 to-blue-700 text-white px-4">
      <div className="max-w-3xl w-full text-center">
        <div className="mb-6">
          <div className="mx-auto w-24 h-24 rounded-full bg-white/20 flex items-center justify-center text-3xl font-bold">FP</div>
        </div>

        <h1 className="text-4xl font-extrabold mb-2">FootballPro</h1>
        <p className="text-lg mb-6 opacity-90">Platforma për lojtarë, klube dhe skautim — ide, features dhe bashkëpunim.</p>

        <div className="bg-white/10 rounded-lg p-6 mb-6 text-left">
          <h3 className="font-semibold mb-2">Qëllimi</h3>
          <p className="text-sm mb-3">Të lidhim talentet me klubet dhe t'i ndihmojmë trajnerët të gjejnë lojtarët e duhur.</p>
          <h3 className="font-semibold mb-2">Features kryesore</h3>
          <ul className="text-sm list-disc list-inside space-y-1">
            <li>Feed me përmbajtje & video</li>
            <li>Profil lojtarësh dhe skautim</li>
            <li>Live streams & komunikim</li>
            <li>Gamification dhe pagesa</li>
          </ul>
        </div>

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={handleGetStarted}
            className="bg-white text-blue-700 font-semibold px-6 py-2 rounded shadow"
          >
            Get Started
          </button>

          <button
            onClick={() => setSeconds(0)}
            className="bg-white/20 text-white px-4 py-2 rounded border border-white/30"
          >
            Skip ({seconds}s)
          </button>
        </div>
      </div>
    </div>
  )
}
