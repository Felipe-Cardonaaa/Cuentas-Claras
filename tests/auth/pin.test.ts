import { hashPin, verificarPin } from '../../src/auth/pin';

it('verifica el PIN correcto y rechaza otro', async () => {
  const { hash, sal } = await hashPin('1234');
  expect(await verificarPin('1234', hash, sal)).toBe(true);
  expect(await verificarPin('9999', hash, sal)).toBe(false);
});

it('dos hashes del mismo PIN usan sal distinta', async () => {
  const a = await hashPin('1234');
  const b = await hashPin('1234');
  expect(a.sal).not.toBe(b.sal);
  expect(a.hash).not.toBe(b.hash);
});
