/* Interact with a multisig wallet. Pull public keys out of a cosigned message. */

const Promise = require('bluebird');
const Web3 = require('web3');
const HttpProvider = require('ethjs-provider-http');
const schema = require('./build/contracts/SimpleMultisig.json');
const sha3 = require('solidity-sha3').default;
const util = require('ethereumjs-util');

class SimpleMultisig {
  constructor(provider, address) {
    if (address.slice(2).length !== 40 || address.slice(0, 2) !== '0x') {
      throw new Error('Invalid contract address provided.');
    }
    this.web3 = new Web3(new HttpProvider(provider));
    this.abi = schema.abi;
    this.address = address;
  }

  // Check the contract to see if the address provided belongs to an owner.
  isOwner(addr) {
    return new Promise((resolve, reject) => {
      const isOwnerCall = this.web3.eth.abi.encodeFunctionCall({
        name: 'isOwner',
        type: 'function',
        inputs: [{ type: 'address' }],
      }, [addr]);
      this.web3.eth.call({ to: this.address, data: isOwnerCall })
        .then((result) => { resolve(result); })
        .catch((err) => { reject(err); });
    });
  }

  getNonce() {
    return new Promise((resolve, reject) => {
      const nonceCall = this.web3.eth.abi.encodeFunctionCall({
        name: 'nonce',
        type: 'function',
        inputs: [],
      });
      this.web3.eth.call({ to: this.address, data: nonceCall })
        .then((nonce) => { resolve(nonce); })
        .catch((err) => { reject(err); })
    })
  }

  // Given a contract and some parameters, hash the message according to
  // ERC191 (https://github.com/ethereum/EIPs/issues/191)
  ERC191Hash(txData) {
    return new Promise((resolve, reject) => {
      if (!txData.destination || !txData.value) {
        reject('txData must contain "destination" and "value" params ("data" optional). Please see https://github.com/ethereum/EIPs/issues/191 for more information.');
      }
      if (txData.destination.slice(2).length !== 40 || txData.destination.slice(0, 2) !== '0x') {
        reject('Invalid address provided (destination).');
      }
      if (typeof txData.value !== 'number') {
        reject('Invalid number provided (value).');
      }
      let preHash;
      this.getNonce()
        .then((nonce) => {
          console.log('got nonce', nonce);
          if (txData.data !== null && txData.data !== undefined && txData.data !== '0') {
            preHash = `0x1900${this.address}${txData.destination}${txData.value}${txData.data}${nonce}`;
          } else {
            preHash = `0x1900${this.address}${txData.destination}${txData.value}${nonce}`;
          }
          const hash = sha3(preHash);
          resolve(hash);
        })
        .catch((err) => { reject(err); });
    });
  }

  // Check if a given signature belongs to an owner
  // tdData = { destination, value, data }
  isCosignature(txData, v, r, s) {
    return new Promise((resolve, reject) => {
      let hash;
      this.ERC191Hash(txData)
        .then((hash_) => {
          hash = hash_;
          return util.ecrecover(Buffer.from(hash.slice(2), 'hex'), v, Buffer.from(r, 'hex'), Buffer.from(s, 'hex'));
        })
        .then((pubKey) => {
          const signer = util.publicToAddress(pubKey);
          return this.isOwner(signer.toString('hex'));
        })
        .then((isOwner_) => { resolve(isOwner_); })
        .catch((err) => { reject(err); });
    });
  }
}

exports.SimpleMultisig = SimpleMultisig;
