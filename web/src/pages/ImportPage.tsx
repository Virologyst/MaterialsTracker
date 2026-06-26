import { useState, useEffect, useRef } from 'react';
import type { Group, ImportResult } from '../types.ts';
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

export default function ImportPage() {
  const [groups, setGroups] = useState<Group[]>([]);
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

  function handleParsed(rows: string[][]) {
    setPreview(rows);
    setResult(null);
    // Grab the actual file from the input
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
      <h1 style={{ fontSize: '1.5rem', marginBottom: 24 }}>Import Students</h1>

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
          style={{ padding: '10px 12px', fontSize: '1rem', borderRadius: 4, border: '1px solid #ccc', width: '100%', maxWidth: 400 }}
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
          CSV should have columns for student ID and optionally student name.
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
            <strong>{result.created}</strong> students created,{' '}
            <strong>{result.enrolled}</strong> enrolled in group,{' '}
            <strong>{result.total}</strong> total rows processed.
          </p>
        </div>
      )}
    </div>
  );
}
