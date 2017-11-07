/* eslint-env mocha */
/* global artifacts assert contract */

const SimpleMultisig = artifacts.require('./SimpleMultisig.sol');
// const fs = require('fs');
// const HttpProvider = require('ethjs-provider-http');
// const EthRPC = require('ethjs-rpc');
// const EthQuery = require('ethjs-query');

// const ethRPC = new EthRPC(new HttpProvider('http://localhost:8545'));
// const ethQuery = new EthQuery(new HttpProvider('http://localhost:8545'));

contract('SimpleMultisig', (accounts) => {
  assert(accounts.length > 0);
  console.log(accounts);

  it('Should get the addresses deployed to the contract', async () => {
    const multisig = await SimpleMultisig.deployed();
    console.log('multisig', multisig);
  });
});
