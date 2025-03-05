export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const randomBool = (chance_of_failure = 0.25) => Math.random() < chance_of_failure;
