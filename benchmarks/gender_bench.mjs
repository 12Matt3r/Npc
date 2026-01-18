// Simulated imported constants (hoisted)
const GENDER_HEURISTIC_FEMALE_NAMES = ['sarah', 'emma', 'sophie', 'chloe', 'ava', 'mia', 'isabella', 'emily', 'grace', 'hannah', 'lily', 'zoe', 'leah', 'lucy', 'ella', 'freya', 'ivy', 'scarlett', 'imogen', 'poppy', 'alice', 'ruby', 'charlie', 'brooke', 'daisy'];
const GENDER_HEURISTIC_MALE_NAMES = ['oliver', 'harry', 'jack', 'jacob', 'noah', 'charlie', 'thomas', 'william', 'james', 'george', 'alfie', 'joshua', 'muhammad', 'harrison', 'leo', 'alexander', 'archie', 'mason', 'ethan', 'joseph', 'freddie', 'samuel', 'ryan'];

// Old implementation (re-creating arrays)
function getCharacterGenderOld(character) {
  const name = character.name ? character.name.toLowerCase() : '';

  // Re-creating arrays every time (Optimization target)
  const femaleNames = ['sarah', 'emma', 'sophie', 'chloe', 'ava', 'mia', 'isabella', 'emily', 'grace', 'hannah', 'lily', 'zoe', 'leah', 'lucy', 'ella', 'freya', 'ivy', 'scarlett', 'imogen', 'poppy', 'alice', 'ruby', 'charlie', 'brooke', 'daisy'];
  const maleNames = ['oliver', 'harry', 'jack', 'jacob', 'noah', 'charlie', 'thomas', 'william', 'james', 'george', 'alfie', 'joshua', 'muhammad', 'harrison', 'leo', 'alexander', 'archie', 'mason', 'ethan', 'joseph', 'freddie', 'samuel', 'ryan'];

  if (femaleNames.some(n => name.includes(n))) return 'female';
  if (maleNames.some(n => name.includes(n))) return 'male';
  return 'female';
}

// New implementation (using hoisted constants)
function getCharacterGenderNew(character) {
  const name = character.name ? character.name.toLowerCase() : '';
  if (GENDER_HEURISTIC_FEMALE_NAMES.some(n => name.includes(n))) return 'female';
  if (GENDER_HEURISTIC_MALE_NAMES.some(n => name.includes(n))) return 'male';
  return 'female';
}

// Benchmark
const iterations = 1000000;
const testChar = { name: "Alexander the Great" };

console.log(`Running benchmark with ${iterations} iterations...`);

const startOld = performance.now();
for (let i = 0; i < iterations; i++) {
  getCharacterGenderOld(testChar);
}
const endOld = performance.now();
const timeOld = endOld - startOld;

const startNew = performance.now();
for (let i = 0; i < iterations; i++) {
  getCharacterGenderNew(testChar);
}
const endNew = performance.now();
const timeNew = endNew - startNew;

console.log(`Old Implementation: ${timeOld.toFixed(2)}ms`);
console.log(`New Implementation: ${timeNew.toFixed(2)}ms`);
console.log(`Improvement: ${((timeOld - timeNew) / timeOld * 100).toFixed(2)}%`);
