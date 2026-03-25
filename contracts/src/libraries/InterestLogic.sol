// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title InterestLogic
/// @notice Kinked borrow rate + simplified pool revenue split model.
/// @dev This library is a course-project friendly scaffold, not production-ready.
library InterestLogic {
    uint256 internal constant WAD = 1e18;
    uint256 internal constant RAY = 1e27;
    uint256 internal constant BPS = 1e4;

    struct KinkModelParams {
        // Annualized rates in RAY
        uint256 baseRatePerYearRay;
        uint256 slope1PerYearRay;
        uint256 slope2PerYearRay;
        // kink in WAD, e.g. 0.8e18
        uint256 kinkWad;
        // e.g. ~2_102_400 for 12s block time
        uint256 blocksPerYear;
    }

    struct ReserveAccrualState {
        // Current reserve amounts in underlying units (not scaled)
        uint256 totalBorrowsUnderlying;
        uint256 totalSuppliesUnderlying;

        // Existing indexes in RAY
        uint256 borrowIndex;
        uint256 supplyIndex;

        // Protocol reserve in underlying units
        uint256 protocolReserves;

        // delta blocks since last update
        uint256 deltaBlocks;

        // reserve factor in bps (e.g. 1000 = 10%)
        uint16 reserveFactorBps;
    }

    struct AccrualResult {
        uint256 newBorrowIndex;
        uint256 newSupplyIndex;
        uint256 borrowRatePerBlockRay;
        uint256 supplyRatePerBlockRay;
        uint256 addedProtocolReserves;
        uint256 newProtocolReserves;
    }

    function utilizationWad(uint256 totalBorrows, uint256 totalSupplies) internal pure returns (uint256) {
        if (totalSupplies == 0) return 0;
        if (totalBorrows >= totalSupplies) return WAD;
        return (totalBorrows * WAD) / totalSupplies;
    }

    function borrowRatePerBlockRay(uint256 uWad, KinkModelParams memory m) internal pure returns (uint256) {
        if (m.blocksPerYear == 0) return 0;

        uint256 annualRate;
        if (uWad <= m.kinkWad) {
            // base + slope1 * (u / kink)
            uint256 term = m.kinkWad == 0 ? 0 : (m.slope1PerYearRay * uWad) / m.kinkWad;
            annualRate = m.baseRatePerYearRay + term;
        } else {
            // base + slope1 + slope2 * ((u-kink)/(1-kink))
            uint256 excess = uWad - m.kinkWad;
            uint256 denom = WAD - m.kinkWad;
            uint256 term2 = denom == 0 ? 0 : (m.slope2PerYearRay * excess) / denom;
            annualRate = m.baseRatePerYearRay + m.slope1PerYearRay + term2;
        }

        return annualRate / m.blocksPerYear;
    }

    function supplyRatePerBlockRay(
        uint256 borrowRateRay,
        uint256 uWad,
        uint16 reserveFactorBps
    ) internal pure returns (uint256) {
        // SupplyRate = BorrowRate * Utilization * (1 - reserveFactor)
        uint256 oneMinusReserveWad = WAD - (uint256(reserveFactorBps) * 1e14); // bps -> wad
        uint256 rate = (borrowRateRay * uWad) / WAD;
        return (rate * oneMinusReserveWad) / WAD;
    }

    function accrue(ReserveAccrualState memory s, KinkModelParams memory m) internal pure returns (AccrualResult memory r) {
        r.newBorrowIndex = s.borrowIndex;
        r.newSupplyIndex = s.supplyIndex;
        r.newProtocolReserves = s.protocolReserves;

        if (s.deltaBlocks == 0) {
            return r;
        }

        uint256 uWad = utilizationWad(s.totalBorrowsUnderlying, s.totalSuppliesUnderlying);
        r.borrowRatePerBlockRay = borrowRatePerBlockRay(uWad, m);
        r.supplyRatePerBlockRay = supplyRatePerBlockRay(r.borrowRatePerBlockRay, uWad, s.reserveFactorBps);

        // simple per-block linear accrual for project scope
        // newIndex = oldIndex * (1 + rate * dt)
        uint256 borrowGrowthRay = RAY + (r.borrowRatePerBlockRay * s.deltaBlocks);
        uint256 supplyGrowthRay = RAY + (r.supplyRatePerBlockRay * s.deltaBlocks);

        r.newBorrowIndex = (s.borrowIndex * borrowGrowthRay) / RAY;
        r.newSupplyIndex = (s.supplyIndex * supplyGrowthRay) / RAY;

        // Borrow interest generated during dt
        uint256 borrowInterest = (s.totalBorrowsUnderlying * r.borrowRatePerBlockRay * s.deltaBlocks) / RAY;

        r.addedProtocolReserves = (borrowInterest * s.reserveFactorBps) / BPS;
        r.newProtocolReserves = s.protocolReserves + r.addedProtocolReserves;
    }
}
