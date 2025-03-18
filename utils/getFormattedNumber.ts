const zeroPaddedString = (
  num: number,
  requiredDigits: number,
  position: "before" | "after"
): string => {
  if (num < 0) throw new RangeError("negative number");
  if (requiredDigits < 0) throw new RangeError("invalid number of zeroes");
  if (position !== "before" && position !== "after")
    throw new TypeError("invalid position (before or after only)");

  const requiredZeroes = requiredDigits - (num + "").replace(".", "").length;
  const zeroes = "0".repeat(requiredZeroes);
  return position === "before" ? "" + zeroes + num : "" + num + zeroes;
};

export { zeroPaddedString };
