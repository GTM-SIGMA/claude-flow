import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import { connectToIPC } from '../ipc/client';
import type { FlowchartConfig, FlowNode, ControllerMessage } from '../ipc/types';

interface FlowchartProps {
  id: string;
  initialConfig: FlowchartConfig;
  socketPath?: string;
}

// Box drawing characters
const BOX = {
  topLeft: '┌',
  topRight: '┐',
  bottomLeft: '└',
  bottomRight: '┘',
  horizontal: '─',
  vertical: '│',
  arrow: '▶',
};

// Render a single node as ASCII box
function renderNode(node: FlowNode, isSelected: boolean, width: number): string[] {
  const label = node.label.slice(0, width - 4).padEnd(width - 4);
  const border = BOX.horizontal.repeat(width - 2);

  const lines = [
    `${BOX.topLeft}${border}${BOX.topRight}`,
    `${BOX.vertical} ${label} ${BOX.vertical}`,
    `${BOX.bottomLeft}${border}${BOX.bottomRight}`,
  ];

  if (isSelected) {
    lines.push('    [*]');
  }

  return lines;
}

// Calculate node width based on longest label
function calculateNodeWidth(nodes: FlowNode[]): number {
  const maxLabel = Math.max(...nodes.map((n) => n.label.length), 6);
  return Math.min(maxLabel + 4, 20); // Min 10, max 20 chars
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
  const [ipcClient, setIpcClient] = useState<Awaited<
    ReturnType<typeof connectToIPC>
  > | null>(null);

  // Connect to IPC if socket provided
  useEffect(() => {
    if (!socketPath) return;

    connectToIPC(socketPath).then((client) => {
      setIpcClient(client);

      // Send ready message
      client.send({ type: 'ready' });

      // Handle incoming messages
      client.onMessage((message: ControllerMessage) => {
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
            client.send({ type: 'comments', data: comments });
            break;
          case 'ping':
            client.send({ type: 'pong' });
            break;
        }
      });
    });

    return () => {
      ipcClient?.close();
    };
  }, [socketPath]);

  // Handle keyboard input
  useInput((input, key) => {
    if (isCommenting) {
      if (key.escape) {
        setIsCommenting(false);
        setCommentText('');
      }
      return;
    }

    if (key.leftArrow || input === 'h') {
      setSelectedIndex((i) => Math.max(0, i - 1));
    } else if (key.rightArrow || input === 'l') {
      setSelectedIndex((i) => Math.min(config.nodes.length - 1, i + 1));
    } else if (input === 'c') {
      // Start commenting on selected node
      const selectedNode = config.nodes[selectedIndex];
      if (selectedNode) {
        setCommentText(comments[selectedNode.id] || '');
        setIsCommenting(true);
      }
    } else if (input === 'q' || key.escape) {
      ipcClient?.send({ type: 'cancelled' });
      exit();
    }
  });

  // Handle comment submission
  const handleCommentSubmit = useCallback(
    (text: string) => {
      const selectedNode = config.nodes[selectedIndex];
      if (selectedNode) {
        const newComments = { ...comments, [selectedNode.id]: text };
        setComments(newComments);
        setIsCommenting(false);
        setCommentText('');

        // Notify via IPC
        ipcClient?.send({
          type: 'comment',
          nodeId: selectedNode.id,
          text,
        });
      }
    },
    [config.nodes, selectedIndex, comments, ipcClient]
  );

  const nodeWidth = calculateNodeWidth(config.nodes);
  const selectedNode = config.nodes[selectedIndex];

  return (
    <Box flexDirection="column" padding={1}>
      {/* Title */}
      {config.title && (
        <Box marginBottom={1}>
          <Text bold color="cyan">
            {config.title}
          </Text>
        </Box>
      )}

      {/* Flowchart */}
      <Box flexDirection="row" alignItems="flex-start">
        {config.nodes.map((node, index) => {
          const isSelected = index === selectedIndex;
          const hasComment = !!comments[node.id];
          const nodeLines = renderNode(node, isSelected, nodeWidth);
          const showArrow = index < config.nodes.length - 1;

          return (
            <Box key={node.id} flexDirection="row" alignItems="center">
              <Box flexDirection="column">
                {nodeLines.map((line, lineIdx) => (
                  <Text
                    key={lineIdx}
                    color={isSelected ? 'green' : hasComment ? 'yellow' : 'white'}
                  >
                    {line}
                  </Text>
                ))}
              </Box>
              {showArrow && (
                <Box marginX={1}>
                  <Text color="gray">──{BOX.arrow}</Text>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {/* Comment display */}
      {selectedNode && comments[selectedNode.id] && !isCommenting && (
        <Box marginTop={1} borderStyle="single" borderColor="yellow" paddingX={1}>
          <Text color="yellow">
            {selectedNode.label}: {comments[selectedNode.id]}
          </Text>
        </Box>
      )}

      {/* Comment input */}
      {isCommenting && selectedNode && (
        <Box marginTop={1} flexDirection="column">
          <Text color="green">Comment on {selectedNode.label}:</Text>
          <Box>
            <Text color="green">{BOX.arrow} </Text>
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
          ←/→ navigate | c comment | q quit
        </Text>
      </Box>
    </Box>
  );
}
