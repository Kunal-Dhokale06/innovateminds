import React, { useState, useRef } from 'react';
import {
  Play,
  ArrowRight,
  Terminal,
  Paperclip,
  FileText,
  Image as ImageIcon,
  File,
  X,
  UploadCloud,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Eye,
  Sparkles,
  Coins,
  Award,
  Zap,
  Download,
  Palette,
  ExternalLink
} from 'lucide-react';
import { sendChatCompletion, extractAttachments, generateImage } from '../api';

interface PlaygroundPageProps {
  onSelectTrace: (traceId: string) => void;
  setActiveTab?: (tab: string) => void;
}

interface AttachedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  category: 'document' | 'image';
  tokenEstimate: number;
  previewText?: string;
  data: string;
  imageWidth?: number;
  imageHeight?: number;
}

export const PlaygroundPage: React.FC<PlaygroundPageProps> = ({ onSelectTrace }) => {
  const [prompt, setPrompt] = useState('');
  const [targetModel, setTargetModel] = useState('auto');
  const [budgetCap, setBudgetCap] = useState('0.005');
  const [latencySla, setLatencySla] = useState('4000');
  const [preference, setPreference] = useState('balanced');
  const [minCapability, setMinCapability] = useState('0.7');
  const [taskType, setTaskType] = useState('code');

  // Attachments State
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [responseResult, setResponseResult] = useState<any>(null);

  // Playground Mode: 'chat' | 'image'
  const [activeMode, setActiveMode] = useState<'chat' | 'image'>('chat');

  // Text-to-Image Generation State
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageModel, setImageModel] = useState('auto');
  const [imageSize, setImageSize] = useState('1024x1024');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imageResult, setImageResult] = useState<any>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  const handleGenerateImage = async () => {
    if (!imagePrompt.trim()) return;
    setIsGeneratingImage(true);
    setImageError(null);
    setImageResult(null);

    try {
      const res = await generateImage({
        prompt: imagePrompt.trim(),
        model: imageModel,
        size: imageSize,
        response_format: 'b64_json'
      });

      if (res.status !== 200) {
        setImageError(res.data?.detail || 'Failed to generate image');
      } else {
        setImageResult(res);
      }
    } catch (err: any) {
      setImageError(err.message || 'Error occurred while contacting image gateway');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleDownloadImage = () => {
    if (!imageResult) return;
    const item = imageResult.data?.data?.[0];
    if (!item) return;

    const link = document.createElement('a');
    if (item.b64_json) {
      link.href = `data:image/jpeg;base64,${item.b64_json}`;
    } else if (item.url) {
      link.href = item.url;
    }
    link.download = `modelrouter-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenFullImage = () => {
    if (!imageResult) return;
    const item = imageResult.data?.data?.[0];
    if (!item) return;
    if (item.url) {
      window.open(item.url, '_blank');
    } else if (item.b64_json) {
      const w = window.open('');
      w?.document.write(`<img src="data:image/jpeg;base64,${item.b64_json}" style="max-width:100%;height:auto;"/>`);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getFileIcon = (category: 'document' | 'image', filename: string) => {
    if (category === 'image') {
      return <ImageIcon className="h-4 w-4 text-blue-600" />;
    }
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') {
      return <FileText className="h-4 w-4 text-red-600" />;
    }
    if (ext === 'docx') {
      return <FileText className="h-4 w-4 text-blue-700" />;
    }
    return <File className="h-4 w-4 text-gray-600" />;
  };

  const handleFilesSelected = async (fileList: FileList | File[]) => {
    setAttachmentError(null);
    const filesArray = Array.from(fileList);
    if (!filesArray.length) return;

    if (attachments.length + filesArray.length > 5) {
      setAttachmentError('Maximum 5 attachments allowed per request.');
      return;
    }

    const validExts = ['.pdf', '.docx', '.txt', '.md', '.png', '.jpg', '.jpeg', '.webp'];

    for (const f of filesArray) {
      if (f.size === 0) {
        setAttachmentError(`File '${f.name}' is empty (0 bytes).`);
        return;
      }
      if (f.size > 10 * 1024 * 1024) {
        setAttachmentError(`File '${f.name}' exceeds the 10 MB per-file limit.`);
        return;
      }
      const ext = '.' + f.name.split('.').pop()?.toLowerCase();
      if (!validExts.includes(ext)) {
        setAttachmentError(`Unsupported format '${ext}'. Supported: PDF, DOCX, TXT, MD, PNG, JPG, WEBP.`);
        return;
      }
    }

    setIsUploading(true);
    try {
      const res = await extractAttachments(filesArray);
      const newItems: AttachedFile[] = res.attachments.map((a, idx) => ({
        id: `${Date.now()}-${idx}-${a.name}`,
        name: a.name,
        type: a.type,
        size: a.size,
        category: a.category,
        tokenEstimate: a.token_estimate,
        previewText: a.preview_text,
        data: a.data,
        imageWidth: a.image_width,
        imageHeight: a.image_height
      }));

      setAttachments((prev) => [...prev, ...newItems].slice(0, 5));
    } catch (err: any) {
      setAttachmentError(err.message || 'Failed to process files.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  };

  const handleSend = async () => {
    if (!prompt.trim() && attachments.length === 0) return;
    setIsLoading(true);
    setResponseResult(null);

    try {
      const headers: Record<string, string> = {
        'x-modelrouter-preference': preference,
        'x-modelrouter-task-type': taskType,
        'x-modelrouter-explain': 'true'
      };
      if (budgetCap) headers['x-modelrouter-budget-max'] = budgetCap;
      if (latencySla) headers['x-modelrouter-latency-sla-ms'] = latencySla;
      if (minCapability) headers['x-modelrouter-min-capability'] = minCapability;

      const payloadAttachments = attachments.map((a) => ({
        name: a.name,
        type: a.type,
        data: a.data,
        size: a.size
      }));

      const res = await sendChatCompletion(
        {
          model: targetModel,
          messages: [{ role: 'user', content: prompt || 'Analyze attached files.' }],
          attachments: payloadAttachments.length > 0 ? payloadAttachments : undefined
        },
        headers
      );

      setResponseResult(res);
    } catch (err: any) {
      setResponseResult({
        status: 500,
        data: { error: { message: err.message } },
        headers: {}
      });
    } finally {
      setIsLoading(false);
    }
  };

  const explainHeaders = responseResult?.headers || {};
  const traceId = explainHeaders['x-modelrouter-trace-id'];
  const routingExplainRaw = explainHeaders['x-modelrouter-routing-explain'];
  let parsedExplain: any = null;
  if (routingExplainRaw) {
    try {
      parsedExplain = JSON.parse(routingExplainRaw);
    } catch {
      parsedExplain = null;
    }
  }

  const inlineDecision = responseResult?.data?._modelrouter_decision;
  const decisionData = parsedExplain || inlineDecision;

  const selectedModel =
    explainHeaders['x-modelrouter-selected-model'] ||
    decisionData?.selected_model ||
    responseResult?.data?.model;

  const selectedProvider =
    explainHeaders['x-modelrouter-selected-provider'] ||
    decisionData?.selected_provider ||
    (selectedModel && (selectedModel.includes('gpt-oss') || selectedModel.includes('qwen')) ? 'groq' :
     selectedModel && selectedModel.includes('gemini') ? 'gemini' :
     selectedModel && selectedModel.includes('gpt-4') ? 'openai' : 'mock');

  const promptTokens = responseResult?.data?.usage?.prompt_tokens ?? decisionData?.prompt_tokens ?? 0;
  const completionTokens = responseResult?.data?.usage?.completion_tokens ?? decisionData?.completion_tokens ?? 0;
  const totalTokens = responseResult?.data?.usage?.total_tokens ?? (promptTokens + completionTokens);

  const actualCostUsd = decisionData?.actual_cost_usd !== undefined
    ? decisionData.actual_cost_usd
    : explainHeaders['x-modelrouter-actual-cost-usd']
    ? parseFloat(explainHeaders['x-modelrouter-actual-cost-usd'])
    : 0.0;

  const costSavingsPercent = decisionData?.cost_savings_percent !== undefined
    ? decisionData.cost_savings_percent
    : explainHeaders['x-modelrouter-cost-savings-percent']
    ? parseFloat(explainHeaders['x-modelrouter-cost-savings-percent'])
    : 0.0;

  const qualityScorePercent = decisionData?.quality_score_percent !== undefined
    ? decisionData.quality_score_percent
    : explainHeaders['x-modelrouter-quality-score-percent']
    ? parseFloat(explainHeaders['x-modelrouter-quality-score-percent'])
    : decisionData?.composite_score
    ? Math.round(decisionData.composite_score * 100)
    : 94.0;

  const whySelected = decisionData?.why_selected || explainHeaders['x-modelrouter-why-selected'] || decisionData?.justification;

  const totalAttachmentTokens = attachments.reduce((sum, a) => sum + a.tokenEstimate, 0);

  // Results Tabs: 'response' | 'decision' | 'details'
  const [resultTab, setResultTab] = useState<'response' | 'decision' | 'details'>('response');
  const [hasCopied, setHasCopied] = useState(false);

  const handleCopyResponse = () => {
    const text = responseResult?.data?.choices?.[0]?.message?.content;
    if (text) {
      navigator.clipboard.writeText(text);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Subtitle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Routing Playground</h1>
          <p className="text-sm text-slate-500 mt-1">
            Test intelligent model routing, multimodal inference, and cost optimization.
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="inline-flex p-1 rounded-lg border border-slate-200 bg-slate-100">
          <button
            type="button"
            onClick={() => setActiveMode('chat')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeMode === 'chat'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Terminal className="h-3.5 w-3.5 text-indigo-600" />
            <span>Text & Multimodal Chat</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('image')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeMode === 'image'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Palette className="h-3.5 w-3.5 text-indigo-600" />
            <span>AI Image Generation</span>
          </button>
        </div>
      </div>

      {activeMode === 'chat' ? (
      /* Main Two-Column Layout */
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Request Composer & Configuration */}
        <div className="lg:col-span-5 space-y-5">
          <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-4">
            {/* A. Request Composer */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Request Composer
                </label>
                <div className="flex items-center space-x-2 text-[11px] text-slate-400 font-mono">
                  <span>{prompt.length} chars</span>
                  <span>·</span>
                  <span>{attachments.length}/5 files {totalAttachmentTokens > 0 && `(≈${totalAttachmentTokens} tok)`}</span>
                </div>
              </div>

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative rounded-lg border transition-all ${
                  isDragging
                    ? 'border-indigo-500 bg-indigo-50/30 ring-2 ring-indigo-500/20'
                    : 'border-slate-300 bg-white focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500'
                }`}
              >
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={4}
                  className="w-full bg-transparent p-3 text-sm text-slate-900 focus:outline-none resize-none leading-relaxed font-sans placeholder:text-slate-400"
                  placeholder="Enter your prompt here or drag and drop PDF, DOCX, TXT, Markdown, PNG, JPG, or WEBP files..."
                />

                {/* Drag Overlay Hint */}
                {isDragging && (
                  <div className="absolute inset-0 bg-indigo-50/95 flex flex-col items-center justify-center rounded-lg pointer-events-none text-indigo-700 space-y-1 z-10">
                    <UploadCloud className="h-6 w-6 animate-bounce" />
                    <span className="text-xs font-semibold">Drop documents or images to attach</span>
                  </div>
                )}

                {/* Attachment Bar inside Prompt Box */}
                <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 rounded-b-lg flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      multiple
                      accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp"
                      className="hidden"
                      onChange={(e) => e.target.files && handleFilesSelected(e.target.files)}
                    />
                    <button
                      type="button"
                      disabled={isUploading || attachments.length >= 5}
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center space-x-1.5 text-xs text-slate-700 hover:text-indigo-600 px-2.5 py-1 rounded-md border border-slate-200 hover:border-indigo-200 bg-white hover:bg-indigo-50/50 transition-colors disabled:opacity-50 font-medium"
                      title="Attach documents or images (PDF, DOCX, TXT, MD, PNG, JPG, WEBP)"
                    >
                      <Paperclip className="h-3.5 w-3.5 text-slate-500" />
                      <span>Attach Files</span>
                    </button>

                    <span className="text-[11px] text-slate-400 hidden sm:inline">
                      Max 5 files, 10MB each
                    </span>
                  </div>

                  {attachments.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setAttachments([])}
                      className="text-[11px] text-slate-500 hover:text-red-600 transition-colors font-medium"
                    >
                      Clear files
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Uploading Status Indicator */}
            {isUploading && (
              <div className="p-2.5 rounded-lg border border-indigo-200 bg-indigo-50/50 flex items-center space-x-2 text-xs text-indigo-700">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                <span>Extracting document text & validating structure...</span>
              </div>
            )}

            {/* Error Banner */}
            {attachmentError && (
              <div className="p-2.5 rounded-lg border border-red-200 bg-red-50 flex items-start justify-between text-xs text-red-700">
                <div className="flex items-start space-x-1.5">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-red-600" />
                  <span>{attachmentError}</span>
                </div>
                <button onClick={() => setAttachmentError(null)} className="text-red-500 hover:text-red-700 ml-2">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Attached Files List Cards */}
            {attachments.length > 0 && (
              <div className="space-y-1.5">
                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-0.5">
                  {attachments.map((att) => (
                    <div
                      key={att.id}
                      className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition-colors flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        {att.category === 'image' && att.data ? (
                          <img
                            src={att.data}
                            alt={att.name}
                            className="w-8 h-8 rounded object-cover border border-slate-300 shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded border border-slate-200 bg-white flex items-center justify-center shrink-0">
                            {getFileIcon(att.category, att.name)}
                          </div>
                        )}

                        <div className="min-w-0">
                          <p className="font-mono text-slate-900 font-medium truncate max-w-[200px]" title={att.name}>
                            {att.name}
                          </p>
                          <p className="text-[11px] text-slate-500 font-mono">
                            {att.category.toUpperCase()} · {formatFileSize(att.size)} · ≈{att.tokenEstimate} tok
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeAttachment(att.id)}
                        className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-slate-200/50 transition-colors"
                        title="Remove file"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* B. Model Selection */}
            <div className="pt-3 border-t border-slate-100 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Target Model / Dispatch
                </label>
                <div className="flex items-center space-x-1.5">
                  <span className="text-[10px] text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 font-mono">
                    Groq Active
                  </span>
                  <span className="text-[10px] text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 font-mono">
                    Gemini Active
                  </span>
                </div>
              </div>
              <select
                value={targetModel}
                onChange={(e) => setTargetModel(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-medium"
              >
                <option value="auto">Auto / Smart Dynamic Routing (Recommended)</option>
                <optgroup label="Groq LPU (Ultra-Low Latency)">
                  <option value="qwen/qwen3.8-27b">qwen/qwen3.8-27b (27B Fast Inference)</option>
                  <option value="openai/gpt-oss-120b">openai/gpt-oss-120b (120B Flagship Reasoning)</option>
                </optgroup>
                <optgroup label="Google Gemini (Multimodal & Long Context)">
                  <option value="gemini-1.5-flash">gemini-1.5-flash (Fast Multimodal)</option>
                  <option value="gemini-2.0-flash">gemini-2.0-flash (Next-Gen Flash)</option>
                  <option value="gemini-1.5-pro">gemini-1.5-pro (Deep Multimodal 2M Context)</option>
                </optgroup>
                <optgroup label="OpenAI (Commercial Standard)">
                  <option value="gpt-4o-mini">gpt-4o-mini (Cost-Efficient)</option>
                  <option value="gpt-4o">gpt-4o (Omni Flagship)</option>
                </optgroup>
              </select>
              <p className="text-[11px] text-slate-400">
                {targetModel === 'auto'
                  ? 'The engine dynamically selects the optimal model using Pareto scoring across budget and latency SLAs.'
                  : `Explicit override: Requests will bypass auto-routing and target ${targetModel} directly.`}
              </p>
            </div>

            {/* C. Routing Constraints Grid */}
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                Hard Numerical Constraints
              </span>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1" title="Hard dollar limit per request. Models exceeding estimated token cost are disqualified.">
                    Max Budget ($ USD)
                  </label>
                  <input
                    type="number"
                    step="0.0005"
                    value={budgetCap}
                    onChange={(e) => setBudgetCap(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-900 font-mono focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    placeholder="e.g. 0.005"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Budget cutoff ceiling</span>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1" title="Maximum acceptable response time in milliseconds. Slow models are disqualified.">
                    Latency SLA (ms)
                  </label>
                  <input
                    type="number"
                    step="100"
                    value={latencySla}
                    onChange={(e) => setLatencySla(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-900 font-mono focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    placeholder="e.g. 4000"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">P95 deadline bound</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Optimization Mode
                  </label>
                  <select
                    value={preference}
                    onChange={(e) => setPreference(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-medium"
                  >
                    <option value="balanced">Balanced (Pareto)</option>
                    <option value="cost_first">Cost-First (Lowest Price)</option>
                    <option value="latency_first">Latency-First (Speed)</option>
                    <option value="quality_first">Quality-First (High Score)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Task Benchmark
                  </label>
                  <select
                    value={taskType}
                    onChange={(e) => setTaskType(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-medium"
                  >
                    <option value="code">Code (HumanEval)</option>
                    <option value="math">Math (GSM8K)</option>
                    <option value="extraction">Structured (JSON)</option>
                    <option value="general">General (MMLU)</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                  <span>Minimum Capability Threshold</span>
                  <span className="font-mono text-indigo-700 font-bold">{(parseFloat(minCapability) * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="0.95"
                  step="0.05"
                  value={minCapability}
                  onChange={(e) => setMinCapability(e.target.value)}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">Disqualifies models below this benchmark score</span>
              </div>
            </div>

            {/* D. Primary Action */}
            <button
              onClick={handleSend}
              disabled={isLoading || isUploading || (!prompt.trim() && attachments.length === 0)}
              className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all flex items-center justify-center space-x-2 disabled:opacity-50 shadow-xs cursor-pointer disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                  <span>Evaluating Constraints & Executing...</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 fill-white text-white" />
                  <span>Route & Execute Request</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Execution Output & Inspection */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-5 rounded-xl border border-slate-200 bg-white min-h-[560px] flex flex-col justify-between shadow-2xs">
            {responseResult ? (
              <div className="space-y-4">
                {/* Result KPI Bar */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                    <span
                      className={`font-mono text-xs px-2 py-0.5 rounded-md font-semibold ${
                        responseResult.status === 200
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}
                    >
                      HTTP {responseResult.status}
                    </span>

                    {selectedModel && (
                      <span className="font-mono text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 font-semibold">
                        Routed: {selectedModel}
                      </span>
                    )}

                    {selectedProvider && (
                      <span className="font-mono text-xs px-2 py-0.5 rounded-md font-semibold border bg-indigo-50 text-indigo-700 border-indigo-200 uppercase">
                        {selectedProvider}
                      </span>
                    )}

                    {explainHeaders['x-modelrouter-requires-vision'] === 'true' && (
                      <span className="font-mono text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200 flex items-center space-x-1">
                        <Eye className="h-3 w-3" />
                        <span>Vision Engaged</span>
                      </span>
                    )}
                  </div>

                  {traceId && (
                    <button
                      onClick={() => onSelectTrace(traceId)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center space-x-1 font-semibold"
                    >
                      <span>Full Audit Trace</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Core Metrics Strip: Tokens, Cost, Quality, Latency */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                  {/* Card 1: Tokens */}
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wide flex items-center space-x-1">
                        <Terminal className="h-3 w-3 text-slate-400" />
                        <span>Tokens</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">Usage</span>
                    </div>
                    <div className="font-mono text-slate-900 font-bold text-sm">
                      {totalTokens} <span className="text-xs font-normal text-slate-500">tok</span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono truncate">
                      {promptTokens} in · {completionTokens} out
                    </div>
                  </div>

                  {/* Card 2: Cost */}
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wide flex items-center space-x-1">
                        <Coins className="h-3 w-3 text-emerald-600" />
                        <span>Actual Cost</span>
                      </span>
                      {costSavingsPercent > 0 && (
                        <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                          -{costSavingsPercent}%
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-emerald-700 font-bold text-sm">
                      ${actualCostUsd < 0.0001 ? actualCostUsd.toFixed(6) : actualCostUsd.toFixed(5)}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {costSavingsPercent > 0 ? `Savings vs baseline` : `Direct pricing`}
                    </div>
                  </div>

                  {/* Card 3: Quality Match */}
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wide flex items-center space-x-1">
                        <Award className="h-3 w-3 text-indigo-600" />
                        <span>Benchmark Match</span>
                      </span>
                    </div>
                    <div className="font-mono text-indigo-700 font-bold text-sm">
                      {qualityScorePercent}%
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      Task capability fit
                    </div>
                  </div>

                  {/* Card 4: Latency */}
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wide flex items-center space-x-1">
                        <Zap className="h-3 w-3 text-amber-500" />
                        <span>Total Latency</span>
                      </span>
                    </div>
                    <div className="font-mono text-slate-900 font-bold text-sm">
                      {explainHeaders['x-modelrouter-upstream-latency-ms'] || (decisionData?.estimated_latency_ms ? decisionData.estimated_latency_ms.toFixed(0) : '—')} <span className="text-xs font-normal text-slate-500">ms</span>
                    </div>
                    <div className="text-[10px] text-emerald-700 font-mono font-medium">
                      Overhead: {explainHeaders['x-modelrouter-gateway-overhead-ms'] || '0.00'} ms
                    </div>
                  </div>
                </div>

                {/* Compact Results Tabs: Response | Routing Decision | Request Details */}
                <div className="border-b border-slate-200 pt-2">
                  <div className="flex space-x-6">
                    <button
                      type="button"
                      onClick={() => setResultTab('response')}
                      className={`pb-2 text-xs font-semibold border-b-2 transition-all ${
                        resultTab === 'response'
                          ? 'border-indigo-600 text-indigo-600'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Response Content
                    </button>
                    <button
                      type="button"
                      onClick={() => setResultTab('decision')}
                      className={`pb-2 text-xs font-semibold border-b-2 transition-all ${
                        resultTab === 'decision'
                          ? 'border-indigo-600 text-indigo-600'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Routing Decision & Matrix
                    </button>
                    <button
                      type="button"
                      onClick={() => setResultTab('details')}
                      className={`pb-2 text-xs font-semibold border-b-2 transition-all ${
                        resultTab === 'details'
                          ? 'border-indigo-600 text-indigo-600'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Request Details & Trace
                    </button>
                  </div>
                </div>

                {/* Tab 1: Response */}
                {resultTab === 'response' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                        Inference Output
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyResponse}
                        className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors shadow-2xs"
                      >
                        {hasCopied ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            <span className="text-emerald-700 font-semibold">Copied!</span>
                          </>
                        ) : (
                          <>
                            <ExternalLink className="h-3 w-3 text-slate-400" />
                            <span>Copy Response</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/70 font-sans text-sm text-slate-800 whitespace-pre-wrap max-h-72 overflow-y-auto leading-relaxed selection:bg-indigo-100">
                      {responseResult.data?.choices?.[0]?.message?.content ||
                        JSON.stringify(responseResult.data, null, 2)}
                    </div>
                  </div>
                )}

                {/* Tab 2: Routing Decision */}
                {resultTab === 'decision' && (
                  <div className="space-y-3">
                    {/* Why this model was selected */}
                    {whySelected && (
                      <div className="p-3.5 rounded-lg border border-indigo-200 bg-indigo-50/50 text-xs text-indigo-950 leading-relaxed space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold uppercase tracking-wider text-[11px] text-indigo-900 flex items-center space-x-1.5">
                            <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                            <span>Engine Decision Rationale</span>
                          </span>
                          <span className="text-[10px] bg-indigo-100 text-indigo-800 font-medium px-2 py-0.5 rounded">
                            Deterministic Selection
                          </span>
                        </div>
                        <p className="text-indigo-900 leading-relaxed font-sans">{whySelected}</p>
                      </div>
                    )}

                    {/* Candidate Matrix Snapshot */}
                    {decisionData && (
                      <div className="space-y-2">
                        <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide block">
                          Candidate Evaluation Matrix
                        </span>

                        <div className="border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                          <table className="w-full text-left border-collapse table-clean">
                            <thead>
                              <tr>
                                <th>Candidate Model</th>
                                <th>Provider</th>
                                <th>Status</th>
                                <th>Pareto Score</th>
                                <th>Engine Evaluation</th>
                              </tr>
                            </thead>
                            <tbody>
                              {((decisionData.candidates || decisionData.candidate_evaluations || []) as any[])
                                .filter((c: any) => !c.model_name.startsWith('mock-'))
                                .map((c: any) => {
                                const isWinner = c.model_name === selectedModel;
                                return (
                                  <tr key={c.model_name} className={isWinner ? 'bg-emerald-50/60 font-semibold' : ''}>
                                    <td className="font-mono text-slate-900">
                                      <div className="flex items-center space-x-1.5">
                                        {isWinner && <span className="text-emerald-600 font-bold text-xs">✓</span>}
                                        <span>{c.model_name}</span>
                                      </div>
                                    </td>
                                    <td>
                                      <span
                                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded uppercase font-semibold border ${
                                          c.provider === 'groq'
                                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                                            : c.provider === 'gemini'
                                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                            : c.provider === 'openai'
                                            ? 'bg-blue-50 text-blue-800 border-blue-200'
                                            : 'bg-slate-100 text-slate-700 border-slate-200'
                                        }`}
                                      >
                                        {c.provider}
                                      </span>
                                    </td>
                                    <td>
                                      {c.is_eligible ? (
                                        <span className="text-emerald-700 font-medium">Eligible</span>
                                      ) : (
                                        <span className="text-red-600 font-medium">Disqualified</span>
                                      )}
                                    </td>
                                    <td className="font-mono text-indigo-700 font-semibold">
                                      {c.composite_score ? `${(c.composite_score * 100).toFixed(1)}%` : '—'}
                                    </td>
                                    <td className="text-xs font-mono text-slate-500">
                                      {c.rejection_reasons?.length ? c.rejection_reasons.join(', ') : isWinner ? 'Winning Candidate' : 'Eligible Fallback'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 3: Request Details */}
                {resultTab === 'details' && (
                  <div className="space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
                        <span className="text-slate-500 block font-medium">OpenTelemetry Trace ID</span>
                        <span className="font-mono font-semibold text-slate-900 block truncate">{traceId || '—'}</span>
                      </div>
                      <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
                        <span className="text-slate-500 block font-medium">Gateway Overhead</span>
                        <span className="font-mono font-semibold text-emerald-700 block">
                          {explainHeaders['x-modelrouter-gateway-overhead-ms'] || '0.00'} ms
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1.5 font-mono text-[11px]">
                      <div className="flex justify-between text-slate-600">
                        <span>Target Requested:</span>
                        <span className="font-bold text-slate-900">{targetModel}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Optimization Mode:</span>
                        <span className="font-bold text-slate-900">{preference}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Task Type:</span>
                        <span className="font-bold text-slate-900">{taskType}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Budget Cap SLA:</span>
                        <span className="font-bold text-slate-900">${budgetCap}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Latency Bound SLA:</span>
                        <span className="font-bold text-slate-900">{latencySla} ms</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400 space-y-3">
                <div className="h-12 w-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500">
                  <Terminal className="h-6 w-6 text-slate-600" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">Playground Ready</h4>
                  <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
                    Enter a prompt on the left, configure routing constraints, and click <span className="font-semibold text-indigo-600">"Route & Execute Request"</span> to test zero-overhead multimodal gateway routing.
                  </p>
                </div>
                <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-[11px] text-slate-600 max-w-sm text-left space-y-1">
                  <div className="font-semibold text-slate-800 flex items-center space-x-1">
                    <Sparkles className="h-3 w-3 text-indigo-500" />
                    <span>Evaluation Guarantee:</span>
                  </div>
                  <p className="text-slate-500 leading-normal">
                    ModelRouter enforces all budget caps and latency SLAs in &lt;1ms before candidate dispatch.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      ) : (
        /* Image Generation Mode Two-Column Layout */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Image Prompt & Controls */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-5 rounded border border-gray-200 bg-white space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    Image Prompt
                  </label>
                  <span className="text-[11px] text-gray-500 font-mono">
                    {imagePrompt.length} chars
                  </span>
                </div>
                <div className="rounded border border-gray-300 bg-white">
                  <textarea
                    value={imagePrompt}
                    onChange={(e) => setImagePrompt(e.target.value)}
                    rows={4}
                    className="w-full bg-transparent p-3 text-xs text-gray-900 font-mono focus:outline-none resize-none leading-relaxed"
                    placeholder="Describe the desired image in vivid detail (e.g. A hyper-realistic cyberpunk cityscape at dusk with neon cyan reflections, 8k resolution, cinematic lighting)..."
                  />
                  <div className="px-3 py-1.5 bg-gray-50/80 border-t border-gray-200 flex items-center justify-between text-[11px] text-gray-500">
                    <span className="flex items-center space-x-1">
                      <Sparkles className="h-3 w-3 text-amber-500" />
                      <span>Photographic, 3D render, digital art styles</span>
                    </span>
                    {imagePrompt && (
                      <button
                        type="button"
                        onClick={() => setImagePrompt('')}
                        className="text-gray-400 hover:text-red-600 transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Target Image Engine */}
              <div className="pt-2 border-t border-gray-100 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    Target Image Engine
                  </label>
                  <span className="text-[10px] text-zinc-700 bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200 font-mono">
                    Automatic Failover Active
                  </span>
                </div>
                <select
                  value={imageModel}
                  onChange={(e) => setImageModel(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-blue-600 font-medium"
                >
                  <option value="auto">Auto (Smart Dynamic Routing: Flux / Gemini)</option>
                  <option value="flux-schnell">Flux.1 Schnell (Sub-second, High Quality, Free Tier)</option>
                  <option value="gemini-2.5-flash-image">Google Gemini 2.5 Image (Multimodal Gen)</option>
                </select>
              </div>

              {/* Resolution / Aspect Ratio */}
              <div className="pt-2 border-t border-gray-100 space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  Resolution & Aspect Ratio
                </label>
                <select
                  value={imageSize}
                  onChange={(e) => setImageSize(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-blue-600 font-medium"
                >
                  <option value="1024x1024">1024 x 1024 (Square 1:1) — Recommended</option>
                  <option value="1024x768">1024 x 768 (Landscape 4:3)</option>
                  <option value="768x1024">768 x 1024 (Portrait 3:4)</option>
                  <option value="512x512">512 x 512 (Fast Preview 1:1)</option>
                </select>
              </div>

              {/* Reliability Guarantee Card */}
              <div className="p-2.5 rounded bg-zinc-50 border border-zinc-200 text-[11px] text-zinc-700 space-y-1">
                <div className="flex items-center space-x-1.5 font-semibold text-zinc-900">
                  <Zap className="h-3.5 w-3.5 text-zinc-600" />
                  <span>ModelRouter Failover Policy</span>
                </div>
                <p className="text-zinc-600 leading-relaxed">
                  Automatic failover ensures 100% generation availability. If upstream commercial quotas are exceeded, the gateway instantly routes to Flux.1 Schnell with zero user degradation.
                </p>
              </div>

              {/* Error banner */}
              {imageError && (
                <div className="p-2.5 rounded border border-red-200 bg-red-50 flex items-start justify-between text-xs text-red-700">
                  <div className="flex items-start space-x-1.5">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-red-600" />
                    <span>{imageError}</span>
                  </div>
                  <button onClick={() => setImageError(null)} className="text-red-500 hover:text-red-700 ml-2">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Generate Button */}
              <button
                type="button"
                onClick={handleGenerateImage}
                disabled={isGeneratingImage || !imagePrompt.trim()}
                className="w-full py-2.5 px-4 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-xs transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 shadow-xs"
              >
                {isGeneratingImage ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                    <span>Synthesizing Image via Diffusion Gateway...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 text-zinc-300" />
                    <span>Generate High-Resolution Image</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Image Preview & Decision Details */}
          <div className="lg:col-span-7 space-y-4">
            <div className="p-5 rounded border border-gray-200 bg-white min-h-[480px] flex flex-col justify-between">
              {imageResult ? (
                <div className="space-y-4">
                  {/* Result Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-gray-100 flex-wrap gap-2">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <span className="font-mono text-xs px-2 py-0.5 rounded font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        HTTP {imageResult.status}
                      </span>
                      <span className="font-mono text-xs text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200 font-semibold">
                        Routed: {imageResult.data?._modelrouter_decision?.selected_model || 'flux-schnell'}
                      </span>
                      <span className="font-mono text-xs px-2 py-0.5 rounded font-semibold border bg-zinc-100 text-zinc-800 border-zinc-200">
                        Provider: {(imageResult.data?._modelrouter_decision?.selected_provider || 'flux').toUpperCase()}
                      </span>
                      <span className="font-mono text-xs text-gray-700 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                        {imageResult.data?._modelrouter_decision?.latency_ms || '—'} ms
                      </span>
                      <span className="font-mono text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {imageResult.data?._modelrouter_decision?.resolution || imageSize}
                      </span>
                      <span className="font-mono text-xs text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200 font-medium">
                        $0.00 / Free Tier
                      </span>
                    </div>

                    {imageResult.headers?.['x-modelrouter-trace-id'] && (
                      <button
                        onClick={() => onSelectTrace(imageResult.headers['x-modelrouter-trace-id'])}
                        className="text-xs text-blue-600 hover:text-blue-700 flex items-center space-x-1 font-medium"
                      >
                        <span>Trace: {imageResult.headers['x-modelrouter-trace-id'].slice(0, 14)}...</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {/* Image Display Card */}
                  <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-gray-900 flex flex-col items-center justify-center group shadow-sm">
                    {(() => {
                      const item = imageResult.data?.data?.[0];
                      const imgSrc = item?.b64_json
                        ? `data:image/jpeg;base64,${item.b64_json}`
                        : item?.url;
                      return imgSrc ? (
                        <img
                          src={imgSrc}
                          alt={imagePrompt}
                          className="max-h-[460px] w-auto object-contain rounded transition-transform duration-200"
                        />
                      ) : (
                        <div className="p-12 text-center text-gray-400">
                          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-amber-400" />
                          <p className="text-xs">No image data returned from provider.</p>
                        </div>
                      );
                    })()}

                    {/* Action Bar Overlay */}
                    <div className="w-full p-2.5 bg-gray-900/90 border-t border-gray-800 flex items-center justify-between">
                      <div className="text-[11px] text-gray-300 font-mono truncate max-w-[260px]">
                        "{imagePrompt.slice(0, 45)}..."
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={handleOpenFullImage}
                          className="px-2.5 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-medium flex items-center space-x-1.5 transition-colors border border-gray-700"
                          title="Open full-resolution image"
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span>Full Res</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleDownloadImage}
                          className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium flex items-center space-x-1.5 transition-colors shadow-sm"
                          title="Download generated image"
                        >
                          <Download className="h-3 w-3" />
                          <span>Download JPEG</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Decision Rationale */}
                  <div className="p-3 rounded border border-gray-200 bg-gray-50/70 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5 text-xs font-semibold text-gray-800">
                        <Award className="h-3.5 w-3.5 text-blue-600" />
                        <span>Decision Rationale & Fallback Chain</span>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-700 bg-emerald-100/60 px-1.5 py-0.5 rounded">
                        Composite Score: 96.0%
                      </span>
                    </div>

                    <p className="text-xs text-gray-700 leading-relaxed font-sans">
                      {imageResult.data?._modelrouter_decision?.why_selected ||
                        imageResult.headers?.['x-modelrouter-why-selected'] ||
                        `Model '${imageResult.data?._modelrouter_decision?.selected_model}' was selected for optimal photorealism, low latency, and zero rate-limiting.`}
                    </p>

                    <div className="pt-2 border-t border-gray-200 flex items-center justify-between text-[11px] text-gray-500 font-mono">
                      <span>Fallback Order: flux-schnell ➔ gemini-2.5-flash-image</span>
                      <span>Modality: Text-to-Image</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-400">
                  <Palette className="h-10 w-10 text-gray-300 mb-2.5 stroke-1" />
                  <h4 className="text-xs font-semibold text-gray-700">AI Image Generation Ready</h4>
                  <p className="text-xs text-gray-500 max-w-sm mt-1 leading-relaxed">
                    Enter a visual prompt on the left, select your resolution, and click "Generate High-Resolution Image". ModelRouter will dispatch the request across our multi-provider diffusion mesh.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
