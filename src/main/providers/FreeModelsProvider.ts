import OpenAI from 'openai';
import log from 'electron-log';
import { ProviderConfig, ProviderModel } from '../../shared/types';

interface FreeModelConfig {
  provider: string;
  baseUrl: string;
  requiresApiKey: boolean;
  defaultApiKey?: string;
  description: string;
}

const FREE_MODEL_CONFIGS: Record<string, FreeModelConfig> = {
  openrouter: {
    provider: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    requiresApiKey: false,
    defaultApiKey: '',
    description: 'Free models via OpenRouter (no API key required for free tier)'
  },
  ollama: {
    provider: 'Ollama',
    baseUrl: 'http://localhost:11434/v1',
    requiresApiKey: false,
    defaultApiKey: '',
    description: 'Local Ollama server - runs models locally on your machine'
  },
  nvidia: {
    provider: 'NVIDIA NIM',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    requiresApiKey: true,
    description: 'NVIDIA NIM API - Free tier with phone verification (40 req/min)'
  },
  groq: {
    provider: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    requiresApiKey: true,
    description: 'Fast inference with Llama/Mixtral models (free tier available)'
  },
  google: {
    provider: 'Google AI Studio',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    requiresApiKey: true,
    description: 'Gemini models free tier (requires Google AI Studio API key)'
  },
  cerebras: {
    provider: 'Cerebras',
    baseUrl: 'https://api.cerebras.ai/v1',
    requiresApiKey: true,
    description: 'Ultra-fast inference (free tier available)'
  },
  cloudflare: {
    provider: 'Cloudflare Workers AI',
    baseUrl: 'https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1',
    requiresApiKey: true,
    description: 'Edge AI with free tier (10,000 neurons/day)'
  }
};

