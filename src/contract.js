import * as StellarSdk from 'stellar-sdk';
import { signTransaction } from '@stellar/freighter-api';

const CONTRACT_ID = 'CBU7UVJM7FAXB7AHCDMTKVJSUEE3PVTV2ROFOKO2P3IC4IKRTB45IHFA';
const RPC_URL = 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET;

// Public IPFS gateway used to resolve ipfs:// URIs returned by the contract.
// Multiple fallback gateways can be tried in order if the primary is slow.
export const IPFS_GATEWAY = 'https://ipfs.io/ipfs/';

// Timeout (ms) for a single IPFS metadata/image fetch. Prevents one
// dead gateway from hanging the entire gallery load.
export const IPFS_FETCH_TIMEOUT_MS = 8000;

// Maximum number of concurrent Soroban read calls when fetching wallet NFTs.
// Keeps the RPC endpoint from being overwhelmed for large wallets.
export const CONCURRENCY_LIMIT = 5;

const server = new StellarSdk.SorobanRpc.Server(RPC_URL);

export const mintNFTOnChain = async (userPublicKey, name, description, imageUri) => {
  try {
    const contract = new StellarSdk.Contract(CONTRACT_ID);
    const account = await server.getAccount(userPublicKey);

    const transaction = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        contract.call(
          'mint',
          StellarSdk.nativeToScVal(userPublicKey, { type: 'address' }),
          StellarSdk.nativeToScVal(name, { type: 'string' }),
          StellarSdk.nativeToScVal(description, { type: 'string' }),
          StellarSdk.nativeToScVal(imageUri, { type: 'string' })
        )
      )
      .setTimeout(30)
      .build();

    const prepared = await server.prepareTransaction(transaction);
    const xdr = prepared.toXDR();
    const signedXdr = await signTransaction(xdr, { network: 'TESTNET' });
    const signedTransaction = StellarSdk.TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
    const result = await server.sendTransaction(signedTransaction);

    let response = await server.getTransaction(result.hash);
    while (response.status === 'NOT_FOUND') {
      await new Promise((r) => setTimeout(r, 1500));
      response = await server.getTransaction(result.hash);
    }

    if (response.status === 'SUCCESS') {
      const tokenId = StellarSdk.scValToNative(response.returnValue);
      return { success: true, tokenId, hash: result.hash };
    } else {
      throw new Error('Transaction failed: ' + response.status);
    }
  } catch (error) {
    throw new Error('Minting failed: ' + error.message);
  }
};

export const getTokenOwner = async (tokenId) => {
  try {
    const contract = new StellarSdk.Contract(CONTRACT_ID);
    const account = await server.getAccount(
      'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
    );

    const transaction = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        contract.call('owner_of', StellarSdk.nativeToScVal(tokenId, { type: 'u32' }))
      )
      .setTimeout(30)
      .build();

    const simulated = await server.simulateTransaction(transaction);
    return StellarSdk.scValToNative(simulated.result.retval);
  } catch (error) {
    return null;
  }
};

export const getTotalSupply = async () => {
  try {
    const contract = new StellarSdk.Contract(CONTRACT_ID);
    const account = await server.getAccount(
      'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
    );

    const transaction = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call('total_supply'))
      .setTimeout(30)
      .build();

    const simulated = await server.simulateTransaction(transaction);
    return StellarSdk.scValToNative(simulated.result.retval);
  } catch (error) {
    return 0;
  }
};

export { CONTRACT_ID };

// ================================
// IPFS HELPERS
// ================================

/**
 * Convert an ipfs:// URI to an HTTPS gateway URL.
 * Returns null for falsy/invalid input so callers can apply a fallback.
 *
 * Example: "ipfs://Qm..." → "https://ipfs.io/ipfs/Qm..."
 */
export const ipfsUriToUrl = (uri) => {
  if (!uri || typeof uri !== 'string') return null;
  if (uri.startsWith('ipfs://')) {
    const hash = uri.slice('ipfs://'.length);
    // Treat placeholder / no-image URIs as absent
    if (!hash || hash.startsWith('placeholder-') || hash === 'no-image') {
      return null;
    }
    return `${IPFS_GATEWAY}${hash}`;
  }
  // Already an https URL — pass through
  if (uri.startsWith('https://') || uri.startsWith('http://')) return uri;
  return null;
};

/**
 * Fetch-with-timeout helper. Rejects with a TimeoutError after ms milliseconds
 * so that slow/unreachable IPFS gateways do not stall the gallery indefinitely.
 */
export const fetchWithTimeout = (url, ms = IPFS_FETCH_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
};

