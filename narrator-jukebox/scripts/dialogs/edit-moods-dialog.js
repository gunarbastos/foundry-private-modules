/**
 * Edit Moods Dialog
 * Complex dialog for managing mood boards (visual tag filters)
 */

import { JUKEBOX, MOOD_GRADIENTS, MOOD_ICONS } from '../core/constants.js';
import { getFilePicker } from '../utils/file-picker-compat.js';
import { applyMoodEditorTheme, applyDialogClasses } from './base-dialog.js';
import { localize, format } from '../utils/i18n.js';

/**
 * Default preset gradients organized by category
 */
const PRESET_GRADIENTS = [
  // Combat & Action
  { nameKey: 'Gradients.Fire', value: 'linear-gradient(135deg, #f12711, #f5af19)', category: 'combat' },
  { nameKey: 'Gradients.Ember', value: 'linear-gradient(135deg, #ff416c, #ff4b2b)', category: 'combat' },
  { nameKey: 'Gradients.Blood', value: 'linear-gradient(135deg, #8E0E00, #1F1C18)', category: 'combat' },
  { nameKey: 'Gradients.Inferno', value: 'linear-gradient(135deg, #ff0844, #ffb199)', category: 'combat' },
  { nameKey: 'Gradients.Rage', value: 'linear-gradient(135deg, #ED213A, #93291E)', category: 'combat' },

  // Mystery & Magic
  { nameKey: 'Gradients.PurpleHaze', value: 'linear-gradient(135deg, #667eea, #764ba2)', category: 'magic' },
  { nameKey: 'Gradients.Mystic', value: 'linear-gradient(135deg, #41295a, #2F0743)', category: 'magic' },
  { nameKey: 'Gradients.Arcane', value: 'linear-gradient(135deg, #8E2DE2, #4A00E0)', category: 'magic' },
  { nameKey: 'Gradients.Enchanted', value: 'linear-gradient(135deg, #c471f5, #fa71cd)', category: 'magic' },
  { nameKey: 'Gradients.Nebula', value: 'linear-gradient(135deg, #E040FB, #536DFE)', category: 'magic' },

  // Nature & Exploration
  { nameKey: 'Gradients.Forest', value: 'linear-gradient(135deg, #11998e, #38ef7d)', category: 'nature' },
  { nameKey: 'Gradients.Mint', value: 'linear-gradient(135deg, #00b09b, #96c93d)', category: 'nature' },
  { nameKey: 'Gradients.Leaf', value: 'linear-gradient(135deg, #134E5E, #71B280)', category: 'nature' },
  { nameKey: 'Gradients.Jungle', value: 'linear-gradient(135deg, #0F2027, #203A43, #2C5364)', category: 'nature' },
  { nameKey: 'Gradients.Spring', value: 'linear-gradient(135deg, #00d2ff, #3a7bd5)', category: 'nature' },

  // Ocean & Water
  { nameKey: 'Gradients.Ocean', value: 'linear-gradient(135deg, #4facfe, #00f2fe)', category: 'water' },
  { nameKey: 'Gradients.DeepSea', value: 'linear-gradient(135deg, #1A2980, #26D0CE)', category: 'water' },
  { nameKey: 'Gradients.Tidal', value: 'linear-gradient(135deg, #0052D4, #65C7F7, #9CECFB)', category: 'water' },
  { nameKey: 'Gradients.Arctic', value: 'linear-gradient(135deg, #74ebd5, #ACB6E5)', category: 'water' },
  { nameKey: 'Gradients.Frozen', value: 'linear-gradient(135deg, #c2e9fb, #a1c4fd)', category: 'water' },

  // Dark & Horror
  { nameKey: 'Gradients.Night', value: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)', category: 'dark' },
  { nameKey: 'Gradients.Midnight', value: 'linear-gradient(135deg, #232526, #414345)', category: 'dark' },
  { nameKey: 'Gradients.Shadow', value: 'linear-gradient(135deg, #000000, #434343)', category: 'dark' },
  { nameKey: 'Gradients.Abyss', value: 'linear-gradient(135deg, #0f0f0f, #2d2d2d)', category: 'dark' },
  { nameKey: 'Gradients.Void', value: 'linear-gradient(135deg, #16222A, #3A6073)', category: 'dark' },

  // Romantic & Calm
  { nameKey: 'Gradients.Rose', value: 'linear-gradient(135deg, #ee9ca7, #ffdde1)', category: 'calm' },
  { nameKey: 'Gradients.Dusk', value: 'linear-gradient(135deg, #a18cd1, #fbc2eb)', category: 'calm' },
  { nameKey: 'Gradients.Peach', value: 'linear-gradient(135deg, #ffecd2, #fcb69f)', category: 'calm' },
  { nameKey: 'Gradients.Blossom', value: 'linear-gradient(135deg, #f6d365, #fda085)', category: 'calm' },
  { nameKey: 'Gradients.Serenity', value: 'linear-gradient(135deg, #89f7fe, #66a6ff)', category: 'calm' },

  // Sunset & Dawn
  { nameKey: 'Gradients.Sunset', value: 'linear-gradient(135deg, #f093fb, #f5576c)', category: 'sky' },
  { nameKey: 'Gradients.Dawn', value: 'linear-gradient(135deg, #ffecd2, #fcb69f)', category: 'sky' },
  { nameKey: 'Gradients.Twilight', value: 'linear-gradient(135deg, #544a7d, #ffd452)', category: 'sky' },
  { nameKey: 'Gradients.Aurora', value: 'linear-gradient(135deg, #00c6ff, #0072ff)', category: 'sky' },
  { nameKey: 'Gradients.GoldenHour', value: 'linear-gradient(135deg, #f7971e, #ffd200)', category: 'sky' },

  // Storm & Weather
  { nameKey: 'Gradients.Storm', value: 'linear-gradient(135deg, #373b44, #4286f4)', category: 'weather' },
  { nameKey: 'Gradients.Lightning', value: 'linear-gradient(135deg, #f7ff00, #db36a4)', category: 'weather' },
  { nameKey: 'Gradients.Fog', value: 'linear-gradient(135deg, #606c88, #3f4c6b)', category: 'weather' },
  { nameKey: 'Gradients.Sandstorm', value: 'linear-gradient(135deg, #c79081, #dfa579)', category: 'weather' },

  // Royal & Noble
  { nameKey: 'Gradients.Crown', value: 'linear-gradient(135deg, #F7971E, #FFD200)', category: 'royal' },
  { nameKey: 'Gradients.Imperial', value: 'linear-gradient(135deg, #360033, #0b8793)', category: 'royal' },
  { nameKey: 'Gradients.Majestic', value: 'linear-gradient(135deg, #5f2c82, #49a09d)', category: 'royal' },
  { nameKey: 'Gradients.Regal', value: 'linear-gradient(135deg, #1a2a6c, #b21f1f, #fdbb2d)', category: 'royal' }
];

