export type Command = {
	id: string;
	title: string;
	category: string;
	keywords?: string;
};

export const commands: Command[] = [
	{ id: "file.new", title: "New File", category: "File" },
	{ id: "file.open", title: "Open File…", category: "File" },
	{ id: "file.openRecent", title: "Open Recent", category: "File" },
	{ id: "file.save", title: "Save", category: "File" },
	{ id: "file.saveAll", title: "Save All", category: "File" },
	{ id: "file.close", title: "Close Editor", category: "File" },
	{ id: "edit.find", title: "Find", category: "Edit", keywords: "search" },
	{ id: "edit.replace", title: "Find and Replace", category: "Edit", keywords: "search substitute" },
	{ id: "edit.comment", title: "Toggle Line Comment", category: "Edit" },
	{ id: "edit.format", title: "Format Document", category: "Edit", keywords: "prettier beautify indent" },
	{ id: "view.terminal", title: "Toggle Terminal", category: "View", keywords: "console shell" },
	{ id: "view.sidebar", title: "Toggle Sidebar", category: "View" },
	{ id: "view.zoomIn", title: "Zoom In", category: "View", keywords: "bigger font size" },
	{ id: "view.zoomOut", title: "Zoom Out", category: "View", keywords: "smaller font size" },
	{ id: "go.line", title: "Go to Line…", category: "Go" },
	{ id: "go.symbol", title: "Go to Symbol…", category: "Go", keywords: "function class outline" },
	{ id: "git.commit", title: "Git: Commit", category: "Source Control" },
	{ id: "git.push", title: "Git: Push", category: "Source Control" },
	{ id: "git.pull", title: "Git: Pull", category: "Source Control" },
	{ id: "settings.open", title: "Preferences: Open User Settings", category: "Preferences" },
	{
		id: "settings.keys",
		title: "Preferences: Keyboard Shortcuts",
		category: "Preferences",
		keywords: "keybindings hotkeys",
	},
	{
		id: "settings.theme",
		title: "Preferences: Theme",
		category: "Preferences",
		keywords: "dark light appearance",
	},
];