const FREE_MODELS: ProviderModel[] = [
  {
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    name: 'Llama 3.3 70B (Free)',
    description: 'Meta Llama 3.3 70B - GPT-4 level performance, via OpenRouter',
    maxTokens: 8192,
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'openrouter'
  },
  {
    id: 'google/gemini-2.0-flash-exp:free',
    name: 'Gemini 2.0 Flash (Free)',
    description: 'Google Gemini 2.0 Flash - 1M context, via OpenRouter',
    maxTokens: 8192,
    contextWindow: 1000000,
    supportsTools: true,
    supportsVision: true,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'openrouter'
  },
  {
    id: 'google/gemini-2.5-flash-preview:free',
    name: 'Gemini 2.5 Flash Preview (Free)',
    description: 'Google Gemini 2.5 Flash Preview - via OpenRouter',
    maxTokens: 8192,
    contextWindow: 1000000,
    supportsTools: true,
    supportsVision: true,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'openrouter'
  },
  {
    id: 'google/gemma-3-27b-it:free',
    name: 'Gemma 3 27B (Free)',
    description: 'Google Gemma 3 27B Instruct, via OpenRouter',
    maxTokens: 8192,
    contextWindow: 32768,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'openrouter'
  },
  {
    id: 'google/gemma-3-12b-it:free',
    name: 'Gemma 3 12B (Free)',
    description: 'Google Gemma 3 12B Instruct, via OpenRouter',
    maxTokens: 4096,
    contextWindow: 32768,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'openrouter'
  },
  {
    id: 'mistralai/mistral-small-3.1-24b-instruct:free',
    name: 'Mistral Small 3.1 24B (Free)',
    description: 'Mistral Small 3.1 24B Instruct, via OpenRouter',
    maxTokens: 8192,
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: true,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'openrouter'
  },
  {
    id: 'deepseek/deepseek-r1-0528:free',
    name: 'DeepSeek R1 (Free)',
    description: 'DeepSeek R1 reasoning model, via OpenRouter',
    maxTokens: 8192,
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'openrouter'
  },
  {
    id: 'qwen/qwen3-4b:free',
    name: 'Qwen 3 4B (Free)',
    description: 'Alibaba Qwen 3 4B, via OpenRouter',
    maxTokens: 4096,
    contextWindow: 32768,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'openrouter'
  },
  {
    id: 'qwen/qwen3-coder:free',
    name: 'Qwen 3 Coder (Free)',
    description: 'Alibaba Qwen 3 Coder - optimized for code, via OpenRouter',
    maxTokens: 8192,
    contextWindow: 32768,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'openrouter'
  },
  {
    id: 'qwen/qwen3-next-80b-a3b-instruct:free',
    name: 'Qwen 3 Next 80B (Free)',
    description: 'Alibaba Qwen 3 Next 80B, via OpenRouter',
    maxTokens: 8192,
    contextWindow: 32768,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'openrouter'
  },
  {
    id: 'nvidia/nemotron-nano-12b-v2-vl:free',
    name: 'Nemotron Nano 12B VL (Free)',
    description: 'NVIDIA Nemotron Nano 12B Vision Language, via OpenRouter',
    maxTokens: 4096,
    contextWindow: 32768,
    supportsTools: true,
    supportsVision: true,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'openrouter'
  },
  {
    id: 'nousresearch/hermes-3-llama-3.1-405b:free',
    name: 'Hermes 3 Llama 405B (Free)',
    description: 'Nous Hermes 3 Llama 3.1 405B, via OpenRouter',
    maxTokens: 8192,
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'openrouter'
  },
  {
    id: 'openai/gpt-oss-120b:free',
    name: 'GPT-OSS 120B (Free)',
    description: 'OpenAI OSS 120B model, via OpenRouter',
    maxTokens: 8192,
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'openrouter'
  },
  {
    id: 'z-ai/glm-4.5-air:free',
    name: 'GLM 4.5 Air (Free)',
    description: 'Z.ai GLM 4.5 Air, via OpenRouter',
    maxTokens: 4096,
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'openrouter'
  },
  {
    id: 'liquid/lfm-2.5-1.2b-instruct:free',
    name: 'LFM 2.5 1.2B (Free)',
    description: 'Liquid LFM 2.5 1.2B Instruct, via OpenRouter',
    maxTokens: 2048,
    contextWindow: 8192,
    supportsTools: false,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'openrouter'
  },
  {
    id: 'upstage/solar-pro-3:free',
    name: 'Solar Pro 3 (Free)',
    description: 'Upstage Solar Pro 3, via OpenRouter',
    maxTokens: 4096,
    contextWindow: 32768,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'openrouter'
  },
  {
    id: 'moonshotai/kimi-k2.5',
    name: 'Kimi K2.5 (NVIDIA)',
    description: 'Moonshot Kimi K2.5 - Advanced reasoning, via NVIDIA NIM',
    maxTokens: 16384,
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'nvidia'
  },
  {
    id: 'deepseek-ai/deepseek-r1',
    name: 'DeepSeek R1 (NVIDIA)',
    description: 'DeepSeek R1 reasoning model, via NVIDIA NIM',
    maxTokens: 16384,
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'nvidia'
  },
  {
    id: 'meta/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B (NVIDIA)',
    description: 'Meta Llama 3.3 70B Instruct, via NVIDIA NIM',
    maxTokens: 16384,
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'nvidia'
  },
  {
    id: 'meta/llama-3.1-405b-instruct',
    name: 'Llama 3.1 405B (NVIDIA)',
    description: 'Meta Llama 3.1 405B Instruct, via NVIDIA NIM',
    maxTokens: 16384,
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'nvidia'
  },
  {
    id: 'meta/llama-3.1-8b-instruct',
    name: 'Llama 3.1 8B (NVIDIA)',
    description: 'Meta Llama 3.1 8B Instruct, via NVIDIA NIM',
    maxTokens: 16384,
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'nvidia'
  },
  {
    id: 'mistralai/mistral-large',
    name: 'Mistral Large (NVIDIA)',
    description: 'Mistral Large model, via NVIDIA NIM',
    maxTokens: 16384,
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'nvidia'
  },
  {
    id: 'mistralai/codestral-22b',
    name: 'Codestral 22B (NVIDIA)',
    description: 'Mistral Codestral - Code generation, via NVIDIA NIM',
    maxTokens: 16384,
    contextWindow: 32768,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'nvidia'
  },
  {
    id: 'mistralai/mathstral-7b-v0.1',
    name: 'Mathstral 7B (NVIDIA)',
    description: 'Mistral Mathstral - Math reasoning, via NVIDIA NIM',
    maxTokens: 16384,
    contextWindow: 32768,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'nvidia'
  },
  {
    id: 'nvidia/llama-3.1-nemotron-70b-ultra',
    name: 'Nemotron 70B Ultra (NVIDIA)',
    description: 'NVIDIA Nemotron 70B Ultra, via NVIDIA NIM',
    maxTokens: 16384,
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'nvidia'
  },
  {
    id: 'nvidia/llama-3.1-nemotron-51b-instruct',
    name: 'Nemotron 51B (NVIDIA)',
    description: 'NVIDIA Nemotron 51B Instruct, via NVIDIA NIM',
    maxTokens: 16384,
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'nvidia'
  },
  {
    id: 'google/gemma-2-27b-it',
    name: 'Gemma 2 27B (NVIDIA)',
    description: 'Google Gemma 2 27B Instruct, via NVIDIA NIM',
    maxTokens: 8192,
    contextWindow: 8192,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'nvidia'
  },
  {
    id: 'google/gemma-2-9b-it',
    name: 'Gemma 2 9B (NVIDIA)',
    description: 'Google Gemma 2 9B Instruct, via NVIDIA NIM',
    maxTokens: 8192,
    contextWindow: 8192,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'nvidia'
  },
  {
    id: 'google/gemma-2-2b-it',
    name: 'Gemma 2 2B (NVIDIA)',
    description: 'Google Gemma 2 2B Instruct, via NVIDIA NIM',
    maxTokens: 8192,
    contextWindow: 8192,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'nvidia'
  },
  {
    id: 'qwen/qwen2.5-72b-instruct',
    name: 'Qwen 2.5 72B (NVIDIA)',
    description: 'Alibaba Qwen 2.5 72B Instruct, via NVIDIA NIM',
    maxTokens: 16384,
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'nvidia'
  },
  {
    id: 'qwen/qwen2.5-math-72b-instruct',
    name: 'Qwen 2.5 Math 72B (NVIDIA)',
    description: 'Qwen 2.5 Math 72B - Math reasoning, via NVIDIA NIM',
    maxTokens: 16384,
    contextWindow: 4096,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'nvidia'
  },
  {
    id: 'qwen/qwen2.5-coder-32b-instruct',
    name: 'Qwen 2.5 Coder 32B (NVIDIA)',
    description: 'Qwen 2.5 Coder - Code generation, via NVIDIA NIM',
    maxTokens: 16384,
    contextWindow: 32768,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'nvidia'
  },
  {
    id: 'microsoft/phi-3-medium-128k-instruct',
    name: 'Phi-3 Medium 128K (NVIDIA)',
    description: 'Microsoft Phi-3 Medium 128K context, via NVIDIA NIM',
    maxTokens: 8192,
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'nvidia'
  },
  {
    id: 'microsoft/phi-3-mini-128k-instruct',
    name: 'Phi-3 Mini 128K (NVIDIA)',
    description: 'Microsoft Phi-3 Mini 128K context, via NVIDIA NIM',
    maxTokens: 4096,
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'nvidia'
  },
  {
    id: 'snowflake/arctic',
    name: 'Arctic (NVIDIA)',
    description: 'Snowflake Arctic - Enterprise LLM, via NVIDIA NIM',
    maxTokens: 4096,
    contextWindow: 4096,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'nvidia'
  },
  {
    id: 'upstage/solar-10.7b-instruct',
    name: 'Solar 10.7B (NVIDIA)',
    description: 'Upstage Solar 10.7B Instruct, via NVIDIA NIM',
    maxTokens: 4096,
    contextWindow: 4096,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'nvidia'
  },
  {
    id: 'llama3.2:latest',
    name: 'Llama 3.2 (Ollama)',
    description: 'Meta Llama 3.2 - Local via Ollama',
    maxTokens: 8192,
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: true,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'ollama'
  },
  {
    id: 'llama3.2:1b',
    name: 'Llama 3.2 1B (Ollama)',
    description: 'Meta Llama 3.2 1B - Lightweight, via Ollama',
    maxTokens: 4096,
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'ollama'
  },
  {
    id: 'llama3.2:3b',
    name: 'Llama 3.2 3B (Ollama)',
    description: 'Meta Llama 3.2 3B - Compact, via Ollama',
    maxTokens: 4096,
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'ollama'
  },
  {
    id: 'llama3.3:latest',
    name: 'Llama 3.3 70B (Ollama)',
    description: 'Meta Llama 3.3 70B - Full size, via Ollama',
    maxTokens: 8192,
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'ollama'
  },
  {
    id: 'llama3.1:8b',
    name: 'Llama 3.1 8B (Ollama)',
    description: 'Meta Llama 3.1 8B - Balanced, via Ollama',
    maxTokens: 8192,
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'ollama'
  },
  {
    id: 'llama3.1:70b',
    name: 'Llama 3.1 70B (Ollama)',
    description: 'Meta Llama 3.1 70B - Large, via Ollama',
    maxTokens: 8192,
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'ollama'
  },
  {
    id: 'mistral:latest',
    name: 'Mistral (Ollama)',
    description: 'Mistral 7B - Fast and efficient, via Ollama',
    maxTokens: 8192,
    contextWindow: 32768,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'ollama'
  },
  {
    id: 'mistral-nemo:latest',
    name: 'Mistral NeMo (Ollama)',
    description: 'Mistral NeMo 12B - via Ollama',
    maxTokens: 8192,
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'ollama'
  },
  {
    id: 'codellama:latest',
    name: 'Code Llama (Ollama)',
    description: 'Meta Code Llama - Code generation, via Ollama',
    maxTokens: 8192,
    contextWindow: 16384,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'ollama'
  },
  {
    id: 'deepseek-coder:latest',
    name: 'DeepSeek Coder (Ollama)',
    description: 'DeepSeek Coder - Code generation, via Ollama',
    maxTokens: 8192,
    contextWindow: 16384,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'ollama'
  },
  {
    id: 'deepseek-r1:latest',
    name: 'DeepSeek R1 (Ollama)',
    description: 'DeepSeek R1 - Reasoning model, via Ollama',
    maxTokens: 16384,
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'ollama'
  },
  {
    id: 'qwen2.5:latest',
    name: 'Qwen 2.5 (Ollama)',
    description: 'Alibaba Qwen 2.5 - General purpose, via Ollama',
    maxTokens: 8192,
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'ollama'
  },
  {
    id: 'qwen2.5-coder:latest',
    name: 'Qwen 2.5 Coder (Ollama)',
    description: 'Qwen 2.5 Coder - Code generation, via Ollama',
    maxTokens: 8192,
    contextWindow: 32768,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'ollama'
  },
  {
    id: 'gemma2:latest',
    name: 'Gemma 2 (Ollama)',
    description: 'Google Gemma 2 - via Ollama',
    maxTokens: 8192,
    contextWindow: 8192,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'ollama'
  },
  {
    id: 'gemma3:latest',
    name: 'Gemma 3 (Ollama)',
    description: 'Google Gemma 3 - Latest, via Ollama',
    maxTokens: 8192,
    contextWindow: 32768,
    supportsTools: true,
    supportsVision: true,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'ollama'
  },
  {
    id: 'phi3:latest',
    name: 'Phi-3 (Ollama)',
    description: 'Microsoft Phi-3 Mini - Compact, via Ollama',
    maxTokens: 4096,
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'ollama'
  },
  {
    id: 'phi3.5:latest',
    name: 'Phi-3.5 (Ollama)',
    description: 'Microsoft Phi-3.5 - Latest compact, via Ollama',
    maxTokens: 4096,
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'ollama'
  },
  {
    id: 'cogito:latest',
    name: 'Cogito (Ollama)',
    description: 'Cogito - Reasoning model, via Ollama',
    maxTokens: 8192,
    contextWindow: 32768,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'ollama'
  },
  {
    id: 'minimax-m2.5:cloud',
    name: 'Minimax M2.5 (Ollama Cloud)',
    description: 'Minimax M2.5 - Cloud via Ollama',
    maxTokens: 16384,
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'ollama'
  },
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B (Groq)',
    description: 'Llama 3.3 70B via Groq - ultra fast inference',
    maxTokens: 8192,
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'groq'
  },
  {
    id: 'llama-3.1-8b-instant',
    name: 'Llama 3.1 8B (Groq)',
    description: 'Llama 3.1 8B via Groq - ultra fast inference',
    maxTokens: 8192,
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'groq'
  },
  {
    id: 'llama-4-maverick-17b-128e-instruct',
    name: 'Llama 4 Maverick (Groq)',
    description: 'Llama 4 Maverick 17B via Groq',
    maxTokens: 8192,
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'groq'
  },
  {
    id: 'llama-4-scout-17b-16e-instruct',
    name: 'Llama 4 Scout (Groq)',
    description: 'Llama 4 Scout 17B via Groq',
    maxTokens: 8192,
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'groq'
  },
  {
    id: 'mixtral-8x7b-32768',
    name: 'Mixtral 8x7B (Groq)',
    description: 'Mixtral 8x7B via Groq - ultra fast inference',
    maxTokens: 8192,
    contextWindow: 32768,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'groq'
  },
  {
    id: 'gemma2-9b-it',
    name: 'Gemma 2 9B (Groq)',
    description: 'Google Gemma 2 9B via Groq',
    maxTokens: 8192,
    contextWindow: 8192,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'groq'
  },
  {
    id: 'qwen/qwen3-32b',
    name: 'Qwen 3 32B (Groq)',
    description: 'Alibaba Qwen 3 32B via Groq',
    maxTokens: 8192,
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'groq'
  },
  {
    id: 'moonshotai/kimi-k2-instruct',
    name: 'Kimi K2 (Groq)',
    description: 'Moonshot Kimi K2 Instruct via Groq',
    maxTokens: 8192,
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'groq'
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    description: 'Google Gemini 2.0 Flash - 1M context (Google AI Studio)',
    maxTokens: 8192,
    contextWindow: 1000000,
    supportsTools: true,
    supportsVision: true,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'google'
  },
  {
    id: 'gemini-2.5-flash-preview-05-20',
    name: 'Gemini 2.5 Flash Preview',
    description: 'Google Gemini 2.5 Flash Preview (Google AI Studio)',
    maxTokens: 8192,
    contextWindow: 1000000,
    supportsTools: true,
    supportsVision: true,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'google'
  },
  {
    id: 'gemini-2.5-pro-preview-05-06',
    name: 'Gemini 2.5 Pro Preview',
    description: 'Google Gemini 2.5 Pro Preview (Google AI Studio)',
    maxTokens: 8192,
    contextWindow: 1000000,
    supportsTools: true,
    supportsVision: true,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'google'
  },
  {
    id: 'llama-3.3-70b',
    name: 'Llama 3.3 70B (Cerebras)',
    description: 'Llama 3.3 70B via Cerebras - ultra fast',
    maxTokens: 8192,
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'cerebras'
  },
  {
    id: 'llama3.1-8b',
    name: 'Llama 3.1 8B (Cerebras)',
    description: 'Llama 3.1 8B via Cerebras - ultra fast',
    maxTokens: 8192,
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'cerebras'
  },
  {
    id: 'qwen-3-235b-a22b-instruct',
    name: 'Qwen 3 235B (Cerebras)',
    description: 'Qwen 3 235B A22B Instruct via Cerebras',
    maxTokens: 8192,
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: false,
    pricing: { input: 0, output: 0 },
    isFree: true,
    backend: 'cerebras'
  }
];

