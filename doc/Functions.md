# Functions

## Main Functions

### initializeActivity

```solidity
function initializeActivity(
  address _paymentToken,
  uint256 _price,
  bytes32 _merkleRoot
) external onlyOwner {}

```

We use this function to start an activity and set up the related info of this activity.

- Parameters:

  - `_paymentToken`: the required payment token address. Zero address for native token
  - `_price`: the initial sale price for `PASS`.
  - `_merkleRoot`: the root of the merkle tree which maintain the whitelist.

- Requirement:

  - can only be used by contract owner.

- Return:

  - N/A

- Events:

  ```solidity
    event ActivityStarted(uint256 currentTime, address paymentToken, uint256 price, bytes32 merkleRoot);
  ```

### setPublicMint

```solidity
function setPublicMint(bool _isPublic) external onlyOwner {}

```

Public sale switch.

- Parameters:

  - `_isPublic`: `true` for public sale and `false` for whitelist sale.

- Requirement:

  - can only be used by contract owner.

- Return:

  - N/A

- Events:

  - N/A

### updateWhitelist

```solidity
function updateWhitelist(bytes32 _merkleRoot) external onlyOwner {}

```

Use this function to update whitelist merkle tree root.

- Parameters:

  - `_merkleRoot`: new merkle tree root.

- Requirement:

  - can only be used by contract owner.

- Return:

  - N/A

- Events:

  ```solidity
  emit WhitelistUpdated(merkleRoot, _merkleRoot);
  ```

### changePrice

```solidity
function changePrice(address _paymentToken, uint256 _newPrice) external onlyOwner {}

```

Use this function to change the sale price and payment token.

- Parameters:

  - `_paymentToken`: new payment token address, zero address for native token.
  - `_newPrice`: new sale price.

- Requirement:

  - can only be used by contract owner.

- Return:

  - N/A

- Events:

  ```solidity
  event PriceChanged(address oldToken, uint256 oldPrice, address newToken, uint256 newPrice);
  ```

### withdrawToken

```solidity
function withdrawToken(address _token, uint256 _amount) external onlyOwner {}

```

Use this function to withdraw the income. If the `amount` is currently larger than the balance in this contract, you can only withdraw the balance.

- Parameters:

  - `_token`: the payment token address, zero address for native token.
  - `_amount`: the token amount

- Requirement:

  - can only be used by contract owner.

- Return:

  - N/A

- Events:
  - N/A

### freeMint

```solidity
function freeMint(bytes32[] calldata _merkleProof) public payable {}

```

- Workflow:

  - Require the activity is initiated
  - Require the caller address is not marked as minted
  - Mark the caller address as minted.
  - Sale rule:
    - Public sale:
      - If `price` > 0:
        - If payment token is zero address, require `msg.value` > price. The extra token will be refunded.
        - If payment token is ERC20 token, require the `balance` and `allowance` > price.
      - If `price` == 0:
        - Mint for caller
    - Whitelist sale:
      - Require the merkle proof is valid (i.e. the address is in whitelist).
      - The payment rule is the same as public sale.

- Parameters:

  - `_merkleProof`: the merkle proof to prove the `msg.sender` is in whitelist. For public sale, it could be any value.

- Requirement:

  - described above.

- Return:

  - N/A

- Events:

  ```solidity
  event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

  ```

  It emits an event `Transfer` defined in standard ERC721 lib and the `from` is zero address.

### airdrop

```solidity
function airdrop(address _to) public onlyOwner {}

```

Contract owner can use this function to airdrop 1 PASS to any account **who has not minted yet**. The recipient will be marked as minted after this airdrop.

- Parameters:

  - `_to`: the airdrop recipient.

- Requirement:

  - can only be used by contract owner.
  - the recipient account has not minted yet.

- Return:

  - N/A

- Events:

  ```solidity
  event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

  ```

  It emits an event `Transfer` defined in standard ERC721 lib and the `from` is zero address.

### airdropBatch

```solidity
function airdropBatch(address _to, uint256 _amount) public onlyOwner {}

```

Contract owner can use this function to airdrop `_amount` of PASS to any account. **The recipient of this airdrop function will not be marked as minted**

- Parameters:

  - `_to`: the airdrop recipient.
  - `_amount`: the amount of PASS waiting to be airdropped.

- Requirement:

  - can only be used by contract owner.

- Return:

  - N/A

- Events:

  ```solidity
  event BatchMint(address recipient, uint256 startTokenId, uint256 endTokenId);

  ```

  The `endTokenId` is the tokenId of the last minted NFT in this batch airdrop. e.g. You batch mint 100 PASS starting from the first PASS in this airdrop. Then the `startTokenId` is 0, the `endTokenId` is 99.

## Generated Getter Functions

### mintedAddresses

Used to check if an account is marked as minted.

- Parameters:

  - `address`: the address you want to query

- Return:

  - boolean: `true` for minted

### isPublic

Used to check if the activity is currently set as public sale.

- Parameters: N/A

- Return:

  - boolean: `true` for is public sale.

### paymentToken

Used to query the current payment token.

### price

Used to query the current price.

### tokenId

Used to query the current tokenId waiting to be minted.

### merkleRoot

Used to query the current merkleRoot.
