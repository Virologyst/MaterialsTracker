import { useState, useEffect } from 'react';
import type { Student, UnitUsage, Material } from '../types.ts';
import { apiFetch } from '../hooks/useApi.ts';
import UsageBar from './UsageBar.tsx';

interface Props {
  student: Student;
  units: UnitUsage[];
}

const cardStyle: React.CSSProperties = {
  background: 'white',
  border: '1px solid #ddd',
  borderRadius: 8,
  padding: 20,
  marginBottom: 16,
};

export default function StudentCard({ student, units }: Props) {
  const [materials, setMaterials] = useState<Material[]>([]);

  useEffect(() => {
    apiFetch<Material[]>('/api/materials').then(setMaterials).catch(() => {});
  }, []);

  return (
    <div style={cardStyle}>
      <h2 style={{ margin: '0 0 4px', fontSize: '1.3rem' }}>
        {student.name || 'Unknown Student'}
      </h2>
      <p style={{ margin: '0 0 16px', color: '#666' }}>ID: {student.id}</p>

      {units.map((u, i) => {
        const isGroupMode = u.limit_type === 'group';
        const effectiveUsed = isGroupMode && u.group_used ? u.group_used : u.used;
        const effectiveTotalUsed = isGroupMode && u.group_total_used !== undefined ? u.group_total_used : u.total_used;

        return (
          <div key={u.id} style={{
            marginBottom: 0,
            padding: '12px 16px',
            background: i % 2 === 0 ? '#f8f8f8' : 'white',
            borderRadius: i === 0 ? '6px 6px 0 0' : i === units.length - 1 ? '0 0 6px 6px' : 0,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#1a1a2e' }}>
                {u.name}
                {u.group && (
                  <span style={{ fontWeight: 400, color: '#666', marginLeft: 8 }}>
                    Group: {u.group.name}
                  </span>
                )}
              </h3>
              {isGroupMode && (
                <span style={{
                  fontSize: '0.75rem',
                  background: '#e9ecef',
                  padding: '2px 8px',
                  borderRadius: 10,
                  color: '#495057',
                }}>
                  {u.group ? 'Shared budget' : 'No group assigned'}
                </span>
              )}
            </div>

            {isGroupMode && !u.group && (
              <div style={{
                background: '#fff3cd',
                border: '1px solid #ffc107',
                borderRadius: 4,
                padding: '8px 12px',
                fontSize: '0.85rem',
                marginBottom: 8,
                color: '#856404',
              }}>
                This unit uses group limits but this student is not assigned to a group. Assign a group below to enable dispensing.
              </div>
            )}

            {materials.map((m) => (
              <UsageBar
                key={m.name}
                label={m.label}
                used={effectiveUsed[m.name] ?? 0}
                max={u.limits[m.name] ?? -1}
              />
            ))}
            {(u.total_limit ?? -1) !== -1 && (
              <UsageBar
                label="Overall"
                used={effectiveTotalUsed}
                max={u.total_limit}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
