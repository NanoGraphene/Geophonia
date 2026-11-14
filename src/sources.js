import { DATASETS } from './datasets.js';
import { createFrameCache } from './timeline.js';
import { preparePalette } from './sampling.js';
async function decodeSource(id, index = 0) {
  const response = await fetch(DATASETS[id].manifest);
  if (!response.ok) throw new Error(`Source manifest failed (${response.status}).`);
  const manifest = await response.json();
  const frame=manifest.frames[index];if(!frame)throw new Error('Requested frame is unavailable.');
  const image = new Image();
  image.src = frame.local;
  await image.decode();
  if (image.naturalWidth !== manifest.width || image.naturalHeight !== manifest.height) throw new Error('Source dimensions do not match the manifest.');
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0);
  const paletteResponse = await fetch(DATASETS[id].palette);
  if (!paletteResponse.ok) throw new Error('Source palette could not load.');
  const rgb = (await paletteResponse.json()).rgb;
  const palette = manifest.matching === 'rgb' ? rgb : preparePalette(rgb);
  const display=new Image();display.src=frame.display;await display.decode();
  return { manifest, frame, frameIndex:index, displayURL:display.src, palette, imageData: context.getImageData(0, 0, canvas.width, canvas.height) };
}

export const loadSource=createFrameCache(decodeSource,4);
