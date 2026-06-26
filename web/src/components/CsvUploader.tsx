import { useRef } from 'react';
import Papa from 'papaparse';

interface Props {
  onParsed: (rows: string[][]) => void;
}

export default function CsvUploader({ onParsed }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const fileNameRef = useRef<string>('');

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    fileNameRef.current = file.name;

    Papa.parse<string[]>(file, {
      complete(results) {
        onParsed(results.data);
      },
      skipEmptyLines: true,
    });
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        onChange={handleFile}
        style={{ fontSize: '1rem' }}
      />
      {fileNameRef.current && (
        <span style={{ marginLeft: 12, color: '#666' }}>{fileNameRef.current}</span>
      )}
    </div>
  );
}
