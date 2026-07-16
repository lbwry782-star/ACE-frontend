/**
 * @deprecated Builder1 no longer uses timed mock generation.
 * Dev mock campaigns are created via createDevMockCampaign in builder1Campaign.js.
 */
export async function mockGenerate(_data, _generationTime = 30000) {
  await new Promise((resolve) => setTimeout(resolve, 0))
  return { success: true }
}
