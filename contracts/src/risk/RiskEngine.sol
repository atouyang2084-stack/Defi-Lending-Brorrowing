// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library RiskEngine {
    uint256 internal constant WAD = 1e18;
    uint256 internal constant RAY = 1e27;
    uint256 internal constant BPS = 1e4;

    struct RiskTotals {
        // Sum(collateral value * liq threshold), 1e18
        uint256 weightedCollateralUsdWad;
        // Sum(debt value), 1e18
        uint256 debtUsdWad;
    }

    /// @notice HF in RAY. No debt => max HF.
    function healthFactorRay(RiskTotals memory t) internal pure returns (uint256) {
        if (t.debtUsdWad == 0) return type(uint256).max;
        return (t.weightedCollateralUsdWad * RAY) / t.debtUsdWad;
    }

    /// @notice Max debt value by LTV in USD WAD.
    function maxDebtUsdByLtv(
        uint256 totalCollateralUsdWad,
        uint16 ltvBps
    ) internal pure returns (uint256) {
        return (totalCollateralUsdWad * ltvBps) / BPS;
    }

    /// @notice Converts token amount to USD WAD using 1e18 normalized oracle price.
    function tokenToUsdWad(
        uint256 amount,
        uint8 tokenDecimals,
        uint256 priceWad
    ) internal pure returns (uint256) {
        if (amount == 0) return 0;
        if (priceWad == 0) return 0;
        
        if (tokenDecimals == 18) {
            return (amount * priceWad) / WAD;
        }
        
        if (tokenDecimals < 18) {
            // 先转换为 18 位精度，再乘以价格
            uint256 amount18 = amount * (10 ** (18 - tokenDecimals));
            return (amount18 * priceWad) / WAD;
        }
        
        // tokenDecimals > 18
        // 先除以精度差，再乘以价格，避免溢出
        uint256 divisor = 10 ** (tokenDecimals - 18);
        return ((amount / divisor) * priceWad) + ((amount % divisor) * priceWad / divisor);
    }

    /// @notice Converts USD WAD value into token amount with token decimals.
    function usdWadToToken(
        uint256 usdWad,
        uint8 tokenDecimals,
        uint256 priceWad
    ) internal pure returns (uint256) {
        if (usdWad == 0 || priceWad == 0) return 0;
        
        // 先计算 18 位精度的代币数量
        uint256 amount18 = (usdWad * WAD) / priceWad;
        
        if (tokenDecimals == 18) {
            return amount18;
        }
        
        if (tokenDecimals < 18) {
            // 减少精度位数
            return amount18 / (10 ** (18 - tokenDecimals));
        }
        
        // tokenDecimals > 18
        // 增加精度位数，注意可能的溢出
        uint256 multiplier = 10 ** (tokenDecimals - 18);
        // 检查是否会溢出
        if (amount18 > type(uint256).max / multiplier) {
            // 如果会溢出，先除以一个因子再乘
            return (amount18 / 1e9) * (multiplier / 1e9);
        }
        return amount18 * multiplier;
    }
}
