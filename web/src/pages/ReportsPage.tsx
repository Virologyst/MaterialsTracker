import { useState, useEffect } from 'react';
import type { Material } from '../types.ts';
import { apiFetch } from '../hooks/useApi.ts';

const pageStyle: React.CSSProperties = {
  maxWidth: 1100,
  margin: '0 auto',
  padding: '32px 20px',
};

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: '10px 20px',
  fontSize: '1rem',
  fontWeight: 600,
  border: 'none',
  borderBottom: active ? '3px solid #4361ee' : '3px solid transparent',
  background: 'transparent',
  cursor: 'pointer',
  color: active ? '#4361ee' : '#666',
  marginRight: 8,
});

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

type Tab = 'group' | 'student';

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('group');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [groupData, setGroupData] = useState<Record<string, any>[]>([]);
  const [studentData, setStudentData] = useState<Record<string, any>[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch<Material[]>('/api/materials').then(setMaterials).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    if (tab === 'group') {
      apiFetch<Record<string, any>[]>('/api/reports/by-group')
        .then(setGroupData)
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      apiFetch<Record<string, any>[]>('/api/reports/by-student')
        .then(setStudentData)
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [tab]);

  function handleExport() {
    const token = localStorage.getItem('auth_token');
    const url = '/api/reports/export';
    fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'materials-report.csv';
        a.click();
        URL.revokeObjectURL(a.href);
      });
  }

  const filteredStudents = studentData.filter(
    (s) =>
      String(s.student_id).toLowerCase().includes(search.toLowerCase()) ||
      (s.student_name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={pageStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Reports</h1>
        <button style={btnPrimary} onClick={handleExport}>Export CSV</button>
      </div>

      <div style={{ marginBottom: 20, borderBottom: '1px solid #ddd' }}>
        <button style={tabStyle(tab === 'group')} onClick={() => setTab('group')}>By Group</button>
        <button style={tabStyle(tab === 'student')} onClick={() => setTab('student')}>By Student</button>
      </div>

      {loading && <p style={{ color: '#666' }}>Loading...</p>}

      {!loading && tab === 'group' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Group</th>
                {materials.map((m) => (
                  <th key={m.name} style={thStyle}>{m.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groupData.map((g) => (
                <tr key={g.id}>
                  <td style={tdStyle}>{g.name}</td>
                  {materials.map((m) => (
                    <td key={m.name} style={tdStyle}>{g[`${m.name}_used`] ?? 0}</td>
                  ))}
                </tr>
              ))}
              {groupData.length === 0 && (
                <tr>
                  <td style={{ ...tdStyle, textAlign: 'center', color: '#999' }} colSpan={materials.length + 1}>No data</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && tab === 'student' && (
        <>
          <input
            type="text"
            placeholder="Search students..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              maxWidth: 400,
              padding: '10px 14px',
              fontSize: '1rem',
              border: '1px solid #ccc',
              borderRadius: 4,
              marginBottom: 16,
            }}
          />
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Student ID</th>
                  <th style={thStyle}>Name</th>
                  {materials.map((m) => (
                    <th key={m.name} style={thStyle}>{m.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((s) => (
                  <tr key={s.student_id}>
                    <td style={tdStyle}>{s.student_id}</td>
                    <td style={tdStyle}>{s.student_name || '-'}</td>
                    {materials.map((m) => (
                      <td key={m.name} style={tdStyle}>{s[`${m.name}_used`] ?? 0}</td>
                    ))}
                  </tr>
                ))}
                {filteredStudents.length === 0 && (
                  <tr>
                    <td style={{ ...tdStyle, textAlign: 'center', color: '#999' }} colSpan={materials.length + 2}>No data</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
