"use client";

const colors = {
  blue: {
    bg: "bg-blue-100",
    text: "text-blue-800",
  },
  green: {
    bg: "bg-green-100",
    text: "text-green-800",
  },
  red: {
    bg: "bg-red-100",
    text: "text-red-800",
  },
  yellow: {
    bg: "bg-yellow-100",
    text: "text-yellow-800",
  },
  cyan:{
    bg: "bg-cyan-100",
    text: "text-cyan-800",
  },
  brown:{
    bg: "bg-yellow-800",
    text: "text-yellow-100",
  },
};

function getColorScheme(label: string) {
    switch (label.toLowerCase()) {
        case "water sports":
            return colors.blue;
            case "adventure sports":
            return colors.red;
            case "food & wine":
            return colors.yellow;
            case "hiking & trekking":
            return colors.green;
            case "hiking":
            return colors.brown;
            case "sailing & boating":
            return colors.cyan;
        default:
            return colors.blue;

    }
}

export default function Tag({ label }: { label: string }) {
  return (
    <span className={getColorScheme(label).bg + " " + getColorScheme(label).text + " text-xs px-2 py-2 rounded max-w-max font-medium"}>
      {label}
    </span>
  );
}