export class FreeModelsProvider {
  private client: OpenAI | null = null;
  private config: ProviderConfig;
  private activeBackend: string = 'openrouter';
  private apiKeys: Record<string, string> = {};

  constructor(config: ProviderConfig = {}) {
    this.config = config;
    this.loadApiKeys();
    this.initializeClient();
  }

  private loadApiKeys(): void {
    this.apiKeys = {
      openrouter: this.config.apiKey || process.env.OPENROUTER_API_KEY || '',
      ollama: process.env.OLLAMA_API_KEY || '',
      nvidia: process.env.NVIDIA_API_KEY || '',
      groq: process.env.GROQ_API_KEY || '',
      google: process.env.GOOGLE_API_KEY || '',
      cerebras: process.env.CEREBRAS_API_KEY || '',
      cloudflare: process.env.CLOUDFLARE_API_KEY || '',
    };
  }

  setApiKey(backend: string, apiKey: string): void {
    this.apiKeys[backend] = apiKey;
    if (this.activeBackend === backend) {
      this.initializeClient();
    }
  }

  getApiKey(backend: string): string {
    return this.apiKeys[backend] || '';
  }

  private initializeClient(): void {
    const backendConfig = FREE_MODEL_CONFIGS[this.activeBackend];
    const baseUrl = this.config.baseUrl || backendConfig?.baseUrl || FREE_MODEL_CONFIGS.openrouter.baseUrl;
    
    let apiKey = this.config.apiKey || this.apiKeys[this.activeBackend] || '';

    const headers: Record<string, string> = {
      ...(this.config.customHeaders || {})
    };

    if (this.activeBackend === 'openrouter') {
      headers['HTTP-Referer'] = 'https://codex-linux.app';
      headers['X-Title'] = 'Codex Linux';
    }

    this.client = new OpenAI({
      apiKey: apiKey || 'sk-dummy-key',
      baseURL: baseUrl,
      timeout: this.config.timeout || 60000,
      maxRetries: this.config.maxRetries || 3,
      defaultHeaders: headers
    });
  }

