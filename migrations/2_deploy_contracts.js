/* global artifacts */

const SimpleMultisig = artifacts.require('./SimpleMultisig.sol');
const input = require('../input.json');

module.exports = (deployer, network, accounts) => {
  if (network === 'mainnet') {
    deployer.deploy(SimpleMultisig, input.threshold, input.owners.sort());
  } else {
    // Test a 3-of-5 multisig
    const threshold = 3;
    const owners = accounts.slice(0, 5).sort();
    deployer.deploy(SimpleMultisig, threshold, owners);
  }
};
