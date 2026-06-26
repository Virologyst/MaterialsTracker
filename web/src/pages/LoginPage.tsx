import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../hooks/useApi.ts';

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  background: '#f5f5f5',
};

const cardStyle: React.CSSProperties = {
  background: 'white',
  padding: 40,
  borderRadius: 8,
  boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
  width: 340,
  textAlign: 'center',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  fontSize: '1.1rem',
  border: '1px solid #ccc',
  borderRadius: 4,
  marginBottom: 16,
  boxSizing: 'border-box',
};

const buttonStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  fontSize: '1.1rem',
  background: '#4361ee',
  color: 'white',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  fontWeight: 600,
};

const errorStyle: React.CSSProperties = {
  color: '#e63946',
  marginBottom: 12,
  fontSize: '0.9rem',
};

export default function LoginPage() {
  const navigate = useNavigate();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'login' | 'set-pin'>('login');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await apiFetch<{ token: string }>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ pin }),
        });
        localStorage.setItem('auth_token', res.token);
        navigate('/');
      } else {
        await apiFetch<{ token: string }>('/api/auth/set-pin', {
          method: 'POST',
          body: JSON.stringify({ pin }),
        });
        // After setting PIN, log in with it
        const res = await apiFetch<{ token: string }>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ pin }),
        });
        localStorage.setItem('auth_token', res.token);
        navigate('/');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.toLowerCase().includes('pin') && message.toLowerCase().includes('set')) {
        setMode('set-pin');
        setError('No PIN has been set yet. Please set one now.');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h1 style={{ margin: '0 0 24px', fontSize: '1.5rem', color: '#1a1a2e' }}>
          Materials Tracker
        </h1>
        <form onSubmit={handleSubmit}>
          {error && <div style={errorStyle}>{error}</div>}
          <input
            style={inputStyle}
            type="password"
            placeholder={mode === 'login' ? 'Enter PIN' : 'Set a new PIN'}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            autoFocus
          />
          <button style={buttonStyle} type="submit" disabled={loading}>
            {loading ? '...' : mode === 'login' ? 'Login' : 'Set PIN'}
          </button>
        </form>
      </div>
    </div>
  );
}
