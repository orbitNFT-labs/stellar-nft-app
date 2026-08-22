import '@testing-library/jest-dom';

// Polyfill or mock for nft.storage CJS resolution under Jest environment
jest.mock('nft.storage', () => {
  class MockNFTStorage {
    constructor(config) {
      this.token = config?.token;
    }
    async store(metadata) {
      return {
        url: 'ipfs://bafybeihdwdcefgh4dqkjv67uzcmw7ojee6xedviommnozgtku5nddifwyu/metadata.json',
        ipnft: 'bafybeihdwdcefgh4dqkjv67uzcmw7ojee6xedviommnozgtku5nddifwyu',
        data: metadata,
      };
    }
  }
  return {
    NFTStorage: MockNFTStorage,
  };
});
