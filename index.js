/* Interact with a multisig wallet. Pull public keys out of a cosigned message.*/

const util = require('ethereumjs-util');
const web3 = require('web3');
const HttpProvider = require('ethjs-provider-http');
const EthQuery = require('ethjs-query');
const schema = require('./build/contracts/SimpleMultiSig.json');
const abi = require('ethereumjs-abi');

class SimpleMultisig {
  constructor(provider, address) {
    if (address.slice(2).length != 40 || address.slice(0, 2) != '0x')
      throw new Error('Invalid contract address provided.');

    this.rpc = new EthQuery(new HttpProvider(provider));
    this.abi = schema.abi;
    this.address = address;
  };

  getOwners() {
    async function getOwner(n, i, owners) {
      if (n == i) { return owners; }
      const data = abi.encode(this.abi, 'ownersArr()', `0x${leftPad(i.toString(16), 64, '0')}`);
      const owner_i = await this.rpc.call(data, { to: this.address });
      owners.push(owner_i);
      return getOwner(n, i + 1, owners);
    }
    const data1 = abi.encode(this.abi, 'numOwners()');
    // const n = await this.rpc.call(data, { to: this.address });
    // const owners = await getOwner(n, 0, []);
    // console.log(owners);
  }
}

exports.SimpleMultisig = SimpleMultisig;
