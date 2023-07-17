# Functions

## initializeActivity

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
  - `_price`: the initial sale price for `Pass`.
  - `_merkleRoot`: the root of the merkle tree which maintain the whitelist.

- Requirement:

  - can only be used by contract owner.

- Return:

  - N/A

- Events:

  ```solidity
    event ActivityStarted(uint256 currentTime, address paymentToken, uint256 price, bytes32 merkleRoot);
  ```

## setPublicMint

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

## updateWhitelist

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

## changePrice

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

## withdrawToken

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

## mintedAddresses

This is a getter function generated automatically for `mintedAddresses` mapping.

- Parameters:

  - `address`: the address you want to query

- Requirement:

  - N/A

- Return:

  - boolean: `true` for minted

- Events:
  - N/A

## freeMint

```solidity
function freeMint(bytes32[] calldata _merkleProof, address _to) public payable {}

```

- Workflow:

  - Airdrop rule:

    - Require `msg.sender` equals the contract owner address.
    - If the above is satisfied, mint to the given address directly.
    - **Owner cannot airdrop to itself unless it is in whitelist**

  - Sale rule:
    - Public sale:
      - Pay and mint
    - Whitelist sale:
      - Check if `msg.sender` is in whitelist.
      - Pay and mint.

- Parameters:

  - `_merkleProof`: the merkle proof to prove the `msg.sender` is in whitelist.
  - `_to`: the NFT token recipient.

- Requirement:

  - described above.

- Return:

  - N/A

- Events:

  ```solidity
  event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

  ```

  It emits an event `Transfer` defined in standard ERC721 lib and the `from` is zero address.
