'use dom';

// A5 check: does this phone's build run Expo DOM components? If you see a white egg with a yolk
// gently bobbing, SVG + CSS animations work and the prototype's art can be reused as-is.
import type { DOMProps } from 'expo/dom';

export default function EggCheck({ label }: { label: string; dom?: DOMProps }) {
  return (
    <div style={{ display: 'grid', placeItems: 'center', gap: 16, padding: 24, fontFamily: 'Lexend, Avenir Next, sans-serif' }}>
      <style>{`
        @keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        .egg { animation: bob 1.6s cubic-bezier(.65, 0, .35, 1) infinite; }
      `}</style>
      <svg className="egg" width="140" height="170" viewBox="0 0 140 170" aria-label="test egg">
        <path d="M70 6C34 6 8 62 8 104c0 34 27 60 62 60s62-26 62-60C132 62 106 6 70 6z" fill="#FFFFFF" stroke="#4D5263" strokeWidth="1.5" />
        <circle cx="70" cy="104" r="28" fill="#F2AE3D" />
        <circle cx="61" cy="95" r="7" fill="#FFE7A8" />
      </svg>
      <p style={{ margin: 0, color: '#1F2945', fontSize: 15 }}>{label}</p>
    </div>
  );
}
