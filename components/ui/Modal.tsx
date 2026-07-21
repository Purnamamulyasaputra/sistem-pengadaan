import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: string | number;
  footer?: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children, maxWidth = 600, footer }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth }}>
        {title && (
          <div className="modal-header">
            <h3 style={{ margin: 0, fontSize: 'inherit' }}>{title}</h3>
          </div>
        )}
        <div className="modal-body">
          {children}
        </div>
        {footer && (
          <div className="modal-actions" style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', background: '#f8fafc', display: 'flex', gap: 8, justifyContent: 'flex-end', borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
