/**
 * SessionFlow - Scene Controls Registration
 * Adds the SessionFlow button to the left-side scene controls bar.
 * @module controls
 */

/**
 * Register the SessionFlow scene control button.
 * Called during the 'getSceneControlButtons' hook.
 * In v13, controls is an object keyed by control name,
 * and tools is a Record<string, SceneControlTool>.
 * @param {Record<string, SceneControl>} controls
 */
export function registerSceneControls(controls) {
  const notesControl = controls.notes;
  if (!notesControl) return;

  notesControl.tools.sessionflow = {
    name: 'sessionflow',
    title: 'SESSIONFLOW.Controls.TogglePanel',
    icon: 'fa-solid fa-book-open',
    order: 99,
    button: true,
    visible: game.user.isGM,
    onChange: (event, active) => {
      Hooks.call('sessionflow:togglePanel');
    }
  };
}
