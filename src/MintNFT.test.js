import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import MintNFT from './MintNFT';
import * as mintNFTService from './mintNFTService';

jest.mock('./mintNFTService', () => ({
  mintNFTWorkflow: jest.fn(),
}));

describe('MintNFT Component', () => {
  const sampleWallet = 'GBJ5C2AVURO4RJ2YDCKTQMPSFDT6XCV2LYX3BWVRFOVMQ2GPIHKZS44N';

  beforeEach(() => {
    jest.clearAllMocks();
    global.URL.createObjectURL = jest.fn(() => 'blob:http://localhost/mock-preview-id');
    global.URL.revokeObjectURL = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('renders mint form with artwork title, description, and file picker', () => {
    render(<MintNFT walletAddress={sampleWallet} />);

    expect(screen.getByRole('heading', { name: /mint your nft/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/artwork title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/upload artwork/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mint nft/i })).toBeInTheDocument();
  });

  test('shows error banner when wallet is not connected', async () => {
    render(<MintNFT walletAddress="" />);

    const titleInput = screen.getByLabelText(/artwork title/i);
    fireEvent.change(titleInput, { target: { value: 'Sunset Art' } });

    const submitBtn = screen.getByRole('button', { name: /mint nft/i });
    fireEvent.click(submitBtn);

    expect(
      screen.getByText(/please connect your freighter wallet first!/i)
    ).toBeInTheDocument();
    expect(mintNFTService.mintNFTWorkflow).not.toHaveBeenCalled();
  });

  test('shows error banner when title is missing', async () => {
    render(<MintNFT walletAddress={sampleWallet} />);

    const submitBtn = screen.getByRole('button', { name: /mint nft/i });
    fireEvent.click(submitBtn);

    expect(
      screen.getByText(/please enter an artwork title!/i)
    ).toBeInTheDocument();
    expect(mintNFTService.mintNFTWorkflow).not.toHaveBeenCalled();
  });

  test('shows error banner when description is missing', async () => {
    render(<MintNFT walletAddress={sampleWallet} />);

    const titleInput = screen.getByLabelText(/artwork title/i);
    fireEvent.change(titleInput, { target: { value: 'Sunset Art' } });

    const submitBtn = screen.getByRole('button', { name: /mint nft/i });
    fireEvent.click(submitBtn);

    expect(
      screen.getByText(/please enter an artwork description!/i)
    ).toBeInTheDocument();
  });

  test('shows error banner when image file is missing', async () => {
    render(<MintNFT walletAddress={sampleWallet} />);

    const titleInput = screen.getByLabelText(/artwork title/i);
    fireEvent.change(titleInput, { target: { value: 'Sunset Art' } });

    const descInput = screen.getByLabelText(/description/i);
    fireEvent.change(descInput, { target: { value: 'Beautiful sunset view' } });

    const submitBtn = screen.getByRole('button', { name: /mint nft/i });
    fireEvent.click(submitBtn);

    expect(
      screen.getByText(/please select an artwork image file/i)
    ).toBeInTheDocument();
  });

  test('displays image preview when file is selected', () => {
    render(<MintNFT walletAddress={sampleWallet} />);

    const file = new File(['mock content'], 'artwork.png', { type: 'image/png' });
    const fileInput = screen.getByLabelText(/upload artwork/i);

    fireEvent.change(fileInput, { target: { files: [file] } });

    const previewImg = screen.getByAltText(/artwork preview/i);
    expect(previewImg).toBeInTheDocument();
    expect(previewImg).toHaveAttribute('src', 'blob:http://localhost/mock-preview-id');
  });

  test('executes successful mint workflow and triggers onMintSuccess callback', async () => {
    const onMintSuccess = jest.fn();
    const onSuccess = jest.fn();

    let statusCallbackRef;
    mintNFTService.mintNFTWorkflow.mockImplementation(async ({ onStatusUpdate }) => {
      statusCallbackRef = onStatusUpdate;
      onStatusUpdate('Uploading to IPFS...');
      await new Promise((resolve) => setTimeout(resolve, 10));
      onStatusUpdate('Submitting to Stellar Testnet...');
      await new Promise((resolve) => setTimeout(resolve, 10));
      onStatusUpdate('Minted Successfully!');
      return {
        success: true,
        assetCode: 'SUNSETINLAGO',
        metadataUrl: 'ipfs://bafybeig1234567890abcdef1234567890abcdef/metadata.json',
        hash: 'txhash9876543210',
      };
    });

    render(
      <MintNFT
        walletAddress={sampleWallet}
        onMintSuccess={onMintSuccess}
        onSuccess={onSuccess}
      />
    );

    const titleInput = screen.getByLabelText(/artwork title/i);
    fireEvent.change(titleInput, { target: { value: 'Sunset in Lagos' } });

    const descInput = screen.getByLabelText(/description/i);
    fireEvent.change(descInput, { target: { value: 'A warm evening in Lagos' } });

    const file = new File(['content'], 'sunset.png', { type: 'image/png' });
    const fileInput = screen.getByLabelText(/upload artwork/i);
    fireEvent.change(fileInput, { target: { files: [file] } });

    const submitBtn = screen.getByRole('button', { name: /mint nft/i });

    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(screen.getByText(/🎉 NFT Minted Successfully!/i)).toBeInTheDocument();
    });

    expect(screen.getByText('SUNSETINLAGO')).toBeInTheDocument();
    expect(
      screen.getByText('ipfs://bafybeig1234567890abcdef1234567890abcdef/metadata.json')
    ).toBeInTheDocument();
    expect(screen.getByText(/txhash9876/i)).toBeInTheDocument();

    expect(onMintSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        assetCode: 'SUNSETINLAGO',
        hash: 'txhash9876543210',
      })
    );
    expect(onSuccess).toHaveBeenCalled();

    // Click "Mint Another NFT" to reset
    const resetBtn = screen.getByRole('button', { name: /mint another nft/i });
    fireEvent.click(resetBtn);

    expect(screen.getByLabelText(/artwork title/i)).toHaveValue('');
    expect(screen.getByLabelText(/description/i)).toHaveValue('');
  });

  test('displays error message when mintNFTWorkflow throws an error', async () => {
    mintNFTService.mintNFTWorkflow.mockRejectedValue(
      new Error('Transaction rejected by user')
    );

    render(<MintNFT walletAddress={sampleWallet} />);

    const titleInput = screen.getByLabelText(/artwork title/i);
    fireEvent.change(titleInput, { target: { value: 'Sunset in Lagos' } });

    const descInput = screen.getByLabelText(/description/i);
    fireEvent.change(descInput, { target: { value: 'A warm evening in Lagos' } });

    const file = new File(['content'], 'sunset.png', { type: 'image/png' });
    const fileInput = screen.getByLabelText(/upload artwork/i);
    fireEvent.change(fileInput, { target: { files: [file] } });

    const submitBtn = screen.getByRole('button', { name: /mint nft/i });

    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(screen.getByText(/transaction rejected by user/i)).toBeInTheDocument();
    });
  });
});
