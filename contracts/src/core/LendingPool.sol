// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ILendingPool} from "../interfaces/ILendingPool.sol";
import {InterestLogic} from "../libraries/InterestLogic.sol";
import {RiskEngine} from "../risk/RiskEngine.sol";
import {ChainlinkOracleAdapter} from "../oracle/ChainlinkOracleAdapter.sol";

interface IERC20Minimal {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface IFlashLoanReceiver {
    function onFlashLoan(address initiator, address asset, uint256 amount, uint256 fee, bytes calldata data)
        external
        returns (bytes32);
}

contract LendingPool is ILendingPool {
    uint256 internal constant WAD = 1e18;
    uint256 internal constant RAY = 1e27;
    uint256 internal constant BPS = 1e4;
    bytes32 internal constant FLASH_CALLBACK_SUCCESS = keccak256("ERC3156FlashBorrower.onFlashLoan");

    uint256 public constant ORACLE_MAX_STALE_SECONDS = 1 days;
    uint256 public constant FLASH_FEE_BPS = 9; // 0.09%

    address public owner;

    mapping(address => AssetConfig) internal _assetConfig;
    mapping(address => ReserveData) internal _reserveData;
    mapping(address => InterestLogic.KinkModelParams) internal _kinkParams;
    address[] internal _assets;
    mapping(address => bool) internal _assetListed;

    mapping(address => mapping(address => uint256)) public override userSupplyScaled;
    mapping(address => mapping(address => uint256)) public override userBorrowScaled;

    mapping(address => address[]) internal _userAssets;
    mapping(address => mapping(address => bool)) internal _userHasAsset;

    uint256 private _entered;

    error NotOwner();
    error Reentrancy();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        if (_entered == 1) revert Reentrancy();
        _entered = 1;
        _;
        _entered = 0;
    }

    constructor() {
        owner = msg.sender;
    }

    function configureAsset(
        AssetConfig calldata c,
        InterestLogic.KinkModelParams calldata k
    ) external onlyOwner {
        _assetConfig[c.asset] = c;
        _kinkParams[c.asset] = k;

        ReserveData storage r = _reserveData[c.asset];
        if (r.borrowIndex == 0) r.borrowIndex = RAY;
        if (r.supplyIndex == 0) r.supplyIndex = RAY;
        if (r.lastUpdatedBlock == 0) r.lastUpdatedBlock = uint40(block.number);

        if (!_assetListed[c.asset]) {
            _assetListed[c.asset] = true;
            _assets.push(c.asset);
        }
        emit AssetConfigured(c.asset, c);
    }

    function deposit(DepositParams calldata p) external override nonReentrant {
        if (p.amount == 0) revert InvalidAmount();
        _requireActiveAsset(p.asset);
        accrueInterest(p.asset);

        ReserveData storage r = _reserveData[p.asset];
        address user = p.onBehalfOf == address(0) ? msg.sender : p.onBehalfOf;
        uint256 scaled = (p.amount * RAY) / r.supplyIndex;
        userSupplyScaled[user][p.asset] += scaled;
        r.totalSupplyScaled += scaled;
        _touchUserAsset(user, p.asset);

        _safeTransferFrom(p.asset, msg.sender, address(this), p.amount);
        emit Deposited(msg.sender, p.asset, p.amount, user);
    }

    function withdraw(WithdrawParams calldata p) external override nonReentrant {
        if (p.amount == 0) revert InvalidAmount();
        _requireActiveAsset(p.asset);
        accrueInterest(p.asset);

        ReserveData storage r = _reserveData[p.asset];
        uint256 scaledToBurn = (p.amount * RAY) / r.supplyIndex;
        if (scaledToBurn > userSupplyScaled[msg.sender][p.asset]) revert InsufficientLiquidity();

        userSupplyScaled[msg.sender][p.asset] -= scaledToBurn;
        r.totalSupplyScaled -= scaledToBurn;

        if (healthFactor(msg.sender) < RAY) revert HealthFactorTooLow(healthFactor(msg.sender));
        _safeTransfer(p.asset, p.to, p.amount);
        emit Withdrawn(msg.sender, p.asset, p.amount, p.to);
    }

