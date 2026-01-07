# Claude Flow Plugin

This plugin provides an interactive flowchart canvas for system design and workflow planning.

## Quick Reference

### Spawning a Flowchart

Use the `/flow` command or spawn directly:

```bash
bun run src/cli.ts spawn flowchart --id my-flow --config '{"nodes":[...],"edges":[...]}'
```

### Configuration Format

```typescript
{
  title?: string;
  nodes: Array<{ id: string; label: string }>;
  edges: Array<[string, string]>;  // [fromId, toId]
  comments?: Record<string, string>;
}
```

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

### Messages to Canvas

- `{ type: "update", config: {...} }` - Update the diagram
- `{ type: "close" }` - Close the canvas
- `{ type: "getComments" }` - Request all comments

### Messages from Canvas

- `{ type: "ready" }` - Canvas initialized
- `{ type: "comment", nodeId: "...", text: "..." }` - User added comment
- `{ type: "comments", data: {...} }` - All comments
- `{ type: "cancelled" }` - User closed canvas
