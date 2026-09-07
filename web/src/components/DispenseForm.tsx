import { useState, useEffect } from 'react';
import type { UnitUsage, Material } from '../types.ts';
import { apiFetch } from '../hooks/useApi.ts';

interface Props {
  units: UnitUsage[];
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

export default function DispenseForm({ units, studentId, onDispense }: Props) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<number>(
    units.length > 0 ? units[0].id : 0
  );
  const [quantity, setQuantity] = useState(1);
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(false);
  const [returnMode, setReturnMode] = useState(false);
  const [pin, setPin] = useState('');

  useEffect(() => {
    apiFetch<Material[]>('/api/materials').then(setMaterials).catch(() => {});
  }, []);

  const unit = units.find((u) => u.id === selectedUnitId);
  const isGroupMode = unit?.limit_type === 'group';
  const noGroup = isGroupMode && !unit?.group;

  async function handleDispense(materialName: string, materialLabel: string) {
    if (!unit) return;

    if (returnMode && !pin.trim()) {
      setToast('PIN is required for returns');
      setTimeout(() => setToast(''), 3000);
      return;
    }

    setLoading(true);
    try {
      const qty = returnMode ? -Math.abs(quantity) : quantity;

      // Use unitId for unit-based, groupId for legacy
      const body: any = {
        studentId,
        material: materialName,
        quantity: qty,
        ...(returnMode ? { pin: pin.trim() } : {}),
      };

      if (unit._legacy) {
        body.groupId = unit.id;
      } else {
        body.unitId = unit.id;
      }

      await apiFetch('/api/dispense', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const action = returnMode ? 'Returned' : 'Dispensed';
      setToast(`${action} ${Math.abs(qty)} ${materialLabel}`);
      setTimeout(() => setToast(''), 2000);
      if (returnMode) {
        setReturnMode(false);
        setPin('');
      }
      onDispense();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Operation failed';
      setToast(message);
      setTimeout(() => setToast(''), 3000);
    } finally {
      setLoading(false);
    }
  }

  function remaining(materialName: string): number {
    if (!unit) return 0;
    const max = unit.limits[materialName] ?? -1;
    if (max === -1) return Infinity;

    // In group mode, use group_used; in individual, use personal used
    const effectiveUsed = isGroupMode && unit.group_used
      ? (unit.group_used[materialName] ?? 0)
      : (unit.used[materialName] ?? 0);

    return Math.max(0, max - effectiveUsed);
  }

  function isDisabled(materialName: string): boolean {
    if (!unit || noGroup) return true;
    if (returnMode) {
      return (unit.used[materialName] ?? 0) <= 0;
    }
    const max = unit.limits[materialName] ?? -1;
    if (max === 0) return true;

    const effectiveUsed = isGroupMode && unit.group_used
      ? (unit.group_used[materialName] ?? 0)
      : (unit.used[materialName] ?? 0);

    if (max !== -1 && effectiveUsed >= max) return true;

    const totalLimit = unit.total_limit ?? -1;
    if (totalLimit !== -1) {
      const effectiveTotalUsed = isGroupMode && unit.group_total_used !== undefined
        ? unit.group_total_used
        : unit.total_used;
      if (effectiveTotalUsed >= totalLimit) return true;
    }
    return false;
  }

  return (
    <div style={{
      background: 'white',
      border: returnMode ? '2px solid #e76f51' : '1px solid #ddd',
      borderRadius: 8,
      padding: 20,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
          {returnMode ? 'Return Material' : 'Dispense Material'}
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => {
              setReturnMode(!returnMode);
              setPin('');
              setToast('');
            }}
            style={{
              padding: '6px 14px',
              borderRadius: 4,
              border: 'none',
              background: returnMode ? '#999' : '#e76f51',
              color: 'white',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            {returnMode ? 'Cancel Return' : 'Return'}
          </button>
          <span style={{ fontSize: '0.9rem', fontWeight: 500, marginLeft: 4 }}>Qty:</span>
          <button
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            style={{
              width: 32,
              height: 32,
              borderRadius: 4,
              border: '1px solid #ccc',
              background: 'white',
              cursor: quantity <= 1 ? 'not-allowed' : 'pointer',
              fontSize: '1.1rem',
              fontWeight: 600,
              color: quantity <= 1 ? '#ccc' : '#333',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            disabled={quantity <= 1}
          >
            -
          </button>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => {
              const v = parseInt(e.target.value);
              if (!isNaN(v) && v >= 1) setQuantity(v);
            }}
            style={{
              width: 48,
              height: 32,
              textAlign: 'center',
              border: '1px solid #ccc',
              borderRadius: 4,
              fontSize: '1rem',
              fontWeight: 600,
              MozAppearance: 'textfield',
            }}
          />
          <button
            onClick={() => setQuantity((q) => q + 1)}
            style={{
              width: 32,
              height: 32,
              borderRadius: 4,
              border: '1px solid #ccc',
              background: 'white',
              cursor: 'pointer',
              fontSize: '1.1rem',
              fontWeight: 600,
              color: '#333',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            +
          </button>
        </div>
      </div>

      {returnMode && (
        <div style={{ marginBottom: 12 }}>
          <input
            type="password"
            placeholder="Enter PIN to authorize return"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: '1rem',
              borderRadius: 4,
              border: '1px solid #e76f51',
              boxSizing: 'border-box',
            }}
          />
        </div>
      )}

      {units.length > 1 && (
        <select
          value={selectedUnitId}
          onChange={(e) => setSelectedUnitId(Number(e.target.value))}
          style={{
            width: '100%',
            padding: '10px 12px',
            fontSize: '1rem',
            marginBottom: 16,
            borderRadius: 4,
            border: '1px solid #ccc',
          }}
        >
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
              {u.group ? ` (${u.group.name})` : ''}
            </option>
          ))}
        </select>
      )}

      {noGroup && (
        <div style={{
          background: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: 4,
          padding: '8px 12px',
          fontSize: '0.85rem',
          marginBottom: 12,
          color: '#856404',
        }}>
          Cannot dispense: student must be assigned to a group in this unit first.
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {materials.map((m) => {
          const rem = remaining(m.name);
          const used = unit?.used[m.name] ?? 0;
          const disabled = isDisabled(m.name) || loading || !unit;
          const buttonColor = returnMode ? '#e76f51' : m.color;
          return (
            <button
              key={m.name}
              style={{
                ...btnBase,
                background: disabled ? '#ccc' : buttonColor,
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}
              disabled={disabled}
              onClick={() => handleDispense(m.name, m.label)}
            >
              {returnMode ? `Return ${m.label}` : m.label}
              <br />
              <span style={{ fontSize: '0.8rem', fontWeight: 400 }}>
                {returnMode
                  ? `(${used} used)`
                  : `(${rem === Infinity ? 'unlimited' : `${rem} left`})`
                }
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
            background: toast.toLowerCase().includes('fail') || toast.toLowerCase().includes('exceed') || toast.toLowerCase().includes('error') || toast.toLowerCase().includes('invalid') || toast.toLowerCase().includes('cannot') || toast.toLowerCase().includes('required')
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
