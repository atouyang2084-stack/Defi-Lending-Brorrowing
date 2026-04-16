import { RAY, WAD } from '../protocol/constants';

interface InterestModelParams {
	baseRatePerYearRay: bigint;
	slope1PerYearRay: bigint;
	slope2PerYearRay: bigint;
	kinkWad: bigint;
	blocksPerYear: number;
}

interface InterestCurveProps {
	model: InterestModelParams;
	reserveFactorBps: number;
	utilizationWad?: bigint;
	borrowRatePerBlockRay?: bigint;
	supplyRatePerBlockRay?: bigint;
}

type CurvePoint = {
	uWad: bigint;
	borrowAprRay: bigint;
	supplyAprRay: bigint;
};

function toPercentFromWad(value: bigint): number {
	return (Number(value) / WAD) * 100;
}

function toPercentFromRay(value: bigint): number {
	return (Number(value) / RAY) * 100;
}

function borrowAprRayAtUtilization(uWad: bigint, model: InterestModelParams): bigint {
	if (uWad <= model.kinkWad) {
		const term = model.kinkWad === 0n ? 0n : (model.slope1PerYearRay * uWad) / model.kinkWad;
		return model.baseRatePerYearRay + term;
	}

	const excess = uWad - model.kinkWad;
	const denom = BigInt(WAD) - model.kinkWad;
	const term2 = denom === 0n ? 0n : (model.slope2PerYearRay * excess) / denom;
	return model.baseRatePerYearRay + model.slope1PerYearRay + term2;
}

function supplyAprRayAtUtilization(borrowAprRay: bigint, uWad: bigint, reserveFactorBps: number): bigint {
	const reserveFactorWad = BigInt(reserveFactorBps) * 100000000000000n; // bps -> wad
	const oneMinusReserveWad = BigInt(WAD) - reserveFactorWad;
	const utilizationAdjusted = (borrowAprRay * uWad) / BigInt(WAD);
	return (utilizationAdjusted * oneMinusReserveWad) / BigInt(WAD);
}

function buildCurvePoints(model: InterestModelParams, reserveFactorBps: number): CurvePoint[] {
	const points: CurvePoint[] = [];
	const steps = 25;

	for (let i = 0; i <= steps; i += 1) {
		const uWad = (BigInt(WAD) * BigInt(i)) / BigInt(steps);
		const borrowAprRay = borrowAprRayAtUtilization(uWad, model);
		const supplyAprRay = supplyAprRayAtUtilization(borrowAprRay, uWad, reserveFactorBps);
		points.push({ uWad, borrowAprRay, supplyAprRay });
	}

	return points;
}

function toSvgPath(points: CurvePoint[], maxAprPercent: number, pickY: (p: CurvePoint) => number): string {
	const width = 100;
	const height = 50;

	return points
		.map((point, index) => {
			const x = toPercentFromWad(point.uWad);
			const yPercent = pickY(point);
			const y = height - (yPercent / maxAprPercent) * height;
			return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
		})
		.join(' ')
		.replace(/NaN/g, '0')
		.replace(/Infinity/g, `${width}`);
}

