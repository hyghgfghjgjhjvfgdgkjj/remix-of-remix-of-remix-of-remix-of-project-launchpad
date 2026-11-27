const path = require('node:path');
function matchDownload(pending, downloads, urls) {
  const index = pending.findIndex((id) => urls.includes(downloads.get(id)?.url));
  if (index < 0) return null;
  const [id] = pending.splice(index, 1);
  return downloads.get(id) || null;
}
function downloadFilename(filename, id) {
  const clean = path.basename(filename).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
  const extension = path.extname(clean);
  return `${path.basename(clean, extension) || 'Movie'}-${id}${extension || '.mp4'}`;
}
module.exports = { matchDownload, downloadFilename };