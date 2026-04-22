

export default function WheelGrows() {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100, pointerEvents: 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(6,6,6,.92)',
    }}>
      <div style={{
        fontSize: 'clamp(1.5rem, 4vw, 2.2rem)', fontWeight: 700,
        color: '#D4AF37', letterSpacing: '.3em',
        border: '2px solid #D4AF37', padding: '22px 44px',
        animation: 'zr .5s cubic-bezier(0.34, 1.56, 0.64, 1), growPulse 1s .5s infinite',
      }}>
        WHEEL GROWS
      </div>
    </div>
  );
}
