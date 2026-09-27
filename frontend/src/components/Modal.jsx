import React, { useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

const Modal = ({ isOpen, onClose, children, title = 'Dialog' }) => {
  if (!isOpen) return null;

  // Keep the established controlled open/close API while supporting keyboard dismissal.
  // Hooks must run before the conditional return.
  return <ModalContent onClose={onClose} title={title}>{children}</ModalContent>;
};

function ModalContent({ onClose, title, children }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
      <div role="dialog" aria-modal="true" aria-label={title} className="relative max-h-[min(90dvh,48rem)] w-full min-w-[min(18rem,100%)] max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[var(--xt-color-surface)] p-5 text-[var(--xt-color-text)] shadow-[var(--xt-shadow-popover)] sm:p-7">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-lg text-[var(--xt-color-text-muted)] transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Close dialog"
        >
          <XMarkIcon className="h-5 w-5" aria-hidden="true" />
        </button>
        {children}
      </div>
    </div>
  );
}

export default Modal;