/**
 * Popular FontAwesome icons organized by category
 */
const POPULAR_ICONS = {
  combat: ['fas fa-sword', 'fas fa-shield-alt', 'fas fa-axe', 'fas fa-bow-arrow', 'fas fa-fist-raised', 'fas fa-skull-crossbones', 'fas fa-skull', 'fas fa-khanda', 'fas fa-bomb', 'fas fa-crosshairs', 'fas fa-bullseye', 'fas fa-chess-knight'],
  magic: ['fas fa-magic', 'fas fa-hat-wizard', 'fas fa-wand-magic', 'fas fa-fire-alt', 'fas fa-bolt', 'fas fa-star', 'fas fa-moon', 'fas fa-sun', 'fas fa-hand-sparkles', 'fas fa-scroll', 'fas fa-book-spells', 'fas fa-crystal-ball'],
  creatures: ['fas fa-dragon', 'fas fa-spider', 'fas fa-ghost', 'fas fa-cat', 'fas fa-crow', 'fas fa-horse', 'fas fa-wolf-pack-battalion', 'fas fa-bat', 'fas fa-snake', 'fas fa-fish', 'fas fa-bug', 'fas fa-paw'],
  nature: ['fas fa-leaf', 'fas fa-tree', 'fas fa-seedling', 'fas fa-mountain', 'fas fa-water', 'fas fa-wind', 'fas fa-snowflake', 'fas fa-cloud', 'fas fa-feather', 'fas fa-flower', 'fas fa-sun', 'fas fa-rainbow'],
  places: ['fas fa-dungeon', 'fas fa-castle', 'fas fa-church', 'fas fa-home', 'fas fa-campground', 'fas fa-landmark', 'fas fa-monument', 'fas fa-torii-gate', 'fas fa-archway', 'fas fa-store', 'fas fa-warehouse', 'fas fa-city'],
  emotions: ['fas fa-heart', 'fas fa-heart-broken', 'fas fa-grin-tears', 'fas fa-sad-tear', 'fas fa-angry', 'fas fa-surprise', 'fas fa-meh', 'fas fa-laugh', 'fas fa-tired', 'fas fa-dizzy', 'fas fa-grimace', 'fas fa-grin-stars'],
  objects: ['fas fa-gem', 'fas fa-coins', 'fas fa-crown', 'fas fa-key', 'fas fa-lock', 'fas fa-hourglass', 'fas fa-compass', 'fas fa-map', 'fas fa-chess', 'fas fa-dice-d20', 'fas fa-ring', 'fas fa-trophy'],
  music: ['fas fa-music', 'fas fa-guitar', 'fas fa-drum', 'fas fa-headphones', 'fas fa-volume-up', 'fas fa-microphone', 'fas fa-record-vinyl', 'fas fa-bell', 'fas fa-broadcast-tower', 'fas fa-radio', 'fas fa-sliders-h', 'fas fa-wave-square'],
  spiritual: ['fas fa-cross', 'fas fa-pray', 'fas fa-bible', 'fas fa-church', 'fas fa-dove', 'fas fa-hand-holding-heart', 'fas fa-yin-yang', 'fas fa-om', 'fas fa-ankh', 'fas fa-peace', 'fas fa-star-of-david', 'fas fa-menorah'],
  misc: ['fas fa-fire', 'fas fa-anchor', 'fas fa-flask', 'fas fa-eye', 'fas fa-binoculars', 'fas fa-search', 'fas fa-cog', 'fas fa-flag', 'fas fa-hammer', 'fas fa-wrench', 'fas fa-quill', 'fas fa-pen-fancy']
};

