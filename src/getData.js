module.exports = async (repo, params) => {
  const path = params[0] || ""
  const { commitHash, data } = await repo.getData(params.reference, path)

  return {
    headers: { "Git-Commit-Hash": commitHash },
    body: data
  }
}
