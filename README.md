# simple-multisig
A node tool for deploying a simple multisig contract on Ethereum. The contract itself was written by Christian Lundkvist (see [repo](https://github.com/christianlundkvist/simple-multisig/blob/master/contracts/SimpleMultiSig.sol)). It is a simple threshold multisig contract, which requires addresses to be input in order (i.e. addr0 evaluates to < address1, etc).

To deploy your contract using this repo, create a file called `input.json` in the root directory. An example is:

```
{
  "accounts": [
    "0x190b91d011634da9fac57fd4c6fe0a11cd881702",
    "0xe9e3b642276cb1421644dd4eff689beaf860c650",
    "0x2cb5f3e3b1e1bcb7bd59a3b28b306e7e86cb73e3",
    "0xb4267280f2f90988a91163985a8210f24af2c670",
    "0x618b2b8e6ab1f1149959990c0b123c87c8e7c7eb"
  ],
  "threshold": 3
}
```

Note that the addresses in the JSON file do not need to be sorted.

With the file written, use:

```
truffle migrate
```

To redeploy (e.g. with a new set of addresses), delete your `build/` directory and rerun your migrations.
