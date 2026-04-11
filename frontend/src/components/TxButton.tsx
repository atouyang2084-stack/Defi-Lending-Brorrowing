import React from 'react';

interface TxButtonProps {
    onClick?: () => void;
    disabled?: boolean;
    isPending?: boolean;
    isConfirming?: boolean;
    isSuccess?: boolean;
    children: React.ReactNode;
    variant?: 'primary' | 'secondary' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    fullWidth?: boolean;
}

export default function TxButton({
    onClick,
    disabled = false,
    isPending = false,
    isConfirming = false,
    isSuccess = false,
    children,
    variant = 'primary',
    size = 'md',
    fullWidth = false,
}: TxButtonProps) {
    const getVariantClasses = () => {
        switch (variant) {
            case 'secondary':
                return 'bg-gray-200 text-gray-900 hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600';
            case 'danger':
                return 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600';
            default:
                return 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600';
        }
    };

    const getSizeClasses = () => {
        switch (size) {
            case 'sm':
                return 'px-3 py-1.5 text-sm';
            case 'lg':
                return 'px-6 py-3 text-lg';
            default:
                return 'px-4 py-2 text-base';
        }
    };

    const isLoading = isPending || isConfirming;
    const isDisabled = disabled || isLoading;

    return (
        <button
            onClick={onClick}
            disabled={isDisabled}
            className={`
                ${getVariantClasses()}
                ${getSizeClasses()}
                ${fullWidth ? 'w-full' : ''}
                font-semibold rounded-lg
                transition-all duration-200
                disabled:opacity-50 disabled:cursor-not-allowed
                flex items-center justify-center gap-2
            `}
        >
            {isLoading && (
                <svg
                    className="animate-spin h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                >
                    <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                    />
                    <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                </svg>
            )}
            {isSuccess && (
                <svg
                    className="h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                    />
                </svg>
            )}
            {isConfirming ? 'Confirming...' : isPending ? 'Pending...' : children}
        </button>
    );
}
