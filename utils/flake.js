const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const randomBool = (chance_of_failure = 0.25) => Math.random() < chance_of_failure;

module.exports = {
  sleep, randomBool
};
