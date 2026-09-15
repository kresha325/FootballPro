import { useNavigate } from 'react-router-dom';
import ParentVerificationForm from './ParentVerificationForm';

export default function ParentVerification() {
  const navigate = useNavigate();

  return (
    <div className="max-w-lg mx-auto mt-12 px-4">
      <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">Verifikimi i prindit</h2>
      <ParentVerificationForm
        onDone={(ok, data) => {
          if (ok && data?.emailSent) {
            setTimeout(() => navigate('/profile'), 4000);
          }
        }}
      />
      <p className="mt-4 text-xs text-gray-500">
        Mund ta hapësh edhe nga profili (badge <strong>Prindi</strong>) ose nga Settings.
      </p>
    </div>
  );
}
