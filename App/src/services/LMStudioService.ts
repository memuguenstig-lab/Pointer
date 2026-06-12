import { cleanAIResponse } from '../utils/textUtils';
import { Message } from '../types';
import { AIFileService } from './AIFileService';
import { ToolService } from './ToolService';
import llamaService from './LlamaService';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionOptions {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number | null;
  stream?: boolean;
  onStream?: (content: string) => void;
}

interface ChatCompletionResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

interface StreamingChatCompletionOptions {
  model: string;
  messages: Message[];
  temperature?: number;
  max_tokens?: number | null;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  tools?: any[]; // Tool definitions array
  tool_choice?: string | object; // Tool choice parameter
  purpose?: 'chat' | 'insert' | 'autocompletion' | 'summary' | 'agent'; // Add purpose parameter
  signal?: AbortSignal; // Add signal for request cancellation
  onUpdate: (content: string) => void;
}

interface CompletionOptions {
  model: string;
  prompt: string;
  temperature?: number;
  max_tokens?: number | null;
  stop?: string[];
  suffix?: string;
  purpose?: 'chat' | 'insert' | 'autocompletion' | 'summary';
}

interface CompletionResponse {
  choices: {
    text: string;
    index: number;
    finish_reason: string;
  }[];
}

class LMStudioService {
  // Gets the full API endpoint for a specific purpose
  private lastToolCallExtraction: number = 0; // Track the last time we extracted a tool call
  
  private detectFunctionCallInContent(content: string): any {
    // Try to parse function calls from the content
    const functionCallMatch = content.match(/function_call:\s*({.*})/);
    if (functionCallMatch) {
      try {
        return JSON.parse(functionCallMatch[1]);
      } catch (e) {
        return null;
      }
    }
    return null;
  }
  
  private async getApiEndpoint(purpose: 'chat' | 'insert' | 'autocompletion' | 'summary' | 'agent'): Promise<string> {
    try {
      const modelConfig = await AIFileService.getModelConfigForPurpose(purpose);
      if (!modelConfig.apiEndpoint) {
        throw new Error(`No API endpoint configured for purpose: ${purpose}`);
      }
      
      let apiEndpoint = modelConfig.apiEndpoint;
      
      // Format the endpoint URL correctly
      if (!apiEndpoint.endsWith('/v1')) {
        apiEndpoint = apiEndpoint.endsWith('/') 
          ? `${apiEndpoint}v1` 
          : `${apiEndpoint}/v1`;
      }
      
      console.log(`Using API endpoint for ${purpose}: ${apiEndpoint}`);
      return apiEndpoint;
    } catch (error) {
      console.error(`Error getting API endpoint for ${purpose}:`, error);
      throw new Error(`Failed to get API endpoint for ${purpose}: ${error}`);
    }
  }

