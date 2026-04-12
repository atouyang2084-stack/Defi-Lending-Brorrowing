import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { localhost } from "wagmi/chains";

const rpcUrl = String(import.meta.env.VITE_RPC_URL || "http://127.0.0.1:8545");

const customLocalhost = {
    ...localhost,
    id: 31337,
    name: "Localhost",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: {
        default: { http: [rpcUrl] },
        public: { http: [rpcUrl] },
    },
};

export const chains = [customLocalhost];

export const wagmiConfig = getDefaultConfig({
    appName: "DeFi Lending Protocol",
    projectId: "defi-lending-protocol-local",
    chains: [customLocalhost],
    transports: {
        [customLocalhost.id]: http(rpcUrl),
    },
    ssr: false, // 禁用 SSR
});
