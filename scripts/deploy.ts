import { ethers } from "hardhat";

async function main() {
  // We get the contract to deploy
  const ETHPool = await ethers.getContractFactory("ETHPool");
  const ethPool = await ETHPool.deploy();

  await ethPool.deployed();

  console.log("ETHPool is deployed to:", ethPool.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
