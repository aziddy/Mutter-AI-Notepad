import React, { useEffect } from 'react';
import { useAppContext } from '../../contexts/AppContext';

const Toast: React.FC = () => {
  const { state, dispatch } = useAppContext();

  useEffect(() => {
    const timers: { [key: string]: NodeJS.Timeout } = {};

    state.toastMessages.forEach((toast) => {
      if (!timers[toast.id]) {
        timers[toast.id] = setTimeout(() => {
          dispatch({ type: 'REMOVE_TOAST', payload: toast.id });
        }, 3000);
      }
    });

    return () => {
      Object.values(timers).forEach(timer => clearTimeout(timer));
    };
  }, [state.toastMessages, dispatch]);

  const handleCloseToast = (id: string) => {
    dispatch({ type: 'REMOVE_TOAST', payload: id });
  };

  if (state.toastMessages.length === 0) {
    return null;
  }

  return (
    <>
      {state.toastMessages.map((toast, index) => (
        <div
          key={toast.id}
          className={`toast show ${toast.type === 'error' ? 'toast-error' : toast.type === 'info' ? 'toast-info' : 'toast-success'}`}
          style={{
            top: `${20 + (index * 80)}px`,
            background: toast.type === 'error' ? '#EF4444' : toast.type === 'info' ? '#3B82F6' : '#10B981'
          }}
        >
          <div className="toast-content">
            <span>{toast.message}</span>
            <button
              className="toast-close"
              onClick={() => handleCloseToast(toast.id)}
            >
              &times;
            </button>
          </div>
        </div>
      ))}
    </>
  );
};

export default Toast;