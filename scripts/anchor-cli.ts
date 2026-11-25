import { createClient } from '@qorechain/sdk';
import { buildAnchorMemo, issueSignedCertificate } from '../src/cert.ts';

async function main() {
  const mnemonic = process.env.QORE_MNEMONIC;
  if (!mnemonic) {
    console.error('Set QORE_MNEMONIC in env to broadcast a real hybrid-signed anchor tx on testnet.');
    process.exit(1);
  }

  const cert = issueSignedCertificate({
    recipient: 'Build Before Q-Day Judge',
    title: 'QoreCert Quantum Pass On-Chain Verification',
    issuer: 'QoreCert Testnet Authority',
    issuedAt: new Date().toISOString(),
    network: 'testnet',
  });

  const memo = buildAnchorMemo(cert);
  console.log('Issued ML-DSA-87 cert digest:', cert.digestHex);
  console.log('Anchor memo:', memo);

  const client = await createClient({ network: 'testnet' });
  const txClient = await client.connectWithMnemonic(mnemonic);
  const res = await txClient.sendTokens(txClient.address, [{ denom: 'uqor', amount: '1000' }], { memo });
  console.log('Broadcasted hybrid-signed txHash:', res.transactionHash);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
