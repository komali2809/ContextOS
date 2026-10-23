
import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(currentDir, "../data");
const notesPath = path.join(dataDir, "notes.md");
const memoriesPath = path.join(dataDir, "memories.json");

async function ensureDataFiles() {
  await mkdir(dataDir, { recursive: true });

  try {
    await readFile(notesPath, "utf8");
  } catch {
    await writeFile(
      notesPath,
      "# ContextOS Notes\nAdd your project notes here.\n",
      "utf8"
    );
  }

  try {
    await readFile(memoriesPath, "utf8");
  } catch {
    await writeFile(memoriesPath, "[]", "utf8");
  }
}

function createMcpServer() {
  const server = new McpServer({
    name: "contextos-mcp",
    version: "1.0.0",
  });

  server.registerTool(
    "contextos_status",
    {
      description:
        "Get the status and capabilities of the ContextOS MCP demo server.",
      inputSchema: {},
    },
    async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            name: "ContextOS MCP",
            status: "running",
            capabilities: [
              "Search local project notes",
              "Save a memory with explicit approval",
            ],
            memoryStorage: "Local demo JSON file",
            connectedToSupabase: false,
          }, null, 2),
        },
      ],
    })
  );

  server.registerTool(
    "search_contextos_notes",
    {
      description:
        "Search the local ContextOS project notes for matching text.",
      inputSchema: {
        query: z.string().min(1).describe("Words to search for"),
      },
    },
    async ({ query }) => {
      const notes = await readFile(notesPath, "utf8");
      const terms = query
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);

      const lines = notes.split(/\r?\n/);
      const matches = lines.filter((line) =>
        terms.some((term) => line.toLowerCase().includes(term))
      );

      return {
        content: [
          {
            type: "text",
            text: matches.length
              ? matches.join("\n")
              : `No matching lines found for: ${query}`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "save_approved_memory",
    {
      description:
        "Save a memory to local demo storage only when the user has explicitly approved saving it.",
      inputSchema: {
        memory: z.string().min(1).max(1000).describe("Memory to save"),
        userApproved: z
          .boolean()
          .describe("Must be true only after the user explicitly approves saving this memory"),
      },
    },
    async ({ memory, userApproved }) => {
      if (userApproved !== true) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "Memory not saved. Obtain explicit user approval first.",
            },
          ],
        };
      }

      const raw = await readFile(memoriesPath, "utf8");
      const memories: Array<{
        id: string;
        memory: string;
        savedAt: string;
      }> = JSON.parse(raw);

      const saved = {
        id: randomUUID(),
        memory,
        savedAt: new Date().toISOString(),
      };

      memories.push(saved);
      await writeFile(
        memoriesPath,
        JSON.stringify(memories, null, 2),
        "utf8"
      );

      return {
        content: [
          {
            type: "text",
            text: `Saved approved memory locally. ID: ${saved.id}`,
          },
        ],
      };
    }
  );

  return server;
}

const app = express();

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Mcp-Session-Id",
      "MCP-Protocol-Version",
      "Last-Event-ID",
    ],
    exposedHeaders: ["Mcp-Session-Id", "MCP-Protocol-Version"],
  })
);

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    server: "contextos-mcp",
    endpoint: "/mcp",
  });
});

app.all("/mcp", async (req, res) => {
  const mcpServer = createMcpServer();

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  res.on("close", () => {
    void transport.close();
    void mcpServer.close();
  });

  try {
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("MCP request failed:", error);

    if (!res.headersSent) {
      res.status(500).json({
        error: "MCP request failed",
      });
    }
  }
});

const PORT = Number(process.env.MCP_PORT || 3333);

async function main() {
  await ensureDataFiles();

  app.listen(PORT, "127.0.0.1", () => {
    console.log(`ContextOS MCP server: http://127.0.0.1:${PORT}/mcp`);
    console.log(`Health check: http://127.0.0.1:${PORT}/health`);
  });
}

main().catch((error) => {
  console.error("Failed to start ContextOS MCP server:", error);
  process.exit(1);
});
