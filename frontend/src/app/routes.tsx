import { Navigate, type RouteObject } from "react-router-dom";
import Dashboard from "../pages/Dashboard";
import Reserve from "../pages/Reserve";
// import Position from "../pages/Position";
// import Liquidation from "../pages/Liquidation";
// import FlashLoan from "../pages/FlashLoan";

export const routes: RouteObject[] = [
    { path: "/", element: <Dashboard /> },
    { path: "/reserve/:asset", element: <Reserve /> },
    // { path: "/position", element: <Position /> },
    // { path: "/liquidation", element: <Liquidation /> },
    // { path: "/flashloan", element: <FlashLoan /> },
    { path: "*", element: <Navigate to="/" replace /> },
];
