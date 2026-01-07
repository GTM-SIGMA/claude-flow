# Flowchart Canvas Skill

Use this skill when helping users design systems, workflows, or processes that benefit from visual representation.

## When to Use

- System architecture discussions
- Workflow planning (n8n, automation)
- Process design
- Data flow visualization
- Decision tree mapping

## How It Works

1. Claude spawns a flowchart canvas in a tmux split pane
2. User sees the diagram and can navigate between nodes
3. User presses `c` to add comments on specific nodes
4. Claude receives comments via IPC and can update the diagram
5. Iterate until the design is complete

## Configuration Schema

```typescript
interface FlowchartConfig {
  title?: string;                    // Optional title
  nodes: Array<{
    id: string;                      // Unique identifier
    label: string;                   // Display text (max ~16 chars)
  }>;
  edges: Array<[string, string]>;    // [fromId, toId] pairs
  comments?: Record<string, string>; // nodeId -> comment text
}
```

## Example Usage

### Simple Linear Flow

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

### With Existing Comments

```json
{
  "title": "Auth Flow",
  "nodes": [
    { "id": "login", "label": "Login" },
    { "id": "validate", "label": "Validate" },
    { "id": "token", "label": "Issue Token" }
  ],
  "edges": [["login", "validate"], ["validate", "token"]],
  "comments": {
    "validate": "Need rate limiting here"
  }
}
```

## Spawning a Canvas

```bash
# Via CLI
bun run src/cli.ts spawn flowchart \
  --id my-flow \
  --config '{"nodes":[...],"edges":[...]}'

# Via skill invocation (Claude will do this)
/flow show <config>
```

## User Interactions

| Key | Action |
|-----|--------|
| ↑ / ↓ | Navigate between nodes |
| Enter | Add/edit comment on selected node |
| Tab | Switch between Flow and Comments views |
| Esc | Cancel comment input |
| q | Quit canvas |

## IPC Messages

### Claude → Canvas

- `update` - Send new configuration to update the diagram
- `close` - Close the canvas
- `getComments` - Request all comments
- `ping` - Check connectivity

### Canvas → Claude

- `ready` - Canvas is initialized
- `comment` - User added a comment (includes nodeId and text)
- `comments` - Response to getComments request
- `cancelled` - User closed the canvas
- `pong` - Response to ping

## Best Practices

1. **Keep labels short** - Max ~16 characters for clean rendering
2. **Linear flows first** - Start simple, add complexity via comments
3. **Iterate** - Use comments to capture feedback, then update the diagram
4. **Title your diagrams** - Helps user understand context

## Example Conversation

**User:** Let's design the data sync workflow

**Claude:** I'll create a flowchart to visualize this. *spawns canvas*

```
▸ Flow    Comments

Trigger
↓
└─ Fetch
   ↓
   └─ Compare
```

Navigate with ↑/↓, press Enter to comment on any node.

**User:** *selects "Compare" node, presses Enter, types "Need to handle deleted records"*

**Claude:** Good point. I see your comment on Compare about handling deleted records. Should I add a "Handle Deletes" step after Compare, or should that be part of the Compare logic?
