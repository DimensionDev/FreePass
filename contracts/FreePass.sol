// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

contract FreePass is ERC721Enumerable, Ownable {
    struct MintEvent {
        address token;
        uint256 price;
        uint256 startTime;
        uint256 endTime;
        bytes32 merkleRoot;
        mapping(address => bool) mintedAddresses;
    }

    bool public isFreeMint;
    uint256 public eventIndex;
    uint256 public tokenIndex;
    mapping(uint256 => MintEvent) public mintEvents;

    event EventCreated(
        uint256 indexed index,
        address indexed token,
        uint256 startTime,
        uint256 endTime,
        bytes32 merkleRoot
    );
    event Minted(uint256 indexed index, address indexed claimer);

    constructor(string memory _name, string memory _symbol) ERC721(_name, _symbol) {}

    function setupEvent(
        address _token,
        uint256 _price,
        uint256 _endTimeFromNow,
        bytes32 _merkleRoot
    ) public onlyOwner {
        setupEvent(_token, _price, block.timestamp, block.timestamp + _endTimeFromNow, _merkleRoot);
    }

    function setupEvent(
        address _token,
        uint256 _price,
        uint256 _startTime,
        uint256 _endTime,
        bytes32 _merkleRoot
    ) public onlyOwner {
        require(_startTime <= _endTime, "FreePass: Invalid Time");
        mintEvents[eventIndex].token = _token;
        mintEvents[eventIndex].price = _price;
        mintEvents[eventIndex].startTime = _startTime;
        mintEvents[eventIndex].endTime = _endTime;
        mintEvents[eventIndex].merkleRoot = _merkleRoot;
        emit EventCreated(eventIndex, _token, _startTime, _endTime, _merkleRoot);
        unchecked {
            ++eventIndex;
        }
    }

    function setFreeMint(bool _freeMint) public onlyOwner {
        isFreeMint = _freeMint;
    }

    function updateMerkleRoot(uint256 _eventIndex, bytes32 _merkleRoot) public onlyOwner {
        mintEvents[_eventIndex].merkleRoot = _merkleRoot;
    }

    function withdrawToken(address _token, uint256 _amount) public onlyOwner {
        IERC20(_token).transfer(msg.sender, _amount);
    }

    function isMinted(uint256 _eventIndex, address _address) public view returns (bool) {
        return mintEvents[_eventIndex].mintedAddresses[_address];
    }

    function freeMint(
        uint256 _eventIndex,
        bytes32[] calldata _merkleProof,
        address _to
    ) public {
        MintEvent storage mintEvent = mintEvents[_eventIndex];
        require(block.timestamp >= mintEvent.startTime, "FreePass: Have not started!");
        require(block.timestamp <= mintEvent.endTime, "FreePass: Expired!");

        if (!isFreeMint) {
            require(!mintEvent.mintedAddresses[_to], "FreePass: Already minted!");
            bytes32 leaf = keccak256(abi.encodePacked(_to));
            require(MerkleProof.verify(_merkleProof, mintEvent.merkleRoot, leaf), "FreePass: Unable to verify");
            mintEvent.mintedAddresses[_to] = true;
        }

        if (mintEvent.price > 0) {
            IERC20(mintEvent.token).transferFrom(msg.sender, address(this), mintEvent.price);
        }

        _safeMint(_to, tokenIndex);
        unchecked {
            ++tokenIndex;
        }
        emit Minted(_eventIndex, _to);
    }

    function tokenURI(uint256 tokenId) public pure virtual override returns (string memory) {
        return "---TestURI---";
    }
}
