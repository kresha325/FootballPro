function viewerCanSeeVideo(video, viewer) {
  if (!video) return false;
  const visibility = video.visibility || 'public';
  if (visibility !== 'private') return true;
  if (!viewer) return false;
  if (viewer.role === 'admin') return true;
  return Number(viewer.id) === Number(video.userId);
}

module.exports = { viewerCanSeeVideo };