    function borrow(BorrowParams calldata p) external override nonReentrant {
        if (p.amount == 0) revert InvalidAmount();
        _requireActiveAsset(p.asset);
        accrueInterest(p.asset);

        ReserveData storage r = _reserveData[p.asset];
        uint256 available = IERC20Minimal(p.asset).balanceOf(address(this)) - r.protocolReserves;
        if (p.amount > available) revert InsufficientLiquidity();

        address user = p.onBehalfOf == address(0) ? msg.sender : p.onBehalfOf;
        uint256 scaled = (p.amount * RAY) / r.borrowIndex;
        userBorrowScaled[user][p.asset] += scaled;
        r.totalBorrowScaled += scaled;
        _touchUserAsset(user, p.asset);

        _requireLtvAndHealth(user, p.asset);
        _safeTransfer(p.asset, msg.sender, p.amount);
        emit Borrowed(msg.sender, p.asset, p.amount, user);
    }

    function repay(RepayParams calldata p) external override nonReentrant returns (uint256 repaidAmount) {
        if (p.amount == 0) revert InvalidAmount();
        _requireActiveAsset(p.asset);
        accrueInterest(p.asset);

        address user = p.onBehalfOf == address(0) ? msg.sender : p.onBehalfOf;
        uint256 debt = userBorrowBalance(user, p.asset);
        if (debt == 0) return 0;

        repaidAmount = p.amount > debt ? debt : p.amount;
        ReserveData storage r = _reserveData[p.asset];
        uint256 scaledToBurn = (repaidAmount * RAY) / r.borrowIndex;
        if (scaledToBurn > userBorrowScaled[user][p.asset]) scaledToBurn = userBorrowScaled[user][p.asset];

        userBorrowScaled[user][p.asset] -= scaledToBurn;
        r.totalBorrowScaled -= scaledToBurn;

        _safeTransferFrom(p.asset, msg.sender, address(this), repaidAmount);
        emit Repaid(msg.sender, user, p.asset, repaidAmount);
    }

    function liquidate(
        address borrower,
        address debtAsset,
        address collateralAsset,
        uint256 repayAmount,
        uint256 minSeizeAmount
    ) external override nonReentrant returns (uint256 seizedAmount) {
        if (repayAmount == 0) revert InvalidAmount();
        if (healthFactor(borrower) >= RAY) revert NotLiquidatable();

        _requireActiveAsset(debtAsset);
        _requireActiveAsset(collateralAsset);
        accrueInterest(debtAsset);
        if (collateralAsset != debtAsset) accrueInterest(collateralAsset);

        uint256 borrowerDebt = userBorrowBalance(borrower, debtAsset);
        uint256 actualRepay = repayAmount > borrowerDebt ? borrowerDebt : repayAmount;

        AssetConfig memory debtCfg = _assetConfig[debtAsset];
        AssetConfig memory colCfg = _assetConfig[collateralAsset];
        uint256 debtPrice = ChainlinkOracleAdapter.getPriceWad(debtCfg.priceFeed, ORACLE_MAX_STALE_SECONDS);
        uint256 colPrice = ChainlinkOracleAdapter.getPriceWad(colCfg.priceFeed, ORACLE_MAX_STALE_SECONDS);

        uint256 repayUsd = RiskEngine.tokenToUsdWad(actualRepay, debtCfg.decimals, debtPrice);
        uint256 seizeUsd = (repayUsd * (BPS + colCfg.liquidationBonusBps)) / BPS;
        seizedAmount = RiskEngine.usdWadToToken(seizeUsd, colCfg.decimals, colPrice);
        if (seizedAmount < minSeizeAmount) revert InsufficientLiquidity();

        uint256 borrowerCollateral = userSupplyBalance(borrower, collateralAsset);
        if (seizedAmount > borrowerCollateral) seizedAmount = borrowerCollateral;

        // Repay debt
        ReserveData storage debtR = _reserveData[debtAsset];
        uint256 burnDebtScaled = (actualRepay * RAY) / debtR.borrowIndex;
        if (burnDebtScaled > userBorrowScaled[borrower][debtAsset]) {
            burnDebtScaled = userBorrowScaled[borrower][debtAsset];
        }
        userBorrowScaled[borrower][debtAsset] -= burnDebtScaled;
        debtR.totalBorrowScaled -= burnDebtScaled;
        _safeTransferFrom(debtAsset, msg.sender, address(this), actualRepay);

        // Seize collateral
        ReserveData storage colR = _reserveData[collateralAsset];
        uint256 burnSupplyScaled = (seizedAmount * RAY) / colR.supplyIndex;
        if (burnSupplyScaled > userSupplyScaled[borrower][collateralAsset]) {
            burnSupplyScaled = userSupplyScaled[borrower][collateralAsset];
        }
        userSupplyScaled[borrower][collateralAsset] -= burnSupplyScaled;
        colR.totalSupplyScaled -= burnSupplyScaled;
        _safeTransfer(collateralAsset, msg.sender, seizedAmount);

        emit Liquidated(msg.sender, borrower, debtAsset, collateralAsset, actualRepay, seizedAmount);
    }

