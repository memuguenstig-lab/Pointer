export interface ModelInfo {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

export interface ModelsResponse {
  object: string;
  data: ModelInfo[];
}

export class ModelDiscoveryService {
  /**
   * Fetches available models from the specified API endpoint
   * @param apiEndpoint The base API endpoint (e.g., http://localhost:1234/v1)
   * @param apiKey Optional API key for authentication
   * @returns Promise<ModelInfo[]> Array of available models
   */
  static async getAvailableModels(apiEndpoint: string, apiKey?: string): Promise<ModelInfo[]> {
    try {
      // Ensure the endpoint ends with /v1
      let baseUrl = apiEndpoint;
      if (!baseUrl.endsWith('/v1')) {
        baseUrl = baseUrl.endsWith('/') 
          ? `${baseUrl}v1` 
          : `${baseUrl}/v1`;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${baseUrl}/models`, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        // Don't throw — just return empty list silently
        console.warn(`Model discovery: endpoint returned ${response.status}`);
        return [];
      }

      const data: ModelsResponse = await response.json();
      return data.data || [];
    } catch (error: any) {
      // Network errors (no server running) are expected — don't propagate
      if (error?.name === 'AbortError') {
        console.warn('Model discovery: request timed out');
      } else {
        console.warn('Model discovery: could not reach endpoint:', error?.message || error);
      }
      return [];
    }
  }

  /**
   * Tests if an API endpoint is reachable and returns models
   * @param apiEndpoint The API endpoint to test
   * @param apiKey Optional API key
   * @returns Promise<boolean> True if endpoint is reachable
   */
  static async testEndpoint(apiEndpoint: string, apiKey?: string): Promise<boolean> {
    try {
      await this.getAvailableModels(apiEndpoint, apiKey);
      return true;
    } catch (error) {
      return false;
    }
  }
}
