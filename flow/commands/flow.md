# /flow Command

Spawn an interactive flowchart canvas for system design and workflow planning.

## Usage

```
/flow show <config>
```

## Description

The `/flow` command creates an interactive flowchart visualization in a tmux split pane. Use it when designing systems, workflows, or processes that benefit from visual representation.

## Workflow

1. **Identify the need** - User wants to visualize a system or process
2. **Collect details** - Gather the nodes and connections needed
3. **Spawn canvas** - Execute `/flow show` with configuration
4. **Iterate** - User navigates and comments, Claude updates

## Examples

### Simple workflow

```
/flow show {"nodes":[{"id":"1","label":"Start"},{"id":"2","label":"Process"},{"id":"3","label":"End"}],"edges":[["1","2"],["2","3"]]}
```

### With title

```
/flow show {"title":"Auth Flow","nodes":[{"id":"a","label":"Login"},{"id":"b","label":"Validate"},{"id":"c","label":"Token"}],"edges":[["a","b"],["b","c"]]}
```

## User Controls

- **←/→** - Navigate between nodes
- **c** - Comment on selected node
- **Enter** - Save comment
- **Esc** - Cancel/close
- **q** - Quit

## Tips

- Keep node labels under 16 characters
- Start with linear flows, add complexity via discussion
- Comments are synced back to Claude for iteration
