export const addresses = {
    lendingPool: String(import.meta.env.VITE_LENDING_POOL || "0x0000000000000000000000000000000000000000"),
    oracle: String(import.meta.env.VITE_ORACLE || "0x0000000000000000000000000000000000000000"),
} as const;
