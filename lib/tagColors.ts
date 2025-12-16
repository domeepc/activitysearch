// A large-ish palette for random tag coloring
export const tagColors = [
  { bg: "bg-blue-100", text: "text-blue-800", bgHex: "#dbeafe", textHex: "#1e40af" },
  { bg: "bg-green-100", text: "text-green-800", bgHex: "#dcfce7", textHex: "#166534" },
  { bg: "bg-red-100", text: "text-red-800", bgHex: "#fee2e2", textHex: "#991b1b" },
  { bg: "bg-yellow-100", text: "text-yellow-800", bgHex: "#fef9c3", textHex: "#854d0e" },
  { bg: "bg-cyan-100", text: "text-cyan-800", bgHex: "#cffafe", textHex: "#155e75" },
  { bg: "bg-yellow-800", text: "text-yellow-100", bgHex: "#854d0e", textHex: "#fef9c3" },
  { bg: "bg-purple-100", text: "text-purple-800", bgHex: "#f3e8ff", textHex: "#6b21a8" },
  { bg: "bg-pink-100", text: "text-pink-800", bgHex: "#fce7f3", textHex: "#9f1239" },
  { bg: "bg-indigo-100", text: "text-indigo-800", bgHex: "#e0e7ff", textHex: "#3730a3" },
  { bg: "bg-orange-100", text: "text-orange-800", bgHex: "#ffedd5", textHex: "#9a3412" },
  { bg: "bg-emerald-100", text: "text-emerald-800", bgHex: "#d1fae5", textHex: "#065f46" },
  { bg: "bg-gray-200", text: "text-gray-800", bgHex: "#e5e7eb", textHex: "#1f2937" },
];

// For stable color assignment between page reloads, use a hash function
function hashStringToColorIdx(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash) % tagColors.length;
}

/**
 * Get color scheme for a tag label.
 * For known (hardcoded) tags, use a fixed color. For database tags,
 * use a hash function so that each database activity tag gets a stable random color.
 */
export function getTagColorScheme(
  label: string,
  databaseTags?: string[]
): { bg: string; text: string; bgHex: string; textHex: string } {
  const lowerLabel = label.toLowerCase();

  // First check for difficulty levels (use specific colors)
  if (["easy", "intermediate", "hard"].includes(lowerLabel)) {
    return getDifficultyColorScheme(label);
  }

  // Then check for hardcoded known tags
  switch (lowerLabel) {
    case "water sports":
      return tagColors[0]; // blue
    case "adventure sports":
      return tagColors[2]; // red
    case "food & wine":
      return tagColors[3]; // yellow
    case "hiking & trekking":
      return tagColors[1]; // green
    case "hiking":
      return tagColors[5]; // yellow-800
    case "sailing & boating":
      return tagColors[4]; // cyan
  }

  // If it's a database tag, assign a stable color based on hash
  if (databaseTags && databaseTags.includes(lowerLabel)) {
    return tagColors[hashStringToColorIdx(lowerLabel)];
  }

  // Fallback: use hash for any other tag
  return tagColors[hashStringToColorIdx(lowerLabel)];
}

/**
 * Get color scheme for difficulty levels.
 * Easy = green, Intermediate = yellow/orange, Hard = red
 */
export function getDifficultyColorScheme(
  difficulty: string
): { bg: string; text: string; bgHex: string; textHex: string } {
  const lowerDifficulty = difficulty.toLowerCase().trim();
  
  switch (lowerDifficulty) {
    case "easy":
      return { bg: "bg-green-100", text: "text-green-800", bgHex: "#dcfce7", textHex: "#166534" };
    case "intermediate":
      return { bg: "bg-yellow-100", text: "text-yellow-800", bgHex: "#fef9c3", textHex: "#854d0e" };
    case "hard":
      return { bg: "bg-red-100", text: "text-red-800", bgHex: "#fee2e2", textHex: "#991b1b" };
    default:
      // Fallback to gray for unknown difficulties
      return { bg: "bg-gray-200", text: "text-gray-800", bgHex: "#e5e7eb", textHex: "#1f2937" };
  }
}

