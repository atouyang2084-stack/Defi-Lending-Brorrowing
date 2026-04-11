import React, { useState } from 'react';

interface AmountInputProps {
    value: string;
    onChange: (value: string) => void;
    max?: bigint;
    decimals?: number;
    symbol?: string;
    placeholder?: string;
    disabled?: boolean;
    showMaxButton?: boolean;
}

export default function AmountInput({
    value,
    onChange,
    max,
    decimals = 18,
    symbol = '',
    placeholder = '0.00',
    disabled = false,
    showMaxButton = true,
}: AmountInputProps) {
    const [displayValue, setDisplayValue] = useState(value);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const inputValue = e.target.value;

        // 允许输入数字和小数点
        if (!/^\d*\.?\d*$/.test(inputValue)) return;

        // 限制小数位数
        const parts = inputValue.split('.');
        if (parts[1] && parts[1].length > decimals) return;

        setDisplayValue(inputValue);
        onChange(inputValue);
    };

    const handleMaxClick = () => {
        if (max !== undefined) {
            const maxValue = Number(max) / 10 ** decimals;
            setDisplayValue(maxValue.toString());
            onChange(maxValue.toString());
        }
    };

    const formatDisplayValue = (val: string) => {
        if (!val) return '';
        const num = parseFloat(val);
        if (isNaN(num)) return val;
        return num.toFixed(decimals);
    };

    return (
        <div className="relative w-full">
            <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <input
                    type="text"
                    value={displayValue}
                    onChange={handleInputChange}
                    placeholder={placeholder}
                    disabled={disabled}
                    className="flex-1 bg-transparent text-2xl font-semibold text-gray-900 dark:text-white outline-none placeholder-gray-400 dark:placeholder-gray-500"
                />
                <div className="flex items-center gap-2">
                    {showMaxButton && max !== undefined && max > 0n && (
                        <button
                            type="button"
                            onClick={handleMaxClick}
                            disabled={disabled}
                            className="px-3 py-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            MAX
                        </button>
                    )}
                    {symbol && (
                        <span className="text-lg font-medium text-gray-600 dark:text-gray-400">
                            {symbol}
                        </span>
                    )}
                </div>
            </div>
            {max !== undefined && (
                <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Available: {formatDisplayValue((Number(max) / 10 ** decimals).toString())} {symbol}
                </div>
            )}
        </div>
    );
}
