// Express 5 removed res.redirect("back"). Return the referring page when it is
// on this site (never redirect to another origin), else a safe fallback.
module.exports = function backTo(req, fallback = "/") {
  const ref = req.get("Referer");
  if (!ref) return fallback;
  try {
    const url = new URL(ref, `${req.protocol}://${req.get("host")}`);
    if (url.host !== req.get("host")) return fallback;
    return url.pathname + url.search;
  } catch {
    return fallback;
  }
};