    function flashLoan(FlashLoanParams calldata p) external override nonReentrant {
        _requireActiveAsset(p.asset);
        accrueInterest(p.asset);

        ReserveData storage r = _reserveData[p.asset];
        uint256 fee = (p.amount * FLASH_FEE_BPS) / BPS;
        uint256 balanceBefore = IERC20Minimal(p.asset).balanceOf(address(this));

        _safeTransfer(p.asset, p.receiver, p.amount);
        bytes32 ret = IFlashLoanReceiver(p.receiver).onFlashLoan(msg.sender, p.asset, p.amount, fee, p.data);
        if (ret != FLASH_CALLBACK_SUCCESS) revert FlashLoanCallbackFailed();

        uint256 minAfter = balanceBefore + fee;
        uint256 balanceAfter = IERC20Minimal(p.asset).balanceOf(address(this));
        if (balanceAfter < minAfter) revert FlashLoanNotRepaid();

        r.protocolReserves += fee;
        emit FlashLoan(p.receiver, p.asset, p.amount, fee);
    }

    function accrueInterest(address asset) public override {
        AssetConfig memory c = _assetConfig[asset];
        if (c.asset == address(0)) revert AssetNotSupported(asset);

        ReserveData storage r = _reserveData[asset];
        if (r.borrowIndex == 0) r.borrowIndex = RAY;
        if (r.supplyIndex == 0) r.supplyIndex = RAY;
        if (r.lastUpdatedBlock == 0) r.lastUpdatedBlock = uint40(block.number);

        uint256 delta = block.number - r.lastUpdatedBlock;
        if (delta == 0) return;

        uint256 totalBorrows = (r.totalBorrowScaled * r.borrowIndex) / RAY;
        uint256 totalSupplies = (r.totalSupplyScaled * r.supplyIndex) / RAY;

        InterestLogic.ReserveAccrualState memory s = InterestLogic.ReserveAccrualState({
            totalBorrowsUnderlying: totalBorrows,
            totalSuppliesUnderlying: totalSupplies,
            borrowIndex: r.borrowIndex,
            supplyIndex: r.supplyIndex,
            protocolReserves: r.protocolReserves,
            deltaBlocks: delta,
            reserveFactorBps: c.reserveFactorBps
        });

        InterestLogic.AccrualResult memory out = InterestLogic.accrue(s, _kinkParams[asset]);
        r.borrowIndex = out.newBorrowIndex;
        r.supplyIndex = out.newSupplyIndex;
        r.protocolReserves = out.newProtocolReserves;
        r.lastUpdatedBlock = uint40(block.number);

        emit InterestAccrued(asset, r.borrowIndex, r.supplyIndex, r.protocolReserves, r.lastUpdatedBlock);
    }

    function getUtilization(address asset) public view override returns (uint256 utilizationWad) {
        ReserveData memory r = _reserveData[asset];
        uint256 totalBorrows = (r.totalBorrowScaled * r.borrowIndex) / RAY;
        uint256 totalSupplies = (r.totalSupplyScaled * r.supplyIndex) / RAY;
        return InterestLogic.utilizationWad(totalBorrows, totalSupplies);
    }

    function getBorrowRatePerBlock(address asset) external view override returns (uint256 borrowRateRay) {
        return InterestLogic.borrowRatePerBlockRay(getUtilization(asset), _kinkParams[asset]);
    }

    function getSupplyRatePerBlock(address asset) external view override returns (uint256 supplyRateRay) {
        uint256 u = getUtilization(asset);
        uint256 br = InterestLogic.borrowRatePerBlockRay(u, _kinkParams[asset]);
        return InterestLogic.supplyRatePerBlockRay(br, u, _assetConfig[asset].reserveFactorBps);
    }