  async createChatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResponse> {
    const { onStream, ...requestOptions } = options;
    const purpose = 'chat';
    
    try {
      // Get full model configuration including fallbacks
      const modelConfig = await AIFileService.getModelConfigForPurpose(purpose);

      // ── Embedded LLM ───────────────────────────────────────────────────
      if (modelConfig.modelProvider === 'ollama-embedded') {
        // On mobile: use WebLLM (runs in-browser via WebGPU/WASM)
        // On desktop: use node-llama-cpp via backend
        const { IS_MOBILE } = await import('../platform/usePlatform');
        if (IS_MOBILE) {
          const { mobileLLM } = await import('../platform/mobileLLM');
          if (!mobileLLM.isLoaded()) throw new Error('No local model loaded. Go to Settings → Models to load one.');
          let full = '';
          await mobileLLM.chat(options.messages as any, {
            temperature: options.temperature ?? 0.7,
            maxTokens: options.max_tokens ?? undefined,
            onChunk: (token) => { full += token; onStream?.(full); },
          });
          return { choices: [{ message: { content: cleanAIResponse(full) } }] };
        }
        // Desktop: node-llama-cpp via backend
        let full = '';
        await llamaService.chat(options.messages as any, {
          temperature: options.temperature ?? 0.7,
          max_tokens: options.max_tokens ?? undefined,
          onChunk: (token) => { full += token; onStream?.(full); },
        });
        return { choices: [{ message: { content: cleanAIResponse(full) } }] };
      }
      // ───────────────────────────────────────────────────────────────────
      console.log(`Attempting to connect to API at: ${modelConfig.apiEndpoint}`);

      // Use fallback endpoints if available
      const endpointsToTry = modelConfig.fallbackEndpoints || [modelConfig.apiEndpoint];
      let lastError: Error | null = null;
      
      for (const baseEndpoint of endpointsToTry) {
        try {
          // Format the endpoint URL correctly
          let baseUrl = baseEndpoint;
          if (!baseUrl.endsWith('/v1')) {
            baseUrl = baseUrl.endsWith('/') 
              ? `${baseUrl}v1` 
              : `${baseUrl}/v1`;
          }

          console.log(`Trying endpoint: ${baseUrl}`);
          const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(modelConfig.apiKey && { 'Authorization': `Bearer ${modelConfig.apiKey}` })
            },
            body: JSON.stringify({
              ...requestOptions,
              temperature: options.temperature ?? 0.7,
              ...(options.max_tokens !== null && options.max_tokens !== undefined && options.max_tokens > 0 ? { max_tokens: options.max_tokens } : {}),
              stream: true
            })
          });

          if (!response.ok) {
            const text = await response.text();
            throw new Error(`LM Studio API error (${response.status}): ${text}`);
          }

          if (!response.body) {
            throw new Error('No response body');
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let fullContent = '';

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value);
              const lines = chunk.split('\n');

              for (const line of lines) {
                if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                  try {
                    const data = JSON.parse(line.slice(6));
                    const newContent = data.choices[0]?.delta?.content || '';
                    fullContent += newContent;
                    onStream?.(fullContent);
                    // Capture usage if present (some providers send it in the last chunk)
                    if (data.usage) {
                      const { TokenUsageService } = await import('./TokenUsageService');
                      TokenUsageService.emit({
                        promptTokens: data.usage.prompt_tokens ?? 0,
                        completionTokens: data.usage.completion_tokens ?? 0,
                        totalTokens: data.usage.total_tokens ?? 0,
                        model: data.model,
                        timestamp: Date.now(),
                      });
                    }
                  } catch (e) {
                    console.warn('Failed to parse streaming response:', e);
                  }
                }
              }
            }
          } finally {
            reader.releaseLock();
          }

          // Clean up any markdown code blocks in the response before returning
          const cleanedContent = cleanAIResponse(fullContent);

          return {
            choices: [{
              message: {
                content: cleanedContent
              }
            }]
          };
        } catch (error) {
          console.error(`Error with endpoint ${baseEndpoint}:`, error);
          lastError = error as Error;
          // Continue to next endpoint
        }
      }
      
      // If we've tried all endpoints and none worked, throw the last error
      if (lastError) {
        throw lastError;
      } else {
        throw new Error('All endpoints failed but no error was captured');
      }
    } catch (error) {
      console.error('Error in createChatCompletion:', error);
      throw error;
    }
  }

  async createStreamingChatCompletion(options: StreamingChatCompletionOptions): Promise<void> {
    const {
      model,
      messages,
      temperature = 0.7,
      max_tokens = null,
      top_p = 1,
      frequency_penalty = 0,
      presence_penalty = 0,
      tools,
      tool_choice,
      purpose = 'chat', // Default to 'chat' if not provided
      signal, // Extract the abort signal
      onUpdate
    } = options;
    
    // Create a wrapper for onUpdate that will detect and parse function calls
    const onUpdateWithFunctionCallDetection = (content: string) => {
      // Try to detect function calls in the content
      const detectedFunctionCall = this.detectFunctionCallInContent(content);
      if (detectedFunctionCall) {
        console.log('Detected function call in content update:', detectedFunctionCall);
        
        // Create a properly formatted function call
        let functionName = detectedFunctionCall.name;
        let functionArgs = detectedFunctionCall.arguments;
        
        // Fix common tool name issues (e.g., list_dir vs list_directory)
        if (functionName === 'list_dir') {
          functionName = 'list_directory';
        }
        
        // Make sure arguments is a proper JSON string
        if (typeof functionArgs === 'string') {
          try {
            // If it's already a valid JSON string, parse and stringify it to ensure proper format
            const parsedArgs = JSON.parse(functionArgs);
            functionArgs = JSON.stringify(parsedArgs);
          } catch (e) {
            // If it's not valid JSON, try to fix it
            console.warn('Invalid JSON arguments:', functionArgs);
            functionArgs = '{}';
          }
        } else if (typeof functionArgs === 'object') {
          functionArgs = JSON.stringify(functionArgs);
        } else {
          functionArgs = '{}';
        }
        
        // Create the formatted function call string
        const formattedFunctionCall = `function_call: {"id":"tool-${Date.now()}","name":"${functionName}","arguments":${functionArgs}}`;
        
        // Update the content with the formatted function call
        const contentWithFormattedCall = content.replace(/function_call\s*:\s*{[\s\S]*?}\s*$/, '').trim() + '\n\n' + formattedFunctionCall;
        
        // Call onUpdate with the new content
        onUpdate(contentWithFormattedCall);
        return;
      }
      
      // If no function call detected, just call the original onUpdate
      onUpdate(content);
    };
    
    try {
      // Get the endpoint based on provided purpose
      const modelConfig = await AIFileService.getModelConfigForPurpose(purpose);
      console.log(`Attempting to connect to API at: ${modelConfig.apiEndpoint} for purpose: ${purpose}`);

      if (!messages || messages.length === 0) {
        throw new Error('Messages array is required and cannot be empty');
      }

      // -- Embedded LLM ---------------------------------------------------
      if (modelConfig.modelProvider === 'ollama-embedded') {
        const { IS_MOBILE } = await import('../platform/usePlatform');
        if (IS_MOBILE) {
          const { mobileLLM } = await import('../platform/mobileLLM');
          if (!mobileLLM.isLoaded()) throw new Error('No local model loaded. Go to Settings to load one.');
          let accumulated = '';
          await mobileLLM.chat(messages as any, {
            temperature,
            maxTokens: max_tokens ?? undefined,
            onChunk: (token: string) => {
              accumulated += token;
              onUpdateWithFunctionCallDetection(accumulated);
            },
          });
          return;
        }
        let accumulated = '';
        await llamaService.chat(messages as any, {
          temperature,
          max_tokens: max_tokens ?? undefined,
          signal,
          onChunk: (token: string) => {
            accumulated += token;
            onUpdateWithFunctionCallDetection(accumulated);
          },
        });
        return;
      }
      // -------------------------------------------------------------------
      
      // -- External API (LM Studio, OpenAI-compatible) ----------------------
      console.log(`Attempting to connect to API at: ${modelConfig.apiEndpoint}`);

      // Use fallback endpoints if available
      const endpointsToTry = modelConfig.fallbackEndpoints || [modelConfig.apiEndpoint];
      let lastError: Error | null = null;
      
      for (const baseEndpoint of endpointsToTry) {
        try {
          // Format the endpoint URL correctly
          let baseUrl = baseEndpoint;
          if (!baseUrl.endsWith('/v1')) {
            baseUrl = baseUrl.endsWith('/') 
              ? `${baseUrl}v1` 
              : `${baseUrl}/v1`;
          }

          console.log(`Trying endpoint: ${baseUrl}`);
          const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(modelConfig.apiKey && { 'Authorization': `Bearer ${modelConfig.apiKey}` })
            },
            body: JSON.stringify({
              model,
              messages,
              temperature,
              max_tokens,
              top_p,
              frequency_penalty,
              presence_penalty,
              stream: true,
              ...(tools && { tools }),
              ...(tool_choice && { tool_choice })
            })
          });

          if (!response.ok) {
            const text = await response.text();
            throw new Error(`LM Studio API error (${response.status}): ${text}`);
          }

          if (!response.body) {
            throw new Error('No response body');
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let fullContent = '';

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value);
              const lines = chunk.split('\n');

              for (const line of lines) {
                if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                  try {
                    const data = JSON.parse(line.slice(6));
                    const newContent = data.choices[0]?.delta?.content || '';
                    fullContent += newContent;
                    onUpdateWithFunctionCallDetection(fullContent);
                    // Capture usage if present
                    if (data.usage) {
                      const { TokenUsageService } = await import('./TokenUsageService');
                      TokenUsageService.emit({
                        promptTokens: data.usage.prompt_tokens ?? 0,
                        completionTokens: data.usage.completion_tokens ?? 0,
                        totalTokens: data.usage.total_tokens ?? 0,
                        model: data.model,
                        timestamp: Date.now(),
                      });
                    }
                  } catch (e) {
                    console.warn('Failed to parse streaming response:', e);
                  }
                }
              }
            }
          } finally {
            reader.releaseLock();
          }

          return;
        } catch (error) {
          console.error(`Error with endpoint ${baseEndpoint}:`, error);
          lastError = error as Error;
          // Continue to next endpoint
        }
      }
      
      // If we've tried all endpoints and none worked, throw the last error
      if (lastError) {
        throw lastError;
      } else {
        throw new Error('All endpoints failed but no error was captured');
      }
    } catch (error) {
      console.error('Error in createStreamingChatCompletion:', error);
      throw error;
    }
  }

  async createCompletion(options: CompletionOptions): Promise<CompletionResponse> {
    try {
      const modelConfig = await AIFileService.getModelConfigForPurpose(options.purpose || 'chat');
      
      if (modelConfig.modelProvider === 'ollama-embedded') {
        const { IS_MOBILE } = await import('../platform/usePlatform');
        if (IS_MOBILE) {
          const { mobileLLM } = await import('../platform/mobileLLM');
          if (!mobileLLM.isLoaded()) throw new Error('No local model loaded.');
          let full = '';
          await mobileLLM.chat([{ role: 'user', content: options.prompt }], {
            temperature: options.temperature ?? 0.7,
            maxTokens: options.max_tokens ?? undefined,
            onChunk: (token) => { full += token; },
          });
          return { choices: [{ text: cleanAIResponse(full), index: 0, finish_reason: 'stop' }] };
        }
        let full = '';
        await llamaService.chat([{ role: 'user', content: options.prompt }], {
          temperature: options.temperature ?? 0.7,
          max_tokens: options.max_tokens ?? undefined,
          onChunk: (token) => { full += token; },
        });
        return { choices: [{ text: cleanAIResponse(full), index: 0, finish_reason: 'stop' }] };
      }

      let baseUrl = modelConfig.apiEndpoint;
      if (!baseUrl.endsWith('/v1')) {
        baseUrl = baseUrl.endsWith('/') ? `${baseUrl}v1` : `${baseUrl}/v1`;
      }
      
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(modelConfig.apiKey && { 'Authorization': `Bearer ${modelConfig.apiKey}` })
        },
        body: JSON.stringify({
          model: options.model,
          messages: [{ role: 'user', content: options.prompt }],
          temperature: options.temperature ?? 0.7,
          ...(options.max_tokens !== null && options.max_tokens !== undefined && options.max_tokens > 0 ? { max_tokens: options.max_tokens } : {}),
        })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`API error (${response.status}): ${text}`);
      }

      const data = await response.json();
      const text = data.choices[0]?.message?.content || '';
      return {
        choices: [{
          text: cleanAIResponse(text),
          index: 0,
          finish_reason: 'stop'
        }]
      };
    } catch (error) {
      console.error('Error in createCompletion:', error);
      throw error;
    }
  }
}

const lmStudio = new LMStudioService();
export default lmStudio;
