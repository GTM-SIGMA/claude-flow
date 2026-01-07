import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import { createIPCServer, type IPCServer } from '../ipc/server';
import type { FlowchartConfig, FlowNode, ControllerMessage } from '../ipc/types';

interface FlowchartProps {
  id: string;
  initialConfig: FlowchartConfig;
  socketPath?: string;
}

// Tree drawing characters
const TREE = {
  vertical: '│',
  arrowDown: '↓',
  teeRight: '├',
  corner: '└',
};

// Graph structure types
interface GraphStructure {
  children: Map<string, string[]>;
  nodeMap: Map<string, FlowNode>;
  roots: string[];
}

// Build graph structure from edges
function buildGraphStructure(nodes: FlowNode[], edges: [string, string][]): GraphStructure {
  const children = new Map<string, string[]>();
  const parents = new Map<string, string[]>();
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // Initialize
  for (const node of nodes) {
    children.set(node.id, []);
    parents.set(node.id, []);
  }

  // Build adjacency
  for (const [from, to] of edges) {
    children.get(from)?.push(to);
    parents.get(to)?.push(from);
  }

  // Find roots (nodes with no parents)
  const roots = nodes.filter(n => parents.get(n.id)?.length === 0).map(n => n.id);

  return { children, nodeMap, roots };
}

