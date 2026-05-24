import { Link } from 'react-router-dom';

export default function ParentVerified() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-teal-50 px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="text-5xl mb-4">✓</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Faleminderit!</h1>
        <p className="text-gray-600 mb-6">
          Konfirmimi i prindit u regjistrua. Llogaria e fëmijës mund të përdorë FootballPro sipas rregullave të
          platformës.
        </p>
        <Link
          to="/login"
          className="inline-block bg-teal-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-teal-800"
        >
          Hap FootballPro
        </Link>
      </div>
    </div>
  );
}
