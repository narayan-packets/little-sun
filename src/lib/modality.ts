export type ModelModality = 'chat' | 'vision' | 'image_gen';

export interface ModelCapabilityInfo {
  modality: ModelModality;
  supportsChat: boolean;
  supportsImages: boolean;
  hint?: string;
}

/**
 * Inspects a model ID and name to determine supported modalities
 * (Vision LLM, Standard Chat LLM, or Image Generation).
 */
export function getModelModalityInfo(modelId: string, modelName?: string): ModelCapabilityInfo {
  const m = `${modelId} ${modelName || ''}`.toLowerCase();

  // 1. Image Generation Models (Diffusion, Flux, DALL-E)
  if (m.includes('diffusion') || m.includes('flux') || m.includes('dall-e') || m.includes('midjourney')) {
    return {
      modality: 'image_gen',
      supportsChat: true,
      supportsImages: false,
      hint: 'Generative Visual Model · Enter a descriptive prompt to synthesize imagery.',
    };
  }

  // 2. Vision Multimodal Models (Text + Images)
  if (
    m.includes('vision') ||
    m.includes('-vl') ||
    m.includes('gpt-4o') ||
    m.includes('moondream') ||
    m.includes('llava') ||
    m.includes('minicpm') ||
    m.includes('claude-3')
  ) {
    return {
      modality: 'vision',
      supportsChat: true,
      supportsImages: true,
      hint: 'Multimodal Vision Model · Capable of visual inspection and image analysis.',
    };
  }

  // 3. Default Text-Only LLMs (Llama, DeepSeek, Mistral, Qwen)
  return {
    modality: 'chat',
    supportsChat: true,
    supportsImages: false,
  };
}
