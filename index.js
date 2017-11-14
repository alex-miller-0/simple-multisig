/* Interact with a multisig wallet. Pull public keys out of a cosigned message. */

const Promise = require('bluebird');
const Web3 = require('web3');
const HttpProvider = require('ethjs-provider-http');
// const EthQuery = require('ethjs-query');
const schema = require('./build/contracts/SimpleMultisig.json');

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
      const fCall = this.web3.eth.abi.encodeFunctionCall({
        name: 'isOwner',
        type: 'function',
        inputs: [{ type: 'address' }],
      }, [addr]);
      this.web3.eth.call({ to: this.address, data: fCall })
        .then((result) => { resolve(result); })
        .catch((err) => { reject(err); });
    });
  }
}

exports.SimpleMultisig = SimpleMultisig;