export function Flowchart({ id, initialConfig, socketPath }: FlowchartProps) {
  const { exit } = useApp();
  const [config, setConfig] = useState<FlowchartConfig>(initialConfig);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [comments, setComments] = useState<Record<string, string>>(
    initialConfig.comments || {}
  );
  const [isCommenting, setIsCommenting] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [mode, setMode] = useState<'tree' | 'comments'>('tree');
  const [selectedCommentIndex, setSelectedCommentIndex] = useState(0);
  const ipcServerRef = useRef<IPCServer | null>(null);
  const commentsRef = useRef(comments);

  // Keep commentsRef in sync
  useEffect(() => {
    commentsRef.current = comments;
  }, [comments]);

  // Create IPC server for communication
  useEffect(() => {
    const actualSocketPath = socketPath || `/tmp/claude-flow-${id}.sock`;

    const server = createIPCServer(actualSocketPath);
    ipcServerRef.current = server;

    // Handle incoming messages from CLI
    server.onMessage((message: ControllerMessage) => {
      switch (message.type) {
        case 'update':
          setConfig(message.config);
          if (message.config.comments) {
            setComments(message.config.comments);
          }
          break;
        case 'close':
          exit();
          break;
        case 'getComments':
          server.send({ type: 'comments', data: commentsRef.current });
          break;
        case 'ping':
          server.send({ type: 'pong' });
          break;
      }
    });

    return () => {
      server.close();
    };
  }, [id, socketPath, exit]);

  // Build graph structure
  const graph = buildGraphStructure(config.nodes, config.edges);

  // Selectable item type - commentKey allows unique comments for references
  interface SelectableItem {
    nodeId: string;
    label: string;
    commentKey: string;  // nodeId for first occurrence, nodeId:ref:N for references
    isReference?: boolean;
  }

  // Build the tree view - always fully expanded, with DAG references
  const buildTreeView = useCallback(() => {
    const lines: { text: string; nodeId?: string; commentKey?: string; isReference?: boolean }[] = [];
    const selectables: SelectableItem[] = [];
    const visited = new Set<string>();

    const renderNode = (nodeId: string, indent: string, isLast: boolean, isRoot: boolean = false, path: string[] = []) => {
      const node = graph.nodeMap.get(nodeId);
      if (!node) return;

      const prefix = isRoot ? '' : (isLast ? `${TREE.corner}─ ` : `${TREE.teeRight}─ `);
      const nextIndent = isRoot ? indent : indent + (isLast ? '    ' : `${TREE.vertical}   `);
      const currentPath = [...path, node.label];

      // DAG handling: if already visited, show as reference
      if (visited.has(nodeId)) {
        // Use full path as commentKey for references (makes it unique and descriptive)
        const commentKey = currentPath.join(' → ');

        lines.push({
          text: `${indent}${prefix}→ ${node.label}`,
          nodeId,
          commentKey,
          isReference: true
        });
        // References are also selectable with unique comment keys
        selectables.push({ nodeId, label: `→ ${node.label}`, commentKey, isReference: true });
        return;
      }
      visited.add(nodeId);

      // Add to selectables for navigation (first occurrence uses nodeId as commentKey)
      const commentKey = nodeId;
      selectables.push({ nodeId, label: node.label, commentKey });

      const children = graph.children.get(nodeId) || [];

      if (children.length === 0) {
        // Terminal node
        lines.push({ text: `${indent}${prefix}${node.label}`, nodeId, commentKey });
      } else if (children.length === 1) {
        // Linear flow - show node, arrow, then child (single child is always "last")
        lines.push({ text: `${indent}${prefix}${node.label}`, nodeId, commentKey });
        lines.push({ text: `${nextIndent}${TREE.arrowDown}` });
        renderNode(children[0], nextIndent, true, false, currentPath);
      } else {
        // Branch point - show node, then children indented
        lines.push({ text: `${indent}${prefix}${node.label}`, nodeId, commentKey });
        children.forEach((childId, i) => {
          renderNode(childId, nextIndent, i === children.length - 1, false, currentPath);
        });
      }
    };

    // Start from roots
    for (const rootId of graph.roots) {
      renderNode(rootId, '', true, true, []);
    }

    return { lines, selectables };
  }, [graph]);

  const { lines: treeLines, selectables } = buildTreeView();

  // Get commented nodes as array for navigation
  const commentedNodes = Object.entries(comments).filter(([_, text]) => text);

  // Get the commentKey that should be highlighted (from comments selection)
  const highlightedCommentKey = mode === 'comments' && commentedNodes[selectedCommentIndex]
    ? commentedNodes[selectedCommentIndex][0]
    : null;

  // Handle keyboard input
  useInput((input, key) => {
    if (isCommenting) {
      if (key.escape) {
        setIsCommenting(false);
        setCommentText('');
      }
      return;
    }

    // Tab switches between tree and comments
    if (key.tab) {
      setMode(m => m === 'tree' ? 'comments' : 'tree');
      setSelectedCommentIndex(0);
      return;
    }

    if (mode === 'tree') {
      if (key.upArrow || input === 'k') {
        setSelectedIndex((i) => Math.max(0, i - 1));
      } else if (key.downArrow || input === 'j') {
        setSelectedIndex((i) => Math.min(selectables.length - 1, i + 1));
      } else if (key.return) {
        // Enter to comment on selected
        const selected = selectables[selectedIndex];
        if (selected) {
          setCommentText(comments[selected.commentKey] || '');
          setIsCommenting(true);
        }
      } else if (input === 'q' || key.escape) {
        ipcServerRef.current?.send({ type: 'cancelled' });
        exit();
      }
    } else if (mode === 'comments') {
      if (key.upArrow || input === 'k') {
        setSelectedCommentIndex((i) => Math.max(0, i - 1));
      } else if (key.downArrow || input === 'j') {
        setSelectedCommentIndex((i) => Math.min(commentedNodes.length - 1, i + 1));
      } else if (key.return) {
        // Enter to edit selected comment
        const [commentKey, text] = commentedNodes[selectedCommentIndex] || [];
        if (commentKey) {
          setCommentText(text || '');
          setIsCommenting(true);
        }
      } else if (input === 'q' || key.escape) {
        setMode('tree');
      }
    }
  });

  // Handle comment submission
  const handleCommentSubmit = useCallback(
    (text: string) => {
      // Determine which commentKey we're commenting on based on mode
      let commentKey: string | undefined;
      if (mode === 'tree') {
        commentKey = selectables[selectedIndex]?.commentKey;
      } else {
        commentKey = commentedNodes[selectedCommentIndex]?.[0];
      }

      if (commentKey) {
        const newComments = { ...comments, [commentKey]: text };
        setComments(newComments);
        setIsCommenting(false);
        setCommentText('');

        ipcServerRef.current?.send({
          type: 'comment',
          nodeId: commentKey,  // Using commentKey as the identifier
          text,
        });
      }
    },
    [selectables, selectedIndex, comments, mode, commentedNodes, selectedCommentIndex]
  );

  const selectedItem = selectables[selectedIndex];

  // Check if commentKey is a path (reference) or a nodeId (first occurrence)
  const isPathCommentKey = (commentKey: string): boolean => {
    return commentKey.includes(' → ');
  };

  // Get label for a commentKey - shows full path for references
  const getLabelForCommentKey = (commentKey: string): string => {
    if (isPathCommentKey(commentKey)) {
      // It's a full path like "Webhook → Switch → Email opened → Disqualified"
      return commentKey;
    }
    // It's a nodeId - look up the label
    return graph.nodeMap.get(commentKey)?.label || commentKey;
  };

  // Get the label for the node being edited
  const getEditingLabel = () => {
    if (mode === 'tree') {
      return selectedItem?.label;
    } else {
      const commentKey = commentedNodes[selectedCommentIndex]?.[0];
      return commentKey ? getLabelForCommentKey(commentKey) : undefined;
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      {/* Tab bar */}
      <Box>
        <Text color={mode === 'tree' ? 'cyan' : 'gray'} bold={mode === 'tree'}>
          {mode === 'tree' ? '▸ ' : '  '}Flow
        </Text>
        <Text color="gray">  </Text>
        <Text color={mode === 'comments' ? 'magenta' : 'gray'} bold={mode === 'comments'}>
          {mode === 'comments' ? '▸ ' : '  '}Comments{commentedNodes.length > 0 ? ` (${commentedNodes.length})` : ''}
        </Text>
      </Box>
      <Text> </Text>

      {/* Flow view */}
      {mode === 'tree' && (
        <>
          {treeLines.map((line, i) => {
            const isTreeSelected = line.commentKey && line.commentKey === selectedItem?.commentKey;
            const hasComment = line.commentKey && comments[line.commentKey];
            const color = isTreeSelected ? 'green' : 'white';
            return (
              <Text key={i}>
                <Text color={color} bold={isTreeSelected} dimColor={line.isReference}>
                  {line.text}
                </Text>
                {hasComment && <Text color="magenta"> *</Text>}
              </Text>
            );
          })}
        </>
      )}

      {/* Comments view */}
      {mode === 'comments' && !isCommenting && (
        <>
          {commentedNodes.length === 0 ? (
            <Text dimColor>No comments yet. Press Tab to go back to Flow and add some.</Text>
          ) : (
            commentedNodes.map(([commentKey, text], i) => {
              const label = getLabelForCommentKey(commentKey);
              const isCommentSelected = i === selectedCommentIndex;
              return (
                <Box key={commentKey} flexDirection="column" marginBottom={1}>
                  <Text color={isCommentSelected ? 'magenta' : 'gray'} bold={isCommentSelected}>
                    {isCommentSelected ? '▸ ' : '  '}{label}
                  </Text>
                  <Text color={isCommentSelected ? 'white' : 'gray'}>
                    {'    '}{text}
                  </Text>
                </Box>
              );
            })
          )}
        </>
      )}

      {/* Comment input */}
      {isCommenting && (
        <Box marginTop={1} flexDirection="column">
          <Text color="green">Comment on {getEditingLabel()}:</Text>
          <Box>
            <Text color="green">&gt; </Text>
            <TextInput
              value={commentText}
              onChange={setCommentText}
              onSubmit={handleCommentSubmit}
            />
          </Box>
          <Text dimColor>(Enter to save, Esc to cancel)</Text>
        </Box>
      )}

      {/* Help */}
      <Box marginTop={1}>
        <Text dimColor>
          {mode === 'tree'
            ? '↑/↓ navigate | Enter comment | Tab switch | q quit'
            : '↑/↓ navigate | Enter edit | Tab switch | q quit'}
        </Text>
      </Box>
    </Box>
  );
}
