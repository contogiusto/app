/** Aiuti per i test dello staff: un JWT finto (solo il payload conta, la firma non si verifica). */
export function fakeJwt(expiresInSeconds: number, now = Date.now()): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  const exp = Math.floor(now / 1000) + expiresInSeconds
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: '1', exp })}.firma`
}
