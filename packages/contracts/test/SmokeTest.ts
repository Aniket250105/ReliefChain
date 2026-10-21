import { expect } from "chai";
import { ethers } from "hardhat";

describe("SmokeTest", function () {
  it("Should return the initial message", async function () {
    const SmokeTest = await ethers.getContractFactory("SmokeTest");
    const smokeTest = await SmokeTest.deploy("Hello ReliefChain");
    await smokeTest.waitForDeployment();

    expect(await smokeTest.getMessage()).to.equal("Hello ReliefChain");
  });
});
