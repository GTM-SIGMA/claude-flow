# Claude Flow

An interactive flowchart canvas for Claude Code. Design systems and workflows visually, with real-time commenting and collaboration.

![Demo](media/demo.gif)

## What It Does

- Spawns flowchart diagrams in a split pane (iTerm2 or tmux)
- Tree view with full DAG support (branches that rejoin show as references)
- Navigate nodes with arrow keys
- Add comments on any node - including reference nodes for context-specific feedback
- Tab between Flow and Comments views
- Claude receives comments with full path context and can update the diagram
- Iterate until your design is complete

## Installation

### Prerequisites

1. **Bun** - Install with `brew install bun`
2. **iTerm2** (recommended) or **tmux** - The canvas spawns in a split pane

### Install the Plugin

```bash
# Add the marketplace
/plugin marketplace add gtm-sigma/claude-flow

# Install the plugin
/plugin install flow@claude-flow

# Install dependencies (required once after install)
cd ~/.claude/plugins/cache/claude-flow/flow/*/
bun install
```

### Verify Installation

```bash
# Ask Claude to create a flowchart
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
| ↑ / ↓ | Navigate between nodes |
| Enter | Add/edit comment on selected node |
| Tab | Switch between Flow and Comments views |
| Esc | Cancel comment input |
| q | Quit canvas |

### Iterate

Add comments on nodes, and Claude will see them with full path context (e.g., `Webhook → Switch → Email opened → Disqualified`). Ask Claude to update the diagram based on your feedback.

## Example

```
▸ Flow    Comments (2)

New Lead Automation

Webhook
↓
└─ Switch
   ├─ New lead
   │   ↓
   │   └─ Lead info
   │       ├─ Create record *
   │       └─ Disqualified
   ├─ Email opened
   │   ├─ → Create record
   │   └─ → Disqualified *
   └─ Meeting booked
       ↓
       └─ Lookup company

↑/↓ navigate | Enter comment | Tab switch | q quit
```

Nodes marked with `*` have comments. References (→) can have their own comments based on their location in the flow.

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

- macOS (iTerm2 recommended) or Linux (tmux)
- Bun runtime
- Claude Code

## License

MIT