/**
 * Bounded concurrency helper — runs `tasks` (array of zero-arg async
 * functions) with at most `limit` running simultaneously.
 *
 * Returns an array of {status:'fulfilled',value} | {status:'rejected',reason}
 * objects in the same order as the input tasks (like Promise.allSettled but
 * with a concurrency cap).
 */
export const pLimit = async (tasks, limit = CONCURRENCY_LIMIT) => {
  const results = new Array(tasks.length);
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < tasks.length) {
      const index = nextIndex++;
      try {
        results[index] = { status: 'fulfilled', value: await tasks[index]() };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  };

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, worker);
  await Promise.all(workers);
  return results;
};

// ================================
// TOKEN METADATA (ON-CHAIN)
// ================================

/**
 * Read the on-chain metadata for a single token via a simulated Soroban call
 * to `token_metadata(tokenId)`.
 *
 * Returns { name, description, imageUri } or throws on failure.
 */
export const getTokenMetadata = async (tokenId) => {
  const contract = new StellarSdk.Contract(CONTRACT_ID);
  const account = await server.getAccount(
    'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
  );

  const transaction = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        'token_metadata',
        StellarSdk.nativeToScVal(tokenId, { type: 'u32' })
      )
    )
    .setTimeout(30)
    .build();

  const simulated = await server.simulateTransaction(transaction);
  const raw = StellarSdk.scValToNative(simulated.result.retval);

  return {
    name: raw.name || `OrbitNFT #${tokenId}`,
    description: raw.description || '',
    imageUri: raw.image_uri || null,
  };
};

/**
 * Fetch all NFTs owned by `walletAddress` from the Soroban contract.
 *
 * Algorithm:
 *   1. total_supply() → total token count
 *   2. For each tokenId [0, total), call owner_of(tokenId) concurrently
 *      (bounded by CONCURRENCY_LIMIT) to find owned tokens.
 *   3. For each owned token, call token_metadata(tokenId) to get on-chain
 *      name/description/image_uri.
 *
 * Error semantics:
 *   - Throws a descriptive Error on contract/RPC failure so the caller can
 *     distinguish a fetch failure from a genuinely empty wallet.
 *   - Per-token metadata failures are caught and return a minimal fallback
 *     object rather than failing the whole load.
 *
 * Note on "balance == 1" heuristic:
 *   This app does NOT use Stellar classic assets for NFTs — ownership is
 *   enforced by the Soroban contract's owner_of() mapping. The Horizon
 *   API balance approach (balance === 1 filter) is NOT used here because
 *   these NFTs are contract-native and have no on-chain Stellar asset
 *   balance. If this app were ever migrated to classic Stellar assets,
 *   the balance-1 heuristic would need to be added, but it would still
 *   only be a heuristic (non-NFT assets can also carry balance == 1).
 */
export const getWalletNFTs = async (walletAddress) => {
  if (!walletAddress) {
    return [];
  }

  let totalSupply;
  try {
    totalSupply = await getTotalSupply();
  } catch (err) {
    throw new Error(
      'Failed to read NFT supply from the Soroban contract: ' + err.message
    );
  }

  if (totalSupply === 0) {
    return [];
  }

  // Phase 1: find which tokenIds are owned by walletAddress (bounded concurrency)
  const ownerTasks = Array.from({ length: totalSupply }, (_, i) => async () => {
    const owner = await getTokenOwner(i);
    return { id: i, owner };
  });

  const ownerResults = await pLimit(ownerTasks, CONCURRENCY_LIMIT);

  const ownedIds = ownerResults
    .filter(
      (r) =>
        r.status === 'fulfilled' &&
        r.value.owner &&
        r.value.owner === walletAddress
    )
    .map((r) => r.value.id);

  if (ownedIds.length === 0) {
    return [];
  }

  // Phase 2: fetch on-chain metadata for each owned token (bounded concurrency)
  // Per-item metadata failure returns a fallback rather than crashing the gallery.
  const metaTasks = ownedIds.map((id) => async () => {
    try {
      const meta = await getTokenMetadata(id);
      return {
        id,
        name: meta.name,
        description: meta.description,
        imageUri: meta.imageUri,
        metadataError: false,
      };
    } catch {
      return {
        id,
        name: `OrbitNFT #${id}`,
        description: '',
        imageUri: null,
        metadataError: true,
      };
    }
  });

  const metaResults = await pLimit(metaTasks, CONCURRENCY_LIMIT);

  // All metadata tasks are wrapped in try/catch so none should reject here,
  // but fall back gracefully if they somehow do.
  return metaResults.map((r, idx) => {
    if (r.status === 'fulfilled') return r.value;
    return {
      id: ownedIds[idx],
      name: `OrbitNFT #${ownedIds[idx]}`,
      description: '',
      imageUri: null,
      metadataError: true,
    };
  });
};
