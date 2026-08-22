import {
  generateAssetCode,
  mockIPFSUpload,
  uploadArtworkToIPFS,
  mintNFTWorkflow,
} from './mintNFTService';
import * as stellarModule from './stellar';
import { NFTStorage } from 'nft.storage';

jest.mock('./stellar', () => ({
  mintNFT: jest.fn(),
  isValidAddress: jest.fn().mockReturnValue(true),
}));

describe('mintNFTService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.REACT_APP_NFT_STORAGE_KEY;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('generateAssetCode', () => {
    test('sanitizes titles to max 12 uppercase alphanumeric characters', () => {
      expect(generateAssetCode('Sunset in Lagos')).toBe('SUNSETINLAGO');
      expect(generateAssetCode('African Patterns')).toBe('AFRICANPATTE');
      expect(generateAssetCode('OrbitNFT')).toBe('ORBITNFT');
      expect(generateAssetCode('Art #123 (Rare) Edition!')).toBe('ART123RAREED');
    });

    test('handles shorter titles', () => {
      expect(generateAssetCode('Moon')).toBe('MOON');
      expect(generateAssetCode('A1')).toBe('A1');
    });

    test('falls back to NFT when title is empty, whitespace, or only special characters', () => {
      expect(generateAssetCode('')).toBe('NFT');
      expect(generateAssetCode('   ')).toBe('NFT');
      expect(generateAssetCode('!@#$%^&*()_+')).toBe('NFT');
      expect(generateAssetCode(null)).toBe('NFT');
      expect(generateAssetCode(undefined)).toBe('NFT');
      expect(generateAssetCode(12345)).toBe('NFT');
    });
  });

  describe('mockIPFSUpload', () => {
    test('returns deterministic valid IPFS URI with bafybeig CID', async () => {
      const mockFile = new Blob(['sample-image-data'], { type: 'image/png' });
      mockFile.name = 'sunset.png';

      const uri1 = await mockIPFSUpload(mockFile, {
        name: 'Sunset in Lagos',
        description: 'A beautiful sunset',
      });

      const uri2 = await mockIPFSUpload(mockFile, {
        name: 'Sunset in Lagos',
        description: 'A beautiful sunset',
      });

      expect(uri1).toMatch(/^ipfs:\/\/bafybeig[a-z0-9]+\/metadata\.json$/);
      expect(uri1).toBe(uri2); // Deterministic
    });
  });

  describe('uploadArtworkToIPFS', () => {
    test('throws error if artwork file is missing', async () => {
      await expect(uploadArtworkToIPFS(null, { name: 'Art' })).rejects.toThrow(
        /file is required/i
      );
    });

    test('uses mock fallback when REACT_APP_NFT_STORAGE_KEY is not set', async () => {
      delete process.env.REACT_APP_NFT_STORAGE_KEY;
      const mockFile = new Blob(['image-bytes'], { type: 'image/jpeg' });
      mockFile.name = 'art.jpg';

      const uri = await uploadArtworkToIPFS(mockFile, {
        name: 'Starry Night',
        description: 'Stellar edition',
      });

      expect(uri).toMatch(/^ipfs:\/\/bafybeig[a-z0-9]+\/metadata\.json$/);
    });

    test('uses real NFTStorage client when REACT_APP_NFT_STORAGE_KEY is provided', async () => {
      process.env.REACT_APP_NFT_STORAGE_KEY = 'test-nft-storage-api-key-123';
      const storeSpy = jest.spyOn(NFTStorage.prototype, 'store').mockResolvedValue({
        url: 'ipfs://bafybeihdwdcefgh4dqkjv67uzcmw7ojee6xedviommnozgtku5nddifwyu/metadata.json',
        ipnft: 'bafybeihdwdcefgh4dqkjv67uzcmw7ojee6xedviommnozgtku5nddifwyu',
      });

      const mockFile = new Blob(['sample-binary'], { type: 'image/png' });
      mockFile.name = 'nft.png';

      const uri = await uploadArtworkToIPFS(mockFile, {
        name: 'Cosmic Art',
        description: 'On Stellar',
      });

      expect(storeSpy).toHaveBeenCalledWith({
        name: 'Cosmic Art',
        description: 'On Stellar',
        image: mockFile,
      });
      expect(uri).toBe(
        'ipfs://bafybeihdwdcefgh4dqkjv67uzcmw7ojee6xedviommnozgtku5nddifwyu/metadata.json'
      );
      storeSpy.mockRestore();
    });
  });

  describe('mintNFTWorkflow', () => {
    const sampleWallet = 'GBJ5C2AVURO4RJ2YDCKTQMPSFDT6XCV2LYX3BWVRFOVMQ2GPIHKZS44N';

    test('validates required fields', async () => {
      const mockFile = new Blob(['img'], { type: 'image/png' });

      await expect(
        mintNFTWorkflow({
          file: mockFile,
          name: '',
          description: 'Desc',
          walletAddress: sampleWallet,
        })
      ).rejects.toThrow(/title is required/i);

      await expect(
        mintNFTWorkflow({
          file: mockFile,
          name: 'Art',
          description: '',
          walletAddress: sampleWallet,
        })
      ).rejects.toThrow(/description is required/i);

      await expect(
        mintNFTWorkflow({
          file: null,
          name: 'Art',
          description: 'Desc',
          walletAddress: sampleWallet,
        })
      ).rejects.toThrow(/image file is required/i);

      await expect(
        mintNFTWorkflow({
          file: mockFile,
          name: 'Art',
          description: 'Desc',
          walletAddress: '',
        })
      ).rejects.toThrow(/wallet address/i);
    });

    test('executes full minting workflow and emits status updates', async () => {
      const mockFile = new Blob(['artwork-data'], { type: 'image/png' });
      mockFile.name = 'sample.png';

      stellarModule.mintNFT.mockResolvedValue({
        hash: 'a1b2c3d4e5f67890123456789abcdef123456789abcdef123456789abcdef1234',
        successful: true,
      });

      const statusUpdates = [];
      const onStatusUpdate = (status) => statusUpdates.push(status);

      const result = await mintNFTWorkflow({
        file: mockFile,
        name: 'Sunset in Lagos',
        description: 'Digital masterpiece',
        walletAddress: sampleWallet,
        onStatusUpdate,
      });

      expect(statusUpdates).toEqual([
        'Uploading to IPFS...',
        'Submitting to Stellar Testnet...',
        'Minted Successfully!',
      ]);

      expect(result.success).toBe(true);
      expect(result.assetCode).toBe('SUNSETINLAGO');
      expect(result.metadataUrl).toMatch(/^ipfs:\/\/bafybeig[a-z0-9]+\/metadata\.json$/);
      expect(result.hash).toBe(
        'a1b2c3d4e5f67890123456789abcdef123456789abcdef123456789abcdef1234'
      );

      expect(stellarModule.mintNFT).toHaveBeenCalledWith(
        sampleWallet,
        'SUNSETINLAGO',
        expect.stringMatching(/^ipfs:\/\/bafybeig/),
        { destination: sampleWallet }
      );
    });

    test('propagates errors when Stellar minting fails', async () => {
      const mockFile = new Blob(['artwork-data'], { type: 'image/png' });
      mockFile.name = 'sample.png';

      stellarModule.mintNFT.mockRejectedValue(new Error('Horizon transaction failed'));

      await expect(
        mintNFTWorkflow({
          file: mockFile,
          name: 'Error Art',
          description: 'Failing transaction',
          walletAddress: sampleWallet,
        })
      ).rejects.toThrow('Horizon transaction failed');
    });
  });
});
