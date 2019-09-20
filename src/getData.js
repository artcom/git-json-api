module.exports = async (repo, params, query) => {
  const flatten = query.flatten === "true"
  const path = params[0] || ""
  const { commitHash, data } = await repo.getData(params.reference, flatten, path)

  return {
    headers: { "Git-Commit-Hash": commitHash },
    body: data
  }
}
