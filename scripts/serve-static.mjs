import { resolve } from "node:path";
import { createStaticServer } from "./static-server.mjs";

const root = resolve(process.cwd());
const portFlagIndex = process.argv.indexOf("--port");
const portFlagValue = process.argv.find((arg) => arg.startsWith("--port="));
const port =
  Number(portFlagValue?.split("=")[1] || process.argv[portFlagIndex + 1] || process.env.PORT) ||
  4174;
const server = createStaticServer(root);
const hostFlagIndex = process.argv.indexOf("--host");
const hostFlagValue = process.argv.find((arg) => arg.startsWith("--host="));
const host = hostFlagValue?.slice("--host=".length) || (hostFlagIndex >= 0 ? process.argv[hostFlagIndex + 1] : undefined) || "127.0.0.1";

server.listen(port, host, () => {
  console.log(`nithi.land preview running at http://${host}:${port}`);
});
