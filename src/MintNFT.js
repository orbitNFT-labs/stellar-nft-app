import React, { useState, useEffect } from 'react';
import { mintNFTWorkflow } from './mintNFTService';

function MintNFT({ walletAddress, onMintSuccess, onSuccess }) {
  const [artName, setArtName] = useState('');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusStep, setStatusStep] = useState('idle'); // 'idle' | 'uploading' | 'submitting' | 'success'
  const [statusText, setStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [mintResult, setMintResult] = useState(null);

  // Clean up object URL when component unmounts or file changes
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setErrorMessage('');
    }
  };

  const handleMint = async (e) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }

    setErrorMessage('');
    setMintResult(null);

    if (!walletAddress) {
      setErrorMessage('⚠️ Please connect your Freighter wallet first!');
      return;
    }

    if (!artName.trim()) {
      setErrorMessage('⚠️ Please enter an artwork title!');
      return;
    }

    if (!description.trim()) {
      setErrorMessage('⚠️ Please enter an artwork description!');
      return;
    }

    if (!imageFile) {
      setErrorMessage('⚠️ Please select an artwork image file to upload!');
      return;
    }

    try {
      setLoading(true);
      setStatusStep('uploading');
      setStatusText('Uploading to IPFS...');

      const result = await mintNFTWorkflow({
        file: imageFile,
        name: artName.trim(),
        description: description.trim(),
        walletAddress,
        onStatusUpdate: (status) => {
          setStatusText(status);
          if (status.includes('IPFS')) {
            setStatusStep('uploading');
          } else if (status.includes('Stellar')) {
            setStatusStep('submitting');
          } else if (status.includes('Success')) {
            setStatusStep('success');
          }
        },
      });

      setStatusStep('success');
      setStatusText('Minted Successfully!');
      setMintResult(result);

      if (typeof onMintSuccess === 'function') {
        onMintSuccess(result);
      }
      if (typeof onSuccess === 'function') {
        onSuccess(result);
      }
    } catch (err) {
      setStatusStep('idle');
      setStatusText('');
      setErrorMessage(err.message || 'Minting failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setArtName('');
    setDescription('');
    setImageFile(null);
    setPreviewUrl('');
    setLoading(false);
    setStatusStep('idle');
    setStatusText('');
    setErrorMessage('');
    setMintResult(null);
  };

  const getButtonText = () => {
    if (statusStep === 'uploading') {
      return '⏳ Uploading to IPFS...';
    }
    if (statusStep === 'submitting') {
      return '⏳ Submitting to Stellar Testnet...';
    }
    if (statusStep === 'success') {
      return '✅ Minted Successfully!';
    }
    return '🚀 Mint NFT';
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>🎨 Mint Your NFT</h2>
      <p style={styles.subtitle}>
        Upload digital artwork to IPFS and mint as a verifiable Stellar asset.
      </p>

      {/* Error Banner / Toast */}
      {errorMessage && (
        <div style={styles.errorBanner} role="alert">
          <div style={styles.errorContent}>
            <span>{errorMessage}</span>
            <button
              style={styles.closeErrorButton}
              onClick={() => setErrorMessage('')}
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Success View */}
      {mintResult && (
        <div style={styles.successCard}>
          <h3 style={styles.successTitle}>🎉 NFT Minted Successfully!</h3>
          <div style={styles.resultRow}>
            <span style={styles.resultLabel}>Asset Code:</span>
            <span style={styles.resultValue}>{mintResult.assetCode}</span>
          </div>
          <div style={styles.resultRow}>
            <span style={styles.resultLabel}>Metadata URI:</span>
            <span style={styles.resultValueSmall}>{mintResult.metadataUrl}</span>
          </div>
          {mintResult.hash && (
            <div style={styles.resultRow}>
              <span style={styles.resultLabel}>Transaction:</span>
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${mintResult.hash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.explorerLink}
              >
                {mintResult.hash.slice(0, 10)}...{mintResult.hash.slice(-8)} ↗
              </a>
            </div>
          )}
          <button style={styles.resetButton} onClick={handleReset}>
            ✨ Mint Another NFT
          </button>
        </div>
      )}

      {/* Mint Form */}
      {!mintResult && (
        <form onSubmit={handleMint}>
          {/* Artwork Title */}
          <div style={styles.field}>
            <label htmlFor="art-title-input" style={styles.label}>
              Artwork Title
            </label>
            <input
              id="art-title-input"
              style={styles.input}
              placeholder="e.g. Sunset in Lagos"
              value={artName}
              onChange={(e) => setArtName(e.target.value)}
              disabled={loading}
              maxLength={64}
            />
          </div>

          {/* Description */}
          <div style={styles.field}>
            <label htmlFor="art-desc-input" style={styles.label}>
              Description
            </label>
            <textarea
              id="art-desc-input"
              style={styles.textarea}
              placeholder="Describe your artwork, story, or edition..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
              maxLength={500}
            />
          </div>

          {/* Image File Selector */}
          <div style={styles.field}>
            <label htmlFor="art-file-input" style={styles.label}>
              Upload Artwork
            </label>
            <input
              id="art-file-input"
              type="file"
              accept="image/*"
              style={styles.fileInput}
              onChange={handleImageChange}
              disabled={loading}
            />
            {previewUrl && (
              <div style={styles.previewWrapper}>
                <img
                  src={previewUrl}
                  alt="Artwork preview"
                  style={styles.preview}
                />
              </div>
            )}
          </div>

          {/* Dynamic Action Button */}
          <button
            type="submit"
            onClick={handleMint}
            style={loading ? styles.buttonDisabled : styles.button}
            disabled={loading}
            aria-busy={loading}
          >
            {getButtonText()}
          </button>

          {/* Status Message */}
          {statusText && !errorMessage && !mintResult && (
            <p style={styles.statusText}>{statusText}</p>
          )}
        </form>
      )}
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: '#1a1a1a',
    borderRadius: '16px',
    padding: '28px',
    maxWidth: '460px',
    margin: '20px auto',
    border: '1px solid #2a2a2a',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
  },
  title: {
    color: '#a78bfa',
    textAlign: 'center',
    marginBottom: '8px',
    fontSize: '24px',
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#888888',
    textAlign: 'center',
    fontSize: '13px',
    marginBottom: '20px',
    lineHeight: '1.4',
  },
  field: {
    marginBottom: '18px',
  },
  label: {
    display: 'block',
    color: '#d4d4d4',
    fontSize: '13px',
    fontWeight: '600',
    marginBottom: '8px',
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '8px',
    border: '1px solid #333333',
    backgroundColor: '#0a0a0a',
    color: '#ffffff',
    fontSize: '14px',
    boxSizing: 'border-box',
    outline: 'none',
  },
  textarea: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '8px',
    border: '1px solid #333333',
    backgroundColor: '#0a0a0a',
    color: '#ffffff',
    fontSize: '14px',
    height: '90px',
    boxSizing: 'border-box',
    resize: 'vertical',
    outline: 'none',
  },
  fileInput: {
    color: '#a3a3a3',
    fontSize: '13px',
    width: '100%',
  },
  previewWrapper: {
    marginTop: '12px',
    borderRadius: '10px',
    overflow: 'hidden',
    border: '1px solid #333333',
    backgroundColor: '#0a0a0a',
  },
  preview: {
    width: '100%',
    maxHeight: '220px',
    objectFit: 'contain',
    display: 'block',
  },
  button: {
    backgroundColor: '#7c3aed',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '14px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    width: '100%',
    marginTop: '10px',
    transition: 'background-color 0.2s',
  },
  buttonDisabled: {
    backgroundColor: '#4c1d95',
    color: '#c4b5fd',
    border: 'none',
    borderRadius: '8px',
    padding: '14px',
    fontSize: '15px',
    fontWeight: '600',
    width: '100%',
    marginTop: '10px',
    cursor: 'not-allowed',
    opacity: 0.85,
  },
  statusText: {
    marginTop: '14px',
    color: '#f59e0b',
    fontSize: '13px',
    textAlign: 'center',
    whiteSpace: 'pre-line',
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid #ef4444',
    borderRadius: '8px',
    padding: '12px 14px',
    marginBottom: '18px',
  },
  errorContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    color: '#fca5a5',
    fontSize: '13px',
  },
  closeErrorButton: {
    background: 'none',
    border: 'none',
    color: '#fca5a5',
    cursor: 'pointer',
    fontSize: '14px',
    padding: '0 4px',
  },
  successCard: {
    backgroundColor: '#062d14',
    border: '1px solid #22c55e',
    borderRadius: '12px',
    padding: '20px',
    textAlign: 'left',
  },
  successTitle: {
    color: '#4ade80',
    fontSize: '18px',
    marginTop: 0,
    marginBottom: '16px',
    textAlign: 'center',
  },
  resultRow: {
    display: 'flex',
    flexDirection: 'column',
    marginBottom: '12px',
  },
  resultLabel: {
    color: '#86efac',
    fontSize: '12px',
    fontWeight: 'bold',
    marginBottom: '2px',
  },
  resultValue: {
    color: '#ffffff',
    fontSize: '14px',
    fontFamily: 'monospace',
  },
  resultValueSmall: {
    color: '#e2e8f0',
    fontSize: '11px',
    fontFamily: 'monospace',
    wordBreak: 'break-all',
  },
  explorerLink: {
    color: '#93c5fd',
    fontSize: '13px',
    fontFamily: 'monospace',
    textDecoration: 'underline',
  },
  resetButton: {
    backgroundColor: '#16a34a',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '12px',
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: 'pointer',
    width: '100%',
    marginTop: '12px',
  },
};

export default MintNFT;
