import type {
  RequestTraceItem,
  TraceDetailResponse,
  ModelProfileItem,
  SystemMetrics,
  RoutingRuleItem
} from './types';

const API_BASE = 'http://localhost:8000/v1';

export async function fetchMetrics(): Promise<SystemMetrics> {
  const res = await fetch(`${API_BASE}/metrics`);
  if (!res.ok) throw new Error('Failed to fetch metrics');
  return res.json();
}

export async function fetchTraces(limit = 50, offset = 0, status?: number): Promise<{ traces: RequestTraceItem[]; count: number }> {
  let url = `${API_BASE}/traces?limit=${limit}&offset=${offset}`;
  if (status) url += `&status=${status}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch traces');
  return res.json();
}

export async function fetchTraceDetail(traceId: string): Promise<TraceDetailResponse> {
  const res = await fetch(`${API_BASE}/traces/${traceId}`);
  if (!res.ok) throw new Error('Failed to fetch trace detail');
  return res.json();
}

export async function fetchModels(): Promise<{ models: ModelProfileItem[]; count: number }> {
  const res = await fetch(`${API_BASE}/models`);
  if (!res.ok) throw new Error('Failed to fetch models');
  return res.json();
}

export async function toggleModel(modelName: string): Promise<{ is_active: boolean }> {
  const res = await fetch(`${API_BASE}/models/${modelName}/toggle`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to toggle model');
  return res.json();
}

export async function fetchSimulationConfig(): Promise<any> {
  const res = await fetch(`${API_BASE}/simulation/config`);
  if (!res.ok) throw new Error('Failed to fetch simulation config');
  return res.json();
}

export async function updateSimulationConfig(config: {
  target_model: string;
  simulated_latency_ms?: number | null;
  injected_error_code?: number | null;
  is_active?: boolean | null;
}): Promise<any> {
  const res = await fetch(`${API_BASE}/simulation/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });
  if (!res.ok) throw new Error('Failed to update simulation config');
  return res.json();
}

export async function resetSimulationConfig(): Promise<any> {
  const res = await fetch(`${API_BASE}/simulation/reset`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to reset simulation config');
  return res.json();
}

export async function fetchRules(): Promise<{ rules: RoutingRuleItem[] }> {
  const res = await fetch(`${API_BASE}/rules`);
  if (!res.ok) throw new Error('Failed to fetch rules');
  return res.json();
}

export async function createRule(rule: Partial<RoutingRuleItem>): Promise<any> {
  const res = await fetch(`${API_BASE}/rules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rule)
  });
  if (!res.ok) throw new Error('Failed to create rule');
  return res.json();
}

export async function extractAttachments(files: File[]): Promise<{
  attachments: Array<{
    name: string;
    filename: string;
    type: string;
    size: number;
    category: 'document' | 'image';
    token_estimate: number;
    preview_text?: string;
    data: string;
    image_width?: number;
    image_height?: number;
  }>;
  total_tokens: number;
  has_images: boolean;
  has_documents: boolean;
}> {
  const formData = new FormData();
  files.forEach((f) => formData.append('files', f));
  const res = await fetch(`${API_BASE}/attachments/extract`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to process attachments' }));
    throw new Error(err.detail || 'Failed to process attachments');
  }
  return res.json();
}

export async function sendChatCompletion(
  body: {
    model?: string;
    messages: Array<{ role: string; content: string | any[] }>;
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
    tools?: any[];
    attachments?: Array<{
      name: string;
      type: string;
      data: string;
      size?: number;
    }>;
  },
  headers: Record<string, string> = {}
): Promise<{ status: number; data: any; headers: Record<string, string> }> {
  const mergedHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-modelrouter-explain': 'true',
    ...headers
  };

  const res = await fetch(`${API_BASE}/chat/completions`, {
    method: 'POST',
    headers: mergedHeaders,
    body: JSON.stringify(body)
  });

  const responseHeaders: Record<string, string> = {};
  res.headers.forEach((val, key) => {
    responseHeaders[key.toLowerCase()] = val;
  });

  const data = await res.json();
  return {
    status: res.status,
    data,
    headers: responseHeaders
  };
}

export async function generateImage(
  body: {
    prompt: string;
    model?: string;
    size?: string;
    n?: number;
    response_format?: 'url' | 'b64_json';
  },
  headers: Record<string, string> = {}
): Promise<{ status: number; data: any; headers: Record<string, string> }> {
  const mergedHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-modelrouter-explain': 'true',
    ...headers
  };

  const res = await fetch(`${API_BASE}/images/generations`, {
    method: 'POST',
    headers: mergedHeaders,
    body: JSON.stringify(body)
  });

  const responseHeaders: Record<string, string> = {};
  res.headers.forEach((val, key) => {
    responseHeaders[key.toLowerCase()] = val;
  });

  const data = await res.json();
  return {
    status: res.status,
    data,
    headers: responseHeaders
  };
}

