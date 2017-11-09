/* eslint-env mocha */
/* global artifacts assert contract */

const bip39 = require('bip39');
// const BN = require('bn.js');
const EthQuery = require('ethjs-query');
const hdkey = require('ethereumjs-wallet/hdkey');
const HttpProvider = require('ethjs-provider-http');
const leftPad = require('left-pad');
const secrets = require('../secrets.json');
const sha3 = require('solidity-sha3').default;
const util = require('ethereumjs-util');
// const tx = require('ethereumjs-tx');
// const wallet = require('eth-lightwallet');

const SimpleMultisig = artifacts.require('./SimpleMultisig.sol');
const HumanStandardToken = artifacts.require('tokens/HumanStandardToken.sol');
const ethQuery = new EthQuery(new HttpProvider('http://localhost:8545'));
let threshold;
let owners;

contract('SimpleMultisig', (accounts) => {
  assert(accounts.length > 0);

  function isEVMException(err) {
    return err.toString().includes('VM Exception');
  }

  // You can only get a single piece of data based on an index from a solidity
  // array. This will return an unsorted array of accounts for the multisig.
  async function getOwners(contract, i, addrs) {
    try {
      const addr = await contract.ownersArr.call(i);
      addrs.push(addr);
      return getOwners(contract, i + 1, addrs);
    } catch (err) {
      return addrs;
    }
  }

  // Generate the first N wallets of a HD wallet
  function generateFirstWallets(n, wallets, hdPathIndex) {
    const hdwallet = hdkey.fromMasterSeed(bip39.mnemonicToSeed(secrets.mnemonic));
    const node = hdwallet.derivePath(secrets.hdPath + hdPathIndex.toString());
    const secretKey = node.getWallet().getPrivateKeyString();
    const addr = node.getWallet().getAddressString();
    wallets.push([addr, secretKey]);
    const nextHDPathIndex = hdPathIndex + 1;
    if (nextHDPathIndex >= n) {
      return wallets;
    }
    return generateFirstWallets(n, wallets, nextHDPathIndex);
  }

  // Sort a set of wallets of form [addr, pkey] based on their addresses
  function sortWallets(wallets) {
    function sortF(a, b) {
      if (a[0] === b[0]) return 0;
      return (a[0] < b[0]) ? -1 : 1;
    }
    return wallets.sort(sortF);
  }

  // Get signatures on a peice of data from the first n accounts
  function getSigs(msg, n, i, wallets, sigs) {
    if (i === n) { return sigs; }
    const msgBuf = Buffer.from(msg.slice(2), 'hex');
    const pkey = Buffer.from(wallets[i][1].slice(2), 'hex');
    const sig = util.ecsign(msgBuf, pkey);
    sigs.push({ r: sig.r.toString('hex'), s: sig.s.toString('hex'), v: sig.v });
    return getSigs(msg, n, i + 1, wallets, sigs);
  }

  // Given an array of signature objects (r, s, v), format them for solidity
  function formatSoliditySigs(sigs) {
    const newSigs = { r: [], s: [], v: [] };
    for (let i = 0; i < sigs.length; i += 1) {
      newSigs.r.push(`0x${leftPad(sigs[i].r, 64, '0')}`);
      newSigs.s.push(`0x${leftPad(sigs[i].s, 64, '0')}`);
      // newSigs.v.push(leftPad(sigs[i].v.toString(16), 64, '0'));
      newSigs.v.push(sigs[i].v);
    }
    return newSigs;
  }

  // Given a contract and some parameters, hash the message according to
  // ERC191 (https://github.com/ethereum/EIPs/issues/191)
  async function ERC191Hash(contract, destination, value, data) {
    const nonce = await contract.nonce.call();
    const MULTISIGADDR = contract.address.slice(2);
    const DESTINATION = destination.slice(2);
    const VALUE = leftPad(value.toString(16), 64, '0');
    const DATA = data && data.length > 2 ? data.slice(2) : null;
    const NONCE = leftPad(nonce.toString(16), 64, '0');
    let preHash;

    // data is encoded as bytes in solidity (the last param). If there is no
    // data, it should not be included at all.
    if (DATA !== null && DATA !== '0') {
      preHash = `0x1900${MULTISIGADDR}${DESTINATION}${VALUE}${DATA}${NONCE}`;
    } else {
      preHash = `0x1900${MULTISIGADDR}${DESTINATION}${VALUE}${NONCE}`;
    }
    return sha3(preHash);
  }

  // Get the N first signatures (from the HD wallet) for a message formatted
  // via ERC191 to a set of params
  async function getNFirstSigs(n, to, value, data) {
    const multisig = await SimpleMultisig.deployed();
    const hash = await ERC191Hash(multisig, to, value, data);
    const wallets = generateFirstWallets(n, [], 0);
    const sortedWallets = sortWallets(wallets);
    const sigs = getSigs(hash, n, 0, sortedWallets, []);
    const soliditySigs = formatSoliditySigs(sigs);
    return soliditySigs;
  }

  // Given the instantiation params and the signature, ecrecover the address.
  // async function getExpectedAddr(contract, destination, value, data, v, r, s) {
  //   const hash = await ERC191Hash(contract, destination, value, data);
  //   const pubkey = util.ecrecover(Buffer.from(hash.slice(2), 'hex'), v, r, s);
  //   return `0x${util.publicToAddress(pubkey).toString('hex')}`;
  // }

  it('Should get the params', async () => {
    const multisig = await SimpleMultisig.deployed();
    owners = await getOwners(multisig, 0, []);
    const thresholdTmp = await multisig.threshold.call();
    threshold = parseInt(thresholdTmp.toString(10), 10);
    const tmpAccounts = accounts.slice(0, 5).sort();
    assert.strictEqual(owners[0], tmpAccounts[0]);
  });

  it('Should fund the wallet with some ether', async () => {
    const multisig = await SimpleMultisig.deployed();
    const sendAmount = 10 ** 17;
    const txHash = await multisig.send(sendAmount, { from: accounts[0] });
    const balance = await ethQuery.getBalance(multisig.address);
    assert.notEqual(txHash.tx, null);
    assert.strictEqual(sendAmount.toString(10), balance.toString(10));
  });

  it('Should send ether with the threshold of signatures (no data)', async () => {
    const multisig = await SimpleMultisig.deployed();
    const to = sha3(Math.random(1)).slice(0, 42);
    const value = 100;
    const data = '0x';
    const sigs = await getNFirstSigs(threshold, to, value, data);
    await multisig.execute(sigs.v, sigs.r, sigs.s, to, value, data, { gasLimit: 1000000 });
    const balance = await ethQuery.getBalance(to);
    assert.strictEqual(value.toString(), balance.toString(10));
  });

  it('Should send ether with lower than the threshold of signatures (no data)', async () => {
    const multisig = await SimpleMultisig.deployed();
    const to = sha3(Math.random(2)).slice(0, 42);
    const value = 100;
    const data = '0x';
    const sigs = await getNFirstSigs(threshold - 1, to, value, data);
    try {
      await multisig.execute(sigs.v, sigs.r, sigs.s, to, value, data, { gasLimit: 1000000 });
    } catch (err) {
      const errMsg = err.toString();
      assert(isEVMException(err), errMsg);
    }
  });

  it('Should send ether with more than the threshold of signatures (no data)', async () => {
    const multisig = await SimpleMultisig.deployed();
    const to = sha3(Math.random(2)).slice(0, 42);
    const value = 100;
    const data = '0x';
    const sigs = await getNFirstSigs(threshold + 1, to, value, data);
    try {
      await multisig.execute(sigs.v, sigs.r, sigs.s, to, value, data, { gasLimit: 1000000 });
    } catch (err) {
      const errMsg = err.toString();
      assert(isEVMException(err), errMsg);
    }
  });

  it('Should send a token to the multisig', async () => {
    const token = await HumanStandardToken.deployed();
    console.log('token.addresss', token.address);
  });
});
