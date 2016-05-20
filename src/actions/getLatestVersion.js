export default async function getLatestVersion(repo) {
  const master = await repo.getMasterCommit()
  return { version: master.sha() }
}
