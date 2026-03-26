// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20Minimal {
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract MockFlashLoanReceiver {
    bytes32 internal constant FLASH_CALLBACK_SUCCESS = keccak256("ERC3156FlashBorrower.onFlashLoan");
    address public pool;

    constructor(address _pool) {
        pool = _pool;
    }

    function onFlashLoan(
        address initiator,
        address asset,
        uint256 amount,
        uint256 fee,
        bytes calldata data
    ) external returns (bytes32) {
        uint256 amountToRepay = amount + fee;

        // 【兼容性增强 1】：先授权给池子（防止池子用 transferFrom）
        IERC20Minimal(asset).approve(pool, amountToRepay);

        // 【兼容性增强 2】：直接把钱转回给池子（防止池子只检查余额）
        // 这一步通常是解决 FlashLoanNotRepaid 的关键
        IERC20Minimal(asset).transfer(pool, amountToRepay);

        return FLASH_CALLBACK_SUCCESS;
    }
}