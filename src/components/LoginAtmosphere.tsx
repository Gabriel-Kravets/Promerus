import type {CSSProperties} from 'react';

// Fixed positions keep the sparse decorations stable across server/client renders.
const fireflies = [
  [9, 23, 8, -3], [16, 71, 11, -8], [23, 13, 9, -5],
  [29, 86, 13, -1], [36, 32, 10, -7], [62, 12, 12, -9],
  [69, 78, 9, -2], [77, 28, 14, -11], [85, 65, 10, -4],
  [91, 19, 12, -6], [8, 89, 15, -12], [92, 87, 11, -1],
  [48, 92, 13, -8], [79, 49, 15, -3],
];

function DustSpiral({className}: {className: string}) {
  return <svg className={`auth-dust ${className}`} viewBox="0 0 240 180" fill="currentColor">
    {Array.from({length: 43}, (_, i) => {
      const angle = i * .19;
      const radius = 5 + i * 2.3;
      // Rounded so server (Node) and browser trig results serialize identically.
      return <rect key={i} x={(120 + Math.cos(angle) * radius).toFixed(2)} y={(90 + Math.sin(angle) * radius * .67).toFixed(2)}
        width={i % 5 === 0 ? 3 : 2} height="2" opacity={.22 + (i % 4) * .13}/>;
    })}
  </svg>;
}

export default function LoginAtmosphere() {
  return <div className="auth-atmosphere" aria-hidden="true">
    {fireflies.map(([left, top, duration, delay], i) => <i key={i}
      className={`auth-firefly${i % 4 === 0 ? ' auth-firefly-cross' : ''}`}
      style={{left: `${left}%`, top: `${top}%`, '--glow-duration': `${duration}s`, '--glow-delay': `${delay}s`} as CSSProperties}/>)}
    <DustSpiral className="auth-dust-left"/>
    <DustSpiral className="auth-dust-right"/>
    <svg className="auth-floating-leaf" viewBox="0 0 24 24">
      <path fill="#778447" d="M3 3h8v3h5v3h3v7h-3v3H9v-3H6v-5H3z"/>
      <path fill="none" stroke="#34472d" strokeWidth="2" d="m5 5 14 14m-9-9v5m0-5h5"/>
    </svg>
  </div>;
}
