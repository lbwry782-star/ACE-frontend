/**
 * Generates dummy marketing text (~50 words)
 * @param {number} attemptNumber - Attempt number (1, 2, or 3)
 * @returns {string} Marketing text
 */
export function generateMarketingText(attemptNumber) {
  const templates = [
    "Discover the perfect solution for your needs with our innovative product. Experience unmatched quality and performance that sets new industry standards. Transform your daily routine with cutting-edge technology designed for modern lifestyles. Join thousands of satisfied customers who have already made the switch.",
    "Elevate your experience with our premium offering that combines style and functionality. Experience the difference that quality makes in every aspect of your journey. Our commitment to excellence ensures you receive the best value available. Make the smart choice today and see why we're the preferred option.",
    "Unlock new possibilities with our carefully crafted solution that delivers exceptional results. Built with precision and attention to detail, our product exceeds expectations consistently. Trust in a brand that prioritizes your satisfaction above all else. Start your transformation now and discover what makes us unique."
  ]
  
  return templates[attemptNumber - 1] || templates[0]
}

