import React, { useState, useEffect } from 'react';
import { getTotalSupply, getTokenOwner } from './contract';
import NFTCardSkeleton from './NFTCardSkeleton';

const SKELETON_COUNT = 6;

function Gallery({ walletAddress, skeletonCount = SKELETON_COUNT }) {
  const [nfts, setNfts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadNFTs();
  }, []);

  const loadNFTs = async () => {
    try {
      setLoading(true);
      setError('');

      const supply = await getTotalSupply();

      if (supply === 0) {
        setNfts([]);
        setLoading(false);
        return;
      }

      // Fetch owner for each token (0 to supply-1)
      const tokenPromises = [];
      for (let i = 0; i < supply; i++) {
        tokenPromises.push(
          getTokenOwner(i).then((owner) => ({
            id: i,
            owner,
            name: `OrbitNFT #${i}`,
            image: `https://picsum.photos/300/300?random=${i}`,
          }))
        );
      }

      const tokens = await Promise.all(tokenPromises);
      setNfts(tokens.filter((t) => t.owner !== null));

    } catch (err) {
      setError('Failed to load NFTs from chain.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <h2 style={styles.title}>🏛️ NFT Gallery</h2>
        <p style={styles.count}>Loading on-chain NFTs...</p>

        {/* Skeleton Loading Grid */}
        <div style={styles.grid} data-testid="nft-skeleton-grid">
          {Array.from({ length: skeletonCount }).map((_, index) => (
            <NFTCardSkeleton key={`skeleton-${index}`} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.empty}>
        <p>⚠️ {error}</p>
        <button onClick={loadNFTs} style={styles.retryButton}>
          🔄 Retry
        </button>
      </div>
    );
  }

  if (nfts.length === 0) {
    return (
      <div style={styles.empty}>
        <p>🖼️ No NFTs minted yet</p>
        <p style={styles.emptyText}>Mint the first one!</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>🏛️ NFT Gallery</h2>
      <p style={styles.count}>{nfts.length} NFTs on-chain</p>

      <div style={styles.grid} data-testid="nft-card-grid">
        {nfts.map((nft) => (
          <div
            key={nft.id}
            style={styles.card}
            onClick={() => setSelected(nft)}
            data-testid={`nft-card-${nft.id}`}
          >
            <img src={nft.image} alt={nft.name} style={styles.image} />
            <div style={styles.cardBody}>
              <h3 style={styles.nftName}>{nft.name}</h3>
              <p style={styles.nftOwner}>
                👤 {nft.owner.slice(0, 6)}...{nft.owner.slice(-6)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div style={styles.modal} data-testid="nft-modal">
          <div style={styles.modalContent}>
            <img src={selected.image} alt={selected.name} style={styles.modalImage} />
            <h2 style={styles.modalTitle}>{selected.name}</h2>
            <p style={styles.modalOwner}>
              👤 Owner: {selected.owner.slice(0, 6)}...{selected.owner.slice(-6)}
            </p>
            <p style={styles.modalId}>🔢 Token ID: {selected.id}</p>
            <button style={styles.closeButton} onClick={() => setSelected(null)}>
              ✕ Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { padding: '20px', maxWidth: '800px', margin: '0 auto' },
  title: { color: '#7c3aed', textAlign: 'center', marginBottom: '8px' },
  count: { color: '#888888', textAlign: 'center', fontSize: '14px', marginBottom: '24px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' },
  card: { backgroundColor: '#1a1a1a', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', border: '1px solid #333333' },
  image: { width: '100%', height: '180px', objectFit: 'cover' },
  cardBody: { padding: '12px' },
  nftName: { color: '#ffffff', fontSize: '14px', marginBottom: '4px' },
  nftOwner: { color: '#7c3aed', fontSize: '11px', fontFamily: 'monospace' },
  empty: { textAlign: 'center', padding: '40px', color: '#ffffff' },
  emptyText: { color: '#888888', fontSize: '14px' },
  retryButton: {
    backgroundColor: '#7c3aed', color: '#ffffff', border: 'none',
    borderRadius: '8px', padding: '10px 20px', marginTop: '12px', cursor: 'pointer',
  },
  modal: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px',
  },
  modalContent: {
    backgroundColor: '#1a1a1a', borderRadius: '16px', padding: '24px',
    maxWidth: '360px', width: '100%', textAlign: 'center',
  },
  modalImage: { width: '100%', borderRadius: '12px', marginBottom: '16px' },
  modalTitle: { color: '#ffffff', marginBottom: '8px' },
  modalOwner: { color: '#7c3aed', fontSize: '13px', marginBottom: '4px', fontFamily: 'monospace' },
  modalId: { color: '#888888', fontSize: '13px', marginBottom: '20px' },
  closeButton: {
    backgroundColor: '#7c3aed', color: '#ffffff', border: 'none',
    borderRadius: '8px', padding: '12px 24px', fontSize: '14px',
    cursor: 'pointer', width: '100%',
  },
};

export { NFTCardSkeleton };
export default Gallery;
