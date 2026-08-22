import * as StellarSdk from 'stellar-sdk';
import * as freighter from '@stellar/freighter-api';
import {
  server,
  truncateAddress,
  shortAddress,
  isValidAddress,
  createNFTAsset,
  mintNFT,
} from './stellar';

jest.mock('@stellar/freighter-api', () => ({
  signTransaction: jest.fn(),
}));

describe('Stellar Module', () => {
  const sampleValidPublicKey = 'GBJ5C2AVURO4RJ2YDCKTQMPSFDT6XCV2LYX3BWVRFOVMQ2GPIHKZS44N';
  const recipientValidPublicKey = 'GC7K6UC43OMDAXYEHHTFVC24HMWFOMFULL6UQ6I5XBPY5LL7BAZEVSVB';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Address truncation helpers', () => {
    const legacyPublicKey = 'GA2C5RFPE6GCKMYYLHSI6AWBXPXR6O54VUUBM3CUS5W27EWBXRXGWXY7';

    test('truncateAddress formats address as first 4 chars + ... + last 4 chars', () => {
      expect(truncateAddress(legacyPublicKey)).toBe('GA2C...WXY7');
      expect(truncateAddress(sampleValidPublicKey)).toBe('GBJ5...S44N');
    });

    test('shortAddress formats address as first 4 chars + ... + last 4 chars', () => {
      expect(shortAddress(legacyPublicKey)).toBe('GA2C...WXY7');
      expect(shortAddress(sampleValidPublicKey)).toBe('GBJ5...S44N');
    });

    test('returns empty string for null, undefined or empty input', () => {
      expect(truncateAddress('')).toBe('');
      expect(truncateAddress(null)).toBe('');
      expect(truncateAddress(undefined)).toBe('');
      expect(shortAddress('')).toBe('');
      expect(shortAddress(null)).toBe('');
      expect(shortAddress(undefined)).toBe('');
    });

    test('returns the original address if 8 characters or shorter', () => {
      expect(truncateAddress('GABC1234')).toBe('GABC1234');
      expect(truncateAddress('GABC')).toBe('GABC');
    });
  });

  describe('isValidAddress', () => {
    test('returns true for valid Stellar public key', () => {
      expect(isValidAddress(sampleValidPublicKey)).toBe(true);
      expect(isValidAddress(recipientValidPublicKey)).toBe(true);
    });

    test('returns false for invalid address', () => {
      expect(isValidAddress('invalid-address')).toBe(false);
      expect(isValidAddress('GA2C5RFPE6GCKMYYLHSI6AWBXPXR6O54VUUBM3CUS5W27EWBXRXGWXY7')).toBe(false);
      expect(isValidAddress('')).toBe(false);
      expect(isValidAddress(null)).toBe(false);
    });
  });

  describe('createNFTAsset', () => {
    test('creates StellarSdk.Asset with sanitized code and issuer public key', () => {
      const asset = createNFTAsset('Sunset in Lagos', sampleValidPublicKey);
      expect(asset).toBeInstanceOf(StellarSdk.Asset);
      expect(asset.getCode()).toBe('SUNSETINLAGO');
      expect(asset.getIssuer()).toBe(sampleValidPublicKey);
    });
  });

  describe('mintNFT', () => {
    const sampleMetadataUrl = 'ipfs://bafybeig1234567890abcdef1234567890abcdef/metadata.json';
    let mockAccount;

    beforeEach(() => {
      mockAccount = new StellarSdk.Account(sampleValidPublicKey, '1000');
      jest.spyOn(server, 'loadAccount').mockResolvedValue(mockAccount);
      jest.spyOn(server, 'submitTransaction').mockResolvedValue({
        hash: 'txhash1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        successful: true,
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('mints NFT using Keypair with manageData and payment operations', async () => {
      const keypair = StellarSdk.Keypair.random();
      const kpAccount = new StellarSdk.Account(keypair.publicKey(), '2000');
      jest.spyOn(server, 'loadAccount').mockResolvedValue(kpAccount);

      const result = await mintNFT(keypair, 'ORBITNFT', sampleMetadataUrl);

      expect(server.loadAccount).toHaveBeenCalledWith(keypair.publicKey());
      expect(server.submitTransaction).toHaveBeenCalledTimes(1);

      const submittedTx = server.submitTransaction.mock.calls[0][0];
      expect(submittedTx.operations).toHaveLength(2);

      // Verify manageData operation
      const manageDataOp = submittedTx.operations[0];
      expect(manageDataOp.type).toBe('manageData');
      expect(manageDataOp.name).toBe('nft_metadata');
      expect(manageDataOp.value.toString()).toBe(sampleMetadataUrl);

      // Verify payment operation
      const paymentOp = submittedTx.operations[1];
      expect(paymentOp.type).toBe('payment');
      expect(paymentOp.destination).toBe(keypair.publicKey());
      expect(parseFloat(paymentOp.amount)).toBe(1);
      expect(paymentOp.asset.getCode()).toBe('ORBITNFT');

      // Verify transaction was signed
      expect(submittedTx.signatures.length).toBeGreaterThan(0);
      expect(result.hash).toBe(
        'txhash1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      );
    });

    test('mints NFT using Freighter wallet signing when issuer is a public key string', async () => {
      freighter.signTransaction.mockImplementation(async (xdr) => {
        return xdr; // Return XDR as mock signed
      });

      const result = await mintNFT(
        sampleValidPublicKey,
        'COSMIC',
        sampleMetadataUrl,
        { destination: recipientValidPublicKey }
      );

      expect(server.loadAccount).toHaveBeenCalledWith(sampleValidPublicKey);
      expect(freighter.signTransaction).toHaveBeenCalledWith(
        expect.any(String),
        { network: 'TESTNET' }
      );
      expect(server.submitTransaction).toHaveBeenCalledTimes(1);

      const submittedTx = server.submitTransaction.mock.calls[0][0];
      expect(submittedTx.operations).toHaveLength(2);
      expect(submittedTx.operations[1].destination).toBe(recipientValidPublicKey);
      expect(result.successful).toBe(true);
    });

    test('handles long metadata URL exceeding 64 bytes by trimming for manageData', async () => {
      const longUrl = 'ipfs://' + 'a'.repeat(80) + '/metadata.json';
      const keypair = StellarSdk.Keypair.random();
      const kpAccount = new StellarSdk.Account(keypair.publicKey(), '2000');
      jest.spyOn(server, 'loadAccount').mockResolvedValue(kpAccount);

      await mintNFT(keypair, 'LONGMETADATA', longUrl);

      const submittedTx = server.submitTransaction.mock.calls[0][0];
      expect(submittedTx.operations[0].value.length).toBeLessThanOrEqual(64);
    });

    test('throws error if issuerKeypair is missing or invalid', async () => {
      await expect(mintNFT(null, 'NFT', sampleMetadataUrl)).rejects.toThrow(
        /issuer keypair or public key is required/i
      );

      await expect(
        mintNFT('invalid-public-key', 'NFT', sampleMetadataUrl)
      ).rejects.toThrow(/invalid issuer stellar address/i);
    });

    test('throws error if assetCode is missing', async () => {
      await expect(mintNFT(sampleValidPublicKey, '', sampleMetadataUrl)).rejects.toThrow(
        /asset code is required/i
      );
    });

    test('propagates error when account load fails', async () => {
      jest
        .spyOn(server, 'loadAccount')
        .mockRejectedValue(new Error('Network error: 404 Account not found'));

      await expect(
        mintNFT(sampleValidPublicKey, 'TEST', sampleMetadataUrl)
      ).rejects.toThrow(/Network error/i);
    });
  });
});
