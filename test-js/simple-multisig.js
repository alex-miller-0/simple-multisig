// Tests for JS functions
// Before running this test, create a new testrpc instance setting the -m flag
// to the mnemonic in secrets.json
const SimpleMultisig = require('../index.js').SimpleMultisig;
const schema = require('../build/contracts/SimpleMultisig.json');
const secrets = require('../secrets.json');
const hdkey = require('ethereumjs-wallet/hdkey');
const bip39 = require('bip39');
const sha3 = require('solidity-sha3').default;

const HDPATH = 'm/44\'/60\'/0\'/0/';

function generateAccounts(mnemonic, hdPathIndex, totalToGenerate, accumulatedAddrs) {
  const hdwallet = hdkey.fromMasterSeed(bip39.mnemonicToSeed(mnemonic));
  const node = hdwallet.derivePath(HDPATH + hdPathIndex.toString());
  const addr = node.getWallet().getAddressString();
  accumulatedAddrs.push({
    addr,
  });

  const nextHDPathIndex = hdPathIndex + 1;
  if (nextHDPathIndex === totalToGenerate) {
    return accumulatedAddrs;
  }

  return generateAccounts(mnemonic, nextHDPathIndex, totalToGenerate, accumulatedAddrs);
}

// Instantiate the contract based on the deployment object
const contractAddr = schema.networks[Object.keys(schema.networks)[0]].address;
const contract = new SimpleMultisig('http://localhost:8545', contractAddr);

// Since this should be deployed on a local network, we can derive accounts
// from the mnemonic that will be owners.
const accountsUnsorted = generateAccounts(secrets.mnemonic, 0, 5, []);
const accounts = accountsUnsorted.sort();

// Format the message to sign
function formatMsg(destination, value, data) {
  return new Promise((resolve, reject) => {
    contract.ERC191Hash()
  })
}

//============
// SCRIPT
//============

const destination = sha3(Math.random(2)).slice(0, 42);
const value = 10000;

contract.isOwner(accounts[0].addr)
  .then((result) => {
    console.log('result', result);
    return contract.ERC191Hash({ destination: destination, value: value })
  })
  .catch((err) => { throw new Error(err); });
