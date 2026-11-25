/**
 * anchor-cli-key.ts — variant of anchor-cli.ts for accounts that hold a
 * PRIVATE_KEY + QORE_PQC_RECOVERY_CODE instead of a mnemonic (the QDay Pay
 * Agent account qor18tzl... was created that way, so it has no mnemonic).
 *
 * Derives the same unified account the Workshop 1 flow uses, then broadcasts
 * the same anchor tx as anchor-cli.ts: a 1,000 uqor self-send carrying the
 * certificate digest in its memo, hybrid-signed (secp256k1 + ML-DSA-87).
 *
 * Env: PRIVATE_KEY, QORE_PQC_RECOVERY_CODE (e.g. tsx --env-file=<agent .env>).
 */
import { StargateClient } from '@cosmjs/stargate';
import {
  EthNativeSigner,
  isValidRecoveryCode,
  unifiedAccountFromSeed,
  type UnifiedAccount,
} from '@qorechain/sdk';
import { buildAnchorMemo, issueSignedCertificate } from '../src/cert.ts';

const REST = 'https://api-testnet.qore.host';
const RPC = 'https://rpc-testnet.qore.host';
const CHAIN_ID = 'qorechain-diana';
/** Native-lane fee: hybrid transactions are large, so the gas limit is generous. */
const FEE = { amount: [{ denom: 'uqor', amount: '100000' }], gas: '800000' };

function account(): UnifiedAccount {
  const key = process.env.PRIVATE_KEY?.trim();
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error('Set PRIVATE_KEY as 0x followed by 64 hex characters in env');
  }
  const recoveryCode = process.env.QORE_PQC_RECOVERY_CODE?.trim();
  if (!recoveryCode || !isValidRecoveryCode(recoveryCode)) {
    throw new Error('Set a valid QORE_PQC_RECOVERY_CODE in env');
  }
  return unifiedAccountFromSeed(Uint8Array.from(Buffer.from(key.slice(2), 'hex')), { recoveryCode });
}

async function accountSequence(address: string): Promise<{ accountNumber: bigint; sequence: bigint }> {
  const res = await fetch(`${REST}/cosmos/auth/v1beta1/accounts/${address}`);
  if (!res.ok) throw new Error(`account query failed: HTTP ${res.status}`);
  const body = (await res.json()) as { account?: Record<string, unknown> };
  const acc = (body.account?.base_account ?? body.account ?? {}) as Record<string, string>;
  return { accountNumber: BigInt(acc.account_number ?? '0'), sequence: BigInt(acc.sequence ?? '0') };
}

async function main() {
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

  const acc = account();
  console.log('Account:', acc.cosmos);
  const { accountNumber, sequence } = await accountSequence(acc.cosmos);
  const signer = new EthNativeSigner(acc, { signMode: 'hybrid', rest: REST });
  const transport = await StargateClient.connect(RPC);
  try {
    const res = await signer.signAndBroadcast(transport, {
      chainId: CHAIN_ID,
      accountNumber,
      sequence,
      fee: FEE,
      memo,
      messages: [
        {
          typeUrl: '/cosmos.bank.v1beta1.MsgSend',
          value: {
            fromAddress: acc.cosmos,
            toAddress: acc.cosmos,
            amount: [{ denom: 'uqor', amount: '1000' }],
          },
        },
      ],
    });
    console.log('Broadcasted hybrid-signed txHash:', res.transactionHash);
  } finally {
    transport.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
