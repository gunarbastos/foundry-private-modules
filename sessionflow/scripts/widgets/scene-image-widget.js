/**
 * SessionFlow - Scene Image Widget
 * Displays the scene background image with title overlay and broadcast controls.
 * Migrated from the left column of the original scene panel.
 * @module widgets/scene-image-widget
 */

import { Widget, registerWidgetType } from '../widget.js';
import { getScenes } from '../session-store.js';

const MODULE_ID = 'sessionflow';

export class SceneImageWidget extends Widget {

  static TYPE = 'scene-image';
  static LABEL = 'SESSIONFLOW.Canvas.SceneImage';
  static ICON = 'fas fa-image';
  static MIN_WIDTH = 200;
  static MIN_HEIGHT = 150;
  static DEFAULT_WIDTH = 480;
  static DEFAULT_HEIGHT = 340;
  static MAX_INSTANCES = 1;

  /* ---------------------------------------- */
  /*  Rendering                               */
  /* ---------------------------------------- */

  getTitle() {
    return game.i18n.localize('SESSIONFLOW.Canvas.SceneImage');
  }

  /**
   * @param {HTMLElement} bodyEl
   */
  renderBody(bodyEl) {
    bodyEl.innerHTML = '';

    const { sessionId, beatId, sceneId } = this.context;
    const scenes = getScenes(sessionId, beatId);
    const scene = scenes.find(sc => sc.id === sceneId);

    const exaltedAvailable = this.#isExaltedScenesAvailable();
    const exaltedScene = (scene?.exaltedSceneId && exaltedAvailable)
      ? this.#getExaltedScene(scene.exaltedSceneId) : null;

    // Container
    const container = document.createElement('div');
    container.className = 'sessionflow-widget-scene-image';

    // Image or placeholder
    if (exaltedScene?.background) {
      const src = exaltedScene.background;
      if (this.#isVideoSource(src)) {
        const video = document.createElement('video');
        video.className = 'sessionflow-widget-scene-image__img';
        video.src = src;
        video.autoplay = true;
        video.loop = true;
        video.muted = true;
        container.appendChild(video);
      } else {
        const img = document.createElement('img');
        img.className = 'sessionflow-widget-scene-image__img';
        img.src = src;
        img.alt = scene?.title ?? '';
        container.appendChild(img);
      }
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'sessionflow-widget-scene-image__placeholder';
      placeholder.innerHTML = '<i class="fas fa-image"></i>';
      container.appendChild(placeholder);
    }

    // Title + link overlay
    const overlay = document.createElement('div');
    overlay.className = 'sessionflow-widget-scene-image__overlay';

    if (scene?.title) {
      const title = document.createElement('h2');
      title.className = 'sessionflow-widget-scene-image__title';
      title.textContent = scene.title;
      overlay.appendChild(title);
    }

    if (exaltedScene?.name) {
      const link = document.createElement('span');
      link.className = 'sessionflow-widget-scene-image__link';
      link.innerHTML = `<i class="fas fa-link"></i> ${this.#escapeHtml(exaltedScene.name)}`;
      overlay.appendChild(link);
    }

    container.appendChild(overlay);

    // Broadcast button (only if linked to Exalted Scene)
    if (scene?.exaltedSceneId && exaltedAvailable) {
      const isBroadcasting = this.#isBroadcastingScene(scene.exaltedSceneId);

      const btn = document.createElement('button');
      btn.className = 'sessionflow-widget-scene-image__broadcast-btn';
      if (isBroadcasting) btn.classList.add('is-active');
      btn.type = 'button';
      btn.title = isBroadcasting
        ? game.i18n.localize('SESSIONFLOW.ScenePanel.StopBroadcast')
        : game.i18n.localize('SESSIONFLOW.ScenePanel.StartBroadcast');
      btn.innerHTML = `<i class="fas ${isBroadcasting ? 'fa-stop' : 'fa-play'}"></i>`;

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#onToggleBroadcast();
      });

      container.appendChild(btn);
    }

    bodyEl.appendChild(container);
  }

  /* ---------------------------------------- */
  /*  Broadcast                               */
  /* ---------------------------------------- */

  async #onToggleBroadcast() {
    const { sessionId, beatId, sceneId } = this.context;
    const scenes = getScenes(sessionId, beatId);
    const scene = scenes.find(sc => sc.id === sceneId);
    if (!scene?.exaltedSceneId) return;

    if (this.#isBroadcastingScene(scene.exaltedSceneId)) {
      await this.#stopBroadcast();
    } else {
      await this.#startBroadcast(scene.exaltedSceneId);
    }

    this.refreshBody();
  }

  /* ---------------------------------------- */
  /*  Exalted Scenes Helpers                  */
  /* ---------------------------------------- */

  #isExaltedScenesAvailable() {
    const mod = game.modules.get('exalted-scenes');
    return mod?.active && mod?.api?.isReady;
  }

  #getExaltedScene(sceneId) {
    try {
      const api = game.modules.get('exalted-scenes')?.api;
      if (!api?.isReady) return null;
      return api.scenes.get(sceneId) ?? null;
    } catch (err) {
      console.warn(`[${MODULE_ID}] Failed to get Exalted Scene ${sceneId}:`, err);
      return null;
    }
  }

  #isBroadcastingScene(exaltedSceneId) {
    if (!exaltedSceneId) return false;
    try {
      const api = game.modules.get('exalted-scenes')?.api;
      if (!api?.isReady) return false;
      const state = api.broadcast.getState();
      return state.isBroadcasting && state.activeSceneId === exaltedSceneId;
    } catch {
      return false;
    }
  }

  async #startBroadcast(exaltedSceneId) {
    try {
      const api = game.modules.get('exalted-scenes')?.api;
      if (!api?.isReady) return;
      await api.broadcast.scene(exaltedSceneId);
    } catch (err) {
      console.warn(`[${MODULE_ID}] Failed to start broadcast:`, err);
    }
  }

  async #stopBroadcast() {
    try {
      const api = game.modules.get('exalted-scenes')?.api;
      if (!api?.isReady) return;
      await api.broadcast.stop();
    } catch (err) {
      console.warn(`[${MODULE_ID}] Failed to stop broadcast:`, err);
    }
  }

  /* ---------------------------------------- */
  /*  Utilities                               */
  /* ---------------------------------------- */

  /**
   * Check if a source path points to a video file.
   * @param {string} src
   * @returns {boolean}
   */
  #isVideoSource(src) {
    if (!src) return false;
    const ext = src.split('.').pop()?.toLowerCase()?.split('?')[0];
    return ['mp4', 'webm', 'm4v'].includes(ext);
  }

  #escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }
}

// Auto-register
registerWidgetType(SceneImageWidget.TYPE, SceneImageWidget);
