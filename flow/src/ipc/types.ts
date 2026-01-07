// Messages from Claude -> Canvas
export type ControllerMessage =
  | { type: 'update'; config: FlowchartConfig }
  | { type: 'close' }
  | { type: 'getComments' }
  | { type: 'ping' };

// Messages from Canvas -> Claude
export type CanvasMessage =
  | { type: 'ready'; scenario?: string }
  | { type: 'comment'; nodeId: string; text: string }
  | { type: 'comments'; data: Record<string, string> }
  | { type: 'cancelled'; reason?: string }
  | { type: 'pong' }
  | { type: 'error'; message: string };

export interface FlowchartConfig {
  nodes: FlowNode[];
  edges: FlowEdge[];
  comments?: Record<string, string>;
  title?: string;
}

export interface FlowNode {
  id: string;
  label: string;
  type?: 'start' | 'process' | 'decision' | 'end';
}

export type FlowEdge = [string, string]; // [fromId, toId]
