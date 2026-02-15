/**
 * AWS Signature V4 实现 (极简版)
 * 用于在 Edge Runtime 中不依赖 SDK 实现 R2 上传
 */

async function hmac(key: CryptoKey | ArrayBuffer, data: ArrayBuffer): Promise<ArrayBuffer> {
  const cryptoKey = key instanceof ArrayBuffer 
    ? await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    : key;
  return await crypto.subtle.sign('HMAC', cryptoKey, data);
}

async function hash(data: ArrayBuffer): Promise<ArrayBuffer> {
  return await crypto.subtle.digest('SHA-256', data);
}

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function uploadToR2({
  bucket,
  key,
  body,
  contentType,
  endpoint,
  accessKeyId,
  secretAccessKey,
}: {
  bucket: string;
  key: string;
  body: Uint8Array;
  contentType: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
}) {
  const url = new URL(`${endpoint}/${bucket}/${key}`);
  const method = 'PUT';
  const service = 's3';
  const region = 'auto';
  
  const datetime = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
  const date = datetime.slice(0, 8);
  
  const bodyHash = bufToHex(await hash(body.buffer as ArrayBuffer));
  
  const headers: Record<string, string> = {
    'host': url.host,
    'x-amz-content-sha256': bodyHash,
    'x-amz-date': datetime,
    'content-type': contentType,
  };
  
  const sortedHeaderKeys = Object.keys(headers).sort();
  const canonicalHeaders = sortedHeaderKeys.map(k => `${k}:${headers[k]}\n`).join('');
  const signedHeaders = sortedHeaderKeys.join(';');
  
  const canonicalRequest = [
    method,
    url.pathname,
    '',
    canonicalHeaders,
    signedHeaders,
    bodyHash
  ].join('\n');
  
  const credentialScope = `${date}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    datetime,
    credentialScope,
    bufToHex(await hash(new TextEncoder().encode(canonicalRequest).buffer as ArrayBuffer))
  ].join('\n');
  
  const kDate = await hmac(new TextEncoder().encode(`AWS4${secretAccessKey}`).buffer as ArrayBuffer, new TextEncoder().encode(date).buffer as ArrayBuffer);
  const kRegion = await hmac(kDate, new TextEncoder().encode(region).buffer as ArrayBuffer);
  const kService = await hmac(kRegion, new TextEncoder().encode(service).buffer as ArrayBuffer);
  const kSigning = await hmac(kService, new TextEncoder().encode('aws4_request').buffer as ArrayBuffer);
  
  const signature = bufToHex(await hmac(kSigning, new TextEncoder().encode(stringToSign).buffer as ArrayBuffer));
  
  const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  
  const response = await fetch(url.href, {
    method,
    headers: {
      ...headers,
      'Authorization': authHeader,
    },
    body: body as any,
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`R2 Upload failed: ${response.status} ${text}`);
  }
  
  return true;
}
