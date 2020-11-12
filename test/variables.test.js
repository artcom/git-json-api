process.env.GIT_JSON_API_VAR_MY_VAR1 = "value1"
process.env.GIT_JSON_API_VAR_MY_VAR2 = "value2"
process.env.GIT_JSON_API_VAR_VAR3 = "value3"

const { replaceVariablesWithValues, replaceValuesWithVariables } = require("../src/variables")

describe("Variables", () => {
  test("Replace variables with values", async () => {
    const result = replaceVariablesWithValues(
      "Test string ${myVar1}, \"${myVar1}\",\n${myVar2} and ${var3}"
    )

    expect(result).toBe(
      "Test string value1, \"value1\",\nvalue2 and value3"
    )
  })

  test("Replace values with variables", async () => {
    const result = replaceValuesWithVariables(
      "Test string value1, \"value1\",\nvalue2 and value3"
    )

    expect(result).toBe(
      "Test string ${myVar1}, \"${myVar1}\",\n${myVar2} and ${var3}"
    )
  })
})
