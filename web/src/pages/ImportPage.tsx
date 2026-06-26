import { useState, useEffect, useRef } from 'react';
import type { Group } from '../types.ts';
import { apiFetch } from '../hooks/useApi.ts';
import CsvUploader from '../components/CsvUploader.tsx';

const pageStyle: React.CSSProperties = {
  maxWidth: 800,
  margin: '0 auto',
  padding: '32px 20px',
};

const stepStyle: React.CSSProperties = {
  background: 'white',
  border: '1px solid #ddd',
  borderRadius: 8,
  padding: 20,
  marginBottom: 20,
};

const btnPrimary: React.CSSProperties = {
  padding: '10px 20px',
  background: '#4361ee',
  color: 'white',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: '1rem',
  fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: '1rem',
  borderRadius: 4,
  border: '1px solid #ccc',
  width: '100%',
  maxWidth: 300,
};

interface ImportResult {
  created: number;
  added: number;
  skipped: number;
  total: number;
}

export default function ImportPage() {
  const [groups, setGroups] = useState<Group[]>([]);

  // Individual add state
  const [addGroupId, setAddGroupId] = useState<number>(0);
  const [addStudentId, setAddStudentId] = useState('');
  const [addStudentName, setAddStudentName] = useState('');
  const [addResult, setAddResult] = useState('');
  const [addError, setAddError] = useState('');

  // CSV import state
  const [selectedGroupId, setSelectedGroupId] = useState<number>(0);
  const [preview, setPreview] = useState<string[][]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<File | null>(null);

  useEffect(() => {
    apiFetch<Group[]>('/api/groups')
      .then(setGroups)
      .catch(() => {});
  }, []);

  // Individual student add
  async function handleAddStudent() {
    if (!addStudentId.trim() || !addGroupId) return;
    setAddError('');
    setAddResult('');
    try {
      const res = await apiFetch<{ message: string }>('/api/students', {
        method: 'POST',
        body: JSON.stringify({
          studentId: addStudentId.trim(),
          name: addStudentName.trim() || undefined,
          groupId: addGroupId,
        }),
      });
      setAddResult(res.message);
      setAddStudentId('');
      setAddStudentName('');
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : 'Failed to add student');
    }
  }

  // CSV import
  function handleParsed(rows: string[][]) {
    setPreview(rows);
    setResult(null);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fileRef.current = input?.files?.[0] || null;
  }

  async function handleImport() {
    if (!selectedGroupId || !fileRef.current) return;
    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', fileRef.current);
      formData.append('groupId', String(selectedGroupId));

      const res = await apiFetch<ImportResult>('/api/students/import', {
        method: 'POST',
        body: formData,
      });
      setResult(res);
      setPreview([]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={pageStyle}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: 24 }}>Students</h1>

      {/* Individual student add */}
      <div style={stepStyle}>
        <h3 style={{ margin: '0 0 12px' }}>Add Individual Student</h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>Student ID *</label>
            <input
              style={{ ...inputStyle, maxWidth: 180 }}
              value={addStudentId}
              onChange={(e) => setAddStudentId(e.target.value)}
              placeholder="e.g. n10501234"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>Name (optional)</label>
            <input
              style={{ ...inputStyle, maxWidth: 200 }}
              value={addStudentName}
              onChange={(e) => setAddStudentName(e.target.value)}
              placeholder="e.g. Jane Smith"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>Group *</label>
            <select
              value={addGroupId}
              onChange={(e) => setAddGroupId(Number(e.target.value))}
              style={{ ...inputStyle, maxWidth: 200 }}
            >
              <option value={0}>Select group...</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <button
            style={{
              ...btnPrimary,
              background: (!addStudentId.trim() || !addGroupId) ? '#ccc' : '#2a9d8f',
              cursor: (!addStudentId.trim() || !addGroupId) ? 'not-allowed' : 'pointer',
            }}
            disabled={!addStudentId.trim() || !addGroupId}
            onClick={handleAddStudent}
          >
            Add Student
          </button>
        </div>
        {addResult && (
          <div style={{ marginTop: 12, padding: '8px 12px', background: '#d4edda', borderRadius: 4, color: '#155724' }}>
            {addResult}
          </div>
        )}
        {addError && (
          <div style={{ marginTop: 12, padding: '8px 12px', background: '#fce4e4', borderRadius: 4, color: '#e63946' }}>
            {addError}
          </div>
        )}
      </div>

      {/* CSV Import */}
      <h2 style={{ fontSize: '1.2rem', marginBottom: 16 }}>Bulk Import (CSV)</h2>

      {error && (
        <div style={{ background: '#fce4e4', padding: 12, borderRadius: 4, marginBottom: 16, color: '#e63946' }}>
          {error}
        </div>
      )}

      <div style={stepStyle}>
        <h3 style={{ margin: '0 0 12px' }}>Step 1: Select Group</h3>
        <select
          value={selectedGroupId}
          onChange={(e) => setSelectedGroupId(Number(e.target.value))}
          style={{ ...inputStyle, maxWidth: 400 }}
        >
          <option value={0}>Select a group...</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </div>

      <div style={stepStyle}>
        <h3 style={{ margin: '0 0 12px' }}>Step 2: Upload CSV</h3>
        <p style={{ color: '#666', margin: '0 0 12px', fontSize: '0.9rem' }}>
          CSV should have a column for student ID. Student name column is optional.
          Duplicates are skipped automatically.
        </p>
        <CsvUploader onParsed={handleParsed} />
      </div>

      {preview.length > 0 && (
        <div style={stepStyle}>
          <h3 style={{ margin: '0 0 12px' }}>Preview ({preview.length} rows)</h3>
          <div style={{ maxHeight: 300, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <tbody>
                {preview.slice(0, 20).map((row, i) => (
                  <tr key={i} style={{ background: i === 0 ? '#f0f0f0' : 'white' }}>
                    {row.map((cell, j) => (
                      <td key={j} style={{ padding: '6px 10px', borderBottom: '1px solid #eee' }}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
                {preview.length > 20 && (
                  <tr>
                    <td style={{ padding: '6px 10px', color: '#999' }} colSpan={10}>
                      ...and {preview.length - 20} more rows
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={stepStyle}>
        <h3 style={{ margin: '0 0 12px' }}>Step 3: Import</h3>
        <button
          style={{
            ...btnPrimary,
            background: (!selectedGroupId || preview.length === 0) ? '#ccc' : '#4361ee',
            cursor: (!selectedGroupId || preview.length === 0) ? 'not-allowed' : 'pointer',
          }}
          disabled={!selectedGroupId || preview.length === 0 || loading}
          onClick={handleImport}
        >
          {loading ? 'Importing...' : 'Import Students'}
        </button>
      </div>

      {result && (
        <div style={{ ...stepStyle, background: '#d4edda', border: '1px solid #2a9d8f' }}>
          <h3 style={{ margin: '0 0 8px', color: '#155724' }}>Import Complete</h3>
          <p style={{ margin: 0 }}>
            <strong>{result.created}</strong> new students created,{' '}
            <strong>{result.added}</strong> added to class,{' '}
            <strong>{result.skipped}</strong> already in class (skipped),{' '}
            <strong>{result.total}</strong> total rows processed.
          </p>
        </div>
      )}
    </div>
  );
}
