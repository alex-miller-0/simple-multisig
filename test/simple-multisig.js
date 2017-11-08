/* eslint-env mocha */
/* global artifacts assert contract */

const bip39 = require('bip39');
const BN = require('bn.js');
const EthQuery = require('ethjs-query');
const hdkey = require('ethereumjs-wallet/hdkey');
const HttpProvider = require('ethjs-provider-http');
const input = require('../input.json');
const leftPad = require('left-pad');
const secrets = require('../secrets.json');
const sha3 = require('solidity-sha3').default;
const util = require('ethereumjs-util');
// const tx = require('ethereumjs-tx');
// const wallet = require('eth-lightwallet');

const SimpleMultisig = artifacts.require('./SimpleMultisig.sol');
const ethQuery = new EthQuery(new HttpProvider('http://localhost:8545'));

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

  // Generate the first N wallets of a HD wallet
  function generateFirstWallets(n, wallets, hdPathIndex) {
    const hdwallet = hdkey.fromMasterSeed(bip39.mnemonicToSeed(secrets.mnemonic));
    const node = hdwallet.derivePath(secrets.hdPath + hdPathIndex.toString());
    const secretKey = node.getWallet().getPrivateKeyString();
    const addr = node.getWallet().getAddressString();
    wallets.push([addr, secretKey]);

    const nextHDPathIndex = hdPathIndex + 1;
    if (nextHDPathIndex === n) {
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
    console.log('signing', msg, 'from', wallets[i][0]);
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
    // const MULTISIGADDR = leftPad(contract.address.slice(2), 64, '0');
    const DESTINATION = leftPad(destination.slice(2), 64, '0');
    const VALUE = leftPad(value.toString(16), 64, '0');
    const DATA = data.length > 2 ? data.slice(2) : '0';
    const NONCE = leftPad(nonce.toString(16), 64, '0');
    console.log('DESTINATION', DESTINATION, 'VALUE', VALUE, 'DATA', DATA, 'NONCE', NONCE);
    // const preHash = `0x1900${MULTISIGADDR}${DESTINATION}${VALUE}${DATA}${NONCE}`;
    const preHash = '0x1900';
    return sha3(preHash);
  }

  // Get the N first signatures (from the HD wallet) for a message formatted
  // via ERC191 to a set of params
  async function getNFirstSigs(n, to, value, data) {
    const multisig = await SimpleMultisig.deployed();
    const hash = await ERC191Hash(multisig, to, value, data);
    console.log('hash', hash);
    const wallets = generateFirstWallets(input.threshold, [], 0);
    const sortedWallets = sortWallets(wallets);
    const sigs = getSigs(hash, input.threshold, 0, sortedWallets, []);
    const soliditySigs = formatSoliditySigs(sigs);
    return soliditySigs;
  }

  // Given the instantiation params and the signature, ecrecover the address.
  async function getExpectedAddr(contract, destination, value, data, v, r, s) {
    const hash = await ERC191Hash(contract, destination, value, data);
    const pubkey = util.ecrecover(Buffer.from(hash.slice(2), 'hex'), v, r, s);
    return `0x${util.publicToAddress(pubkey).toString('hex')}`;
  }

  it('Should check the input params', async () => {
    const multisig = await SimpleMultisig.deployed();
    const owners = await getOwners(multisig, input.owners.length, 0, []);
    const threshold = await multisig.threshold.call();
    const expectedThreshold = new BN(input.threshold);
    const expectedOwners = input.owners.sort();
    assert.strictEqual(owners.length, input.owners.length);
    assert.strictEqual(threshold.toString(10), expectedThreshold.toString(10));
    for (let i = 0; i < owners.length; i += 1) {
      assert.strictEqual(owners[i], expectedOwners[i]);
    }
  });

  it('Should fund the wallet with some ether', async () => {
    const multisig = await SimpleMultisig.deployed();
    const sendAmount = 10 ** 17;
    const txHash = await multisig.send(sendAmount, { from: accounts[0] });
    const balance = await ethQuery.getBalance(multisig.address);
    assert.notEqual(txHash.tx, null);
    assert.strictEqual(sendAmount.toString(10), balance.toString(10));
  });

  it('Should send ether with the threshold of signatures', async () => {
    const multisig = await SimpleMultisig.deployed();
    const to = '0xf3ef52a1f8e11c406f6ea1959d2b72b74598037b';
    const value = 100;
    const data = 0;
    const sigs = await getNFirstSigs(input.threshold, to, value, data);
    console.log('multisig-addr2', multisig.address);
    console.log('sigs', sigs);
    // const receipt = await multisig.execute(sigs.v, sigs.r, sigs.s, to, value,
    // '0x', { from: accounts[0], gasLimit: 1000000 });
    const addr = await multisig.getSigAddr(sigs.v[0], sigs.r[0], sigs.s[0], to, value, '0x');
    console.log('got addr', addr);
    const expectedAddr = await getExpectedAddr(multisig, to, value, data, sigs.v[0],
      sigs.r[0], sigs.s[0]);
    console.log('expectedAddr', expectedAddr);
  });
});
