import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiFetch } from '../hooks/useApi.ts';

interface GroupDetailData {
  unit: { id: number; name: string; limit_type: string; total_limit: number };
  group: { id: number; name: string };
  limits: Record<string, number>;
  group_totals: Record<string, number>;
  students: Record<string, any>[];
  materials: { name: string; label: string }[];
}

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

export default function GroupDetailPage() {
  const { unitId, groupId } = useParams();
  const [data, setData] = useState<GroupDetailData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!unitId || !groupId) return;
    apiFetch<GroupDetailData>(`/api/units/${unitId}/groups/${groupId}/students`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, [unitId, groupId]);

  if (error) {
    return (
      <div style={pageStyle}>
        <div style={{ background: '#fce4e4', padding: 12, borderRadius: 4, color: '#e63946' }}>{error}</div>
      </div>
    );
  }

  if (!data) {
    return <div style={pageStyle}><p>Loading...</p></div>;
  }

  const isGroupMode = data.unit.limit_type === 'group';

  function isOverBudget(matName: string): boolean {
    const limit = data!.limits[matName] ?? -1;
    if (limit === -1) return false;
    return (data!.group_totals[matName] ?? 0) > limit;
  }

  function isStudentOverContribution(student: Record<string, any>, matName: string): boolean {
    const used = (student[`used_${matName}`] as number) || 0;
    if (!isGroupMode) {
      const limit = data!.limits[matName] ?? -1;
      if (limit === -1) return false;
      return used > limit;
    }
    return false;
  }

  return (
    <div style={pageStyle}>
      <div style={{ marginBottom: 20 }}>
        <Link to="/groups" style={{ color: '#4361ee', textDecoration: 'none', fontSize: '0.9rem' }}>
          &larr; Back to Units
        </Link>
      </div>

      <h1 style={{ fontSize: '1.5rem', margin: '0 0 4px' }}>
        {data.unit.name} &mdash; Group {data.group.name}
      </h1>
      <p style={{ color: '#666', margin: '0 0 20px' }}>
        {isGroupMode ? 'Shared group budget' : 'Individual student budgets'}
        {' \u00b7 '}
        {data.students.length} student{data.students.length !== 1 ? 's' : ''}
      </p>

      {/* Group totals summary (especially useful for group mode) */}
      {isGroupMode && (
        <div style={{
          background: 'white',
          border: '1px solid #ddd',
          borderRadius: 8,
          padding: 16,
          marginBottom: 20,
          display: 'flex',
          gap: 24,
          flexWrap: 'wrap',
        }}>
          <h3 style={{ margin: 0, fontSize: '1rem', width: '100%' }}>Group Budget</h3>
          {data.materials.map((m) => {
            const used = data.group_totals[m.name] ?? 0;
            const limit = data.limits[m.name] ?? -1;
            const over = isOverBudget(m.name);
            return (
              <div key={m.name} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: '#666' }}>{m.label}</div>
                <div style={{
                  fontSize: '1.2rem',
                  fontWeight: 700,
                  color: over ? '#e63946' : '#1a1a2e',
                }}>
                  {used} / {limit === -1 ? '\u221e' : limit}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Student</th>
              <th style={thStyle}>ID</th>
              {data.materials.map((m) => (
                <th key={m.name} style={{
                  ...thStyle,
                  color: isGroupMode && isOverBudget(m.name) ? '#e63946' : undefined,
                }}>
                  {m.label}
                </th>
              ))}
              <th style={thStyle}>Total</th>
            </tr>
          </thead>
          <tbody>
            {data.students.map((s, i) => {
              let studentTotal = 0;
              for (const m of data.materials) {
                studentTotal += (s[`used_${m.name}`] as number) || 0;
              }

              return (
                <tr key={s.id} style={{ background: i % 2 === 0 ? 'white' : '#f8f8f8' }}>
                  <td style={tdStyle}>{s.name || 'Unknown'}</td>
                  <td style={{ ...tdStyle, color: '#666', fontSize: '0.85rem' }}>{s.id}</td>
                  {data.materials.map((m) => {
                    const used = (s[`used_${m.name}`] as number) || 0;
                    const over = isStudentOverContribution(s, m.name);
                    return (
                      <td key={m.name} style={{
                        ...tdStyle,
                        fontWeight: used > 0 ? 600 : 400,
                        color: over ? '#e63946' : used > 0 ? '#1a1a2e' : '#ccc',
                      }}>
                        {used}
                      </td>
                    );
                  })}
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{studentTotal}</td>
                </tr>
              );
            })}
            {data.students.length === 0 && (
              <tr>
                <td style={{ ...tdStyle, textAlign: 'center', color: '#999' }} colSpan={data.materials.length + 3}>
                  No students in this group.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
