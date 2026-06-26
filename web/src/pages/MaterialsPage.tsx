import { useState, useEffect } from 'react';
import type { Material } from '../types.ts';
import { apiFetch } from '../hooks/useApi.ts';

const pageStyle: React.CSSProperties = {
  maxWidth: 900,
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

interface EditState {
  name: string;
  label: string;
  color: string;
  sort_order: number;
}

const defaultNew: EditState = { name: '', label: '', color: '#4361ee', sort_order: 0 };

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [editId, setEditId] = useState<number | null>(null);
  const [editState, setEditState] = useState<EditState>({ ...defaultNew });
  const [showAdd, setShowAdd] = useState(false);
  const [newMaterial, setNewMaterial] = useState<EditState>({ ...defaultNew });
  const [error, setError] = useState('');

  async function loadMaterials() {
    try {
      const data = await apiFetch<Material[]>('/api/materials');
      setMaterials(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load materials');
    }
  }

  useEffect(() => { loadMaterials(); }, []);

  function startEdit(m: Material) {
    setEditId(m.id);
    setEditState({
      name: m.name,
      label: m.label,
      color: m.color,
      sort_order: m.sort_order,
    });
  }

  async function saveEdit(id: number) {
    try {
      await apiFetch(`/api/materials/${id}`, {
        method: 'PUT',
        body: JSON.stringify(editState),
      });
      setEditId(null);
      loadMaterials();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
  }

  async function deleteMaterial(id: number) {
    if (!confirm('Delete this material? This cannot be undone.')) return;
    try {
      await apiFetch(`/api/materials/${id}`, { method: 'DELETE' });
      loadMaterials();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  }

  async function addMaterial() {
    if (!newMaterial.name.trim() || !newMaterial.label.trim()) return;
    try {
      await apiFetch('/api/materials', {
        method: 'POST',
        body: JSON.stringify(newMaterial),
      });
      setShowAdd(false);
      setNewMaterial({ ...defaultNew });
      loadMaterials();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    }
  }

  return (
    <div style={pageStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Materials</h1>
        <button style={btnPrimary} onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? 'Cancel' : 'Add Material'}
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
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>Name (key)</label>
            <input
              style={{ ...inputSmall, width: 140 }}
              value={newMaterial.name}
              onChange={(e) => setNewMaterial({ ...newMaterial, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
              placeholder="e.g. acrylic"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>Label</label>
            <input
              style={{ ...inputSmall, width: 160 }}
              value={newMaterial.label}
              onChange={(e) => setNewMaterial({ ...newMaterial, label: e.target.value })}
              placeholder="e.g. Acrylic"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>Color</label>
            <input
              type="color"
              value={newMaterial.color}
              onChange={(e) => setNewMaterial({ ...newMaterial, color: e.target.value })}
              style={{ width: 50, height: 34, border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', padding: 2 }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>Sort Order</label>
            <input
              style={{ ...inputSmall, width: 60 }}
              type="number"
              min={0}
              value={newMaterial.sort_order}
              onChange={(e) => setNewMaterial({ ...newMaterial, sort_order: +e.target.value })}
            />
          </div>
          <button style={{ ...btnPrimary, background: '#2a9d8f' }} onClick={addMaterial}>Create</button>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Label</th>
              <th style={thStyle}>Color</th>
              <th style={thStyle}>Sort Order</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {materials.map((m) => (
              <tr key={m.id}>
                {editId === m.id ? (
                  <>
                    <td style={tdStyle}>
                      <input
                        style={{ ...inputSmall, width: 140 }}
                        value={editState.name}
                        onChange={(e) => setEditState({ ...editState, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                      />
                    </td>
                    <td style={tdStyle}>
                      <input
                        style={{ ...inputSmall, width: 160 }}
                        value={editState.label}
                        onChange={(e) => setEditState({ ...editState, label: e.target.value })}
                      />
                    </td>
                    <td style={tdStyle}>
                      <input
                        type="color"
                        value={editState.color}
                        onChange={(e) => setEditState({ ...editState, color: e.target.value })}
                        style={{ width: 50, height: 34, border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', padding: 2 }}
                      />
                    </td>
                    <td style={tdStyle}>
                      <input
                        style={{ ...inputSmall, width: 60 }}
                        type="number"
                        min={0}
                        value={editState.sort_order}
                        onChange={(e) => setEditState({ ...editState, sort_order: +e.target.value })}
                      />
                    </td>
                    <td style={tdStyle}>
                      <button style={{ ...btnPrimary, background: '#2a9d8f' }} onClick={() => saveEdit(m.id)}>Save</button>
                      <button style={{ ...btnPrimary, background: '#999' }} onClick={() => setEditId(null)}>Cancel</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td style={tdStyle}>
                      <code style={{ background: '#f0f0f0', padding: '2px 6px', borderRadius: 3, fontSize: '0.9rem' }}>{m.name}</code>
                    </td>
                    <td style={tdStyle}>{m.label}</td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 24, height: 24, borderRadius: 4, background: m.color, border: '1px solid #ccc' }} />
                        <span style={{ fontSize: '0.85rem', color: '#666' }}>{m.color}</span>
                      </div>
                    </td>
                    <td style={tdStyle}>{m.sort_order}</td>
                    <td style={tdStyle}>
                      <button style={btnPrimary} onClick={() => startEdit(m)}>Edit</button>
                      <button style={btnDanger} onClick={() => deleteMaterial(m.id)}>Delete</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {materials.length === 0 && (
              <tr>
                <td style={{ ...tdStyle, textAlign: 'center', color: '#999' }} colSpan={5}>
                  No materials yet. Click "Add Material" to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
