import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { ETHPool } from "../typechain";

describe("ETHPool", function () {
  let ethPool: ETHPool;
  let accounts: SignerWithAddress[];

  beforeEach(async function () {
    const ETHPool = await ethers.getContractFactory("ETHPool");

    ethPool = await ETHPool.deploy();
    await ethPool.deployed();

    accounts = await ethers.getSigners();
  });

  it("should deposit correct amount", async function () {
    const [user] = accounts;

    await deposit(user, 100);

    expect(await ethPool.userDeposit({ from: user.address })).to.equal(
      ethers.utils.parseEther("100")
    );
  });

  it("should reward correct amount", async function () {
    const [team, uA] = accounts;
    const rewardAmount = ethers.utils.parseEther("100");

    await deposit(uA, 100);

    await ethPool.changeTeam(team.address);
    await ethPool.reward(rewardAmount, { value: rewardAmount });

    expect(await ethPool.totalAmount()).to.equal(
      ethers.utils.parseEther("200")
    );
    expect(await ethPool.totalETH()).to.equal(ethers.utils.parseEther("200"));
  });

  it("should reject reward when it's not team", async function () {
    const [team, uA, uB] = accounts;
    const rewardAmount = ethers.utils.parseEther("100");

    await ethPool.changeTeam(uB.address);
    await deposit(uA, 100);

    await expect(
      ethPool.reward(rewardAmount, {
        value: rewardAmount,
        from: team.address,
      })
    ).to.be.revertedWith("Not team");
  });

  it("should reject reward when there is no deposit", async function () {
    const [team] = accounts;
    const rewardAmount = ethers.utils.parseEther("100");

    await expect(
      ethPool.reward(rewardAmount, {
        value: rewardAmount,
        from: team.address,
      })
    ).to.be.revertedWith("No deposit yet");
  });

  it("should throw an error when user tries to withdraw without deposit", async function () {
    const [uA, uB] = accounts;

    await deposit(uB, 100);

    await expect(ethPool.withdraw({ from: uA.address })).to.be.revertedWith(
      "User has no deposit"
    );
  });

  it("should withdraw original amount when there is no reward", async function () {
    const [uA, uB] = accounts;

    const originalBalance = await uA.getBalance();

    const depositFee = await deposit(uA, 100);
    await deposit(uB, 100);

    const withdrawFee = await withdraw(uA);
    const currentBalance = await uA.getBalance();

    expect(currentBalance.add(depositFee).add(withdrawFee)).to.equal(
      originalBalance
    );
  });

  it("should withdraw exact percentage of reward", async function () {
    const [team, uA, uB] = accounts;

    const originalBalance = await uA.getBalance();

    const depositFee = await deposit(uA, 100);
    await deposit(uB, 300);

    await ethPool.reward(ethers.utils.parseEther("400"), {
      from: team.address,
      value: ethers.utils.parseEther("400"),
    });

    const withdrawFee = await withdraw(uA);
    const currentBalance = await uA.getBalance();

    // 200 = 100(deposit) + 100(25% of reward)
    const expectedBalance = originalBalance
      .sub(depositFee)
      .sub(withdrawFee)
      .add(ethers.utils.parseEther("100"));

    expect(expectedBalance).to.equal(currentBalance);
    expect(await ethPool.totalAmount()).to.equal(
      ethers.utils.parseEther("600")
    );
    expect(await ethPool.totalETH()).to.equal(ethers.utils.parseEther("600"));
  });

  it("should withdraw correct amount of reward based on the withdraw order", async function () {
    const [team, uA, uB] = accounts;

    const originalBalanceA = await uA.getBalance();
    const originalBalanceB = await uB.getBalance();

    const depositFeeA = await deposit(uA, 100);

    await ethPool.reward(ethers.utils.parseEther("300"), {
      from: team.address,
      value: ethers.utils.parseEther("300"),
    });

    const depositFeeB = await deposit(uB, 200);

    const withdrawFeeA = await withdraw(uA);
    const withdrawFeeB = await withdraw(uB);

    const currentBalanceA = await uA.getBalance();
    const currentBalanceB = await uB.getBalance();

    expect(
      originalBalanceA
        .sub(depositFeeA)
        .sub(withdrawFeeA)
        .add(ethers.utils.parseEther("300"))
    ).to.equal(currentBalanceA);

    expect(originalBalanceB.sub(depositFeeB).sub(withdrawFeeB)).to.equal(
      currentBalanceB
    );

    expect(await ethPool.totalAmount()).to.equal(ethers.utils.parseEther("0"));
    expect(await ethPool.totalETH()).to.equal(ethers.utils.parseEther("0"));
  });

  // Utility method to deposit and return transaction fee.
  const deposit = async (
    account: SignerWithAddress,
    amount: number
  ): Promise<BigNumber> => {
    const transaction = await ethPool
      .connect(account)
      .deposit(ethers.utils.parseEther(String(amount)), {
        from: account.address,
        value: ethers.utils.parseEther(String(amount)),
      });
    const receipt = await transaction.wait();

    return transaction.gasPrice!.mul(receipt.gasUsed);
  };

  const withdraw = async (account: SignerWithAddress): Promise<BigNumber> => {
    const transaction = await ethPool.connect(account).withdraw();
    const receipt = await transaction.wait();

    return transaction.gasPrice!.mul(receipt.gasUsed);
  };
});
