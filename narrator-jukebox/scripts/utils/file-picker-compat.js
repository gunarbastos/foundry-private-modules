/**
 * FilePicker Compatibility Helper (v11-v13)
 * Extracted from narrator-jukebox.js for modular architecture
 */

/**
 * Get the appropriate FilePicker class for the current Foundry version
 * @returns {FilePicker} The FilePicker class/constructor
 */
export function getFilePicker() {
  // Foundry v13+ uses namespaced FilePicker
  if (foundry?.applications?.apps?.FilePicker?.implementation) {
    return foundry.applications.apps.FilePicker.implementation;
  }
  // Fallback for v11/v12
  return FilePicker;
}
