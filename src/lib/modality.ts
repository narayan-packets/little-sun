export type ModelModality = 'chat' | 'vision' | 'audio' | 'multimodal' | 'image_gen';

export interface ModelCapabilityInfo {
  modality: ModelModality;
  supportsChat: boolean;
  supportsImages: boolean;
  supportsAudio: boolean;
  hint?: string;
}

/**
 * Inspects a model ID and name to determine supported modalities
 * (Vision LLM, Audio LLM, Full Multimodal, Standard Chat LLM, or Image Generation).
 */
export function getModelModalityInfo(modelId: string, modelName?: string): ModelCapabilityInfo {
  const m = `${modelId} ${modelName || ''}`.toLowerCase();

  // 1. Image Generation Models (Diffusion, Flux, DALL-E, Midjourney)
  if (
    m.includes('diffusion') ||
    m.includes('flux') ||
    m.includes('dall-e') ||
    m.includes('midjourney')
  ) {
    return {
      modality: 'image_gen',
      supportsChat: true,
      supportsImages: false,
      supportsAudio: false,
      hint: 'Generative Visual Model · Enter a descriptive prompt to synthesize imagery.',
    };
  }

  // 2. Audio Capabilities Check
  const isAudioCapable =
    m.includes('audio') ||
    m.includes('whisper') ||
    m.includes('speech') ||
    m.includes('voice') ||
    m.includes('omni') ||
    m.includes('gemma-4') ||
    m.includes('gemma4') ||
    m.includes('gemini-2') ||
    m.includes('gemini-1.5') ||
    m.includes('gpt-4o-audio') ||
    m.includes('ultravox') ||
    m.includes('qwen-omni') ||
    m.includes('qwen-audio') ||
    m.includes('qwen2-audio') ||
    m.includes('qwenaudio');

  // 3. Vision Capabilities Check
  const isVisionCapable =
    m.includes('vision') ||
    m.includes('-vl') ||
    m.includes('vl-') ||
    m.includes('qwenvl') ||
    m.includes('qwen-vl') ||
    m.includes('qwen2-vl') ||
    m.includes('qwen2.5-vl') ||
    (m.includes('vl') && (m.includes('qwen') || m.includes('gemma'))) ||
    m.includes('gpt-4o') ||
    m.includes('claude-3') ||
    m.includes('gemini') ||
    m.includes('gemma-4') ||
    m.includes('gemma4') ||
    m.includes('gemma-3') ||
    m.includes('gemma3') ||
    m.includes('moondream') ||
    m.includes('llava') ||
    m.includes('minicpm') ||
    m.includes('pixtral') ||
    m.includes('omni') ||
    m.includes('grok-2-vision');

  // 4. Full Multimodal (Both Vision and Audio)
  if (isVisionCapable && isAudioCapable) {
    return {
      modality: 'multimodal',
      supportsChat: true,
      supportsImages: true,
      supportsAudio: true,
      hint: 'Multimodal Model · Supports text documents, visual inspection, and audio processing.',
    };
  }

  // 5. Vision-Only Multimodal
  if (isVisionCapable) {
    return {
      modality: 'vision',
      supportsChat: true,
      supportsImages: true,
      supportsAudio: false,
      hint: 'Multimodal Vision Model · Capable of visual inspection and image analysis.',
    };
  }

  // 6. Audio-Capable Model
  if (isAudioCapable) {
    return {
      modality: 'audio',
      supportsChat: true,
      supportsImages: false,
      supportsAudio: true,
      hint: 'Audio Multimodal Model · Capable of speech transcription and audio understanding.',
    };
  }

  // 7. Default Text-Only LLMs (Llama, DeepSeek, Mistral, standard Qwen text)
  return {
    modality: 'chat',
    supportsChat: true,
    supportsImages: false,
    supportsAudio: false,
  };
}
