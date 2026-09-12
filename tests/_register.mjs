// Registers the resolver below for every test run (package.json "test" passes --import).
import { register } from "node:module";
register("./_resolve-ts.mjs", import.meta.url);
