import { NFTStorage } from 'nft.storage';
import { mintNFT } from './stellar';

/**
 * Sanitizes artwork name to a valid Stellar asset code (max 12 uppercase alphanumeric characters).
 * @param {string} artName - The name of the artwork.
 * @returns {string} - Sanitized asset code (e.g. "SUNSETINLAGO").
 */
export const generateAssetCode = (artName) => {
  if (!artName || typeof artName !== 'string') {
    return 'NFT';
  }
  const sanitized = artName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 12);
  return sanitized || 'NFT';
};

/**
 * Deterministic mock IPFS upload function for testing / offline use.
 * Simulates latency and returns a deterministic IPFS URI.
 * @param {File|Blob|object} file - The artwork image file.
 * @param {object} metadata - Metadata containing name and description.
 * @returns {Promise<string>} - IPFS metadata URI.
 */
export const mockIPFSUpload = async (file, { name = '', description = '' } = {}) => {
  const delay = process.env.NODE_ENV === 'test' ? 10 : 600;
  await new Promise((resolve) => setTimeout(resolve, delay));

  const fileName = file?.name || 'art';
  const seed = `${name}-${fileName}`.toLowerCase().replace(/[^a-z0-9]/g, '');

  let hash = '';
  for (let i = 0; i < 32; i++) {
    const charCode = seed.charCodeAt(i % (seed.length || 1)) || 97;
    hash += String.fromCharCode(97 + ((charCode * (i + 3) * 7) % 26));
  }

  const cid = `bafybeig${hash}`;
  return `ipfs://${cid}/metadata.json`;
};

/**
 * Uploads artwork image and metadata to IPFS via NFT.Storage or fallback mock.
 * @param {File|Blob} file - The artwork image file.
 * @param {object} metadata - Metadata object with name and description.
 * @returns {Promise<string>} - The IPFS URI for the metadata (e.g. "ipfs://.../metadata.json").
 */
export const uploadArtworkToIPFS = async (file, { name = '', description = '' } = {}) => {
  if (!file) {
    throw new Error('Artwork file is required for IPFS upload.');
  }

  const apiKey = process.env.REACT_APP_NFT_STORAGE_KEY;

  if (apiKey && typeof apiKey === 'string' && apiKey.trim() !== '') {
    const client = new NFTStorage({ token: apiKey.trim() });
    const metadata = await client.store({
      name: name || 'Untitled NFT',
      description: description || '',
      image: file,
    });
    return metadata.url;
  }

  return await mockIPFSUpload(file, { name, description });
};

/**
 * Coordinates the full minting flow:
 * 1. IPFS Upload
 * 2. Asset Code Generation
 * 3. Stellar Testnet Transaction Submission
 * @param {object} params
 * @param {File|Blob} params.file - The artwork image file.
 * @param {string} params.name - The artwork title.
 * @param {string} params.description - The artwork description.
 * @param {string} [params.walletAddress] - The user's Stellar public key.
 * @param {object} [params.issuerKeypair] - Optional Keypair instance.
 * @param {function} [params.onStatusUpdate] - Status update callback.
 * @returns {Promise<object>} - Result with success status, assetCode, metadataUrl, and tx hash.
 */
export const mintNFTWorkflow = async ({
  file,
  name,
  description,
  walletAddress,
  issuerKeypair,
  onStatusUpdate = () => {},
}) => {
  if (!name || !name.trim()) {
    throw new Error('Artwork title is required.');
  }
  if (!description || !description.trim()) {
    throw new Error('Artwork description is required.');
  }
  if (!file) {
    throw new Error('Artwork image file is required.');
  }

  const signer = issuerKeypair || walletAddress;
  if (!signer) {
    throw new Error('Wallet address or issuer keypair is required.');
  }

  // 1. IPFS Upload
  onStatusUpdate('Uploading to IPFS...');
  const metadataUrl = await uploadArtworkToIPFS(file, {
    name: name.trim(),
    description: description.trim(),
  });

  // 2. Asset Creation
  const assetCode = generateAssetCode(name.trim());

  // 3. Stellar tx submission
  onStatusUpdate('Submitting to Stellar Testnet...');
  const destination = walletAddress || (typeof signer === 'string' ? signer : signer.publicKey());
  const result = await mintNFT(signer, assetCode, metadataUrl, { destination });

  // 4. Return result
  onStatusUpdate('Minted Successfully!');

  return {
    success: true,
    assetCode,
    metadataUrl,
    hash: result?.hash || result?.id || '',
    result,
  };
};

const mintNFTService = {
  generateAssetCode,
  mockIPFSUpload,
  uploadArtworkToIPFS,
  mintNFTWorkflow,
};

export default mintNFTService;
