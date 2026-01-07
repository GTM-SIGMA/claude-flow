import { $ } from 'bun';
import { existsSync, writeFileSync, readFileSync, unlinkSync } from 'fs';

const PANE_ID_FILE = '/tmp/claude-flow-pane-id';
const TERMINAL_TYPE_FILE = '/tmp/claude-flow-terminal-type';

export function detectTerminal(): 'iterm2' | 'tmux' | 'none' {
  // Check for iTerm2 first
  if (process.env.TERM_PROGRAM === 'iTerm.app' || process.env.LC_TERMINAL === 'iTerm2') {
    return 'iterm2';
  }
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
  writeFileSync(TERMINAL_TYPE_FILE, 'tmux');

  return paneId;
}

// iTerm2-specific functions
async function createIterm2Pane(command: string): Promise<string> {
  const sessionId = `claude-flow-${Date.now()}`;

  // AppleScript to create a vertical split, then write command to it
  // This ensures proper TTY setup
  const script = `
    tell application "iTerm2"
      tell current session of current window
        set newSession to (split vertically with default profile)
        tell newSession
          write text "${command.replace(/"/g, '\\"')}"
        end tell
      end tell
      -- Focus back to original session
      tell current window
        tell current tab
          select (session 1)
        end tell
      end tell
    end tell
  `;

  await $`osascript -e ${script}`.quiet();

  // Save session ID for reuse
  writeFileSync(PANE_ID_FILE, sessionId);
  writeFileSync(TERMINAL_TYPE_FILE, 'iterm2');

  return sessionId;
}

async function focusIterm2MainPane(): Promise<void> {
  const script = `
    tell application "iTerm2"
      tell current window
        select first session of current tab whose name does not start with "claude-flow"
      end tell
    end tell
  `;
  try {
    await $`osascript -e ${script}`.quiet();
  } catch {
    // Fallback: just activate iTerm2
  }
}

async function reuseIterm2Pane(sessionId: string, command: string): Promise<void> {
  const script = `
    tell application "iTerm2"
      tell current window
        repeat with s in sessions of current tab
          if name of s starts with "claude-flow" then
            tell s
              write text "exit"
            end tell
          end if
        end repeat
      end tell
    end tell
  `;

  try {
    await $`osascript -e ${script}`.quiet();
    await Bun.sleep(200);
  } catch {
    // Session might not exist
  }

  // Create new pane
  await createIterm2Pane(command);
}

async function closeIterm2Pane(): Promise<void> {
  const script = `
    tell application "iTerm2"
      tell current window
        repeat with s in sessions of current tab
          if name of s starts with "claude-flow" then
            tell s
              close
            end tell
          end if
        end repeat
      end tell
    end tell
  `;

  try {
    await $`osascript -e ${script}`.quiet();
  } catch {
    // Session might already be closed
  }
}

export interface SpawnOptions {
  id: string;
  config?: object;
  socket?: string;
}

export async function spawnCanvas(kind: string, options: SpawnOptions): Promise<string> {
  const terminal = detectTerminal();

  if (terminal === 'none') {
    throw new Error('Canvas requires iTerm2 or tmux. Please run inside iTerm2 or a tmux session.');
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

  if (terminal === 'iterm2') {
    // Use iTerm2 native splits
    const existingPaneId = await getCanvasPaneId();
    const savedTerminal = existsSync(TERMINAL_TYPE_FILE)
      ? readFileSync(TERMINAL_TYPE_FILE, 'utf-8').trim()
      : null;

    if (existingPaneId && savedTerminal === 'iterm2') {
      await reuseIterm2Pane(existingPaneId, command);
      return existingPaneId;
    } else {
      return await createIterm2Pane(command);
    }
  } else {
    // Use tmux
    const existingPaneId = await getCanvasPaneId();

    if (existingPaneId) {
      await reuseExistingPane(existingPaneId, command);
      return existingPaneId;
    } else {
      return await createNewPane(command);
    }
  }
}

export async function closeCanvas(): Promise<void> {
  const savedTerminal = existsSync(TERMINAL_TYPE_FILE)
    ? readFileSync(TERMINAL_TYPE_FILE, 'utf-8').trim()
    : null;

  if (savedTerminal === 'iterm2') {
    await closeIterm2Pane();
  } else {
    const paneId = await getCanvasPaneId();
    if (paneId) {
      try {
        await $`tmux kill-pane -t ${paneId}`.quiet();
      } catch {
        // Pane might already be closed
      }
    }
  }

  // Clean up state files
  if (existsSync(PANE_ID_FILE)) {
    unlinkSync(PANE_ID_FILE);
  }
  if (existsSync(TERMINAL_TYPE_FILE)) {
    unlinkSync(TERMINAL_TYPE_FILE);
  }
}
