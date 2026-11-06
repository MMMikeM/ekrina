import { commands } from "./commands";
import { createPalette } from "./palette";

const ran = document.querySelector<HTMLElement>("#ran")!;

createPalette(document.querySelector<HTMLElement>("#palette")!, commands, (command) => {
	ran.textContent = `Ran ${command.title}`;
});
