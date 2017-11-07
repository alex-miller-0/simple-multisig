/* global artifacts */

const SimpleMultisig = artifacts.require('./SimpleMultisig.sol');

module.exports = (deployer) => {
  deployer.deploy(SimpleMultisig);
};
