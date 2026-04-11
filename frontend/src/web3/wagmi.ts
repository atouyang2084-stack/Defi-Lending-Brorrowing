import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
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

export const wagmiConfig = createConfig({
    chains,
    connectors: [injected()],
    transports: {
        [customLocalhost.id]: http(rpcUrl),
    },
});
