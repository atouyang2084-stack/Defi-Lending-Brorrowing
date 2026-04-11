import React from 'react';
import { HEALTH_FACTOR_LIQUIDATION_THRESHOLD, RAY } from '../protocol/constants';
import { formatHealthFactor } from '../utils/format';

interface HealthFactorBadgeProps {
    healthFactor: bigint;
    showLabel?: boolean;
    size?: 'sm' | 'md' | 'lg';
}

export default function HealthFactorBadge({ 
    healthFactor, 
    showLabel = true,
    size = 'md' 
}: HealthFactorBadgeProps) {
    const hfValue = Number(healthFactor) / RAY;
    const isHealthy = hfValue >= 2.0;
    const isWarning = hfValue >= 1.5 && hfValue < 2.0;
    const isDanger = hfValue >= 1.0 && hfValue < 1.5;
    const isCritical = hfValue < 1.0;

    const getSizeClasses = () => {
        switch (size) {
            case 'sm':
                return 'px-2 py-1 text-sm';
            case 'lg':
                return 'px-4 py-2 text-lg';
            default:
                return 'px-3 py-1.5 text-base';
        }
    };

    const getStatusColor = () => {
        if (isHealthy) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
        if (isWarning) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
        if (isDanger) return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
        if (isCritical) return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    };

    const getStatusText = () => {
        if (isHealthy) return 'Healthy';
        if (isWarning) return 'Warning';
        if (isDanger) return 'Danger';
        if (isCritical) return 'Critical';
        return 'Unknown';
    };

    return (
        <div className="inline-flex items-center gap-2">
            <div className={`inline-flex items-center gap-2 rounded-full font-medium ${getSizeClasses()} ${getStatusColor()}`}>
                {showLabel && (
                    <span className="font-semibold">{getStatusText()}</span>
                )}
                <span className="font-mono font-bold">
                    {formatHealthFactor(healthFactor)}
                </span>
            </div>
            {isCritical && (
                <span className="text-xs text-red-600 dark:text-red-400 font-medium animate-pulse">
                    ⚠️ Liquidation Risk
                </span>
            )}
        </div>
    );
}
