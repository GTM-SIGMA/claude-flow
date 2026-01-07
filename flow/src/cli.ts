#!/usr/bin/env bun
import { program } from 'commander';
import { render } from 'ink';
import React from 'react';
import { readFileSync, existsSync } from 'fs';
import { spawnCanvas, closeCanvas } from './terminal';
import { createIPCServer } from './ipc/server';
import { Flowchart } from './canvases/flowchart';
import type { FlowchartConfig } from './ipc/types';

program
  .name('claude-flow')
  .description('Interactive flowchart canvas for Claude Code')
  .version('0.1.0');

// Show command - renders flowchart in current terminal
program
  .command('show [kind]')
  .description('Show flowchart canvas in current terminal')
  .option('--id <id>', 'Canvas identifier')
  .option('--config <json>', 'Configuration as JSON string')
  .option('--config-file <path>', 'Path to configuration JSON file')
  .option('--socket <path>', 'Unix socket path for IPC')
  .action(async (kind = 'flowchart', options) => {
    let config: FlowchartConfig = { nodes: [], edges: [] };

    // Load config from file or string
    if (options.configFile && existsSync(options.configFile)) {
      const content = readFileSync(options.configFile, 'utf-8');
      config = JSON.parse(content);
    } else if (options.config) {
      config = JSON.parse(options.config);
    }

    // Render the flowchart
    const { waitUntilExit } = render(
      React.createElement(Flowchart, {
        id: options.id || 'default',
        initialConfig: config,
        socketPath: options.socket,
      })
    );

    await waitUntilExit();
  });

// Spawn command - launches canvas in tmux split
program
  .command('spawn [kind]')
  .description('Spawn flowchart canvas in tmux split pane')
  .option('--id <id>', 'Canvas identifier', `flow-${Date.now()}`)
  .option('--config <json>', 'Configuration as JSON string')
  .option('--socket <path>', 'Unix socket path for IPC')
  .action(async (kind = 'flowchart', options) => {
    let config: FlowchartConfig | undefined;

    if (options.config) {
      config = JSON.parse(options.config);
    }

    const paneId = await spawnCanvas(kind, {
      id: options.id,
      config,
      socket: options.socket,
    });

    console.log(`Spawned ${kind} canvas '${options.id}' in pane ${paneId}`);
  });

// Update command - send config update via IPC
program
  .command('update <id>')
  .description('Update canvas configuration via IPC')
  .option('--config <json>', 'New configuration as JSON string')
  .option('--socket <path>', 'Unix socket path')
  .action(async (id, options) => {
    const socketPath = options.socket || `/tmp/claude-flow-${id}.sock`;

    if (!existsSync(socketPath)) {
      console.error(`Socket not found: ${socketPath}`);
      process.exit(1);
    }

    const socket = await Bun.connect({
      unix: socketPath,
      socket: {
        data() {},
        error(_, error) {
          console.error('Connection error:', error);
        },
        close() {},
      },
    });

    const message = {
      type: 'update',
      config: options.config ? JSON.parse(options.config) : {},
    };

    socket.write(JSON.stringify(message) + '\n');
    socket.end();

    console.log(`Sent update to canvas '${id}'`);
  });

// Close command - close canvas pane
program
  .command('close')
  .description('Close the canvas pane')
  .action(async () => {
    await closeCanvas();
    console.log('Canvas closed');
  });

// Comments command - get comments from canvas
program
  .command('comments <id>')
  .description('Get comments from canvas')
  .option('--socket <path>', 'Unix socket path')
  .action(async (id, options) => {
    const socketPath = options.socket || `/tmp/claude-flow-${id}.sock`;

    if (!existsSync(socketPath)) {
      console.error(`Socket not found: ${socketPath}`);
      process.exit(1);
    }

    const socket = await Bun.connect({
      unix: socketPath,
      socket: {
        data(_, data) {
          const message = JSON.parse(data.toString().trim());
          if (message.type === 'comments') {
            console.log(JSON.stringify(message.data, null, 2));
          }
          socket.end();
        },
        error(_, error) {
          console.error('Connection error:', error);
        },
        close() {},
      },
    });

    socket.write(JSON.stringify({ type: 'getComments' }) + '\n');
  });

program.parse();
