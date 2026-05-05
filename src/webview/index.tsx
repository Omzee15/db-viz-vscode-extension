import { createRoot } from "react-dom/client";
import App from "./App";
import "@xyflow/react/dist/style.css";
import "./styles.css";

const container = document.getElementById("root")!;
const root = createRoot(container);
root.render(<App />);
