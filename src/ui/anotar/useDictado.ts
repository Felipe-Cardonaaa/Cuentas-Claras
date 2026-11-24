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

const MENSAJES: Record<string, string> = {
  'not-allowed': 'El celular no dio permiso al micrófono. En Ajustes → Safari → Micrófono elige "Permitir", o usa el micrófono del teclado.',
  'service-not-allowed': 'El dictado está apagado. Actívalo en Ajustes → General → Teclado → Activar dictado, o usa el micrófono del teclado.',
  network: 'Sin señal no se puede dictar aquí. Usa el micrófono del teclado o escribe la venta.',
  'no-speech': 'No te escuché. Toca el micrófono y habla cerca del celular.',
  'audio-capture': 'No encontré el micrófono. Usa el micrófono del teclado o escribe la venta.',
};

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
    r.onerror = (e) => {
      if (e.error === 'aborted') return;
      setError(MENSAJES[e.error] ?? 'El micrófono no funcionó. Usa el micrófono del teclado o escribe la venta.');
      setEscuchando(false);
    };
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
