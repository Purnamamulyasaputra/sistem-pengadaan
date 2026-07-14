import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: string | number;
}

export function Modal({ isOpen, onClose, title, children, maxWidth = 600 }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth }}>
        {title && <h4 style={{ marginBottom: 16 }}>{title}</h4>}
        {children}
      </div>
    </div>
  );
}
