import { useState, useEffect } from 'react';
import type { Group, Material } from '../types.ts';
import { apiFetch } from '../hooks/useApi.ts';

const pageStyle: React.CSSProperties = {
  maxWidth: 1100,
  margin: '0 auto',
  padding: '32px 20px',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  background: 'white',
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  borderBottom: '2px solid #ddd',
  background: '#f8f8f8',
  fontWeight: 600,
  fontSize: '0.85rem',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderBottom: '1px solid #eee',
};

const inputSmall: React.CSSProperties = {
  width: 60,
  padding: '6px 8px',
  border: '1px solid #ccc',
  borderRadius: 4,
  fontSize: '0.95rem',
};

const btnPrimary: React.CSSProperties = {
  padding: '6px 14px',
  background: '#4361ee',
  color: 'white',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: '0.9rem',
  marginRight: 6,
};

const btnDanger: React.CSSProperties = {
  padding: '6px 14px',
  background: '#e63946',
  color: 'white',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: '0.9rem',
};

function LimitInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const isUnlimited = value === -1;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <input
        style={{ ...inputSmall, width: 50, opacity: isUnlimited ? 0.4 : 1 }}
        type="number"
        min={0}
        value={isUnlimited ? '' : value}
        placeholder="-"
        disabled={isUnlimited}
        onChange={(e) => onChange(e.target.value === '' ? 0 : +e.target.value)}
      />
      <label style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={isUnlimited}
          onChange={(e) => onChange(e.target.checked ? -1 : 3)}
          style={{ marginRight: 2 }}
        />
        <span title="Unlimited">Unl.</span>
      </label>
    </div>
  );
}

function displayLimit(v: number): string {
  return v === -1 ? 'Unlimited' : String(v);
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editLimits, setEditLimits] = useState<Record<string, number>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLimits, setNewLimits] = useState<Record<string, number>>({});
  const [error, setError] = useState('');

  async function loadData() {
    try {
      const [groupsData, matsData] = await Promise.all([
        apiFetch<Group[]>('/api/groups'),
        apiFetch<Material[]>('/api/materials'),
      ]);
      setGroups(groupsData);
      setMaterials(matsData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    }
  }

  useEffect(() => { loadData(); }, []);

  function defaultLimits(): Record<string, number> {
    const limits: Record<string, number> = {};
    for (const m of materials) {
      limits[m.name] = -1;
    }
    return limits;
  }

  function startEdit(g: Group) {
    setEditId(g.id);
    setEditName(g.name);
    const limits: Record<string, number> = {};
    for (const m of materials) {
      limits[m.name] = g.limits[m.name] ?? -1;
    }
    setEditLimits(limits);
  }

  async function saveEdit(id: number) {
    try {
      await apiFetch(`/api/groups/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: editName, limits: editLimits }),
      });
      setEditId(null);
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
  }

  async function deleteGroup(id: number) {
    if (!confirm('Delete this group? This cannot be undone.')) return;
    try {
      await apiFetch(`/api/groups/${id}`, { method: 'DELETE' });
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  }

  async function addGroup() {
    if (!newName.trim()) return;
    try {
      await apiFetch('/api/groups', {
        method: 'POST',
        body: JSON.stringify({ name: newName, limits: newLimits }),
      });
      setShowAdd(false);
      setNewName('');
      setNewLimits({});
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    }
  }

  function handleShowAdd() {
    if (!showAdd) {
      setNewLimits(defaultLimits());
    }
    setShowAdd(!showAdd);
  }

  return (
    <div style={pageStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Groups</h1>
        <button style={btnPrimary} onClick={handleShowAdd}>
          {showAdd ? 'Cancel' : 'Add Group'}
        </button>
      </div>

      {error && (
        <div style={{ background: '#fce4e4', padding: 12, borderRadius: 4, marginBottom: 16, color: '#e63946' }}>
          {error}
          <button onClick={() => setError('')} style={{ marginLeft: 12, background: 'none', border: 'none', cursor: 'pointer' }}>x</button>
        </div>
      )}

      {showAdd && (
        <div style={{ background: '#f8f8f8', padding: 16, borderRadius: 8, marginBottom: 20, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>Name</label>
            <input
              style={{ ...inputSmall, width: 180 }}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Group name"
            />
          </div>
          {materials.map((m) => (
            <div key={m.name}>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>{m.label}</label>
              <LimitInput
                value={newLimits[m.name] ?? -1}
                onChange={(v) => setNewLimits({ ...newLimits, [m.name]: v })}
              />
            </div>
          ))}
          <button style={{ ...btnPrimary, background: '#2a9d8f' }} onClick={addGroup}>Create</button>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Name</th>
              {materials.map((m) => (
                <th key={m.name} style={thStyle}>{m.label}</th>
              ))}
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.id}>
                {editId === g.id ? (
                  <>
                    <td style={tdStyle}>
                      <input style={{ ...inputSmall, width: 180 }} value={editName} onChange={(e) => setEditName(e.target.value)} />
                    </td>
                    {materials.map((m) => (
                      <td key={m.name} style={tdStyle}>
                        <LimitInput
                          value={editLimits[m.name] ?? -1}
                          onChange={(v) => setEditLimits({ ...editLimits, [m.name]: v })}
                        />
                      </td>
                    ))}
                    <td style={tdStyle}>
                      <button style={{ ...btnPrimary, background: '#2a9d8f' }} onClick={() => saveEdit(g.id)}>Save</button>
                      <button style={{ ...btnPrimary, background: '#999' }} onClick={() => setEditId(null)}>Cancel</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td style={tdStyle}>{g.name}</td>
                    {materials.map((m) => (
                      <td key={m.name} style={tdStyle}>{displayLimit(g.limits[m.name] ?? -1)}</td>
                    ))}
                    <td style={tdStyle}>
                      <button style={btnPrimary} onClick={() => startEdit(g)}>Edit</button>
                      <button style={btnDanger} onClick={() => deleteGroup(g.id)}>Delete</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {groups.length === 0 && (
              <tr>
                <td style={{ ...tdStyle, textAlign: 'center', color: '#999' }} colSpan={materials.length + 2}>
                  No groups yet. Click "Add Group" to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
