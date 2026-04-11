import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import { AppProviders } from "./app/providers";
import App from "./app/App";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <AppProviders>
            <BrowserRouter>
                <App />
            </BrowserRouter>
        </AppProviders>
    </React.StrictMode>
);
