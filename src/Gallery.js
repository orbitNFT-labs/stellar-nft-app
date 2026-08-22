import React, { useState, useEffect, useCallback } from 'react';
import { getWalletNFTs, ipfsUriToUrl } from './contract';

// ─────────────────────────────────────────────────────────────────────────────
// NFT Card — renders a single NFT with broken-image fallback
// ─────────────────────────────────────────────────────────────────────────────
function NFTCard({ nft, onClick }) {
  const [imgError, setImgError] = useState(false);

  const imageUrl = !imgError ? ipfsUriToUrl(nft.imageUri) : null;
  const showPlaceholder = !imageUrl || nft.metadataError || imgError;

  return (
    <div style={styles.card} onClick={() => onClick(nft)} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick(nft)}
      aria-label={`View details for ${nft.name}`}
    >
      {showPlaceholder ? (
        <div style={styles.imagePlaceholder} role="img" aria-label={nft.name}>
          <span style={styles.imagePlaceholderIcon}>🖼️</span>
        </div>
      ) : (
        <img
          src={imageUrl}
          alt={nft.name}
          style={styles.image}
          onError={() => setImgError(true)}
        />
      )}
      <div style={styles.cardBody}>
        <h3 style={styles.nftName}>{nft.name}</h3>
        {nft.description ? (
          <p style={styles.nftDesc}>{nft.description}</p>
        ) : null}
        {nft.metadataError && (
          <p style={styles.metaError}>⚠️ Metadata unavailable</p>
        )}
        <p style={styles.nftId}>🔢 Token #{nft.id}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NFT Detail Modal
// ─────────────────────────────────────────────────────────────────────────────
function NFTModal({ nft, onClose }) {
  const [imgError, setImgError] = useState(false);

  if (!nft) return null;

  const imageUrl = !imgError ? ipfsUriToUrl(nft.imageUri) : null;
  const showPlaceholder = !imageUrl || imgError;

  return (
    <div style={styles.modal} role="dialog" aria-modal="true"
      aria-label={`NFT detail: ${nft.name}`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={styles.modalContent}>
        {showPlaceholder ? (
          <div style={styles.modalImagePlaceholder} role="img" aria-label={nft.name}>
            <span style={styles.imagePlaceholderIcon}>🖼️</span>
          </div>
        ) : (
          <img
            src={imageUrl}
            alt={nft.name}
            style={styles.modalImage}
            onError={() => setImgError(true)}
          />
        )}
        <h2 style={styles.modalTitle}>{nft.name}</h2>
        {nft.description ? (
          <p style={styles.modalDesc}>{nft.description}</p>
        ) : null}
        {nft.metadataError && (
          <p style={styles.metaError}>⚠️ On-chain metadata could not be loaded.</p>
        )}
        <p style={styles.modalId}>🔢 Token ID: {nft.id}</p>
        <button style={styles.closeButton} onClick={onClose} aria-label="Close dialog">
          ✕ Close
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Gallery — main component
// ─────────────────────────────────────────────────────────────────────────────
function Gallery({ walletAddress }) {
import React, { useState, useEffect } from 'react';
import NFTCardSkeleton from './NFTCardSkeleton';

// Sample NFT data (will be replaced with real Stellar data later)
export const sampleNFTs = [
  {
    id: 1,
    name: 'Sunset in Lagos',
    description: 'A beautiful sunset over Lagos city',
    image: 'https://picsum.photos/300/300?random=1',
    owner: 'GBXY...3456',
    minted: 'Jun 19, 2026',
  },
  {
    id: 2,
    name: 'African Patterns',
    description: 'Traditional African art patterns',
    image: 'https://picsum.photos/300/300?random=2',
    owner: 'GBXY...3456',
    minted: 'Jun 19, 2026',
  },
  {
    id: 3,
    name: 'Stellar Universe',
    description: 'The beauty of the Stellar blockchain',
    image: 'https://picsum.photos/300/300?random=3',
    owner: 'GBXY...3456',
    minted: 'Jun 19, 2026',
  },
];

const SKELETON_COUNT = 6;

function Gallery({ skeletonCount = SKELETON_COUNT } = {}) {
  const [nfts, setNfts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  /**
   * Load (or reload) the wallet's NFTs.
   * @param {boolean} isRefresh - true when triggered by pull-to-refresh; shows
   *   a lighter "refreshing" indicator rather than the full loading skeleton.
   */
  const loadNFTs = useCallback(
    async (isRefresh = false) => {
      if (!walletAddress) return;

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
        setError(null);
      }

      try {
        const results = await getWalletNFTs(walletAddress);
        setNfts(Array.isArray(results) ? results : []);
        setError(null);
      } catch (err) {
        // Distinguish a real fetch error from an empty wallet
        setError(err.message || 'Failed to load NFTs from the Soroban contract.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [walletAddress]
  );

  // Initial load whenever walletAddress changes
  useEffect(() => {
    if (walletAddress) {
      loadNFTs(false);
    } else {
      setNfts([]);
      setError(null);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress]);
    let isMounted = true;
    // Simulate loading NFTs from Stellar
    const timer = setTimeout(() => {
      if (isMounted) {
        setNfts(sampleNFTs);
        setLoading(false);
      }
    }, 1500);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  // ── State: wallet not connected ──────────────────────────────────────────
  if (!walletAddress) {
    return (
      <div style={styles.empty}>
        <p style={styles.emptyIcon}>🔌</p>
        <p style={styles.emptyTitle}>Connect your wallet</p>
        <p style={styles.emptyText}>
          Connect your Freighter wallet to view your NFTs.
        </p>
      </div>
    );
  }

  // ── State: initial loading ────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} aria-label="Loading NFTs" role="status" />
        <p style={styles.loadingText}>⏳ Loading your NFTs from Stellar…</p>
      <div style={styles.container}>
        <h2 style={styles.title}>🏛️ NFT Gallery</h2>
        <p style={styles.count}>Loading NFTs...</p>

        {/* Skeleton Loading Grid */}
        <div style={styles.grid} data-testid="nft-skeleton-grid">
          {Array.from({ length: skeletonCount }).map((_, index) => (
            <NFTCardSkeleton key={`skeleton-${index}`} />
          ))}
        </div>
      </div>
    );
  }

  // ── State: fetch error ────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={styles.empty}>
        <p style={styles.emptyIcon}>⚠️</p>
        <p style={styles.emptyTitle}>Could not load NFTs</p>
        <p style={styles.emptyText}>{error}</p>
        <button
          style={styles.retryButton}
          onClick={() => loadNFTs(false)}
          aria-label="Retry loading NFTs"
        >
          🔄 Retry
        </button>
      </div>
    );
  }

  // ── State: empty wallet ───────────────────────────────────────────────────
  if (nfts.length === 0) {
    return (
      <div style={styles.empty}>
        <p style={styles.emptyIcon}>🖼️</p>
        <p style={styles.emptyTitle}>No NFTs yet</p>
        <p style={styles.emptyText}>
          You don't own any OrbitNFTs yet. Mint your first one!
        </p>
        <button
          style={styles.retryButton}
          onClick={() => loadNFTs(false)}
          aria-label="Refresh gallery"
        >
          🔄 Refresh
        </button>
      </div>
    );
  }

  // ── State: gallery ────────────────────────────────────────────────────────
  return (
    <div style={styles.container}>
      {/* Header row */}
      <div style={styles.headerRow}>
        <h2 style={styles.title}>🏛️ My NFT Gallery</h2>
        <button
          style={refreshing ? styles.refreshButtonSpinning : styles.refreshButton}
          onClick={() => loadNFTs(true)}
          disabled={refreshing}
          aria-label="Refresh gallery"
          title="Pull to refresh"
        >
          {refreshing ? '⏳' : '🔄'}
        </button>
      </div>
      <p style={styles.count}>
        {nfts.length} NFT{nfts.length !== 1 ? 's' : ''} in your wallet
      </p>

      {/* NFT grid */}
      <div style={styles.grid}>
        {nfts.map((nft) => (
          <NFTCard key={nft.id} nft={nft} onClick={setSelected} />
      {/* NFT Grid */}
      <div style={styles.grid} data-testid="nft-card-grid">
        {nfts.map((nft) => (
          <div
            key={nft.id}
            style={styles.card}
            onClick={() => setSelected(nft)}
            data-testid={`nft-card-${nft.id}`}
          >
            <img
              src={nft.image}
              alt={nft.name}
              style={styles.image}
            />
            <div style={styles.cardBody}>
              <h3 style={styles.nftName}>{nft.name}</h3>
              <p style={styles.nftDesc}>{nft.description}</p>
              <p style={styles.nftDate}>📅 {nft.minted}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Detail modal */}
      {selected && (
        <NFTModal nft={selected} onClose={() => setSelected(null)} />
        <div style={styles.modal} data-testid="nft-modal">
          <div style={styles.modalContent}>
            <img
              src={selected.image}
              alt={selected.name}
              style={styles.modalImage}
            />
            <h2 style={styles.modalTitle}>{selected.name}</h2>
            <p style={styles.modalDesc}>{selected.description}</p>
            <p style={styles.modalOwner}>
              👤 Owner: {selected.owner}
            </p>
            <p style={styles.modalDate}>
              📅 Minted: {selected.minted}
            </p>
            <button
              style={styles.closeButton}
              onClick={() => setSelected(null)}
            >
              ✕ Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles — matches existing dark-theme palette (#0a0a0a / #1a1a1a / #7c3aed)
// ─────────────────────────────────────────────────────────────────────────────
const styles = {
  container: { padding: '20px', maxWidth: '900px', margin: '0 auto' },

  headerRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: '4px',
  },
  title: { color: '#7c3aed', margin: 0 },
  count: { color: '#888888', fontSize: '14px', marginBottom: '24px', marginTop: '4px' },

  refreshButton: {
    background: 'none', border: '1px solid #333333', borderRadius: '8px',
    color: '#888888', fontSize: '18px', cursor: 'pointer', padding: '6px 10px',
  },
  refreshButtonSpinning: {
    background: 'none', border: '1px solid #333333', borderRadius: '8px',
    color: '#7c3aed', fontSize: '18px', padding: '6px 10px', cursor: 'default',
    opacity: 0.7,
  },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '16px',
  },

  card: {
    backgroundColor: '#1a1a1a', borderRadius: '12px', overflow: 'hidden',
    cursor: 'pointer', border: '1px solid #333333',
    transition: 'border-color 0.15s',
    outline: 'none',
  },
  image: { width: '100%', height: '180px', objectFit: 'cover', display: 'block' },
  imagePlaceholder: {
    width: '100%', height: '180px', backgroundColor: '#222222',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  imagePlaceholderIcon: { fontSize: '48px', opacity: 0.4 },
  cardBody: { padding: '12px' },
  nftName: { color: '#ffffff', fontSize: '14px', margin: '0 0 4px' },
  nftDesc: {
    color: '#888888', fontSize: '12px', margin: '0 0 6px',
    overflow: 'hidden', textOverflow: 'ellipsis',
    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
  },
  nftId: { color: '#7c3aed', fontSize: '11px', fontFamily: 'monospace', margin: 0 },
  metaError: { color: '#f59e0b', fontSize: '11px', margin: '0 0 4px' },

  // Loading state
  loadingContainer: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', padding: '60px 20px', color: '#888888',
  },
  spinner: {
    width: '40px', height: '40px', borderRadius: '50%',
    border: '3px solid #333333', borderTopColor: '#7c3aed',
    animation: 'spin 0.8s linear infinite', marginBottom: '16px',
  empty: {
    textAlign: 'center',
    padding: '40px',
    color: '#ffffff',
  },
  loadingText: { fontSize: '14px', margin: 0 },

  // Empty / error state
  empty: { textAlign: 'center', padding: '60px 20px', color: '#ffffff' },
  emptyIcon: { fontSize: '48px', margin: '0 0 12px' },
  emptyTitle: { fontSize: '18px', fontWeight: 'bold', margin: '0 0 8px' },
  emptyText: { color: '#888888', fontSize: '14px', margin: '0 0 20px' },
  retryButton: {
    backgroundColor: '#7c3aed', color: '#ffffff', border: 'none',
    borderRadius: '8px', padding: '10px 24px', fontSize: '14px',
    cursor: 'pointer',
  },

  // Modal
  modal: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px',
  },
  modalContent: {
    backgroundColor: '#1a1a1a', borderRadius: '16px', padding: '24px',
    maxWidth: '360px', width: '100%', textAlign: 'center',
    maxHeight: '90vh', overflowY: 'auto',
  },
  modalImage: { width: '100%', borderRadius: '12px', marginBottom: '16px', display: 'block' },
  modalImagePlaceholder: {
    width: '100%', height: '200px', backgroundColor: '#222222',
    borderRadius: '12px', marginBottom: '16px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  modalTitle: { color: '#ffffff', margin: '0 0 8px' },
  modalDesc: { color: '#888888', fontSize: '14px', margin: '0 0 12px' },
  modalId: { color: '#888888', fontSize: '13px', margin: '0 0 20px' },
  closeButton: {
    backgroundColor: '#7c3aed', color: '#ffffff', border: 'none',
    borderRadius: '8px', padding: '12px 24px', fontSize: '14px',
    cursor: 'pointer', width: '100%',
  },
};

// Inject keyframe animation for the spinner (only once)
if (typeof document !== 'undefined' && !document.getElementById('gallery-spin-keyframe')) {
  const style = document.createElement('style');
  style.id = 'gallery-spin-keyframe';
  style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
  document.head.appendChild(style);
}

export { NFTCardSkeleton };
export default Gallery;
