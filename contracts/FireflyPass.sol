//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

contract Pass is ERC721Enumerable, Ownable {
    bool public isPublic;
    bool public isInitialized;
    address public paymentToken;
    uint256 public price;
    uint256 public tokenId;
    bytes32 public merkleRoot;
    mapping(address => bool) public mintedAddresses;

    event ActivityStarted(uint256 currentTime, address paymentToken, uint256 price, bytes32 merkleRoot);
    event PriceChanged(address oldToken, uint256 oldPrice, address newToken, uint256 newPrice);
    event WhitelistUpdated(bytes32 oldMerkleRoot, bytes32 newMerkleRoot);
    event BatchMint(address recipient, uint256 startTokenId, uint256 endTokenId);

    constructor(string memory _name, string memory _symbol) ERC721(_name, _symbol) {}

    function initializeActivity(
        address _paymentToken,
        uint256 _price,
        bytes32 _merkleRoot
    ) external onlyOwner {
        paymentToken = _paymentToken;
        price = _price;
        merkleRoot = _merkleRoot;

        isInitialized = true;
        emit ActivityStarted(block.timestamp, _paymentToken, price, merkleRoot);
    }

    function setPublicMint(bool _isPublic) external onlyOwner {
        isPublic = _isPublic;
    }

    function updateWhitelist(bytes32 _merkleRoot) external onlyOwner {
        emit WhitelistUpdated(merkleRoot, _merkleRoot);
        merkleRoot = _merkleRoot;
    }

    function withdrawToken(address _token, uint256 _amount) external onlyOwner {
        if (_token == address(0)) {
            uint256 currentBalance = address(this).balance;
            if (_amount > currentBalance) _amount = currentBalance;
            payable(msg.sender).transfer(_amount);
        } else {
            uint256 currentBalance = IERC20(_token).balanceOf(address(this));
            if (_amount > currentBalance) _amount = currentBalance;
            IERC20(_token).transfer(msg.sender, _amount);
        }
    }

    function changePrice(address _paymentToken, uint256 _newPrice) external onlyOwner {
        emit PriceChanged(paymentToken, price, _paymentToken, _newPrice);
        if (_paymentToken != paymentToken) paymentToken = _paymentToken;
        price = _newPrice;
    }

    function freeMint(bytes32[] calldata _merkleProof) public payable {
        require(isInitialized, "Pass: Activity not initialized");
        require(mintedAddresses[msg.sender] == false, "Pass: Already minted");
        mintedAddresses[msg.sender] = true;
        if (!isPublic) {
            //now it's only for whitelist
            bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
            require(MerkleProof.verify(_merkleProof, merkleRoot, leaf), "Pass: Not in whitelist");
        }

        if (price > 0) {
            if (paymentToken == address(0)) {
                require(msg.value >= price, "Pass: Insufficient msg.value for payment");
                uint256 refundTokenAmount = msg.value - price;
                if (refundTokenAmount > 0) payable(msg.sender).transfer(refundTokenAmount);
            } else {
                require(IERC20(paymentToken).balanceOf(msg.sender) >= price, "Pass: Insufficient balance for payment");
                require(
                    IERC20(paymentToken).allowance(msg.sender, address(this)) >= price,
                    "Pass: Insufficient allowance for payment"
                );
                IERC20(paymentToken).transferFrom(msg.sender, address(this), price);
            }
        }
        _safeMint(msg.sender, tokenId);
        unchecked {
            ++tokenId;
        }
    }

    function airdrop(address _to) public onlyOwner {
        require(mintedAddresses[_to] == false, "Pass: Already minted");
        mintedAddresses[_to] = true;
        _safeMint(_to, tokenId);
        unchecked {
            ++tokenId;
        }
    }

    function airdropBatch(address _to, uint256 _amount) public onlyOwner {
        uint256 startTokenId = tokenId;
        for (uint256 i = 0; i < _amount; i++) {
            _safeMint(_to, tokenId);
            unchecked {
                ++tokenId;
            }
        }
        emit BatchMint(_to, startTokenId, tokenId - 1);
    }

    function tokenURI(uint256 tokenId) public pure virtual override returns (string memory) {
        return "ipfs://";
    }
}
