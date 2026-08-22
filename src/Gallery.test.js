import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Gallery from './Gallery';
import * as contract from './contract';

// ─────────────────────────────────────────────────────────────────────────────
// Mock stellar-sdk so that the module-level `new StellarSdk.SorobanRpc.Server()`
// in contract.js does not crash in the jsdom test environment.
// ─────────────────────────────────────────────────────────────────────────────
jest.mock('stellar-sdk', () => ({
  SorobanRpc: { Server: jest.fn().mockReturnValue({}) },
  Networks: { TESTNET: 'Test SDF Network ; September 2015' },
  Contract: jest.fn(),
  TransactionBuilder: jest.fn(),
  BASE_FEE: '100',
  nativeToScVal: jest.fn(),
  scValToNative: jest.fn(),
  Asset: jest.fn(),
  Operation: { changeTrust: jest.fn(), payment: jest.fn() },
  Horizon: { Server: jest.fn().mockReturnValue({}) },
  Keypair: { fromPublicKey: jest.fn() },
}));

// ─────────────────────────────────────────────────────────────────────────────
// Mock contract module for Gallery component tests
// ─────────────────────────────────────────────────────────────────────────────
jest.mock('./contract', () => ({
  getWalletNFTs: jest.fn(),
  ipfsUriToUrl: jest.fn((uri) => {
    // Simplified real-impl mirror for test assertions
    if (!uri || typeof uri !== 'string') return null;
    if (uri.startsWith('ipfs://')) {
      const hash = uri.slice('ipfs://'.length);
      if (!hash || hash.startsWith('placeholder-') || hash === 'no-image') return null;
      return `https://ipfs.io/ipfs/${hash}`;
    }
    return uri;
  }),
}));

const WALLET = 'GA2C5RFPE6GCKMYYLHSI6AWBXPXR6O54VUUBM3CUS5W27EWBXRXGWXY7';

