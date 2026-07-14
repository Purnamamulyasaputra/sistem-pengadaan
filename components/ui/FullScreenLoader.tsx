import { useState, useEffect } from "react";

/* ============================================================
   Sunburst mark — small brand motif used by the loader
   ============================================================ */
function Sunburst({ size = 52, spin = false }: { size?: number, spin?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className={spin ? "sun-spin" : ""}>
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <rect
          key={deg}
          x="18.5"
          y="1"
          width="3"
          height="9"
          rx="1.5"
          fill="#016e3f"
          transform={`rotate(${deg} 20 20)`}
          opacity={deg % 90 === 0 ? 1 : 0.55}
        />
      ))}
      <circle cx="20" cy="20" r="7" fill="#016e3f" />
    </svg>
  );
}

/* ============================================================
   FullScreenLoader — full-viewport "loading app data" state
   ============================================================ */
export function FullScreenLoader({ open, label = "Loading..." }: { open: boolean; label?: string }) {
  const [progress, setProgress] = useState(8);

  useEffect(() => {
    if (!open) {
      const reset = setTimeout(() => setProgress(8), 300);
      return () => clearTimeout(reset);
    }
    const t = setInterval(() => {
      setProgress((p) => (p >= 92 ? 92 : p + Math.random() * 10));
    }, 260);
    return () => clearInterval(t);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: "#fbfdfc", fontFamily: "'Albert Sans', sans-serif" }}
    >
      <style>{`
        @keyframes sunSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .sun-spin { animation: sunSpin 2.2s linear infinite; }
      `}</style>

      <Sunburst size={52} spin />
      <div className="mt-5 text-[16px] font-bold tracking-tight" style={{ fontFamily: "'Cabin', sans-serif", color: "#12201a" }}>
        sunrise daily
      </div>
      <div className="mt-1 mb-8 text-[12px]" style={{ color: "#8a9990" }}>
        Sistem Pengadaan &amp; Inventori Terpusat
      </div>

      <div className="h-1 w-48 overflow-hidden rounded-full" style={{ background: "#e6ece9" }}>
        <div
          className="h-full rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%`, background: "#016e3f" }}
        />
      </div>
      <div className="mt-3 text-[12px] font-medium tracking-wide" style={{ color: "#65786f" }}>
        {label}
      </div>
    </div>
  );
}
