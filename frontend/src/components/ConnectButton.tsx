import { ConnectButton as RKConnectButton } from "@rainbow-me/rainbowkit";

export default function ConnectButton() {
    return <RKConnectButton chainStatus="icon" showBalance={false} />;
}
