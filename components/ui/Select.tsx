import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';

interface SelectOption {
  value: string | number;
  label: string;
  isGroup?: boolean;
  disabled?: boolean;
}

interface SelectProps {
  value: string | number;
  onChange: (value: any) => void;
  options: SelectOption[];
  style?: React.CSSProperties;
  className?: string;
  placeholder?: string;
  searchable?: boolean;
  inputStyle?: React.CSSProperties;
  optionStyle?: React.CSSProperties;
  disabled?: boolean;
}

export function Select({ value, onChange, options, style, className = '', placeholder, searchable = false, inputStyle, optionStyle, disabled = false }: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm(''); // Reset search when closed
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(o => String(o.value) === String(value));
  
  const filteredOptions = searchable && searchTerm.trim() !== ''
    ? options.filter(o => o.label.toLowerCase().includes(searchTerm.toLowerCase()))
    : options;

  return (
    <div ref={wrapperRef} style={{ position: 'relative', ...style }} className={className}>
      <div
        className="input"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          userSelect: 'none',
          background: disabled ? '#f8fafc' : '#fff',
          width: '100%',
          opacity: disabled ? 0.7 : 1,
          ...inputStyle
        }}
        onClick={() => {
          if (disabled) return;
          setIsOpen(!isOpen);
          if (!isOpen && searchable) setSearchTerm('');
        }}
      >
        <span style={{ color: selectedOption ? 'inherit' : '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {selectedOption ? selectedOption.label : placeholder || 'Select...'}
        </span>
        <ChevronDown size={14} style={{ color: '#64748b', marginLeft: 8, flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: 4,
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 6,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          zIndex: 50,
          maxHeight: 280,
          display: 'flex',
          flexDirection: 'column'
        }}>
          {searchable && (
            <div style={{ padding: '8px', borderBottom: '1px solid #f1f5f9', position: 'sticky', top: 0, background: '#fff', zIndex: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Search size={14} style={{ color: '#94a3b8', marginLeft: 4 }} />
              <input 
                type="text" 
                autoFocus
                placeholder="Ketik untuk mencari..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: '100%', border: 'none', outline: 'none', fontSize: 13, background: 'transparent' }}
              />
            </div>
          )}
          
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filteredOptions.map((opt, i) => (
              opt.isGroup ? (
                <div key={`group-${i}`} style={{ padding: '8px 10px', fontSize: 11, fontWeight: 700, color: '#94a3b8', background: '#f8fafc', textTransform: 'uppercase' }}>
                  {opt.label}
                </div>
              ) : (
                <div
                  key={opt.value}
                  onClick={() => {
                    if (opt.disabled) return;
                    onChange(opt.value);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                  style={{
                    padding: '6px 10px',
                    cursor: opt.disabled ? 'not-allowed' : 'pointer',
                    fontSize: 12,
                    background: String(opt.value) === String(value) ? '#f1f5f9' : '#fff',
                    color: opt.disabled ? '#94a3b8' : '#334155',
                    transition: 'background 0.1s',
                    ...optionStyle
                  }}
                  onMouseEnter={(e) => {
                    if (!opt.disabled && String(opt.value) !== String(value)) {
                      e.currentTarget.style.background = '#f8fafc';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!opt.disabled && String(opt.value) !== String(value)) {
                      e.currentTarget.style.background = '#fff';
                    }
                  }}
                >
                  {opt.label}
                </div>
              )
            ))}
            {filteredOptions.length === 0 && (
              <div style={{ padding: '12px', fontSize: 13, color: '#94a3b8', textAlign: 'center' }}>Tidak ada pilihan</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
