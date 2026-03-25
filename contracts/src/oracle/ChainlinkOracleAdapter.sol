// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

library ChainlinkOracleAdapter {
    uint256 internal constant WAD = 1e18;

    error OracleFeedNotSet();
    error OraclePriceInvalid();
    error OraclePriceStale();

    /// @notice Reads Chainlink price and normalizes to 1e18 (WAD).
    /// @param feed Chainlink aggregator address.
    /// @param maxStaleSeconds Max accepted staleness window in seconds.
    function getPriceWad(address feed, uint256 maxStaleSeconds) internal view returns (uint256) {
        if (feed == address(0)) revert OracleFeedNotSet();

        AggregatorV3Interface agg = AggregatorV3Interface(feed);
        (, int256 answer, , uint256 updatedAt, ) = agg.latestRoundData();

        if (answer <= 0) revert OraclePriceInvalid();
        if (updatedAt == 0 || block.timestamp > updatedAt + maxStaleSeconds) revert OraclePriceStale();

        uint8 priceDecimals = agg.decimals();
        uint256 p = uint256(answer);

        if (priceDecimals == 18) return p;
        if (priceDecimals < 18) return p * (10 ** (18 - priceDecimals));
        return p / (10 ** (priceDecimals - 18));
    }
}
