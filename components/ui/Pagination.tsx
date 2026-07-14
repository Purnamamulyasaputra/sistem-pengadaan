'use client';
import React from 'react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, totalItems, itemsPerPage, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="pagination">
      <span className="info">
        Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} entries
      </span>
      <div className="page-btns">
        <button className="page-btn" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>‹</button>
        {Array.from({ length: totalPages }).map((_, i) => {
          const p = i + 1;
          if (p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)) {
            return (
              <button key={p} className={`page-btn ${p === currentPage ? 'active' : ''}`} onClick={() => onPageChange(p)}>
                {p}
              </button>
            );
          }
          if (p === currentPage - 2 || p === currentPage + 2) {
            return <span key={p} className="muted" style={{ padding: '0 4px' }}>…</span>;
          }
          return null;
        })}
        <button className="page-btn" disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)}>›</button>
      </div>
    </div>
  );
}
