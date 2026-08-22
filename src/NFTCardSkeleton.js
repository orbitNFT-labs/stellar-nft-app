import React from 'react';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

/**
 * NFTCardSkeleton
 * Mirrors the exact card structure of the real NFT card in Gallery.js:
 *   - Image area: width=100%, height=180px
 *   - Card body (padding=12px): title, description, date tag
 * Card outer container matches: backgroundColor=#1a1a1a, borderRadius=12px,
 * overflow=hidden, border=1px solid #333333.
 * Accepts optional `style` prop and forwards extra props to the card wrapper.
 */
function NFTCardSkeleton({ style, ...props }) {
  return (
    <SkeletonTheme baseColor="#2a2a2a" highlightColor="#3d3d3d">
      <div
        style={{ ...styles.card, ...style }}
        data-testid="nft-card-skeleton"
        {...props}
      >
        <div style={styles.imagePlaceholder}>
          <Skeleton
            height={180}
            style={{ display: 'block', width: '100%', borderRadius: 0 }}
          />
        </div>
        <div style={styles.cardBody}>
          <div style={styles.titlePlaceholder}>
            <Skeleton height={15} width="70%" borderRadius={4} />
          </div>
          <div style={styles.descPlaceholder}>
            <Skeleton height={12} width="95%" borderRadius={4} />
          </div>
          <div style={styles.datePlaceholder}>
            <Skeleton height={11} width="45%" borderRadius={4} />
          </div>
        </div>
      </div>
    </SkeletonTheme>
  );
}

const styles = {
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: '12px',
    overflow: 'hidden',
    border: '1px solid #333333',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
  },
  imagePlaceholder: {
    width: '100%',
    height: '180px',
    backgroundColor: '#222222',
    overflow: 'hidden',
  },
  cardBody: {
    padding: '12px',
  },
  titlePlaceholder: {
    marginBottom: '6px',
  },
  descPlaceholder: {
    marginBottom: '8px',
  },
  datePlaceholder: {
    marginTop: '2px',
  },
};

export default NFTCardSkeleton;
