//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

contract Pass is ERC721Enumerable, Ownable {
    bool public isPublic;
    address public paymentToken;
    uint256 public price;
    uint256 public tokenId;
    bytes32 public merkleRoot;
    mapping(address => bool) public mintedAddresses;

    event ActivityStarted(uint256 currentTime, uint256 price, bytes32 merkleRoot);
    //TODO: need to add token info if the payment token is also allowed to change
    event PriceChanged(uint256 oldPrice, uint256 newPrice);
    event WhitelistUpdated(bytes32 oldMerkleRoot, bytes32 newMerkleRoot);

    constructor(string memory _name, string memory _symbol) ERC721(_name, _symbol) {}

    function initializeActivity(
        address _paymentToken,
        uint256 _price,
        bytes32 _merkleRoot
    ) external onlyOwner {
        paymentToken = _paymentToken;
        price = _price;
        merkleRoot = _merkleRoot;

        emit ActivityStarted(block.timestamp, price, merkleRoot);
    }

    function setPublicMint(bool _isPublic) external onlyOwner {
        isPublic = _isPublic;
    }

    function updateWhitelist(bytes32 _merkleRoot) external onlyOwner {
        emit WhitelistUpdated(merkleRoot, _merkleRoot);
        merkleRoot = _merkleRoot;
    }

    function withdrawToken(address _token, uint256 _amount) external onlyOwner {
        uint256 currentBalance = IERC20(_token).balanceOf(address(this));
        if (_amount > currentBalance) _amount = currentBalance;
        IERC20(_token).transfer(msg.sender, _amount);
    }

    function changePrice(address _paymentToken, uint256 _newPrice) external onlyOwner {
        emit PriceChanged(price, _newPrice);
        if (_paymentToken != paymentToken) paymentToken = _paymentToken;
        price = _newPrice;
    }

    function freeMint(bytes32[] calldata _merkleProof, address _to) public {
        if (_to != msg.sender) {
            require(msg.sender == owner(), "Pass: Only owner can airdrop");
            /** TODO:
             * do we need to pay for airdrop?
             * can we airdrop to an address who already minted?
             * do we need to provide merkle proof ?
             */
            _safeMint(_to, tokenId);
            unchecked {
                ++tokenId;
            }
        } else {
            if (!isPublic) {
                //now it's only for whitelist
                require(mintedAddresses[msg.sender] == false, "Pass: Already Minted");
                bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
                require(MerkleProof.verify(_merkleProof, merkleRoot, leaf), "Pass: Not in whitelist");
                mintedAddresses[msg.sender] = true;
            }

            if (price > 0) {
                //TODO: need to consider the scenario: payment token is native token
                require(
                    IERC20(paymentToken).allowance(msg.sender, address(this)) >= price,
                    "Pass: insufficient allowance for payment"
                );
                IERC20(paymentToken).transferFrom(msg.sender, address(this), price);
            }
            _safeMint(msg.sender, tokenId);
            unchecked {
                ++tokenId;
            }
        }
    }

    function tokenURI(uint256 tokenId) public pure virtual override returns (string memory) {
        return "ipfs://";
    }
}
