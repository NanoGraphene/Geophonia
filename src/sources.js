import { DATASETS } from './datasets.js';
import { preparePalette } from './sampling.js';
export async function loadSource(id = 'svs-3912') {
  const response = await fetch(DATASETS[id].manifest);
  if (!response.ok) throw new Error(`Source manifest failed (${response.status}).`);
  const manifest = await response.json();
  const image = new Image();
  image.src = manifest.frames[0].local;
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
  return { manifest, palette, imageData: context.getImageData(0, 0, canvas.width, canvas.height) };
}
