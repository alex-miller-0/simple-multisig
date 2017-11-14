const HDWalletProvider = require("truffle-hdwallet-provider");
const mnemonic = require('./secrets.json').mnemonic;

module.exports = {
  networks: {
    development: {
      host: 'localhost',
      port: 8545,
      network_id: '*',
      gas: 4712388,
    },
    ropsten: {
      provider: new HDWalletProvider(mnemonic, "https://ropsten.infura.io"),
      network_id: '3',
      gas: 4712388,
    },
    mainnet: {
      provider: new HDWalletProvider(mnemonic, "https://mainnet.infura.io"),
      network_id: '3',
      gas: 4712388,
    },
  },
};
