
function isEducational(title) {
  const keywords = [
    "learn",
    "tutorial",
    "science",
    "history",
    "programming",
    "education",
    "mathematics",
    "engineering",
    "how to"
  ];

  const text = title.toLowerCase();

  return keywords.some(word => text.includes(word));
}
