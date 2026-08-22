import * as StellarSdk from 'stellar-sdk';
import { signTransaction } from '@stellar/freighter-api';

// ================================
// STELLAR NETWORK CONFIGURATION
// ================================

// Use Testnet for development
export const NETWORK = 'TESTNET';

export const server = new StellarSdk.Horizon.Server(
  'https://horizon-testnet.stellar.org'
);

export const networkPassphrase = StellarSdk.Networks.TESTNET;

// ================================
// ACCOUNT FUNCTIONS
// ================================

// Get account details from Stellar
export const getAccount = async (publicKey) => {
  try {
    const account = await server.loadAccount(publicKey);
    return account;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      throw new Error(
        'Account not found. Fund it at https://friendbot.stellar.org'
      );
    }
    throw error;
  }
};

// Fund a new Testnet account using Friendbot
export const fundTestnetAccount = async (publicKey) => {
  try {
    const response = await fetch(
      `https://friendbot.stellar.org?addr=${publicKey}`
    );
    const result = await response.json();
    return result;
  } catch (error) {
    throw new Error('Failed to fund account: ' + error.message);
  }
};

// Get XLM balance of an account
export const getBalance = async (publicKey) => {
  try {
    const account = await getAccount(publicKey);
    const xlmBalance = account.balances.find(
      (b) => b.asset_type === 'native'
    );
    return xlmBalance ? parseFloat(xlmBalance.balance) : 0;
  } catch (error) {
    return 0;
  }
};

// ================================
// NFT FUNCTIONS
// ================================

// Create a unique NFT asset on Stellar
export const createNFTAsset = (assetCode, issuerPublicKey) => {
  // Asset code max 12 characters
  const code = assetCode.replace(/[^A-Z0-9]/gi, '').slice(0, 12);
  return new StellarSdk.Asset(code.toUpperCase(), issuerPublicKey);
};

// Get all NFTs owned by an account
// NOTE: This function uses classic Stellar asset balances — it is preserved
// for transfer/trustline flows that deal with asset-based tokens.
// For the Soroban-native OrbitNFT contract, use getWalletNFTs() in contract.js
// instead, which queries owner_of() and token_metadata() directly.
//
// "balance == 1" heuristic caveat: filtering by balance === 1 is a common
// NFT proxy for classic Stellar assets, but it is NOT a guaranteed indicator —
// fungible tokens, small-denomination assets, or dust balances can also have
// balance == 1. This heuristic should NOT be used for ownership proofs.
export const getNFTs = async (publicKey) => {
  // Let errors propagate so callers can distinguish "fetch failed" from
  // "wallet has no NFTs". Previously this caught all errors and returned [],
  // making network failures look identical to an empty wallet.
  const account = await getAccount(publicKey);

  // Filter to classic Stellar custom assets with balance == 1 (NFT heuristic).
  const nfts = account.balances.filter(
    (balance) =>
      balance.asset_type !== 'native' &&
      parseFloat(balance.balance) === 1
  );

  return nfts.map((nft) => ({
    code: nft.asset_code,
    issuer: nft.asset_issuer,
    balance: nft.balance,
  }));
};

// Mint an NFT asset on Stellar Testnet with IPFS metadata
export const mintNFT = async (issuerKeypair, assetCode, metadataUrl, options = {}) => {
  try {
    if (!issuerKeypair) {
      throw new Error('Issuer keypair or public key is required');
    }
    if (!assetCode) {
      throw new Error('Asset code is required');
    }

    const issuerPublicKey =
      typeof issuerKeypair === 'string'
        ? issuerKeypair
        : typeof issuerKeypair.publicKey === 'function'
        ? issuerKeypair.publicKey()
        : issuerKeypair.publicKey || String(issuerKeypair);

    if (!isValidAddress(issuerPublicKey)) {
      throw new Error(`Invalid issuer Stellar address: ${issuerPublicKey}`);
    }

    const asset = createNFTAsset(assetCode, issuerPublicKey);
    const account = await getAccount(issuerPublicKey);

    const txBuilder = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: networkPassphrase || StellarSdk.Networks.TESTNET,
    });

    const dataValue =
      typeof metadataUrl === 'string' && Buffer.byteLength(metadataUrl) > 64
        ? metadataUrl.slice(0, 64)
        : (metadataUrl || '');

    txBuilder.addOperation(
      StellarSdk.Operation.manageData({
        name: 'nft_metadata',
        value: dataValue,
      })
    );

    const destination = options.destination || issuerPublicKey;
    txBuilder.addOperation(
      StellarSdk.Operation.payment({
        destination,
        asset,
        amount: '1',
      })
    );

    txBuilder.setTimeout(30);
    const transaction = txBuilder.build();

    const canSignDirectly =
      issuerKeypair &&
      typeof issuerKeypair === 'object' &&
      typeof issuerKeypair.sign === 'function' &&
      (typeof issuerKeypair.canSign === 'function'
        ? issuerKeypair.canSign()
        : Boolean(issuerKeypair.secret || issuerKeypair._secretSeed));

    if (canSignDirectly) {
      transaction.sign(issuerKeypair);
      const result = await server.submitTransaction(transaction);
      return result;
    } else {
      const xdr = transaction.toXDR();
      let signedXdr = await signTransaction(xdr, { network: 'TESTNET' });
      if (signedXdr && typeof signedXdr === 'object') {
        signedXdr = signedXdr.signedTxXdr || signedXdr.signedXDR || signedXdr;
      }
      const signedTransaction = StellarSdk.TransactionBuilder.fromXDR(
        signedXdr,
        networkPassphrase
      );
      const result = await server.submitTransaction(signedTransaction);
      return result;
    }
  } catch (error) {
    throw new Error(`Minting failed: ${error.message}`);
  }
};

// ================================
// TRANSACTION HELPERS
// ================================

// Check if a Stellar address is valid
export const isValidAddress = (address) => {
  try {
    StellarSdk.Keypair.fromPublicKey(address);
    return true;
  } catch {
    return false;
  }
};

// Format a long Stellar address to short form (first 4 chars + ... + last 4 chars)
export const truncateAddress = (address) => {
  if (!address || typeof address !== 'string') return '';
  if (address.length <= 8) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};

export const shortAddress = (address) => {
  return truncateAddress(address);
};

// Format XLM balance
export const formatXLM = (amount) => {
  return parseFloat(amount).toFixed(2) + ' XLM';
};
