/**
 * Calculates the Access Check Score from axe-core violations.
 * 
 * Rules:
 * - Start at 100 and subtract penalties.
 * - Weights:
 *   - critical: 15
 *   - serious: 8
 *   - moderate: 4
 *   - minor: 1
 * - Clamp between 0 and 100.
 * 
 * @param {Array} violations - Array of violation objects from the scan response
 * @returns {number} Score between 0 and 100
 */
export function calculateScore(violations) {
  if (!violations || !Array.isArray(violations)) {
    return 100;
  }

  let penalties = 0;

  violations.forEach(violation => {
    const impact = violation.impact ? violation.impact.toLowerCase() : 'minor';
    switch (impact) {
      case 'critical':
        penalties += 15;
        break;
      case 'serious':
        penalties += 8;
        break;
      case 'moderate':
        penalties += 4;
        break;
      case 'minor':
      default:
        penalties += 1;
        break;
    }
  });

  const finalScore = 100 - penalties;
  return Math.max(0, Math.min(100, finalScore));
}
