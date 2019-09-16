exports.requesthandler = (repo, callback) => async (req, res) => {
  try {
    const { headers, body } = await callback(repo, req.params, req.body)

    Object.keys(headers).forEach(key => res.setHeader(key, headers[key]))

    if (body) {
      res.json(body)
    } else {
      res.end()
    }
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
