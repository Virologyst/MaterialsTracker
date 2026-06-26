import { useRef, useEffect, type FormEvent } from 'react';

interface Props {
  onScan: (studentId: string) => void;
  autoFocus?: boolean;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '16px 20px',
  fontSize: '2rem',
  border: '2px solid #ccc',
  borderRadius: 8,
  textAlign: 'center',
  boxSizing: 'border-box',
  outline: 'none',
};

export default function ScanInput({ onScan, autoFocus = true }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    if (!autoFocus) return;

    function refocus() {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }

    const el = inputRef.current;
    el?.addEventListener('blur', refocus);
    return () => el?.removeEventListener('blur', refocus);
  }, [autoFocus]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const val = inputRef.current?.value.trim();
    if (val) {
      onScan(val);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 600, margin: '0 auto' }}>
      <input
        ref={inputRef}
        style={inputStyle}
        type="text"
        placeholder="Scan student barcode..."
      />
    </form>
  );
}
