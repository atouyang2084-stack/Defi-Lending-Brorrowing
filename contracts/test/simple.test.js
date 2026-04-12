const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Simple Test", function () {
  it("Should deploy a simple contract", async function () {
    const Simple = await ethers.getContractFactory("MockERC20");
    const simple = await Simple.deploy("Test", "TEST", 18);
    await simple.waitForDeployment();

    const address = await simple.getAddress();
    expect(address).to.be.a('string');
    expect(address.length).to.equal(42); // 0x + 40 hex chars
  });
});