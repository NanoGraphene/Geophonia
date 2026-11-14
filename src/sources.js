export async function loadSource() {
  const response = await fetch('./data/source-manifest.json');
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
  return { manifest, imageData: context.getImageData(0, 0, canvas.width, canvas.height) };
}
