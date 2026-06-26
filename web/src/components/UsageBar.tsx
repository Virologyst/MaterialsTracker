interface Props {
  label: string;
  used: number;
  max: number;
}

export default function UsageBar({ label, used, max }: Props) {
  const isUnlimited = max === -1;

  if (isUnlimited) {
    return (
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
          <span style={{ fontWeight: 500 }}>{label}</span>
          <span>{used} used (no limit)</span>
        </div>
        <div style={{ background: '#eee', borderRadius: 4, height: 12, overflow: 'hidden' }}>
          <div
            style={{
              width: used > 0 ? '100%' : '0%',
              height: '100%',
              background: '#4361ee',
              borderRadius: 4,
              opacity: 0.3,
            }}
          />
        </div>
      </div>
    );
  }

  if (max === 0) {
    return (
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
          <span style={{ fontWeight: 500 }}>{label}</span>
          <span style={{ color: '#999' }}>Not available</span>
        </div>
      </div>
    );
  }

  const pct = Math.min((used / max) * 100, 100);
  let color = '#2a9d8f'; // green
  if (pct >= 80) color = '#e63946'; // red
  else if (pct >= 50) color = '#e9c46a'; // yellow

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ fontWeight: 500 }}>{label}</span>
        <span>{used} / {max}</span>
      </div>
      <div style={{ background: '#eee', borderRadius: 4, height: 12, overflow: 'hidden' }}>
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: color,
            borderRadius: 4,
            transition: 'width 0.3s',
          }}
        />
      </div>
    </div>
  );
}