    function userSupplyBalance(address user, address asset) public view override returns (uint256) {
        ReserveData memory r = _reserveData[asset];
        if (r.supplyIndex == 0) return 0;
        return (userSupplyScaled[user][asset] * r.supplyIndex) / RAY;
    }

    function userBorrowBalance(address user, address asset) public view override returns (uint256) {
        ReserveData memory r = _reserveData[asset];
        if (r.borrowIndex == 0) return 0;
        return (userBorrowScaled[user][asset] * r.borrowIndex) / RAY;
    }

    function healthFactor(address user) public view override returns (uint256 hfRay) {
        (, , uint256 weightedCollateral, uint256 hf) = userAccountData(user);
        if (weightedCollateral == 0) return hf;
        return hf;
    }

    function maxBorrowable(address user, address debtAsset) external view override returns (uint256 amount) {
        (uint256 totalColUsd, uint256 debtUsd, , ) = userAccountData(user);
        uint256 maxDebtUsd = RiskEngine.maxDebtUsdByLtv(totalColUsd, _assetConfig[debtAsset].ltvBps);
        if (maxDebtUsd <= debtUsd) return 0;

        uint256 roomUsd = maxDebtUsd - debtUsd;
        AssetConfig memory c = _assetConfig[debtAsset];
        uint256 p = ChainlinkOracleAdapter.getPriceWad(c.priceFeed, ORACLE_MAX_STALE_SECONDS);
        return RiskEngine.usdWadToToken(roomUsd, c.decimals, p);
    }

    function getReserveData(address asset) external view override returns (ReserveData memory) {
        return _reserveData[asset];
    }

    function getAssetConfig(address asset) external view override returns (AssetConfig memory) {
        return _assetConfig[asset];
    }

    function userAccountData(address user)
        public
        view
        override
        returns (
            uint256 collateralValueUsdWad,
            uint256 debtValueUsdWad,
            uint256 weightedCollateralForHFUsdWad,
            uint256 currentHealthFactorRay
        )
    {
        address[] memory list = _userAssets[user];
        for (uint256 i = 0; i < list.length; i++) {
            address asset = list[i];
            AssetConfig memory c = _assetConfig[asset];
            if (!c.isActive) continue;

            uint256 priceWad = ChainlinkOracleAdapter.getPriceWad(c.priceFeed, ORACLE_MAX_STALE_SECONDS);

            uint256 supplyAmt = userSupplyBalance(user, asset);
            uint256 debtAmt = userBorrowBalance(user, asset);
            uint256 supplyUsd = RiskEngine.tokenToUsdWad(supplyAmt, c.decimals, priceWad);
            uint256 debtUsd = RiskEngine.tokenToUsdWad(debtAmt, c.decimals, priceWad);

            collateralValueUsdWad += supplyUsd;
            debtValueUsdWad += debtUsd;
            weightedCollateralForHFUsdWad += (supplyUsd * c.liquidationThresholdBps) / BPS;
        }

        currentHealthFactorRay = RiskEngine.healthFactorRay(
            RiskEngine.RiskTotals({weightedCollateralUsdWad: weightedCollateralForHFUsdWad, debtUsdWad: debtValueUsdWad})
        );
    }

    function _requireLtvAndHealth(address user, address debtAsset) internal view {
        (uint256 colUsd, uint256 debtUsd, , uint256 hf) = userAccountData(user);
        if (hf < RAY) revert HealthFactorTooLow(hf);

        uint256 maxByLtv = RiskEngine.maxDebtUsdByLtv(colUsd, _assetConfig[debtAsset].ltvBps);
        if (debtUsd > maxByLtv) revert LTVExceeded();
    }

    function _touchUserAsset(address user, address asset) internal {
        if (_userHasAsset[user][asset]) return;
        _userHasAsset[user][asset] = true;
        _userAssets[user].push(asset);
    }

    function _requireActiveAsset(address asset) internal view {
        AssetConfig memory c = _assetConfig[asset];
        if (c.asset == address(0)) revert AssetNotSupported(asset);
        if (!c.isActive) revert AssetNotActive(asset);
    }

    function _safeTransfer(address token, address to, uint256 amount) internal {
        bool ok = IERC20Minimal(token).transfer(to, amount);
        if (!ok) revert InsufficientLiquidity();
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        bool ok = IERC20Minimal(token).transferFrom(from, to, amount);
        if (!ok) revert InsufficientLiquidity();
    }
}
