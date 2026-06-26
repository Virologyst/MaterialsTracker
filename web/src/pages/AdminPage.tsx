import { useState } from 'react';
import { apiFetch } from '../hooks/useApi.ts';

const pageStyle: React.CSSProperties = {
  maxWidth: 600,
  margin: '0 auto',
  padding: '32px 20px',
};

const sectionStyle: React.CSSProperties = {
  background: 'white',
  border: '1px solid #ddd',
  borderRadius: 8,
  padding: 20,
  marginBottom: 20,
};

const btnDanger: React.CSSProperties = {
  padding: '10px 20px',
  background: '#e63946',
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
  boxSizing: 'border-box' as const,
};

export default function AdminPage() {
  const [semester, setSemester] = useState('');
  const [pin, setPin] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  async function handleReset() {
    if (!semester.trim() || !pin.trim() || !confirmed) return;
    setLoading(true);
    setError('');
    setResult('');
    try {
      const res = await apiFetch<{ message: string }>('/api/admin/semester-reset', {
        method: 'POST',
        body: JSON.stringify({ pin: pin.trim(), semester: semester.trim() }),
      });
      setResult(res.message);
      setSemester('');
      setPin('');
      setConfirmed(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = semester.trim() && pin.trim() && confirmed && !loading;

  return (
    <div style={pageStyle}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: 24 }}>Admin</h1>

      <div style={sectionStyle}>
        <h3 style={{ margin: '0 0 8px', color: '#e63946' }}>Semester Reset</h3>
        <div style={{
          background: '#fce4e4',
          border: '1px solid #e63946',
          borderRadius: 6,
          padding: 16,
          marginBottom: 20,
        }}>
          <p style={{ margin: '0 0 8px', fontWeight: 600, color: '#e63946' }}>
            WARNING: This is a full semester reset. All students and transaction data will be archived.
          </p>
          <p style={{ margin: 0, color: '#c1121f', fontSize: '0.9rem' }}>
            All dispensing history and student records will be moved to an archive under the semester label you provide.
            Groups and materials will remain intact, but all students will be removed and usage reset to zero.
            This cannot be undone.
          </p>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: 4, fontWeight: 500 }}>
            Semester Label
          </label>
          <input
            style={inputStyle}
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            placeholder='e.g. 2026-S1, "Semester 1 2026"'
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: 4, fontWeight: 500 }}>
            PIN
          </label>
          <input
            type="password"
            style={inputStyle}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Enter PIN to authorize"
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ cursor: 'pointer', fontSize: '0.95rem' }}>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              style={{ marginRight: 8 }}
            />
            I understand this will archive all students and transactions and reset everything to zero
          </label>
        </div>

        <button
          style={{
            ...btnDanger,
            background: canSubmit ? '#e63946' : '#ccc',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
          }}
          disabled={!canSubmit}
          onClick={handleReset}
        >
          {loading ? 'Resetting...' : 'Reset Semester'}
        </button>

        {result && (
          <div style={{ marginTop: 16, padding: '10px 16px', background: '#d4edda', borderRadius: 4, color: '#155724', fontWeight: 500 }}>
            {result}
          </div>
        )}
        {error && (
          <div style={{ marginTop: 16, padding: '10px 16px', background: '#fce4e4', borderRadius: 4, color: '#e63946', fontWeight: 500 }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
