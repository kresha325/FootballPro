/** Continues the profile card border around virtualized tab rows. */
export function profileRowFrame(frame, edge) {
  if (!frame) return null;
  return {
    marginHorizontal: 16,
    backgroundColor: frame.backgroundColor,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: frame.borderColor,
    paddingHorizontal: 18,
    ...(edge === 'end'
      ? {
          borderBottomWidth: 1,
          borderBottomLeftRadius: 16,
          borderBottomRightRadius: 16,
          paddingBottom: 18,
        }
      : null),
  };
}
