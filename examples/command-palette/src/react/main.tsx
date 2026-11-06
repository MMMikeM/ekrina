import { useState } from "react";
import { createRoot } from "react-dom/client";
import { commands } from "../commands";
import { CommandPalette } from "./palette";

const App = () => {
	const [ran, setRan] = useState("");
	return (
		<main>
			<CommandPalette commands={commands} run={(command) => setRan(`Ran ${command.title}`)} />
			<p id="ran" aria-live="polite">
				{ran}
			</p>
		</main>
	);
};

createRoot(document.querySelector("#root")!).render(<App />);