/**
 * Gradient category definitions
 */
const GRADIENT_CATEGORIES = {
  combat: { nameKey: 'GradientCategories.Combat', icon: 'fa-fire' },
  magic: { nameKey: 'GradientCategories.Magic', icon: 'fa-magic' },
  nature: { nameKey: 'GradientCategories.Nature', icon: 'fa-leaf' },
  water: { nameKey: 'GradientCategories.Water', icon: 'fa-water' },
  dark: { nameKey: 'GradientCategories.Dark', icon: 'fa-moon' },
  calm: { nameKey: 'GradientCategories.Calm', icon: 'fa-heart' },
  sky: { nameKey: 'GradientCategories.Sky', icon: 'fa-sun' },
  weather: { nameKey: 'GradientCategories.Weather', icon: 'fa-cloud' },
  royal: { nameKey: 'GradientCategories.Royal', icon: 'fa-crown' }
};

/**
 * Icon category labels
 */
const ICON_CATEGORY_KEYS = {
  combat: 'IconCategories.Combat',
  magic: 'IconCategories.Magic',
  creatures: 'IconCategories.Creatures',
  nature: 'IconCategories.Nature',
  places: 'IconCategories.Places',
  emotions: 'IconCategories.Emotions',
  objects: 'IconCategories.Objects',
  music: 'IconCategories.Music',
  spiritual: 'IconCategories.Spiritual',
  misc: 'IconCategories.Misc'
};

/**
 * Shows the Edit Moods dialog
 * @param {Object} options - Dialog options
 * @param {Array} options.music - Music library for extracting tags
 * @param {Function} options.onSuccess - Callback on successful save
 * @returns {Dialog} The dialog instance
 */
