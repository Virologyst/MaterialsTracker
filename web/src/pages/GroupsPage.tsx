import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Unit, Material } from '../types.ts';
import { apiFetch } from '../hooks/useApi.ts';

const pageStyle: React.CSSProperties = {
  maxWidth: 1000,
  margin: '0 auto',
  padding: '32px 20px',
};

const cardStyle: React.CSSProperties = {
  background: 'white',
  border: '1px solid #ddd',
  borderRadius: 8,
  padding: 20,
  marginBottom: 20,
};

const btnPrimary: React.CSSProperties = {
  padding: '8px 16px',
  background: '#4361ee',
  color: 'white',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: '0.9rem',
  fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: '0.9rem',
  borderRadius: 4,
  border: '1px solid #ccc',
};

function LimitInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const isUnlimited = value === -1;
  const isUnavailable = value === 0;
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      <input
        type="number"
        min={0}
        value={isUnlimited ? '' : value}
        onChange={(e) => {
          const v = parseInt(e.target.value);
          onChange(isNaN(v) ? -1 : v);
        }}
        placeholder={isUnlimited ? '\u221e' : '0'}
        style={{ ...inputStyle, width: 60, textAlign: 'center' }}
      />
      <button
        onClick={() => onChange(isUnlimited ? 0 : -1)}
        title={isUnlimited ? 'Set to 0' : 'Set to unlimited'}
        style={{
          padding: '4px 8px',
          borderRadius: 4,
          border: '1px solid #ccc',
          background: isUnlimited ? '#d4edda' : isUnavailable ? '#fce4e4' : 'white',
          cursor: 'pointer',
          fontSize: '0.75rem',
        }}
      >
        {isUnlimited ? '\u221e' : isUnavailable ? '\u2717' : '\u221e'}
      </button>
    </div>
  );
}

