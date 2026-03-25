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
        if (tokenDecimals == 18) return (amount * priceWad) / WAD;
        if (tokenDecimals < 18) {
            return ((amount * (10 ** (18 - tokenDecimals))) * priceWad) / WAD;
        }
        return ((amount / (10 ** (tokenDecimals - 18))) * priceWad) / WAD;
    }

    /// @notice Converts USD WAD value into token amount with token decimals.
    function usdWadToToken(
        uint256 usdWad,
        uint8 tokenDecimals,
        uint256 priceWad
    ) internal pure returns (uint256) {
        if (usdWad == 0 || priceWad == 0) return 0;
        uint256 amount18 = (usdWad * WAD) / priceWad;
        if (tokenDecimals == 18) return amount18;
        if (tokenDecimals < 18) return amount18 / (10 ** (18 - tokenDecimals));
        return amount18 * (10 ** (tokenDecimals - 18));
    }
}
