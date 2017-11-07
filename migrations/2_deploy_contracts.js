var SimpleMultisig = artifacts.require("./SimpleMultisig.sol");

module.exports = function(deployer) {
  deployer.deploy(SimpleMultisig);
};
