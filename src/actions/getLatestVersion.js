export default async function getLatestVersion(repo) {
  const commit = await repo.getReferenceCommit("refs/remotes/origin/master")
  return { version: commit.sha() }
}
