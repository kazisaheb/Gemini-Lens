
import { EditingPreset } from './types';

export const EDITING_PRESETS: EditingPreset[] = [
  {
    id: 'restoration',
    label: 'Restoration',
    icon: '✨',
    subPresets: [
      { id: 'hd', label: 'Ultra HD Upscale', prompt: 'Upscale this image to 4K quality, removing all compression artifacts and sharpening edges.' },
      { id: 'denoise', label: 'Remove Noise', prompt: 'Remove digital noise and grain while preserving important textures.' },
      { id: 'scratch', label: 'Fix Scratches', prompt: 'Identify and remove physical scratches, dust, and tears from this old photograph.' },
      { id: 'color-old', label: 'Colorize B&W', prompt: 'Accurately colorize this black and white photo with realistic skin tones and environmental colors.' }
    ]
  },
  {
    id: 'portrait',
    label: 'Portrait Lab',
    icon: '👤',
    subPresets: [
      { id: 'skin', label: 'Silk Skin', prompt: 'Apply professional skin retouching: remove blemishes, even out skin tone, and add a subtle glow.' },
      { id: 'teeth', label: 'Bright Smile', prompt: 'Naturally whiten the teeth and brighten the eyes of the subject.' },
      { id: 'hair-blonde', label: 'Blonde Hair', prompt: 'Change the subject\'s hair color to a natural-looking golden blonde.' },
      { id: 'hair-curly', label: 'Curly Hair', prompt: 'Change the hairstyle to thick, healthy curls while maintaining the face shape.' },
      { id: 'makeup', label: 'Glamour Makeup', prompt: 'Apply a sophisticated evening makeup look with winged eyeliner and matte lipstick.' }
    ]
  },
  {
    id: 'environment',
    label: 'Scene & Sky',
    icon: '🌅',
    subPresets: [
      { id: 'golden', label: 'Golden Hour', prompt: 'Adjust the lighting to simulate the warm, soft glow of the sun just before sunset.' },
      { id: 'winter', label: 'Winter Snow', prompt: 'Add realistic falling snow and a frosty atmosphere to the scene.' },
      { id: 'tropical', label: 'Tropical Beach', prompt: 'Change the background to a pristine white-sand beach with turquoise water.' },
      { id: 'night', label: 'City Night', prompt: 'Transform the scene into a vibrant night shot with blurred city lights in the background.' }
    ]
  },
  {
    id: 'artistic',
    label: 'Artistic Styles',
    icon: '🎨',
    subPresets: [
      { id: 'oil', label: 'Oil Painting', prompt: 'Transform this into a classical oil painting with visible brushstrokes and rich textures.' },
      { id: 'sketch', label: 'Charcoal Sketch', prompt: 'Convert this image into a detailed charcoal and graphite pencil sketch.' },
      { id: 'pop', label: 'Pop Art', prompt: 'Apply a bold Andy Warhol style pop art effect with vibrant contrasting colors.' },
      { id: 'cyber', label: 'Cyberpunk 2077', prompt: 'Infuse the image with neon pink and blue lights, rain-slicked surfaces, and futuristic tech.' },
      { id: 'vapor', label: 'Vaporwave', prompt: 'Apply a 90s vaporwave aesthetic with retro-glitch effects and pastel gradients.' }
    ]
  },
  {
    id: 'lighting',
    label: 'Lighting FX',
    icon: '💡',
    subPresets: [
      { id: 'rim', label: 'Rim Lighting', prompt: 'Add a sharp, professional rim light around the subject to separate them from the background.' },
      { id: 'neon', label: 'Neon Glow', prompt: 'Make all light sources in the image glow with a vibrant neon intensity.' },
      { id: 'dramatic', label: 'Film Noir', prompt: 'Apply high-contrast black and white lighting with deep shadows and moody highlights.' },
      { id: 'cinematic', label: 'Hollywood Cine', prompt: 'Apply a teal and orange cinematic color grade used in blockbuster movies.' }
    ]
  }
];
