import { useState, useEffect, useCallback, useRef } from 'react';
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

const INACTIVITY_TIMEOUT = 10_000;

export default function ScanPage() {
  const [state, setState] = useState<State>({ status: 'idle' });
  const [countdown, setCountdown] = useState<number | null>(null);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const reset = useCallback(() => {
    setState({ status: 'idle' });
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
    }, INACTIVITY_TIMEOUT);
  }

  // Reset timer on any user interaction while a student is displayed
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

  // Cleanup on unmount
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
