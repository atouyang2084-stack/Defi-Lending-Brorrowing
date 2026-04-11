import { Link, NavLink } from "react-router-dom";
import ConnectButton from "./ConnectButton";

const nav = [
    { to: "/", label: "Dashboard" },
    { to: "/reserve/usdc", label: "USDC Market" },
    { to: "/reserve/wbtc", label: "WBTC Market" },
    // { to: "/position", label: "Position" },
    // { to: "/liquidation", label: "Liquidation" },
    // { to: "/flashloan", label: "Flash Loan" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100">
            <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
                    <Link to="/" className="font-semibold tracking-tight">
                        DeFi Lending
                    </Link>

                    <nav className="hidden gap-4 md:flex">
                        {nav.map((x) => (
                            <NavLink
                                key={x.to}
                                to={x.to}
                                className={({ isActive }) =>
                                    `text-sm ${isActive ? "text-white" : "text-zinc-400 hover:text-zinc-200"}`
                                }
                            >
                                {x.label}
                            </NavLink>
                        ))}
                    </nav>

                    <ConnectButton />
                </div>
            </header>

            <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        </div>
    );
}
