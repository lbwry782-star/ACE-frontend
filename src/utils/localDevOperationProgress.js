export function observedProgressRatio(progress) {
  const completed = Array.isArray(progress?.completedSteps) ? progress.completedSteps.length : 0
  const current = progress?.currentStep ? 1 : 0
  const known = completed + current
  if (known === 0) return null
  return completed / known
}

export function activeProgressStepId(progress) {
  const currentId = String(progress?.currentStep?.id || '').trim()
  if (currentId) return currentId
  const completed = Array.isArray(progress?.completedSteps) ? progress.completedSteps : []
  const last = completed[completed.length - 1]
  return String(last?.id || '').trim()
}

export function statusFromStepMap(progress, stepMessages, fallback) {
  const currentId = String(progress?.currentStep?.id || '').trim()
  if (currentId && stepMessages[currentId]) return stepMessages[currentId]
  const completed = Array.isArray(progress?.completedSteps) ? progress.completedSteps : []
  for (let index = completed.length - 1; index >= 0; index -= 1) {
    const id = String(completed[index]?.id || '').trim()
    if (id && stepMessages[id]) return stepMessages[id]
  }
  return fallback
}