export default function InterestCurve({
	model,
	reserveFactorBps,
	utilizationWad,
	borrowRatePerBlockRay,
	supplyRatePerBlockRay,
}: InterestCurveProps) {
	const points = buildCurvePoints(model, reserveFactorBps);
	const maxBorrowApr = Math.max(...points.map((p) => toPercentFromRay(p.borrowAprRay)), 1);
	const maxSupplyApr = Math.max(...points.map((p) => toPercentFromRay(p.supplyAprRay)), 1);
	const maxApr = Math.max(maxBorrowApr, maxSupplyApr) * 1.1;

	const borrowPath = toSvgPath(points, maxApr, (p) => toPercentFromRay(p.borrowAprRay));
	const supplyPath = toSvgPath(points, maxApr, (p) => toPercentFromRay(p.supplyAprRay));

	const currentUtilizationWad = utilizationWad ?? 0n;
	const currentUtilizationPercent = toPercentFromWad(currentUtilizationWad);

	const currentBorrowAprFromModel = toPercentFromRay(borrowAprRayAtUtilization(currentUtilizationWad, model));
	const currentSupplyAprFromModel = toPercentFromRay(
		supplyAprRayAtUtilization(
			borrowAprRayAtUtilization(currentUtilizationWad, model),
			currentUtilizationWad,
			reserveFactorBps
		)
	);

	const currentBorrowAprFromChain = borrowRatePerBlockRay
		? (Number(borrowRatePerBlockRay) * model.blocksPerYear * 100) / RAY
		: null;
	const currentSupplyAprFromChain = supplyRatePerBlockRay
		? (Number(supplyRatePerBlockRay) * model.blocksPerYear * 100) / RAY
		: null;

	const markerY = 50 - (currentBorrowAprFromModel / maxApr) * 50;

	return (
		<div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 space-y-4">
			<div className="flex items-center justify-between">
				<h3 className="text-lg font-semibold text-gray-900 dark:text-white">Interest Rate Model</h3>
				<span className="text-sm text-gray-500 dark:text-gray-400">Kinked Model</span>
			</div>

			<div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
				<div className="bg-gray-50 dark:bg-gray-700/60 rounded-lg p-3">
					<div className="text-gray-500 dark:text-gray-400">Utilization</div>
					<div className="font-semibold text-gray-900 dark:text-white">{currentUtilizationPercent.toFixed(2)}%</div>
				</div>
				<div className="bg-gray-50 dark:bg-gray-700/60 rounded-lg p-3">
					<div className="text-gray-500 dark:text-gray-400">Kink</div>
					<div className="font-semibold text-gray-900 dark:text-white">{toPercentFromWad(model.kinkWad).toFixed(2)}%</div>
				</div>
				<div className="bg-gray-50 dark:bg-gray-700/60 rounded-lg p-3">
					<div className="text-gray-500 dark:text-gray-400">Borrow APR</div>
					<div className="font-semibold text-red-600 dark:text-red-400">{currentBorrowAprFromModel.toFixed(2)}%</div>
				</div>
				<div className="bg-gray-50 dark:bg-gray-700/60 rounded-lg p-3">
					<div className="text-gray-500 dark:text-gray-400">Supply APR</div>
					<div className="font-semibold text-green-600 dark:text-green-400">{currentSupplyAprFromModel.toFixed(2)}%</div>
				</div>
			</div>

			<div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
				<svg viewBox="0 0 100 50" className="w-full h-48">
					<line x1="0" y1="50" x2="100" y2="50" stroke="currentColor" className="text-gray-300 dark:text-gray-600" strokeWidth="0.4" />
					<line x1="0" y1="0" x2="0" y2="50" stroke="currentColor" className="text-gray-300 dark:text-gray-600" strokeWidth="0.4" />
					<line
						x1={toPercentFromWad(model.kinkWad).toString()}
						y1="0"
						x2={toPercentFromWad(model.kinkWad).toString()}
						y2="50"
						stroke="currentColor"
						className="text-yellow-400 dark:text-yellow-500"
						strokeDasharray="1.5 1.5"
						strokeWidth="0.5"
					/>
					<path d={supplyPath} fill="none" stroke="currentColor" className="text-green-500" strokeWidth="1.2" />
					<path d={borrowPath} fill="none" stroke="currentColor" className="text-red-500" strokeWidth="1.2" />
					<circle
						cx={currentUtilizationPercent.toString()}
						cy={markerY.toString()}
						r="1.1"
						fill="currentColor"
						className="text-red-500"
					/>
				</svg>

				<div className="mt-2 flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
					<span className="inline-flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded-full" /> Borrow APR Curve</span>
					<span className="inline-flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full" /> Supply APR Curve</span>
					<span className="inline-flex items-center gap-1"><span className="w-2 h-2 bg-yellow-500 rounded-full" /> Kink</span>
				</div>
			</div>

			<div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs text-gray-600 dark:text-gray-400">
				<div>Base Rate: {toPercentFromRay(model.baseRatePerYearRay).toFixed(2)}%</div>
				<div>Slope1: {toPercentFromRay(model.slope1PerYearRay).toFixed(2)}%</div>
				<div>Slope2: {toPercentFromRay(model.slope2PerYearRay).toFixed(2)}%</div>
				<div>Reserve Factor: {(reserveFactorBps / 100).toFixed(2)}%</div>
				<div>Borrow/Block (chain): {currentBorrowAprFromChain !== null ? `${currentBorrowAprFromChain.toFixed(2)}% APR` : '--'}</div>
				<div>Supply/Block (chain): {currentSupplyAprFromChain !== null ? `${currentSupplyAprFromChain.toFixed(2)}% APR` : '--'}</div>
			</div>
		</div>
	);
}
