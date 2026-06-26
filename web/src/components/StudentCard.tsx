import { useState, useEffect } from 'react';
import type { Student, GroupUsage, Material } from '../types.ts';
import { apiFetch } from '../hooks/useApi.ts';
import UsageBar from './UsageBar.tsx';

interface Props {
  student: Student;
  groups: GroupUsage[];
}

const cardStyle: React.CSSProperties = {
  background: 'white',
  border: '1px solid #ddd',
  borderRadius: 8,
  padding: 20,
  marginBottom: 16,
};

export default function StudentCard({ student, groups }: Props) {
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

      {groups.map((g) => (
        <div key={g.id} style={{ marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '1rem', color: '#1a1a2e' }}>
            {g.name}
          </h3>
          {materials.map((m) => (
            <UsageBar
              key={m.name}
              label={m.label}
              used={g.used[m.name] ?? 0}
              max={g.limits[m.name] ?? -1}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