  setBackend(backend: string, apiKey?: string): void {
    const backendConfig = FREE_MODEL_CONFIGS[backend];
    if (!backendConfig) {
      throw new Error(`Unknown backend: ${backend}`);
    }

    this.activeBackend = backend;
    if (apiKey) {
      this.apiKeys[backend] = apiKey;
    }
    this.config.baseUrl = backendConfig.baseUrl;
    this.config.apiKey = this.apiKeys[backend] || '';
    this.initializeClient();
  }

  async sendMessage(
    model: string,
    messages: Array<{ role: string; content: string }>,
    options?: {
      signal?: AbortSignal;
      onProgress?: (progress: number) => void;
      extendedThinking?: boolean;
      reasoningEffort?: 'low' | 'medium' | 'high';
    }
  ): Promise<{ content: string; metadata?: Record<string, any> }> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    const openaiMessages = messages.map(m => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content
    }));

    const requestParams: any = {
      model,
      messages: openaiMessages,
      stream: false
    };

    const isNvidiaBackend = this.activeBackend === 'nvidia';
    const supportsThinking = model.includes('kimi-k2') || model.includes('deepseek-r1');
    
    if (options?.extendedThinking) {
      if (isNvidiaBackend && supportsThinking) {
        requestParams.chat_template_kwargs = { thinking: true };
      } else if (model.includes('deepseek-r1') || model.includes('qwq')) {
        requestParams.reasoning_effort = options.reasoningEffort || 'medium';
      }
    }

    if (isNvidiaBackend) {
      requestParams.max_tokens = requestParams.max_tokens || 16384;
      requestParams.temperature = 1.0;
      requestParams.top_p = 1.0;
    }

    try {
      const response = await this.client.chat.completions.create(requestParams, {
        signal: options?.signal
      });

      const content = response.choices[0]?.message?.content || '';
      const reasoning = (response.choices[0]?.message as any)?.reasoning_content;

      return {
        content,
        metadata: {
          model: response.model,
          usage: response.usage,
          finishReason: response.choices[0]?.finish_reason,
          reasoning: reasoning || null,
          extendedThinking: options?.extendedThinking || false,
          reasoningEffort: options?.reasoningEffort,
          backend: this.activeBackend
        }
      };
    } catch (error: any) {
      log.error('FreeModelsProvider sendMessage error:', error);
      throw error;
    }
  }

  async sendMessageStream(
    model: string,
    messages: Array<{ role: string; content: string }>,
    callbacks?: {
      onChunk?: (chunk: string) => void;
      onComplete?: () => void;
      onError?: (error: Error) => void;
    }
  ): Promise<{ content: string }> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    const openaiMessages = messages.map(m => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content
    }));

    let fullContent = '';

    try {
      const stream = await this.client.chat.completions.create({
        model,
        messages: openaiMessages,
        stream: true
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullContent += content;
          callbacks?.onChunk?.(content);
        }
      }

      callbacks?.onComplete?.();
      return { content: fullContent };
    } catch (error: any) {
      callbacks?.onError?.(error);
      throw error;
    }
  }

  listModels(): ProviderModel[] {
    return FREE_MODELS;
  }

  async fetchOllamaModels(): Promise<ProviderModel[]> {
    const ollamaUrl = this.config.baseUrl?.replace('/v1', '') || 'http://localhost:11434';
    const headers: Record<string, string> = {};
    if (this.apiKeys.ollama) {
      headers['Authorization'] = `Bearer ${this.apiKeys.ollama}`;
    }

    try {
      const response = await fetch(`${ollamaUrl}/api/tags`, {
        headers,
        signal: AbortSignal.timeout(5000)
      });
      
      if (!response.ok) {
        return [];
      }

      const data = await response.json() as { models: Array<{ name: string; details?: any }> };
      
      return (data.models || []).map(model => ({
        id: model.name,
        name: `${model.name} (Ollama Local)`,
        description: `Local Ollama model: ${model.name}`,
        maxTokens: 8192,
        contextWindow: 32768,
        supportsTools: true,
        supportsVision: false,
        pricing: { input: 0, output: 0 },
        isFree: true,
        backend: 'ollama'
      }));
    } catch (error) {
      log.warn('Failed to fetch Ollama models:', error);
      return [];
    }
  }

  getBackends(): { id: string; name: string; requiresApiKey: boolean; description: string }[] {
    return Object.entries(FREE_MODEL_CONFIGS).map(([id, config]) => ({
      id,
      name: config.provider,
      requiresApiKey: config.requiresApiKey,
      description: config.description
    }));
  }

  async testConnection(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    const testModels: Record<string, string> = {
      openrouter: 'meta-llama/llama-3.3-70b-instruct:free',
      ollama: 'llama3.2:latest',
      nvidia: 'meta/llama-3.3-70b-instruct',
      groq: 'llama-3.1-8b-instant',
      google: 'gemini-2.0-flash',
      cerebras: 'llama-3.3-70b',
      cloudflare: '@cf/meta/llama-3.1-8b-instruct'
    };

    try {
      const testModel = testModels[this.activeBackend] || 'meta-llama/llama-3.3-70b-instruct:free';
      const response = await this.client.chat.completions.create({
        model: testModel,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1
      });
      return true;
    } catch (error: any) {
      log.warn('FreeModelsProvider connection test failed:', error.message);
      return error.status !== 401;
    }
  }
}

export { FREE_MODELS, FREE_MODEL_CONFIGS };
