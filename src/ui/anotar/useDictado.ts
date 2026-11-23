import { useCallback, useRef, useState } from 'react';

interface Reconocimiento {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
}
type Constructor = new () => Reconocimiento;

function constructorVoz(): Constructor | null {
  const w = window as unknown as { SpeechRecognition?: Constructor; webkitSpeechRecognition?: Constructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useDictado() {
  const disponible = constructorVoz() !== null;
  const [escuchando, setEscuchando] = useState(false);
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const actual = useRef<Reconocimiento | null>(null);

  const iniciar = useCallback(() => {
    const C = constructorVoz();
    if (!C) return;
    const r = new C();
    r.lang = 'es-CO';
    r.interimResults = false;
    r.onresult = (e) => {
      const partes = Array.from(e.results).map((x) => x[0].transcript);
      setTexto(partes.join(' ').trim());
    };
    r.onerror = (e) => setError(e.error === 'network' ? 'Sin señal: escribe la venta' : 'No te escuché bien, intenta otra vez');
    r.onend = () => setEscuchando(false);
    actual.current = r;
    setError(null);
    setTexto('');
    setEscuchando(true);
    r.start();
  }, []);

  const detener = useCallback(() => actual.current?.stop(), []);

  return { disponible, escuchando, iniciar, detener, texto, error };
}
