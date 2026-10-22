/**
 * Gallery examples for #/examples.
 * Add or remove items here without changing ExamplesPage layout.
 *
 * Fields:
 * - id: stable key
 * - type: 'video' | 'image'
 * - src: public/assets file name (null until a real file is provided)
 * - mediaWidth / mediaHeight: measured pixel size for video slots
 * - productName / productDescription: display copy
 * - placeholderLabel: shown in the reserved media slot when src is empty
 * - placeholderBackground: reserved-slot fill
 */

export const SHOW_EXAMPLES_DESIGN_NOTE = true

export const EXAMPLES_DESIGN_NOTE =
  'תצוגת עיצוב — הדוגמאות ופרטי המוצרים יתווספו בהמשך.'

export const EXAMPLES_VIDEO_WIDTH = 1280
export const EXAMPLES_VIDEO_HEIGHT = 720

export const EXAMPLES = [
  {
    id: 'video-1',
    type: 'video',
    src: 'גלריה פיזאלה.mp4',
    productName: 'גלריה פיזאלה',
    productDescription: 'גלריה לאומנות מודרנית',
    placeholderLabel: 'כאן יוצג סרטון לדוגמה',
    placeholderBackground: '#292C2A',
    mediaWidth: EXAMPLES_VIDEO_WIDTH,
    mediaHeight: EXAMPLES_VIDEO_HEIGHT
  },
  {
    id: 'video-2',
    type: 'video',
    src: null,
    productName: 'שם המוצר יתווסף כאן',
    productDescription: 'תיאור המוצר יופיע כאן לצד הסרטון שלו.',
    placeholderLabel: 'כאן יוצג סרטון לדוגמה',
    placeholderBackground: '#DCD7CE',
    mediaWidth: EXAMPLES_VIDEO_WIDTH,
    mediaHeight: EXAMPLES_VIDEO_HEIGHT
  },
  {
    id: 'image-1',
    type: 'image',
    src: null,
    productName: 'שם המוצר יתווסף כאן',
    productDescription: 'תיאור המוצר יופיע כאן לצד המודעה שלו.',
    placeholderLabel: 'כאן תוצג מודעה לדוגמה',
    placeholderBackground: '#E7E8DF'
  },
  {
    id: 'image-2',
    type: 'image',
    src: null,
    productName: 'שם המוצר יתווסף כאן',
    productDescription: 'תיאור המוצר יופיע כאן לצד המודעה שלו.',
    placeholderLabel: 'כאן תוצג מודעה לדוגמה',
    placeholderBackground: '#EEE2D6'
  }
]