export function showEditMoodsDialog({ music = [], onSuccess }) {
  const moods = game.settings.get(JUKEBOX.ID, "moods") || [];
  const allTags = [...new Set(music.flatMap(m => m.tags || []))].sort();

  const content = buildMoodsDialogContent(moods, allTags);

  const dialog = new Dialog({
    title: localize('Dialog.Moods.EditTitle'),
    content: content,
    classes: ['narrator-jukebox-dialog', 'mood-editor-dialog-v2'],
    render: (html) => {
      applyDialogClasses(html, ['narrator-jukebox-dialog', 'mood-editor-dialog-v2']);
      applyMoodEditorTheme(html);
      setupMoodEditorListeners(html, allTags, () => dialog);
    },
    buttons: {
      save: {
        icon: '<i class="fas fa-check"></i>',
        label: localize('Common.SaveChanges'),
        callback: async (html) => {
          const updatedMoods = [];
          html.find('.mood-card-item').each((i, el) => {
            const $card = $(el);
            updatedMoods.push({
              label: $card.find('.mood-input-label').val(),
              tag: $card.find('.mood-input-tag').val(),
              color: $card.find('.mood-input-color').val(),
              icon: $card.find('.mood-input-icon').val()
            });
          });
          await game.settings.set(JUKEBOX.ID, "moods", updatedMoods);
          ui.notifications.info(localize('Notifications.MoodBoardsSaved'));
          if (onSuccess) onSuccess();
        }
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: localize('Common.Cancel')
      }
    },
    default: "save"
  }, {
    width: 1000,
    height: 700,
    resizable: true
  });

  dialog.render(true);
  return dialog;
}

/**
 * Build the moods dialog content
 */
function buildMoodsDialogContent(moods, allTags) {
  return `
    <div class="mood-editor-v2">
      <header class="mood-editor-header">
        <div class="header-title">
          <i class="fas fa-palette"></i>
          <div>
            <h2>${localize('Dialog.Moods.Header')}</h2>
            <p>${localize('Dialog.Moods.Subtitle')}</p>
          </div>
        </div>
        <div class="header-stats">
          <span class="stat"><i class="fas fa-th-large"></i> ${format('Dialog.Moods.MoodsCount', { count: moods.length })}</span>
          <span class="stat"><i class="fas fa-tags"></i> ${format('Dialog.Moods.TagsCount', { count: allTags.length })}</span>
        </div>
      </header>

      <div class="mood-cards-grid" id="mood-cards-grid">
        ${moods.map((m, i) => renderMoodCard(m, i, allTags)).join('')}

        <button type="button" class="mood-add-card" id="add-mood-btn">
          <div class="add-card-content">
            <i class="fas fa-plus-circle"></i>
            <span>${localize('Dialog.Moods.AddMood')}</span>
          </div>
        </button>
      </div>

      <footer class="mood-editor-footer">
        <div class="footer-hint">
          <i class="fas fa-info-circle"></i>
          <span>${localize('Hints.MoodTip')}</span>
        </div>
      </footer>
    </div>
  `;
}

/**
 * Render a single mood card
 */
