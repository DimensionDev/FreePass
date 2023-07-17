import { expect } from "chai";
import { Signer, constants, utils } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { ethers, network } from "hardhat";
import { MerkleTree } from "merkletreejs";
import { MaskToken, MaskToken__factory, Pass, Pass__factory } from "../types";

describe("Firefly Pass test", () => {
  let signers: Signer[];
  let deployer: Signer;
  let deployerAddress: string;
  let user1: Signer;
  let user2: Signer;
  let user3: Signer;
  let user4: Signer;
  let user1Address: string;
  let user2Address: string;
  let user3Address: string;
  let user4Address: string;
  let pass: Pass;
  let mask: MaskToken;
  let snapshotId: string;
  let whitelist: string[] = [];
  let merkleTree: MerkleTree;
  let merkleRoot: string;

  before(async () => {
    signers = await ethers.getSigners();
    [deployer, user1, user2, user3, user4] = signers.slice(0, 5);
    deployerAddress = await deployer.getAddress();
    user1Address = await user1.getAddress();
    user2Address = await user2.getAddress();
    user3Address = await user3.getAddress();
    user4Address = await user4.getAddress();

    whitelist.push(utils.keccak256(user1Address));
    whitelist.push(utils.keccak256(user2Address));
    whitelist.push(utils.keccak256(user3Address));

    pass = await new Pass__factory(deployer).deploy("Firefly Pass", "Pass");
    mask = await new MaskToken__factory(deployer).deploy();
    merkleTree = new MerkleTree(whitelist, utils.keccak256, { sortPairs: true });
    merkleRoot = merkleTree.getHexRoot();
  });

  beforeEach(async () => {
    snapshotId = await network.provider.send("evm_snapshot", []);
  });

  afterEach(async () => {
    await network.provider.send("evm_revert", [snapshotId]);
  });

  it("#Case described in doc", async () => {
    await pass.initializeActivity(constants.AddressZero, 0, merkleRoot);

    //#region test mint for phase1: whitelist mint
    const leafUser1 = utils.keccak256(user1Address);
    const proofUser1 = merkleTree.getHexProof(leafUser1);
    await pass.connect(user1).freeMint(proofUser1, user1Address);
    expect(await pass.balanceOf(user1Address)).to.be.eq(1);
    await expect(pass.connect(user1).freeMint(proofUser1, user1Address)).to.be.revertedWith("Pass: Already minted");
    await expect(pass.connect(user4).freeMint(proofUser1, user4Address)).to.be.revertedWith("Pass: Not in whitelist");
    expect(await pass.balanceOf(user1Address)).to.be.eq(1);
    expect(await pass.balanceOf(user4Address)).to.be.eq(0);
    //#endregion

    //#region test mint for phase2: add whitelist address
    whitelist.push(utils.keccak256(user4Address));
    merkleTree = new MerkleTree(whitelist, utils.keccak256, { sortPairs: true });
    merkleRoot = merkleTree.getHexRoot();
    await pass.updateWhitelist(merkleRoot);
    const leafUser4 = utils.keccak256(user4Address);
    const proofUser4 = merkleTree.getHexProof(leafUser4);
    await pass.connect(user4).freeMint(proofUser4, user4Address);
    expect(await pass.balanceOf(user4Address)).to.be.eq(1);
    await expect(pass.connect(user4).freeMint(proofUser4, user4Address)).to.be.revertedWith("Pass: Already minted");
    //#endregion

    //#region test mint for phase3: start public sale
    await pass.setPublicMint(true);
    await expect(pass.connect(user4).freeMint(proofUser4, user4Address)).to.be.revertedWith("Pass: Already minted");
    await pass.connect(signers[5]).freeMint([constants.HashZero], await signers[5].getAddress());
    expect(await pass.balanceOf(await signers[5].getAddress())).to.be.eq(1);
    await expect(
      pass.connect(signers[5]).freeMint([constants.HashZero], await signers[5].getAddress()),
    ).to.be.revertedWith("Pass: Already minted");
    //#endregion

    //#region test mint for phase4: change price
    const user6Address = await signers[6].getAddress();
    await pass.changePrice(mask.address, parseEther("1"));
    await expect(pass.connect(signers[6]).freeMint([constants.HashZero], user6Address)).to.be.revertedWith(
      "Pass: Insufficient balance for payment",
    );

    await mask.transfer(user6Address, parseEther("1"));
    await expect(pass.connect(signers[6]).freeMint([constants.HashZero], user6Address)).to.be.revertedWith(
      "Pass: Insufficient allowance for payment",
    );

    await mask.connect(signers[6]).approve(pass.address, parseEther("1"));
    await pass.connect(signers[6]).freeMint([constants.HashZero], user6Address);
    expect(await pass.balanceOf(user6Address)).to.be.eq(1);
    checkMinted([1, 4, 5, 6]);
    //#endregion

    //#region test mint for phase5: close open sale and change price
    await pass.setPublicMint(false);
    await pass.changePrice(constants.AddressZero, 0);
    await expect(
      pass.connect(signers[7]).freeMint([constants.HashZero], await signers[7].getAddress()),
    ).to.be.revertedWith("Pass: Not in whitelist");
    const leafUser2 = utils.keccak256(user2Address);
    const proofUser2 = merkleTree.getHexProof(leafUser2);
    await pass.connect(user2).freeMint(proofUser2, user2Address);
    expect(await pass.balanceOf(user2Address)).to.be.eq(1);
    checkMinted([1, 2, 4, 5, 6]);
    //#endregion

    //#region test mint for airdrop
    await expect(pass.freeMint([], user1Address)).to.be.revertedWith("Pass: Already minted");
    await pass.freeMint([], await signers[7].getAddress());
    expect(await pass.balanceOf(await signers[7].getAddress())).to.be.eq(1);
    //#endregion

    const totalSupply = await pass.totalSupply();
    expect(totalSupply).to.be.eq(6);
  });

  describe("Test for each function", () => {
    it("if caller is not owner, cannot initialize the activity", async () => {
      await expect(pass.connect(user1).initializeActivity(constants.AddressZero, 0, merkleRoot)).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
    });

    it("Cannot call freeMint before initialize the activity", async () => {
      await expect(pass.connect(user1).freeMint([], user1Address)).to.be.revertedWith("Pass: Activity not initialized");
    });

    it("Should withdraw token success (native token)", async () => {
      await pass.initializeActivity(constants.AddressZero, parseEther("1"), merkleRoot);
      const leafUser1 = utils.keccak256(user1Address);
      const proofUser1 = merkleTree.getHexProof(leafUser1);
      await pass.connect(user1).freeMint(proofUser1, user1Address, { value: parseEther("1") });

      let contractBalanceBefore = await ethers.provider.getBalance(pass.address);
      let deployerBalanceBefore = await ethers.provider.getBalance(deployerAddress);
      expect(contractBalanceBefore).to.be.eq(parseEther("1"));
      await pass.withdrawToken(constants.AddressZero, parseEther("1"));
      let contractBalanceAfter = await ethers.provider.getBalance(pass.address);
      let deployerBalanceAfter = await ethers.provider.getBalance(deployerAddress);
      expect(contractBalanceAfter).to.be.eq(0);
      expect(deployerBalanceAfter).to.be.gt(deployerBalanceBefore);

      const leafUser2 = utils.keccak256(user2Address);
      const proofUser2 = merkleTree.getHexProof(leafUser2);
      await pass.connect(user2).freeMint(proofUser2, user2Address, { value: parseEther("1") });

      contractBalanceBefore = await ethers.provider.getBalance(pass.address);
      deployerBalanceBefore = await ethers.provider.getBalance(deployerAddress);
      await pass.withdrawToken(constants.AddressZero, parseEther("2"));
      contractBalanceAfter = await ethers.provider.getBalance(pass.address);
      deployerBalanceAfter = await ethers.provider.getBalance(deployerAddress);
      expect(contractBalanceAfter).to.be.eq(0);
      expect(deployerBalanceAfter.sub(deployerBalanceBefore)).to.be.lt(parseEther("1"));
    });

    it("Should withdraw token success (erc20 token)", async () => {
      await pass.initializeActivity(mask.address, parseEther("1"), merkleRoot);
      const leafUser1 = utils.keccak256(user1Address);
      const proofUser1 = merkleTree.getHexProof(leafUser1);
      await mask.transfer(user1Address, parseEther("1"));
      await mask.connect(user1).approve(pass.address, parseEther("1"));
      await pass.connect(user1).freeMint(proofUser1, user1Address);

      let contractBalanceBefore = await mask.balanceOf(pass.address);
      let deployerBalanceBefore = await mask.balanceOf(deployerAddress);
      expect(contractBalanceBefore).to.be.eq(parseEther("1"));
      await pass.withdrawToken(mask.address, parseEther("1"));
      let contractBalanceAfter = await mask.balanceOf(pass.address);
      let deployerBalanceAfter = await mask.balanceOf(deployerAddress);
      expect(contractBalanceAfter).to.be.eq(0);
      expect(deployerBalanceAfter.sub(deployerBalanceBefore)).to.be.eq(parseEther("1"));

      const leafUser2 = utils.keccak256(user2Address);
      const proofUser2 = merkleTree.getHexProof(leafUser2);
      await mask.transfer(user2Address, parseEther("1"));
      await mask.connect(user2).approve(pass.address, parseEther("1"));
      await pass.connect(user2).freeMint(proofUser2, user2Address);

      contractBalanceBefore = await mask.balanceOf(pass.address);
      deployerBalanceBefore = await mask.balanceOf(deployerAddress);
      await pass.withdrawToken(mask.address, parseEther("2"));
      contractBalanceAfter = await mask.balanceOf(pass.address);
      deployerBalanceAfter = await mask.balanceOf(deployerAddress);
      expect(contractBalanceAfter).to.be.eq(0);
      expect(deployerBalanceAfter.sub(deployerBalanceBefore)).to.be.eq(parseEther("1"));
    });

    it("Should airdrop work fine", async () => {
      await pass.initializeActivity(constants.AddressZero, parseEther("1"), merkleRoot);
      //owner cannot mint nft to itself.
      await expect(pass.freeMint([constants.HashZero], deployerAddress)).to.be.revertedWith("Pass: Not in whitelist");
      await expect(pass.connect(user1).freeMint([constants.HashZero], deployerAddress)).to.be.revertedWith(
        "Pass: Only owner can airdrop",
      );
      //owner can airdrop to other address and ignore all limit
      await pass.freeMint([], user4Address);
      expect(await pass.balanceOf(user4Address)).to.be.eq(1);
    });

    it("Should mintedAddress getter works fine", async () => {
      await pass.initializeActivity(constants.AddressZero, parseEther("1"), merkleRoot);
      await pass.freeMint([], user4Address);
      const ifUser4Minted = await pass.mintedAddresses(user4Address);
      expect(ifUser4Minted).to.be.eq(true);

      const leafUser1 = utils.keccak256(user1Address);
      const proofUser1 = merkleTree.getHexProof(leafUser1);
      await pass.connect(user1).freeMint(proofUser1, user1Address, { value: parseEther("1") });
      const ifUser1Minted = await pass.mintedAddresses(user1Address);
      expect(ifUser1Minted).to.be.eq(true);
    });
  });

  async function checkMinted(indexes: number[]) {
    for (const index of indexes) {
      const address = await signers[index].getAddress();
      await expect(pass.connect(signers[index]).freeMint([constants.HashZero], address)).to.be.revertedWith(
        "Pass: Already minted",
      );
    }
  }
});
