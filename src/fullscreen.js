export function canUseBrowserFullscreen(doc, element) {
 return doc.fullscreenEnabled === true && typeof element.requestFullscreen === 'function';
}
export async function enterBrowserFullscreen(doc, element) {
 if (!canUseBrowserFullscreen(doc, element)) return {entered:false,message:'Browser fullscreen is unavailable in this view. The expanded map still fills this window. Open the standalone app to try browser fullscreen.'};
 try {
  await element.requestFullscreen();
  return {entered:doc.fullscreenElement===element,message:doc.fullscreenElement===element?'Browser fullscreen enabled.':'Browser fullscreen did not open. The expanded map remains available.'};
 } catch {
  return {entered:false,message:'The browser blocked fullscreen. The expanded map still works. Open the standalone app to try again.'};
 }
}
