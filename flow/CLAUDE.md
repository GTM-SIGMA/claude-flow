# Claude Flow Plugin

This plugin provides an interactive flowchart canvas for system design and workflow planning.

## Quick Reference

### Spawning a Flowchart

```bash
bun run src/cli.ts spawn flowchart --id my-flow --config '{"nodes":[...],"edges":[...]}'
```

### Configuration Format

```typescript
{
  title?: string;
  nodes: Array<{ id: string; label: string }>;
  edges: Array<[string, string]>;  // [fromId, toId] - supports DAGs (branches that rejoin)
  comments?: Record<string, string>;  // commentKey -> text
}
```

### Comment Keys

- For first occurrence of a node: the node's `id` (e.g., `"3"`)
- For reference nodes (DAG rejoins): full path (e.g., `"Webhook → Switch → Email opened → Disqualified"`)

### Example

```json
{
  "title": "Data Pipeline",
  "nodes": [
    { "id": "1", "label": "Webhook" },
    { "id": "2", "label": "Transform" },
    { "id": "3", "label": "Database" }
  ],
  "edges": [["1", "2"], ["2", "3"]]
}
```

## Runtime

Use Bun for all operations:
- `bun run` instead of `node`
- `bun install` instead of `npm install`
- `bunx` instead of `npx`

## IPC Communication

The canvas communicates via Unix sockets at `/tmp/claude-flow-{id}.sock`.

### Querying Comments

```bash
echo '{"type":"getComments"}' | nc -U /tmp/claude-flow-{id}.sock
```

### Messages to Canvas

- `{ type: "update", config: {...} }` - Update the diagram
- `{ type: "close" }` - Close the canvas
- `{ type: "getComments" }` - Request all comments
- `{ type: "ping" }` - Check connectivity

### Messages from Canvas

- `{ type: "ready" }` - Canvas initialized
- `{ type: "comment", nodeId: "...", text: "..." }` - User added comment (nodeId is the commentKey)
- `{ type: "comments", data: {...} }` - Response to getComments (commentKey -> text)
- `{ type: "cancelled" }` - User closed canvas
- `{ type: "pong" }` - Response to ping