const makeNFT = (id, overrides = {}) => ({
  id,
  name: `Test NFT #${id}`,
  description: `Description ${id}`,
  imageUri: `ipfs://QmHash${id}`,
  metadataError: false,
  ...overrides,
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────
describe('Gallery component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── No wallet connected ───────────────────────────────────────────────────
  describe('when wallet is not connected', () => {
    test('shows connect-wallet prompt and does NOT call getWalletNFTs', () => {
      render(<Gallery walletAddress="" />);

      expect(screen.getByText(/connect your wallet/i)).toBeInTheDocument();
      expect(screen.getByText(/connect your freighter wallet/i)).toBeInTheDocument();
      expect(contract.getWalletNFTs).not.toHaveBeenCalled();
    });

    test('shows connect-wallet prompt when walletAddress is null', () => {
      render(<Gallery walletAddress={null} />);
      expect(screen.getByText(/connect your wallet/i)).toBeInTheDocument();
    });
  });

  // ── Loading state ─────────────────────────────────────────────────────────
  describe('loading state', () => {
    test('shows loading spinner while initial fetch is in progress', async () => {
      let resolveNFTs;
      contract.getWalletNFTs.mockReturnValue(
        new Promise((resolve) => { resolveNFTs = resolve; })
      );

      render(<Gallery walletAddress={WALLET} />);

      // Spinner / loading text should be visible immediately
      expect(screen.getByText(/loading your nfts from stellar/i)).toBeInTheDocument();
      expect(screen.getByRole('status')).toBeInTheDocument(); // spinner aria-label

      // Resolve so the component can clean up
      await act(async () => { resolveNFTs([]); });
    });
  });

  // ── Empty wallet ──────────────────────────────────────────────────────────
  describe('empty wallet state', () => {
    test('shows "No NFTs yet" state when wallet has zero owned NFTs', async () => {
      contract.getWalletNFTs.mockResolvedValue([]);

      render(<Gallery walletAddress={WALLET} />);

      await waitFor(() => {
        expect(screen.getByText(/no nfts yet/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/you don't own any orbitnfts yet/i)).toBeInTheDocument();
      // Must NOT be the same as the error state
      expect(screen.queryByText(/could not load nfts/i)).not.toBeInTheDocument();
    });

    test('empty state shows Refresh button that re-fetches', async () => {
      contract.getWalletNFTs.mockResolvedValue([]);

      render(<Gallery walletAddress={WALLET} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /refresh gallery/i })).toBeInTheDocument();
      });

      // Call count before click
      expect(contract.getWalletNFTs).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole('button', { name: /refresh gallery/i }));

      await waitFor(() => {
        expect(contract.getWalletNFTs).toHaveBeenCalledTimes(2);
      });
    });
  });

  // ── Error state ───────────────────────────────────────────────────────────
  describe('error state', () => {
    test('shows error state (not empty) when Horizon/contract fetch fails', async () => {
      contract.getWalletNFTs.mockRejectedValue(
        new Error('Failed to read NFT supply from the Soroban contract: network error')
      );

      render(<Gallery walletAddress={WALLET} />);

      await waitFor(() => {
        expect(screen.getByText(/could not load nfts/i)).toBeInTheDocument();
      });

      // Error message from the thrown error should appear
      expect(
        screen.getByText(/failed to read nft supply from the soroban contract/i)
      ).toBeInTheDocument();

      // Must NOT show empty-wallet message
      expect(screen.queryByText(/no nfts yet/i)).not.toBeInTheDocument();
    });

    test('Retry button in error state re-fetches', async () => {
      contract.getWalletNFTs.mockRejectedValue(new Error('network failure'));

      render(<Gallery walletAddress={WALLET} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry loading nfts/i })).toBeInTheDocument();
      });

      expect(contract.getWalletNFTs).toHaveBeenCalledTimes(1);

      // Second call succeeds — gallery should render
      contract.getWalletNFTs.mockResolvedValue([makeNFT(0)]);

      fireEvent.click(screen.getByRole('button', { name: /retry loading nfts/i }));

      await waitFor(() => {
        expect(screen.getByText('Test NFT #0')).toBeInTheDocument();
      });
      expect(contract.getWalletNFTs).toHaveBeenCalledTimes(2);
    });
  });

  // ── NFT rendering & balance-1 filter ──────────────────────────────────────
  describe('NFT list rendering', () => {
    test('renders only NFTs returned by getWalletNFTs (filtering handled in service)', async () => {
      // getWalletNFTs already filters by owner — we just verify the UI renders
      // the exact list returned without adding or dropping items
      const nfts = [makeNFT(0), makeNFT(2), makeNFT(5)];
      contract.getWalletNFTs.mockResolvedValue(nfts);

      render(<Gallery walletAddress={WALLET} />);

      await waitFor(() => {
        expect(screen.getByText('Test NFT #0')).toBeInTheDocument();
      });

      expect(screen.getByText('Test NFT #0')).toBeInTheDocument();
      expect(screen.getByText('Test NFT #2')).toBeInTheDocument();
      expect(screen.getByText('Test NFT #5')).toBeInTheDocument();
      expect(screen.getByText('3 NFTs in your wallet')).toBeInTheDocument();
    });

    test('renders singular label for exactly 1 NFT', async () => {
      contract.getWalletNFTs.mockResolvedValue([makeNFT(0)]);

      render(<Gallery walletAddress={WALLET} />);

      await waitFor(() => {
        expect(screen.getByText('1 NFT in your wallet')).toBeInTheDocument();
      });
    });

    test('calls getWalletNFTs with the connected wallet address', async () => {
      contract.getWalletNFTs.mockResolvedValue([]);

      render(<Gallery walletAddress={WALLET} />);

      await waitFor(() => {
        expect(contract.getWalletNFTs).toHaveBeenCalledWith(WALLET);
      });
    });
  });

  // ── Partial metadata failure ───────────────────────────────────────────────
  describe('partial metadata failure', () => {
    test('one NFT with metadataError still renders; others render normally', async () => {
      const nfts = [
        makeNFT(0, { metadataError: false }),
        makeNFT(1, { name: 'OrbitNFT #1', description: '', imageUri: null, metadataError: true }),
        makeNFT(2, { metadataError: false }),
      ];
      contract.getWalletNFTs.mockResolvedValue(nfts);

      render(<Gallery walletAddress={WALLET} />);

      await waitFor(() => {
        expect(screen.getByText('Test NFT #0')).toBeInTheDocument();
      });

      // All three cards present
      expect(screen.getByText('Test NFT #0')).toBeInTheDocument();
      expect(screen.getByText('OrbitNFT #1')).toBeInTheDocument();
      expect(screen.getByText('Test NFT #2')).toBeInTheDocument();

      // Warning shown only for the broken one
      expect(screen.getByText('⚠️ Metadata unavailable')).toBeInTheDocument();
    });

    test('NFT with null imageUri shows placeholder icon not a broken img tag', async () => {
      contract.getWalletNFTs.mockResolvedValue([
        makeNFT(0, { imageUri: null }),
      ]);

      render(<Gallery walletAddress={WALLET} />);

      await waitFor(() => {
        expect(screen.getByText('Test NFT #0')).toBeInTheDocument();
      });

      // No <img> HTML element should be rendered for null imageUri (only placeholder div)
      // We check no element with the img tag name exists — use getAllByRole to verify
      // only the placeholder (role="img" div) is present, not an <img> element
      const imgElements = screen.getAllByRole('img');
      // All img roles should be the placeholder divs (not native img elements)
      imgElements.forEach((el) => {
        expect(el.tagName.toLowerCase()).not.toBe('img');
      });
      // The placeholder role=img div should be present as a fallback
      expect(screen.getByRole('img', { name: 'Test NFT #0' })).toBeInTheDocument();
    });
  });

  // ── Pull-to-refresh ───────────────────────────────────────────────────────
  describe('pull-to-refresh', () => {
    test('refresh button triggers re-fetch and updates displayed NFTs', async () => {
      const initialNFTs = [makeNFT(0)];
      const updatedNFTs = [makeNFT(0), makeNFT(3)];

      contract.getWalletNFTs
        .mockResolvedValueOnce(initialNFTs)
        .mockResolvedValueOnce(updatedNFTs);

      render(<Gallery walletAddress={WALLET} />);

      // Initial load
      await waitFor(() => {
        expect(screen.getByText('Test NFT #0')).toBeInTheDocument();
      });

      expect(screen.queryByText('Test NFT #3')).not.toBeInTheDocument();

      // Trigger refresh
      const refreshButton = screen.getByRole('button', { name: /refresh gallery/i });
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(screen.getByText('Test NFT #3')).toBeInTheDocument();
      });

      expect(contract.getWalletNFTs).toHaveBeenCalledTimes(2);
      // Both calls used the same wallet address
      expect(contract.getWalletNFTs).toHaveBeenNthCalledWith(1, WALLET);
      expect(contract.getWalletNFTs).toHaveBeenNthCalledWith(2, WALLET);
    });

    test('pull-to-refresh does not reset the gallery to loading state', async () => {
      let resolveRefresh;
      const initialNFTs = [makeNFT(0)];

      contract.getWalletNFTs
        .mockResolvedValueOnce(initialNFTs)
        .mockReturnValueOnce(
          new Promise((resolve) => { resolveRefresh = resolve; })
        );

      render(<Gallery walletAddress={WALLET} />);

      await waitFor(() => {
        expect(screen.getByText('Test NFT #0')).toBeInTheDocument();
      });

      // Click refresh — while the second fetch is in flight, the gallery
      // should still show existing cards (not the loading spinner)
      fireEvent.click(screen.getByRole('button', { name: /refresh gallery/i }));

      // Cards should still be visible during refresh
      expect(screen.getByText('Test NFT #0')).toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument(); // no spinner

      // Resolve refresh
      await act(async () => { resolveRefresh([makeNFT(0), makeNFT(1)]); });

      await waitFor(() => {
        expect(screen.getByText('Test NFT #1')).toBeInTheDocument();
      });
    });
  });

  // ── NFT Modal ─────────────────────────────────────────────────────────────
  describe('NFT detail modal', () => {
    test('clicking a card opens the detail modal with NFT info', async () => {
      contract.getWalletNFTs.mockResolvedValue([makeNFT(7)]);

      render(<Gallery walletAddress={WALLET} />);

      await waitFor(() => {
        expect(screen.getByText('Test NFT #7')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /view details for test nft #7/i }));

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      // Token ID text is split across nodes ("🔢 Token ID: " + "7") so use regex
      expect(screen.getByText(/token id:\s*7/i)).toBeInTheDocument();
    });

    test('closing the modal removes it from the DOM', async () => {
      contract.getWalletNFTs.mockResolvedValue([makeNFT(7)]);

      render(<Gallery walletAddress={WALLET} />);

      await waitFor(() => {
        expect(screen.getByText('Test NFT #7')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /view details for test nft #7/i }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /close dialog/i }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  // ── Wallet address change ─────────────────────────────────────────────────
  describe('walletAddress prop change', () => {
    test('re-fetches when walletAddress changes to a new address', async () => {
      const WALLET2 = 'GBVVZWF7QHLK45XO2ABCDEFGHIJKLMNOPQRSTUVWXYZ12345ABCDE';
      contract.getWalletNFTs
        .mockResolvedValueOnce([makeNFT(0)])
        .mockResolvedValueOnce([makeNFT(99)]);

      const { rerender } = render(<Gallery walletAddress={WALLET} />);

      await waitFor(() => {
        expect(screen.getByText('Test NFT #0')).toBeInTheDocument();
      });

      rerender(<Gallery walletAddress={WALLET2} />);

      await waitFor(() => {
        expect(screen.getByText('Test NFT #99')).toBeInTheDocument();
      });

      expect(contract.getWalletNFTs).toHaveBeenCalledTimes(2);
      expect(contract.getWalletNFTs).toHaveBeenNthCalledWith(2, WALLET2);
    });

    test('resets to connect-wallet prompt when wallet is disconnected', async () => {
      contract.getWalletNFTs.mockResolvedValue([makeNFT(0)]);

      const { rerender } = render(<Gallery walletAddress={WALLET} />);

      await waitFor(() => {
        expect(screen.getByText('Test NFT #0')).toBeInTheDocument();
      });

      rerender(<Gallery walletAddress="" />);

      expect(screen.getByText(/connect your wallet/i)).toBeInTheDocument();
      expect(screen.queryByText('Test NFT #0')).not.toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests: contract.js pure helpers
// (stellar-sdk is already mocked above, so requireActual loads cleanly)
// ─────────────────────────────────────────────────────────────────────────────

const {
  ipfsUriToUrl: realIpfsUriToUrl,
  pLimit: realPLimit,
  IPFS_GATEWAY,
  CONCURRENCY_LIMIT,
} = jest.requireActual('./contract');

describe('ipfsUriToUrl', () => {
  test('converts ipfs:// URI to gateway URL', () => {
    expect(realIpfsUriToUrl('ipfs://QmAbc123')).toBe(
      `${IPFS_GATEWAY}QmAbc123`
    );
  });

  test('returns null for ipfs://placeholder- URIs', () => {
    expect(realIpfsUriToUrl('ipfs://placeholder-1234567890')).toBeNull();
  });

  test('returns null for ipfs://no-image', () => {
    expect(realIpfsUriToUrl('ipfs://no-image')).toBeNull();
  });

  test('passes through https:// URLs unchanged', () => {
    expect(realIpfsUriToUrl('https://example.com/img.png')).toBe(
      'https://example.com/img.png'
    );
  });

  test('returns null for null/undefined/empty input', () => {
    expect(realIpfsUriToUrl(null)).toBeNull();
    expect(realIpfsUriToUrl(undefined)).toBeNull();
    expect(realIpfsUriToUrl('')).toBeNull();
  });
});

describe('pLimit (bounded concurrency)', () => {
  test('runs all tasks and returns fulfilled results', async () => {
    const tasks = [1, 2, 3].map((n) => async () => n * 10);
    const results = await realPLimit(tasks, 2);
    expect(results).toEqual([
      { status: 'fulfilled', value: 10 },
      { status: 'fulfilled', value: 20 },
      { status: 'fulfilled', value: 30 },
    ]);
  });

  test('captures rejected tasks without throwing', async () => {
    const tasks = [
      async () => 'ok',
      async () => { throw new Error('boom'); },
      async () => 'also ok',
    ];
    const results = await realPLimit(tasks, 2);
    expect(results[0]).toEqual({ status: 'fulfilled', value: 'ok' });
    expect(results[1].status).toBe('rejected');
    expect(results[1].reason.message).toBe('boom');
    expect(results[2]).toEqual({ status: 'fulfilled', value: 'also ok' });
  });

  test('respects concurrency limit', async () => {
    let maxConcurrent = 0;
    let current = 0;

    const tasks = Array.from({ length: 10 }, () => async () => {
      current++;
      maxConcurrent = Math.max(maxConcurrent, current);
      await new Promise((r) => setTimeout(r, 10));
      current--;
    });

    await realPLimit(tasks, 3);
    expect(maxConcurrent).toBeLessThanOrEqual(3);
  });

  test('handles empty task list', async () => {
    const results = await realPLimit([], CONCURRENCY_LIMIT);
    expect(results).toEqual([]);
  });

  test('CONCURRENCY_LIMIT constant is exported and is a positive integer', () => {
    expect(typeof CONCURRENCY_LIMIT).toBe('number');
    expect(CONCURRENCY_LIMIT).toBeGreaterThan(0);
  });
});
