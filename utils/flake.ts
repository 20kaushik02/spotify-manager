const sleep = (ms: number): Promise<unknown> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const randomBool = (chance_of_failure = 0.25): boolean =>
  Math.random() < chance_of_failure;

export { sleep, randomBool };
