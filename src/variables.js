module.exports.replaceVariablesWithValues = content => {
  if (process.env.BACKEND_URL) {
    return content.replace(/\${backendUrl}/g, process.env.BACKEND_URL)
  } else {
    return content
  }
}

module.exports.replaceValuesWithVariables = content => {
  if (process.env.BACKEND_URL) {
    const regExp = new RegExp(process.env.BACKEND_URL, "g")
    return JSON.parse(JSON.stringify(content).replace(regExp, "${backendUrl}"))
  } else {
    return content
  }
}
