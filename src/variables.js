const camelCase = require("lodash.camelcase")

const variablesToValues = Object.entries(process.env)
  .filter(([key]) => key.startsWith("GIT_JSON_API_VAR_"))
  .map(([key, value]) => [new RegExp(`\\$\{${camelCase(key.substr(17))}}`, "g"), value])


const valuesToVariables = Object.entries(process.env)
  .filter(([key]) => key.startsWith("GIT_JSON_API_VAR_"))
  .map(([key, value]) => [new RegExp(value, "g"), `$\{${camelCase(key.substr(17))}}`])

module.exports.replaceVariablesWithValues = content =>
  variablesToValues.reduce((result, [regExp, val]) => result.replace(regExp, val), content)

module.exports.replaceValuesWithVariables = content =>
  valuesToVariables.reduce((result, [regExp, val]) => result.replace(regExp, val), content)
