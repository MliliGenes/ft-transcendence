export function graphifyLabelCoverageSentence(communityIds, labelStore) {
  if (labelStore == null) {
    return 'This build had no saved label store to compare against, so the community names below are shown exactly as graphify left them.';
  }

  const missingLabels = communityIds.filter(
    (id) => !Object.hasOwn(labelStore, String(id)),
  ).length;
  if (missingLabels > 0) {
    return `In this build, ${missingLabels} of the ${communityIds.length} communities have no saved label and are listed under their hub's name.`;
  }

  return `In this build, all ${communityIds.length} communities carry a saved label.`;
}
