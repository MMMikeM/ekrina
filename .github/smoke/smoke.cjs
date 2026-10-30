// The CommonJS entry point, checked separately: it is its own bundle.
const { createFuzzySearch, fuzzyMatch, SCORES } = require("../../package/dist/index.cjs");

const check = (label, passed) => {
	if (!passed) throw new Error(`smoke (cjs): ${label}`);
};

const search = createFuzzySearch(["Handcrafted Wooden Chair", "Steel Table", "Café Crème"]);
check("ranks a word", search("wooden")[0]?.item === "Handcrafted Wooden Chair");
check("folds accents", search("cafe")[0]?.item === "Café Crème");
check("corrects a typo", search("woodne")[0]?.fields[0]?.tier === "corrected");
check("matches a phrase in any order", search("chair wooden")[0]?.fields[0]?.tier === "multi-word");
check("returns ranges", fuzzyMatch("Steel Table", "table")?.ranges[0][0] === 6);
check("exports scores", SCORES.CONTAINS === 2);
console.log("smoke (cjs) ok");
