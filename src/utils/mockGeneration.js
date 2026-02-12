/**
 * Mock generation function - simulates backend generation
 * @param {Object} data - Form data with productName, productDescription, imageSize
 * @param {number} generationTime - Time to simulate generation (milliseconds)
 * @returns {Promise<void>}
 */
export async function mockGenerate(data, generationTime = 30000) {
  // Simulate generation time
  await new Promise(resolve => setTimeout(resolve, generationTime))
  
  // Return success (no actual data needed, BuilderPage handles ad creation)
  return { success: true }
}

