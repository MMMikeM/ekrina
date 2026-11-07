// Each timed query runs once unless BENCH_REPEAT=1 asks for warm-ups and a
// median; `vpr bench` sets it whenever its timings are written to the artifact.
export const REPEAT: boolean = process.env.BENCH_REPEAT === "1";
