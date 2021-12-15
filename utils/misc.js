/**
 * Module containing useful reusable functions
 * @module utils/misc
 * @author Petar Drumev
 */

/**
 * A Promise for a setTimeout.
 *
 * Its purpose is that it can be awaited
 * @param {number} millis Amount of time in milliseconds
 */
const delay = millis => new Promise((resolve) => {
  setTimeout(_ => resolve(), millis);
});

/**
 * Searches a string for a target and returns indices of all instances of that target within the string
 * @param {string} str String to be searched
 * @param {string} target Target string you're searching for
 * @param {Array} array Empty array
 * @returns {Array<number>} Every starting position (index) of the target within the string. If no targets found, will return an empty array.
 */
const searchString = (str, target, array) => {
  const index = str.indexOf(target);
  if (index === -1) return array; // Base case | string.indexOf returns -1 if no matches were found
  array.push(index);
  return searchString(str.slice(index), target, array);
};

module.exports = {
  delay: delay,
  searchString: searchString
};
