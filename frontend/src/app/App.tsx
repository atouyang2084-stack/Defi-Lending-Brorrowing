import { useRoutes } from "react-router-dom";
import { routes } from "./routes";
import Layout from "../components/Layout";

export default function App() {
    const element = useRoutes(routes);
    return <Layout>{element}</Layout>;
}
