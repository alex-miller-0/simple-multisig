/* global artifacts */

const SimpleMultisig = artifacts.require('./SimpleMultisig.sol');
const input = require('../input.json');

module.exports = (deployer) => {
  deployer.deploy(SimpleMultisig, input.threshold, input.owners.sort());
};
