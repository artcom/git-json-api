const variablesToValues = (process.env.GIT_JSON_API_VARIABLES || "")
  .split(";")
  .map(entry => entry.split("="))
  .map(([variable, value]) => [new RegExp(`\\$\{${variable}}`, "g"), value])

const valuesToVariables = (process.env.GIT_JSON_API_VARIABLES || "")
  .split(";")
  .map(entry => entry.split("="))
  .map(([variable, value]) => [new RegExp(value, "g"), `$\{${variable}}`])

module.exports.replaceVariablesWithValues = content =>
  variablesToValues.reduce((result, [regExp, val]) => result.replace(regExp, val), content)

module.exports.replaceValuesWithVariables = content =>
  valuesToVariables.reduce((result, [regExp, val]) => result.replace(regExp, val), content)
