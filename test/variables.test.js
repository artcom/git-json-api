process.env.GIT_JSON_API_VARIABLES = "var1=value1;var2=value2;var3=value3"

const { replaceVariablesWithValues, replaceValuesWithVariables } = require("../src/variables")

describe("Variables", () => {
  beforeAll(async () => {
  })

  test("Replace variables with values", async () => {
    const result = replaceVariablesWithValues(
      "Test string ${var1}, \"${var1}\",\n${var2} and ${var3}"
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
      "Test string ${var1}, \"${var1}\",\n${var2} and ${var3}"
    )
  })
})
