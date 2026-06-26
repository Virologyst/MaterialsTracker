import { useState, useEffect } from 'react';
import type { GroupUsage, Material } from '../types.ts';
import { apiFetch } from '../hooks/useApi.ts';

interface Props {
  groups: GroupUsage[];
  studentId: string;
  onDispense: () => void;
}

const btnBase: React.CSSProperties = {
  padding: '12px 16px',
  fontSize: '1rem',
  fontWeight: 600,
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  color: 'white',
  flex: 1,
  minWidth: 120,
};

export default function DispenseForm({ groups, studentId, onDispense }: Props) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number>(
    groups.length === 1 ? groups[0].id : 0
  );
  const [quantity, setQuantity] = useState(1);
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch<Material[]>('/api/materials').then(setMaterials).catch(() => {});
  }, []);

  const group = groups.find((g) => g.id === selectedGroupId);

  async function handleDispense(materialName: string, materialLabel: string) {
    if (!group) return;
    setLoading(true);
    try {
      await apiFetch('/api/dispense', {
        method: 'POST',
        body: JSON.stringify({
          studentId,
          groupId: group.id,
          material: materialName,
          quantity,
        }),
      });
      setToast(`Dispensed ${quantity} ${materialLabel}`);
      setTimeout(() => setToast(''), 2000);
      onDispense();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Dispense failed';
      setToast(message);
      setTimeout(() => setToast(''), 3000);
    } finally {
      setLoading(false);
    }
  }

  function remaining(materialName: string): number {
    if (!group) return 0;
    const max = group.limits[materialName] ?? -1;
    if (max === -1) return Infinity;
    return Math.max(0, max - (group.used[materialName] ?? 0));
  }

  function isDisabled(materialName: string): boolean {
    if (!group) return true;
    const max = group.limits[materialName] ?? -1;
    if (max === -1) return false;
    if (max === 0) return true;
    return (group.used[materialName] ?? 0) >= max;
  }

  return (
    <div style={{ background: 'white', border: '1px solid #ddd', borderRadius: 8, padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Dispense Material</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Qty:</span>
          {[1, 2, 3].map((q) => (
            <button
              key={q}
              onClick={() => setQuantity(q)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 4,
                border: quantity === q ? '2px solid #4361ee' : '1px solid #ccc',
                background: quantity === q ? '#4361ee' : 'white',
                color: quantity === q ? 'white' : '#333',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '1rem',
              }}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {groups.length > 1 && (
        <select
          value={selectedGroupId}
          onChange={(e) => setSelectedGroupId(Number(e.target.value))}
          style={{
            width: '100%',
            padding: '10px 12px',
            fontSize: '1rem',
            marginBottom: 16,
            borderRadius: 4,
            border: '1px solid #ccc',
          }}
        >
          <option value={0}>Select group...</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {materials.map((m) => {
          const rem = remaining(m.name);
          const disabled = isDisabled(m.name) || loading || !group;
          return (
            <button
              key={m.name}
              style={{
                ...btnBase,
                background: disabled ? '#ccc' : m.color,
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}
              disabled={disabled}
              onClick={() => handleDispense(m.name, m.label)}
            >
              {m.label}
              <br />
              <span style={{ fontSize: '0.8rem', fontWeight: 400 }}>
                ({rem === Infinity ? 'unlimited' : `${rem} left`})
              </span>
            </button>
          );
        })}
      </div>

      {toast && (
        <div
          style={{
            marginTop: 12,
            padding: '10px 16px',
            background: toast.toLowerCase().includes('fail') || toast.toLowerCase().includes('exceed') || toast.toLowerCase().includes('error')
              ? '#fce4e4'
              : '#d4edda',
            borderRadius: 4,
            fontWeight: 500,
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
