import { Navigate, type RouteObject } from "react-router-dom";
import Dashboard from "../pages/Dashboard";
import Reserve from "../pages/Reserve";
import SimpleLiquidation from "../pages/SimpleLiquidation";
// import Position from "../pages/Position";
// import FlashLoan from "../pages/FlashLoan";

export const routes: RouteObject[] = [
    { path: "/", element: <Dashboard /> },
    { path: "/reserve/:asset", element: <Reserve /> },
    { path: "/liquidation", element: <SimpleLiquidation /> },
    // { path: "/position", element: <Position /> },
    // { path: "/flashloan", element: <FlashLoan /> },
    { path: "*", element: <Navigate to="/" replace /> },
];
