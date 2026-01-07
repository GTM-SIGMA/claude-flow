import { $ } from 'bun';
import { existsSync, writeFileSync, readFileSync, unlinkSync } from 'fs';

const PANE_ID_FILE = '/tmp/claude-flow-pane-id';

export function detectTerminal(): 'tmux' | 'none' {
  if (process.env.TMUX) {
    return 'tmux';
  }
  return 'none';
}

async function getCanvasPaneId(): Promise<string | null> {
  if (!existsSync(PANE_ID_FILE)) {
    return null;
  }

  const paneId = readFileSync(PANE_ID_FILE, 'utf-8').trim();

  // Verify pane still exists
  try {
    await $`tmux display-message -t ${paneId} -p "#{pane_id}"`.quiet();
    return paneId;
  } catch {
    // Pane doesn't exist anymore
    unlinkSync(PANE_ID_FILE);
    return null;
  }
}

async function reuseExistingPane(paneId: string, command: string): Promise<void> {
  // Send Ctrl+C to stop any running process
  await $`tmux send-keys -t ${paneId} C-c`.quiet();
  await Bun.sleep(150);

  // Run the new command
  await $`tmux send-keys -t ${paneId} ${command} Enter`.quiet();
}

async function createNewPane(command: string): Promise<string> {
  // Split window horizontally, new pane on right (40% width)
  const result = await $`tmux split-window -h -l 40% -P -F "#{pane_id}" ${command}`.text();
  const paneId = result.trim();

  // Save pane ID for reuse
  writeFileSync(PANE_ID_FILE, paneId);

  return paneId;
}

export interface SpawnOptions {
  id: string;
  config?: object;
  socket?: string;
}

export async function spawnCanvas(kind: string, options: SpawnOptions): Promise<string> {
  const terminal = detectTerminal();

  if (terminal !== 'tmux') {
    throw new Error('Canvas requires tmux. Please run inside a tmux session.');
  }

  // Build command
  const scriptDir = import.meta.dir;
  const runScript = `${scriptDir}/../run-flow.sh`;

  let command = `${runScript} show ${kind} --id ${options.id}`;

  if (options.socket) {
    command += ` --socket ${options.socket}`;
  }

  if (options.config) {
    // Write config to temp file to avoid shell escaping issues
    const configFile = `/tmp/claude-flow-config-${options.id}.json`;
    writeFileSync(configFile, JSON.stringify(options.config));
    command += ` --config-file ${configFile}`;
  }

  // Check for existing pane
  const existingPaneId = await getCanvasPaneId();

  if (existingPaneId) {
    await reuseExistingPane(existingPaneId, command);
    return existingPaneId;
  } else {
    return await createNewPane(command);
  }
}

export async function closeCanvas(): Promise<void> {
  const paneId = await getCanvasPaneId();
  if (paneId) {
    try {
      await $`tmux kill-pane -t ${paneId}`.quiet();
    } catch {
      // Pane might already be closed
    }
    if (existsSync(PANE_ID_FILE)) {
      unlinkSync(PANE_ID_FILE);
    }
  }
}
