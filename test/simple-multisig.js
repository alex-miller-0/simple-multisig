/* eslint-env mocha */
/* global artifacts assert contract */

const SimpleMultisig = artifacts.require('./SimpleMultisig.sol');
const input = require('../input.json');
const BN = require('bn.js');
// const HttpProvider = require('ethjs-provider-http');
// const EthRPC = require('ethjs-rpc');
// const EthQuery = require('ethjs-query');

// const ethRPC = new EthRPC(new HttpProvider('http://localhost:8545'));
// const ethQuery = new EthQuery(new HttpProvider('http://localhost:8545'));

contract('SimpleMultisig', (accounts) => {
  assert(accounts.length > 0);

  // You can only get a single piece of data based on an index from a solidity
  // array. This will return an unsorted array of accounts for the multisig.
  async function getOwners(contract, length, i, addrs) {
    if (i === length) { return addrs; }
    const addr = await contract.ownersArr.call(i);
    addrs.push(addr);
    return getOwners(contract, length, i + 1, addrs);
  }


  it('Should get the addresses deployed to the contract', async () => {
    const multisig = await SimpleMultisig.deployed();
    const owners = await getOwners(multisig, input.owners.length, 0, []);
    const threshold = await multisig.threshold.call();
    const expectedThreshold = new BN(input.threshold);
    assert.strictEqual(owners.length, input.owners.length);
    assert.strictEqual(threshold.toString(10), expectedThreshold.toString(10));
  });
});
