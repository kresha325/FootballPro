// utils/applyBackgroundStyle.js

/**
 * Apply background color or image to the body.
 * @param {string} bgColor - CSS color string (e.g. '#fff' or 'rgba(...)').
 * @param {string} bgImage - Image URL or base64 string (optional).
 */
export function applyBackgroundStyle(bgColor, bgImage) {
  console.log('[applyBackgroundStyle] bgColor:', bgColor, 'bgImage:', bgImage);
  if (bgImage) {
    document.body.style.backgroundImage = `url('${bgImage}')`;
    document.body.style.backgroundColor = bgColor || '';
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundRepeat = 'no-repeat';
  } else if (bgColor) {
    document.body.style.backgroundImage = '';
    document.body.style.backgroundColor = bgColor;
    document.body.style.backgroundSize = '';
    document.body.style.backgroundRepeat = '';
  } else {
    document.body.style.backgroundImage = '';
    document.body.style.backgroundColor = '';
    document.body.style.backgroundSize = '';
    document.body.style.backgroundRepeat = '';
  }
  // Kontrollo çfarë është vendosur realisht
  console.log('[applyBackgroundStyle] body.style.backgroundColor:', document.body.style.backgroundColor);
  console.log('[applyBackgroundStyle] body.style.backgroundImage:', document.body.style.backgroundImage);
}