export default function GroupsPage() {
  const navigate = useNavigate();
  const [units, setUnits] = useState<Unit[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [error, setError] = useState('');

  // New unit form
  const [newName, setNewName] = useState('');
  const [newLimitType, setNewLimitType] = useState<'individual' | 'group'>('individual');
  const [newLimits, setNewLimits] = useState<Record<string, number>>({});
  const [newTotalLimit, setNewTotalLimit] = useState(-1);

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editLimitType, setEditLimitType] = useState<'individual' | 'group'>('individual');
  const [editLimits, setEditLimits] = useState<Record<string, number>>({});
  const [editTotalLimit, setEditTotalLimit] = useState(-1);

  // New group form
  const [addGroupUnitId, setAddGroupUnitId] = useState<number | null>(null);
  const [newGroupName, setNewGroupName] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [u, m] = await Promise.all([
        apiFetch<Unit[]>('/api/units'),
        apiFetch<Material[]>('/api/materials'),
      ]);
      setUnits(u);
      setMaterials(m);
    } catch {
      setError('Failed to load data');
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setError('');
    try {
      await apiFetch('/api/units', {
        method: 'POST',
        body: JSON.stringify({
          name: newName.trim(),
          limit_type: newLimitType,
          limits: newLimits,
          total_limit: newTotalLimit,
        }),
      });
      setNewName('');
      setNewLimits({});
      setNewTotalLimit(-1);
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create unit');
    }
  }

  function startEdit(unit: Unit) {
    setEditingId(unit.id);
    setEditName(unit.name);
    setEditLimitType(unit.limit_type);
    setEditLimits({ ...unit.limits });
    setEditTotalLimit(unit.total_limit);
  }

  async function handleSave() {
    if (editingId === null) return;
    setError('');
    try {
      await apiFetch(`/api/units/${editingId}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editName.trim(),
          limit_type: editLimitType,
          limits: editLimits,
          total_limit: editTotalLimit,
        }),
      });
      setEditingId(null);
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update unit');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this unit and all its groups?')) return;
    try {
      await apiFetch(`/api/units/${id}`, { method: 'DELETE' });
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete unit');
    }
  }

  async function handleAddGroup(unitId: number) {
    if (!newGroupName.trim()) return;
    setError('');
    try {
      await apiFetch('/api/groups', {
        method: 'POST',
        body: JSON.stringify({ name: newGroupName.trim(), unitId }),
      });
      setAddGroupUnitId(null);
      setNewGroupName('');
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add group');
    }
  }

  async function handleDeleteGroup(groupId: number) {
    if (!confirm('Delete this group?')) return;
    try {
      await apiFetch(`/api/groups/${groupId}`, { method: 'DELETE' });
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete group');
    }
  }

  return (
    <div style={pageStyle}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: 24 }}>Units & Groups</h1>

      {error && (
        <div style={{ background: '#fce4e4', padding: 12, borderRadius: 4, marginBottom: 16, color: '#e63946', display: 'flex', justifyContent: 'space-between' }}>
          <span>{error}</span>
          <button onClick={() => setError('')} style={{ border: 'none', background: 'none', cursor: 'pointer', fontWeight: 700 }}>x</button>
        </div>
      )}

      {/* Add unit form */}
      <div style={cardStyle}>
        <h3 style={{ margin: '0 0 12px' }}>Add Unit</h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: 4 }}>Unit Name</label>
            <input
              style={{ ...inputStyle, width: 200 }}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. EGB210"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: 4 }}>Limit Type</label>
            <select
              value={newLimitType}
              onChange={(e) => setNewLimitType(e.target.value as 'individual' | 'group')}
              style={inputStyle}
            >
              <option value="individual">Per Student</option>
              <option value="group">Per Group (shared)</option>
            </select>
          </div>
          {materials.map((m) => (
            <div key={m.name}>
              <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: 4 }}>{m.label}</label>
              <LimitInput
                value={newLimits[m.name] ?? -1}
                onChange={(v) => setNewLimits({ ...newLimits, [m.name]: v })}
              />
            </div>
          ))}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: 4 }}>Total</label>
            <LimitInput value={newTotalLimit} onChange={setNewTotalLimit} />
          </div>
          <button
            style={{ ...btnPrimary, background: !newName.trim() ? '#ccc' : '#2a9d8f' }}
            disabled={!newName.trim()}
            onClick={handleCreate}
          >
            Add Unit
          </button>
        </div>
      </div>

      {/* Unit list */}
      {units.map((unit) => {
        const isEditing = editingId === unit.id;
        return (
          <div key={unit.id} style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              {isEditing ? (
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{ ...inputStyle, fontWeight: 700, fontSize: '1.1rem' }}
                />
              ) : (
                <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{unit.name}</h2>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                {isEditing ? (
                  <>
                    <button onClick={handleSave} style={{ ...btnPrimary, background: '#2a9d8f' }}>Save</button>
                    <button onClick={() => setEditingId(null)} style={{ ...btnPrimary, background: '#999' }}>Cancel</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => startEdit(unit)} style={{ ...btnPrimary, background: '#4361ee' }}>Edit</button>
                    <button onClick={() => handleDelete(unit.id)} style={{ ...btnPrimary, background: '#e63946' }}>Delete</button>
                  </>
                )}
              </div>
            </div>

            {/* Limit type and material limits */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
              <div style={{
                padding: '4px 10px',
                borderRadius: 12,
                background: unit.limit_type === 'group' ? '#e3f2fd' : '#f3e5f5',
                fontSize: '0.8rem',
                fontWeight: 600,
              }}>
                {isEditing ? (
                  <select
                    value={editLimitType}
                    onChange={(e) => setEditLimitType(e.target.value as 'individual' | 'group')}
                    style={{ border: 'none', background: 'transparent', fontWeight: 600 }}
                  >
                    <option value="individual">Per Student</option>
                    <option value="group">Per Group</option>
                  </select>
                ) : (
                  unit.limit_type === 'group' ? 'Per Group' : 'Per Student'
                )}
              </div>
              {materials.map((m) => (
                <div key={m.name} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: '#666' }}>{m.label}</div>
                  {isEditing ? (
                    <LimitInput
                      value={editLimits[m.name] ?? -1}
                      onChange={(v) => setEditLimits({ ...editLimits, [m.name]: v })}
                    />
                  ) : (
                    <div style={{ fontWeight: 600 }}>
                      {unit.limits[m.name] === -1 ? '\u221e' : unit.limits[m.name] === 0 ? '\u2717' : unit.limits[m.name]}
                    </div>
                  )}
                </div>
              ))}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: '#666' }}>Total</div>
                {isEditing ? (
                  <LimitInput value={editTotalLimit} onChange={setEditTotalLimit} />
                ) : (
                  <div style={{ fontWeight: 600 }}>
                    {unit.total_limit === -1 ? '\u221e' : unit.total_limit}
                  </div>
                )}
              </div>
            </div>

            {/* Groups */}
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
                  Groups ({unit.groups.length})
                </h4>
                <button
                  onClick={() => {
                    setAddGroupUnitId(addGroupUnitId === unit.id ? null : unit.id);
                    setNewGroupName('');
                  }}
                  style={{ ...btnPrimary, padding: '4px 10px', fontSize: '0.8rem' }}
                >
                  + Add Group
                </button>
              </div>

              {addGroupUnitId === unit.id && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Group name (e.g. A1)"
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button
                    onClick={() => handleAddGroup(unit.id)}
                    disabled={!newGroupName.trim()}
                    style={{ ...btnPrimary, background: !newGroupName.trim() ? '#ccc' : '#2a9d8f', padding: '6px 12px' }}
                  >
                    Add
                  </button>
                </div>
              )}

              {unit.groups.length > 0 ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {unit.groups.map((g) => (
                    <div
                      key={g.id}
                      style={{
                        padding: '6px 12px',
                        background: '#f8f9fa',
                        borderRadius: 6,
                        border: '1px solid #e9ecef',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        cursor: 'pointer',
                      }}
                      onClick={() => navigate(`/units/${unit.id}/groups/${g.id}`)}
                    >
                      <span style={{ fontWeight: 600 }}>{g.name}</span>
                      <span style={{ fontSize: '0.8rem', color: '#666' }}>
                        {g.student_count} student{g.student_count !== 1 ? 's' : ''}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteGroup(g.id); }}
                        style={{
                          border: 'none',
                          background: 'none',
                          color: '#e63946',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          padding: '0 4px',
                        }}
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: '#999', fontSize: '0.85rem', margin: 0 }}>No groups yet. Import students or add groups manually.</p>
              )}
            </div>
          </div>
        );
      })}

      {units.length === 0 && (
        <p style={{ textAlign: 'center', color: '#999', marginTop: 40 }}>
          No units created yet. Add one above to get started.
        </p>
      )}
    </div>
  );
}
