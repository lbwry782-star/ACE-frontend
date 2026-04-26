/**
 * Agent / app display name for UI copy only (per surrounding label language).
 * @param {'he' | 'en'} contextLang
 */
export function getAgentDisplayName(contextLang) {
  return contextLang === 'he' ? 'אורי לב' : 'URI LEV'
}
