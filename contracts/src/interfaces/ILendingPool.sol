// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ILendingPool {
    enum CollateralKind {
        ERC20,
        NFT
    }

    struct AssetConfig {
        address asset;
        address priceFeed;
        uint8 decimals;
        uint16 ltvBps;
        uint16 liquidationThresholdBps;
        uint16 liquidationBonusBps;
        uint16 reserveFactorBps;
        bool isActive;
    }

    struct ReserveData {
        // RAY(1e27) indexes
        uint256 borrowIndex;
        uint256 supplyIndex;
        uint40 lastUpdatedBlock;

        // Scaled totals (actual = scaled * index / RAY)
        uint256 totalBorrowScaled;
        uint256 totalSupplyScaled;

        // Protocol fee accumulation in underlying units
        uint256 protocolReserves;
    }

    struct DepositParams {
        address asset;
        uint256 amount;
        address onBehalfOf;
    }

    struct WithdrawParams {
        address asset;
        uint256 amount;
        address to;
    }

    struct BorrowParams {
        address asset;
        uint256 amount;
        address onBehalfOf;
    }

    struct RepayParams {
        address asset;
        uint256 amount;
        address onBehalfOf;
    }

    struct FlashLoanParams {
        address receiver;
        address asset;
        uint256 amount;
        bytes data;
    }

    // ---------- Errors ----------
    error InvalidAmount();
    error AssetNotSupported(address asset);
    error AssetNotActive(address asset);
    error InsufficientLiquidity();
    error LTVExceeded();
    error HealthFactorTooLow(uint256 healthFactorRay);
    error NotLiquidatable();
    error RepayAmountExceedsDebt();
    error OraclePriceInvalid();
    error OraclePriceStale();
    error FlashLoanCallbackFailed();
    error FlashLoanNotRepaid();

    // ---------- Events ----------
    event AssetConfigured(address indexed asset, AssetConfig config);
    event InterestAccrued(
        address indexed asset,
        uint256 newBorrowIndex,
        uint256 newSupplyIndex,
        uint256 protocolReserves,
        uint40 blockNumber
    );

    event Deposited(address indexed user, address indexed asset, uint256 amount, address indexed onBehalfOf);
    event Withdrawn(address indexed user, address indexed asset, uint256 amount, address indexed to);

    event Borrowed(address indexed user, address indexed asset, uint256 amount, address indexed onBehalfOf);
    event Repaid(address indexed payer, address indexed user, address indexed asset, uint256 amount);

    event Liquidated(
        address indexed liquidator,
        address indexed borrower,
        address indexed debtAsset,
        address collateralAsset,
        uint256 repaidAmount,
        uint256 seizedAmount
    );

    event FlashLoan(address indexed receiver, address indexed asset, uint256 amount, uint256 fee);

    // ---------- Core Actions ----------
    function deposit(DepositParams calldata p) external;
    function withdraw(WithdrawParams calldata p) external;
    function borrow(BorrowParams calldata p) external;
    function repay(RepayParams calldata p) external returns (uint256 repaidAmount);

    // ---------- Liquidation ----------
    function liquidate(
        address borrower,
        address debtAsset,
        address collateralAsset,
        uint256 repayAmount,
        uint256 minSeizeAmount
    ) external returns (uint256 seizedAmount);

    // ---------- Flash Loan ----------
    function flashLoan(FlashLoanParams calldata p) external;

    // ---------- Interest / Rates ----------
    function accrueInterest(address asset) external;
    function getUtilization(address asset) external view returns (uint256 utilizationWad);
    function getBorrowRatePerBlock(address asset) external view returns (uint256 borrowRateRay);
    function getSupplyRatePerBlock(address asset) external view returns (uint256 supplyRateRay);

    // ---------- User State ----------
    function userSupplyScaled(address user, address asset) external view returns (uint256);
    function userBorrowScaled(address user, address asset) external view returns (uint256);

    function userSupplyBalance(address user, address asset) external view returns (uint256);
    function userBorrowBalance(address user, address asset) external view returns (uint256);

    // ---------- Risk Views ----------
    function healthFactor(address user) external view returns (uint256 hfRay);
    function maxBorrowable(address user, address debtAsset) external view returns (uint256 amount);

    // ---------- Reserve / Config Views ----------
    function getReserveData(address asset) external view returns (ReserveData memory);
    function getAssetConfig(address asset) external view returns (AssetConfig memory);

    function userAccountData(address user)
        external
        view
        returns (
            uint256 collateralValueUsdWad,
            uint256 debtValueUsdWad,
            uint256 weightedCollateralForHFUsdWad,
            uint256 currentHealthFactorRay
        );
}
