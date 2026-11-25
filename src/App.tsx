import { useState } from 'react';
import {
  ConnectButton,
  PqcStatusBadge,
  QuantumSafeBadge,
  useAccount,
  useBalance,
  usePqcStatus,
  useTx,
} from '@qorechain/react';
import {
  buildAnchorMemo,
  issueSignedCertificate,
  SignedCertificate,
  VerifyResult,
  verifySignedCertificate,
} from './cert';

export default function App() {
  const { address, isConnected } = useAccount();
  const balance = useBalance(address, { denom: 'uqor' });
  const pqc = usePqcStatus(address);
  const tx = useTx();

  const [tab, setTab] = useState<'issue' | 'verify'>('issue');
  const [recipient, setRecipient] = useState('Alice Nguyen');
  const [title, setTitle] = useState('Build Before Q-Day — Post-Quantum Builder');
  const [issuer, setIssuer] = useState('QoreCert Testnet Authority');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [cert, setCert] = useState<SignedCertificate | null>(null);
  const [verifyInput, setVerifyInput] = useState('');
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [anchorStatus, setAnchorStatus] = useState<string>('');

  function handleIssue(e: React.FormEvent) {
    e.preventDefault();
    const issued = issueSignedCertificate({
      recipient,
      title,
      issuer,
      recipientAddress: recipientAddress || address || '',
      issuedAt: new Date().toISOString(),
      network: 'testnet',
    });
    setCert(issued);
    setVerifyInput(JSON.stringify(issued, null, 2));
    setVerifyResult(verifySignedCertificate(issued));
    setAnchorStatus('');
  }

  async function handleAnchorOnChain() {
    if (!cert || !address) return;
    try {
      setAnchorStatus('Broadcasting hybrid-signed anchor tx on QoreChain Testnet...');
      const memo = buildAnchorMemo(cert);
      const res = await tx.sendTokens(address, [{ denom: 'uqor', amount: '1000' }], { memo });
      const updated: SignedCertificate = { ...cert, anchorTxHash: res.transactionHash };
      setCert(updated);
      setVerifyInput(JSON.stringify(updated, null, 2));
      setAnchorStatus(`Anchored on-chain! TxHash: ${res.transactionHash}`);
    } catch (err) {
      setAnchorStatus(err instanceof Error ? err.message : 'Anchor failed');
    }
  }

  function handleVerify() {
    try {
      const parsed = JSON.parse(verifyInput) as SignedCertificate;
      setVerifyResult(verifySignedCertificate(parsed));
    } catch {
      setVerifyResult({
        valid: false,
        digestMatch: false,
        pubkeyHashMatch: false,
        signatureValid: false,
        reason: 'Invalid JSON certificate payload',
      });
    }
  }

  const qorDisplay = balance.data
    ? `${(Number(balance.data.amount) / 1_000_000).toFixed(4)} QOR`
    : balance.isLoading
      ? 'Loading...'
      : '—';

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <span className="eyebrow">QoreChain Testnet (diana) • Quantum Pass</span>
          <h1>QoreCert</h1>
          <p className="sub">
            Post-Quantum Signed Certificates (ML-DSA-87 FIPS-204 + SHAKE-256) with On-Chain Hybrid Anchoring
          </p>
        </div>
        <div className="walletBox">
          <ConnectButton />
          <div className="badges">
            <PqcStatusBadge />
            <QuantumSafeBadge />
          </div>
          {isConnected && (
            <div className="meta">
              <div>Address: <code>{address}</code></div>
              <div>Balance: <strong>{qorDisplay}</strong></div>
              <div>PQC Key: <strong>{pqc.data?.registered ? 'Registered on-chain' : 'Checking / Unregistered'}</strong></div>
            </div>
          )}
        </div>
      </header>

      <nav className="tabs">
        <button className={tab === 'issue' ? 'active' : ''} onClick={() => setTab('issue')}>
          1. Issue & Anchor Certificate
        </button>
        <button className={tab === 'verify' ? 'active' : ''} onClick={() => setTab('verify')}>
          2. Verify / Tamper Check
        </button>
      </nav>

      {tab === 'issue' ? (
        <main className="grid">
          <section className="card">
            <h2>Issue ML-DSA-87 Certificate</h2>
            <form onSubmit={handleIssue} className="form">
              <label>
                Recipient Name
                <input value={recipient} onChange={(e) => setRecipient(e.target.value)} required />
              </label>
              <label>
                Certificate Title / Credential
                <input value={title} onChange={(e) => setTitle(e.target.value)} required />
              </label>
              <label>
                Issuer Organization
                <input value={issuer} onChange={(e) => setIssuer(e.target.value)} required />
              </label>
              <label>
                Recipient QoreChain Address (optional)
                <input
                  placeholder={address || 'qor1...'}
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                />
              </label>
              <button type="submit" className="primary">
                Sign with ML-DSA-87 (FIPS-204)
              </button>
            </form>
          </section>

          <section className="card">
            <h2>Signed Certificate & Testnet Anchor</h2>
            {!cert ? (
              <p className="muted">Fill the form and click Sign to generate a 4,627-byte ML-DSA-87 certificate.</p>
            ) : (
              <div className="certView">
                <div className="pill ok">ML-DSA-87 Signed • SHAKE-256 Digest</div>
                <p><strong>Recipient:</strong> {cert.claims.recipient}</p>
                <p><strong>Title:</strong> {cert.claims.title}</p>
                <p><strong>Digest:</strong> <code>{cert.digestHex.slice(0, 32)}...</code></p>
                <p><strong>PubKey Hash:</strong> <code>{cert.pubkeyHashHex}</code></p>
                <p><strong>Signature Size:</strong> {cert.signatureHex.length / 2} bytes</p>
                {cert.anchorTxHash && (
                  <p><strong>On-Chain TxHash:</strong> <code>{cert.anchorTxHash}</code></p>
                )}
                <div className="actions">
                  <button
                    type="button"
                    className="primary"
                    disabled={!isConnected || tx.status === 'pending'}
                    onClick={handleAnchorOnChain}
                  >
                    {isConnected ? 'Anchor on QoreChain Testnet (Hybrid TX)' : 'Connect QoreX to Anchor'}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(JSON.stringify(cert, null, 2))}
                  >
                    Copy Signed JSON
                  </button>
                </div>
                {anchorStatus && <p className="statusMsg">{anchorStatus}</p>}
              </div>
            )}
          </section>
        </main>
      ) : (
        <main className="card">
          <h2>Verify Signed Certificate (Offline FIPS-204 Check)</h2>
          <p className="muted">
            Paste any QoreCert JSON below (try editing 1 character in <code>recipient</code> or <code>title</code> to see fail-closed tamper detection).
          </p>
          <textarea
            rows={12}
            value={verifyInput}
            onChange={(e) => setVerifyInput(e.target.value)}
            placeholder="Paste QoreCert JSON..."
          />
          <div className="actions">
            <button type="button" className="primary" onClick={handleVerify}>
              Verify ML-DSA-87 Signature
            </button>
          </div>
          {verifyResult && (
            <div className={`verifyBox ${verifyResult.valid ? 'valid' : 'invalid'}`}>
              <strong>{verifyResult.valid ? 'QUANTUM-SAFE VERIFIED' : 'VERIFICATION FAILED'}</strong>
              <p>{verifyResult.reason}</p>
              <ul>
                <li>SHAKE-256 Digest Match: {verifyResult.digestMatch ? 'PASS' : 'FAIL'}</li>
                <li>Pubkey Hash Match: {verifyResult.pubkeyHashMatch ? 'PASS' : 'FAIL'}</li>
                <li>ML-DSA-87 Signature: {verifyResult.signatureValid ? 'PASS' : 'FAIL'}</li>
              </ul>
            </div>
          )}
        </main>
      )}
    </div>
  );
}
