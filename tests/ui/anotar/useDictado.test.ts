import { act, renderHook } from '@testing-library/react';
import { useDictado } from '../../../src/ui/anotar/useDictado';

class ReconocimientoFalso {
  static ultimo: ReconocimientoFalso;
  lang = '';
  interimResults = false;
  onresult: ((e: { results: { 0: { transcript: string } }[] }) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  constructor() { ReconocimientoFalso.ultimo = this; }
  start() {}
  stop() { this.onend?.(); }
}

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
});

it('convierte lo dictado en texto en español de Colombia', () => {
  (window as unknown as Record<string, unknown>).webkitSpeechRecognition = ReconocimientoFalso;
  const { result } = renderHook(() => useDictado());
  expect(result.current.disponible).toBe(true);
  act(() => result.current.iniciar());
  expect(ReconocimientoFalso.ultimo.lang).toBe('es-CO');
  act(() => {
    ReconocimientoFalso.ultimo.onresult?.({ results: [{ 0: { transcript: 'Marta abonó 40.000' } }] });
    ReconocimientoFalso.ultimo.onend?.();
  });
  expect(result.current.texto).toBe('Marta abonó 40.000');
  expect(result.current.escuchando).toBe(false);
});

it('sin reconocimiento de voz no está disponible', () => {
  const { result } = renderHook(() => useDictado());
  expect(result.current.disponible).toBe(false);
});
