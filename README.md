# Claude Flow

An interactive flowchart canvas for Claude Code. Design systems and workflows visually, with real-time commenting and iteration.

![Demo](media/demo.gif)

## What It Does

- Spawns flowchart diagrams in a tmux split pane
- Navigate nodes with arrow keys
- Add comments on specific nodes (press `c`)
- Claude receives comments and can update the diagram
- Iterate until your design is complete

## Installation

### Prerequisites

1. **Bun** - Install with `brew install bun`
2. **tmux** - Install with `brew install tmux`
3. Run Claude Code inside a tmux session

### Install the Plugin

```bash
# Add the marketplace
/plugin marketplace add gtm-sigma/claude-flow

# Install the plugin
/plugin install flow@claude-flow
```

### Verify Installation

```bash
# Inside tmux, ask Claude to create a flowchart
"Create a flowchart for a simple data pipeline: webhook → transform → database"
```

## Usage

### Ask Claude to visualize

```
"Let's design the authentication flow"
"Show me a flowchart of the data sync process"
"Visualize the n8n workflow we discussed"
```

### Interact with the canvas

| Key | Action |
|-----|--------|
| ← / → | Navigate between nodes |
| c | Add/edit comment on selected node |
| Enter | Save comment |
| Esc | Cancel or close |
| q | Quit canvas |

### Iterate

Add comments on nodes, and Claude will see them. Ask Claude to update the diagram based on your feedback.

## Example

```
┌───────────┐    ┌───────────┐    ┌───────────┐
│  Webhook  │───▶│ Transform │───▶│  Output   │
└───────────┘    └───────────┘    └───────────┘
                      [*]
┌─ Comment ─────────────────────────────────────┐
│ Need error handling for invalid payloads      │
└───────────────────────────────────────────────┘

←/→ navigate | c comment | q quit
```

## Configuration

Flowcharts are defined with a simple JSON structure:

```json
{
  "title": "My Workflow",
  "nodes": [
    { "id": "1", "label": "Step 1" },
    { "id": "2", "label": "Step 2" },
    { "id": "3", "label": "Step 3" }
  ],
  "edges": [["1", "2"], ["2", "3"]],
  "comments": {
    "2": "Existing comment on Step 2"
  }
}
```

## Development

```bash
# Clone the repo
git clone https://github.com/gtm-sigma/claude-flow.git
cd claude-flow/flow

# Install dependencies
bun install

# Run locally
bun run src/cli.ts show flowchart --config '{"nodes":[{"id":"1","label":"Test"}],"edges":[]}'
```

## Requirements

- macOS or Linux
- tmux (for canvas spawning)
- Bun runtime
- Claude Code

## License

MIT
