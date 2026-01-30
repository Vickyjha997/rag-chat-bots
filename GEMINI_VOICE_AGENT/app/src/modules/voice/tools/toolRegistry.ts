import type { FunctionResult } from '../../../common/types.js';
import { logError } from '../../../common/errorLog.js';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      required?: boolean;
    }>;
    required?: string[];
  };
  handler: (args: Record<string, any>) => Promise<any>;
}

const tools = new Map<string, ToolDefinition>();

export function register(tool: ToolDefinition): void {
  tools.set(tool.name, tool);
}

export function get(name: string): ToolDefinition | undefined {
  return tools.get(name);
}

export function getAll(): ToolDefinition[] {
  return Array.from(tools.values());
}

export async function execute(
  name: string,
  args: Record<string, any>
): Promise<FunctionResult> {
  const tool = tools.get(name);
  if (!tool) {
    logError({ route: 'tool_execute', toolName: name }, new Error(`Tool ${name} not found`));
    return {
      callId: '',
      result: null,
      error: `Tool ${name} not found`,
    };
  }
  try {
    const result = await tool.handler(args);
    return { callId: '', result };
  } catch (error: any) {
    logError({ route: 'tool_execute', toolName: name }, error);
    return {
      callId: '',
      result: null,
      error: error.message || 'Unknown error',
    };
  }
}

export function getGeminiToolsFormat(): Array<{
  name: string;
  description: string;
  parameters: ToolDefinition['parameters'];
}> {
  return getAll().map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));
}
