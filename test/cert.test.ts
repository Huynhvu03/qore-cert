import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAnchorMemo,
  computeCertificateDigest,
  issueSignedCertificate,
  verifySignedCertificate,
} from '../src/cert.ts';

const baseClaims = {
  recipient: 'Alice Nguyen',
  title: 'Build Before Q-Day — Post-Quantum Builder',
  issuer: 'QoreCert Testnet Authority',
  recipientAddress: 'qor1nhd7zpadcmg39mfzvz3wwg9nyp9t3s54zu3c4m',
  issuedAt: '2026-11-25T12:00:00.000Z',
  network: 'testnet' as const,
};

test('issues and verifies a valid ML-DSA-87 certificate', () => {
  const seed = new Uint8Array(32).fill(7);
  const cert = issueSignedCertificate(baseClaims, seed);

  assert.equal(cert.algorithm, 'ML-DSA-87');
  assert.equal(cert.publicKeyHex.length, 2592 * 2);
  assert.equal(cert.signatureHex.length, 4627 * 2);

  const res = verifySignedCertificate(cert);
  assert.equal(res.valid, true);
  assert.equal(res.digestMatch, true);
  assert.equal(res.pubkeyHashMatch, true);
  assert.equal(res.signatureValid, true);
});

test('computes deterministic SHAKE-256 digest regardless of whitespace', () => {
  const d1 = computeCertificateDigest(baseClaims);
  const d2 = computeCertificateDigest({
    ...baseClaims,
    recipient: '  Alice Nguyen  ',
    title: ' Build Before Q-Day — Post-Quantum Builder ',
  });
  assert.equal(d1, d2);
});

test('fails closed when any claim field is tampered', () => {
  const cert = issueSignedCertificate(baseClaims, new Uint8Array(32).fill(9));
  const tampered = {
    ...cert,
    claims: { ...cert.claims, recipient: 'Bob Tampered' },
  };
  const res = verifySignedCertificate(tampered);
  assert.equal(res.valid, false);
  assert.equal(res.digestMatch, false);
  assert.equal(res.signatureValid, false);
});

test('fails closed when signature bytes are modified', () => {
  const cert = issueSignedCertificate(baseClaims, new Uint8Array(32).fill(11));
  const badSig = (cert.signatureHex[0] === '0' ? '1' : '0') + cert.signatureHex.slice(1);
  const res = verifySignedCertificate({ ...cert, signatureHex: badSig });
  assert.equal(res.valid, false);
  assert.equal(res.signatureValid, false);
});

test('builds compact on-chain anchor memo', () => {
  const cert = issueSignedCertificate(baseClaims, new Uint8Array(32).fill(5));
  const memo = buildAnchorMemo(cert);
  assert.ok(memo.startsWith('QoreCert:v1:'));
  assert.ok(memo.length < 80);
});
