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
        
        // 计算并检查是否会导致溢出
        uint256 scaled = (p.amount * RAY) / r.supplyIndex;
        if (scaled == 0) revert InvalidAmount(); // 防止精度损失
        if (userSupplyScaled[user][p.asset] > type(uint256).max - scaled) {
            revert InsufficientLiquidity(); // 用户存款会导致溢出
        }
        if (r.totalSupplyScaled > type(uint256).max - scaled) {
            revert InsufficientLiquidity(); // 总存款会导致溢出
        }
        
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

        // 先扣除抵押品，再检查健康因子
        userSupplyScaled[msg.sender][p.asset] -= scaledToBurn;
        r.totalSupplyScaled -= scaledToBurn;

        // 检查提款后的健康因子
        uint256 hf = healthFactor(msg.sender);
        if (hf < RAY) {
            // 如果健康因子低于 1，恢复抵押品并回滚
            userSupplyScaled[msg.sender][p.asset] += scaledToBurn;
            r.totalSupplyScaled += scaledToBurn;
            revert HealthFactorTooLow(hf);
        }
        
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
        
        // 检查借款金额是否会导致溢出
        uint256 scaled = (p.amount * RAY) / r.borrowIndex;
        if (scaled == 0) revert InvalidAmount(); // 防止精度损失导致借款失败
        if (userBorrowScaled[user][p.asset] > type(uint256).max - scaled) {
            revert InsufficientLiquidity(); // 借款会导致溢出
        }
        if (r.totalBorrowScaled > type(uint256).max - scaled) {
            revert InsufficientLiquidity(); // 总借款会导致溢出
        }
        
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
        if (repaidAmount == 0) return 0;
        
        ReserveData storage r = _reserveData[p.asset];
        uint256 scaledToBurn = (repaidAmount * RAY) / r.borrowIndex;
        
        // 确保不会燃烧超过用户拥有的金额
        if (scaledToBurn > userBorrowScaled[user][p.asset]) {
            scaledToBurn = userBorrowScaled[user][p.asset];
        }
        
        // 确保不会燃烧超过总借款的金额
        if (scaledToBurn > r.totalBorrowScaled) {
            scaledToBurn = r.totalBorrowScaled;
        }
        
        if (scaledToBurn == 0) return 0;

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
        if (borrower == address(0)) revert InvalidAmount();
        if (debtAsset == address(0) || collateralAsset == address(0)) revert AssetNotSupported(address(0));
        
        uint256 hf = healthFactor(borrower);
        if (hf >= RAY) revert NotLiquidatable();

        _requireActiveAsset(debtAsset);
        _requireActiveAsset(collateralAsset);
        accrueInterest(debtAsset);
        if (collateralAsset != debtAsset) accrueInterest(collateralAsset);

        uint256 borrowerDebt = userBorrowBalance(borrower, debtAsset);
        if (borrowerDebt == 0) revert NotLiquidatable();
        uint256 actualRepay = repayAmount > borrowerDebt ? borrowerDebt : repayAmount;
        if (actualRepay == 0) revert InvalidAmount();

        AssetConfig memory debtCfg = _assetConfig[debtAsset];
        AssetConfig memory colCfg = _assetConfig[collateralAsset];
        uint256 debtPrice = ChainlinkOracleAdapter.getPriceWad(debtCfg.priceFeed, ORACLE_MAX_STALE_SECONDS);
        uint256 colPrice = ChainlinkOracleAdapter.getPriceWad(colCfg.priceFeed, ORACLE_MAX_STALE_SECONDS);
        
        if (debtPrice == 0 || colPrice == 0) revert OraclePriceInvalid();

        uint256 repayUsd = RiskEngine.tokenToUsdWad(actualRepay, debtCfg.decimals, debtPrice);
        uint256 seizeUsd = (repayUsd * (BPS + colCfg.liquidationBonusBps)) / BPS;
        seizedAmount = RiskEngine.usdWadToToken(seizeUsd, colCfg.decimals, colPrice);
        if (seizedAmount < minSeizeAmount) revert InsufficientLiquidity();
        if (seizedAmount == 0) revert InsufficientLiquidity();

        uint256 borrowerCollateral = userSupplyBalance(borrower, collateralAsset);
        if (seizedAmount > borrowerCollateral) seizedAmount = borrowerCollateral;
        if (seizedAmount == 0) revert InsufficientLiquidity();

        // Repay debt
        ReserveData storage debtR = _reserveData[debtAsset];
        uint256 burnDebtScaled = (actualRepay * RAY) / debtR.borrowIndex;
        if (burnDebtScaled > userBorrowScaled[borrower][debtAsset]) {
            burnDebtScaled = userBorrowScaled[borrower][debtAsset];
        }
        if (burnDebtScaled == 0) revert InsufficientLiquidity();
        userBorrowScaled[borrower][debtAsset] -= burnDebtScaled;
        debtR.totalBorrowScaled -= burnDebtScaled;
        _safeTransferFrom(debtAsset, msg.sender, address(this), actualRepay);

        // Seize collateral
        ReserveData storage colR = _reserveData[collateralAsset];
        uint256 burnSupplyScaled = (seizedAmount * RAY) / colR.supplyIndex;
        if (burnSupplyScaled > userSupplyScaled[borrower][collateralAsset]) {
            burnSupplyScaled = userSupplyScaled[borrower][collateralAsset];
        }
        if (burnSupplyScaled == 0) revert InsufficientLiquidity();
        userSupplyScaled[borrower][collateralAsset] -= burnSupplyScaled;
        colR.totalSupplyScaled -= burnSupplyScaled;
        _safeTransfer(collateralAsset, msg.sender, seizedAmount);

        emit Liquidated(msg.sender, borrower, debtAsset, collateralAsset, actualRepay, seizedAmount);
    }

    function flashLoan(FlashLoanParams calldata p) external override nonReentrant {
        if (p.amount == 0) revert InvalidAmount();
        if (p.receiver == address(0)) revert InvalidAmount();
        _requireActiveAsset(p.asset);
        accrueInterest(p.asset);

        ReserveData storage r = _reserveData[p.asset];
        uint256 balanceBefore = IERC20Minimal(p.asset).balanceOf(address(this));
        
        // 检查池子是否有足够的流动性
        if (balanceBefore < p.amount) revert InsufficientLiquidity();
        
        uint256 fee = (p.amount * FLASH_FEE_BPS) / BPS;
        uint256 totalToRepay = p.amount + fee;
        
        // 检查费用是否会导致溢出
        if (totalToRepay < p.amount) revert InvalidAmount();
        if (r.protocolReserves > type(uint256).max - fee) {
            revert InsufficientLiquidity(); // 协议储备会溢出
        }

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

        // 防止过大的 delta 导致计算溢出
        if (delta > 1000000) {
            // 如果 delta 过大（例如超过 100 万个区块），限制为 100 万
            delta = 1000000;
        }

        uint256 totalBorrows = (r.totalBorrowScaled * r.borrowIndex) / RAY;
        uint256 totalSupplies = (r.totalSupplyScaled * r.supplyIndex) / RAY;

        // 防止除零错误
        if (totalSupplies == 0) totalSupplies = 1;

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
        
        // 确保索引不会减少
        if (out.newBorrowIndex < r.borrowIndex) {
            out.newBorrowIndex = r.borrowIndex;
        }
        if (out.newSupplyIndex < r.supplyIndex) {
            out.newSupplyIndex = r.supplyIndex;
        }
        
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
            if (priceWad == 0) continue; // 跳过价格为 0 的资产

            uint256 supplyAmt = userSupplyBalance(user, asset);
            uint256 debtAmt = userBorrowBalance(user, asset);
            uint256 supplyUsd = RiskEngine.tokenToUsdWad(supplyAmt, c.decimals, priceWad);
            uint256 debtUsd = RiskEngine.tokenToUsdWad(debtAmt, c.decimals, priceWad);
            
            // 防止溢出检查
            if (collateralValueUsdWad > type(uint256).max - supplyUsd) {
                supplyUsd = type(uint256).max - collateralValueUsdWad;
            }
            if (debtValueUsdWad > type(uint256).max - debtUsd) {
                debtUsd = type(uint256).max - debtValueUsdWad;
            }

            collateralValueUsdWad += supplyUsd;
            debtValueUsdWad += debtUsd;
            
            // 防止加权抵押品溢出
            uint256 weighted = (supplyUsd * c.liquidationThresholdBps) / BPS;
            if (weightedCollateralForHFUsdWad > type(uint256).max - weighted) {
                weighted = type(uint256).max - weightedCollateralForHFUsdWad;
            }
            weightedCollateralForHFUsdWad += weighted;
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
