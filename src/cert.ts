import { mldsa87, pubkeyHash, shake256 } from '@qorechain/pqc';

export interface CertificateClaims {
  recipient: string;
  title: string;
  issuer: string;
  recipientAddress?: string;
  issuedAt: string;
  network: 'testnet';
}

export interface SignedCertificate {
  version: 'qorecert-v1';
  algorithm: 'ML-DSA-87';
  claims: CertificateClaims;
  digestHex: string;
  pubkeyHashHex: string;
  publicKeyHex: string;
  signatureHex: string;
  anchorTxHash?: string;
}

const encoder = new TextEncoder();

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function fromHex(hex: string): Uint8Array {
  const clean = hex.trim().toLowerCase();
  if (clean.length % 2 !== 0 || !/^[0-9a-f]*$/.test(clean)) {
    throw new Error('Invalid hex string');
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function canonicalClaimsBytes(claims: CertificateClaims): Uint8Array {
  const ordered = {
    issuedAt: claims.issuedAt.trim(),
    issuer: claims.issuer.trim(),
    network: claims.network,
    recipient: claims.recipient.trim(),
    recipientAddress: (claims.recipientAddress ?? '').trim(),
    title: claims.title.trim(),
  };
  return encoder.encode(JSON.stringify(ordered));
}

export function computeCertificateDigest(claims: CertificateClaims): string {
  return toHex(shake256(canonicalClaimsBytes(claims), 32));
}

export function issueSignedCertificate(
  claims: CertificateClaims,
  seed?: Uint8Array,
): SignedCertificate {
  const keys = mldsa87.keygen(seed);
  const payload = canonicalClaimsBytes(claims);
  const digestHex = toHex(shake256(payload, 32));
  const signature = mldsa87.sign(keys.secretKey, payload);
  return {
    version: 'qorecert-v1',
    algorithm: 'ML-DSA-87',
    claims: {
      ...claims,
      recipient: claims.recipient.trim(),
      title: claims.title.trim(),
      issuer: claims.issuer.trim(),
      recipientAddress: claims.recipientAddress?.trim() || '',
    },
    digestHex,
    pubkeyHashHex: toHex(pubkeyHash(keys.publicKey, 20)),
    publicKeyHex: toHex(keys.publicKey),
    signatureHex: toHex(signature),
  };
}

export interface VerifyResult {
  valid: boolean;
  digestMatch: boolean;
  pubkeyHashMatch: boolean;
  signatureValid: boolean;
  reason: string;
}

export function verifySignedCertificate(cert: SignedCertificate): VerifyResult {
  try {
    if (cert.version !== 'qorecert-v1' || cert.algorithm !== 'ML-DSA-87') {
      return {
        valid: false,
        digestMatch: false,
        pubkeyHashMatch: false,
        signatureValid: false,
        reason: 'Unsupported certificate version or algorithm',
      };
    }
    const payload = canonicalClaimsBytes(cert.claims);
    const expectedDigest = toHex(shake256(payload, 32));
    const digestMatch = expectedDigest === cert.digestHex;

    const pub = fromHex(cert.publicKeyHex);
    const sig = fromHex(cert.signatureHex);
    const expectedPubHash = toHex(pubkeyHash(pub, 20));
    const pubkeyHashMatch = expectedPubHash === cert.pubkeyHashHex;

    const signatureValid = mldsa87.verify(pub, payload, sig);
    const valid = digestMatch && pubkeyHashMatch && signatureValid;

    return {
      valid,
      digestMatch,
      pubkeyHashMatch,
      signatureValid,
      reason: valid
        ? 'Valid ML-DSA-87 (FIPS-204) signature and SHAKE-256 digest'
        : !digestMatch
          ? 'TAMPER_DETECTED: Certificate claims do not match SHAKE-256 digest'
          : !pubkeyHashMatch
            ? 'KEY_MISMATCH: Public key does not match pubkeyHash'
            : 'INVALID_SIGNATURE: ML-DSA-87 verification failed',
    };
  } catch (err) {
    return {
      valid: false,
      digestMatch: false,
      pubkeyHashMatch: false,
      signatureValid: false,
      reason: err instanceof Error ? err.message : 'Verification error',
    };
  }
}

export function buildAnchorMemo(cert: SignedCertificate): string {
  return `QoreCert:v1:${cert.digestHex.slice(0, 32)}:${cert.pubkeyHashHex.slice(0, 16)}`;
}
