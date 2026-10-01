import { runOpenAiCompatibleCompletion } from './openaiCompatibleClient';
import type { ChatMessage } from './types';

// Mainland China providers, all on the OpenAI-compatible shape. The only AI
// offered on the China App Store, where unlicensed foreign models are not.
const run = (vendorName: string, endpoint: string, model: string) => (apiKey: string, messages: ChatMessage[]) =>
  runOpenAiCompatibleCompletion({ vendorName, endpoint, model }, apiKey, messages);

export const runQwen = run('Qwen', 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', 'qwen-plus');
export const runKimi = run('Kimi', 'https://api.moonshot.cn/v1/chat/completions', 'moonshot-v1-8k');
export const runGlm = run('GLM', 'https://open.bigmodel.cn/api/paas/v4/chat/completions', 'glm-4-flash');
export const runErnie = run('ERNIE', 'https://qianfan.baidubce.com/v2/chat/completions', 'ernie-4.0-turbo-8k');

// Any OpenAI-compatible server: a base URL ("…/v1") or the full
// chat/completions URL both work.
export function runCustom(endpoint: string, model: string, label: string) {
  const url = /\/chat\/completions\/?$/.test(endpoint) ? endpoint : `${endpoint.replace(/\/+$/, '')}/chat/completions`;
  return run(label, url, model);
}
