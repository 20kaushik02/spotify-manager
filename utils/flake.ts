export const sleep = (ms: number): Promise<unknown> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const randomBool = (chance_of_failure = 0.25): boolean =>
  Math.random() < chance_of_failure;

new Promise((resolve) => setTimeout(resolve, 100));
