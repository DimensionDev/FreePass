import { expect } from "chai";
import { BigNumber, constants, Signer, utils } from "ethers";
import { ethers, network } from "hardhat";
import { MerkleTree } from "merkletreejs";
import { FreePass, FreePass__factory, MaskToken, MaskToken__factory } from "../types";

const ONE_ETH = utils.parseEther("1");

describe("FreePass", () => {
  let snapshotId: string;
  let deployer: Signer;
  let signer1: Signer;
  let signer2: Signer;
  let signer3: Signer;
  let signer4: Signer;
  let deployerAddress: string;
  let signer1Address: string;
  let signer2Address: string;
  let signer3Address: string;

  let freePassContract: FreePass;
  let maskToken: MaskToken;

  let whitelist: string[] = [];
  let merkleTree: MerkleTree;
  let merkleRoot: string;

  before(async () => {
    [deployer, signer1, signer2, signer3, signer4] = await ethers.getSigners();
    deployerAddress = await deployer.getAddress();
    signer1Address = await signer1.getAddress();
    signer2Address = await signer2.getAddress();
    signer3Address = await signer3.getAddress();
    freePassContract = await new FreePass__factory(deployer).deploy("FreePass", "FP");
    maskToken = await new MaskToken__factory(deployer).deploy();
    await maskToken.transfer(freePassContract.address, utils.parseEther("100"));
    expect(await maskToken.balanceOf(freePassContract.address)).to.be.eq(utils.parseEther("100"));

    whitelist.push(utils.keccak256(signer1Address));
    whitelist.push(utils.keccak256(signer2Address));
    whitelist.push(utils.keccak256(signer3Address));
    merkleTree = new MerkleTree(whitelist, utils.keccak256, { sortPairs: true });
    merkleRoot = merkleTree.getHexRoot();
  });

  beforeEach(async () => {
    snapshotId = await network.provider.send("evm_snapshot", []);
  });

  afterEach(async () => {
    await network.provider.send("evm_revert", [snapshotId]);
  });

  it("Test Owner", async () => {
    expect(await freePassContract.owner()).to.be.eq(deployerAddress);
    await expect(freePassContract.connect(signer1).transferOwnership(signer1Address)).to.be.revertedWith(
      "Ownable: caller is not the owner",
    );
    await expect(freePassContract.withdrawToken(maskToken.address, utils.parseEther("101"))).to.be.reverted;
    await freePassContract.withdrawToken(maskToken.address, utils.parseEther("50"));
    expect(await maskToken.balanceOf(freePassContract.address)).to.be.eq(utils.parseEther("50"));
    await freePassContract.withdrawToken(maskToken.address, utils.parseEther("50"));
    expect(await maskToken.balanceOf(freePassContract.address)).to.be.eq(0);
  });

  it("Time check", async () => {
    let leaf = utils.keccak256(signer1Address);
    let proof = merkleTree.getHexProof(leaf);
    expect(merkleTree.verify(proof, leaf, merkleRoot)).to.be.true;
    let index = await freePassContract.eventIndex();
    expect(index).to.be.eq(BigNumber.from(0));

    await expect(
      freePassContract["setupEvent(address,uint256,uint256,uint256,bytes32)"](
        maskToken.address,
        constants.Zero,
        constants.MaxUint256,
        constants.Zero,
        merkleRoot,
      ),
    ).to.be.revertedWith("FreePass: Invalid Time");

    await freePassContract["setupEvent(address,uint256,uint256,uint256,bytes32)"](
      maskToken.address,
      constants.Zero,
      constants.MaxUint256,
      constants.MaxUint256,
      merkleRoot,
    );
    expect(await freePassContract.eventIndex()).to.be.eq(index.add(1));
    expect(await freePassContract.balanceOf(signer1Address)).to.be.eq(BigNumber.from(0));
    await expect(freePassContract.freeMint(index, proof, signer1Address)).to.be.revertedWith(
      "FreePass: Have not started!",
    );
  });

  it("Test regular mint process", async () => {
    let leaf = utils.keccak256(signer1Address);
    let proof = merkleTree.getHexProof(leaf);
    expect(merkleTree.verify(proof, leaf, merkleRoot)).to.be.true;
    let index = await freePassContract.eventIndex();
    expect(index).to.be.eq(BigNumber.from(0));
    await freePassContract["setupEvent(address,uint256,uint256,bytes32)"](
      maskToken.address,
      constants.Zero,
      BigNumber.from(1000),
      merkleRoot,
    );
    expect(await freePassContract.eventIndex()).to.be.eq(index.add(1));
    expect(await freePassContract.balanceOf(signer1Address)).to.be.eq(BigNumber.from(0));

    // Fail Case: address not in the whitelist
    await expect(freePassContract.freeMint(index, proof, deployerAddress)).to.be.revertedWith(
      "FreePass: Unable to verify",
    );

    // Success
    expect(await freePassContract.isMinted(index, signer1Address)).to.be.false;
    await freePassContract.freeMint(index, proof, signer1Address);
    expect(await freePassContract.isMinted(index, signer1Address)).to.be.true;
    expect(await freePassContract.balanceOf(signer1Address)).to.be.eq(1);

    // Fail Case: already minted
    await expect(freePassContract.freeMint(index, proof, signer1Address)).to.be.revertedWith(
      "FreePass: Already minted!",
    );

    leaf = utils.keccak256(signer2Address);
    proof = merkleTree.getHexProof(leaf);
    expect(merkleTree.verify(proof, leaf, merkleRoot)).to.be.true;
    index = await freePassContract.eventIndex();
    expect(index).to.be.eq(BigNumber.from(1));
    await freePassContract["setupEvent(address,uint256,uint256,bytes32)"](
      maskToken.address,
      constants.Zero,
      BigNumber.from(1000),
      merkleRoot,
    );
    expect(await freePassContract.eventIndex()).to.be.eq(index.add(1));
    expect(await freePassContract.balanceOf(signer2Address)).to.be.eq(BigNumber.from(0));

    // Fail Case: expired
    await network.provider.send("evm_increaseTime", [1001]);
    await expect(freePassContract.freeMint(index, proof, signer2Address)).to.be.revertedWith("FreePass: Expired!");

    let signer4Address = await signer4.getAddress();
    leaf = utils.keccak256(signer4Address);
    proof = merkleTree.getHexProof(leaf);
    // signer 4 not on the whitelist
    expect(merkleTree.verify(proof, leaf, merkleRoot)).to.be.false;

    index = await freePassContract.eventIndex();
    await freePassContract["setupEvent(address,uint256,uint256,bytes32)"](
      maskToken.address,
      constants.Zero,
      BigNumber.from(1000),
      merkleRoot,
    );
    expect(await freePassContract.balanceOf(signer4Address)).to.be.eq(BigNumber.from(0));

    await freePassContract.setFreeMint(true);

    // can still mint if isFreeMint == true
    await freePassContract.freeMint(index, proof, signer4Address);
    expect(await freePassContract.balanceOf(signer4Address)).to.be.eq(1);
  });

  it("Update merkle root", async () => {
    let leaf = utils.keccak256(signer1Address);
    let index = await freePassContract.eventIndex();
    let proof = merkleTree.getHexProof(leaf);

    await freePassContract["setupEvent(address,uint256,uint256,bytes32)"](
      maskToken.address,
      constants.Zero,
      BigNumber.from(1000),
      merkleRoot,
    );

    const beforeClaimSnapshot = await network.provider.send("evm_snapshot", []);
    await freePassContract.freeMint(index, proof, signer1Address); // make sure signer1 can claim
    await network.provider.send("evm_revert", [beforeClaimSnapshot]);

    const newList = whitelist.slice(1, 3); // remove signer1 from the list
    let tree = new MerkleTree(newList, utils.keccak256, { sortPairs: true });
    let root = "0x" + tree.getRoot().toString("hex");
    expect(tree.verify(tree.getProof(leaf), leaf, root)).to.be.false;
    await freePassContract.updateMerkleRoot(index, root);
    await expect(freePassContract.freeMint(index, proof, signer1Address)).to.be.revertedWith(
      "FreePass: Unable to verify",
    );
  });
});
