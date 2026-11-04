import { readings } from "../src/readings";

// The ladder and its one-edit rescue alone, for the guards that audit their
// gates: the second pass is swapped out while `run` runs, since its readings
// pass gates of their own (searcher-parity.test.ts checks those).
const { prepare } = readings;
export const secondPass: typeof prepare = prepare;

export const withoutSecondPass = <T>(run: () => T): T => {
	readings.prepare = () => null;
	try {
		return run();
	} finally {
		readings.prepare = prepare;
	}
};
