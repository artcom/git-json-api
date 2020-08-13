module.exports.replaceVariablesWithValues = content => process.env.BACKEND_HOST
  ? content.replace(/\${backendHost}/g, process.env.BACKEND_HOST)
  : content

module.exports.replaceValuesWithVariables = content => {
  if (process.env.BACKEND_HOST) {
    const regExp = new RegExp(process.env.BACKEND_HOST, "g")
    return JSON.parse(JSON.stringify(content).replace(regExp, "${backendHost}"))
  } else {
    return content
  }
}
