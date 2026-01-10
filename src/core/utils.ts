export const getTimestamp = () => Math.floor(Date.now() / 1000);

export const base64ToArrayBuffer = (base64: string) => {
  const binaryString = atob(base64);
  const length = binaryString.length;
  const buffer = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    buffer[i] = binaryString.charCodeAt(i);
  }
  return buffer;
};

export const newShortUUID = async () => {
  const uuid = crypto.randomUUID();
  const hashBuffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(uuid),
  );
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  return btoa(String.fromCharCode(...hashArray))
    .replace(/[^a-zA-Z0-9]|[lIO01]/g, '')
    .slice(0, 22);
};

const constantTimeCompare = (a: string, b: string) => {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
};

export const validateBasicAuth = (authHeader?: string, basicAuth?: string) => {
  if (basicAuth) {
    if (typeof authHeader !== 'string' || !authHeader.startsWith('Basic ')) {
      return false;
    }
    const received = authHeader.slice(6); // Remove 'Basic ' prefix
    const expected = btoa(`${basicAuth}`);
    return constantTimeCompare(received, expected);
  }
  return true;
};
