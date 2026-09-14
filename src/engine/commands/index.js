import look from "./look.js";
import examine from "./examine.js";
import take from "./take.js";
import use from "./use.js";
import enter from "./enter.js";
import go from "./go.js";
import inventory from "./inventory.js";
import hint from "./hint.js";
import help from "./help.js";

export { ALIASES } from "../parser.js";

/** verb → 핸들러. save/load/quit 은 UI 가 처리하므로 여기 없다. */
export const COMMANDS = { look, examine, take, use, enter, go, inventory, hint, help };