function renderMoodCard(mood, index, allTags) {
  const icon = mood.icon || 'fas fa-music';
  const isImage = icon.includes('/') || icon.includes('.');
  const color = mood.color || 'linear-gradient(135deg, #667eea, #764ba2)';

  return `
    <div class="mood-card-item" data-index="${index}">
      <div class="mood-preview" style="background: ${color};">
        <div class="preview-icon">
          ${isImage ? `<img src="${icon}" alt="">` : `<i class="${icon}"></i>`}
        </div>
        <div class="preview-label">${mood.label || 'Untitled'}</div>
        <button type="button" class="mood-delete-btn" title="${localize('Dialog.Moods.DeleteMoodTooltip')}">
          <i class="fas fa-trash-alt"></i>
        </button>
      </div>

      <div class="mood-fields">
        <div class="field-group">
          <label><i class="fas fa-tag"></i> ${localize('Labels.Name')}</label>
          <input type="text" class="mood-input-label" value="${mood.label || ''}" placeholder="${localize('Placeholders.MoodNameExample')}" spellcheck="false">
        </div>

        <div class="field-group">
          <label><i class="fas fa-filter"></i> ${localize('Labels.FilterTag')}</label>
          <div class="tag-input-wrapper">
            <input type="text" class="mood-input-tag" value="${mood.tag || ''}" placeholder="${localize('Placeholders.MoodTagExample')}" spellcheck="false" list="tag-suggestions-${index}">
            <datalist id="tag-suggestions-${index}">
              ${allTags.map(t => `<option value="${t}">`).join('')}
            </datalist>
          </div>
        </div>

        <div class="field-group gradient-field-group">
          <label><i class="fas fa-fill-drip"></i> ${localize('Labels.Background')}</label>
          <input type="hidden" class="mood-input-color" value="${color}">

          <div class="custom-gradient-builder">
            <div class="gradient-builder-preview" style="background: ${color};">
              <span class="gradient-preview-label"></span>
            </div>
            <div class="gradient-builder-controls">
              <div class="color-picker-group">
                <label>${localize('Dialog.Moods.Color1')}</label>
                <input type="color" class="gradient-color-1" value="#667eea">
              </div>
              <div class="color-picker-group">
                <label>${localize('Dialog.Moods.Color2')}</label>
                <input type="color" class="gradient-color-2" value="#764ba2">
              </div>
              <button type="button" class="apply-gradient-btn" title="${localize('Dialog.Moods.ApplyGradientTooltip')}">
                <i class="fas fa-check"></i> ${localize('Common.Apply')}
              </button>
            </div>
          </div>

          <div class="gradient-categories">
            ${Object.entries(GRADIENT_CATEGORIES).map(([catKey, cat]) => `
              <div class="gradient-category" data-category="${catKey}">
                <button type="button" class="gradient-category-btn" title="${localize(cat.nameKey)}">
                  <i class="fas ${cat.icon}"></i>
                </button>
                <div class="gradient-category-presets">
                  ${PRESET_GRADIENTS.filter(g => g.category === catKey).map(g => `
                    <button type="button" class="gradient-preset" style="background: ${g.value};" data-gradient="${g.value}" title="${localize(g.nameKey)}"></button>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="field-group icon-field-group">
          <label><i class="fas fa-icons"></i> ${localize('Labels.Icon')}</label>
          <div class="icon-input-wrapper">
            <input type="text" class="mood-input-icon" value="${icon}" placeholder="${localize('Placeholders.IconClassExample')}" spellcheck="false">
            <button type="button" class="icon-browse-btn" title="${localize('Dialog.Moods.BrowseImagestooltip')}">
              <i class="fas fa-folder-open"></i>
            </button>
          </div>

          <div class="icon-categories">
            <div class="icon-category-tabs">
              ${Object.entries(ICON_CATEGORY_KEYS).map(([catKey, catNameKey], idx) => `
                <button type="button" class="icon-category-tab ${idx === 0 ? 'active' : ''}" data-category="${catKey}">${localize(catNameKey)}</button>
              `).join('')}
            </div>
            <div class="icon-category-content">
              ${Object.entries(POPULAR_ICONS).map(([catKey, icons], idx) => `
                <div class="icon-category-panel ${idx === 0 ? 'active' : ''}" data-category="${catKey}">
                  ${icons.map(ic => `
                    <button type="button" class="icon-preset" data-icon="${ic}" title="${ic}">
                      <i class="${ic}"></i>
                    </button>
                  `).join('')}
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Setup mood editor event listeners
 */
function setupMoodEditorListeners(html, allTags, getDialog) {
  const allIcons = Object.values(POPULAR_ICONS).flat();

  // Add new mood
  html.find('#add-mood-btn').click(() => {
    const newMood = {
      label: "New Mood",
      tag: "",
      color: PRESET_GRADIENTS[Math.floor(Math.random() * PRESET_GRADIENTS.length)].value,
      icon: allIcons[Math.floor(Math.random() * allIcons.length)]
    };

    const newIndex = html.find('.mood-card-item').length;
    const newCardHtml = renderMoodCard(newMood, newIndex, allTags);

    $(newCardHtml).insertBefore(html.find('#add-mood-btn')).hide().fadeIn(300);
    attachCardListeners(html.find(`.mood-card-item[data-index="${newIndex}"]`));

    const container = html.find('.mood-cards-grid');
    container.animate({ scrollTop: container[0].scrollHeight }, 300);
  });

  // Attach listeners to existing cards
  html.find('.mood-card-item').each((i, el) => {
    attachCardListeners($(el));
  });
}

/**
 * Attach event listeners to a mood card
 */
function attachCardListeners($card) {
  // Delete button
  $card.find('.mood-delete-btn').click((e) => {
    e.stopPropagation();
    $card.addClass('deleting');
    setTimeout(() => {
      $card.slideUp(200, () => {
        $card.remove();
        $('.mood-card-item').each((i, el) => {
          $(el).attr('data-index', i);
        });
      });
    }, 100);
  });

  // Real-time preview updates
  $card.find('.mood-input-label').on('input', (e) => {
    $card.find('.preview-label').text(e.target.value || 'Untitled');
  });

  $card.find('.mood-input-color').on('change', (e) => {
    const gradient = e.target.value;
    $card.find('.mood-preview').css('background', gradient);
    $card.find('.gradient-builder-preview').css('background', gradient);
  });

  $card.find('.mood-input-icon').on('input', (e) => {
    const icon = e.target.value;
    const isImage = icon.includes('/') || icon.includes('.');
    const $iconContainer = $card.find('.preview-icon');

    if (isImage) {
      $iconContainer.html(`<img src="${icon}" alt="">`);
    } else {
      $iconContainer.html(`<i class="${icon}"></i>`);
    }
  });

  // Custom Gradient Builder
  const updateGradientPreview = () => {
    const color1 = $card.find('.gradient-color-1').val();
    const color2 = $card.find('.gradient-color-2').val();
    const gradient = `linear-gradient(135deg, ${color1}, ${color2})`;
    $card.find('.gradient-builder-preview').css('background', gradient);
  };

  $card.find('.gradient-color-1, .gradient-color-2').on('input', updateGradientPreview);

  $card.find('.apply-gradient-btn').click(() => {
    const color1 = $card.find('.gradient-color-1').val();
    const color2 = $card.find('.gradient-color-2').val();
    const gradient = `linear-gradient(135deg, ${color1}, ${color2})`;
    $card.find('.mood-input-color').val(gradient).trigger('change');
  });

  // Gradient category toggle
  $card.find('.gradient-category-btn').click((e) => {
    const $category = $(e.currentTarget).closest('.gradient-category');
    const wasActive = $category.hasClass('active');
    $card.find('.gradient-category').removeClass('active');
    if (!wasActive) {
      $category.addClass('active');
    }
  });

  // Gradient presets
  $card.find('.gradient-preset').click((e) => {
    e.stopPropagation();
    const gradient = e.currentTarget.dataset.gradient;
    $card.find('.mood-input-color').val(gradient).trigger('change');

    const colors = gradient.match(/#[a-fA-F0-9]{6}/g);
    if (colors && colors.length >= 2) {
      $card.find('.gradient-color-1').val(colors[0]);
      $card.find('.gradient-color-2').val(colors[1]);
    }
  });

  // Icon category tabs
  $card.find('.icon-category-tab').click((e) => {
    const category = e.currentTarget.dataset.category;
    $card.find('.icon-category-tab').removeClass('active');
    $(e.currentTarget).addClass('active');
    $card.find('.icon-category-panel').removeClass('active');
    $card.find(`.icon-category-panel[data-category="${category}"]`).addClass('active');
  });

  // Icon presets
  $card.find('.icon-preset').click((e) => {
    const icon = e.currentTarget.dataset.icon;
    $card.find('.mood-input-icon').val(icon).trigger('input');
  });

  // Browse for image icon
  $card.find('.icon-browse-btn').click(() => {
    const input = $card.find('.mood-input-icon');
    new (getFilePicker())({
      type: "image",
      current: input.val(),
      callback: (path) => {
        input.val(path).trigger('input');
      }
    }).browse();
  });
}

export default showEditMoodsDialog;
