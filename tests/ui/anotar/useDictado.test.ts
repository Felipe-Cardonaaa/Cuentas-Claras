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

describe('errores del micrófono', () => {
  it.each([
    ['not-allowed', 'El celular no dio permiso al micrófono. En Ajustes → Safari → Micrófono elige "Permitir", o usa el micrófono del teclado.'],
    ['service-not-allowed', 'El dictado está apagado. Actívalo en Ajustes → General → Teclado → Activar dictado, o usa el micrófono del teclado.'],
    ['network', 'Sin señal no se puede dictar aquí. Usa el micrófono del teclado o escribe la venta.'],
    ['no-speech', 'No te escuché. Toca el micrófono y habla cerca del celular.'],
  ])('%s muestra la causa y deja de escuchar', (codigo, mensaje) => {
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = ReconocimientoFalso;
    const { result } = renderHook(() => useDictado());
    act(() => result.current.iniciar());
    act(() => ReconocimientoFalso.ultimo.onerror?.({ error: codigo }));
    expect(result.current.error).toBe(mensaje);
    expect(result.current.escuchando).toBe(false);
  });
});
