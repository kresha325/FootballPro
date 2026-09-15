import ParentVerificationForm from './ParentVerificationForm';

export default function ParentVerificationModal({ open, onClose }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="parent-verify-title"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-5 border border-gray-200 dark:border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <h2 id="parent-verify-title" className="text-lg font-bold text-gray-900 dark:text-white">
            Verifikimi i prindit
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xl leading-none"
            aria-label="Mbyll"
          >
            ×
          </button>
        </div>
        <ParentVerificationForm compact />
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Mbyll
        </button>
      </div>
    </div>
  );
}
