import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './App';
import * as freighter from '@stellar/freighter-api';
import * as contractMod from './contract';

jest.mock('@stellar/freighter-api', () => ({
  isConnected: jest.fn(),
  getPublicKey: jest.fn(),
  getAddress: jest.fn(),
  setAllowed: jest.fn(),
  getNetwork: jest.fn(),
  getNetworkDetails: jest.fn(),
}));

// Gallery imports contract.js which instantiates SorobanRpc.Server at module
// level — mock the whole module so App.test.js stays focused on App logic.
jest.mock('./contract', () => ({
  getWalletNFTs: jest.fn(() => Promise.resolve([])),
  ipfsUriToUrl: jest.fn(() => null),
  getTotalSupply: jest.fn(() => Promise.resolve(0)),
  getTokenOwner: jest.fn(() => Promise.resolve(null)),
  mintNFTOnChain: jest.fn(),
  CONTRACT_ID: 'CBU7UVJM7FAXB7AHCDMTKVJSUEE3PVTV2ROFOKO2P3IC4IKRTB45IHFA',
  IPFS_GATEWAY: 'https://ipfs.io/ipfs/',
  IPFS_FETCH_TIMEOUT_MS: 8000,
  CONCURRENCY_LIMIT: 5,
}));

describe('App component', () => {
  const samplePublicKey = 'GA2C5RFPE6GCKMYYLHSI6AWBXPXR6O54VUUBM3CUS5W27EWBXRXGWXY7';

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    freighter.getNetwork.mockResolvedValue({ network: 'TESTNET' });
    // Re-set contract mock after clearAllMocks so Gallery can render without crashing
    contractMod.getWalletNFTs.mockResolvedValue([]);
    contractMod.ipfsUriToUrl.mockReturnValue(null);
  });

  test('renders App with header and default Gallery tab', () => {
    render(<App />);
    expect(screen.getByText('🪐 OrbitNFT')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /gallery/i })).toBeInTheDocument();
  });

  test('connects and disconnects wallet resetting the Navbar state and localStorage', async () => {
    freighter.isConnected.mockResolvedValue(true);
    freighter.setAllowed.mockResolvedValue(true);
    freighter.getPublicKey.mockResolvedValue(samplePublicKey);

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }));

    // Address truncated to first 4 + ... + last 4
    await waitFor(() => {
      expect(screen.getByText(/GA2C\.\.\.WXY7/i)).toBeInTheDocument();
    });
    expect(localStorage.getItem('freighterConnected')).toBe('true');

    const disconnectButton = screen.getByRole('button', { name: /disconnect/i });
    expect(disconnectButton).toBeInTheDocument();

    // Click Disconnect
    fireEvent.click(disconnectButton);

    // Should return to Connect Wallet state
    expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /disconnect/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/GA2C\.\.\.WXY7/i)).not.toBeInTheDocument();
    expect(localStorage.getItem('freighterConnected')).toBeNull();
  });

  test('re-hydrates wallet address on mount when localStorage flag is set', async () => {
    localStorage.setItem('freighterConnected', 'true');
    freighter.isConnected.mockResolvedValue({ isConnected: true });
    freighter.getPublicKey.mockResolvedValue({ address: samplePublicKey });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/GA2C\.\.\.WXY7/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument();
  });

  test('clears localStorage on mount if silent reconnection fails or wallet is not installed', async () => {
    localStorage.setItem('freighterConnected', 'true');
    freighter.isConnected.mockResolvedValue(false);

    render(<App />);

    await waitFor(() => {
      expect(localStorage.getItem('freighterConnected')).toBeNull();
    });
    expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument();
  });

  test('handles extension not installed and displays message with install link', async () => {
    freighter.isConnected.mockResolvedValue(false);

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }));

    await waitFor(() => {
      expect(screen.getByText(/please install freighter wallet/i)).toBeInTheDocument();
    });
    const installLink = screen.getByRole('link', { name: /install freighter/i });
    expect(installLink).toBeInTheDocument();
    expect(installLink).toHaveAttribute('href', 'https://www.freighter.app/');
  });

  test('handles extension not installed when isConnected returns { isConnected: false }', async () => {
    freighter.isConnected.mockResolvedValue({ isConnected: false });

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }));

    await waitFor(() => {
      expect(screen.getByText(/please install freighter wallet/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /install freighter/i })).toBeInTheDocument();
  });

  test('handles user rejection error when setAllowed returns isAllowed: false', async () => {
    freighter.isConnected.mockResolvedValue(true);
    freighter.setAllowed.mockResolvedValue({ isAllowed: false });

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }));

    await waitFor(() => {
      expect(screen.getByText(/user rejected the connection request/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole('link', { name: /install freighter/i })).not.toBeInTheDocument();
  });

  test('handles user rejection error when error message contains User rejected', async () => {
    freighter.isConnected.mockResolvedValue(true);
    freighter.setAllowed.mockRejectedValue(new Error('User rejected the request'));

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }));

    await waitFor(() => {
      expect(screen.getByText(/user rejected the connection request/i)).toBeInTheDocument();
    });
  });

  test('handles wallet locked error when error indicates wallet is locked', async () => {
    freighter.isConnected.mockResolvedValue(true);
    freighter.setAllowed.mockResolvedValue({ isAllowed: true, error: { message: 'Wallet is locked' } });

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }));

    await waitFor(() => {
      expect(screen.getByText(/freighter wallet is locked/i)).toBeInTheDocument();
    });
  });

  test('handles wallet locked thrown error', async () => {
    freighter.isConnected.mockResolvedValue(true);
    freighter.setAllowed.mockRejectedValue(new Error('Freighter wallet is locked'));

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }));

    await waitFor(() => {
      expect(screen.getByText(/freighter wallet is locked/i)).toBeInTheDocument();
    });
  });

  test('warns user when wallet is connected to a non-TESTNET network', async () => {
    freighter.isConnected.mockResolvedValue(true);
    freighter.setAllowed.mockResolvedValue(true);
    freighter.getPublicKey.mockResolvedValue(samplePublicKey);
    freighter.getNetwork.mockResolvedValue({ network: 'PUBLIC' });

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }));

    // Wallet is connected
    await waitFor(() => {
      expect(screen.getByText(/GA2C\.\.\.WXY7/i)).toBeInTheDocument();
    });
    // Warning status is shown
    expect(screen.getByText(/warning: please switch freighter network to testnet/i)).toBeInTheDocument();
  });

  test('disables connect button and prevents double click while connecting', async () => {
    let resolveConnect;
    freighter.isConnected.mockReturnValue(new Promise((resolve) => {
      resolveConnect = resolve;
    }));

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }));

    // Button should now be disabled with connecting label
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /connecting\.\.\./i })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /connecting\.\.\./i })).toBeDisabled();

    // Resolving connection
    resolveConnect(false);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument();
    });
  });

  test('handles unexpected generic error with fallback message and console.error', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    freighter.isConnected.mockResolvedValue(true);
    freighter.setAllowed.mockRejectedValue(new Error('Network timeout'));

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }));

    await waitFor(() => {
      expect(screen.getByText('Connection failed. Try again.')).toBeInTheDocument();
    });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  test('supports v6 freighter-api response formats for isConnected, setAllowed, and getAddress', async () => {
    freighter.isConnected.mockResolvedValue({ isConnected: true });
    freighter.setAllowed.mockResolvedValue({ isAllowed: true });
    freighter.getPublicKey.mockResolvedValue(null);
    freighter.getAddress.mockResolvedValue({ address: samplePublicKey });
    freighter.getNetwork.mockResolvedValue({ network: 'TESTNET', networkPassphrase: 'Test SDF Network' });

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }));

    await waitFor(() => {
      expect(screen.getByText(/GA2C\.\.\.WXY7/i)).toBeInTheDocument();
    });
    expect(localStorage.getItem('freighterConnected')).toBe('true');
  });
});
