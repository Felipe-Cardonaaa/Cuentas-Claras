const ITERACIONES = 100_000;

const aHex = (b: ArrayBuffer | Uint8Array) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const deHex = (h: string) => new Uint8Array(h.match(/../g)!.map((x) => parseInt(x, 16)));

export async function hashPin(pin: string, sal?: string): Promise<{ hash: string; sal: string }> {
  const salHex = sal ?? aHex(crypto.getRandomValues(new Uint8Array(16)));
  const llave = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: deHex(salHex), iterations: ITERACIONES }, llave, 256,
  );
  return { hash: aHex(bits), sal: salHex };
}

export async function verificarPin(pin: string, hash: string, sal: string): Promise<boolean> {
  return (await hashPin(pin, sal)).hash === hash;
}

export const pinValido = (pin: string) => /^\d{4}$/.test(pin);
