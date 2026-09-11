const path = require('node:path');
// Tests stage their artifacts outside tracked acceptance evidence. Publishing
// an acceptance refresh is an explicit file operation after the gate passes.
module.exports = function browserQaOutput(relative) {
  return path.resolve(process.env.CHAMPIONSHIP_QA_OUTPUT_ROOT || '.tmp/browser-qa', relative);
};
