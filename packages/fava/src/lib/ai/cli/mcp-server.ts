import { startMcpServer } from "../mcp-runtime";

type Args = { projectId?: string; sessionId: string; activePath?: string };

function parseArgs(argv: string[]): Args {
  const args: Args = { sessionId: "ledger" };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--project-id") args.projectId = argv[++index];
    else if (value === "--session-id")
      args.sessionId = argv[++index] ?? args.sessionId;
    else if (value === "--active-path") args.activePath = argv[++index];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.projectId) {
  process.stderr.write("Beancount Studio MCP needs --project-id.\n");
  process.exit(1);
}

startMcpServer({
  projectId: args.projectId,
  sessionId: args.sessionId,
  activePath: args.activePath,
});
