// https://github.com/motdotla/dotenv/issues/133#issuecomment-255298822
// explanation: ESM import statements execute first
// so the .config gets called after all other imports in index.ts
// and one of those imports is the sequelize loader, which depends on env being loaded
// soln: raise the priority of dotenv to match by placing it in a separate module like this

import { config, type DotenvConfigOutput } from "dotenv";

const result: DotenvConfigOutput = config({
  path: [
    `.env.${process.env["NODE_ENV"]}.local`,
    `.env.${process.env["NODE_ENV"]}`,
    ".env.local",
    ".env",
  ],
});

export default result;
