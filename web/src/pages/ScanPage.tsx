import { useState, useEffect, useCallback, useRef } from 'react';
import type { ScanResult, UnitUsage } from '../types.ts';
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

const INACTIVITY_TIMEOUT = 20_000;

export default function ScanPage() {
  const [state, setState] = useState<State>({ status: 'idle' });
  const [countdown, setCountdown] = useState<number | null>(null);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Group assignment state
  const [assigningUnit, setAssigningUnit] = useState<UnitUsage | null>(null);
  const [assignGroupId, setAssignGroupId] = useState<number>(0);
  const [availableGroups, setAvailableGroups] = useState<{ id: number; name: string }[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);

  const reset = useCallback(() => {
    setState({ status: 'idle' });
    setAssigningUnit(null);
    clearTimers();
  }, []);

  function clearTimers() {
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
      inactivityTimer.current = null;
    }
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current);
      countdownInterval.current = null;
    }
    setCountdown(null);
  }

  function startInactivityTimer() {
    clearTimers();
    const start = Date.now();
    setCountdown(Math.ceil(INACTIVITY_TIMEOUT / 1000));

    countdownInterval.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.ceil((INACTIVITY_TIMEOUT - elapsed) / 1000);
      if (remaining <= 0) {
        setCountdown(null);
      } else {
        setCountdown(remaining);
      }
    }, 500);

    inactivityTimer.current = setTimeout(() => {
      clearTimers();
      setState({ status: 'idle' });
      setAssigningUnit(null);
    }, INACTIVITY_TIMEOUT);
  }

  useEffect(() => {
    if (state.status !== 'found') return;

    function resetTimer() {
      startInactivityTimer();
    }

    window.addEventListener('click', resetTimer);
    window.addEventListener('keydown', resetTimer);
    return () => {
      window.removeEventListener('click', resetTimer);
      window.removeEventListener('keydown', resetTimer);
    };
  }, [state.status]);

  useEffect(() => {
    return () => clearTimers();
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') reset();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [reset]);

  async function handleScan(studentId: string) {
    clearTimers();
    setAssigningUnit(null);
    setState({ status: 'loading' });
    try {
      const result = await apiFetch<ScanResult>('/api/scan/lookup', {
        method: 'POST',
        body: JSON.stringify({ studentId }),
      });
      if (result.found) {
        setState({ status: 'found', data: result });
        startInactivityTimer();
      } else {
        setState({ status: 'not-found', studentId });
      }
    } catch (err: unknown) {
      setState({ status: 'error', message: err instanceof Error ? err.message : 'Lookup failed' });
    }
  }

  function handleDispense() {
    if (state.status === 'found' && state.data.student) {
      const sid = state.data.student.id;
      setTimeout(() => handleScan(sid), 300);
    }
  }

  async function handleStartAssign(unit: UnitUsage) {
    setAssigningUnit(unit);
    setAssignGroupId(0);
    try {
      const units = await apiFetch<any[]>('/api/units');
      const u = units.find((x: any) => x.id === unit.id);
      setAvailableGroups(u?.groups || []);
    } catch {
      setAvailableGroups([]);
    }
  }

  async function handleAssignGroup() {
    if (!assigningUnit || !assignGroupId || state.status !== 'found' || !state.data.student) return;
    setAssignLoading(true);
    try {
      await apiFetch('/api/scan/assign-group', {
        method: 'POST',
        body: JSON.stringify({
          studentId: state.data.student.id,
          unitId: assigningUnit.id,
          groupId: assignGroupId,
        }),
      });
      setAssigningUnit(null);
      // Re-scan to get updated data
      handleScan(state.data.student.id);
    } catch {
      // ignore
    } finally {
      setAssignLoading(false);
    }
  }

  return (
    <div style={pageStyle}>
      <ScanInput onScan={handleScan} autoFocus={state.status === 'idle'} />

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
            Student <strong>{state.studentId}</strong> not found in any unit.
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

        {state.status === 'found' && state.data.student && state.data.units && (
          <>
            <StudentCard student={state.data.student} units={state.data.units} />

            {/* Group assignment UI for ungrouped students in group-mode units */}
            {state.data.units
              .filter((u) => u.limit_type === 'group' && !u.group && !u._legacy)
              .map((u) => (
                <div key={`assign-${u.id}`} style={{
                  background: '#fff3cd',
                  border: '1px solid #ffc107',
                  borderRadius: 8,
                  padding: 16,
                  marginBottom: 16,
                }}>
                  {assigningUnit?.id === u.id ? (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600 }}>Assign group in {u.name}:</span>
                      <select
                        value={assignGroupId}
                        onChange={(e) => setAssignGroupId(Number(e.target.value))}
                        style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #ccc' }}
                      >
                        <option value={0}>Select group...</option>
                        {availableGroups.map((g) => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={handleAssignGroup}
                        disabled={!assignGroupId || assignLoading}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 4,
                          border: 'none',
                          background: !assignGroupId ? '#ccc' : '#2a9d8f',
                          color: 'white',
                          cursor: !assignGroupId ? 'not-allowed' : 'pointer',
                          fontWeight: 600,
                        }}
                      >
                        {assignLoading ? 'Assigning...' : 'Assign'}
                      </button>
                      <button
                        onClick={() => setAssigningUnit(null)}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 4,
                          border: '1px solid #ccc',
                          background: 'white',
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>No group assigned in <strong>{u.name}</strong> (group limit mode)</span>
                      <button
                        onClick={() => handleStartAssign(u)}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 4,
                          border: 'none',
                          background: '#4361ee',
                          color: 'white',
                          cursor: 'pointer',
                          fontWeight: 600,
                        }}
                      >
                        Assign Group
                      </button>
                    </div>
                  )}
                </div>
              ))}

            <DispenseForm
              units={state.data.units}
              studentId={state.data.student.id}
              onDispense={handleDispense}
            />
            {countdown !== null && (
              <p style={{ textAlign: 'center', marginTop: 16, color: '#999', fontSize: '0.85rem' }}>
                Clearing in {countdown}s — scan or click to stay
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
