import React, { createContext, useContext, useState, ReactNode } from 'react';

type ModalOptions = {
  title: string;
  message: string;
  type: 'confirm' | 'alert';
  onConfirm?: () => void;
};

interface ModalContextType {
  confirm: (options: Omit<ModalOptions, 'type'>) => void;
  alert: (options: Omit<ModalOptions, 'type' | 'onConfirm'>) => void;
}

const ModalContext = createContext<ModalContextType | null>(null);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ModalOptions | null>(null);

  const confirm = (opts: Omit<ModalOptions, 'type'>) => {
    setOptions({ ...opts, type: 'confirm' });
  };

  const alert = (opts: Omit<ModalOptions, 'type' | 'onConfirm'>) => {
    setOptions({ ...opts, type: 'alert' });
  };

  return (
    <ModalContext.Provider value={{ confirm, alert }}>
      {children}
      {options && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <h3 className="text-xl font-bold mb-2">{options.title}</h3>
            <p className="text-gray-600 mb-6">{options.message}</p>
            <div className="flex justify-end gap-3">
              {options.type === 'confirm' && (
                <button 
                  onClick={() => setOptions(null)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl font-medium transition-colors"
                >
                  취소
                </button>
              )}
              <button 
                onClick={() => {
                  if (options.type === 'confirm' && options.onConfirm) {
                    options.onConfirm();
                  }
                  setOptions(null);
                }}
                className={`px-4 py-2 text-white rounded-xl font-medium transition-colors ${
                  options.type === 'confirm' ? 'bg-red-500 hover:bg-red-600' : 'bg-brand-500 hover:bg-brand-600'
                }`}
              >
                {options.type === 'confirm' ? '확인' : '확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModal must be used within ModalProvider');
  return ctx;
}
