import { useState, useEffect, useCallback } from 'react';
import type { ScanResult } from '../types.ts';
import { apiFetch } from '../hooks/useApi.ts';
import ScanInput from '../components/ScanInput.tsx';
import StudentCard from '../components/StudentCard.tsx';
import DispenseForm from '../components/DispenseForm.tsx';

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'found'; data: ScanResult }
  | { status: 'not-found'; studentId: string }
  | { status: 'error'; message: string };

const pageStyle: React.CSSProperties = {
  maxWidth: 700,
  margin: '0 auto',
  padding: '40px 20px',
};

export default function ScanPage() {
  const [state, setState] = useState<State>({ status: 'idle' });

  const reset = useCallback(() => setState({ status: 'idle' }), []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') reset();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [reset]);

  async function handleScan(studentId: string) {
    setState({ status: 'loading' });
    try {
      const result = await apiFetch<ScanResult>('/api/scan/lookup', {
        method: 'POST',
        body: JSON.stringify({ studentId }),
      });
      if (result.found) {
        setState({ status: 'found', data: result });
      } else {
        setState({ status: 'not-found', studentId });
      }
    } catch (err: unknown) {
      setState({ status: 'error', message: err instanceof Error ? err.message : 'Lookup failed' });
    }
  }

  function handleDispense() {
    // Re-fetch after dispense
    if (state.status === 'found' && state.data.student) {
      const sid = state.data.student.id;
      // Brief delay then re-scan
      setTimeout(() => handleScan(sid), 300);
      // Auto-reset after 3 seconds
      setTimeout(() => reset(), 3000);
    }
  }

  return (
    <div style={pageStyle}>
      <ScanInput onScan={handleScan} />

      <div style={{ marginTop: 32 }}>
        {state.status === 'loading' && (
          <p style={{ textAlign: 'center', fontSize: '1.2rem', color: '#666' }}>Looking up...</p>
        )}

        {state.status === 'not-found' && (
          <div
            style={{
              background: '#fff3cd',
              border: '1px solid #ffc107',
              borderRadius: 8,
              padding: 20,
              textAlign: 'center',
              fontSize: '1.1rem',
            }}
          >
            Student <strong>{state.studentId}</strong> not found in any group.
          </div>
        )}

        {state.status === 'error' && (
          <div
            style={{
              background: '#fce4e4',
              border: '1px solid #e63946',
              borderRadius: 8,
              padding: 20,
              textAlign: 'center',
              fontSize: '1.1rem',
              color: '#e63946',
            }}
          >
            {state.message}
          </div>
        )}

        {state.status === 'found' && state.data.student && state.data.groups && (
          <>
            <StudentCard student={state.data.student} groups={state.data.groups} />
            <DispenseForm
              groups={state.data.groups}
              studentId={state.data.student.id}
              onDispense={handleDispense}
            />
          </>
        )}
      </div>
    </div>
  );
}
