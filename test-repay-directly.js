const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    const [deployer, user] = await ethers.getSigners();
    console.log("使用账户:", user.address);

    // 读取合约地址
    const addresses = JSON.parse(fs.readFileSync("contract-addresses.json", "utf8"));

    // 加载合约
    const LendingPool = await ethers.getContractFactory("LendingPool");
    const pool = LendingPool.attach(addresses.LendingPool);

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = MockERC20.attach(addresses.USDC);

    // 1. 检查当前状态
    console.log("\n=== 1. 检查当前状态 ===");

    // 检查用户账户数据
    const accountData = await pool.userAccountData(user.address);
    console.log("抵押品价值: $", ethers.formatUnits(accountData[0], 18));
    console.log("债务价值: $", ethers.formatUnits(accountData[1], 18));
    console.log("健康因子:", ethers.formatUnits(accountData[3], 27));

    // 检查用户USDC借款余额
    const userBorrow = await pool.userBorrowBalance(user.address, addresses.USDC);
    console.log("USDC借款余额:", userBorrow.toString());

    // 检查用户USDC余额
    const usdcBalance = await usdc.balanceOf(user.address);
    console.log("USDC钱包余额:", ethers.formatUnits(usdcBalance, 6));

    // 检查授权
    const allowance = await usdc.allowance(user.address, addresses.LendingPool);
    console.log("USDC授权给LendingPool:", ethers.formatUnits(allowance, 6));

    // 2. 如果有债务，尝试还款
    if (userBorrow > 0n) {
        console.log("\n=== 2. 尝试还款 ===");

        // 还款金额（还一部分）
        const repayAmount = userBorrow > 1000000n ? 1000000n : userBorrow; // 最多还1 USDC或全部
        console.log("还款金额:", repayAmount.toString(), "USDC");

        // 检查余额是否足够
        if (usdcBalance >= repayAmount) {
            console.log("余额足够，继续...");

            // 检查授权是否足够
            if (allowance < repayAmount) {
                console.log("授权不足，先授权...");
                const approveTx = await usdc.connect(user).approve(addresses.LendingPool, repayAmount);
                await approveTx.wait();
                console.log("授权完成");

                // 重新检查授权
                const newAllowance = await usdc.allowance(user.address, addresses.LendingPool);
                console.log("新授权:", ethers.formatUnits(newAllowance, 6));
            }

            // 执行还款
            console.log("执行还款交易...");
            try {
                const repayTx = await pool.connect(user).repay({
                    asset: addresses.USDC,
                    amount: repayAmount,
                    onBehalfOf: user.address
                });

                console.log("交易已发送，等待确认...");
                const receipt = await repayTx.wait();
                console.log("还款成功！交易哈希:", receipt.hash);

                // 检查还款后状态
                const userBorrowAfter = await pool.userBorrowBalance(user.address, addresses.USDC);
                console.log("还款后USDC借款余额:", userBorrowAfter.toString());

                const accountDataAfter = await pool.userAccountData(user.address);
                console.log("还款后债务价值: $", ethers.formatUnits(accountDataAfter[1], 18));
                console.log("还款后健康因子:", ethers.formatUnits(accountDataAfter[3], 27));

            } catch (error) {
                console.error("还款失败:", error.message);
                console.error("错误详情:", error);
            }
        } else {
            console.log("余额不足，无法还款");
            console.log("需要:", repayAmount.toString(), "USDC");
            console.log("拥有:", usdcBalance.toString(), "USDC");
        }
    } else {
        console.log("\n=== 2. 无需还款 ===");
        console.log("用户没有USDC借款");

        // 如果需要，可以先借一点再测试还款
        console.log("\n=== 3. 先借款再测试还款 ===");

        // 检查抵押品
        if (accountData[0] > 0n) {
            console.log("有抵押品，可以借款");

            // 借1 USDC
            const borrowAmount = ethers.parseUnits("1", 6);
            console.log("借款金额:", borrowAmount.toString(), "USDC");

            try {
                const borrowTx = await pool.connect(user).borrow({
                    asset: addresses.USDC,
                    amount: borrowAmount,
                    onBehalfOf: user.address
                });
                await borrowTx.wait();
                console.log("借款成功！");

                // 等待一下
                await new Promise(resolve => setTimeout(resolve, 2000));

                // 现在重新运行测试
                console.log("\n现在请重新运行此脚本测试还款功能...");
            } catch (error) {
                console.error("借款失败:", error.message);
            }
        } else {
            console.log("没有抵押品，无法借款");
            console.log("请先存入一些USDC作为抵押品");
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});